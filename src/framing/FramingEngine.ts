/**
 * FramingEngine - Generates accurate structural framing for walls
 * Handles studs, plates, corner posts, headers, and connections
 */

import * as THREE from 'three';
import { Vector2 } from '../cad/Vector2';
import { Wall } from '../cad/entities/Wall';
import { WallType } from './WallType';

export interface StudLayout {
  position: number; // Position along wall length (0 to length)
  type: 'regular' | 'corner' | 'king' | 'jack' | 'cripple';
}

export interface WallFrame {
  wall: Wall;
  studs: StudLayout[];
  hasCornerAtStart: boolean;
  hasCornerAtEnd: boolean;
}

export interface CornerPost {
  position: Vector2;
  wallsAtCorner: Wall[];
  angle: number; // Angle between walls
  type: 'L' | 'T' | 'X'; // L-corner, T-intersection, X-intersection
}

/**
 * FramingEngine generates structural framing geometry
 */
export class FramingEngine {
  private tolerance: number = 0.01; // Point matching tolerance in feet

  constructor(tolerance: number = 0.01) {
    this.tolerance = tolerance;
  }

  /**
   * Generate complete framing for a collection of walls
   */
  generateFraming(walls: Wall[]): THREE.Group {
    const framingGroup = new THREE.Group();

    // Find all corner connections
    const corners = this.findCorners(walls);

    // Generate frame layout for each wall
    const wallFrames = walls.map(wall => this.layoutWallFrame(wall, corners));

    // Build 3D geometry for each wall
    wallFrames.forEach(frame => {
      const wallFraming = this.buildWallFraming(frame);
      framingGroup.add(wallFraming);
    });

    // Build corner posts
    corners.forEach(corner => {
      const cornerPost = this.buildCornerPost(corner);
      if (cornerPost) {
        framingGroup.add(cornerPost);
      }
    });

    return framingGroup;
  }

  /**
   * Find all corner connections between walls
   */
  private findCorners(walls: Wall[]): CornerPost[] {
    const corners: CornerPost[] = [];
    const pointToWalls = new Map<string, { point: Vector2; walls: Wall[] }>();

    // Group walls by their endpoints
    walls.forEach(wall => {
      const start = wall.getStartPoint();
      const end = wall.getEndPoint();

      [start, end].forEach(point => {
        const key = this.pointKey(point);
        if (!pointToWalls.has(key)) {
          pointToWalls.set(key, { point: point.clone(), walls: [] });
        }
        pointToWalls.get(key)!.walls.push(wall);
      });
    });

    // Create corner posts where 2+ walls meet
    pointToWalls.forEach(({ point, walls: connectedWalls }) => {
      if (connectedWalls.length >= 2) {
        // Determine corner type
        let type: 'L' | 'T' | 'X' = 'L';
        if (connectedWalls.length === 3) type = 'T';
        if (connectedWalls.length >= 4) type = 'X';

        // Calculate angle (for L-corners)
        let angle = 90; // Default 90 degrees
        if (connectedWalls.length === 2) {
          angle = this.calculateCornerAngle(point, connectedWalls[0], connectedWalls[1]);
        }

        corners.push({
          position: point,
          wallsAtCorner: connectedWalls,
          angle,
          type,
        });
      }
    });

    return corners;
  }

  /**
   * Create a unique key for a point
   */
  private pointKey(point: Vector2): string {
    const x = Math.round(point.x / this.tolerance) * this.tolerance;
    const y = Math.round(point.y / this.tolerance) * this.tolerance;
    return `${x},${y}`;
  }

  /**
   * Calculate the angle between two walls at a corner
   */
  private calculateCornerAngle(corner: Vector2, wall1: Wall, wall2: Wall): number {
    const dir1 = this.getDirectionAtPoint(wall1, corner);
    const dir2 = this.getDirectionAtPoint(wall2, corner);

    const dot = dir1.x * dir2.x + dir1.y * dir2.y;
    const det = dir1.x * dir2.y - dir1.y * dir2.x;
    const angleRad = Math.atan2(det, dot);
    return Math.abs((angleRad * 180) / Math.PI);
  }

