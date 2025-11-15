import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { Circle } from '../entities/Circle';
import { Polyline } from '../entities/Polyline';

/**
 * OffsetCommand - Create parallel copies of entities at a specified distance
 */
export class OffsetCommand {
  /**
   * Offset a line by a specified distance
   */
  static offsetLine(line: Line, distance: number, side: 'left' | 'right'): Line {
    const start = line.getStart();
    const end = line.getEnd();

    // Calculate perpendicular direction
    const direction = Vector2.fromPoints(start, end);
    const perpendicular = new Vector2(-direction.y, direction.x).normalize();

    // Apply offset based on side
    const offsetVector = perpendicular.multiplyScalar(side === 'left' ? distance : -distance);

    const newStart = start.clone().add(offsetVector);
    const newEnd = end.clone().add(offsetVector);

    const offsetLine = new Line(newStart, newEnd, line.getLayer());
    offsetLine.setColor(line.getColor());
    offsetLine.setLineWeight(line.getLineWeight());
    offsetLine.setLineType(line.getLineType() as any);

    return offsetLine;
  }

  /**
   * Offset a circle by a specified distance
   */
  static offsetCircle(circle: Circle, distance: number, side: 'inner' | 'outer'): Circle | null {
    const center = circle.getCenter();
    const radius = circle.getRadius();

    const newRadius = side === 'outer' ? radius + distance : radius - distance;

    // Can't create circle with negative or zero radius
    if (newRadius <= 0) {
      return null;
    }

    const offsetCircle = new Circle(center, newRadius, circle.getLayer());
    offsetCircle.setColor(circle.getColor());
    offsetCircle.setLineWeight(circle.getLineWeight());
    offsetCircle.setLineType(circle.getLineType() as any);

    return offsetCircle;
  }

  /**
   * Offset a polyline by a specified distance
   */
  static offsetPolyline(
    polyline: Polyline,
    distance: number,
    side: 'left' | 'right'
  ): Polyline | null {
    const vertices = polyline.getVertices();
    const closed = polyline.isClosed();

    if (vertices.length < 2) {
      return null;
    }

    const offsetVertices: Vector2[] = [];

    // For open polylines
    if (!closed) {
      // Calculate offset for each segment
      const segments: Array<{ start: Vector2; end: Vector2; offset: Vector2 }> = [];

      for (let i = 0; i < vertices.length - 1; i++) {
        const start = vertices[i];
        const end = vertices[i + 1];
        const direction = Vector2.fromPoints(start, end);
        const perpendicular = new Vector2(-direction.y, direction.x).normalize();
        const offsetVector = perpendicular.multiplyScalar(
          side === 'left' ? distance : -distance
        );

        segments.push({
          start: start.clone().add(offsetVector),
          end: end.clone().add(offsetVector),
          offset: offsetVector,
        });
      }

      // First vertex
      offsetVertices.push(segments[0].start);

      // Calculate intersections for intermediate vertices
      for (let i = 0; i < segments.length - 1; i++) {
        const intersection = this.lineIntersection(
          segments[i].start,
          segments[i].end,
          segments[i + 1].start,
          segments[i + 1].end
        );

        if (intersection) {
          offsetVertices.push(intersection);
        } else {
          // If no intersection, use the end of current segment
          offsetVertices.push(segments[i].end);
        }
      }

      // Last vertex
      offsetVertices.push(segments[segments.length - 1].end);
    } else {
      // For closed polylines
      const segmentCount = vertices.length;
      const segments: Array<{ start: Vector2; end: Vector2 }> = [];

      // Calculate offset segments
      for (let i = 0; i < segmentCount; i++) {
        const start = vertices[i];
        const end = vertices[(i + 1) % segmentCount];
        const direction = Vector2.fromPoints(start, end);
        const perpendicular = new Vector2(-direction.y, direction.x).normalize();
        const offsetVector = perpendicular.multiplyScalar(
          side === 'left' ? distance : -distance
        );

        segments.push({
          start: start.clone().add(offsetVector),
          end: end.clone().add(offsetVector),
        });
      }

      // Calculate intersections for all vertices
      for (let i = 0; i < segmentCount; i++) {
        const prevSegment = segments[(i - 1 + segmentCount) % segmentCount];
        const currentSegment = segments[i];

        const intersection = this.lineIntersection(
          prevSegment.start,
          prevSegment.end,
          currentSegment.start,
          currentSegment.end
        );

        if (intersection) {
          offsetVertices.push(intersection);
        } else {
          // If no intersection, use the start of current segment
          offsetVertices.push(currentSegment.start);
        }
      }
    }

    // Create offset polyline
    const offsetPolyline = new Polyline(offsetVertices, closed, polyline.getLayer());
    offsetPolyline.setColor(polyline.getColor());
    offsetPolyline.setLineWeight(polyline.getLineWeight());
    offsetPolyline.setLineType(polyline.getLineType() as any);

    return offsetPolyline;
  }

