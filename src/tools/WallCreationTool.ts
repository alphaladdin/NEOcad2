/**
 * WallCreationTool - Interactive tool for creating parametric walls
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ParametricWall } from '@parametric/ParametricWall';
import { ParameterEngine } from '@parametric/ParameterEngine';
import { GeometryEngineWrapper } from '@parametric/GeometryEngineWrapper';
import { WallTypeManager } from '@framing/WallTypeManager';
import type { WallType } from '@framing/WallType';

export interface WallCreationToolConfig {
  defaultHeight?: number;
  defaultThickness?: number;
  defaultElevation?: number;
  snapToGrid?: boolean;
  gridSize?: number;
  previewColor?: THREE.Color;
  continuousMode?: boolean; // Enable continuous wall drawing
  wallTypeManager?: WallTypeManager; // Wall type manager
  defaultWallTypeId?: string; // Default wall type to use
  orthoSnap?: boolean; // Enable orthogonal snapping (0°, 90°, 180°, 270°)
  orthoSnapAngle?: number; // Angle threshold for ortho snap in degrees
}

/**
 * Tool for creating parametric walls by clicking in the viewport
 */
export class WallCreationTool {
  private isActive: boolean = false;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private parameterEngine: ParameterEngine;
  private geometryEngine: GeometryEngineWrapper;
  private wallTypeManager: WallTypeManager;
  private config: Required<Omit<WallCreationToolConfig, 'wallTypeManager' | 'defaultWallTypeId'>> & {
    wallTypeManager: WallTypeManager;
    defaultWallTypeId: string;
    orthoSnap: boolean;
    orthoSnapAngle: number;
  };

  // Creation state
  private startPoint: THREE.Vector3 | null = null;
  private endPoint: THREE.Vector3 | null = null;
  private previewWall: ParametricWall | null = null;
  private previewMesh: THREE.Mesh | null = null;

  // Visual helpers
  private startMarker: THREE.Mesh | null = null;
  private dimensionLine: THREE.Line | null = null;
  private helpersGroup: THREE.Group;

  // Created walls
  private walls: ParametricWall[] = [];

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    config: WallCreationToolConfig = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.parameterEngine = parameterEngine;
    this.geometryEngine = geometryEngine;
    this.wallTypeManager = config.wallTypeManager || WallTypeManager.getInstance();

    // Get default wall type dimensions
    const defaultWallType = this.wallTypeManager.getDefaultWallType();

    this.config = {
      defaultHeight: config.defaultHeight ?? defaultWallType.defaultHeight * 0.3048, // feet to meters
      defaultThickness: config.defaultThickness ?? defaultWallType.actualThickness * 0.0254, // inches to meters
      defaultElevation: config.defaultElevation ?? 0,
      snapToGrid: config.snapToGrid ?? true,
      gridSize: config.gridSize ?? 0.3048, // 1 foot = 0.3048 meters (snap to 1 ft grid)
      previewColor: config.previewColor ?? new THREE.Color(0x4CAF50),
      continuousMode: config.continuousMode ?? true, // Enable continuous mode by default
      wallTypeManager: this.wallTypeManager,
      defaultWallTypeId: config.defaultWallTypeId || defaultWallType.id,
      orthoSnap: config.orthoSnap ?? true, // Enable orthogonal snapping by default
      orthoSnapAngle: config.orthoSnapAngle ?? 15, // 15 degree threshold for ortho snap
    };

    this.helpersGroup = new THREE.Group();
    this.helpersGroup.name = 'WallCreationHelpers';
    this.scene.add(this.helpersGroup);

