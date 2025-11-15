import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { IntersectionCalculator } from '../utils/IntersectionCalculator';

/**
 * TrimCommand - Trim entities at intersection points
 */
export class TrimCommand {
  /**
   * Trim an entity at a click point using cutting entities
   * Returns the resulting entities after trim (may be 0, 1, or 2 entities)
   */
  static trim(
    entityToTrim: Entity,
    clickPoint: Vector2,
    cuttingEntities: Entity[]
  ): Entity[] {
    if (entityToTrim instanceof Line) {
      return this.trimLine(entityToTrim, clickPoint, cuttingEntities);
    }

    // Add support for other entity types in the future
    return [entityToTrim];
  }

  /**
   * Trim a line entity
   */
  private static trimLine(
    line: Line,
    clickPoint: Vector2,
    cuttingEntities: Entity[]
  ): Entity[] {
    const start = line.getStart();
    const end = line.getEnd();

    // Find all intersections
    const intersections = IntersectionCalculator.findAllIntersections(line, cuttingEntities);

    if (intersections.length === 0) {
      // No intersections - return original line
      return [line];
    }

    // Find which segment the click point is on
    const clickT = this.getParameterOnLine(line, clickPoint);

    // Find the segments created by intersections
    const segments: Array<{ start: number; end: number }> = [];

    // Create segments between intersections
    let prevT = 0;

    for (const intersection of intersections) {
      if (intersection.t > prevT + 1e-6) {
        segments.push({ start: prevT, end: intersection.t });
      }
      prevT = intersection.t;
    }

    // Add final segment
    if (prevT < 1 - 1e-6) {
      segments.push({ start: prevT, end: 1 });
    }

    // Find which segment contains the click point and remove it
    const resultSegments = segments.filter((segment) => {
      return !(clickT >= segment.start && clickT <= segment.end);
    });

    // Create line entities for remaining segments
    const result: Entity[] = [];

    for (const segment of resultSegments) {
      const segmentStart = this.getPointAtParameter(line, segment.start);
      const segmentEnd = this.getPointAtParameter(line, segment.end);

      const newLine = new Line(segmentStart, segmentEnd, line.getLayer());
      newLine.setColor(line.getColor());
      newLine.setLineWeight(line.getLineWeight());
      newLine.setLineType(line.getLineType() as any);

      result.push(newLine);
    }

    return result;
  }

  /**
   * Get parameter t (0-1) for a point on a line
   */
  private static getParameterOnLine(line: Line, point: Vector2): number {
    const start = line.getStart();
    const end = line.getEnd();
    const lineVector = Vector2.fromPoints(start, end);
    const toPoint = Vector2.fromPoints(start, point);

    const lineLength = lineVector.length();
    if (lineLength < 1e-10) {
      return 0;
    }

    const t = toPoint.dot(lineVector) / (lineLength * lineLength);
    return Math.max(0, Math.min(1, t));
  }

  /**
   * Get point at parameter t (0-1) on a line
   */
  private static getPointAtParameter(line: Line, t: number): Vector2 {
    const start = line.getStart();
    const end = line.getEnd();
    return Vector2.lerp(start, end, t);
  }

  /**
   * Trim multiple entities at once
   * Returns a map of original entity to resulting entities
   */
  static trimMultiple(
    entitiesToTrim: Entity[],
    clickPoints: Map<Entity, Vector2>,
    cuttingEntities: Entity[]
  ): Map<Entity, Entity[]> {
    const results = new Map<Entity, Entity[]>();

    for (const entity of entitiesToTrim) {
      const clickPoint = clickPoints.get(entity);
      if (clickPoint) {
        const trimmedEntities = this.trim(entity, clickPoint, cuttingEntities);
        results.set(entity, trimmedEntities);
      }
    }

    return results;
  }

  /**
   * Check if an entity can be trimmed
   */
  static canTrim(entity: Entity): boolean {
    return entity instanceof Line;
    // Add more types as they are supported
  }

  /**
   * Get all valid cutting entities from a list
   */
  static getValidCuttingEntities(entities: Entity[], excludeEntity?: Entity): Entity[] {
    return entities.filter((e) => {
      if (e === excludeEntity) return false;
      return e instanceof Line || e instanceof Circle;
    });
  }
}
