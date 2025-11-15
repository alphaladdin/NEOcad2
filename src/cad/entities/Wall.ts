import { Vector2 } from '../Vector2';
import { Layer } from '../LayerManager';
import { SnapPoint, SnapType } from '../SnapManager';
import {
  Entity,
  EntityType,
  BoundingBox,
  TransformMatrix,
  transformPoint,
} from './Entity';
import { WallType } from '../../framing/WallType';
import { WallTypeManager } from '../../framing/WallTypeManager';

/**
 * Wall entity - Represents a wall with proper assembly (studs, sheathing, drywall)
 */
export class Wall extends Entity {
  private startPoint: Vector2;
  private endPoint: Vector2;
  private wallTypeId: string;
  private wallType: WallType;

  constructor(
    startPoint: Vector2,
    endPoint: Vector2,
    wallTypeId: string = '2x4-exterior-basic',
    layer: string = 'A-WALL'
  ) {
    super(EntityType.WALL, layer);
    this.startPoint = startPoint.clone();
    this.endPoint = endPoint.clone();
    this.wallTypeId = wallTypeId;

    // Get wall type from manager
    const wallTypeManager = WallTypeManager.getInstance();
    const wallType = wallTypeManager.getWallType(wallTypeId);
    if (!wallType) {
      throw new Error(`Wall type not found: ${wallTypeId}`);
    }
    this.wallType = wallType;
  }

  /**
   * Get start point
   */
  getStartPoint(): Vector2 {
    return this.startPoint.clone();
  }

