import { Vector2 } from './Vector2';
import { Entity, EntityType } from './entities/Entity';
import { Line } from './entities/Line';
import { Dimension, DimensionType } from './entities/Dimension';
import { Polyline } from './entities/Polyline';

/**
 * Configuration for automatic dimensioning
 */
export interface AutoDimensionConfig {
  /** Enable automatic dimensioning */
  enabled?: boolean;
  /** Offset distance from entity to dimension line */
  offset?: number;
  /** Dimension lines */
  dimensionLines?: boolean;
  /** Dimension polylines/rectangles */
  dimensionPolylines?: boolean;
  /** Dimension circles (diameter/radius) */
  dimensionCircles?: boolean;
  /** Layer for auto-generated dimensions */
  dimensionLayer?: string;
}

/**
 * AutoDimensionManager - Automatically creates dimensions for drawn entities
 */
export class AutoDimensionManager {
  private config: Required<AutoDimensionConfig>;
  private generatedDimensions: Map<Entity, Dimension[]> = new Map();

  constructor(config: AutoDimensionConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      offset: config.offset ?? 0.5, // 0.5 units offset from entity
      dimensionLines: config.dimensionLines ?? true,
      dimensionPolylines: config.dimensionPolylines ?? true,
      dimensionCircles: config.dimensionCircles ?? false,
      dimensionLayer: config.dimensionLayer ?? 'A-ANNO-DIMS',
    };
  }

  /**
   * Enable/disable automatic dimensioning
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if automatic dimensioning is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set dimension offset
   */
  setOffset(offset: number): void {
    this.config.offset = offset;
  }

  /**
   * Generate dimensions for an entity
   */
  generateDimensions(entity: Entity): Dimension[] {
    if (!this.config.enabled) return [];

    const dimensions: Dimension[] = [];

    switch (entity.getType()) {
      case EntityType.LINE:
        if (this.config.dimensionLines) {
          dimensions.push(...this.dimensionLine(entity as Line));
        }
        break;

      case EntityType.POLYLINE:
        if (this.config.dimensionPolylines) {
          dimensions.push(...this.dimensionPolyline(entity as Polyline));
        }
        break;

      // Add more entity types as needed
    }

    if (dimensions.length > 0) {
      this.generatedDimensions.set(entity, dimensions);
    }

    return dimensions;
  }

  /**
   * Create dimension for a line
   */
  private dimensionLine(line: Line): Dimension[] {
    const start = line.getStart();
    const end = line.getEnd();

    // Calculate perpendicular offset for dimension line
    const lineVector = Vector2.fromPoints(start, end);
    const length = lineVector.length();

    if (length < 0.01) return []; // Skip very short lines

    // Normalize and get perpendicular
    const normalized = lineVector.clone().normalize();
    const perpendicular = new Vector2(-normalized.y, normalized.x);

    // Offset dimension line to the left of the line direction
    const offset = perpendicular.clone().multiplyScalar(this.config.offset);

    // Text position at midpoint, offset perpendicular to line
    const midpoint = Vector2.lerp(start, end, 0.5);
    const textPosition = midpoint.clone().add(offset);

    const dimension = new Dimension(
      start,
      end,
      textPosition,
      DimensionType.LINEAR,
      this.config.dimensionLayer
    );

    return [dimension];
  }

  /**
   * Create dimensions for a polyline (dimension each segment)
   */
  private dimensionPolyline(polyline: Polyline): Dimension[] {
    const dimensions: Dimension[] = [];
    const segmentCount = polyline.getSegmentCount();

    // Check if this is a closed rectangle
    const isClosed = this.isClosedPolyline(polyline);
    const isRectangle = isClosed && segmentCount === 4;

    // Calculate centroid for closed shapes to determine "outside"
    let centroid: Vector2 | null = null;
    if (isClosed) {
      centroid = this.calculateCentroid(polyline);
    }

    for (let i = 0; i < segmentCount; i++) {
      const [start, end] = polyline.getSegment(i);

      // Calculate perpendicular offset for dimension line
      const lineVector = Vector2.fromPoints(start, end);
      const length = lineVector.length();

      if (length < 0.01) continue; // Skip very short segments

      // Normalize and get perpendicular (90° counter-clockwise)
      const normalized = lineVector.clone().normalize();
      let perpendicular = new Vector2(-normalized.y, normalized.x);

      // For closed shapes, ensure dimension is placed outside
      if (centroid && isClosed) {
        const midpoint = Vector2.lerp(start, end, 0.5);
        const outwardVector = Vector2.fromPoints(centroid, midpoint); // Points AWAY from centroid
        const dotProduct = perpendicular.dot(outwardVector);

        // If perpendicular points away from centroid (outward), keep it. Otherwise flip it.
        if (dotProduct < 0) {
          perpendicular = perpendicular.clone().multiplyScalar(-1);
        }
      }

      // Offset dimension line perpendicular to the line
      const offset = perpendicular.clone().multiplyScalar(this.config.offset);

      // Text position at midpoint, offset perpendicular to line
      const midpoint = Vector2.lerp(start, end, 0.5);
      const textPosition = midpoint.clone().add(offset);

      const dimension = new Dimension(
        start,
        end,
        textPosition,
        DimensionType.LINEAR,
        this.config.dimensionLayer
      );

      dimensions.push(dimension);
    }

    return dimensions;
  }

  /**
   * Check if a polyline is closed
   */
  private isClosedPolyline(polyline: Polyline): boolean {
    const vertices = polyline.getVertices();
    if (vertices.length < 3) return false;

    // Rectangles have exactly 4 vertices and are always closed
    if (vertices.length === 4) return true;

    const first = vertices[0];
    const last = vertices[vertices.length - 1];

    // Check if first and last points are very close (within 0.01 units)
    return first.distanceTo(last) < 0.01;
  }

  /**
   * Calculate centroid of a polyline
   */
  private calculateCentroid(polyline: Polyline): Vector2 {
    const vertices = polyline.getVertices();
    let sumX = 0;
    let sumY = 0;

    for (const vertex of vertices) {
      sumX += vertex.x;
      sumY += vertex.y;
    }

    return new Vector2(sumX / vertices.length, sumY / vertices.length);
  }

  /**
   * Get dimensions generated for an entity
   */
  getDimensionsForEntity(entity: Entity): Dimension[] {
    return this.generatedDimensions.get(entity) || [];
  }

  /**
   * Remove dimensions for an entity
   */
  removeDimensionsForEntity(entity: Entity): Dimension[] {
    const dimensions = this.generatedDimensions.get(entity) || [];
    this.generatedDimensions.delete(entity);
    return dimensions;
  }

  /**
   * Clear all generated dimensions
   */
  clear(): void {
    this.generatedDimensions.clear();
  }

  /**
   * Get all generated dimensions
   */
  getAllDimensions(): Dimension[] {
    const allDimensions: Dimension[] = [];
    this.generatedDimensions.forEach(dimensions => {
      allDimensions.push(...dimensions);
    });
    return allDimensions;
  }
}
