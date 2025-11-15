import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { IntersectionCalculator } from '../utils/IntersectionCalculator';

/**
 * ExtendCommand - Extend entities to boundary entities
 */
export class ExtendCommand {
  /**
   * Extend an entity to the nearest boundary
   * Returns the extended entity or null if cannot extend
   */
  static extend(
    entityToExtend: Entity,
    clickPoint: Vector2,
    boundaryEntities: Entity[]
  ): Entity | null {
    if (entityToExtend instanceof Line) {
      return this.extendLine(entityToExtend, clickPoint, boundaryEntities);
    }

    // Add support for other entity types in the future
    return null;
  }

  /**
   * Extend a line entity
   */
  private static extendLine(
    line: Line,
    clickPoint: Vector2,
    boundaryEntities: Entity[]
  ): Line | null {
    const start = line.getStart();
    const end = line.getEnd();

    // Determine which end to extend based on click point
    const distToStart = clickPoint.distanceTo(start);
    const distToEnd = clickPoint.distanceTo(end);

    const extendStart = distToStart < distToEnd;

    // Find the closest boundary intersection
    let closestIntersection: Vector2 | null = null;
    let minDistance = Infinity;

    for (const boundary of boundaryEntities) {
      const intersection = IntersectionCalculator.extendLineToEntity(line, boundary);

      if (intersection) {
        // Check if extending from the correct end
        if (extendStart) {
          // Extending from start - intersection should be in opposite direction
          const toIntersection = Vector2.fromPoints(start, intersection);
          const toEnd = Vector2.fromPoints(start, end);

          if (toIntersection.dot(toEnd) < 0) {
            const dist = start.distanceTo(intersection);
            if (dist < minDistance) {
              minDistance = dist;
              closestIntersection = intersection;
            }
          }
        } else {
          // Extending from end - intersection should be beyond end
          const toIntersection = Vector2.fromPoints(start, intersection);
          const toEnd = Vector2.fromPoints(start, end);

          if (toIntersection.length() > toEnd.length() && toIntersection.dot(toEnd) > 0) {
            const dist = end.distanceTo(intersection);
            if (dist < minDistance) {
              minDistance = dist;
              closestIntersection = intersection;
            }
          }
        }
      }
    }

    if (closestIntersection) {
      // Create extended line
      const newStart = extendStart ? closestIntersection : start;
      const newEnd = extendStart ? end : closestIntersection;

      const extendedLine = new Line(newStart, newEnd, line.getLayer());
      extendedLine.setColor(line.getColor());
      extendedLine.setLineWeight(line.getLineWeight());
      extendedLine.setLineType(line.getLineType() as any);

      return extendedLine;
    }

    return null;
  }

  /**
   * Extend multiple entities at once
   */
  static extendMultiple(
    entitiesToExtend: Entity[],
    clickPoints: Map<Entity, Vector2>,
    boundaryEntities: Entity[]
  ): Map<Entity, Entity | null> {
    const results = new Map<Entity, Entity | null>();

    for (const entity of entitiesToExtend) {
      const clickPoint = clickPoints.get(entity);
      if (clickPoint) {
        const extendedEntity = this.extend(entity, clickPoint, boundaryEntities);
        results.set(entity, extendedEntity);
      }
    }

    return results;
  }

  /**
   * Check if an entity can be extended
   */
  static canExtend(entity: Entity): boolean {
    return entity instanceof Line;
    // Add more types as they are supported
  }

  /**
   * Get all valid boundary entities from a list
   */
  static getValidBoundaryEntities(entities: Entity[], excludeEntity?: Entity): Entity[] {
    return entities.filter((e) => {
      if (e === excludeEntity) return false;
      return e instanceof Line || e instanceof Circle;
    });
  }

  /**
   * Extend to a specific length (alternative mode)
   */
  static extendToLength(line: Line, newLength: number, extendStart: boolean): Line | null {
    const start = line.getStart();
    const end = line.getEnd();
    const currentLength = start.distanceTo(end);

    if (newLength <= currentLength) {
      return null; // Cannot extend to shorter length
    }

    const direction = Vector2.fromPoints(start, end).normalize();
    const extensionLength = newLength - currentLength;

    if (extendStart) {
      const newStart = start.clone().sub(direction.clone().multiplyScalar(extensionLength));
      const extendedLine = new Line(newStart, end, line.getLayer());
      extendedLine.setColor(line.getColor());
      extendedLine.setLineWeight(line.getLineWeight());
      extendedLine.setLineType(line.getLineType() as any);
      return extendedLine;
    } else {
      const newEnd = end.clone().add(direction.clone().multiplyScalar(extensionLength));
      const extendedLine = new Line(start, newEnd, line.getLayer());
      extendedLine.setColor(line.getColor());
      extendedLine.setLineWeight(line.getLineWeight());
      extendedLine.setLineType(line.getLineType() as any);
      return extendedLine;
    }
  }
}
