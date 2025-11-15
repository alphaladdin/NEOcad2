/**
 * ParametricWall - Parametric wall element using GeometryEngine
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WallData } from '@thatopen/fragments';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';
import { ParametricElement } from './ParametricElement';
import { ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { GeometryEngineWrapper } from './GeometryEngineWrapper';
import type { WallType } from '@framing/WallType';
import type { AppearanceStyle } from '@framing/AppearanceStyle';
import { framingRulesEngine } from '@framing/FramingRulesEngine';
import type { ValidationResult } from '@framing/FramingRule';
import { eventBus, Events } from '@core/EventBus';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

export interface ParametricWallOptions {
  startPoint?: THREE.Vector3;
  endPoint?: THREE.Vector3;
  height?: number;
  thickness?: number;
  offset?: number;
  elevation?: number;
  wallType?: WallType; // Optional wall type specification
  appearanceStyleId?: string; // Optional appearance style ID
  layerId?: string; // Optional layer ID for organization
}

/**
 * Represents an opening in a wall (door, window, etc.)
 */
export interface WallOpening {
  /** Position along wall (0-1, where 0 is start and 1 is end) */
  position: number;
  /** Opening width in millimeters */
  width: number;
  /** Opening height in millimeters */
  height: number;
  /** Sill height from floor in millimeters (0 for doors) */
  sillHeight: number;
  /** Opening type for reference */
  type: 'door' | 'window';
  /** Reference to the element (door/window) that created this opening */
  elementId?: string;
}

/**
 * Parametric wall class that uses GeometryEngine.getWall()
 */
export class ParametricWall extends ParametricElement {
  // Standard window opening specification (36" x 36", 12" from top)
  private static readonly STANDARD_WINDOW_OPENING = {
    widthInches: 36,
    heightInches: 36,
    fromTopInches: 12,
    widthMM: 914.4,      // 36 * 25.4
    heightMM: 914.4,     // 36 * 25.4
    fromTopMM: 304.8,    // 12 * 25.4
  };

  private geometryEngine: GeometryEngineWrapper;
  private wallType: WallType | null = null;
  private appearanceStyleId: string | null = null;
  private _validationIssues: ValidationResult | null = null;
  private layerId: string | null = null;
  private openings: WallOpening[] = []; // Track door/window openings

  constructor(
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    options: ParametricWallOptions = {}
  ) {
    super('Wall', parameterEngine);

    this.geometryEngine = geometryEngine;
    this.wallType = options.wallType || null;
    this.appearanceStyleId = options.appearanceStyleId || null;
    this.layerId = options.layerId || null;

    // If wallType is provided, use its dimensions (convert from inches to mm)
    // Otherwise use provided options or defaults
    const defaultHeight = options.wallType
      ? options.wallType.defaultHeight * 12 * 25.4 // feet to inches to mm
      : options.height ?? 3000;

    const defaultThickness = options.wallType
      ? options.wallType.actualThickness * 25.4 // inches to mm
      : options.thickness ?? 200;

    // Create parameters with default values
    this.createParameter(
      'StartX',
      options.startPoint?.x ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall start point X coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'StartY',
      options.startPoint?.y ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall start point Y coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'StartZ',
      options.startPoint?.z ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall start point Z coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'EndX',
      options.endPoint?.x ?? 5000,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall end point X coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'EndY',
      options.endPoint?.y ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall end point Y coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'EndZ',
      options.endPoint?.z ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall end point Z coordinate',
        group: 'Geometry',
      }
    );