  /**
   * Set start point
   */
  setStartPoint(point: Vector2): void {
    this.startPoint = point.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get end point
   */
  getEndPoint(): Vector2 {
    return this.endPoint.clone();
  }

  /**
   * Set end point
   */
  setEndPoint(point: Vector2): void {
    this.endPoint = point.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get wall type ID
   */
  getWallTypeId(): string {
    return this.wallTypeId;
  }

  /**
   * Get wall type
   */
  getWallType(): WallType {
    return this.wallType;
  }

  /**
   * Set wall type
   */
  setWallType(wallTypeId: string): void {
    const wallTypeManager = WallTypeManager.getInstance();
    const wallType = wallTypeManager.getWallType(wallTypeId);
    if (!wallType) {
      throw new Error(`Wall type not found: ${wallTypeId}`);
    }
    this.wallTypeId = wallTypeId;
    this.wallType = wallType;
    this.markBoundingBoxDirty();
  }

  /**
   * Get wall length
   */
  getLength(): number {
    return this.startPoint.distanceTo(this.endPoint);
  }

  /**
   * Get wall direction (normalized)
   */
  private getDirection(): Vector2 {
    return Vector2.fromPoints(this.startPoint, this.endPoint).normalize();
  }

  /**
   * Get perpendicular direction (to the left of the wall direction)
   */
  private getPerpendicular(): Vector2 {
    const dir = this.getDirection();
    return new Vector2(-dir.y, dir.x);
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    const halfThickness = (this.wallType.actualThickness / 12) / 2; // Convert inches to feet and half
    const perp = this.getPerpendicular().multiplyScalar(halfThickness);

    const points = [
      this.startPoint.clone().add(perp),
      this.startPoint.clone().sub(perp),
      this.endPoint.clone().add(perp),
      this.endPoint.clone().sub(perp),
    ];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    return {
      min: new Vector2(minX, minY),
      max: new Vector2(maxX, maxY),
    };
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      points.push(
        { point: this.startPoint, type: SnapType.ENDPOINT, entity: this },
        { point: this.endPoint, type: SnapType.ENDPOINT, entity: this }
      );
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      const midpoint = Vector2.lerp(this.startPoint, this.endPoint, 0.5);
      points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
    }

    return points;
  }

  /**
   * Get distance from point to wall centerline
   */
  distanceToPoint(point: Vector2): number {
    const lineVector = Vector2.fromPoints(this.startPoint, this.endPoint);
    const len = lineVector.length();

    if (len === 0) return point.distanceTo(this.startPoint);

    const t = Math.max(
      0,
      Math.min(1, point.clone().sub(this.startPoint).dot(lineVector) / (len * len))
    );

    const projection = Vector2.lerp(this.startPoint, this.endPoint, t);
    return point.distanceTo(projection);
  }

  /**
   * Check if wall contains point
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    const distance = this.distanceToPoint(point);
    const halfThickness = (this.wallType.actualThickness / 12) / 2; // Convert to feet
    return distance <= halfThickness + tolerance;
  }

  /**
   * Transform wall
   */
  transform(matrix: TransformMatrix): void {
    this.startPoint = transformPoint(this.startPoint, matrix);
    this.endPoint = transformPoint(this.endPoint, matrix);
    this.markBoundingBoxDirty();
  }

  /**
   * Clone wall
   */
  clone(): Wall {
    const wall = new Wall(
      this.startPoint,
      this.endPoint,
      this.wallTypeId,
      this.getLayer()
    );
    wall.setColor(this.getColor());
    wall.setLineWeight(this.getLineWeight());
    wall.setLineType(this.getLineType() as any);
    wall.setVisible(this.isVisible());
    wall.setLocked(this.isLocked());
    return wall;
  }

  /**
   * Static corner connection cache - used for 2D rendering
   * Maps wall instances to their corner connections
   */
  private static cornerCache = new WeakMap<Wall, { start: boolean; end: boolean }>();
  private static cornerCacheVersion = 0;

  /**
   * Detect corners for a set of walls (called before rendering)
   */
  static detectCorners(walls: Wall[], tolerance: number = 0.01): void {
    Wall.cornerCacheVersion++;

    // Clear cache
    walls.forEach(wall => {
      Wall.cornerCache.set(wall, { start: false, end: false });
    });

    // Check each pair of walls for connections
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];

        const w1Start = wall1.getStartPoint();
        const w1End = wall1.getEndPoint();
        const w2Start = wall2.getStartPoint();
        const w2End = wall2.getEndPoint();

        const cache1 = Wall.cornerCache.get(wall1)!;
        const cache2 = Wall.cornerCache.get(wall2)!;

        // Check all possible connections
        if (w1Start.distanceTo(w2Start) < tolerance) {
          cache1.start = true;
          cache2.start = true;
        }
        if (w1Start.distanceTo(w2End) < tolerance) {
          cache1.start = true;
          cache2.end = true;
        }
        if (w1End.distanceTo(w2Start) < tolerance) {
          cache1.end = true;
          cache2.start = true;
        }
        if (w1End.distanceTo(w2End) < tolerance) {
          cache1.end = true;
          cache2.end = true;
        }
      }
    }
  }

  /**
   * Get corner connection info for this wall
   */
  private getCornerInfo(): { start: boolean; end: boolean } {
    const cached = Wall.cornerCache.get(this);
    return cached || { start: false, end: false };
  }

  /**
   * Render wall with all layers
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    const startScreen = worldToScreen(this.startPoint);
    const endScreen = worldToScreen(this.endPoint);
    const cornerInfo = this.getCornerInfo();

    ctx.save();

    // Get color and line weight (fall back to wall type defaults)
    const entityColor = super.getColor();
    const color = entityColor || layer?.color || '#' + this.wallType.color.getHexString();
    const entityLineWeight = super.getLineWeight();
    const lineWeight = entityLineWeight || layer?.lineWeight || this.wallType.lineWeight;

    // Get wall direction and perpendicular
    const dir = this.getDirection();
    const perp = this.getPerpendicular();

    // Get wall layers
    const layers = this.wallType.layers;
    const totalThickness = this.wallType.actualThickness / 12; // Convert inches to feet

    // Calculate screen-space perpendicular (for consistent rendering)
    const screenDir = new Vector2(endScreen.x - startScreen.x, endScreen.y - startScreen.y).normalize();
    const screenPerp = new Vector2(-screenDir.y, screenDir.x);

    // Get zoom level from worldToScreen function (attached by CanvasViewport)
    const zoom = (worldToScreen as any).zoom || 50; // Fallback to 50 if not available

    // Render each layer
    let currentOffset = -totalThickness / 2; // Start from interior side

    layers.forEach((layerDef) => {
      const layerThickness = layerDef.thickness / 12; // Convert inches to feet

      // Skip rendering air cavity (just show as gap)
      if (layerDef.material === 'Air') {
        currentOffset += layerThickness;
        return;
      }

      // Calculate layer offset positions in world space
      const offset1 = currentOffset;
      const offset2 = currentOffset + layerThickness;

      // Convert to screen space using actual zoom level
      const perp1Screen = screenPerp.clone().multiplyScalar(offset1 * zoom);
      const perp2Screen = screenPerp.clone().multiplyScalar(offset2 * zoom);

      const start1 = new Vector2(startScreen.x + perp1Screen.x, startScreen.y + perp1Screen.y);
      const end1 = new Vector2(endScreen.x + perp1Screen.x, endScreen.y + perp1Screen.y);
      const start2 = new Vector2(startScreen.x + perp2Screen.x, startScreen.y + perp2Screen.y);
      const end2 = new Vector2(endScreen.x + perp2Screen.x, endScreen.y + perp2Screen.y);

      // Determine layer color
      let layerColor = '#888888'; // Default gray
      if (layerDef.material === 'Gypsum') {
        layerColor = '#EEEEEE'; // Light gray for drywall
      } else if (layerDef.material === 'OSB') {
        layerColor = '#D4A574'; // Tan for OSB
      } else if (layerDef.material === 'Wood Framing') {
        layerColor = '#DEB887'; // Burlywood for studs
      } else if (layerDef.material === 'Lap Siding') {
        layerColor = '#FFFFFF'; // White for lap siding
      }

      // Fill the layer as a polygon
      ctx.fillStyle = this.isSelected() ? '#4a9eff80' : layerColor;
      ctx.beginPath();
      ctx.moveTo(start1.x, start1.y);
      ctx.lineTo(end1.x, end1.y);
      ctx.lineTo(end2.x, end2.y);
      ctx.lineTo(start2.x, start2.y);
      ctx.closePath();
      ctx.fill();

      // Draw layer outlines
      ctx.strokeStyle = this.isSelected() ? '#4a9eff' : '#000000';
      ctx.lineWidth = this.isSelected() ? lineWeight * 1.5 : (lineWeight * 0.5);
      ctx.beginPath();
      ctx.moveTo(start1.x, start1.y);
      ctx.lineTo(end1.x, end1.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(start2.x, start2.y);
      ctx.lineTo(end2.x, end2.y);
      ctx.stroke();

      currentOffset += layerThickness;
    });

    // Draw end caps
    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : '#000000';
    ctx.lineWidth = this.isSelected() ? lineWeight * 1.5 : lineWeight;

    const halfThicknessScreen = (totalThickness / 2) * zoom;
    const perpScreen = screenPerp.clone().multiplyScalar(halfThicknessScreen);

    // Start cap
    ctx.beginPath();
    ctx.moveTo(startScreen.x - perpScreen.x, startScreen.y - perpScreen.y);
    ctx.lineTo(startScreen.x + perpScreen.x, startScreen.y + perpScreen.y);
    ctx.stroke();

    // End cap
    ctx.beginPath();
    ctx.moveTo(endScreen.x - perpScreen.x, endScreen.y - perpScreen.y);
    ctx.lineTo(endScreen.x + perpScreen.x, endScreen.y + perpScreen.y);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      startPoint: this.startPoint.toArray(),
      endPoint: this.endPoint.toArray(),
      wallTypeId: this.wallTypeId,
    };
  }

  /**
   * Deserialize wall
   */
  static deserialize(data: any): Wall {
    const wall = new Wall(
      Vector2.fromArray(data.data.startPoint),
      Vector2.fromArray(data.data.endPoint),
      data.data.wallTypeId,
      data.properties.layer
    );

    if (data.properties.color) wall.setColor(data.properties.color);
    if (data.properties.lineWeight) wall.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) wall.setLineType(data.properties.lineType);
    wall.setVisible(data.properties.visible);
    wall.setLocked(data.properties.locked);

    return wall;
  }
}
