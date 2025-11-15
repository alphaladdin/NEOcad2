/**
 * ParametricColumn - Parametric structural column element for BIM applications
 *
 * Creates configurable column geometry with adjustable parameters:
 * - Column dimensions (width, depth, height)
 * - Base properties (height, width multiplier)
 * - Capital properties (height, width multiplier)
 * - Cross-section types (rectangular, circular, I-beam, H-beam)
 * - Position and rotation
 *
 * Example usage:
 * ```typescript
 * // Create a simple rectangular column
 * const column = new ParametricColumn(parameterEngine, geometryEngine, {
 *   width: 400,
 *   depth: 400,
 *   height: 3000,
 *   crossSectionType: 'rectangular'
 * });
 *
 * // Create a circular column with base and capital
 * const classicalColumn = new ParametricColumn(parameterEngine, geometryEngine, {
 *   width: 500,
 *   height: 4000,
 *   crossSectionType: 'circular',
 *   baseHeight: 200,
 *   baseWidthMultiplier: 1.3,
 *   capitalHeight: 300,
 *   capitalWidthMultiplier: 1.4
 * });
 *
 * // Create an I-beam steel column
 * const steelColumn = ParametricColumn.createIBeamColumn(parameterEngine, geometryEngine);
 * ```
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';
import { ParametricElement } from './ParametricElement';
import { ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { GeometryEngineWrapper } from './GeometryEngineWrapper';

export type CrossSectionType = 'rectangular' | 'circular' | 'I-beam' | 'H-beam';

export interface ParametricColumnOptions {
  width?: number;                    // Column width in mm (default: 400)
  depth?: number;                    // Column depth in mm (default: 400)
  height?: number;                   // Column height in mm (default: 3000)
  baseHeight?: number;               // Base height in mm (default: 0)
  baseWidthMultiplier?: number;      // Base width multiplier (default: 1.0)
  capitalHeight?: number;            // Capital height in mm (default: 0)
  capitalWidthMultiplier?: number;   // Capital width multiplier (default: 1.0)
  crossSectionType?: CrossSectionType; // Cross-section type (default: 'rectangular')
  position?: THREE.Vector3;          // Column position (default: origin)
  rotation?: number;                 // Column rotation in degrees (default: 0)
}

/**
 * Parametric column class that generates column geometry with configurable parameters
 */
export class ParametricColumn extends ParametricElement {
  private geometryEngine: GeometryEngineWrapper;

