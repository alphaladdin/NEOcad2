import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { Arc } from '../entities/Arc';
import { IntersectionCalculator } from '../utils/IntersectionCalculator';

/**
 * Fillet result containing the modified entities and fillet arc
 */
export interface FilletResult {
  entity1: Line | null; // Trimmed first entity (null if completely consumed)
  entity2: Line | null; // Trimmed second entity (null if completely consumed)
  arc: Arc; // Fillet arc
}

/**
 * FilletCommand - Create rounded corners between two lines
 */
export class FilletCommand {
  /**
   * Create a fillet between two lines
   */
  static fillet(line1: Line, line2: Line, radius: number): FilletResult | null {
    if (radius <= 0) {
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

    // Calculate direction vectors
    const dir1 = Vector2.fromPoints(p1, p2).normalize();
    const dir2 = Vector2.fromPoints(p3, p4).normalize();

    // Calculate the angle between lines
    const angle = Math.acos(Math.max(-1, Math.min(1, dir1.dot(dir2))));

    if (Math.abs(angle) < 0.001 || Math.abs(angle - Math.PI) < 0.001) {
      return null; // Lines are parallel or collinear
    }

    // Calculate distance from intersection to tangent points
    const dist = radius / Math.tan(angle / 2);

    // Calculate tangent points
    const tangent1 = intersection.clone().add(dir1.clone().multiplyScalar(-dist));
    const tangent2 = intersection.clone().add(dir2.clone().multiplyScalar(-dist));

    // Calculate fillet center
    const perpDir1 = new Vector2(-dir1.y, dir1.x);
    const perpDir2 = new Vector2(-dir2.y, dir2.x);

    // Determine which side the fillet should be on
    const cross = dir1.cross(dir2);
    const filletSide = cross > 0 ? 1 : -1;

    const center = tangent1.clone().add(perpDir1.clone().multiplyScalar(radius * filletSide));

    // Calculate arc angles
    const startAngle = Math.atan2(tangent1.y - center.y, tangent1.x - center.x);
    const endAngle = Math.atan2(tangent2.y - center.y, tangent2.x - center.x);

    // Create fillet arc
    const arc = new Arc(center, radius, startAngle, endAngle, filletSide > 0, line1.getLayer());
    arc.setColor(line1.getColor());
    arc.setLineWeight(line1.getLineWeight());
    arc.setLineType(line1.getLineType() as any);

    // Trim the lines to tangent points
    const trimmedLine1 = this.trimLineToPoint(line1, tangent1);
    const trimmedLine2 = this.trimLineToPoint(line2, tangent2);

    return {
      entity1: trimmedLine1,
      entity2: trimmedLine2,
      arc,
    };
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

    // Determine which end is closer to the original start
    const distToStart = point.distanceTo(start);
    const distToEnd = point.distanceTo(end);

    // Check if point is beyond the line
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
   * Create a fillet with automatic selection of lines near click points
   */
  static filletAtPoints(
    line1: Line,
    line2: Line,
    radius: number,
    clickPoint1: Vector2,
    clickPoint2: Vector2
  ): FilletResult | null {
    // This version considers which ends of the lines to fillet based on click points
    // For now, using the standard fillet implementation
    return this.fillet(line1, line2, radius);
  }

  /**
   * Check if two entities can be filleted
   */
  static canFillet(entity1: Entity, entity2: Entity): boolean {
    return entity1 instanceof Line && entity2 instanceof Line;
    // Future: Add support for arcs, circles, polylines
  }

  /**
   * Create zero-radius fillet (extend/trim to intersection)
   */
  static zeroRadiusFillet(line1: Line, line2: Line): { entity1: Line; entity2: Line } | null {
    const p1 = line1.getStart();
    const p2 = line1.getEnd();
    const p3 = line2.getStart();
    const p4 = line2.getEnd();

    const intersection = this.findIntersection(p1, p2, p3, p4);

    if (!intersection) {
      return null;
    }

    // Trim or extend both lines to intersection
    const newLine1 = new Line(p1, intersection, line1.getLayer());
    newLine1.setColor(line1.getColor());
    newLine1.setLineWeight(line1.getLineWeight());
    newLine1.setLineType(line1.getLineType() as any);

    const newLine2 = new Line(p3, intersection, line2.getLayer());
    newLine2.setColor(line2.getColor());
    newLine2.setLineWeight(line2.getLineWeight());
    newLine2.setLineType(line2.getLineType() as any);

    return {
      entity1: newLine1,
      entity2: newLine2,
    };
  }
}
