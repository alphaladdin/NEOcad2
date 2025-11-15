/**
 * DoorPlacementTool - Interactive tool for placing parametric doors in walls
 *
 * This tool allows users to:
 * 1. Click on a wall to select it
 * 2. See a preview of the door at the click position
 * 3. Slide the door along the wall by moving the mouse
 * 4. Click again to place the door at the final position
 * 5. Creates a door opening in the wall (boolean subtraction)
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';
import { eventBus, Events } from '@core/EventBus';
import { ParametricDoor } from '@parametric/ParametricDoor';
import { ParametricWall, type WallOpening } from '@parametric/ParametricWall';
import { ParameterEngine } from '@parametric/ParameterEngine';
import { GeometryEngineWrapper } from '@parametric/GeometryEngineWrapper';
import { Raycaster } from '@viewport/Raycaster';

export type DoorType = 'standard' | 'double' | 'wide' | 'glass' | 'sliding' | 'accessible';

export interface DoorPlacementToolConfig {
  defaultDoorType?: DoorType;
  defaultWidth?: number;        // Door width in mm (default: 762 = 30")
  defaultHeight?: number;       // Door height in mm (default: 2032 = 80")
  defaultThickness?: number;    // Door leaf thickness in mm (default: 40)
  defaultSwingDirection?: 'left' | 'right';  // Default swing direction (default: 'right')
  previewColor?: THREE.Color;
  previewOpacity?: number;      // Preview opacity (default: 0.6)
  snapToGrid?: boolean;         // Snap door position to grid (default: true)
  gridSize?: number;            // Grid size for snapping in mm (default: 100)
  createOpening?: boolean;      // Create opening in wall (default: FALSE - temporarily disabled)
}

/**
 * Tool for placing parametric doors in walls by clicking in the viewport
 */
export class DoorPlacementTool {
  private isActive: boolean = false;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private parameterEngine: ParameterEngine;
  private geometryEngine: GeometryEngineWrapper;
  private raycaster: Raycaster;
  private config: Required<DoorPlacementToolConfig>;

  // Placement state
  private selectedWall: ParametricWall | null = null;
  private wallPosition: number = 0.5; // Position along wall (0-1)
  private previewDoor: ParametricDoor | null = null;
  private previewMesh: THREE.Mesh | null = null;
  private isPreviewVisible: boolean = false;

  // Visual preview helpers
  private previewBoundingBox: THREE.BoxHelper | null = null;
  private previewPositionLine: THREE.Line | null = null;

  // Created doors
  private doors: ParametricDoor[] = [];

