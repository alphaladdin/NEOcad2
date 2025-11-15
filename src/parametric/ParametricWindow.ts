/**
 * ParametricWindow - Parametric window element for BIM applications
 *
 * Creates configurable window geometry with adjustable parameters:
 * - Window dimensions (width, height, sill height)
 * - Frame properties (thickness)
 * - Window type (fixed, casement, sliding, awning)
 * - Glazing properties (single, double, triple)
 *
 * Example usage:
 * ```typescript
 * const parameterEngine = new ParameterEngine();
 * const geometryEngine = GeometryEngineWrapper.getInstance();
 *
 * // Create a standard window
 * const window = new ParametricWindow(parameterEngine, geometryEngine, {
 *   width: 1200,
 *   height: 1500,
 *   sillHeight: 900,
 * });
 *
 * // Create a casement window
 * const casement = ParametricWindow.createCasementWindow(parameterEngine, geometryEngine);
 *
 * // Place window in wall
 * window.placeInWall(wall, 0.5);
 *
 * // Animate opening (for operable windows)
 * await window.animateOpen();
 * ```
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';
import { ParametricElement } from './ParametricElement';
import { ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { GeometryEngineWrapper } from './GeometryEngineWrapper';
import { ParametricWall } from './ParametricWall';

export type WindowType = 'fixed' | 'casement' | 'sliding' | 'awning';
export type GlazingType = 'single' | 'double' | 'triple';

export interface ParametricWindowOptions {
  width?: number;              // Window width in mm (default: 1200)
  height?: number;             // Window height in mm (default: 1500)
  sillHeight?: number;         // Height from floor to window sill in mm (default: 900)
  frameThickness?: number;     // Frame thickness in mm (default: 60)
  windowType?: WindowType;     // Window type (default: 'fixed')
  glazingType?: GlazingType;   // Glazing type (default: 'double')
  position?: THREE.Vector3;    // Window position (default: origin)
  rotation?: number;           // Window rotation in degrees (default: 0)
  mullionWidth?: number;       // Mullion/divider width in mm (default: 50)
  hasDividers?: boolean;       // Has horizontal/vertical dividers (default: false)
}

/**
 * Parametric window class that generates window geometry with configurable parameters
 */
export class ParametricWindow extends ParametricElement {
  private geometryEngine: GeometryEngineWrapper;
  private currentOpenAmount: number = 0;
  private glassGroup: THREE.Group | null = null;

