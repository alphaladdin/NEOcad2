/**
 * ParametricDoor - Parametric door element for BIM applications
 *
 * Creates configurable door geometry with adjustable parameters:
 * - Door dimensions (width, height, thickness)
 * - Frame properties (width)
 * - Swing properties (angle, direction)
 * - Handle properties (height)
 * - Door type (single/double)
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';
import { ParametricElement } from './ParametricElement';
import { ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { GeometryEngineWrapper } from './GeometryEngineWrapper';
import { ParametricWall } from './ParametricWall';

export interface ParametricDoorOptions {
  width?: number;           // Door width in mm (default: 900)
  height?: number;          // Door height in mm (default: 2100)
  thickness?: number;       // Door leaf thickness in mm (default: 40)
  frameWidth?: number;      // Frame width in mm (default: 100)
  frameDepth?: number;      // Frame depth in mm (default: 150)
  swingAngle?: number;      // Door swing angle in degrees (default: 90)
  swingDirection?: 'left' | 'right';  // Swing direction (default: 'right')
  handleHeight?: number;    // Handle height from floor in mm (default: 1000)
  isDoubleDoor?: boolean;   // Single or double door (default: false)
  position?: THREE.Vector3; // Door position (default: origin)
  rotation?: number;        // Door rotation in degrees (default: 0)
}

/**
 * Parametric door class that generates door geometry with configurable parameters
 */
export class ParametricDoor extends ParametricElement {
  private geometryEngine: GeometryEngineWrapper;
  private currentOpenAmount: number = 0;