    this.createParameter(
      'Height',
      defaultHeight,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall height',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Thickness',
      defaultThickness,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall thickness',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Offset',
      options.offset ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Wall centerline offset',
        group: 'Dimensions',
      }
    );

    this.createParameter(
      'Elevation',
      options.elevation ?? 0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        description: 'Base elevation of wall',
        group: 'Dimensions',
      }
    );

    // Computed parameter: Length (read-only, formula-driven)
    this.createParameter(
      'Length',
      0,
      ParameterType.LENGTH,
      ParameterUnit.MM,
      {
        formula: 'sqrt((EndX - StartX)^2 + (EndY - StartY)^2 + (EndZ - StartZ)^2)',
        isReadOnly: true,
        description: 'Wall length (computed)',
        group: 'Computed',
      }
    );

    // Computed parameter: Area (read-only, formula-driven)
    this.createParameter(
      'Area',
      0,
      ParameterType.AREA,
      ParameterUnit.M2,
      {
        formula: '(Length * Height) / 1000000', // Convert mm² to m²
        isReadOnly: true,
        description: 'Wall area (computed)',
        group: 'Computed',
      }
    );

    // Computed parameter: Volume (read-only, formula-driven)
    this.createParameter(
      'Volume',
      0,
      ParameterType.VOLUME,
      ParameterUnit.M3,
      {
        formula: '(Length * Height * Thickness) / 1000000000', // Convert mm³ to m³
        isReadOnly: true,
        description: 'Wall volume (computed)',
        group: 'Computed',
      }
    );

    // Generate initial geometry
    this.updateGeometry();

    logger.info('ParametricWall', `Created parametric wall: ${this.name}`);
  }

  /**
   * Generate wall geometry using GeometryEngine
   */
  protected generateGeometry(): THREE.BufferGeometry {
    if (!this.geometryEngine.isReady()) {
      logger.warn('ParametricWall', 'GeometryEngine not initialized, creating placeholder geometry');
      return new THREE.BoxGeometry(1, 1, 1);
    }

    // Get parameter values (in MM - storage layer)
    const startX = this.getParameterValue('StartX');
    const startY = this.getParameterValue('StartY');
    const startZ = this.getParameterValue('StartZ');
    const endX = this.getParameterValue('EndX');
    const endY = this.getParameterValue('EndY');
    const endZ = this.getParameterValue('EndZ');
    const height = this.getParameterValue('Height');
    const thickness = this.getParameterValue('Thickness');
    const offset = this.getParameterValue('Offset');
    const elevation = this.getParameterValue('Elevation');

    // Convert all coordinates to meters for GeometryEngine
    const startXM = Units.mmToMeters(startX);
    const startYM = Units.mmToMeters(startY);
    const startZM = Units.mmToMeters(startZ);
    const endXM = Units.mmToMeters(endX);
    const endYM = Units.mmToMeters(endY);
    const endZM = Units.mmToMeters(endZ);
    const heightM = Units.mmToMeters(height);
    const thicknessM = Units.mmToMeters(thickness);
    const elevationM = Units.mmToMeters(elevation);

    // Create WallData for GeometryEngine (all in meters)
    const wallData: WallData = {
      start: [startXM, startYM, startZM],
      end: [endXM, endYM, endZM],
      height: heightM,
      thickness: thicknessM,
      elevation: elevationM,
    };

    logger.debug('ParametricWall', `WallData (meters): start=[${startXM.toFixed(3)}, ${startYM.toFixed(3)}, ${startZM.toFixed(3)}], end=[${endXM.toFixed(3)}, ${endYM.toFixed(3)}, ${endZM.toFixed(3)}], height=${heightM.toFixed(3)}, thickness=${thicknessM.toFixed(3)}`);

    // Create geometry and use GeometryEngine to populate it
    let geometry = new THREE.BufferGeometry();

    try {
      this.geometryEngine.getWall(geometry, wallData);
      logger.debug('ParametricWall', 'Generated wall geometry using GeometryEngine.getWall()');

      // Apply openings if any exist
      if (this.openings.length > 0) {
        logger.info('ParametricWall', `====> Applying ${this.openings.length} opening(s) to wall geometry`);
        geometry = this.applyOpeningsToGeometry(geometry, wallData);
        logger.info('ParametricWall', `====> Finished applying openings`);
      }
    } catch (error) {
      logger.error('ParametricWall', `Error generating wall with GeometryEngine: ${error}`);
      // Fallback to simple box only if GeometryEngine fails
      logger.warn('ParametricWall', 'Falling back to BoxGeometry');
      const wallLength = Math.sqrt(
        Math.pow(endX - startX, 2) +
        Math.pow(endY - startY, 2) +
        Math.pow(endZ - startZ, 2)
      );
      const boxGeometry = new THREE.BoxGeometry(
        Units.mmToMeters(wallLength),
        Units.mmToMeters(height),
        Units.mmToMeters(thickness)
      );

      const midX = Units.mmToMeters((startX + endX) / 2);
      const midY = Units.mmToMeters((startY + endY) / 2) + Units.mmToMeters(height) / 2 + Units.mmToMeters(elevation);
      const midZ = Units.mmToMeters((startZ + endZ) / 2);
      const angle = Math.atan2(endZ - startZ, endX - startX);

      boxGeometry.rotateY(angle);
      boxGeometry.translate(midX, midY, midZ);

      return boxGeometry;
    }

    return geometry;
  }

  /**
   * Apply door/window openings to wall geometry
   * Uses GeometryEngine.getBooleanOperation() to subtract opening volumes
   */
  private applyOpeningsToGeometry(wallGeometry: THREE.BufferGeometry, wallData: WallData): THREE.BufferGeometry {
    // Calculate wall direction and length for opening placement
    const wallStart = new THREE.Vector3(wallData.start[0], wallData.start[1], wallData.start[2]);
    const wallEnd = new THREE.Vector3(wallData.end[0], wallData.end[1], wallData.end[2]);
    const wallVector = new THREE.Vector3().subVectors(wallEnd, wallStart);
    const wallLength = wallVector.length();
    const wallDirection = wallVector.normalize();
    // Horizontal projection for stable orientation
    const wallHoriz = new THREE.Vector3(wallDirection.x, 0, wallDirection.z).normalize();
    // Wall outward normal in horizontal plane (perpendicular to direction)
    const wallNormal = new THREE.Vector3(-wallHoriz.z, 0, wallHoriz.x).normalize();
    // Calculate wall angle from horizontal direction
    const wallAngle = Math.atan2(wallHoriz.z, wallHoriz.x);

    logger.debug('ParametricWall', `Wall: length=${wallLength.toFixed(3)}m, angle=${(wallAngle * 180 / Math.PI).toFixed(1)}°`);

    // Start with the base wall geometry
    let currentGeometry = wallGeometry;
    // Compute bounding box once for vertical reference
    currentGeometry.computeBoundingBox();
    const baseY = currentGeometry.boundingBox ? currentGeometry.boundingBox.min.y : wallData.elevation;

    // Apply each opening
    for (let i = 0; i < this.openings.length; i++) {
      const opening = this.openings[i];
      // CRITICAL: Apply epsilon in MM BEFORE converting to meters
      const EPSILON_MM = 2.0;
      const DEPTH_EPSILON_MM = 10.0;

      const openingWidthMM = opening.width + EPSILON_MM;
      const openingHeightMM = opening.height + EPSILON_MM;
      const wallThicknessMM = Units.metersToMM(wallData.thickness);
      const openingDepthMM = wallThicknessMM + DEPTH_EPSILON_MM;

      // Now convert to meters
      const openingWidthM = Units.mmToMeters(openingWidthMM);
      const openingHeightM = Units.mmToMeters(openingHeightMM);
      const sillHeightM = Units.mmToMeters(opening.sillHeight);
      const openingDepthM = Units.mmToMeters(openingDepthMM);

      // Calculate opening position along wall
      const distanceAlongWall = opening.position * wallLength;
      const openingPos = new THREE.Vector3()
        .copy(wallStart)
        .addScaledVector(wallDirection, distanceAlongWall);

      // Opening center Y position based on wall geometry base
      const openingCenterY = baseY + sillHeightM + (openingHeightM / 2);

      logger.debug(
        'ParametricWall',
        `Opening at ${(opening.position * 100).toFixed(1)}%: pos=(${openingPos.x.toFixed(3)}, ${openingCenterY.toFixed(3)}, ${openingPos.z.toFixed(3)}), size=${openingWidthM.toFixed(3)}x${openingHeightM.toFixed(3)}m`
      );

      // Create opening box geometry using standard THREE.js BoxGeometry
      // Keep it INDEXED (three-bvh-csg test shows indexed geometry works)
      const openingGeometry = new THREE.BoxGeometry(
        openingWidthM,
        openingHeightM,
        openingDepthM
      );

      // Build transform matrix for the opening
      const transformMatrix = new THREE.Matrix4();
      const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        wallNormal
      );
      transformMatrix.makeRotationFromQuaternion(rotationQuaternion);
      transformMatrix.setPosition(openingPos.x, openingCenterY, openingPos.z);

      // Bake transform into geometry
      openingGeometry.applyMatrix4(transformMatrix);

      // CRITICAL: Keep UV attribute on opening geometry
      // three-bvh-csg requires both geometries to have matching attributes
      // We will add UV to wall geometry instead during CSG operation
      // DO NOT delete UV: openingGeometry.deleteAttribute('uv');

      // VISUALIZATION: Add RED box to show the opening position
      const openingVisualization = new THREE.Mesh(
        openingGeometry.clone(),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        })
      );
      openingVisualization.name = `Opening_${opening.type}_${i}`;
      if (this.mesh && this.mesh.parent) {
        this.mesh.parent.add(openingVisualization);
        logger.info('ParametricWall', `Added RED visualization box for opening at scene`);
      }

      // Use wall geometry - clone and ensure it's in the right format
      let wallGeometryForCSG = currentGeometry.clone();
      let openingGeometryForCSG = openingGeometry;

      try {
        logger.info('ParametricWall', `Performing CSG SUBTRACTION using three-bvh-csg...`);
        logger.info('ParametricWall', `  Wall geometry BEFORE: ${wallGeometryForCSG.attributes.position.count} vertices, indexed=${wallGeometryForCSG.index !== null}`);
        logger.info('ParametricWall', `  Opening geometry BEFORE: ${openingGeometryForCSG.attributes.position.count} vertices, indexed=${openingGeometryForCSG.index !== null}`);

        // Convert BOTH geometries to non-indexed format for CSG
        // This ensures compatibility and avoids any index-related issues
        if (wallGeometryForCSG.index) {
          logger.info('ParametricWall', `  Converting wall geometry to non-indexed...`);
          const nonIndexed = wallGeometryForCSG.toNonIndexed();
          wallGeometryForCSG.dispose();
          wallGeometryForCSG = nonIndexed;
        }

        if (openingGeometryForCSG.index) {
          logger.info('ParametricWall', `  Converting opening geometry to non-indexed...`);
          openingGeometryForCSG = openingGeometryForCSG.toNonIndexed();
        }

        logger.info('ParametricWall', `  Wall geometry AFTER: ${wallGeometryForCSG.attributes.position.count} vertices, indexed=${wallGeometryForCSG.index !== null}`);
        logger.info('ParametricWall', `  Wall attributes: ${Object.keys(wallGeometryForCSG.attributes).join(', ')}`);
        logger.info('ParametricWall', `  Opening geometry AFTER: ${openingGeometryForCSG.attributes.position.count} vertices, indexed=${openingGeometryForCSG.index !== null}`);
        logger.info('ParametricWall', `  Opening attributes: ${Object.keys(openingGeometryForCSG.attributes).join(', ')}`);

        // Ensure both geometries have groups cleared (can interfere with CSG)
        wallGeometryForCSG.clearGroups();
        openingGeometryForCSG.clearGroups();

        // CRITICAL FIX: Add UV attribute to wall geometry to match opening geometry
        // three-bvh-csg requires both geometries to have the same attributes
        if (!wallGeometryForCSG.attributes.uv && openingGeometryForCSG.attributes.uv) {
          logger.info('ParametricWall', `  Adding dummy UV attribute to wall geometry...`);
          const uvCount = wallGeometryForCSG.attributes.position.count;
          const uvArray = new Float32Array(uvCount * 2);
          // Fill with zeros (dummy UVs)
          for (let j = 0; j < uvCount * 2; j++) {
            uvArray[j] = 0;
          }
          wallGeometryForCSG.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
          logger.info('ParametricWall', `  Added UV attribute with ${uvCount} UVs`);
        }

        const wallBrush = new Brush(wallGeometryForCSG);
        logger.info('ParametricWall', `  Wall brush created`);

        const openingBrush = new Brush(openingGeometryForCSG);
        logger.info('ParametricWall', `  Opening brush created`);

        // Create CSG evaluator and perform subtraction
        const evaluator = new Evaluator();
        logger.info('ParametricWall', `  Evaluator created, performing SUBTRACTION...`);

        const resultBrush = evaluator.evaluate(wallBrush, openingBrush, SUBTRACTION);
        logger.info('ParametricWall', `  Subtraction complete`);

        // Extract result geometry
        const resultGeometry = resultBrush.geometry;

        logger.info('ParametricWall', `CSG Result: ${resultGeometry.attributes.position.count} vertices (was ${wallGeometryForCSG.attributes.position.count})`);

        // Validate result
        if (this.validateBooleanResult(resultGeometry)) {
          // Success - update geometry
          const oldGeometry = currentGeometry;
          currentGeometry = resultGeometry;
          oldGeometry.dispose();

          // Keep bbox up to date for subsequent openings
          currentGeometry.computeBoundingBox();

          logger.info('ParametricWall', `✓ Applied ${opening.type} opening successfully (${resultGeometry.attributes.position.count} vertices)`);
        } else {
          logger.warn('ParametricWall', `✗ Boolean result validation failed - keeping original wall geometry`);
          resultGeometry.dispose();
        }

        // Cleanup brushes
        wallBrush.dispose();
        openingBrush.dispose();
      } catch (error) {
        logger.error('ParametricWall', `✗ CSG operation failed: ${error}`);
        logger.error('ParametricWall', `Stack: ${error.stack}`);
      }

      // Cleanup temporary geometries
      openingGeometry.dispose();
      if (openingGeometryForCSG !== openingGeometry) {
        openingGeometryForCSG.dispose();
      }
      wallGeometryForCSG.dispose();
    }

    return currentGeometry;
  }

  /**
   * Validate boolean operation result geometry
   * @returns true if geometry is valid for rendering, false otherwise
   */
  private validateBooleanResult(geometry: THREE.BufferGeometry): boolean {
    // 1. Check vertex count
    const vertexCount = geometry.attributes.position?.count || 0;
    if (vertexCount === 0) {
      logger.warn('ParametricWall', 'Boolean result has no vertices');
      return false;
    }

    // 2. Check for valid position attribute
    const positions = geometry.attributes.position;
    if (!positions || positions.itemSize !== 3) {
      logger.warn('ParametricWall', 'Boolean result has invalid position attribute');
      return false;
    }

    // 3. Check for NaN or Infinity
    for (let i = 0; i < positions.array.length; i++) {
      if (!Number.isFinite(positions.array[i])) {
        logger.warn('ParametricWall', 'Boolean result contains NaN or Infinity');
        return false;
      }
    }

    // 4. Compute and validate bounding box
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) {
      logger.warn('ParametricWall', 'Boolean result has no bounding box');
      return false;
    }

    // 5. Check bounding box is reasonable (not collapsed or infinite)
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    if (size.x < 0.001 || size.y < 0.001 || size.z < 0.001) {
      logger.warn('ParametricWall', 'Boolean result has collapsed bounding box');
      return false;
    }

    if (size.x > 1000 || size.y > 1000 || size.z > 1000) {
      logger.warn('ParametricWall', 'Boolean result has unreasonable bounding box');
      return false;
    }

    // 6. Recompute normals for rendering
    geometry.computeVertexNormals();

    return true;
  }

  /**
   * Get the start point of the wall
   */
  getStartPoint(): THREE.Vector3 {
    return new THREE.Vector3(
      this.getParameterValue('StartX'),
      this.getParameterValue('StartY'),
      this.getParameterValue('StartZ')
    );
  }

  /**
   * Set the start point of the wall
   */
  setStartPoint(point: THREE.Vector3): void {
    this.setParameterValue('StartX', point.x);
    this.setParameterValue('StartY', point.y);
    this.setParameterValue('StartZ', point.z);
  }

  /**
   * Get the end point of the wall
   */
  getEndPoint(): THREE.Vector3 {
    return new THREE.Vector3(
      this.getParameterValue('EndX'),
      this.getParameterValue('EndY'),
      this.getParameterValue('EndZ')
    );
  }

  /**
   * Set the end point of the wall
   */
  setEndPoint(point: THREE.Vector3): void {
    this.setParameterValue('EndX', point.x);
    this.setParameterValue('EndY', point.y);
    this.setParameterValue('EndZ', point.z);
  }

  /**
   * Get wall direction vector
   */
  getDirection(): THREE.Vector3 {
    const start = this.getStartPoint();
    const end = this.getEndPoint();
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    logger.debug('ParametricWall', `getDirection: start=(${start.x.toFixed(2)}, ${start.y.toFixed(2)}, ${start.z.toFixed(2)}), end=(${end.x.toFixed(2)}, ${end.y.toFixed(2)}, ${end.z.toFixed(2)}), direction=(${direction.x.toFixed(4)}, ${direction.y.toFixed(4)}, ${direction.z.toFixed(4)})`);
    return direction;
  }

  /**
   * Get wall length (computed parameter)
   */
  getLength(): number {
    return this.getParameterValue('Length');
  }

  /**
   * Get wall area (computed parameter)
   */
  getArea(): number {
    return this.getParameterValue('Area');
  }

  /**
   * Get wall volume (computed parameter)
   */
  getVolume(): number {
    return this.getParameterValue('Volume');
  }

  /**
   * Get wall type
   */
  getWallType(): WallType | null {
    return this.wallType;
  }

  /**
   * Set wall type and update parameters
   */
  setWallType(wallType: WallType): void {
    this.wallType = wallType;

    // Update height and thickness parameters based on wall type
    // Convert from imperial (feet/inches) to millimeters
    const heightMM = wallType.defaultHeight * 12 * 25.4; // feet to inches to mm
    const thicknessMM = wallType.actualThickness * 25.4; // inches to mm

    this.setParameterValue('Height', heightMM);
    this.setParameterValue('Thickness', thicknessMM);

    logger.info(
      'ParametricWall',
      `Wall type set to: ${wallType.name}, height: ${heightMM.toFixed(0)}mm, thickness: ${thicknessMM.toFixed(1)}mm`
    );
  }

  /**
   * Get appearance style ID
   */
  getAppearanceStyleId(): string | null {
    return this.appearanceStyleId;
  }

  /**
   * Set appearance style ID
   */
  setAppearanceStyleId(styleId: string): void {
    this.appearanceStyleId = styleId;
    logger.info('ParametricWall', `Appearance style ID set to: ${styleId}`);
  }

  /**
   * Apply appearance style to this wall's mesh
   * @param appearanceStyle - The AppearanceStyle to apply
   */
  applyAppearanceStyle(appearanceStyle: AppearanceStyle): void {
    if (!this.mesh) {
      logger.warn('ParametricWall', 'Cannot apply appearance style: mesh not initialized');
      return;
    }

    appearanceStyle.applyToMesh(this.mesh);
    this.appearanceStyleId = appearanceStyle.id;
    logger.info('ParametricWall', `Applied appearance style: ${appearanceStyle.name}`);
  }

  /**
   * Get layer ID
   */
  getLayer(): string | null {
    return this.layerId;
  }

  /**
   * Set layer ID
   */
  setLayer(layerId: string): void {
    this.layerId = layerId;
    logger.info('ParametricWall', `Layer set to: ${layerId}`);
  }

  /**
   * Clone this wall
   */
  clone(): ParametricWall {
    const options: ParametricWallOptions = {
      startPoint: this.getStartPoint(),
      endPoint: this.getEndPoint(),
      height: this.getParameterValue('Height'),
      thickness: this.getParameterValue('Thickness'),
      offset: this.getParameterValue('Offset'),
      elevation: this.getParameterValue('Elevation'),
      wallType: this.wallType || undefined,
      appearanceStyleId: this.appearanceStyleId || undefined,
      layerId: this.layerId || undefined,
    };

    return new ParametricWall(this.parameterEngine, this.geometryEngine, options);
  }

  /**
   * Export wall to JSON
   */
  toJSON(): any {
    const baseJSON = super.toJSON();
    return {
      ...baseJSON,
      wallType: 'parametric',
      startPoint: this.getStartPoint().toArray(),
      endPoint: this.getEndPoint().toArray(),
      wallTypeId: this.wallType?.id || null,
      appearanceStyleId: this.appearanceStyleId || null,
      layerId: this.layerId || null,
      validationStatus: this.getValidationStatus(),
      validationIssues: this._validationIssues
        ? {
            isValid: this._validationIssues.isValid,
            issueCount: this._validationIssues.issues.length,
            errorCount: this._validationIssues.issues.filter(i => i.severity === 'ERROR')
              .length,
            warningCount: this._validationIssues.issues.filter(i => i.severity === 'WARNING')
              .length,
          }
        : null,
    };
  }

  /**
   * Create wall from JSON
   */
  static fromJSON(
    data: any,
    parameterEngine: ParameterEngine,
    geometryEngine: GeometryEngineWrapper,
    wallTypeManager?: any // Optional WallTypeManager to lookup wall types
  ): ParametricWall {
    // Lookup wall type if provided
    let wallType = null;
    if (data.wallTypeId && wallTypeManager) {
      wallType = wallTypeManager.getWallType(data.wallTypeId);
    }

    const options: ParametricWallOptions = {
      startPoint: new THREE.Vector3().fromArray(data.startPoint),
      endPoint: new THREE.Vector3().fromArray(data.endPoint),
      height: data.parameters.find((p: any) => p.name === 'Height')?.value,
      thickness: data.parameters.find((p: any) => p.name === 'Thickness')?.value,
      offset: data.parameters.find((p: any) => p.name === 'Offset')?.value,
      elevation: data.parameters.find((p: any) => p.name === 'Elevation')?.value,
      wallType: wallType || undefined,
      appearanceStyleId: data.appearanceStyleId || undefined,
      layerId: data.layerId || undefined,
    };

    const wall = new ParametricWall(parameterEngine, geometryEngine, options);
    wall.name = data.name;

    return wall;
  }

  /**
   * Validate this wall using the FramingRulesEngine
   */
  validate(): ValidationResult {
    const result = framingRulesEngine.validateWall(this);
    this._validationIssues = result;

    // Emit events based on validation result
    if (!result.isValid && result.issues.length > 0) {
      eventBus.emit(Events.FRAMING_RULE_VIOLATED, {
        wallId: this.id,
        issues: result.issues,
        timestamp: result.timestamp,
      });
    } else if (result.isValid && this._validationIssues && !this._validationIssues.isValid) {
      // Previous issues have been resolved
      eventBus.emit(Events.FRAMING_RULE_RESOLVED, {
        wallId: this.id,
        timestamp: result.timestamp,
      });
    }

    logger.debug(
      'ParametricWall',
      `Validation ${result.isValid ? 'passed' : 'failed'} for wall ${this.id}: ${result.issues.length} issues found`
    );

    return result;
  }

  /**
   * Get current validation issues
   */
  get validationIssues(): ValidationResult | null {
    return this._validationIssues;
  }

  /**
   * Check if wall has validation errors
   */
  hasValidationErrors(): boolean {
    return this._validationIssues !== null && !this._validationIssues.isValid;
  }

  /**
   * Get validation status for display
   */
  getValidationStatus(): 'valid' | 'warning' | 'error' | 'not-validated' {
    if (!this._validationIssues) {
      return 'not-validated';
    }

    if (this._validationIssues.isValid) {
      return 'valid';
    }

    const hasErrors = this._validationIssues.issues.some(
      issue => issue.severity === 'ERROR'
    );

    return hasErrors ? 'error' : 'warning';
  }

  /**
   * Clear validation issues
   */
  clearValidationIssues(): void {
    this._validationIssues = null;
  }

  /**
   * Add an opening (door/window) to the wall
   * @param opening - The opening specification
   * @returns The opening that was added
   */
  /**
   * Add a standard window opening (36" x 36", 12" from top of wall)
   * This is a bulletproof, fixed-size window opening designed for reliability
   * @param position - Position along wall (0-1, where 0 is start and 1 is end)
   * @param elementId - Optional ID of window element that created this opening
   * @returns The created WallOpening
   */
  addStandardWindowOpening(position: number, elementId?: string): WallOpening {
    const wallHeightMM = this.getParameterValue('Height');

    // Calculate sill height: wallHeight - fromTop - windowHeight
    const sillHeightMM = wallHeightMM
      - ParametricWall.STANDARD_WINDOW_OPENING.fromTopMM
      - ParametricWall.STANDARD_WINDOW_OPENING.heightMM;

    if (sillHeightMM < 0) {
      logger.warn(
        'ParametricWall',
        `Wall height (${wallHeightMM}mm) is too short for standard window opening. ` +
        `Minimum height required: ${ParametricWall.STANDARD_WINDOW_OPENING.fromTopMM + ParametricWall.STANDARD_WINDOW_OPENING.heightMM}mm`
      );
    }

    const opening: WallOpening = {
      position: Math.max(0, Math.min(1, position)),
      width: ParametricWall.STANDARD_WINDOW_OPENING.widthMM,
      height: ParametricWall.STANDARD_WINDOW_OPENING.heightMM,
      sillHeight: Math.max(0, sillHeightMM),
      type: 'window',
      elementId: elementId,
    };

    logger.info(
      'ParametricWall',
      `Adding standard window opening (36"x36", 12" from top) at ${(position * 100).toFixed(1)}%`
    );

    return this.addOpening(opening);
  }

  addOpening(opening: WallOpening): WallOpening {
    logger.info('ParametricWall', `====> addOpening() called for ${opening.type} at position ${opening.position}`);

    // Validate position is in valid range
    if (opening.position < 0 || opening.position > 1) {
      logger.warn('ParametricWall', `Opening position ${opening.position} is outside valid range [0, 1]`);
      opening.position = Math.max(0, Math.min(1, opening.position));
    }

    this.openings.push(opening);
    logger.info('ParametricWall', `====> Opening pushed to array. Array length: ${this.openings.length}`);
    logger.info('ParametricWall', `Added ${opening.type} opening at position ${(opening.position * 100).toFixed(1)}% (${opening.width}x${opening.height}mm)`);

    // Trigger geometry regeneration
    logger.info('ParametricWall', `====> Calling updateGeometry() from addOpening()`);
    this.updateGeometry();
    logger.info('ParametricWall', `====> updateGeometry() returned from addOpening()`);

    return opening;
  }

  /**
   * Remove an opening from the wall
   * @param opening - The opening to remove (or elementId to find it)
   */
  removeOpening(openingOrId: WallOpening | string): boolean {
    const index = typeof openingOrId === 'string'
      ? this.openings.findIndex(o => o.elementId === openingOrId)
      : this.openings.indexOf(openingOrId);

    if (index === -1) {
      logger.warn('ParametricWall', 'Opening not found for removal');
      return false;
    }

    const removed = this.openings.splice(index, 1)[0];
    logger.info('ParametricWall', `Removed ${removed.type} opening at position ${(removed.position * 100).toFixed(1)}%`);

    // Trigger geometry regeneration
    this.updateGeometry();

    return true;
  }

  /**
   * Get all openings in the wall
   */
  getOpenings(): readonly WallOpening[] {
    return this.openings;
  }

  /**
   * Clear all openings from the wall
   */
  clearOpenings(): void {
    const count = this.openings.length;
    this.openings = [];
    logger.info('ParametricWall', `Cleared ${count} openings`);

    // Trigger geometry regeneration
    this.updateGeometry();
  }
}