  /**
   * Get wall direction pointing away from a specific point
   */
  private getDirectionAtPoint(wall: Wall, point: Vector2): Vector2 {
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();

    if (start.distanceTo(point) < this.tolerance) {
      // Point is at start, direction is start -> end
      return Vector2.fromPoints(start, end).normalize();
    } else {
      // Point is at end, direction is end -> start
      return Vector2.fromPoints(end, start).normalize();
    }
  }

  /**
   * Layout studs and framing members for a single wall
   */
  private layoutWallFrame(wall: Wall, corners: CornerPost[]): WallFrame {
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const length = start.distanceTo(end);
    const wallType = wall.getWallType();
    const spacing = wallType.stud.spacing / 12; // Convert inches to feet

    const studs: StudLayout[] = [];

    // Check if wall has corners at its ends
    const hasCornerAtStart = corners.some(c => c.position.distanceTo(start) < this.tolerance);
    const hasCornerAtEnd = corners.some(c => c.position.distanceTo(end) < this.tolerance);

    // Calculate clearance needed for corner posts
    // California corner extends about 3.5" (one stud depth) from the corner
    const studDepth = wallType.stud.actualDepth / 12; // Convert inches to feet
    const studWidth = wallType.stud.actualWidth / 12; // Convert inches to feet
    const cornerClearance = studDepth + studWidth; // Space needed for corner assembly

    // Determine starting position for intermediate studs
    let startPos = spacing;
    if (hasCornerAtStart) {
      // Start first stud after corner clearance, aligned to spacing grid
      startPos = Math.ceil(cornerClearance / spacing) * spacing;
    }

    // Determine ending position for intermediate studs
    let endLimit = length - spacing / 2;
    if (hasCornerAtEnd) {
      // End studs before corner clearance
      endLimit = length - cornerClearance;
    }

    // Layout studs with proper spacing
    // Start stud (only if no corner post)
    if (!hasCornerAtStart) {
      studs.push({ position: 0, type: 'regular' });
    }

    // Intermediate studs at regular spacing, respecting corner clearances
    let currentPos = startPos;
    while (currentPos < endLimit) {
      studs.push({ position: currentPos, type: 'regular' });
      currentPos += spacing;
    }

    // End stud (only if no corner post)
    if (!hasCornerAtEnd) {
      studs.push({ position: length, type: 'regular' });
    }

    return {
      wall,
      studs,
      hasCornerAtStart,
      hasCornerAtEnd,
    };
  }

