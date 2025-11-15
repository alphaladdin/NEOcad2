import { Vector2 } from '../Vector2';
import { Line } from '../entities/Line';
import { Circle } from '../entities/Circle';
import { Entity } from '../entities/Entity';

/**
 * Intersection result
 */
export interface IntersectionPoint {
  point: Vector2;
  t1?: number; // Parameter on first entity (0-1 for segments)
  t2?: number; // Parameter on second entity (0-1 for segments)
}

/**
 * IntersectionCalculator - Calculate intersections between various entity types
 */
export class IntersectionCalculator {
  private static readonly EPSILON = 1e-10;

  /**
   * Calculate all intersections between two entities
   */
  static calculate(entity1: Entity, entity2: Entity): IntersectionPoint[] {
    if (entity1 instanceof Line && entity2 instanceof Line) {
      return this.lineLineIntersection(entity1, entity2);
    } else if (entity1 instanceof Line && entity2 instanceof Circle) {
      return this.lineCircleIntersection(entity1, entity2);
    } else if (entity1 instanceof Circle && entity2 instanceof Line) {
      return this.lineCircleIntersection(entity2, entity1);
    } else if (entity1 instanceof Circle && entity2 instanceof Circle) {
      return this.circleCircleIntersection(entity1, entity2);
    }

    return [];
  }

  /**
   * Line-Line intersection
   */
  private static lineLineIntersection(line1: Line, line2: Line): IntersectionPoint[] {
    const p1 = line1.getStart();
    const p2 = line1.getEnd();
    const p3 = line2.getStart();
    const p4 = line2.getEnd();

    const r = Vector2.fromPoints(p1, p2);
    const s = Vector2.fromPoints(p3, p4);

    const rxs = r.cross(s);
    const qpxr = Vector2.fromPoints(p1, p3).cross(r);

    // Lines are parallel or collinear
    if (Math.abs(rxs) < this.EPSILON) {
      return [];
    }

    const t = Vector2.fromPoints(p1, p3).cross(s) / rxs;
    const u = qpxr / rxs;

    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const point = p1.clone().add(r.clone().multiplyScalar(t));
      return [{ point, t1: t, t2: u }];
    }