  // Available walls for raycasting
  private walls: ParametricWall[] = [];

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    config: DoorPlacementToolConfig = {}
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
      defaultDoorType: config.defaultDoorType ?? 'standard',
      defaultWidth: config.defaultWidth ?? 762,  // 30 inches
      defaultHeight: config.defaultHeight ?? 2032,  // 80 inches
      defaultThickness: config.defaultThickness ?? 40,
      defaultSwingDirection: config.defaultSwingDirection ?? 'right',
      previewColor: config.previewColor ?? new THREE.Color(0x00FF00), // Bright green for better visibility
      previewOpacity: config.previewOpacity ?? 0.75, // Increased opacity for better visibility
      snapToGrid: config.snapToGrid ?? true,
      gridSize: config.gridSize ?? 100, // 100mm = 10cm
      createOpening: config.createOpening ?? true,  // Enable wall opening creation
    };

    logger.info('DoorPlacementTool', 'DoorPlacementTool created');
  }

  /**
   * Activate the door placement tool
   */
  activate(): void {
    if (this.isActive) return;

    if (!this.geometryEngine.isReady()) {
      logger.error('DoorPlacementTool', 'GeometryEngine not initialized');
      eventBus.emit(Events.APP_ERROR, {
        message: 'Geometry engine not ready. Please wait for initialization.',
      });
      return;
    }

    this.isActive = true;
    this.reset();
    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'door-placement' });
    logger.info('DoorPlacementTool', 'Door placement tool activated');
  }

  /**
   * Deactivate the door placement tool
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.clearPreview();
    this.selectedWall = null;
    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'door-placement' });
    logger.info('DoorPlacementTool', 'Door placement tool deactivated');
  }

  /**
   * Check if tool is active
   */
  isToolActive(): boolean {
    return this.isActive;
  }

  /**
   * Set available walls for door placement
   * @param walls - Array of walls that doors can be placed in
   */
  setWalls(walls: ParametricWall[]): void {
    this.walls = walls;
    logger.debug('DoorPlacementTool', `Set ${walls.length} walls for door placement`);
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
      // Second click - place the door
      this.placeDoor();
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
      // Cancel door placement
      this.clearPreview();
      this.selectedWall = null;
      logger.debug('DoorPlacementTool', 'Door placement cancelled');
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
      logger.warn('DoorPlacementTool', 'No walls available for door placement');
      return;
    }

    // Raycast to find wall intersection
    const result = this.raycaster.castFirstFromCamera(ndc, this.camera, wallMeshes);

    if (!result) {
      logger.debug('DoorPlacementTool', 'No wall hit by raycast');
      return;
    }

    // Find the wall that was hit
    const hitWall = this.walls.find(
      (wall) => wall.getMesh() === result.object
    );

    if (!hitWall) {
      logger.warn('DoorPlacementTool', 'Hit object is not a valid wall');
      return;
    }

    // Select the wall
    this.selectedWall = hitWall;

    // Calculate initial position along wall
    this.wallPosition = this.calculateWallPosition(hitWall, result.point);

    // Create preview door
    this.createPreviewDoor();

    logger.info(
      'DoorPlacementTool',
      `Selected wall: ${hitWall.name}, position: ${(this.wallPosition * 100).toFixed(1)}%`
    );
  }

  /**
   * Calculate position along wall (0-1) from a 3D point
   */
  private calculateWallPosition(wall: ParametricWall, point: THREE.Vector3): number {
    // CRITICAL: Wall points are in millimeters, raycast point is in meters
    // Convert raycast point from meters to millimeters
    const pointMM = new THREE.Vector3(
      point.x * 1000,
      point.y * 1000,
      point.z * 1000
    );

    const wallStart = wall.getStartPoint();  // millimeters
    const wallEnd = wall.getEndPoint();      // millimeters
    const wallVector = new THREE.Vector3().subVectors(wallEnd, wallStart);
    const wallLength = wallVector.length();

    logger.debug('DoorPlacementTool', `calculateWallPosition: point=${point.x.toFixed(3)}m,${point.y.toFixed(3)}m,${point.z.toFixed(3)}m -> ${pointMM.x.toFixed(1)}mm,${pointMM.y.toFixed(1)}mm,${pointMM.z.toFixed(1)}mm`);
    logger.debug('DoorPlacementTool', `Wall: start=(${wallStart.x.toFixed(1)},${wallStart.y.toFixed(1)},${wallStart.z.toFixed(1)})mm, end=(${wallEnd.x.toFixed(1)},${wallEnd.y.toFixed(1)},${wallEnd.z.toFixed(1)})mm, length=${wallLength.toFixed(1)}mm`);

    // Project point onto wall line
    // IMPORTANT: Create normalized copy without mutating wallVector
    const wallDirection = wallVector.clone().normalize();
    const pointVector = new THREE.Vector3().subVectors(pointMM, wallStart);
    const projection = pointVector.dot(wallDirection);

    logger.debug('DoorPlacementTool', `Projection: ${projection.toFixed(1)}mm along wall length ${wallLength.toFixed(1)}mm`);

    // Clamp and normalize to 0-1 range
    const position = Math.max(0, Math.min(wallLength, projection)) / wallLength;

    logger.debug('DoorPlacementTool', `Final position: ${(position * 100).toFixed(1)}%`);

    return position;
  }

  /**
   * Create preview door based on the configured door type
   */
  private createPreviewDoor(): void {
    if (!this.selectedWall) return;

    // Clear existing preview
    this.clearPreview();

    // Create door based on type using factory methods or custom config
    const doorType = this.config.defaultDoorType;

    switch (doorType) {
      case 'standard':
        this.previewDoor = ParametricDoor.createStandardDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'double':
        this.previewDoor = ParametricDoor.createDoubleDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'wide':
        this.previewDoor = ParametricDoor.createWideDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'glass':
        this.previewDoor = ParametricDoor.createGlassDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'sliding':
        this.previewDoor = ParametricDoor.createSlidingDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'accessible':
        this.previewDoor = ParametricDoor.createAccessibleDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      default:
        // Create with custom configuration
        this.previewDoor = new ParametricDoor(
          this.parameterEngine,
          this.geometryEngine,
          {
            width: this.config.defaultWidth,
            height: this.config.defaultHeight,
            thickness: this.config.defaultThickness,
            swingDirection: this.config.defaultSwingDirection,
          }
        );
    }

    // Place door in wall at current position
    this.previewDoor.placeInWall(this.selectedWall, this.wallPosition);

    // Force immediate geometry regeneration since position is baked into geometry
    this.previewDoor.updateGeometry();

    // Get preview mesh
    this.previewMesh = this.previewDoor.getMesh();
    if (this.previewMesh) {
      // Make it semi-transparent with preview color
      const material = this.previewMesh.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = this.config.previewOpacity;
      material.color = this.config.previewColor;
      material.emissive = this.config.previewColor;
      material.emissiveIntensity = 0.5; // Increased for better visibility

      this.scene.add(this.previewMesh);
      this.isPreviewVisible = true;

      // Add bounding box outline around preview
      this.previewBoundingBox = new THREE.BoxHelper(this.previewMesh, 0xFFFF00); // Yellow outline
      this.previewBoundingBox.material.linewidth = 2;
      this.scene.add(this.previewBoundingBox);

      // Add position indicator line along wall
      this.createPositionIndicatorLine();

      logger.debug('DoorPlacementTool', `Created ${doorType} door preview with visual guides`);
    }
  }

  /**
   * Create a vertical position indicator line showing door placement along wall
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
      new THREE.Vector3(positionPoint.x, positionPoint.y + 3, positionPoint.z) // Above door
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
   * Update preview door position as mouse moves along wall
   */
  private updatePreviewPosition(ndc: THREE.Vector2): void {
    if (!this.selectedWall || !this.previewDoor) return;

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

      // Update door position
      this.previewDoor.placeInWall(this.selectedWall, this.wallPosition);

      // Force immediate geometry regeneration since position is baked into geometry
      this.previewDoor.updateGeometry();

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

      // Update mesh in scene
      if (this.previewMesh) {
        this.scene.remove(this.previewMesh);
      }

      this.previewMesh = this.previewDoor.getMesh();
      if (this.previewMesh) {
        const material = this.previewMesh.material as THREE.MeshStandardMaterial;
        material.transparent = true;
        material.opacity = this.config.previewOpacity;
        material.color = this.config.previewColor;
        material.emissive = this.config.previewColor;
        material.emissiveIntensity = 0.5; // Increased for better visibility

        this.scene.add(this.previewMesh);

        // Re-add bounding box and position line
        this.previewBoundingBox = new THREE.BoxHelper(this.previewMesh, 0xFFFF00); // Yellow outline
        this.previewBoundingBox.material.linewidth = 2;
        this.scene.add(this.previewBoundingBox);

        this.createPositionIndicatorLine();
      }

      logger.debug(
        'DoorPlacementTool',
        `Updated door position: ${(this.wallPosition * 100).toFixed(1)}%`
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
   * Place the door at the current position
   */
  private placeDoor(): void {
    if (!this.selectedWall || !this.previewDoor) return;

    // Validate door fits in wall
    const wallLength = this.selectedWall.getLength();
    const doorWidth = this.previewDoor.getParameterValue('Width');
    const frameWidth = this.previewDoor.getParameterValue('FrameWidth');
    const totalDoorWidth = doorWidth + 2 * frameWidth;

    if (totalDoorWidth > wallLength) {
      logger.warn(
        'DoorPlacementTool',
        `Door too wide (${totalDoorWidth}mm) for wall (${wallLength}mm)`
      );
      eventBus.emit(Events.APP_ERROR, {
        message: 'Door is too wide for this wall',
      });
      return;
    }

    // Create final door (clone preview configuration)
    let door: ParametricDoor;
    const doorType = this.config.defaultDoorType;

    switch (doorType) {
      case 'standard':
        door = ParametricDoor.createStandardDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'double':
        door = ParametricDoor.createDoubleDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'wide':
        door = ParametricDoor.createWideDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'glass':
        door = ParametricDoor.createGlassDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'sliding':
        door = ParametricDoor.createSlidingDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      case 'accessible':
        door = ParametricDoor.createAccessibleDoor(
          this.parameterEngine,
          this.geometryEngine
        );
        break;

      default:
        door = new ParametricDoor(
          this.parameterEngine,
          this.geometryEngine,
          {
            width: this.config.defaultWidth,
            height: this.config.defaultHeight,
            thickness: this.config.defaultThickness,
            swingDirection: this.config.defaultSwingDirection,
          }
        );
    }

    // Place door in wall
    const success = door.placeInWall(this.selectedWall, this.wallPosition);

    if (!success) {
      logger.error('DoorPlacementTool', 'Failed to place door in wall');
      eventBus.emit(Events.APP_ERROR, {
        message: 'Failed to place door in wall',
      });
      return;
    }

    // Force geometry update to ensure position is baked into geometry
    door.updateGeometry();

    // Add to scene
    const mesh = door.getMesh();
    if (mesh) {
      // Make door blue so it's visible
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color = new THREE.Color(0x0000FF); // Blue

      this.scene.add(mesh);
      logger.debug('DoorPlacementTool', `Added door mesh to scene at position (${mesh.position.x.toFixed(3)}, ${mesh.position.y.toFixed(3)}, ${mesh.position.z.toFixed(3)})`);
    } else {
      logger.error('DoorPlacementTool', 'Door mesh is null - cannot add to scene');
    }

    // Store door
    this.doors.push(door);

    // Create opening in wall if enabled
    if (this.config.createOpening) {
      this.createWallOpening(this.selectedWall, door);
    }

    // Emit event
    eventBus.emit(Events.PARAMETRIC_ELEMENT_CREATED, {
      element: door,
      type: 'door',
      wall: this.selectedWall,
      position: this.wallPosition,
    });

    logger.info(
      'DoorPlacementTool',
      `Placed ${doorType} door in wall ${this.selectedWall.name} at position ${(this.wallPosition * 100).toFixed(1)}%`
    );

    // Reset for next door
    this.clearPreview();
    this.selectedWall = null;
  }

  /**
   * Create an opening in the wall for the door using parametric opening system
   */
  private createWallOpening(wall: ParametricWall, door: ParametricDoor): void {
    try {
      // Get door dimensions (in MILLIMETERS - storage layer)
      const doorWidthMM = door.getParameterValue('Width');
      const doorHeightMM = door.getParameterValue('Height');
      const frameWidthMM = door.getParameterValue('FrameWidth');

      // Calculate rough opening dimensions (door + frame on both sides)
      const roughOpeningWidthMM = doorWidthMM + 2 * frameWidthMM;
      const roughOpeningHeightMM = doorHeightMM;

      // Get door position along wall (already calculated and stored in door parameters)
      const doorPosXMM = door.getParameterValue('PositionX');
      const doorPosYMM = door.getParameterValue('PositionY');
      const doorPosZMM = door.getParameterValue('PositionZ');

      // Calculate position along wall (0-1)
      const wallStart = wall.getStartPoint();
      const wallEnd = wall.getEndPoint();
      const wallVector = new THREE.Vector3().subVectors(wallEnd, wallStart);
      const wallLength = wallVector.length();

      const doorPos = new THREE.Vector3(doorPosXMM, doorPosYMM, doorPosZMM);
      const wallDirection = wallVector.normalize();
      const doorVector = new THREE.Vector3().subVectors(doorPos, wallStart);
      const distanceAlongWall = doorVector.dot(wallDirection);
      const position = Math.max(0, Math.min(1, distanceAlongWall / wallLength));

      logger.debug(
        'DoorPlacementTool',
        `Creating door opening: ${roughOpeningWidthMM}x${roughOpeningHeightMM}mm at position ${(position * 100).toFixed(1)}% in wall ${wall.name}`
      );

      // Add opening to wall's parametric opening system
      wall.addOpening({
        position: position,
        width: roughOpeningWidthMM,
        height: roughOpeningHeightMM,
        sillHeight: 0, // Doors start at floor level
        type: 'door',
        elementId: door.id,
      });

      logger.info(
        'DoorPlacementTool',
        `Registered door opening in wall ${wall.name} - wall will regenerate with opening`
      );
    } catch (error) {
      logger.error('DoorPlacementTool', `Failed to create wall opening: ${error}`);
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
   * Clear preview door
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

    if (this.previewDoor) {
      this.previewDoor.dispose();
      this.previewDoor = null;
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
   * Get all created doors
   */
  getDoors(): ParametricDoor[] {
    return this.doors;
  }

  /**
   * Remove a door
   */
  removeDoor(door: ParametricDoor): void {
    const index = this.doors.indexOf(door);
    if (index > -1) {
      // Remove from scene
      const mesh = door.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }

      // Dispose door
      door.dispose();

      // Remove from array
      this.doors.splice(index, 1);

      // Emit event
      eventBus.emit(Events.PARAMETRIC_ELEMENT_REMOVED, {
        element: door,
        type: 'door',
      });

      logger.info('DoorPlacementTool', `Removed door: ${door.name}`);
    }
  }

  /**
   * Clear all doors
   */
  clearAllDoors(): void {
    this.doors.forEach((door) => {
      const mesh = door.getMesh();
      if (mesh) {
        this.scene.remove(mesh);
      }
      door.dispose();
    });

    this.doors = [];
    logger.info('DoorPlacementTool', 'Cleared all doors');
  }

  /**
   * Set default door type
   */
  setDoorType(doorType: DoorType): void {
    this.config.defaultDoorType = doorType;
    logger.debug('DoorPlacementTool', `Default door type set to: ${doorType}`);
  }

  /**
   * Get default door type
   */
  getDoorType(): DoorType {
    return this.config.defaultDoorType;
  }

  /**
   * Set default door dimensions
   */
  setDoorDimensions(width: number, height: number, thickness?: number): void {
    this.config.defaultWidth = width;
    this.config.defaultHeight = height;
    if (thickness !== undefined) {
      this.config.defaultThickness = thickness;
    }
    logger.debug(
      'DoorPlacementTool',
      `Default door dimensions set to: ${width}x${height}mm, thickness: ${this.config.defaultThickness}mm`
    );
  }

  /**
   * Set default swing direction
   */
  setSwingDirection(direction: 'left' | 'right'): void {
    this.config.defaultSwingDirection = direction;
    logger.debug('DoorPlacementTool', `Default swing direction set to: ${direction}`);
  }

  /**
   * Get default swing direction
   */
  getSwingDirection(): 'left' | 'right' {
    return this.config.defaultSwingDirection;
  }

  /**
   * Set snap to grid
   */
  setSnapToGrid(enabled: boolean): void {
    this.config.snapToGrid = enabled;
    logger.debug('DoorPlacementTool', `Snap to grid: ${enabled}`);
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): void {
    this.config.gridSize = size;
    logger.debug('DoorPlacementTool', `Grid size set to ${size}mm`);
  }

  /**
   * Set preview color
   */
  setPreviewColor(color: THREE.Color): void {
    this.config.previewColor = color;
    logger.debug('DoorPlacementTool', `Preview color set to: ${color.getHexString()}`);
  }

  /**
   * Set preview opacity
   */
  setPreviewOpacity(opacity: number): void {
    this.config.previewOpacity = Math.max(0, Math.min(1, opacity));
    logger.debug('DoorPlacementTool', `Preview opacity set to: ${this.config.previewOpacity}`);
  }

  /**
   * Set whether to create opening in wall
   */
  setCreateOpening(enabled: boolean): void {
    this.config.createOpening = enabled;
    logger.debug('DoorPlacementTool', `Create opening: ${enabled}`);
  }

  /**
   * Export all doors to JSON
   */
  exportDoors(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      doors: this.doors.map((door) => door.toJSON()),
    };
  }

  /**
   * Import doors from JSON
   */
  importDoors(data: any): void {
    if (!data.doors || !Array.isArray(data.doors)) {
      logger.error('DoorPlacementTool', 'Invalid door data');
      return;
    }

    data.doors.forEach((doorData: any) => {
      const door = ParametricDoor.fromJSON(
        doorData,
        this.parameterEngine,
        this.geometryEngine
      );

      const mesh = door.getMesh();
      if (mesh) {
        this.scene.add(mesh);
      }

      this.doors.push(door);
    });

    logger.info('DoorPlacementTool', `Imported ${data.doors.length} doors`);
  }

  /**
   * Dispose the tool
   */
  dispose(): void {
    this.deactivate();
    this.clearAllDoors();
    logger.info('DoorPlacementTool', 'DoorPlacementTool disposed');
  }
}
