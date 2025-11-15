import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';

/**
 * ArrayCommands - Create rectangular and polar arrays
 */
export class ArrayCommands {
  /**
   * Create rectangular array of entities
   */
  static rectangularArray(
    entities: Entity[],
    rows: number,
    columns: number,
    rowSpacing: number,
    columnSpacing: number,
    rowAngle: number = 0
  ): Entity[] {
    const result: Entity[] = [];

    // Calculate row and column offset vectors
    const columnOffset = new Vector2(columnSpacing, 0);
    const rowOffset = new Vector2(
      rowSpacing * Math.cos(rowAngle),
      rowSpacing * Math.sin(rowAngle)
    );

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        // Skip the original position
        if (row === 0 && col === 0) {
          result.push(...entities.map((e) => e.clone()));
          continue;
        }

        // Calculate total offset
        const offset = columnOffset
          .clone()
          .multiplyScalar(col)
          .add(rowOffset.clone().multiplyScalar(row));

        // Clone and translate entities
        for (const entity of entities) {
          const clone = entity.clone();
          const matrix: TransformMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: offset.x,
            f: offset.y,
          };
          clone.transform(matrix);
          result.push(clone);
        }
      }
    }

    return result;
  }

  /**
   * Create polar array of entities around a center point
   */
  static polarArray(
    entities: Entity[],
    center: Vector2,
    count: number,
    angleToFill: number = 2 * Math.PI,
    rotateItems: boolean = true
  ): Entity[] {
    const result: Entity[] = [];

    // Add original entities
    result.push(...entities.map((e) => e.clone()));

    // Calculate angle increment
    const angleIncrement = angleToFill / count;

    for (let i = 1; i < count; i++) {
      const angle = angleIncrement * i;

      for (const entity of entities) {
        const clone = entity.clone();

        // Create transformation matrix
        if (rotateItems) {
          // Rotate around center
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const matrix: TransformMatrix = {
            a: cos,
            b: sin,
            c: -sin,
            d: cos,
            e: center.x - center.x * cos + center.y * sin,
            f: center.y - center.x * sin - center.y * cos,
          };

          clone.transform(matrix);
        } else {
          // Only translate, don't rotate
          // Calculate center of entity
          const bbox = entity.getBoundingBox();
          const entityCenter = new Vector2(
            (bbox.min.x + bbox.max.x) / 2,
            (bbox.min.y + bbox.max.y) / 2
          );

          // Calculate new position
          const radiusVector = Vector2.fromPoints(center, entityCenter);
          const radius = radiusVector.length();

          const currentAngle = Math.atan2(radiusVector.y, radiusVector.x);
          const newAngle = currentAngle + angle;

          const newPosition = new Vector2(
            center.x + radius * Math.cos(newAngle),
            center.y + radius * Math.sin(newAngle)
          );

          const offset = Vector2.fromPoints(entityCenter, newPosition);

          const matrix: TransformMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: offset.x,
            f: offset.y,
          };

          clone.transform(matrix);
        }

        result.push(clone);
      }
    }

    return result;
  }

  /**
   * Create path array along a series of points
   */
  static pathArray(
    entities: Entity[],
    pathPoints: Vector2[],
    count: number,
    alignToPath: boolean = true
  ): Entity[] {
    if (pathPoints.length < 2 || count < 2) {
      return entities.map((e) => e.clone());
    }

    const result: Entity[] = [];

    // Calculate total path length
    let totalLength = 0;
    const segmentLengths: number[] = [];

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const length = pathPoints[i].distanceTo(pathPoints[i + 1]);
      segmentLengths.push(length);
      totalLength += length;
    }

    // Calculate spacing
    const spacing = totalLength / (count - 1);

    // Place entities along path
    for (let i = 0; i < count; i++) {
      const distance = spacing * i;

      // Find which segment this distance falls on
      let accumulatedLength = 0;
      let segmentIndex = 0;
      let segmentT = 0;

      for (let j = 0; j < segmentLengths.length; j++) {
        if (accumulatedLength + segmentLengths[j] >= distance) {
          segmentIndex = j;
          segmentT = (distance - accumulatedLength) / segmentLengths[j];
          break;
        }
        accumulatedLength += segmentLengths[j];
      }

      // Get position and direction on path
      const p1 = pathPoints[segmentIndex];
      const p2 = pathPoints[segmentIndex + 1];
      const position = Vector2.lerp(p1, p2, segmentT);

      // Calculate rotation angle if aligning to path
      let angle = 0;
      if (alignToPath) {
        const direction = Vector2.fromPoints(p1, p2);
        angle = Math.atan2(direction.y, direction.x);
      }

      // Calculate entity center
      const bbox = entities[0].getBoundingBox();
      const entityCenter = new Vector2(
        (bbox.min.x + bbox.max.x) / 2,
        (bbox.min.y + bbox.max.y) / 2
      );

      // Clone and transform each entity
      for (const entity of entities) {
        const clone = entity.clone();

        if (alignToPath && angle !== 0) {
          // Rotate around entity center, then translate
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const matrix: TransformMatrix = {
            a: cos,
            b: sin,
            c: -sin,
            d: cos,
            e: position.x - entityCenter.x * cos + entityCenter.y * sin,
            f: position.y - entityCenter.x * sin - entityCenter.y * cos,
          };

          clone.transform(matrix);
        } else {
          // Just translate
          const offset = Vector2.fromPoints(entityCenter, position);
          const matrix: TransformMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: offset.x,
            f: offset.y,
          };

          clone.transform(matrix);
        }

        result.push(clone);
      }
    }

    return result;
  }

  /**
   * Create grid array (rectangular with specific grid pattern)
   */
  static gridArray(
    entities: Entity[],
    rows: number,
    columns: number,
    cellWidth: number,
    cellHeight: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): Entity[] {
    return this.rectangularArray(entities, rows, columns, cellHeight + offsetY, cellWidth + offsetX);
  }

  /**
   * Create circular array (polar array with full 360 degrees)
   */
  static circularArray(
    entities: Entity[],
    center: Vector2,
    count: number,
    rotateItems: boolean = true
  ): Entity[] {
    return this.polarArray(entities, center, count, 2 * Math.PI, rotateItems);
  }

  /**
   * Create radial array (like spokes of a wheel)
   */
  static radialArray(entities: Entity[], center: Vector2, count: number): Entity[] {
    return this.polarArray(entities, center, count, 2 * Math.PI, true);
  }
}
