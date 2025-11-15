import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';

/**
 * TransformCommands - Mirror, Rotate, and Scale operations
 */
export class TransformCommands {
  /**
   * Mirror entities across a line
   */
  static mirror(entities: Entity[], lineStart: Vector2, lineEnd: Vector2): Entity[] {
    const mirrored: Entity[] = [];

    // Calculate mirror line direction and normal
    const direction = Vector2.fromPoints(lineStart, lineEnd).normalize();
    const normal = new Vector2(-direction.y, direction.x);

    for (const entity of entities) {
      const clone = entity.clone();

      // Create mirror transformation matrix
      const matrix = this.createMirrorMatrix(lineStart, direction, normal);
      clone.transform(matrix);

      mirrored.push(clone);
    }

    return mirrored;
  }

  /**
   * Create a mirror transformation matrix
   */
  private static createMirrorMatrix(
    linePoint: Vector2,
    direction: Vector2,
    normal: Vector2
  ): TransformMatrix {
    // Mirror matrix formula:
    // 1. Translate to origin
    // 2. Apply reflection
    // 3. Translate back

    const dx = direction.x;
    const dy = direction.y;

    return {
      a: dx * dx - dy * dy,
      b: 2 * dx * dy,
      c: 2 * dx * dy,
      d: dy * dy - dx * dx,
      e: 2 * linePoint.x * dy * dy - 2 * linePoint.x * dx * dx - 2 * linePoint.y * dx * dy,
      f: 2 * linePoint.y * dx * dx - 2 * linePoint.y * dy * dy - 2 * linePoint.x * dx * dy,
    };
  }

  /**
   * Rotate entities around a point
   */
  static rotate(entities: Entity[], center: Vector2, angle: number): Entity[] {
    const rotated: Entity[] = [];

    for (const entity of entities) {
      const clone = entity.clone();

      // Create rotation transformation matrix
      const matrix = this.createRotationMatrix(center, angle);
      clone.transform(matrix);

      rotated.push(clone);
    }

    return rotated;
  }