  constructor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    options: ParametricDoorOptions = {}
  ) {
    super('Door', parameterEngine);

    this.geometryEngine = geometryEngine;

    // Create parameters with default values

    // === Dimension Parameters ===
    // Standard US door: 30" x 80" = 762mm x 2032mm
    this.createParameter(
      'Width',
      options.width ?? 762,  // 30 inches
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door opening width',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Height',
      options.height ?? 2032,  // 80 inches
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door opening height',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Thickness',
      options.thickness ?? 40,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door leaf thickness',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'FrameWidth',
      options.frameWidth ?? 100,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door frame width',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'FrameDepth',
      options.frameDepth ?? 150,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door frame depth (wall thickness)',
        group: 'Dimensions',
      }
    );

    // === Handle Parameters ===
    this.createParameter(
      'HandleHeight',
      options.handleHeight ?? 1000,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Handle height from floor',
        group: 'Details',
      }
    );

    // === Swing Parameters ===
    this.createParameter(
      'SwingAngle',
      options.swingAngle ?? 90,
      ParameterType.ANGLE,
      ParameterUnit.DEGREES,
      {
        description: 'Maximum door swing angle',
        group: 'Behavior',
      }
    );

    this.createParameter(
      'SwingDirection',
      options.swingDirection ?? 'right',
      ParameterType.STRING,
      ParameterUnit.NONE,
      {
        description: 'Door swing direction (left/right)',
        group: 'Behavior',
      }
    );

    this.createParameter(
      'IsDoubleDoor',
      options.isDoubleDoor ?? false,
      ParameterType.BOOLEAN,
      ParameterUnit.NONE,
      {
        description: 'Single or double door',
        group: 'Configuration',
      }
    );

    // === Position Parameters ===
    this.createParameter(
      'PositionX',
      options.position?.x ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door position X coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionY',
      options.position?.y ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door position Y coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionZ',
      options.position?.z ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Door position Z coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'Rotation',
      options.rotation ?? 0,
      ParameterType.ANGLE,
      ParameterUnit.DEGREES,
      {
        description: 'Door rotation around Y axis',
        group: 'Position',
      }
    );

    // === Computed Parameters ===

    // Door leaf area (for single door: width * height, for double: width/2 * height per leaf)
    this.createParameter(
      'LeafArea',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: 'IsDoubleDoor ? (Width / 2 * Height) / 1000000 : (Width * Height) / 1000000',
        isReadOnly: true,
        description: 'Area of single door leaf',
        group: 'Computed',
      }
    );

    // Door leaf volume
    this.createParameter(
      'LeafVolume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: 'IsDoubleDoor ? (Width / 2 * Height * Thickness) / 1000000000 : (Width * Height * Thickness) / 1000000000',
        isReadOnly: true,
        description: 'Volume of single door leaf',
        group: 'Computed',
      }
    );

    // Total door opening area (frame opening)
    this.createParameter(
      'OpeningArea',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: '(Width * Height) / 1000000',
        isReadOnly: true,
        description: 'Total door opening area',
        group: 'Computed',
      }
    );

    // Frame perimeter
    this.createParameter(
      'FramePerimeter',
      0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        formula: '(Width + Height) * 2',
        isReadOnly: true,
        description: 'Door frame perimeter',
        group: 'Computed',
      }
    );

    // Generate initial geometry
    this.updateGeometry();

    logger.info('ParametricDoor', `Created parametric door: ${this.name}`);
  }

  /**
   * Generate door geometry (robust box implementation)
   * We use a simple BoxGeometry for stability in previews and placement,
   * avoiding extrude kernel artifacts that rendered triangular shapes.
   */
  protected generateGeometry(): THREE.BufferGeometry {
    // Get dimension values in MILLIMETERS (storage layer)
    const widthMM = this.getParameterValue('Width');
    const heightMM = this.getParameterValue('Height');
    const thicknessMM = this.getParameterValue('Thickness');

    // Convert to meters for Three.js
    const widthM = Units.mmToMeters(widthMM);
    const heightM = Units.mmToMeters(heightMM);
    const thicknessM = Units.mmToMeters(thicknessMM);

    logger.debug(
      'ParametricDoor',
      `Generating door box: ${widthMM}x${heightMM}x${thicknessMM}mm -> ${widthM.toFixed(3)}x${heightM.toFixed(3)}x${thicknessM.toFixed(3)}m`
    );

    // Robust rectangular prism as the door leaf
    const geometry = new THREE.BoxGeometry(widthM, heightM, thicknessM);
    // Set origin at ground level (y=0) so PositionY equals sill elevation
    geometry.translate(0, heightM / 2, 0);

    // Apply position and rotation
    this.applyTransform(geometry);
    return geometry;
  }

  /**
   * Override createMesh to use a bright red material for visibility
   */
  protected createMesh(): void {
    if (!this.geometry) {
      logger.warn('ParametricDoor', `No geometry to create mesh for ${this.name}`);
      return;
    }

    // Use bright red material to make door highly visible
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,  // Bright red
      metalness: 0.0,
      roughness: 0.5,
      emissive: 0x330000,  // Slight red glow
      emissiveIntensity: 0.2,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = this.name;
    this.mesh.userData.parametricElementId = this.id;
    this.mesh.userData.parametricElementType = this.type;

    logger.debug('ParametricDoor', `Created RED mesh for ${this.name} (for visibility testing)`);
  }

  /**
   * Create door frame geometry
   */
  private createFrameGeometry(
    width: number,
    height: number,
    frameWidth: number,
    frameDepth: number
  ): THREE.BufferGeometry {
    // Create frame as a box with a rectangular hole
    const outerWidth = width + 2 * frameWidth;

    // For simplicity, create frame as 3 boxes (top, left, right)
    // Note: No bottom frame (floor)
    const geometries: THREE.BufferGeometry[] = [];

    // Top frame
    const topFrame = new THREE.BoxGeometry(outerWidth, frameWidth, frameDepth);
    topFrame.translate(0, height + frameWidth / 2, 0);
    geometries.push(topFrame);

    // Left frame
    const leftFrame = new THREE.BoxGeometry(frameWidth, height, frameDepth);
    leftFrame.translate(-width / 2 - frameWidth / 2, height / 2, 0);
    geometries.push(leftFrame);

    // Right frame
    const rightFrame = new THREE.BoxGeometry(frameWidth, height, frameDepth);
    rightFrame.translate(width / 2 + frameWidth / 2, height / 2, 0);
    geometries.push(rightFrame);

    return this.mergeGeometries(geometries);
  }

  /**
   * Create door leaf geometry
   */
  private createDoorLeafGeometry(
    width: number,
    height: number,
    thickness: number,
    swingDirection: 'left' | 'right'
  ): THREE.BufferGeometry {
    // Create door leaf as a box
    const leafGeometry = new THREE.BoxGeometry(width, height, thickness);

    // Position door leaf based on swing direction
    // Door rotates around its edge (hinge position)
    if (swingDirection === 'left') {
      // Hinge on left side, door swings left
      leafGeometry.translate(width / 2, height / 2, thickness / 2);
    } else {
      // Hinge on right side, door swings right
      leafGeometry.translate(-width / 2, height / 2, thickness / 2);
    }

    // Apply current open amount rotation
    if (this.currentOpenAmount > 0) {
      const swingAngle = this.getParameterValue('SwingAngle');
      const angleInRadians = (swingAngle * this.currentOpenAmount * Math.PI) / 180;
      const rotationMatrix = new THREE.Matrix4();

      if (swingDirection === 'left') {
        rotationMatrix.makeRotationY(-angleInRadians);
      } else {
        rotationMatrix.makeRotationY(angleInRadians);
      }

      leafGeometry.applyMatrix4(rotationMatrix);
    }

    return leafGeometry;
  }

  /**
   * Create door handle geometry
   */
  private createHandleGeometry(
    doorWidth: number,
    handleHeight: number,
    swingDirection: 'left' | 'right'
  ): THREE.BufferGeometry {
    // Create handle as a small cylinder
    const handleRadius = 15; // 15mm radius
    const handleLength = 120; // 120mm length

    const handleGeometry = new THREE.CylinderGeometry(
      handleRadius,
      handleRadius,
      handleLength,
      16
    );

    // Rotate to horizontal
    handleGeometry.rotateZ(Math.PI / 2);

    // Position handle on door
    // Handle is on opposite side from hinge, about 80% across the door width
    const handleOffset = doorWidth * 0.8;
    const thickness = this.getParameterValue('Thickness');

    if (swingDirection === 'left') {
      // Handle on right side of door
      handleGeometry.translate(handleOffset, handleHeight, thickness + handleLength / 2);
    } else {
      // Handle on left side of door
      handleGeometry.translate(-handleOffset, handleHeight, thickness + handleLength / 2);
    }

    return handleGeometry;
  }

  /**
   * Create hinges geometry (visual detail)
   */
  private createHingesGeometry(
    doorHeight: number,
    swingDirection: 'left' | 'right',
    isDoubleDoor: boolean
  ): THREE.BufferGeometry[] {
    const hinges: THREE.BufferGeometry[] = [];
    const hingeRadius = 20; // 20mm radius
    const hingeHeight = 100; // 100mm height

    // Place 3 hinges: top, middle, bottom
    const hingePositions = [
      doorHeight * 0.1,  // Bottom hinge (10% from floor)
      doorHeight * 0.5,  // Middle hinge
      doorHeight * 0.9,  // Top hinge (90% from floor)
    ];

    const width = this.getParameterValue('Width');
    const hingeXOffset = isDoubleDoor ? (swingDirection === 'left' ? width / 2 : -width / 2) : (swingDirection === 'left' ? -width / 2 : width / 2);

    hingePositions.forEach((yPos) => {
      const hinge = new THREE.CylinderGeometry(hingeRadius, hingeRadius, hingeHeight, 16);
      hinge.translate(hingeXOffset, yPos, 0);
      hinges.push(hinge);
    });

    return hinges;
  }

  /**
   * Merge multiple geometries into one
   */
  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    // Use BufferGeometryUtils if available, otherwise use manual merge
    const mergedGeometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    geometries.forEach((geometry) => {
      const posAttr = geometry.getAttribute('position');
      const normAttr = geometry.getAttribute('normal');
      const uvAttr = geometry.getAttribute('uv');

      if (posAttr) {
        positions.push(...Array.from(posAttr.array));
      }
      if (normAttr) {
        normals.push(...Array.from(normAttr.array));
      }
      if (uvAttr) {
        uvs.push(...Array.from(uvAttr.array));
      }
    });

    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    return mergedGeometry;
  }

  /**
   * Apply position and rotation transformation to geometry
   */
  private applyTransform(geometry: THREE.BufferGeometry): void {
    // Get position in millimeters and convert to meters for Three.js
    const posXMM = this.getParameterValue('PositionX');
    const posYMM = this.getParameterValue('PositionY');
    const posZMM = this.getParameterValue('PositionZ');
    const rotation = this.getParameterValue('Rotation');

    const posX = posXMM / 1000;
    const posY = posYMM / 1000;
    const posZ = posZMM / 1000;

    logger.debug('ParametricDoor', `applyTransform: position (${posXMM}, ${posYMM}, ${posZMM})mm -> (${posX.toFixed(3)}, ${posY.toFixed(3)}, ${posZ.toFixed(3)})m, rotation: ${rotation}°`);

    // Create transformation matrix: first rotate around origin, then translate
    const matrix = new THREE.Matrix4();
    matrix.makeRotationY((rotation * Math.PI) / 180);
    matrix.setPosition(posX, posY, posZ);

    geometry.applyMatrix4(matrix);
  }

  /**
   * Set door open amount (0 = closed, 1 = fully open)
   */
  public setOpenAmount(amount: number): void {
    amount = Math.max(0, Math.min(1, amount)); // Clamp between 0 and 1

    if (this.currentOpenAmount !== amount) {
      this.currentOpenAmount = amount;
      this.updateGeometry();
      logger.debug('ParametricDoor', `Door ${this.name} open amount: ${(amount * 100).toFixed(0)}%`);
    }
  }

  /**
   * Get current door open amount
   */
  public getOpenAmount(): number {
    return this.currentOpenAmount;
  }

  /**
   * Animate door opening
   */
  public async animateOpen(duration: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      const startAmount = this.currentOpenAmount;
      const targetAmount = 1;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentAmount = startAmount + (targetAmount - startAmount) * easeProgress;

        this.setOpenAmount(currentAmount);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Animate door closing
   */
  public async animateClose(duration: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      const startAmount = this.currentOpenAmount;
      const targetAmount = 0;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in animation
        const easeProgress = Math.pow(progress, 3);
        const currentAmount = startAmount + (targetAmount - startAmount) * easeProgress;

        this.setOpenAmount(currentAmount);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Place door in wall at specified position
   * @param wall - The wall to place door in
   * @param position - Position along wall (0-1, where 0 is start, 1 is end)
   */
  public placeInWall(wall: ParametricWall, position: number): boolean {
    position = Math.max(0, Math.min(1, position)); // Clamp between 0 and 1

    const wallLength = wall.getLength();
    const doorWidth = this.getParameterValue('Width');
    const frameWidth = this.getParameterValue('FrameWidth');
    const totalDoorWidth = doorWidth + 2 * frameWidth;

    // Validate: door must fit within wall
    if (totalDoorWidth > wallLength) {
      logger.warn(
        'ParametricDoor',
        `Door too wide (${totalDoorWidth}mm) for wall (${wallLength}mm)`
      );
      return false;
    }

    // Calculate door position along wall
    const wallStart = wall.getStartPoint();
    const wallEnd = wall.getEndPoint();
    const wallDirection = wall.getDirection();
    const wallElevation = wall.getParameterValue('Elevation');

    logger.debug('ParametricDoor', `Wall start: (${wallStart.x}, ${wallStart.y}, ${wallStart.z})mm`);
    logger.debug('ParametricDoor', `Wall end: (${wallEnd.x}, ${wallEnd.y}, ${wallEnd.z})mm`);
    logger.debug('ParametricDoor', `Wall direction: (${wallDirection.x}, ${wallDirection.y}, ${wallDirection.z})`);
    logger.debug('ParametricDoor', `Wall elevation: ${wallElevation}mm`);
    logger.debug('ParametricDoor', `Door position along wall: ${(position * 100).toFixed(1)}%`);

    // Position door at specified point along wall using lerp
    logger.debug('ParametricDoor', `Lerp calculation: position parameter=${position}`);
    const doorPosition = new THREE.Vector3()
      .lerpVectors(wallStart, wallEnd, position);

    logger.debug('ParametricDoor', `Calculated door position via lerp: (${doorPosition.x.toFixed(2)}, ${doorPosition.y.toFixed(2)}, ${doorPosition.z.toFixed(2)})mm`);

    // Set door position
    // Note: Door geometry has origin at ground level (Y=0), so we set Y to wall elevation
    this.setParameterValue('PositionX', doorPosition.x);
    this.setParameterValue('PositionY', wallElevation); // Use wall elevation instead of interpolated Y
    this.setParameterValue('PositionZ', doorPosition.z);

    logger.debug('ParametricDoor', `Set door position parameters: X=${doorPosition.x}mm, Y=${wallElevation}mm, Z=${doorPosition.z}mm`);

    // Calculate door rotation to align with wall
    const wallAngle = Math.atan2(wallDirection.z, wallDirection.x);
    const doorRotation = (wallAngle * 180) / Math.PI;
    logger.debug('ParametricDoor', `Wall angle: ${wallAngle}rad = ${doorRotation}°`);
    this.setParameterValue('Rotation', doorRotation);

    // Match door frame depth to wall thickness
    const wallThickness = wall.getParameterValue('Thickness');
    this.setParameterValue('FrameDepth', wallThickness);

    logger.info(
      'ParametricDoor',
      `Placed door ${this.name} in wall ${wall.name} at position ${(position * 100).toFixed(1)}%`
    );

    return true;
  }

  /**
   * Get door position
   */
  public getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.getParameterValue('PositionX'),
      this.getParameterValue('PositionY'),
      this.getParameterValue('PositionZ')
    );
  }

  /**
   * Set door position
   */
  public setPosition(position: THREE.Vector3): void {
    this.setParameterValue('PositionX', position.x);
    this.setParameterValue('PositionY', position.y);
    this.setParameterValue('PositionZ', position.z);
  }

  /**
   * Clone this door
   */
  public clone(): ParametricDoor {
    const options: ParametricDoorOptions = {
      width: this.getParameterValue('Width'),
      height: this.getParameterValue('Height'),
      thickness: this.getParameterValue('Thickness'),
      frameWidth: this.getParameterValue('FrameWidth'),
      frameDepth: this.getParameterValue('FrameDepth'),
      swingAngle: this.getParameterValue('SwingAngle'),
      swingDirection: this.getParameterValue('SwingDirection'),
      handleHeight: this.getParameterValue('HandleHeight'),
      isDoubleDoor: this.getParameterValue('IsDoubleDoor'),
      position: this.getPosition(),
      rotation: this.getParameterValue('Rotation'),
    };

    return new ParametricDoor(this.parameterEngine, this.geometryEngine, options);
  }

  /**
   * Export door to JSON
   */
  public toJSON(): any {
    const baseJSON = super.toJSON();
    return {
      ...baseJSON,
      doorType: 'parametric',
      position: this.getPosition().toArray(),
      openAmount: this.currentOpenAmount,
    };
  }

  // ========================================
  // Static Factory Methods for Door Presets
  // ========================================

  /**
   * Create a standard single door (900mm x 2100mm)
   */
  static createStandardDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 900,
      height: 2100,
      thickness: 40,
      frameWidth: 100,
      swingDirection: 'right',
      isDoubleDoor: false,
    });
  }

  /**
   * Create a double door (1800mm x 2100mm, 900mm per leaf)
   */
  static createDoubleDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 1800,
      height: 2100,
      thickness: 40,
      frameWidth: 100,
      isDoubleDoor: true,
    });
  }

  /**
   * Create a wide single door (1200mm x 2100mm)
   */
  static createWideDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 1200,
      height: 2100,
      thickness: 40,
      frameWidth: 100,
      swingDirection: 'right',
      isDoubleDoor: false,
    });
  }

  /**
   * Create a glass door (thinner, larger opening)
   */
  static createGlassDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 1000,
      height: 2400,
      thickness: 20, // Thinner for glass
      frameWidth: 80,
      swingDirection: 'right',
      isDoubleDoor: false,
    });
  }

  /**
   * Create a sliding door (marked by 0-degree swing angle)
   */
  static createSlidingDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 1800,
      height: 2400,
      thickness: 30,
      frameWidth: 80,
      swingAngle: 0, // No swing for sliding door
      isDoubleDoor: true,
    });
  }

  /**
   * Create an accessible door (wider, compliant with accessibility standards)
   */
  static createAccessibleDoor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    return new ParametricDoor(parameterEngine, geometryEngine, {
      width: 1000, // Minimum 1000mm for wheelchair access
      height: 2100,
      thickness: 40,
      frameWidth: 100,
      swingDirection: 'right',
      handleHeight: 900, // Lower handle for accessibility
      isDoubleDoor: false,
    });
  }

  /**
   * Create from JSON
   */
  static fromJSON(
    data: any,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricDoor {
    const options: ParametricDoorOptions = {
      width: data.parameters.find((p: any) => p.name === 'Width')?.value,
      height: data.parameters.find((p: any) => p.name === 'Height')?.value,
      thickness: data.parameters.find((p: any) => p.name === 'Thickness')?.value,
      frameWidth: data.parameters.find((p: any) => p.name === 'FrameWidth')?.value,
      frameDepth: data.parameters.find((p: any) => p.name === 'FrameDepth')?.value,
      swingAngle: data.parameters.find((p: any) => p.name === 'SwingAngle')?.value,
      swingDirection: data.parameters.find((p: any) => p.name === 'SwingDirection')?.value,
      handleHeight: data.parameters.find((p: any) => p.name === 'HandleHeight')?.value,
      isDoubleDoor: data.parameters.find((p: any) => p.name === 'IsDoubleDoor')?.value,
      position: new THREE.Vector3().fromArray(data.position),
      rotation: data.parameters.find((p: any) => p.name === 'Rotation')?.value,
    };

    const door = new ParametricDoor(parameterEngine, geometryEngine, options);
    door.name = data.name;

    if (data.openAmount !== undefined) {
      door.setOpenAmount(data.openAmount);
    }

    return door;
  }
}