  constructor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    options: ParametricColumnOptions = {}
  ) {
    super('Column', parameterEngine);

    this.geometryEngine = geometryEngine;

    // Create parameters with default values

    // === Dimension Parameters ===
    this.createParameter(
      'Width',
      options.width ?? 400,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Column width (X dimension)',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Depth',
      options.depth ?? 400,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Column depth (Z dimension)',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Height',
      options.height ?? 3000,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Column height (Y dimension)',
        group: 'Dimensions',
      }
    );

    // === Base Parameters ===
    this.createParameter(
      'BaseHeight',
      options.baseHeight ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Height of column base',
        group: 'Base',
      }
    );

    this.createParameter(
      'BaseWidthMultiplier',
      options.baseWidthMultiplier ?? 1.0,
      ParameterType.NUMBER,
      ParameterUnit.NONE,
      {
        description: 'Base width multiplier (relative to column width)',
        group: 'Base',
      }
    );

    // === Capital Parameters ===
    this.createParameter(
      'CapitalHeight',
      options.capitalHeight ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Height of column capital',
        group: 'Capital',
      }
    );

    this.createParameter(
      'CapitalWidthMultiplier',
      options.capitalWidthMultiplier ?? 1.0,
      ParameterType.NUMBER,
      ParameterUnit.NONE,
      {
        description: 'Capital width multiplier (relative to column width)',
        group: 'Capital',
      }
    );

    // === Cross-Section Type ===
    this.createParameter(
      'CrossSectionType',
      options.crossSectionType ?? 'rectangular',
      ParameterType.STRING,
      ParameterUnit.NONE,
      {
        description: 'Column cross-section type',
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
        description: 'Column position X coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionY',
      options.position?.y ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Column position Y coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'PositionZ',
      options.position?.z ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Column position Z coordinate',
        group: 'Position',
      }
    );

    this.createParameter(
      'Rotation',
      options.rotation ?? 0,
      ParameterType.ANGLE,
      ParameterUnit.DEGREES,
      {
        description: 'Column rotation around Y axis',
        group: 'Position',
      }
    );

    // === Computed Parameters ===

    // Shaft height (total height minus base and capital)
    this.createParameter(
      'ShaftHeight',
      0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        formula: 'Height - BaseHeight - CapitalHeight',
        isReadOnly: true,
        description: 'Height of column shaft (computed)',
        group: 'Computed',
      }
    );

    // Cross-sectional area (simplified formula for rectangular, will be approximation for circular)
    this.createParameter(
      'CrossSectionArea',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: '(Width * Depth) / 1000000',
        isReadOnly: true,
        description: 'Column cross-sectional area (computed)',
        group: 'Computed',
      }
    );

    // Volume
    this.createParameter(
      'Volume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: '(CrossSectionArea * ShaftHeight) / 1000',
        isReadOnly: true,
        description: 'Column volume (computed)',
        group: 'Computed',
      }
    );

    // Base volume
    this.createParameter(
      'BaseVolume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: 'BaseHeight > 0 ? (Width * BaseWidthMultiplier * Depth * BaseWidthMultiplier * BaseHeight) / 1000000000 : 0',
        isReadOnly: true,
        description: 'Base volume (computed)',
        group: 'Computed',
      }
    );

    // Capital volume
    this.createParameter(
      'CapitalVolume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: 'CapitalHeight > 0 ? (Width * CapitalWidthMultiplier * Depth * CapitalWidthMultiplier * CapitalHeight) / 1000000000 : 0',
        isReadOnly: true,
        description: 'Capital volume (computed)',
        group: 'Computed',
      }
    );

    // Total volume
    this.createParameter(
      'TotalVolume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: 'Volume + BaseVolume + CapitalVolume',
        isReadOnly: true,
        description: 'Total volume including base and capital (computed)',
        group: 'Computed',
      }
    );

    // Generate initial geometry
    this.updateGeometry();

    logger.info('ParametricColumn', `Created parametric column: ${this.name}`);
  }

  /**
   * Generate column geometry based on cross-section type
   */
  protected generateGeometry(): THREE.BufferGeometry {
    const crossSectionType = this.getParameterValue('CrossSectionType') as CrossSectionType;

    logger.debug(
      'ParametricColumn',
      `Generating column geometry: type=${crossSectionType}, ${this.getParameterValue('Width')}x${this.getParameterValue('Depth')}x${this.getParameterValue('Height')}mm`
    );

    let geometry: THREE.BufferGeometry;

    switch (crossSectionType) {
      case 'rectangular':
        geometry = this.generateRectangularColumn();
        break;
      case 'circular':
        geometry = this.generateCircularColumn();
        break;
      case 'I-beam':
        geometry = this.generateIBeamColumn();
        break;
      case 'H-beam':
        geometry = this.generateHBeamColumn();
        break;
      default:
        logger.warn('ParametricColumn', `Unknown cross-section type: ${crossSectionType}, using rectangular`);
        geometry = this.generateRectangularColumn();
    }

    // Apply position and rotation
    this.applyTransform(geometry);

    return geometry;
  }

  /**
   * Generate rectangular column geometry
   */
  private generateRectangularColumn(): THREE.BufferGeometry {
    // Get values in MILLIMETERS (storage layer)
    const widthMM = this.getParameterValue('Width');
    const depthMM = this.getParameterValue('Depth');
    const baseHeightMM = this.getParameterValue('BaseHeight');
    const baseWidthMultiplier = this.getParameterValue('BaseWidthMultiplier');
    const capitalHeightMM = this.getParameterValue('CapitalHeight');
    const capitalWidthMultiplier = this.getParameterValue('CapitalWidthMultiplier');
    const shaftHeightMM = this.getParameterValue('ShaftHeight');

    // Convert to METERS for GeometryEngine
    const widthM = Units.mmToMeters(widthMM);
    const depthM = Units.mmToMeters(depthMM);

    const geometries: THREE.BufferGeometry[] = [];
    let currentYMM = 0;

    try {
      // 1. Base (if present)
      if (baseHeightMM > 0) {
        const baseWidthMM = widthMM * baseWidthMultiplier;
        const baseDepthMM = depthMM * baseWidthMultiplier;
        const baseWidthM = Units.mmToMeters(baseWidthMM);
        const baseDepthM = Units.mmToMeters(baseDepthMM);
        const baseHeightM = Units.mmToMeters(baseHeightMM);

        // Create rectangular profile for base
        const baseProfile: number[] = [
          -baseWidthM / 2, -baseDepthM / 2,
          baseWidthM / 2, -baseDepthM / 2,
          baseWidthM / 2, baseDepthM / 2,
          -baseWidthM / 2, baseDepthM / 2,
          -baseWidthM / 2, -baseDepthM / 2,
        ];

        const baseGeometry = new THREE.BufferGeometry();
        this.geometryEngine.getExtrusion(baseGeometry, {
          profile: baseProfile,
          depth: baseHeightM,
          direction: [0, 1, 0], // Extrude upward
          position: [0, Units.mmToMeters(currentYMM + baseHeightMM / 2), 0],
        });
        geometries.push(baseGeometry);
        currentYMM += baseHeightMM;
      }

      // 2. Shaft
      if (shaftHeightMM > 0) {
        const shaftHeightM = Units.mmToMeters(shaftHeightMM);

        const shaftProfile: number[] = [
          -widthM / 2, -depthM / 2,
          widthM / 2, -depthM / 2,
          widthM / 2, depthM / 2,
          -widthM / 2, depthM / 2,
          -widthM / 2, -depthM / 2,
        ];

        const shaftGeometry = new THREE.BufferGeometry();
        this.geometryEngine.getExtrusion(shaftGeometry, {
          profile: shaftProfile,
          depth: shaftHeightM,
          direction: [0, 1, 0], // Extrude upward
          position: [0, Units.mmToMeters(currentYMM + shaftHeightMM / 2), 0],
        });
        geometries.push(shaftGeometry);
        currentYMM += shaftHeightMM;
      }

      // 3. Capital (if present)
      if (capitalHeightMM > 0) {
        const capitalWidthMM = widthMM * capitalWidthMultiplier;
        const capitalDepthMM = depthMM * capitalWidthMultiplier;
        const capitalWidthM = Units.mmToMeters(capitalWidthMM);
        const capitalDepthM = Units.mmToMeters(capitalDepthMM);
        const capitalHeightM = Units.mmToMeters(capitalHeightMM);

        const capitalProfile: number[] = [
          -capitalWidthM / 2, -capitalDepthM / 2,
          capitalWidthM / 2, -capitalDepthM / 2,
          capitalWidthM / 2, capitalDepthM / 2,
          -capitalWidthM / 2, capitalDepthM / 2,
          -capitalWidthM / 2, -capitalDepthM / 2,
        ];

        const capitalGeometry = new THREE.BufferGeometry();
        this.geometryEngine.getExtrusion(capitalGeometry, {
          profile: capitalProfile,
          depth: capitalHeightM,
          direction: [0, 1, 0], // Extrude upward
          position: [0, Units.mmToMeters(currentYMM + capitalHeightMM / 2), 0],
        });
        geometries.push(capitalGeometry);
      }

      logger.debug('ParametricColumn', 'Generated rectangular column using GeometryEngine.getExtrusion()');
    } catch (error) {
      logger.error('ParametricColumn', `Error generating rectangular column with GeometryEngine: ${error}`);
      logger.warn('ParametricColumn', 'Falling back to BoxGeometry');

      // Fallback to BoxGeometry
      geometries.length = 0; // Clear any partial geometries
      let currentYMM = 0;

      if (baseHeightMM > 0) {
        const baseWidthM = Units.mmToMeters(widthMM * baseWidthMultiplier);
        const baseDepthM = Units.mmToMeters(depthMM * baseWidthMultiplier);
        const baseHeightM = Units.mmToMeters(baseHeightMM);
        const baseGeometry = new THREE.BoxGeometry(baseWidthM, baseHeightM, baseDepthM);
        baseGeometry.translate(0, Units.mmToMeters(currentYMM + baseHeightMM / 2), 0);
        geometries.push(baseGeometry);
        currentYMM += baseHeightMM;
      }

      if (shaftHeightMM > 0) {
        const shaftGeometry = new THREE.BoxGeometry(
          Units.mmToMeters(widthMM),
          Units.mmToMeters(shaftHeightMM),
          Units.mmToMeters(depthMM)
        );
        shaftGeometry.translate(0, Units.mmToMeters(currentYMM + shaftHeightMM / 2), 0);
        geometries.push(shaftGeometry);
        currentYMM += shaftHeightMM;
      }

      if (capitalHeightMM > 0) {
        const capitalWidthM = Units.mmToMeters(widthMM * capitalWidthMultiplier);
        const capitalDepthM = Units.mmToMeters(depthMM * capitalWidthMultiplier);
        const capitalHeightM = Units.mmToMeters(capitalHeightMM);
        const capitalGeometry = new THREE.BoxGeometry(capitalWidthM, capitalHeightM, capitalDepthM);
        capitalGeometry.translate(0, Units.mmToMeters(currentYMM + capitalHeightMM / 2), 0);
        geometries.push(capitalGeometry);
      }
    }

    return this.mergeGeometries(geometries);
  }

  /**
   * Generate circular column geometry
   */
  private generateCircularColumn(): THREE.BufferGeometry {
    const width = this.getParameterValue('Width');
    const baseHeight = this.getParameterValue('BaseHeight');
    const baseWidthMultiplier = this.getParameterValue('BaseWidthMultiplier');
    const capitalHeight = this.getParameterValue('CapitalHeight');
    const capitalWidthMultiplier = this.getParameterValue('CapitalWidthMultiplier');

    const geometries: THREE.BufferGeometry[] = [];
    let currentY = 0;
    const segments = 32; // Smooth circular profile

    // 1. Base (if present)
    if (baseHeight > 0) {
      const baseRadius = (width * baseWidthMultiplier) / 2;
      const baseGeometry = new THREE.CylinderGeometry(
        baseRadius,
        baseRadius,
        baseHeight,
        segments
      );
      baseGeometry.translate(0, currentY + baseHeight / 2, 0);
      geometries.push(baseGeometry);
      currentY += baseHeight;
    }

    // 2. Shaft
    const shaftHeight = this.getParameterValue('ShaftHeight');
    if (shaftHeight > 0) {
      const shaftRadius = width / 2;
      const shaftGeometry = new THREE.CylinderGeometry(
        shaftRadius,
        shaftRadius,
        shaftHeight,
        segments
      );
      shaftGeometry.translate(0, currentY + shaftHeight / 2, 0);
      geometries.push(shaftGeometry);
      currentY += shaftHeight;
    }

    // 3. Capital (if present)
    if (capitalHeight > 0) {
      const capitalRadius = (width * capitalWidthMultiplier) / 2;
      const capitalGeometry = new THREE.CylinderGeometry(
        capitalRadius,
        capitalRadius,
        capitalHeight,
        segments
      );
      capitalGeometry.translate(0, currentY + capitalHeight / 2, 0);
      geometries.push(capitalGeometry);
    }

    return this.mergeGeometries(geometries);
  }

  /**
   * Generate I-beam column geometry
   * I-beam has wider flanges at top and bottom, narrow web in middle
   */
  private generateIBeamColumn(): THREE.BufferGeometry {
    const width = this.getParameterValue('Width');
    const depth = this.getParameterValue('Depth');
    const height = this.getParameterValue('Height');

    // I-beam proportions (standard structural steel ratios)
    const flangeWidth = width;
    const flangeThickness = depth * 0.15; // Flange thickness ~15% of depth
    const webThickness = width * 0.1;     // Web thickness ~10% of width
    const webDepth = depth;

    const geometries: THREE.BufferGeometry[] = [];

    // 1. Top flange
    const topFlange = new THREE.BoxGeometry(flangeWidth, height, flangeThickness);
    topFlange.translate(0, height / 2, depth / 2 - flangeThickness / 2);
    geometries.push(topFlange);

    // 2. Web (central vertical section)
    const web = new THREE.BoxGeometry(webThickness, height, webDepth);
    web.translate(0, height / 2, 0);
    geometries.push(web);

    // 3. Bottom flange
    const bottomFlange = new THREE.BoxGeometry(flangeWidth, height, flangeThickness);
    bottomFlange.translate(0, height / 2, -depth / 2 + flangeThickness / 2);
    geometries.push(bottomFlange);

    return this.mergeGeometries(geometries);
  }

  /**
   * Generate H-beam column geometry
   * H-beam has flanges on left and right sides, web connecting them
   */
  private generateHBeamColumn(): THREE.BufferGeometry {
    const width = this.getParameterValue('Width');
    const depth = this.getParameterValue('Depth');
    const height = this.getParameterValue('Height');

    // H-beam proportions
    const flangeThickness = width * 0.15;  // Flange thickness ~15% of width
    const webThickness = depth * 0.1;      // Web thickness ~10% of depth
    const flangeDepth = depth;

    const geometries: THREE.BufferGeometry[] = [];

    // 1. Left flange
    const leftFlange = new THREE.BoxGeometry(flangeThickness, height, flangeDepth);
    leftFlange.translate(-width / 2 + flangeThickness / 2, height / 2, 0);
    geometries.push(leftFlange);

    // 2. Web (central vertical section)
    const web = new THREE.BoxGeometry(width, height, webThickness);
    web.translate(0, height / 2, 0);
    geometries.push(web);

    // 3. Right flange
    const rightFlange = new THREE.BoxGeometry(flangeThickness, height, flangeDepth);
    rightFlange.translate(width / 2 - flangeThickness / 2, height / 2, 0);
    geometries.push(rightFlange);

    return this.mergeGeometries(geometries);
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

      // Clean up individual geometries
      geometry.dispose();
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
   * Get column position
   */
  public getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.getParameterValue('PositionX'),
      this.getParameterValue('PositionY'),
      this.getParameterValue('PositionZ')
    );
  }

  /**
   * Set column position
   */
  public setPosition(position: THREE.Vector3): void {
    this.setParameterValue('PositionX', position.x);
    this.setParameterValue('PositionY', position.y);
    this.setParameterValue('PositionZ', position.z);
  }

  /**
   * Get column cross-section type
   */
  public getCrossSectionType(): CrossSectionType {
    return this.getParameterValue('CrossSectionType') as CrossSectionType;
  }

  /**
   * Set column cross-section type
   */
  public setCrossSectionType(type: CrossSectionType): void {
    this.setParameterValue('CrossSectionType', type);
  }

  /**
   * Get shaft height (height minus base and capital)
   */
  public getShaftHeight(): number {
    return this.getParameterValue('ShaftHeight');
  }

  /**
   * Get cross-sectional area (computed based on cross-section type)
   */
  public getCrossSectionArea(): number {
    const type = this.getCrossSectionType();
    const width = this.getParameterValue('Width');
    const depth = this.getParameterValue('Depth');

    if (type === 'circular') {
      // For circular columns, use width as diameter
      const radius = width / 2;
      return (Math.PI * radius * radius) / 1000000; // Convert mm² to m²
    } else {
      // For rectangular, I-beam, H-beam use width * depth as approximation
      return (width * depth) / 1000000; // Convert mm² to m²
    }
  }

  /**
   * Get total volume including base and capital (computed)
   */
  public getTotalVolume(): number {
    const width = this.getParameterValue('Width');
    const depth = this.getParameterValue('Depth');
    const shaftHeight = this.getShaftHeight();
    const baseHeight = this.getParameterValue('BaseHeight');
    const baseWidthMultiplier = this.getParameterValue('BaseWidthMultiplier');
    const capitalHeight = this.getParameterValue('CapitalHeight');
    const capitalWidthMultiplier = this.getParameterValue('CapitalWidthMultiplier');

    // Shaft volume
    const shaftVolume = (width * depth * shaftHeight) / 1000000000; // Convert mm³ to m³

    // Base volume
    const baseVolume = baseHeight > 0
      ? (width * baseWidthMultiplier * depth * baseWidthMultiplier * baseHeight) / 1000000000
      : 0;

    // Capital volume
    const capitalVolume = capitalHeight > 0
      ? (width * capitalWidthMultiplier * depth * capitalWidthMultiplier * capitalHeight) / 1000000000
      : 0;

    return shaftVolume + baseVolume + capitalVolume;
  }

  /**
   * Clone this column
   */
  public clone(): ParametricColumn {
    const options: ParametricColumnOptions = {
      width: this.getParameterValue('Width'),
      depth: this.getParameterValue('Depth'),
      height: this.getParameterValue('Height'),
      baseHeight: this.getParameterValue('BaseHeight'),
      baseWidthMultiplier: this.getParameterValue('BaseWidthMultiplier'),
      capitalHeight: this.getParameterValue('CapitalHeight'),
      capitalWidthMultiplier: this.getParameterValue('CapitalWidthMultiplier'),
      crossSectionType: this.getCrossSectionType(),
      position: this.getPosition(),
      rotation: this.getParameterValue('Rotation'),
    };

    return new ParametricColumn(this.parameterEngine, this.geometryEngine, options);
  }

  /**
   * Export column to JSON
   */
  public toJSON(): any {
    const baseJSON = super.toJSON();
    return {
      ...baseJSON,
      columnType: 'parametric',
      position: this.getPosition().toArray(),
      crossSectionType: this.getCrossSectionType(),
    };
  }

  // ========================================
  // Static Factory Methods for Column Presets
  // ========================================

  /**
   * Create a standard rectangular column (400x400mm)
   */
  static createStandardColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 400,
      depth: 400,
      height: 3000,
      crossSectionType: 'rectangular',
    });
  }

  /**
   * Create a circular column (500mm diameter)
   */
  static createCircularColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 500,
      depth: 500,
      height: 3000,
      crossSectionType: 'circular',
    });
  }

  /**
   * Create a classical column with base and capital
   */
  static createClassicalColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 600,
      depth: 600,
      height: 4000,
      baseHeight: 300,
      baseWidthMultiplier: 1.3,
      capitalHeight: 400,
      capitalWidthMultiplier: 1.4,
      crossSectionType: 'circular',
    });
  }

  /**
   * Create an I-beam steel column (200x400mm)
   */
  static createIBeamColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 200,
      depth: 400,
      height: 3000,
      crossSectionType: 'I-beam',
    });
  }

  /**
   * Create an H-beam steel column (400x200mm)
   */
  static createHBeamColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 400,
      depth: 200,
      height: 3000,
      crossSectionType: 'H-beam',
    });
  }

  /**
   * Create a heavy-duty column (600x600mm)
   */
  static createHeavyDutyColumn(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 600,
      depth: 600,
      height: 4000,
      crossSectionType: 'rectangular',
    });
  }

  /**
   * Create a pilaster (half-embedded column with base and capital)
   */
  static createPilaster(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    return new ParametricColumn(parameterEngine, geometryEngine, {
      width: 300,
      depth: 150,
      height: 3000,
      baseHeight: 200,
      baseWidthMultiplier: 1.2,
      capitalHeight: 250,
      capitalWidthMultiplier: 1.3,
      crossSectionType: 'rectangular',
    });
  }

  /**
   * Create from JSON
   */
  static fromJSON(
    data: any,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper
  ): ParametricColumn {
    const options: ParametricColumnOptions = {
      width: data.parameters.find((p: any) => p.name === 'Width')?.value,
      depth: data.parameters.find((p: any) => p.name === 'Depth')?.value,
      height: data.parameters.find((p: any) => p.name === 'Height')?.value,
      baseHeight: data.parameters.find((p: any) => p.name === 'BaseHeight')?.value,
      baseWidthMultiplier: data.parameters.find((p: any) => p.name === 'BaseWidthMultiplier')?.value,
      capitalHeight: data.parameters.find((p: any) => p.name === 'CapitalHeight')?.value,
      capitalWidthMultiplier: data.parameters.find((p: any) => p.name === 'CapitalWidthMultiplier')?.value,
      crossSectionType: data.parameters.find((p: any) => p.name === 'CrossSectionType')?.value,
      position: new THREE.Vector3().fromArray(data.position),
      rotation: data.parameters.find((p: any) => p.name === 'Rotation')?.value,
    };

    const column = new ParametricColumn(parameterEngine, geometryEngine, options);
    column.name = data.name;

    return column;
  }
}