  constructor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    options: ParametricWindowOptions = {}
  ) {
    super('Window', parameterEngine);

    this.geometryEngine = geometryEngine;

    // Create parameters with default values

    // === Dimension Parameters ===
    this.createParameter(
      'Width',
      options.width ?? 1200,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Window opening width',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Height',
      options.height ?? 1500,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Window opening height',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'SillHeight',
      options.sillHeight ?? 900,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Height from floor to window sill',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'FrameThickness',
      options.frameThickness ?? 60,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Window frame thickness',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'MullionWidth',
      options.mullionWidth ?? 50,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Mullion/divider width',
        group: 'Dimensions',
      }
    );

    // === Window Configuration Parameters ===
    this.createParameter(
      'WindowType',
      options.windowType ?? 'fixed',
      ParameterType.STRING,
      ParameterUnit.NONE,
      {
        description: 'Window type (fixed, casement, sliding, awning)',
        group: 'Configuration',
      }
    );

    this.createParameter(
      'GlazingType',
      options.glazingType ?? 'double',
      ParameterType.STRING,
      ParameterUnit.NONE,
      {
        description: 'Glazing type (single, double, triple)',
        group: 'Configuration',
      }
    );

    this.createParameter(
      'HasDividers',
      options.hasDividers ?? false,
      ParameterType.BOOLEAN,
      ParameterUnit.NONE,
      {
        description: 'Window has horizontal/vertical dividers',
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
        description: 'Window position X coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionY',
      options.position?.y ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Window position Y coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionZ',
      options.position?.z ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Window position Z coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'Rotation',
      options.rotation ?? 0,
      ParameterType.ANGLE,
      ParameterUnit.DEGREES,
      {
        description: 'Window rotation around Y axis',
        group: 'Position',
      }
    );

    // === Computed Parameters ===

    // Glass area
    this.createParameter(
      'GlassArea',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: '((Width - 2 * FrameThickness) * (Height - 2 * FrameThickness)) / 1000000',
        isReadOnly: true,
        description: 'Glazing area',
        group: 'Computed',
      }
    );

    // Total window opening area
    this.createParameter(
      'OpeningArea',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: '(Width * Height) / 1000000',
        isReadOnly: true,
        description: 'Total window opening area',
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
        description: 'Window frame perimeter',
        group: 'Computed',
      }
    );

    // Head height (distance from floor to window top)
    this.createParameter(
      'HeadHeight',
      0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        formula: 'SillHeight + Height',
        isReadOnly: true,
        description: 'Distance from floor to window top',
        group: 'Computed',
      }
    );

    // Glass volume (for thermal calculations)
    this.createParameter(
      'GlassVolume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: '(GlassArea * (GlazingType === "single" ? 4 : GlazingType === "double" ? 8 : 12)) / 1000',
        isReadOnly: true,
        description: 'Glass volume (approximate)',
        group: 'Computed',
      }
    );

    // Generate initial geometry
    this.updateGeometry();

    logger.info('ParametricWindow', `Created parametric window: ${this.name}`);
  }

  /**
   * Generate window geometry
   * Creates frame, glass panes, sill, head, and optional dividers
   */
  protected generateGeometry(): THREE.BufferGeometry {
    const width = this.getParameterValue('Width');
    const height = this.getParameterValue('Height');
    const sillHeight = this.getParameterValue('SillHeight');
    const frameThickness = this.getParameterValue('FrameThickness');
    const windowType = this.getParameterValue('WindowType') as WindowType;
    const hasDividers = this.getParameterValue('HasDividers');

    logger.debug(
      'ParametricWindow',
      `Generating window geometry: ${width}x${height}mm, type=${windowType}, sill=${sillHeight}mm`
    );

    // Create merged geometry
    const geometries: THREE.BufferGeometry[] = [];

    // 1. Create window frame (outer rectangular frame)
    const frameGeometry = this.createFrameGeometry(width, height, frameThickness);
    geometries.push(frameGeometry);

    // 2. Create sill (horizontal element at bottom)
    const sillGeometry = this.createSillGeometry(width, frameThickness);
    geometries.push(sillGeometry);

    // 3. Create head (horizontal element at top)
    const headGeometry = this.createHeadGeometry(width, frameThickness);
    geometries.push(headGeometry);

    // 4. Create glass panes
    const glassPanes = this.createGlassPanesGeometry(width, height, frameThickness);
    geometries.push(...glassPanes);

    // 5. Create dividers if enabled
    if (hasDividers) {
      const dividers = this.createDividersGeometry(width, height, frameThickness);
      geometries.push(...dividers);
    }

    // 6. Create window-type specific elements
    const typeSpecificGeometry = this.createTypeSpecificGeometry(
      width,
      height,
      frameThickness,
      windowType
    );
    geometries.push(...typeSpecificGeometry);

    // Merge all geometries
    const mergedGeometry = this.mergeGeometries(geometries);

    // Position window at sill height
    mergedGeometry.translate(0, sillHeight, 0);

    // Apply position and rotation
    this.applyTransform(mergedGeometry);

    return mergedGeometry;
  }

  /**
   * Create window frame geometry (outer rectangular frame)
   */
  private createFrameGeometry(
    widthMM: number,
    heightMM: number,
    frameThicknessMM: number
  ): THREE.BufferGeometry {
    // CRITICAL: Convert MM to Meters for GeometryEngine
    const widthM = Units.mmToMeters(widthMM);
    const heightM = Units.mmToMeters(heightMM);
    const frameThicknessM = Units.mmToMeters(frameThicknessMM);
    const frameDepthM = Units.mmToMeters(150); // Frame depth into wall

    const geometries: THREE.BufferGeometry[] = [];

    try {
      // Top frame - extrude a rectangular profile
      const topProfile: number[] = [
        -widthM / 2, 0,
        widthM / 2, 0,
        widthM / 2, frameThicknessM,
        -widthM / 2, frameThicknessM,
        -widthM / 2, 0,
      ];

      const topFrame = new THREE.BufferGeometry();
      this.geometryEngine.getExtrusion(topFrame, {
        profile: topProfile,
        depth: frameDepthM,
        direction: [0, 0, 1],
        position: [0, heightM - frameThicknessM / 2, -frameDepthM / 2],
      });
      geometries.push(topFrame);

      // Bottom frame
      const bottomFrame = new THREE.BufferGeometry();
      this.geometryEngine.getExtrusion(bottomFrame, {
        profile: topProfile, // Same profile as top
        depth: frameDepthM,
        direction: [0, 0, 1],
        position: [0, frameThicknessM / 2, -frameDepthM / 2],
      });
      geometries.push(bottomFrame);

      // Left frame
      const leftProfile: number[] = [
        0, 0,
        frameThicknessM, 0,
        frameThicknessM, heightM - 2 * frameThicknessM,
        0, heightM - 2 * frameThicknessM,
        0, 0,
      ];

      const leftFrame = new THREE.BufferGeometry();
      this.geometryEngine.getExtrusion(leftFrame, {
        profile: leftProfile,
        depth: frameDepthM,
        direction: [0, 0, 1],
        position: [-widthM / 2 + frameThicknessM / 2, heightM / 2, -frameDepthM / 2],
      });
      geometries.push(leftFrame);

      // Right frame
      const rightFrame = new THREE.BufferGeometry();
      this.geometryEngine.getExtrusion(rightFrame, {
        profile: leftProfile, // Same profile as left
        depth: frameDepthM,
        direction: [0, 0, 1],
        position: [widthM / 2 - frameThicknessM / 2, heightM / 2, -frameDepthM / 2],
      });
      geometries.push(rightFrame);

      logger.debug('ParametricWindow', 'Generated window frame using GeometryEngine.getExtrusion()');
    } catch (error) {
      logger.error('ParametricWindow', `Error generating window frame with GeometryEngine: ${error}`);
      logger.warn('ParametricWindow', 'Falling back to BoxGeometry for window frame');

      // Fallback to BoxGeometry
      const widthM = Units.mmToMeters(widthMM);
      const heightM = Units.mmToMeters(heightMM);
      const frameThicknessM = Units.mmToMeters(frameThicknessMM);
      const frameDepthM = Units.mmToMeters(150);

      const topFrame = new THREE.BoxGeometry(widthM, frameThicknessM, frameDepthM);
      topFrame.translate(0, heightM - frameThicknessM / 2, 0);
      geometries.push(topFrame);

      const bottomFrame = new THREE.BoxGeometry(widthM, frameThicknessM, frameDepthM);
      bottomFrame.translate(0, frameThicknessM / 2, 0);
      geometries.push(bottomFrame);

      const leftFrame = new THREE.BoxGeometry(frameThicknessM, heightM - 2 * frameThicknessM, frameDepthM);
      leftFrame.translate(-widthM / 2 + frameThicknessM / 2, heightM / 2, 0);
      geometries.push(leftFrame);

      const rightFrame = new THREE.BoxGeometry(frameThicknessM, heightM - 2 * frameThicknessM, frameDepthM);
      rightFrame.translate(widthM / 2 - frameThicknessM / 2, heightM / 2, 0);
      geometries.push(rightFrame);
    }

    return this.mergeGeometries(geometries);
  }

  /**
   * Create window sill geometry
   */
  private createSillGeometry(widthMM: number, frameThicknessMM: number): THREE.BufferGeometry {
    const sillDepthMM = 200; // Sill projects out from wall
    const sillThicknessMM = 40; // Sill thickness

    // Convert to meters
    const widthM = Units.mmToMeters(widthMM);
    const frameThicknessM = Units.mmToMeters(frameThicknessMM);
    const sillDepthM = Units.mmToMeters(sillDepthMM);
    const sillThicknessM = Units.mmToMeters(sillThicknessMM);

    const sillGeometry = new THREE.BoxGeometry(
      widthM + 2 * frameThicknessM,
      sillThicknessM,
      sillDepthM
    );
    sillGeometry.translate(0, -sillThicknessM / 2, 0);

    return sillGeometry;
  }

  /**
   * Create window head geometry (top detail)
   */
  private createHeadGeometry(width: number, frameThickness: number): THREE.BufferGeometry {
    const headDepth = 150;
    const headThickness = 30;

    const headGeometry = new THREE.BoxGeometry(width + 2 * frameThickness, headThickness, headDepth);
    headGeometry.translate(0, this.getParameterValue('Height') + headThickness / 2, 0);

    return headGeometry;
  }

  /**
   * Create glass panes geometry
   */
  private createGlassPanesGeometry(
    width: number,
    height: number,
    frameThickness: number
  ): THREE.BufferGeometry[] {
    const glazingType = this.getParameterValue('GlazingType') as GlazingType;
    const glassWidth = width - 2 * frameThickness;
    const glassHeight = height - 2 * frameThickness;
    const glassThickness = 4; // Single pane thickness

    const geometries: THREE.BufferGeometry[] = [];

    // Calculate number of panes based on glazing type
    const paneCount = glazingType === 'single' ? 1 : glazingType === 'double' ? 2 : 3;
    const airGap = 16; // Gap between panes for insulated glazing

    // Create glass panes
    for (let i = 0; i < paneCount; i++) {
      const glassPane = new THREE.BoxGeometry(glassWidth, glassHeight, glassThickness);

      // Position panes with air gaps
      let zOffset = 0;
      if (paneCount === 1) {
        zOffset = 0;
      } else if (paneCount === 2) {
        zOffset = i === 0 ? -airGap / 2 : airGap / 2;
      } else {
        // Triple glazing
        zOffset = i === 0 ? -airGap : i === 1 ? 0 : airGap;
      }

      glassPane.translate(0, height / 2, zOffset);
      geometries.push(glassPane);
    }

    return geometries;
  }

  /**
   * Create dividers/mullions geometry
   */
  private createDividersGeometry(
    width: number,
    height: number,
    frameThickness: number
  ): THREE.BufferGeometry[] {
    const geometries: THREE.BufferGeometry[] = [];
    const mullionWidth = this.getParameterValue('MullionWidth');
    const mullionDepth = 40;

    const glassWidth = width - 2 * frameThickness;
    const glassHeight = height - 2 * frameThickness;

    // Vertical center divider
    const verticalDivider = new THREE.BoxGeometry(mullionWidth, glassHeight, mullionDepth);
    verticalDivider.translate(0, height / 2, 0);
    geometries.push(verticalDivider);

    // Horizontal center divider
    const horizontalDivider = new THREE.BoxGeometry(glassWidth, mullionWidth, mullionDepth);
    horizontalDivider.translate(0, height / 2, 0);
    geometries.push(horizontalDivider);

    return geometries;
  }

  /**
   * Create window-type specific geometry
   */
  private createTypeSpecificGeometry(
    width: number,
    height: number,
    frameThickness: number,
    windowType: WindowType
  ): THREE.BufferGeometry[] {
    const geometries: THREE.BufferGeometry[] = [];

    switch (windowType) {
      case 'casement':
        // Add hinges for casement windows
        geometries.push(...this.createHingesGeometry(height, 'left'));
        break;

      case 'sliding':
        // Add tracks for sliding windows
        geometries.push(...this.createSlidingTracksGeometry(width, height));
        break;

      case 'awning':
        // Add hinges at top for awning windows
        geometries.push(...this.createAwningHingesGeometry(width));
        break;

      case 'fixed':
      default:
        // No additional elements for fixed windows
        break;
    }

    return geometries;
  }

  /**
   * Create hinges for casement windows
   */
  private createHingesGeometry(height: number, side: 'left' | 'right'): THREE.BufferGeometry[] {
    const hinges: THREE.BufferGeometry[] = [];
    const hingeRadius = 15;
    const hingeHeight = 80;
    const width = this.getParameterValue('Width');

    // Place 3 hinges vertically
    const hingePositions = [
      height * 0.15,
      height * 0.5,
      height * 0.85,
    ];

    const xOffset = side === 'left' ? -width / 2 : width / 2;

    hingePositions.forEach((yPos) => {
      const hinge = new THREE.CylinderGeometry(hingeRadius, hingeRadius, hingeHeight, 16);
      hinge.translate(xOffset, yPos, 0);
      hinges.push(hinge);
    });

    return hinges;
  }

  /**
   * Create tracks for sliding windows
   */
  private createSlidingTracksGeometry(width: number, height: number): THREE.BufferGeometry[] {
    const tracks: THREE.BufferGeometry[] = [];
    const trackWidth = 30;
    const trackDepth = 40;

    // Top track
    const topTrack = new THREE.BoxGeometry(width, trackWidth, trackDepth);
    topTrack.translate(0, height - trackWidth / 2, 0);
    tracks.push(topTrack);

    // Bottom track
    const bottomTrack = new THREE.BoxGeometry(width, trackWidth, trackDepth);
    bottomTrack.translate(0, trackWidth / 2, 0);
    tracks.push(bottomTrack);

    return tracks;
  }

  /**
   * Create hinges for awning windows (at top)
   */
  private createAwningHingesGeometry(width: number): THREE.BufferGeometry[] {
    const hinges: THREE.BufferGeometry[] = [];
    const hingeRadius = 15;
    const hingeLength = 60;
    const height = this.getParameterValue('Height');

    // Place 2 hinges horizontally at top
    const xPositions = [
      -width * 0.25,
      width * 0.25,
    ];

    xPositions.forEach((xPos) => {
      const hinge = new THREE.CylinderGeometry(hingeRadius, hingeRadius, hingeLength, 16);
      hinge.rotateZ(Math.PI / 2);
      hinge.translate(xPos, height - 40, 0);
      hinges.push(hinge);
    });

    return hinges;
  }

  /**
   * Merge multiple geometries into one
   */
  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
    if (uvs.length > 0) {
      mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }

    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    return mergedGeometry;
  }

  /**
   * Apply position and rotation transformation to geometry
   */
  private applyTransform(geometry: THREE.BufferGeometry): void {
    const posX = this.getParameterValue('PositionX');
    const posY = this.getParameterValue('PositionY');
    const posZ = this.getParameterValue('PositionZ');
    const rotation = this.getParameterValue('Rotation');

    const matrix = new THREE.Matrix4();

    // Apply rotation first
    if (rotation !== 0) {
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeRotationY((rotation * Math.PI) / 180);
      matrix.multiply(rotationMatrix);
    }

    // Then apply translation
    const translationMatrix = new THREE.Matrix4();
    translationMatrix.makeTranslation(posX, posY, posZ);
    matrix.multiply(translationMatrix);

    geometry.applyMatrix4(matrix);
  }

  /**
   * Override createMesh to add glass material
   */
  protected createMesh(): void {
    if (!this.geometry) {
      logger.warn('ParametricWindow', `No geometry to create mesh for ${this.name}`);
      return;
    }

    // Create frame material (opaque)
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.4,
    });

    // Create glass material (transparent)
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      metalness: 0.0,
      roughness: 0.1,
      transparent: true,
      opacity: 0.4,
      transmission: 0.9,
      thickness: 0.5,
    });

    this.mesh = new THREE.Mesh(this.geometry, frameMaterial);
    this.mesh.name = this.name;
    this.mesh.userData.parametricElementId = this.id;
    this.mesh.userData.parametricElementType = this.type;

    logger.debug('ParametricWindow', `Created mesh for ${this.name}`);
  }

  /**
   * Set window open amount (0 = closed, 1 = fully open)
   * Only works for operable window types
   */
  public setOpenAmount(amount: number): void {
    const windowType = this.getParameterValue('WindowType') as WindowType;

    if (windowType === 'fixed') {
      logger.warn('ParametricWindow', `Cannot open fixed window: ${this.name}`);
      return;
    }

    amount = Math.max(0, Math.min(1, amount)); // Clamp between 0 and 1

    if (this.currentOpenAmount !== amount) {
      this.currentOpenAmount = amount;
      this.updateGeometry();
      logger.debug(
        'ParametricWindow',
        `Window ${this.name} open amount: ${(amount * 100).toFixed(0)}%`
      );
    }
  }

  /**
   * Get current window open amount
   */
  public getOpenAmount(): number {
    return this.currentOpenAmount;
  }

  /**
   * Animate window opening
   */
  public async animateOpen(duration: number = 1000): Promise<void> {
    const windowType = this.getParameterValue('WindowType') as WindowType;

    if (windowType === 'fixed') {
      logger.warn('ParametricWindow', `Cannot animate fixed window: ${this.name}`);
      return;
    }

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
   * Animate window closing
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
   * Place window in wall at specified position
   * @param wall - The wall to place window in
   * @param position - Position along wall (0-1, where 0 is start, 1 is end)
   */
  public placeInWall(wall: ParametricWall, position: number): boolean {
    position = Math.max(0, Math.min(1, position)); // Clamp between 0 and 1

    const wallLength = wall.getLength();
    const windowWidth = this.getParameterValue('Width');

    // Validate: window must fit within wall
    if (windowWidth > wallLength) {
      logger.warn(
        'ParametricWindow',
        `Window too wide (${windowWidth}mm) for wall (${wallLength}mm)`
      );
      return false;
    }

    // Calculate window position along wall
    const wallStart = wall.getStartPoint();
    const wallEnd = wall.getEndPoint();
    const wallDirection = wall.getDirection();

    // Position window at specified point along wall
    const windowPosition = new THREE.Vector3().lerpVectors(wallStart, wallEnd, position);

    // Set window position (position is at base, not at sill)
    this.setParameterValue('PositionX', windowPosition.x);
    this.setParameterValue('PositionY', 0); // Base at floor level
    this.setParameterValue('PositionZ', windowPosition.z);

    // Calculate window rotation to align with wall
    const wallAngle = Math.atan2(wallDirection.z, wallDirection.x);
    const windowRotation = (wallAngle * 180) / Math.PI;
    this.setParameterValue('Rotation', windowRotation);

    logger.info(
      'ParametricWindow',
      `Placed window ${this.name} in wall ${wall.name} at position ${(position * 100).toFixed(1)}%`
    );

    return true;
  }

  /**
   * Get window position
   */
  public getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.getParameterValue('PositionX'),
      this.getParameterValue('PositionY'),
      this.getParameterValue('PositionZ')
    );
  }

  /**
   * Set window position
   */
  public setPosition(position: THREE.Vector3): void {
    this.setParameterValue('PositionX', position.x);
    this.setParameterValue('PositionY', position.y);
    this.setParameterValue('PositionZ', position.z);
  }

  /**
   * Clone this window
   */
  public clone(): ParametricWindow {
    const options: ParametricWindowOptions = {
      width: this.getParameterValue('Width'),
      height: this.getParameterValue('Height'),
      sillHeight: this.getParameterValue('SillHeight'),
      frameThickness: this.getParameterValue('FrameThickness'),
      windowType: this.getParameterValue('WindowType'),
      glazingType: this.getParameterValue('GlazingType'),
      position: this.getPosition(),
      rotation: this.getParameterValue('Rotation'),
      mullionWidth: this.getParameterValue('MullionWidth'),
      hasDividers: this.getParameterValue('HasDividers'),
    };

    return new ParametricWindow(this.parameterEngine, this.geometryEngine, options);
  }

  /**
   * Export window to JSON
   */
  public toJSON(): any {
    const baseJSON = super.toJSON();
    return {
      ...baseJSON,
      windowType: 'parametric',
      position: this.getPosition().toArray(),
      openAmount: this.currentOpenAmount,
    };
  }

  // ========================================
  // Static Factory Methods for Window Presets
  // ========================================

  /**
   * Create a standard fixed window (1200mm x 1500mm)
   */
  static createStandardWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 1200,
      height: 1500,
      sillHeight: 900,
      windowType: 'fixed',
      glazingType: 'double',
    });
  }

  /**
   * Create a casement window (900mm x 1200mm, operable)
   */
  static createCasementWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 900,
      height: 1200,
      sillHeight: 900,
      windowType: 'casement',
      glazingType: 'double',
    });
  }

  /**
   * Create a sliding window (1800mm x 1500mm, double panel)
   */
  static createSlidingWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 1800,
      height: 1500,
      sillHeight: 900,
      windowType: 'sliding',
      glazingType: 'double',
      hasDividers: true,
    });
  }

  /**
   * Create an awning window (1200mm x 800mm, top-hinged)
   */
  static createAwningWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 1200,
      height: 800,
      sillHeight: 2200, // High window
      windowType: 'awning',
      glazingType: 'double',
    });
  }

  /**
   * Create a picture window (large, fixed)
   */
  static createPictureWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 2400,
      height: 2000,
      sillHeight: 600,
      windowType: 'fixed',
      glazingType: 'triple',
      frameThickness: 80,
    });
  }

  /**
   * Create a bay window element (one section of bay)
   */
  static createBayWindowSection(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 800,
      height: 1500,
      sillHeight: 600,
      windowType: 'fixed',
      glazingType: 'double',
      hasDividers: true,
    });
  }

  /**
   * Create a skylight window (roof window)
   */
  static createSkylightWindow(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    return new ParametricWindow(parameterEngine, geometryEngine, {
      width: 1200,
      height: 1800,
      sillHeight: 0, // On roof, not wall
      windowType: 'fixed',
      glazingType: 'triple',
      frameThickness: 80,
    });
  }

  /**
   * Create from JSON
   */
  static fromJSON(
    data: any,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricWindow {
    const options: ParametricWindowOptions = {
      width: data.parameters.find((p: any) => p.name === 'Width')?.value,
      height: data.parameters.find((p: any) => p.name === 'Height')?.value,
      sillHeight: data.parameters.find((p: any) => p.name === 'SillHeight')?.value,
      frameThickness: data.parameters.find((p: any) => p.name === 'FrameThickness')?.value,
      windowType: data.parameters.find((p: any) => p.name === 'WindowType')?.value,
      glazingType: data.parameters.find((p: any) => p.name === 'GlazingType')?.value,
      position: new THREE.Vector3().fromArray(data.position),
      rotation: data.parameters.find((p: any) => p.name === 'Rotation')?.value,
      mullionWidth: data.parameters.find((p: any) => p.name === 'MullionWidth')?.value,
      hasDividers: data.parameters.find((p: any) => p.name === 'HasDividers')?.value,
    };

    const window = new ParametricWindow(parameterEngine, geometryEngine, options);
    window.name = data.name;

    if (data.openAmount !== undefined) {
      window.setOpenAmount(data.openAmount);
    }

    return window;
  }
}
