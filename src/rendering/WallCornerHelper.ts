/**
 * WallCornerHelper - Generates proper corner geometry for wall connections
 */

import * as THREE from 'three';
import { Vector2 } from '../cad/Vector2';
import { Wall } from '../cad/entities/Wall';

export interface WallConnection {
  wall: Wall;
  atStart: boolean; // true if connected at start point, false if at end point
  angle: number; // Angle between walls in radians
}

export interface CornerGeometry {
  position: THREE.Vector3;
  meshes: THREE.Mesh[];
}

export class WallCornerHelper {
  private tolerance: number = 0.01; // Point matching tolerance in feet

  constructor(tolerance: number = 0.01) {
    this.tolerance = tolerance;
  }

  /**
   * Find all wall connections in a collection of walls
   */
  findWallConnections(walls: Wall[]): Map<Wall, { start: WallConnection[], end: WallConnection[] }> {
    const connections = new Map<Wall, { start: WallConnection[], end: WallConnection[] }>();

    // Initialize connection map
    walls.forEach(wall => {
      connections.set(wall, { start: [], end: [] });
    });

    // Find connections
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];

        const w1Start = wall1.getStartPoint();
        const w1End = wall1.getEndPoint();
        const w2Start = wall2.getStartPoint();
        const w2End = wall2.getEndPoint();

        // Check all possible connections
        if (this.pointsMatch(w1Start, w2Start)) {
          const angle = this.calculateAngle(wall1, true, wall2, true);
          connections.get(wall1)!.start.push({ wall: wall2, atStart: true, angle });
          connections.get(wall2)!.start.push({ wall: wall1, atStart: true, angle });
        }

        if (this.pointsMatch(w1Start, w2End)) {
          const angle = this.calculateAngle(wall1, true, wall2, false);
          connections.get(wall1)!.start.push({ wall: wall2, atStart: false, angle });
          connections.get(wall2)!.end.push({ wall: wall1, atStart: true, angle });
        }

        if (this.pointsMatch(w1End, w2Start)) {
          const angle = this.calculateAngle(wall1, false, wall2, true);
          connections.get(wall1)!.end.push({ wall: wall2, atStart: true, angle });
          connections.get(wall2)!.start.push({ wall: wall1, atStart: false, angle });
        }

        if (this.pointsMatch(w1End, w2End)) {
          const angle = this.calculateAngle(wall1, false, wall2, false);
          connections.get(wall1)!.end.push({ wall: wall2, atStart: false, angle });
          connections.get(wall2)!.end.push({ wall: wall1, atStart: false, angle });
        }
      }
    }

    return connections;
  }

  /**
   * Check if two points match within tolerance
   */
  private pointsMatch(p1: Vector2, p2: Vector2): boolean {
    return p1.distanceTo(p2) < this.tolerance;
  }

  /**
   * Calculate angle between two walls at their connection point
   */
  private calculateAngle(wall1: Wall, atStart1: boolean, wall2: Wall, atStart2: boolean): number {
    const w1Dir = this.getWallDirection(wall1, atStart1);
    const w2Dir = this.getWallDirection(wall2, atStart2);

    // Calculate angle between directions
    const dot = w1Dir.x * w2Dir.x + w1Dir.y * w2Dir.y;
    const det = w1Dir.x * w2Dir.y - w1Dir.y * w2Dir.x;
    return Math.atan2(det, dot);
  }

  /**
   * Get wall direction at a specific end
   */
  private getWallDirection(wall: Wall, atStart: boolean): Vector2 {
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();

    if (atStart) {
      // Direction pointing away from start (into the wall)
      return Vector2.fromPoints(start, end).normalize();
    } else {
      // Direction pointing away from end (into the wall from the other side)
      return Vector2.fromPoints(end, start).normalize();
    }
  }

  /**
   * Create corner geometry for a wall connection
   * This creates proper miter joints for clean corners
   */
  createCornerGeometry(
    wall: Wall,
    atStart: boolean,
    connections: WallConnection[],
    height: number,
    layerDef: any,
    layerThickness: number,
    layerOffset: number
  ): THREE.Mesh | null {
    // If no connections, no special corner needed
    if (connections.length === 0) return null;

    // For now, handle simple 2-wall corners (most common case)
    if (connections.length !== 1) return null;

    const otherWall = connections[0].wall;
    const angle = connections[0].angle;

    // Get connection point
    const connectionPoint = atStart ? wall.getStartPoint() : wall.getEndPoint();

    // Only create corner geometry for 90-degree angles (common in buildings)
    const angleDegrees = Math.abs((angle * 180) / Math.PI);
    if (Math.abs(angleDegrees - 90) > 5 && Math.abs(angleDegrees - 270) > 5) {
      return null; // Not a right angle
    }

    // Determine layer color
    let layerColor = 0x888888; // Default gray
    if (layerDef.material === 'Gypsum') {
      layerColor = 0xEEEEEE;
    } else if (layerDef.material === 'OSB') {
      layerColor = 0xD4A574;
    } else if (layerDef.material === 'Wood Framing') {
      layerColor = 0xDEB887;
    } else if (layerDef.material === 'Lap Siding') {
      layerColor = 0xFFFFFF;
    }

    const material = new THREE.MeshStandardMaterial({
      color: layerColor,
      side: THREE.DoubleSide,
    });

    // Create a small cube at the corner to fill the gap
    const cornerSize = layerThickness * 0.0254; // Convert to meters
    const geometry = new THREE.BoxGeometry(cornerSize, height, cornerSize);
    const mesh = new THREE.Mesh(geometry, material);

    // Position at corner
    const x = connectionPoint.x;
    const y = height / 2;
    const z = connectionPoint.y;
    mesh.position.set(x, y, z);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Check if a wall should have extended end caps based on connections
   * This prevents gaps at T-intersections
   */
  shouldExtendWall(wall: Wall, atStart: boolean, connections: WallConnection[]): boolean {
    if (connections.length === 0) return false;

    // If there's exactly one connection at roughly 90 degrees, extend the wall slightly
    if (connections.length === 1) {
      const angle = connections[0].angle;
      const angleDegrees = Math.abs((angle * 180) / Math.PI);
      return Math.abs(angleDegrees - 90) < 5 || Math.abs(angleDegrees - 270) < 5;
    }

    return false;
  }
}