    logger.info('WallCreationTool', 'WallCreationTool created');
  }

  /**
   * Activate the wall creation tool
   */
  activate(): void {
    if (this.isActive) return;

    if (!this.geometryEngine.isReady()) {
      logger.error('WallCreationTool', 'GeometryEngine not initialized');
      eventBus.emit(Events.APP_ERROR, {
        message: 'Geometry engine not ready. Please wait for initialization.',
      });
      return;
    }

    this.isActive = true;
    this.reset();
    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'wall-creation' });
    logger.info('WallCreationTool', 'Wall creation tool activated');
  }

  /**
   * Deactivate the wall creation tool
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.clearPreview();
    this.clearHelpers();
    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'wall-creation' });
    logger.info('WallCreationTool', 'Wall creation tool deactivated');
  }

  /**
   * Check if tool is active
   */
  isToolActive(): boolean {
    return this.isActive;
  }

  /**
   * Handle mouse click in viewport
   * @param intersectionPoint - The 3D point where the mouse clicked
   */
  onClick(intersectionPoint: THREE.Vector3): void {
    if (!this.isActive) return;

    let snappedPoint = this.snapPoint(intersectionPoint);

    if (!this.startPoint) {
      // First click - set start point
      this.setStartPoint(snappedPoint);
    } else {
      // Second click - apply orthogonal snap and create wall
      snappedPoint = this.applyOrthoSnap(snappedPoint);
      this.setEndPoint(snappedPoint);
      this.createWall();

      // Continuous mode: end point becomes new start point
      if (this.config.continuousMode) {
        this.startPoint = this.endPoint.clone();
        this.endPoint = null;

        // Update start marker position
        if (this.startMarker) {
          this.startMarker.position.copy(this.startPoint);
        }

        // Clear preview for next segment
        this.clearPreview();

        logger.debug('WallCreationTool', 'Continuous mode: ready for next wall segment');
      } else {
        // Single wall mode: reset everything
        this.reset();
      }
    }
  }

  /**
   * Handle mouse move in viewport
   * @param intersectionPoint - The 3D point where the mouse is
   */
  onMouseMove(intersectionPoint: THREE.Vector3): void {
    if (!this.isActive || !this.startPoint) return;

    const snappedPoint = this.snapPoint(intersectionPoint);
    this.updatePreview(snappedPoint);
  }

  /**
   * Handle escape key - complete continuous drawing or cancel operation
   */
  onEscape(): void {
    if (!this.isActive) return;

    // If in continuous mode with a start point, complete the sequence
    if (this.config.continuousMode && this.startPoint) {
      // Clear current drawing state but keep created walls
      this.startPoint = null;
      this.endPoint = null;
      this.clearPreview();
      this.clearHelpers();
      logger.info('WallCreationTool', 'Continuous wall drawing completed');
    } else {
      // Normal cancel behavior
      this.reset();
      logger.debug('WallCreationTool', 'Wall creation cancelled');
    }
  }

  /**
   * Set start point and create marker
   */
  private setStartPoint(point: THREE.Vector3): void {
    this.startPoint = point.clone();

    // Create start marker
    const markerGeometry = new THREE.SphereGeometry(0.1524, 16, 16); // 6 inches = 0.1524 meters
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: this.config.previewColor,
      transparent: true,
      opacity: 0.8,
    });
    this.startMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.startMarker.position.copy(this.startPoint);
    this.helpersGroup.add(this.startMarker);

    logger.debug('WallCreationTool', `Start point set: ${point.toArray()}`);
  }

  /**
   * Set end point
   */
  private setEndPoint(point: THREE.Vector3): void {
    this.endPoint = point.clone();
    logger.debug('WallCreationTool', `End point set: ${point.toArray()}`);
  }

  /**
   * Update preview wall as mouse moves
   */
  private updatePreview(endPoint: THREE.Vector3): void {
    if (!this.startPoint) return;

    // Apply orthogonal snapping
    const snappedEndPoint = this.applyOrthoSnap(endPoint);

    // Clear old preview
    this.clearPreview();

    // Check minimum length
    const length = this.startPoint.distanceTo(snappedEndPoint);
    if (length < 0.3048) return; // Minimum 1 foot

    // Get current wall type
    const wallType = this.wallTypeManager.getWallType(this.config.defaultWallTypeId);

    // Create preview wall (convert all values to millimeters for ParametricWall)
    // Note: ParametricWall expects coordinates in mm, but Three.js Vector3 is in meters
    const startMM = this.startPoint.clone().multiplyScalar(1000);
    const endMM = snappedEndPoint.clone().multiplyScalar(1000);

    this.previewWall = new ParametricWall(
      this.parameterEngine,
      this.geometryEngine,
      {
        startPoint: startMM,
        endPoint: endMM,
        height: this.config.defaultHeight * 1000,      // meters to mm
        thickness: this.config.defaultThickness * 1000, // meters to mm
        elevation: this.config.defaultElevation * 1000, // meters to mm
        wallType: wallType || undefined,
      }
    );

    // Get preview mesh
    this.previewMesh = this.previewWall.getMesh();
    if (this.previewMesh) {
      // Make it semi-transparent
      const material = this.previewMesh.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = 0.6;
      material.color = this.config.previewColor;
      material.emissive = this.config.previewColor;
      material.emissiveIntensity = 0.3;

      this.helpersGroup.add(this.previewMesh);
    }

    // Update dimension line
    this.updateDimensionLine(this.startPoint, snappedEndPoint);
  }

  /**
   * Update dimension line showing wall length
   */
  private updateDimensionLine(start: THREE.Vector3, end: THREE.Vector3): void {
    if (this.dimensionLine) {
      this.helpersGroup.remove(this.dimensionLine);
      this.dimensionLine.geometry.dispose();
      (this.dimensionLine.material as THREE.Material).dispose();
    }

    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xFFFF00,
      linewidth: 2,
    });

    this.dimensionLine = new THREE.Line(geometry, material);
    this.helpersGroup.add(this.dimensionLine);
  }

  /**
   * Create the actual wall
   */
  private createWall(): void {
    if (!this.startPoint || !this.endPoint) return;

    // Check minimum length
    const length = this.startPoint.distanceTo(this.endPoint);
    if (length < 0.3048) {
      logger.warn('WallCreationTool', 'Wall too short, minimum length is 1 foot');
      return;
    }

    // Get current wall type
    const wallType = this.wallTypeManager.getWallType(this.config.defaultWallTypeId);

    // Create wall (convert all values to millimeters for ParametricWall)
    // Note: ParametricWall expects coordinates in mm, but Three.js Vector3 is in meters
    const startMM = this.startPoint.clone().multiplyScalar(1000);
    const endMM = this.endPoint.clone().multiplyScalar(1000);

    const wall = new ParametricWall(
      this.parameterEngine,
      this.geometryEngine,
      {
        startPoint: startMM,
        endPoint: endMM,
        height: this.config.defaultHeight * 1000,      // meters to mm
        thickness: this.config.defaultThickness * 1000, // meters to mm
        elevation: this.config.defaultElevation * 1000, // meters to mm
        wallType: wallType || undefined,
      }
    );

    // Add to scene
    const mesh = wall.getMesh();
    if (mesh) {
      this.scene.add(mesh);
    }

    // Store wall
    this.walls.push(wall);

    // Emit event
    eventBus.emit(Events.PARAMETRIC_ELEMENT_CREATED, {
      element: wall,
      type: 'wall',
    });

    logger.info(
      'WallCreationTool',
      `Created wall: ${wall.name}, length: ${wall.getLength().toFixed(2)}m`
    );
  }

  /**
   * Snap point to grid if enabled
   */
  private snapPoint(point: THREE.Vector3): THREE.Vector3 {
    if (!this.config.snapToGrid) {
      return point;
    }

    const gridSize = this.config.gridSize;
    return new THREE.Vector3(
      Math.round(point.x / gridSize) * gridSize,
      Math.round(point.y / gridSize) * gridSize,
      Math.round(point.z / gridSize) * gridSize
    );
  }

  /**
   * Apply orthogonal snapping to constrain wall angles to 0°, 90°, 180°, 270°
   * This prevents the wall from rotating at arbitrary angles
   */
  private applyOrthoSnap(endPoint: THREE.Vector3): THREE.Vector3 {
    if (!this.config.orthoSnap || !this.startPoint) {
      return endPoint;
    }

    // Calculate the vector from start to end
    const dx = endPoint.x - this.startPoint.x;
    const dz = endPoint.z - this.startPoint.z;

    // Calculate angle in degrees (using atan2 for proper quadrant handling)
    const angleRad = Math.atan2(dz, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    // Find the nearest cardinal angle (0°, 90°, 180°, -90°)
    const cardinalAngles = [0, 90, 180, -90];
    let nearestAngle = cardinalAngles[0];
    let minDiff = Math.abs(angleDeg - nearestAngle);

    for (const cardinalAngle of cardinalAngles) {
      const diff = Math.abs(angleDeg - cardinalAngle);
      if (diff < minDiff) {
        minDiff = diff;
        nearestAngle = cardinalAngle;
      }
    }

    // Check if within snap threshold
    if (minDiff <= this.config.orthoSnapAngle) {
      // Snap to this angle
      const radians = nearestAngle * (Math.PI / 180);
      const length = Math.sqrt(dx * dx + dz * dz);

      return new THREE.Vector3(
        this.startPoint.x + Math.cos(radians) * length,
        endPoint.y, // Keep Y unchanged
        this.startPoint.z + Math.sin(radians) * length
      );
    }

    return endPoint;
  }

  /**
   * Reset creation state
   */
  private reset(): void {
    this.startPoint = null;
    this.endPoint = null;
    this.clearPreview();
    this.clearHelpers();
  }

  /**
   * Clear preview wall
   */
  private clearPreview(): void {
    if (this.previewMesh) {
      this.helpersGroup.remove(this.previewMesh);
      this.previewMesh = null;
    }

    if (this.previewWall) {
      this.previewWall.dispose();
      this.previewWall = null;
    }
  }

  /**
   * Clear all visual helpers
   */
  private clearHelpers(): void {
    if (this.startMarker) {
      this.helpersGroup.remove(this.startMarker);
      this.startMarker.geometry.dispose();
      (this.startMarker.material as THREE.Material).dispose();
      this.startMarker = null;
    }

    if (this.dimensionLine) {
      this.helpersGroup.remove(this.dimensionLine);
      this.dimensionLine.geometry.dispose();
      (this.dimensionLine.material as THREE.Material).dispose();
      this.dimensionLine = null;
    }
  }

  /**
   * Get all created walls
   */
  getWalls(): ParametricWall[] {
    return this.walls;
  }

  /**
   * Remove a wall
   */
  removeWall(wall: ParametricWall): void {
    const index = this.walls.indexOf(wall);
    if (index > -1) {
      // Remove from scene
      const mesh = wall.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }

      // Dispose wall
      wall.dispose();

      // Remove from array
      this.walls.splice(index, 1);

      // Emit event
      eventBus.emit(Events.PARAMETRIC_ELEMENT_REMOVED, {
        element: wall,
        type: 'wall',
      });

      logger.info('WallCreationTool', `Removed wall: ${wall.name}`);
    }
  }

  /**
   * Clear all walls
   */
  clearAllWalls(): void {
    this.walls.forEach((wall) => {
      const mesh = wall.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }
      wall.dispose();
    });

    this.walls = [];
    logger.info('WallCreationTool', 'Cleared all walls');
  }

  /**
   * Set default wall height
   */
  setDefaultHeight(height: number): void {
    this.config.defaultHeight = height;
    logger.debug('WallCreationTool', `Default height set to ${height}m`);
  }

  /**
   * Set default wall thickness
   */
  setDefaultThickness(thickness: number): void {
    this.config.defaultThickness = thickness;
    logger.debug('WallCreationTool', `Default thickness set to ${thickness}m`);
  }

  /**
   * Set snap to grid
   */
  setSnapToGrid(enabled: boolean): void {
    this.config.snapToGrid = enabled;
    logger.debug('WallCreationTool', `Snap to grid: ${enabled}`);
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): void {
    this.config.gridSize = size;
    logger.debug('WallCreationTool', `Grid size set to ${size}m`);
  }

  /**
   * Set continuous mode
   */
  setContinuousMode(enabled: boolean): void {
    this.config.continuousMode = enabled;
    logger.debug('WallCreationTool', `Continuous mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get continuous mode status
   */
  isContinuousMode(): boolean {
    return this.config.continuousMode;
  }

  /**
   * Set orthogonal snap mode
   */
  setOrthoSnap(enabled: boolean): void {
    this.config.orthoSnap = enabled;
    logger.debug('WallCreationTool', `Orthogonal snap: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get orthogonal snap status
   */
  isOrthoSnapEnabled(): boolean {
    return this.config.orthoSnap;
  }

  /**
   * Set orthogonal snap angle threshold
   */
  setOrthoSnapAngle(angleDegrees: number): void {
    this.config.orthoSnapAngle = angleDegrees;
    logger.debug('WallCreationTool', `Orthogonal snap angle set to ${angleDegrees}°`);
  }

  /**
   * Set active wall type
   */
  setWallType(wallTypeId: string): void {
    const wallType = this.wallTypeManager.getWallType(wallTypeId);
    if (!wallType) {
      logger.error('WallCreationTool', `Wall type not found: ${wallTypeId}`);
      return;
    }

    this.config.defaultWallTypeId = wallTypeId;

    // Update default dimensions based on new wall type
    this.config.defaultHeight = wallType.defaultHeight * 0.3048; // feet to meters
    this.config.defaultThickness = wallType.actualThickness * 0.0254; // inches to meters

    logger.info(
      'WallCreationTool',
      `Active wall type set to: ${wallType.name} (${wallType.actualThickness}" thick × ${wallType.defaultHeight}' tall)`
    );
  }

  /**
   * Get active wall type
   */
  getWallType(): WallType | undefined {
    return this.wallTypeManager.getWallType(this.config.defaultWallTypeId);
  }

  /**
   * Get wall type manager
   */
  getWallTypeManager(): WallTypeManager {
    return this.wallTypeManager;
  }

  /**
   * Export all walls to JSON
   */
  exportWalls(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      walls: this.walls.map((wall) => wall.toJSON()),
    };
  }

  /**
   * Import walls from JSON
   */
  importWalls(data: any): void {
    if (!data.walls || !Array.isArray(data.walls)) {
      logger.error('WallCreationTool', 'Invalid wall data');
      return;
    }

    data.walls.forEach((wallData: any) => {
      const wall = ParametricWall.fromJSON(
        wallData,
        this.parameterEngine,
        this.geometryEngine
      );

      const mesh = wall.getMesh();
      if (mesh) {
        this.scene.add(mesh);
      }

      this.walls.push(wall);
    });

    logger.info('WallCreationTool', `Imported ${data.walls.length} walls`);
  }

  /**
   * Dispose the tool
   */
  dispose(): void {
    this.deactivate();
    this.clearAllWalls();
    this.scene.remove(this.helpersGroup);
    logger.info('WallCreationTool', 'WallCreationTool disposed');
  }
}
