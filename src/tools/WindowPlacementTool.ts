/**
 * WindowPlacementTool - Interactive tool for placing parametric windows in walls
 *
 * This tool allows users to:
 * 1. Click on a wall to select it
 * 2. See a preview of the window at the click position
 * 3. Slide the window along the wall by moving the mouse
 * 4. Click again to place the window at the final position
 * 5. Creates a window opening in the wall (boolean subtraction)
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ParametricWindow, WindowType } from '@parametric/ParametricWindow';
import { ParametricWall } from '@parametric/ParametricWall';
import { ParameterEngine } from '@parametric/ParameterEngine';
import { GeometryEngineWrapper } from '@parametric/GeometryEngineWrapper';
import { Raycaster } from '@viewport/Raycaster';

export interface WindowPlacementToolConfig {
  defaultWindowType?: WindowType;
  defaultWidth?: number;        // Window width in mm (default: 1200)
  defaultHeight?: number;       // Window height in mm (default: 1500)
  defaultSillHeight?: number;   // Sill height in mm (default: 900)
  previewColor?: THREE.Color;
  previewOpacity?: number;      // Preview opacity (default: 0.6)
  snapToGrid?: boolean;         // Snap window position to grid (default: true)
  gridSize?: number;            // Grid size for snapping in mm (default: 100)
  createOpening?: boolean;      // Create opening in wall (default: true)
}

/**
 * Tool for placing parametric windows in walls by clicking in the viewport
 */
export class WindowPlacementTool {
  private isActive: boolean = false;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private parameterEngine: ParameterEngine;
  private geometryEngine: GeometryEngineWrapper;
  private raycaster: Raycaster;
  private config: Required<WindowPlacementToolConfig>;

  // Placement state
  private selectedWall: ParametricWall | null = null;
  private wallPosition: number = 0.5; // Position along wall (0-1)
  private previewWindow: ParametricWindow | null = null;
  private previewMesh: THREE.Mesh | null = null;
  private isPreviewVisible: boolean = false;

  // Visual preview helpers
  private previewBoundingBox: THREE.BoxHelper | null = null;
  private previewPositionLine: THREE.Line | null = null;

  // Created windows
  private windows: ParametricWindow[] = [];

  // Available walls for raycasting
  private walls: ParametricWall[] = [];

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    config: WindowPlacementToolConfig = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.parameterEngine = parameterEngine;
    this.geometryEngine = geometryEngine;
    this.raycaster = new Raycaster({
      recursive: true,
      threshold: 0.1,
    });

    this.config = {
      defaultWindowType: config.defaultWindowType ?? 'fixed',
      defaultWidth: config.defaultWidth ?? 1200,
      defaultHeight: config.defaultHeight ?? 1500,
      defaultSillHeight: config.defaultSillHeight ?? 900,
      previewColor: config.previewColor ?? new THREE.Color(0x00FF00), // Bright green for better visibility
      previewOpacity: config.previewOpacity ?? 0.75, // Increased opacity
      snapToGrid: config.snapToGrid ?? true,
      gridSize: config.gridSize ?? 100, // 100mm = 10cm
      createOpening: config.createOpening ?? true,
    };

