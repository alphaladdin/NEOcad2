import { Vector2 } from './Vector2';
import { Entity, EntityType } from './entities/Entity';
import { Line } from './entities/Line';
import { Polyline } from './entities/Polyline';
import { Rectangle } from './entities/Rectangle';
import { Room, RoomType } from './entities/Room';

/**
 * Room boundary segment
 */
interface BoundarySegment {
  start: Vector2;
  end: Vector2;
  entity: Entity;
}

/**
 * Detected room boundary
 */
interface DetectedBoundary {
  vertices: Vector2[];
  area: number;
}

/**
 * RoomDetector - Automatically detect rooms from wall boundaries
 */
export class RoomDetector {
  private tolerance: number = 0.01; // Point matching tolerance

  constructor(tolerance: number = 0.01) {
    this.tolerance = tolerance;
  }

  /**
   * Detect rooms from a collection of entities (lines, polylines, rectangles)
   */
  detectRooms(entities: Entity[]): Room[] {
    // Extract all boundary segments
    const segments = this.extractBoundarySegments(entities);

    if (segments.length === 0) return [];

    // Find closed polygons
    const boundaries = this.findClosedBoundaries(segments);

    // Convert boundaries to rooms
    const rooms: Room[] = [];
    boundaries.forEach(boundary => {
      if (boundary.vertices.length >= 3) {
        const room = new Room(boundary.vertices, RoomType.UNDEFINED);
        rooms.push(room);
      }
    });

    return rooms;
  }

  /**
   * Extract boundary segments from entities
   */
  private extractBoundarySegments(entities: Entity[]): BoundarySegment[] {
    const segments: BoundarySegment[] = [];

    entities.forEach(entity => {
      const type = entity.getType();

      if (type === EntityType.LINE) {
        const line = entity as Line;
        segments.push({
          start: line.getStart(),
          end: line.getEnd(),
          entity,
        });
      } else if (type === EntityType.POLYLINE) {
        const polyline = entity as Polyline;
        const segmentCount = polyline.getSegmentCount();

        for (let i = 0; i < segmentCount; i++) {
          const [start, end] = polyline.getSegment(i);
          segments.push({
            start,
            end,
            entity,
          });
        }
      } else if (type === EntityType.RECTANGLE) {
        const rectangle = entity as Rectangle;
        const corners = rectangle.getCorners();

        for (let i = 0; i < 4; i++) {
          const start = corners[i];
          const end = corners[(i + 1) % 4];
          segments.push({
            start,
            end,
            entity,
          });
        }
      }
    });

    return segments;
  }

  /**
   * Find closed boundaries from segments
   */
  private findClosedBoundaries(segments: BoundarySegment[]): DetectedBoundary[] {
    const boundaries: DetectedBoundary[] = [];
    const used = new Set<number>();

    // Try to build closed loops starting from each unused segment
    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;

      const boundary = this.traceBoundary(segments, i, used);
      if (boundary && boundary.length >= 3) {
        // Check if this forms a valid closed loop
        const first = boundary[0];
        const last = boundary[boundary.length - 1];

        if (this.pointsMatch(first, last)) {
          // Remove duplicate last point
          boundary.pop();

          if (boundary.length >= 3) {
            const area = this.calculateArea(boundary);
            if (area > 0.01) {
              // Minimum area threshold
              boundaries.push({
                vertices: boundary,
                area,
              });
            }
          }
        }
      }
    }

    return boundaries;
  }

  /**
   * Trace a boundary starting from a segment
   */
  private traceBoundary(
    segments: BoundarySegment[],
    startIndex: number,
    used: Set<number>
  ): Vector2[] | null {
    const boundary: Vector2[] = [];
    const maxIterations = segments.length * 2;
    let iterations = 0;

    let currentIndex = startIndex;
    let currentPoint = segments[startIndex].start.clone();

    boundary.push(currentPoint);

    while (iterations < maxIterations) {
      iterations++;

      if (currentIndex !== -1) {
        used.add(currentIndex);
      }

      const segment = segments[currentIndex];
      currentPoint = segment.end.clone();
      boundary.push(currentPoint);

      // Check if we've closed the loop
      if (boundary.length > 2 && this.pointsMatch(currentPoint, boundary[0])) {
        return boundary;
      }

      // Find next connected segment
      const nextIndex = this.findConnectedSegment(
        segments,
        currentPoint,
        used,
        currentIndex
      );

      if (nextIndex === -1) {
        // No more connected segments
        break;
      }

      // Check if next segment needs to be flipped
      const nextSegment = segments[nextIndex];
      if (!this.pointsMatch(nextSegment.start, currentPoint)) {
        // Flip the segment
        const temp = nextSegment.start;
        nextSegment.start = nextSegment.end;
        nextSegment.end = temp;
      }

      currentIndex = nextIndex;
    }

    return boundary.length >= 3 ? boundary : null;
  }

  /**
   * Find a segment connected to a point
   */
  private findConnectedSegment(
    segments: BoundarySegment[],
    point: Vector2,
    used: Set<number>,
    excludeIndex: number
  ): number {
    for (let i = 0; i < segments.length; i++) {
      if (i === excludeIndex || used.has(i)) continue;

      const segment = segments[i];

      if (this.pointsMatch(segment.start, point)) {
        return i;
      }

      if (this.pointsMatch(segment.end, point)) {
        // Need to flip this segment
        return i;
      }
    }

    return -1;
  }

  /**
   * Check if two points match within tolerance
   */
  private pointsMatch(p1: Vector2, p2: Vector2): boolean {
    return p1.distanceTo(p2) < this.tolerance;
  }

  /**
   * Calculate area of a polygon using shoelace formula
   */
  private calculateArea(vertices: Vector2[]): number {
    const n = vertices.length;
    if (n < 3) return 0;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }

    return Math.abs(area / 2);
  }

  /**
   * Detect rooms and assign types based on size/location heuristics
   */
  detectRoomsWithTypes(entities: Entity[]): Room[] {
    const rooms = this.detectRooms(entities);

    // Sort by area
    rooms.sort((a, b) => b.getArea() - a.getArea());

    // Simple heuristic: largest room is likely living room
    if (rooms.length > 0) {
      rooms[0].setRoomType(RoomType.LIVING_ROOM);
    }

    // Medium-sized rooms could be bedrooms
    if (rooms.length > 1) {
      for (let i = 1; i < Math.min(4, rooms.length); i++) {
        const area = rooms[i].getArea();
        if (area > 100 && area < 300) {
          rooms[i].setRoomType(RoomType.BEDROOM);
        }
      }
    }

    // Small rooms could be bathrooms/closets
    for (const room of rooms) {
      const area = room.getArea();
      if (area < 50 && room.getRoomType() === RoomType.UNDEFINED) {
        room.setRoomType(RoomType.BATHROOM);
      } else if (area < 30 && room.getRoomType() === RoomType.UNDEFINED) {
        room.setRoomType(RoomType.CLOSET);
      }
    }

    return rooms;
  }

  /**
   * Update rooms when entities change
   */
  updateRooms(entities: Entity[], existingRooms: Room[]): Room[] {
    const newRooms = this.detectRooms(entities);

    // Try to preserve room types from existing rooms
    for (const newRoom of newRooms) {
      const center = newRoom.getLabelPosition();
      if (!center) continue;

      // Find existing room that contains this center point
      for (const existingRoom of existingRooms) {
        if (existingRoom.containsPoint(center)) {
          newRoom.setRoomType(existingRoom.getRoomType(), true);
          newRoom.setName(existingRoom.getName());
          break;
        }
      }
    }

    return newRooms;
  }
}