  /**
   * Create a rotation transformation matrix
   */
  private static createRotationMatrix(center: Vector2, angle: number): TransformMatrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      e: center.x - center.x * cos + center.y * sin,
      f: center.y - center.x * sin - center.y * cos,
    };
  }

  /**
   * Scale entities from a base point
   */
  static scale(entities: Entity[], basePoint: Vector2, scale: number): Entity[];
  static scale(entities: Entity[], basePoint: Vector2, scaleX: number, scaleY: number): Entity[];
  static scale(
    entities: Entity[],
    basePoint: Vector2,
    scaleX: number,
    scaleY?: number
  ): Entity[] {
    const sy = scaleY !== undefined ? scaleY : scaleX;
    const scaled: Entity[] = [];

    for (const entity of entities) {
      const clone = entity.clone();

      // Create scale transformation matrix
      const matrix = this.createScaleMatrix(basePoint, scaleX, sy);
      clone.transform(matrix);

      scaled.push(clone);
    }

    return scaled;
  }

  /**
   * Create a scale transformation matrix
   */
  private static createScaleMatrix(
    basePoint: Vector2,
    scaleX: number,
    scaleY: number
  ): TransformMatrix {
    return {
      a: scaleX,
      b: 0,
      c: 0,
      d: scaleY,
      e: basePoint.x * (1 - scaleX),
      f: basePoint.y * (1 - scaleY),
    };
  }

  /**
   * Move entities by an offset
   */
  static move(entities: Entity[], offset: Vector2): Entity[] {
    const moved: Entity[] = [];

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
      moved.push(clone);
    }

    return moved;
  }

  /**
   * Copy entities with offset
   */
  static copy(entities: Entity[], offset: Vector2): Entity[] {
    return this.move(entities, offset);
  }

  /**
   * Align entities to a reference point
   */
  static align(
    entities: Entity[],
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
    referencePoint?: Vector2
  ): Entity[] {
    if (entities.length === 0) return [];

    // Calculate bounding box of all entities
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const entity of entities) {
      const bbox = entity.getBoundingBox();
      minX = Math.min(minX, bbox.min.x);
      maxX = Math.max(maxX, bbox.max.x);
      minY = Math.min(minY, bbox.min.y);
      maxY = Math.max(maxY, bbox.max.y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let targetX = referencePoint?.x ?? 0;
    let targetY = referencePoint?.y ?? 0;

    let offsetX = 0;
    let offsetY = 0;

    switch (alignment) {
      case 'left':
        offsetX = targetX - minX;
        break;
      case 'center':
        offsetX = targetX - centerX;
        break;
      case 'right':
        offsetX = targetX - maxX;
        break;
      case 'top':
        offsetY = targetY - maxY;
        break;
      case 'middle':
        offsetY = targetY - centerY;
        break;
      case 'bottom':
        offsetY = targetY - minY;
        break;
    }

    return this.move(entities, new Vector2(offsetX, offsetY));
  }

  /**
   * Distribute entities evenly along an axis
   */
  static distribute(
    entities: Entity[],
    axis: 'horizontal' | 'vertical',
    spacing?: number
  ): Entity[] {
    if (entities.length < 2) return entities.map((e) => e.clone());

    // Sort entities by position
    const sorted = [...entities].sort((a, b) => {
      const bboxA = a.getBoundingBox();
      const bboxB = b.getBoundingBox();

      if (axis === 'horizontal') {
        return (bboxA.min.x + bboxA.max.x) / 2 - (bboxB.min.x + bboxB.max.x) / 2;
      } else {
        return (bboxA.min.y + bboxA.max.y) / 2 - (bboxB.min.y + bboxB.max.y) / 2;
      }
    });

    const result: Entity[] = [];

    // Keep first entity in place
    result.push(sorted[0].clone());

    if (spacing !== undefined) {
      // Fixed spacing
      let currentPos =
        axis === 'horizontal'
          ? sorted[0].getBoundingBox().max.x
          : sorted[0].getBoundingBox().max.y;

      for (let i = 1; i < sorted.length; i++) {
        const entity = sorted[i];
        const bbox = entity.getBoundingBox();

        const currentCenter =
          axis === 'horizontal'
            ? (bbox.min.x + bbox.max.x) / 2
            : (bbox.min.y + bbox.max.y) / 2;

        const targetPos = currentPos + spacing;
        const offset =
          axis === 'horizontal'
            ? new Vector2(targetPos - currentCenter, 0)
            : new Vector2(0, targetPos - currentCenter);

        const moved = this.move([entity], offset);
        result.push(moved[0]);

        currentPos =
          targetPos +
          (axis === 'horizontal' ? bbox.max.x - bbox.min.x : bbox.max.y - bbox.min.y) / 2;
      }
    } else {
      // Even distribution
      const firstBbox = sorted[0].getBoundingBox();
      const lastBbox = sorted[sorted.length - 1].getBoundingBox();

      const startPos =
        axis === 'horizontal'
          ? (firstBbox.min.x + firstBbox.max.x) / 2
          : (firstBbox.min.y + firstBbox.max.y) / 2;

      const endPos =
        axis === 'horizontal'
          ? (lastBbox.min.x + lastBbox.max.x) / 2
          : (lastBbox.min.y + lastBbox.max.y) / 2;

      const totalDistance = endPos - startPos;
      const step = totalDistance / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const entity = sorted[i];
        const bbox = entity.getBoundingBox();

        const currentCenter =
          axis === 'horizontal'
            ? (bbox.min.x + bbox.max.x) / 2
            : (bbox.min.y + bbox.max.y) / 2;

        const targetPos = startPos + step * i;
        const offset =
          axis === 'horizontal'
            ? new Vector2(targetPos - currentCenter, 0)
            : new Vector2(0, targetPos - currentCenter);

        const moved = this.move([entity], offset);
        result.push(moved[0]);
      }

      // Add last entity
      result.push(sorted[sorted.length - 1].clone());
    }

    return result;
  }
}