  /**
   * Build 3D framing geometry for a wall
   */
  private buildWallFraming(frame: WallFrame): THREE.Group {
    const group = new THREE.Group();
    const wall = frame.wall;
    const wallType = wall.getWallType();
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const height = wallType.getHeightMeters();

    // Position at wall start
    const startX = start.x;
    const startY = start.y;

    // Stud dimensions (converted to meters)
    const studWidth = wallType.stud.actualWidth * 0.0254; // 1.5" = 0.0381m
    const studDepth = wallType.stud.actualDepth * 0.0254; // 3.5" = 0.0889m

    // Wood material
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0xDEB887, // Burlywood
      roughness: 0.8,
      metalness: 0.0,
    });

    // Create bottom plate
    const bottomPlateGeometry = new THREE.BoxGeometry(length, studWidth, studDepth);
    const bottomPlate = new THREE.Mesh(bottomPlateGeometry, woodMaterial);
    bottomPlate.position.set(length / 2, studWidth / 2, 0);
    bottomPlate.castShadow = true;
    bottomPlate.receiveShadow = true;
    group.add(bottomPlate);

    // Create top plate(s)
    const plateCount = wallType.topPlate.count;
    for (let i = 0; i < plateCount; i++) {
      const plateY = height - studWidth * (plateCount - i);
      const topPlateGeometry = new THREE.BoxGeometry(length, studWidth, studDepth);
      const topPlate = new THREE.Mesh(topPlateGeometry, woodMaterial);
      topPlate.position.set(length / 2, plateY, 0);
      topPlate.castShadow = true;
      topPlate.receiveShadow = true;
      group.add(topPlate);
    }

    // Create studs
    const studHeight = height - studWidth * (1 + plateCount); // Height between plates
    const studGeometry = new THREE.BoxGeometry(studWidth, studHeight, studDepth);

    frame.studs.forEach(stud => {
      const studMesh = new THREE.Mesh(studGeometry, woodMaterial);
      studMesh.position.set(
        stud.position,
        studWidth + studHeight / 2,
        0
      );
      studMesh.castShadow = true;
      studMesh.receiveShadow = true;
      group.add(studMesh);
    });

    // Add corner studs with backing blocks if needed
    // California corner: full stud at end + backing blocks on the inside face
    if (frame.hasCornerAtStart) {
      // Add end stud at position 0
      const cornerStud = new THREE.Mesh(studGeometry, woodMaterial);
      cornerStud.position.set(0, studWidth + studHeight / 2, 0);
      cornerStud.castShadow = true;
      cornerStud.receiveShadow = true;
      group.add(cornerStud);

      // Add backing blocks (3 blocks spaced along height for nailing surface)
      // These are short pieces of stud rotated 90 degrees
      const backingGeometry = new THREE.BoxGeometry(studDepth, studWidth, studWidth);
      const backingPositions = [
        studHeight * 0.25 + studWidth,  // Bottom third
        studHeight * 0.5 + studWidth,   // Middle
        studHeight * 0.75 + studWidth,  // Top third
      ];

      backingPositions.forEach(y => {
        const backing = new THREE.Mesh(backingGeometry, woodMaterial);
        backing.position.set(0, y, studWidth / 2); // Offset to inside face of stud
        backing.castShadow = true;
        backing.receiveShadow = true;
        group.add(backing);
      });
    }

    if (frame.hasCornerAtEnd) {
      // Add end stud at position = length
      const cornerStud = new THREE.Mesh(studGeometry, woodMaterial);
      cornerStud.position.set(length, studWidth + studHeight / 2, 0);
      cornerStud.castShadow = true;
      cornerStud.receiveShadow = true;
      group.add(cornerStud);

      // Add backing blocks
      const backingGeometry = new THREE.BoxGeometry(studDepth, studWidth, studWidth);
      const backingPositions = [
        studHeight * 0.25 + studWidth,
        studHeight * 0.5 + studWidth,
        studHeight * 0.75 + studWidth,
      ];

      backingPositions.forEach(y => {
        const backing = new THREE.Mesh(backingGeometry, woodMaterial);
        backing.position.set(length, y, studWidth / 2);
        backing.castShadow = true;
        backing.receiveShadow = true;
        group.add(backing);
      });
    }

    // Position and rotate the entire wall group
    group.position.set(startX, 0, startY);
    group.rotation.y = -angle;

    return group;
  }

  /**
   * Build a corner post assembly using California corner (3-stud with insulation space)
   *
   * California corner consists of:
   * - Wall 1: Gets a full-height end stud (1.5" x 3.5")
   * - Wall 2: Gets a full-height end stud (1.5" x 3.5")
   * - Wall 1: Gets backing studs (short 3.5" x 1.5" pieces) attached to its end stud facing Wall 2
   *
   * This is NOT a separate 3-stud assembly - it's the way the two walls connect!
   */
  private buildCornerPost(corner: CornerPost): THREE.Group | null {
    // California corners are built as part of wall framing, not as separate assemblies
    // The walls themselves need corner studs which are handled in buildWallFraming
    // This method is no longer needed with the proper approach
    return null;
  }

  /**
   * Add sheathing to a framed wall
   */
  addSheathing(
    wallGroup: THREE.Group,
    wall: Wall,
    layerDef: any,
    layerThickness: number,
    offset: number
  ): void {
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const length = start.distanceTo(end);
    const wallType = wall.getWallType();
    const height = wallType.getHeightMeters();

    // Determine material color
    let color = 0x888888;
    if (layerDef.material === 'OSB') {
      color = 0xD4A574;
    } else if (layerDef.material === 'Gypsum') {
      color = 0xEEEEEE;
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.0,
    });

    const sheathingGeometry = new THREE.BoxGeometry(length, height, layerThickness * 0.0254);
    const sheathing = new THREE.Mesh(sheathingGeometry, material);
    sheathing.position.set(0, height / 2, offset);
    sheathing.castShadow = true;
    sheathing.receiveShadow = true;
    wallGroup.add(sheathing);
  }
}
