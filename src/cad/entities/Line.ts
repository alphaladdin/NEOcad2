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

/**
 * Line entity - Represents a straight line segment
 */
export class Line extends Entity {
  private start: Vector2;
  private end: Vector2;

  constructor(start: Vector2, end: Vector2, layer: string = 'G-CONS') {
    super(EntityType.LINE, layer);
    this.start = start.clone();
    this.end = end.clone();
  }

  /**
   * Get start point
   */
  getStart(): Vector2 {
    return this.start.clone();
  }

  /**
   * Set start point
   */
  setStart(point: Vector2): void {
    this.start = point.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get end point
   */
  getEnd(): Vector2 {
    return this.end.clone();
  }

  /**
   * Set end point
   */
  setEnd(point: Vector2): void {
    this.end = point.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get line length
   */
  getLength(): number {
    return this.start.distanceTo(this.end);
  }

  /**
   * Get line angle in radians
   */
  getAngle(): number {
    return Vector2.fromPoints(this.start, this.end).angle();
  }

  /**
   * Get line direction (normalized)
   */
  getDirection(): Vector2 {
    return Vector2.fromPoints(this.start, this.end).normalize();
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    return {
      min: new Vector2(
        Math.min(this.start.x, this.end.x),
        Math.min(this.start.y, this.end.y)
      ),
      max: new Vector2(
        Math.max(this.start.x, this.end.x),
        Math.max(this.start.y, this.end.y)
      ),
    };
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      points.push(
        { point: this.start.clone(), type: SnapType.ENDPOINT, entity: this },
        { point: this.end.clone(), type: SnapType.ENDPOINT, entity: this }
      );
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      const midpoint = Vector2.lerp(this.start, this.end, 0.5);
      points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
    }

    return points;
  }

  /**
   * Get distance from point to line
   */
  distanceToPoint(point: Vector2): number {
    const nearestPoint = this.getNearestPoint(point);
    return point.distanceTo(nearestPoint);
  }

  /**
   * Get nearest point on line
   */
  getNearestPoint(point: Vector2): Vector2 {
    const line = Vector2.fromPoints(this.start, this.end);
    const len = line.length();

    if (len === 0) {
      return this.start.clone();
    }

    // Calculate projection parameter
    const t = Math.max(
      0,
      Math.min(
        1,
        point.clone().sub(this.start).dot(line) / (len * len)
      )
    );

    return Vector2.lerp(this.start, this.end, t);
  }

  /**
   * Check if line contains point (within tolerance)
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  /**
   * Check if line intersects rectangle
   */
  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    // Check if either endpoint is inside rectangle
    if (
      (this.start.x >= min.x && this.start.x <= max.x &&
       this.start.y >= min.y && this.start.y <= max.y) ||
      (this.end.x >= min.x && this.end.x <= max.x &&
       this.end.y >= min.y && this.end.y <= max.y)
    ) {
      return true;
    }

    // Check for line-rectangle intersection
    // Test each edge of the rectangle
    const edges = [
      [new Vector2(min.x, min.y), new Vector2(max.x, min.y)], // Bottom
      [new Vector2(max.x, min.y), new Vector2(max.x, max.y)], // Right
      [new Vector2(max.x, max.y), new Vector2(min.x, max.y)], // Top
      [new Vector2(min.x, max.y), new Vector2(min.x, min.y)], // Left
    ];

    for (const [edgeStart, edgeEnd] of edges) {
      if (this.intersectsLine(edgeStart, edgeEnd)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if this line intersects another line
   */
  private intersectsLine(p1: Vector2, p2: Vector2): boolean {
    const p = this.start;
    const r = Vector2.fromPoints(this.start, this.end);
    const q = p1;
    const s = Vector2.fromPoints(p1, p2);

    const rxs = r.cross(s);
    const qpxr = Vector2.fromPoints(p, q).cross(r);

    if (Math.abs(rxs) < 0.0001) {
      // Lines are parallel or collinear
      return false;
    }

    const t = Vector2.fromPoints(p, q).cross(s) / rxs;
    const u = qpxr / rxs;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /**
   * Transform line
   */
  transform(matrix: TransformMatrix): void {
    this.start = transformPoint(this.start, matrix);
    this.end = transformPoint(this.end, matrix);
    this.markBoundingBoxDirty();
  }

  /**
   * Clone line
   */
  clone(): Line {
    const line = new Line(this.start, this.end, this.getLayer());
    line.setColor(this.getColor());
    line.setLineWeight(this.getLineWeight());
    line.setLineType(this.getLineType() as any);
    line.setVisible(this.isVisible());
    line.setLocked(this.isLocked());
    return line;
  }

  /**
   * Render line
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    const startScreen = worldToScreen(this.start);
    const endScreen = worldToScreen(this.end);

    ctx.save();

    // Apply line style
    const color = this.getColor() || layer?.color || '#ffffff';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;
    const lineType = this.getLineType() || layer?.lineType || 'solid';

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 2 : lineWeight * 2; // Scale for visibility
    ctx.lineCap = 'round';

    // Apply line type
    switch (lineType) {
      case 'dashed':
        ctx.setLineDash([10, 5]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 3]);
        break;
      case 'dashdot':
        ctx.setLineDash([10, 5, 2, 5]);
        break;
      case 'hidden':
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        break;
      default:
        ctx.setLineDash([]);
    }

    // Draw line
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    // Draw selection handles if selected
    if (this.isSelected()) {
      this.renderSelectionHandles(ctx, startScreen, endScreen);
    }

    ctx.restore();
  }

  /**
   * Render selection handles
   */
  private renderSelectionHandles(
    ctx: CanvasRenderingContext2D,
    startScreen: Vector2,
    endScreen: Vector2
  ): void {
    const handleSize = 6;

    ctx.fillStyle = '#4a9eff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Start handle
    ctx.beginPath();
    ctx.arc(startScreen.x, startScreen.y, handleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // End handle
    ctx.beginPath();
    ctx.arc(endScreen.x, endScreen.y, handleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Midpoint handle
    const mid = Vector2.lerp(startScreen, endScreen, 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      start: this.start.toArray(),
      end: this.end.toArray(),
    };
  }

  /**
   * Deserialize line
   */
  static deserialize(data: any): Line {
    const line = new Line(
      Vector2.fromArray(data.data.start),
      Vector2.fromArray(data.data.end),
      data.properties.layer
    );

    if (data.properties.color) line.setColor(data.properties.color);
    if (data.properties.lineWeight) line.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) line.setLineType(data.properties.lineType);
    line.setVisible(data.properties.visible);
    line.setLocked(data.properties.locked);

    return line;
  }
}