    return [];
  }

  /**
   * Line-Line intersection (infinite lines, not segments)
   */
  static lineLineInfinite(
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    p4: Vector2
  ): IntersectionPoint | null {
    const r = Vector2.fromPoints(p1, p2);
    const s = Vector2.fromPoints(p3, p4);

    const rxs = r.cross(s);

    // Lines are parallel
    if (Math.abs(rxs) < this.EPSILON) {
      return null;
    }

    const t = Vector2.fromPoints(p1, p3).cross(s) / rxs;
    const point = p1.clone().add(r.clone().multiplyScalar(t));

    return { point, t1: t };
  }

  /**
   * Line-Circle intersection
   */
  private static lineCircleIntersection(line: Line, circle: Circle): IntersectionPoint[] {
    const start = line.getStart();
    const end = line.getEnd();
    const center = circle.getCenter();
    const radius = circle.getRadius();

    // Line direction and length
    const d = Vector2.fromPoints(start, end);
    const lineLength = d.length();

    if (lineLength < this.EPSILON) {
      return [];
    }

    d.normalize();

    // Vector from start to center
    const f = Vector2.fromPoints(center, start);

    // Quadratic equation coefficients: at² + bt + c = 0
    const a = d.dot(d); // Should be 1 since d is normalized
    const b = 2 * f.dot(d);
    const c = f.dot(f) - radius * radius;

    const discriminant = b * b - 4 * a * c;

    // No intersection
    if (discriminant < 0) {
      return [];
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDiscriminant) / (2 * a);
    const t2 = (-b + sqrtDiscriminant) / (2 * a);

    const results: IntersectionPoint[] = [];

    // Check if t1 is within line segment
    if (t1 >= 0 && t1 <= lineLength) {
      const point = start.clone().add(d.clone().multiplyScalar(t1));
      results.push({ point, t1: t1 / lineLength });
    }

    // Check if t2 is within line segment (and different from t1)
    if (Math.abs(discriminant) > this.EPSILON && t2 >= 0 && t2 <= lineLength) {
      const point = start.clone().add(d.clone().multiplyScalar(t2));
      results.push({ point, t1: t2 / lineLength });
    }

    return results;
  }

  /**
   * Circle-Circle intersection
   */
  private static circleCircleIntersection(
    circle1: Circle,
    circle2: Circle
  ): IntersectionPoint[] {
    const c1 = circle1.getCenter();
    const r1 = circle1.getRadius();
    const c2 = circle2.getCenter();
    const r2 = circle2.getRadius();

    // Distance between centers
    const d = c1.distanceTo(c2);

    // No intersection cases
    if (d > r1 + r2 + this.EPSILON) {
      // Circles too far apart
      return [];
    }

    if (d < Math.abs(r1 - r2) - this.EPSILON) {
      // One circle inside the other
      return [];
    }

    if (d < this.EPSILON && Math.abs(r1 - r2) < this.EPSILON) {
      // Coincident circles
      return [];
    }

    // Calculate intersection points
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);

    // Point on line between centers
    const direction = Vector2.fromPoints(c1, c2).normalize();
    const p = c1.clone().add(direction.clone().multiplyScalar(a));

    // Perpendicular direction
    const perpendicular = new Vector2(-direction.y, direction.x);

    // Two intersection points
    const point1 = p.clone().add(perpendicular.clone().multiplyScalar(h));
    const point2 = p.clone().add(perpendicular.clone().multiplyScalar(-h));

    const results: IntersectionPoint[] = [{ point: point1 }];

    // Add second point if not coincident (tangent case)
    if (Math.abs(h) > this.EPSILON) {
      results.push({ point: point2 });
    }

    return results;
  }

  /**
   * Find all intersections of an entity with a list of cutting entities
   */
  static findAllIntersections(
    entity: Entity,
    cuttingEntities: Entity[]
  ): Array<{ point: Vector2; t: number; cuttingEntity: Entity }> {
    const intersections: Array<{ point: Vector2; t: number; cuttingEntity: Entity }> = [];

    for (const cuttingEntity of cuttingEntities) {
      const points = this.calculate(entity, cuttingEntity);
      for (const intersection of points) {
        if (intersection.t1 !== undefined) {
          intersections.push({
            point: intersection.point,
            t: intersection.t1,
            cuttingEntity,
          });
        }
      }
    }

    // Sort by parameter t
    intersections.sort((a, b) => a.t - b.t);

    return intersections;
  }

  /**
   * Extend a line to intersect with a boundary entity
   */
  static extendLineToEntity(line: Line, boundary: Entity): Vector2 | null {
    const start = line.getStart();
    const end = line.getEnd();
    const direction = Vector2.fromPoints(start, end);

    if (direction.length() < this.EPSILON) {
      return null;
    }

    direction.normalize();

    // Create an extended line (far endpoint)
    const farEnd = end.clone().add(direction.clone().multiplyScalar(10000));

    if (boundary instanceof Line) {
      const boundaryStart = boundary.getStart();
      const boundaryEnd = boundary.getEnd();

      const intersection = this.lineLineInfinite(start, farEnd, boundaryStart, boundaryEnd);

      if (intersection) {
        // Check if intersection is beyond the original end point
        const toIntersection = Vector2.fromPoints(start, intersection.point);
        const toEnd = Vector2.fromPoints(start, end);

        if (toIntersection.dot(toEnd) > 0 && toIntersection.length() > toEnd.length()) {
          return intersection.point;
        }
      }
    } else if (boundary instanceof Circle) {
      // Find intersections with infinite line
      const center = boundary.getCenter();
      const radius = boundary.getRadius();

      const f = Vector2.fromPoints(center, start);
      const a = 1; // direction is normalized
      const b = 2 * f.dot(direction);
      const c = f.dot(f) - radius * radius;

      const discriminant = b * b - 4 * a * c;

      if (discriminant >= 0) {
        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / 2;
        const t2 = (-b + sqrtDiscriminant) / 2;

        const lineLength = Vector2.fromPoints(start, end).length();

        // Find the intersection beyond the end point
        const t = t1 > lineLength ? t1 : t2 > lineLength ? t2 : null;

        if (t !== null && t > lineLength) {
          return start.clone().add(direction.clone().multiplyScalar(t));
        }
      }
    }

    return null;
  }

  /**
   * Get the closest intersection point to a reference point
   */
  static getClosestIntersection(
    intersections: IntersectionPoint[],
    referencePoint: Vector2
  ): IntersectionPoint | null {
    if (intersections.length === 0) {
      return null;
    }

    let closest = intersections[0];
    let minDist = referencePoint.distanceTo(closest.point);

    for (let i = 1; i < intersections.length; i++) {
      const dist = referencePoint.distanceTo(intersections[i].point);
      if (dist < minDist) {
        minDist = dist;
        closest = intersections[i];
      }
    }

    return closest;
  }
}
