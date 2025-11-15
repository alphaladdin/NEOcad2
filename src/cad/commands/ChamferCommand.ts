import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';

/**
 * Chamfer result containing the modified entities and chamfer line
 */
export interface ChamferResult {
  entity1: Line | null; // Trimmed first entity
  entity2: Line | null; // Trimmed second entity
  chamfer: Line; // Chamfer line
}

/**
 * ChamferCommand - Create beveled corners between two lines
 */
export class ChamferCommand {
  /**
   * Create a chamfer between two lines with equal distances
   */
  static chamfer(line1: Line, line2: Line, distance: number): ChamferResult | null {
    return this.chamferWithDistances(line1, line2, distance, distance);
  }

  /**
   * Create a chamfer between two lines with different distances
   */
  static chamferWithDistances(
    line1: Line,
    line2: Line,
    distance1: number,
    distance2: number
  ): ChamferResult | null {
    if (distance1 <= 0 || distance2 <= 0) {
      return null;
    }

    // Get line parameters
    const p1 = line1.getStart();
    const p2 = line1.getEnd();
    const p3 = line2.getStart();
    const p4 = line2.getEnd();

    // Find intersection point of infinite lines
    const intersection = this.findIntersection(p1, p2, p3, p4);

    if (!intersection) {
      return null; // Lines are parallel
    }

    // Calculate direction vectors (pointing toward intersection)
    const dir1 = Vector2.fromPoints(p1, p2).normalize();
    const dir2 = Vector2.fromPoints(p3, p4).normalize();

    // Calculate chamfer points
    const chamferPoint1 = intersection.clone().add(dir1.clone().multiplyScalar(-distance1));
    const chamferPoint2 = intersection.clone().add(dir2.clone().multiplyScalar(-distance2));

    // Create chamfer line
    const chamferLine = new Line(chamferPoint1, chamferPoint2, line1.getLayer());
    chamferLine.setColor(line1.getColor());
    chamferLine.setLineWeight(line1.getLineWeight());
    chamferLine.setLineType(line1.getLineType() as any);

    // Trim the lines to chamfer points
    const trimmedLine1 = this.trimLineToPoint(line1, chamferPoint1);
    const trimmedLine2 = this.trimLineToPoint(line2, chamferPoint2);

    return {
      entity1: trimmedLine1,
      entity2: trimmedLine2,
      chamfer: chamferLine,
    };
  }

  /**
   * Create a chamfer with angle and distance
   */
  static chamferWithAngle(
    line1: Line,
    line2: Line,
    distance: number,
    angle: number
  ): ChamferResult | null {
    if (distance <= 0) {
      return null;
    }

    // Calculate second distance based on angle
    const distance2 = distance * Math.tan((angle * Math.PI) / 180);

    return this.chamferWithDistances(line1, line2, distance, distance2);
  }

  /**
   * Find intersection of two infinite lines
   */
  private static findIntersection(
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    p4: Vector2
  ): Vector2 | null {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

    if (Math.abs(denom) < 1e-10) {
      return null; // Lines are parallel
    }

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;

    return new Vector2(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
  }

  /**
   * Trim a line to a point (keeping the portion closest to the original start)
   */
  private static trimLineToPoint(line: Line, point: Vector2): Line | null {
    const start = line.getStart();
    const end = line.getEnd();

    // Check if point is on the line segment
    const lineDir = Vector2.fromPoints(start, end);
    const toPoint = Vector2.fromPoints(start, point);
    const t = toPoint.dot(lineDir) / lineDir.dot(lineDir);

    if (t < 0 || t > 1) {
      return line.clone(); // Point is outside line segment
    }

    // Create trimmed line
    const newLine = new Line(start, point, line.getLayer());
    newLine.setColor(line.getColor());
    newLine.setLineWeight(line.getLineWeight());
    newLine.setLineType(line.getLineType() as any);

    return newLine;
  }

  /**
   * Check if two entities can be chamfered
   */
  static canChamfer(entity1: Entity, entity2: Entity): boolean {
    return entity1 instanceof Line && entity2 instanceof Line;
  }

  /**
   * Create polyline chamfer (chamfer all corners of a polyline)
   */
  static chamferPolyline(vertices: Vector2[], distance: number, closed: boolean): Vector2[] {
    const result: Vector2[] = [];

    const count = closed ? vertices.length : vertices.length - 1;

    for (let i = 0; i < count; i++) {
      const prev = vertices[(i - 1 + vertices.length) % vertices.length];
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      if (i === 0 && !closed) {
        // First vertex of open polyline
        result.push(current);
        continue;
      }

      // Calculate chamfer points
      const dir1 = Vector2.fromPoints(current, prev).normalize();
      const dir2 = Vector2.fromPoints(current, next).normalize();

      const chamferPoint1 = current.clone().add(dir1.clone().multiplyScalar(distance));
      const chamferPoint2 = current.clone().add(dir2.clone().multiplyScalar(distance));

      result.push(chamferPoint1);
      result.push(chamferPoint2);
    }

    if (!closed) {
      // Add last vertex
      result.push(vertices[vertices.length - 1]);
    }

    return result;
  }
}