    logger.info('WindowPlacementTool', 'WindowPlacementTool created');
  }

  /**
   * Activate the window placement tool
   */
  activate(): void {
    if (this.isActive) return;

    if (!this.geometryEngine.isReady()) {
      logger.error('WindowPlacementTool', 'GeometryEngine not initialized');
      eventBus.emit(Events.APP_ERROR, {
        message: 'Geometry engine not ready. Please wait for initialization.',
      });
      return;
    }

    this.isActive = true;
    this.reset();
    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'window-placement' });
    logger.info('WindowPlacementTool', 'Window placement tool activated');
  }

  /**
   * Deactivate the window placement tool
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.clearPreview();
    this.selectedWall = null;
    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'window-placement' });
    logger.info('WindowPlacementTool', 'Window placement tool deactivated');
  }

  /**
   * Check if tool is active
   */
  isToolActive(): boolean {
    return this.isActive;
  }

  /**
   * Set available walls for window placement
   * @param walls - Array of walls that windows can be placed in
   */
  setWalls(walls: ParametricWall[]): void {
    this.walls = walls;
    logger.debug('WindowPlacementTool', `Set ${walls.length} walls for window placement`);
  }

  /**
   * Handle mouse click in viewport
   * @param ndc - Normalized device coordinates (-1 to 1)
   */
  onClick(ndc: THREE.Vector2): void {
    if (!this.isActive) return;

    if (!this.selectedWall) {
      // First click - select a wall
      this.selectWall(ndc);
    } else {
      // Second click - place the window
      this.placeWindow();
    }
  }

  /**
   * Handle mouse move in viewport
   * @param ndc - Normalized device coordinates (-1 to 1)
   */
  onMouseMove(ndc: THREE.Vector2): void {
    if (!this.isActive) return;

    if (this.selectedWall) {
      // Update preview position along the wall
      this.updatePreviewPosition(ndc);
    } else {
      // Highlight wall on hover (optional enhancement)
      this.highlightWallOnHover(ndc);
    }
  }

  /**
   * Handle escape key - cancel current operation
   */
  onEscape(): void {
    if (!this.isActive) return;

    if (this.selectedWall) {
      // Cancel window placement
      this.clearPreview();
      this.selectedWall = null;
      logger.debug('WindowPlacementTool', 'Window placement cancelled');
    } else {
      this.reset();
    }
  }

  /**
   * Select a wall by raycasting
   */
  private selectWall(ndc: THREE.Vector2): void {
    // Get wall meshes for raycasting
    const wallMeshes = this.walls
      .map((wall) => wall.getMesh())
      .filter((mesh): mesh is THREE.Mesh => mesh !== null);

    if (wallMeshes.length === 0) {
      logger.warn('WindowPlacementTool', 'No walls available for window placement');
      return;
    }

    // Raycast to find wall intersection
    const result = this.raycaster.castFirstFromCamera(ndc, this.camera, wallMeshes);

    if (!result) {
      logger.debug('WindowPlacementTool', 'No wall hit by raycast');
      return;
    }

    // Find the wall that was hit
    const hitWall = this.walls.find(
      (wall) => wall.getMesh() === result.object
    );

    if (!hitWall) {
      logger.warn('WindowPlacementTool', 'Hit object is not a valid wall');
      return;
    }

    // Select the wall
    this.selectedWall = hitWall;

    // Calculate initial position along wall
    this.wallPosition = this.calculateWallPosition(hitWall, result.point);

    // Create preview window
    this.createPreviewWindow();

    logger.info(
      'WindowPlacementTool',
      `Selected wall: ${hitWall.name}, position: ${(this.wallPosition * 100).toFixed(1)}%`
    );
  }

  /**
   * Calculate position along wall (0-1) from a 3D point
   */
  private calculateWallPosition(wall: ParametricWall, point: THREE.Vector3): number {
    const wallStart = wall.getStartPoint();
    const wallEnd = wall.getEndPoint();

    // CRITICAL FIX: Wall start/end are in millimeters, but raycast point is in meters
    // Convert wall coordinates from mm to meters for consistent calculations
    const wallStartMeters = new THREE.Vector3(
      wallStart.x / 1000,
      wallStart.y / 1000,
      wallStart.z / 1000
    );
    const wallEndMeters = new THREE.Vector3(
      wallEnd.x / 1000,
      wallEnd.y / 1000,
      wallEnd.z / 1000
    );

    const wallVector = new THREE.Vector3().subVectors(wallEndMeters, wallStartMeters);
    const wallLength = wallVector.length();

    // Project point onto wall line (all in meters now)
    const pointVector = new THREE.Vector3().subVectors(point, wallStartMeters);
    const projection = pointVector.dot(wallVector.normalize());

    // Clamp and normalize to 0-1 range
    const position = Math.max(0, Math.min(wallLength, projection)) / wallLength;

    logger.debug('WindowPlacementTool', `calculateWallPosition DEBUG:`);
    logger.debug('WindowPlacementTool', `  wallStart (m): (${wallStartMeters.x.toFixed(3)}, ${wallStartMeters.y.toFixed(3)}, ${wallStartMeters.z.toFixed(3)})`);
    logger.debug('WindowPlacementTool', `  wallEnd (m): (${wallEndMeters.x.toFixed(3)}, ${wallEndMeters.y.toFixed(3)}, ${wallEndMeters.z.toFixed(3)})`);
    logger.debug('WindowPlacementTool', `  wallLength (m): ${wallLength.toFixed(3)}`);
    logger.debug('WindowPlacementTool', `  raycast point (m): (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
    logger.debug('WindowPlacementTool', `  projection (m): ${projection.toFixed(3)}`);
    logger.debug('WindowPlacementTool', `  position (0-1): ${position.toFixed(3)}`);

    return position;
  }

  /**
   * Create preview window
   */
  private createPreviewWindow(): void {
    if (!this.selectedWall) return;

    // Clear existing preview
    this.clearPreview();

    // Create window with default parameters
    this.previewWindow = new ParametricWindow(
      this.parameterEngine,
      this.geometryEngine,
      {
        width: this.config.defaultWidth,
        height: this.config.defaultHeight,
        sillHeight: this.config.defaultSillHeight,
        windowType: this.config.defaultWindowType,
      }
    );

    // Place window in wall at current position
    this.previewWindow.placeInWall(this.selectedWall, this.wallPosition);

    // Get preview mesh
    this.previewMesh = this.previewWindow.getMesh();
    if (this.previewMesh) {
      // Make it semi-transparent with preview color
      const material = this.previewMesh.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = this.config.previewOpacity;
      material.color = this.config.previewColor;
      material.emissive = this.config.previewColor;
      material.emissiveIntensity = 0.5; // Increased emissive intensity

      this.scene.add(this.previewMesh);
      this.isPreviewVisible = true;

      // Add bounding box outline around preview
      this.previewBoundingBox = new THREE.BoxHelper(this.previewMesh, 0xFFFF00); // Yellow outline
      this.previewBoundingBox.material.linewidth = 2;
      this.scene.add(this.previewBoundingBox);

      // Add position indicator line along wall
      this.createPositionIndicatorLine();

      logger.debug('WindowPlacementTool', 'Created window preview with visual guides');
    }
  }

  /**
   * Create a position indicator line showing where the window is along the wall
   */
  private createPositionIndicatorLine(): void {
    if (!this.selectedWall) return;

    const wallStart = this.selectedWall.getStartPoint();
    const wallEnd = this.selectedWall.getEndPoint();

    // Convert from mm to meters
    const wallStartM = new THREE.Vector3(wallStart.x / 1000, wallStart.y / 1000, wallStart.z / 1000);
    const wallEndM = new THREE.Vector3(wallEnd.x / 1000, wallEnd.y / 1000, wallEnd.z / 1000);

    // Calculate position point along wall
    const positionPoint = new THREE.Vector3().lerpVectors(wallStartM, wallEndM, this.wallPosition);

    // Create line from wall base to position point
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(positionPoint.x, 0, positionPoint.z), // Ground level
      new THREE.Vector3(positionPoint.x, positionPoint.y + 3, positionPoint.z) // Above window
    ]);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xFF00FF, // Magenta color
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });

    this.previewPositionLine = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(this.previewPositionLine);
  }

  /**
   * Update preview window position as mouse moves along wall
   */
  private updatePreviewPosition(ndc: THREE.Vector2): void {
    if (!this.selectedWall || !this.previewWindow) return;

    // Get wall mesh for raycasting
    const wallMesh = this.selectedWall.getMesh();
    if (!wallMesh) return;

    // Raycast to find new intersection point on wall
    const result = this.raycaster.castFirstFromCamera(ndc, this.camera, [wallMesh]);

    if (!result) return;

    // Calculate new position along wall
    let newPosition = this.calculateWallPosition(this.selectedWall, result.point);

    // Apply grid snapping if enabled
    if (this.config.snapToGrid) {
      newPosition = this.snapPositionToGrid(newPosition);
    }

    // Only update if position changed significantly
    if (Math.abs(newPosition - this.wallPosition) > 0.001) {
      this.wallPosition = newPosition;

      // Update window position
      this.previewWindow.placeInWall(this.selectedWall, this.wallPosition);

      // Update mesh in scene
      if (this.previewMesh) {
        this.scene.remove(this.previewMesh);
      }

      // Remove old bounding box and position line
      if (this.previewBoundingBox) {
        this.scene.remove(this.previewBoundingBox);
        this.previewBoundingBox = null;
      }
      if (this.previewPositionLine) {
        this.scene.remove(this.previewPositionLine);
        this.previewPositionLine.geometry.dispose();
        (this.previewPositionLine.material as THREE.Material).dispose();
        this.previewPositionLine = null;
      }

      this.previewMesh = this.previewWindow.getMesh();
      if (this.previewMesh) {
        const material = this.previewMesh.material as THREE.MeshStandardMaterial;
        material.transparent = true;
        material.opacity = this.config.previewOpacity;
        material.color = this.config.previewColor;
        material.emissive = this.config.previewColor;
        material.emissiveIntensity = 0.5; // Increased emissive intensity

        this.scene.add(this.previewMesh);

        // Re-add bounding box and position line
        this.previewBoundingBox = new THREE.BoxHelper(this.previewMesh, 0xFFFF00);
        this.previewBoundingBox.material.linewidth = 2;
        this.scene.add(this.previewBoundingBox);

        this.createPositionIndicatorLine();
      }

      logger.debug(
        'WindowPlacementTool',
        `Updated window position: ${(this.wallPosition * 100).toFixed(1)}%`
      );
    }
  }

  /**
   * Snap position along wall to grid
   */
  private snapPositionToGrid(position: number): number {
    if (!this.selectedWall) return position;

    const wallLength = this.selectedWall.getLength();
    const distanceAlongWall = position * wallLength;

    // Snap to grid
    const snappedDistance = Math.round(distanceAlongWall / this.config.gridSize) * this.config.gridSize;

    // Convert back to 0-1 range
    return Math.max(0, Math.min(1, snappedDistance / wallLength));
  }

  /**
   * Place the window at the current position
   */
  private placeWindow(): void {
    if (!this.selectedWall || !this.previewWindow) return;

    // Validate window fits in wall
    const wallLength = this.selectedWall.getLength();
    const windowWidth = this.previewWindow.getParameterValue('Width');

    if (windowWidth > wallLength) {
      logger.warn(
        'WindowPlacementTool',
        `Window too wide (${windowWidth}mm) for wall (${wallLength}mm)`
      );
      eventBus.emit(Events.APP_ERROR, {
        message: 'Window is too wide for this wall',
      });
      return;
    }

    // Create final window (clone preview)
    const window = new ParametricWindow(
      this.parameterEngine,
      this.geometryEngine,
      {
        width: this.config.defaultWidth,
        height: this.config.defaultHeight,
        sillHeight: this.config.defaultSillHeight,
        windowType: this.config.defaultWindowType,
      }
    );

    // Place window in wall
    const success = window.placeInWall(this.selectedWall, this.wallPosition);

    if (!success) {
      logger.error('WindowPlacementTool', 'Failed to place window in wall');
      eventBus.emit(Events.APP_ERROR, {
        message: 'Failed to place window in wall',
      });
      return;
    }

    // Add to scene
    const mesh = window.getMesh();
    if (mesh) {
      this.scene.add(mesh);
    }

    // Store window
    this.windows.push(window);

    // Create opening in wall if enabled
    if (this.config.createOpening) {
      this.createWallOpening(this.selectedWall, window);
    }

    // Emit event
    eventBus.emit(Events.PARAMETRIC_ELEMENT_CREATED, {
      element: window,
      type: 'window',
      wall: this.selectedWall,
      position: this.wallPosition,
    });

    logger.info(
      'WindowPlacementTool',
      `Placed window in wall ${this.selectedWall.name} at position ${(this.wallPosition * 100).toFixed(1)}%`
    );

    // Reset for next window
    this.clearPreview();
    this.selectedWall = null;
  }

  /**
   * Create an opening in the wall for the window (boolean subtraction)
   */
  private createWallOpening(wall: ParametricWall, window: ParametricWindow): void {
    try {
      logger.info(
        'WindowPlacementTool',
        `====> createWallOpening() called for window ${window.name} in wall ${wall.name}`
      );

      // Get window dimensions
      const windowWidth = window.getParameterValue('Width');
      const windowHeight = window.getParameterValue('Height');
      const sillHeight = window.getParameterValue('SillHeight');
      const frameWidth = window.getParameterValue('FrameWidth');

      logger.info(
        'WindowPlacementTool',
        `Creating window opening: ${windowWidth}x${windowHeight}mm at sill height ${sillHeight}mm, frame width ${frameWidth}mm`
      );

      // Use the wall's addOpening method to create the opening
      // This will trigger proper CSG boolean operations using three-bvh-csg
      wall.addOpening({
        type: 'window',
        position: this.wallPosition,
        width: windowWidth,
        height: windowHeight,
        sillHeight: sillHeight,
        elementId: window.id,
      });

      logger.info(
        'WindowPlacementTool',
        `Successfully created opening in wall ${wall.name} for window ${window.name}`
      );
    } catch (error) {
      logger.error('WindowPlacementTool', `Failed to create wall opening: ${error}`);
      console.error(error);
    }
  }

  /**
   * Highlight wall on hover (optional visual feedback)
   */
  private highlightWallOnHover(ndc: THREE.Vector2): void {
    // Optional: Add visual feedback when hovering over walls
    // This could change wall color or add an outline
    // Implementation depends on your visual design preferences
  }

  /**
   * Clear preview window
   */
  private clearPreview(): void {
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }

    if (this.previewBoundingBox) {
      this.scene.remove(this.previewBoundingBox);
      this.previewBoundingBox = null;
    }

    if (this.previewPositionLine) {
      this.scene.remove(this.previewPositionLine);
      this.previewPositionLine.geometry.dispose();
      (this.previewPositionLine.material as THREE.Material).dispose();
      this.previewPositionLine = null;
    }

    if (this.previewWindow) {
      this.previewWindow.dispose();
      this.previewWindow = null;
    }

    this.isPreviewVisible = false;
  }

  /**
   * Reset placement state
   */
  private reset(): void {
    this.selectedWall = null;
    this.wallPosition = 0.5;
    this.clearPreview();
  }

  /**
   * Get all created windows
   */
  getWindows(): ParametricWindow[] {
    return this.windows;
  }

  /**
   * Remove a window
   */
  removeWindow(window: ParametricWindow): void {
    const index = this.windows.indexOf(window);
    if (index > -1) {
      // Remove from scene
      const mesh = window.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }

      // Dispose window
      window.dispose();

      // Remove from array
      this.windows.splice(index, 1);

      // Emit event
      eventBus.emit(Events.PARAMETRIC_ELEMENT_REMOVED, {
        element: window,
        type: 'window',
      });

      logger.info('WindowPlacementTool', `Removed window: ${window.name}`);
    }
  }

  /**
   * Clear all windows
   */
  clearAllWindows(): void {
    this.windows.forEach((window) => {
      const mesh = window.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }
      window.dispose();
    });

    this.windows = [];
    logger.info('WindowPlacementTool', 'Cleared all windows');
  }

  /**
   * Set default window type
   */
  setWindowType(windowType: WindowType): void {
    this.config.defaultWindowType = windowType;
    logger.debug('WindowPlacementTool', `Default window type set to: ${windowType}`);
  }

  /**
   * Get default window type
   */
  getWindowType(): WindowType {
    return this.config.defaultWindowType;
  }

  /**
   * Set default window dimensions
   */
  setWindowDimensions(width: number, height: number, sillHeight?: number): void {
    this.config.defaultWidth = width;
    this.config.defaultHeight = height;
    if (sillHeight !== undefined) {
      this.config.defaultSillHeight = sillHeight;
    }
    logger.debug(
      'WindowPlacementTool',
      `Default window dimensions set to: ${width}x${height}mm, sill: ${this.config.defaultSillHeight}mm`
    );
  }

  /**
   * Set snap to grid
   */
  setSnapToGrid(enabled: boolean): void {
    this.config.snapToGrid = enabled;
    logger.debug('WindowPlacementTool', `Snap to grid: ${enabled}`);
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): void {
    this.config.gridSize = size;
    logger.debug('WindowPlacementTool', `Grid size set to ${size}mm`);
  }

  /**
   * Set preview color
   */
  setPreviewColor(color: THREE.Color): void {
    this.config.previewColor = color;
    logger.debug('WindowPlacementTool', `Preview color set to: ${color.getHexString()}`);
  }

  /**
   * Set preview opacity
   */
  setPreviewOpacity(opacity: number): void {
    this.config.previewOpacity = Math.max(0, Math.min(1, opacity));
    logger.debug('WindowPlacementTool', `Preview opacity set to: ${this.config.previewOpacity}`);
  }

  /**
   * Export all windows to JSON
   */
  exportWindows(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      windows: this.windows.map((window) => window.toJSON()),
    };
  }

  /**
   * Import windows from JSON
   */
  importWindows(data: any): void {
    if (!data.windows || !Array.isArray(data.windows)) {
      logger.error('WindowPlacementTool', 'Invalid window data');
      return;
    }

    data.windows.forEach((windowData: any) => {
      const window = ParametricWindow.fromJSON(
        windowData,
        this.parameterEngine,
        this.geometryEngine
      );

      const mesh = window.getMesh();
      if (mesh) {
        this.scene.add(mesh);
      }

      this.windows.push(window);
    });

    logger.info('WindowPlacementTool', `Imported ${data.windows.length} windows`);
  }

  /**
   * Dispose the tool
   */
  dispose(): void {
    this.deactivate();
    this.clearAllWindows();
    logger.info('WindowPlacementTool', 'WindowPlacementTool disposed');
  }
}