  /**
   * Calculate intersection point of two lines
   */
  private static lineIntersection(
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    p4: Vector2
  ): Vector2 | null {
    const r = Vector2.fromPoints(p1, p2);
    const s = Vector2.fromPoints(p3, p4);

    const rxs = r.cross(s);
    const qpxr = Vector2.fromPoints(p1, p3).cross(r);

    // Lines are parallel or collinear
    if (Math.abs(rxs) < 0.0001) {
      return null;
    }

    const t = Vector2.fromPoints(p1, p3).cross(s) / rxs;
    const u = qpxr / rxs;

    // Calculate intersection point
    return p1.clone().add(r.clone().multiplyScalar(t));
  }

  /**
   * Offset any supported entity
   */
  static offset(
    entity: Entity,
    distance: number,
    sideOrPoint: 'left' | 'right' | 'inner' | 'outer' | Vector2
  ): Entity | null {
    if (entity instanceof Line) {
      // Determine side based on point if provided
      let side: 'left' | 'right' = 'left';
      if (sideOrPoint instanceof Vector2) {
        side = this.determineLineSide(entity, sideOrPoint);
      } else {
        side = sideOrPoint as 'left' | 'right';
      }
      return this.offsetLine(entity, distance, side);
    } else if (entity instanceof Circle) {
      // Determine side based on point if provided
      let side: 'inner' | 'outer' = 'outer';
      if (sideOrPoint instanceof Vector2) {
        side = this.determineCircleSide(entity, sideOrPoint);
      } else {
        side = sideOrPoint as 'inner' | 'outer';
      }
      return this.offsetCircle(entity, distance, side);
    } else if (entity instanceof Polyline) {
      // Determine side based on point if provided
      let side: 'left' | 'right' = 'left';
      if (sideOrPoint instanceof Vector2) {
        side = this.determinePolylineSide(entity, sideOrPoint);
      } else {
        side = sideOrPoint as 'left' | 'right';
      }
      return this.offsetPolyline(entity, distance, side);
    }

    return null;
  }

  /**
   * Determine which side of a line a point is on
   */
  private static determineLineSide(line: Line, point: Vector2): 'left' | 'right' {
    const start = line.getStart();
    const end = line.getEnd();
    const direction = Vector2.fromPoints(start, end);
    const toPoint = Vector2.fromPoints(start, point);
    const cross = direction.cross(toPoint);

    return cross > 0 ? 'left' : 'right';
  }

  /**
   * Determine which side of a circle a point is on
   */
  private static determineCircleSide(circle: Circle, point: Vector2): 'inner' | 'outer' {
    const center = circle.getCenter();
    const radius = circle.getRadius();
    const distanceToCenter = center.distanceTo(point);

    return distanceToCenter < radius ? 'inner' : 'outer';
  }

  /**
   * Determine which side of a polyline a point is on
   */
  private static determinePolylineSide(polyline: Polyline, point: Vector2): 'left' | 'right' {
    // Find the nearest segment
    const vertices = polyline.getVertices();
    let minDist = Infinity;
    let nearestSegmentIndex = 0;

    const segmentCount = polyline.isClosed() ? vertices.length : vertices.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      const segmentPoint = this.nearestPointOnSegment(point, start, end);
      const dist = point.distanceTo(segmentPoint);

      if (dist < minDist) {
        minDist = dist;
        nearestSegmentIndex = i;
      }
    }

    // Determine side based on nearest segment
    const start = vertices[nearestSegmentIndex];
    const end = vertices[(nearestSegmentIndex + 1) % vertices.length];
    const direction = Vector2.fromPoints(start, end);
    const toPoint = Vector2.fromPoints(start, point);
    const cross = direction.cross(toPoint);

    return cross > 0 ? 'left' : 'right';
  }

  /**
   * Get nearest point on a line segment
   */
  private static nearestPointOnSegment(point: Vector2, start: Vector2, end: Vector2): Vector2 {
    const line = Vector2.fromPoints(start, end);
    const len = line.length();

    if (len === 0) {
      return start.clone();
    }

    const t = Math.max(
      0,
      Math.min(1, point.clone().sub(start).dot(line) / (len * len))
    );

    return Vector2.lerp(start, end, t);
  }
}
