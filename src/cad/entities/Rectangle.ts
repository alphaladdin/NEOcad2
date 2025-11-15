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
 * Rectangle entity - Axis-aligned rectangle
 */
export class Rectangle extends Entity {
  private corner1: Vector2; // First corner (typically top-left or bottom-left)
  private corner2: Vector2; // Opposite corner

  constructor(corner1: Vector2, corner2: Vector2, layer: string = 'A-WALL') {
    super(EntityType.POLYLINE, layer); // Use POLYLINE type as Rectangle is a closed polyline
    this.corner1 = corner1.clone();
    this.corner2 = corner2.clone();
  }

  /**
   * Get first corner
   */
  getCorner1(): Vector2 {
    return this.corner1.clone();
  }

  /**
   * Set first corner
   */
  setCorner1(corner: Vector2): void {
    this.corner1 = corner.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get second corner
   */
  getCorner2(): Vector2 {
    return this.corner2.clone();
  }

  /**
   * Set second corner
   */
  setCorner2(corner: Vector2): void {
    this.corner2 = corner.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get all four corners in order (counter-clockwise from bottom-left)
   */
  getCorners(): Vector2[] {
    const minX = Math.min(this.corner1.x, this.corner2.x);
    const maxX = Math.max(this.corner1.x, this.corner2.x);
    const minY = Math.min(this.corner1.y, this.corner2.y);
    const maxY = Math.max(this.corner1.y, this.corner2.y);

    return [
      new Vector2(minX, minY), // Bottom-left
      new Vector2(maxX, minY), // Bottom-right
      new Vector2(maxX, maxY), // Top-right
      new Vector2(minX, maxY), // Top-left
    ];
  }

  /**
   * Get vertices (alias for getCorners to match Polyline interface)
   * Since Rectangle is typed as POLYLINE, CADTo3DConverter expects this method
   */
  getVertices(): Vector2[] {
    return this.getCorners();
  }

  /**
   * Get segment count (4 edges in a rectangle)
   * Required for Polyline interface compatibility
   */
  getSegmentCount(): number {
    return 4;
  }

  /**
   * Get a specific segment by index
   * Required for Polyline interface compatibility
   */
  getSegment(index: number): [Vector2, Vector2] {
    const corners = this.getCorners();
    return [corners[index], corners[(index + 1) % 4]];
  }

  /**
   * Get center point
   */
  getCenter(): Vector2 {
    return Vector2.lerp(this.corner1, this.corner2, 0.5);
  }

  /**
   * Get width
   */
  getWidth(): number {
    return Math.abs(this.corner2.x - this.corner1.x);
  }

  /**
   * Get height
   */
  getHeight(): number {
    return Math.abs(this.corner2.y - this.corner1.y);
  }

  /**
   * Get area
   */
  getArea(): number {
    return this.getWidth() * this.getHeight();
  }

  /**
   * Get perimeter
   */
  getPerimeter(): number {
    return 2 * (this.getWidth() + this.getHeight());
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    return {
      min: new Vector2(
        Math.min(this.corner1.x, this.corner2.x),
        Math.min(this.corner1.y, this.corner2.y)
      ),
      max: new Vector2(
        Math.max(this.corner1.x, this.corner2.x),
        Math.max(this.corner1.y, this.corner2.y)
      ),
    };
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];
    const corners = this.getCorners();

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      corners.forEach((corner) => {
        points.push({ point: corner, type: SnapType.ENDPOINT, entity: this });
      });
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      // Midpoints of each edge
      for (let i = 0; i < 4; i++) {
        const midpoint = Vector2.lerp(corners[i], corners[(i + 1) % 4], 0.5);
        points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
      }
    }

    if (snapTypes.includes(SnapType.CENTER)) {
      points.push({ point: this.getCenter(), type: SnapType.CENTER, entity: this });
    }

    return points;
  }

  /**
   * Get distance from point to rectangle
   */
  distanceToPoint(point: Vector2): number {
    const nearestPoint = this.getNearestPoint(point);
    return point.distanceTo(nearestPoint);
  }

  /**
   * Get nearest point on rectangle perimeter
   */
  getNearestPoint(point: Vector2): Vector2 {
    const corners = this.getCorners();
    let minDist = Infinity;
    let nearestPoint = corners[0];

    // Check each edge
    for (let i = 0; i < 4; i++) {
      const edgeStart = corners[i];
      const edgeEnd = corners[(i + 1) % 4];
      const edgeVector = Vector2.fromPoints(edgeStart, edgeEnd);
      const len = edgeVector.length();

      if (len === 0) continue;

      // Calculate projection parameter
      const t = Math.max(
        0,
        Math.min(
          1,
          point.clone().sub(edgeStart).dot(edgeVector) / (len * len)
        )
      );

      const pointOnEdge = Vector2.lerp(edgeStart, edgeEnd, t);
      const dist = point.distanceTo(pointOnEdge);

      if (dist < minDist) {
        minDist = dist;
        nearestPoint = pointOnEdge;
      }
    }

    return nearestPoint;
  }

  /**
   * Check if rectangle contains point (within tolerance of perimeter)
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  /**
   * Check if point is inside the rectangle (not just on perimeter)
   */
  containsPointInside(point: Vector2): boolean {
    const minX = Math.min(this.corner1.x, this.corner2.x);
    const maxX = Math.max(this.corner1.x, this.corner2.x);
    const minY = Math.min(this.corner1.y, this.corner2.y);
    const maxY = Math.max(this.corner1.y, this.corner2.y);

    return (
      point.x >= minX &&
      point.x <= maxX &&
      point.y >= minY &&
      point.y <= maxY
    );
  }

  /**
   * Check if rectangle intersects another rectangle
   */
  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    const minX = Math.min(this.corner1.x, this.corner2.x);
    const maxX = Math.max(this.corner1.x, this.corner2.x);
    const minY = Math.min(this.corner1.y, this.corner2.y);
    const maxY = Math.max(this.corner1.y, this.corner2.y);

    return !(
      maxX < min.x ||
      minX > max.x ||
      maxY < min.y ||
      minY > max.y
    );
  }

  /**
   * Transform rectangle
   */
  transform(matrix: TransformMatrix): void {
    this.corner1 = transformPoint(this.corner1, matrix);
    this.corner2 = transformPoint(this.corner2, matrix);
    this.markBoundingBoxDirty();
  }

  /**
   * Clone rectangle
   */
  clone(): Rectangle {
    const rect = new Rectangle(this.corner1, this.corner2, this.getLayer());
    rect.setColor(this.getColor());
    rect.setLineWeight(this.getLineWeight());
    rect.setLineType(this.getLineType() as any);
    rect.setVisible(this.isVisible());
    rect.setLocked(this.isLocked());
    return rect;
  }

  /**
   * Render rectangle
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    const corners = this.getCorners();
    const cornersScreen = corners.map((c) => worldToScreen(c));

    ctx.save();

    // Apply line style
    const color = this.getColor() || layer?.color || '#ffffff';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;
    const lineType = this.getLineType() || layer?.lineType || 'solid';

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 2 : lineWeight * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';

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

    // Draw rectangle
    ctx.beginPath();
    ctx.moveTo(cornersScreen[0].x, cornersScreen[0].y);
    for (let i = 1; i < cornersScreen.length; i++) {
      ctx.lineTo(cornersScreen[i].x, cornersScreen[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw selection handles if selected
    if (this.isSelected()) {
      this.renderSelectionHandles(ctx, cornersScreen);
    }

    ctx.restore();
  }

  /**
   * Render selection handles
   */
  private renderSelectionHandles(
    ctx: CanvasRenderingContext2D,
    cornersScreen: Vector2[]
  ): void {
    const handleSize = 6;

    ctx.fillStyle = '#4a9eff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    // Corner handles
    cornersScreen.forEach((corner) => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Midpoint handles
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const mid = Vector2.lerp(cornersScreen[i], cornersScreen[(i + 1) % 4], 0.5);
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Center handle
    const center = this.getCorners().reduce((sum, c) => sum.add(c), new Vector2(0, 0));
    center.multiplyScalar(0.25);
    const centerScreen = cornersScreen.reduce(
      (sum, c) => new Vector2(sum.x + c.x, sum.y + c.y),
      new Vector2(0, 0)
    );
    centerScreen.multiplyScalar(0.25);

    ctx.fillStyle = '#4a9eff';
    ctx.beginPath();
    ctx.arc(centerScreen.x, centerScreen.y, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      corner1: this.corner1.toArray(),
      corner2: this.corner2.toArray(),
    };
  }

  /**
   * Deserialize rectangle
   */
  static deserialize(data: any): Rectangle {
    const rect = new Rectangle(
      Vector2.fromArray(data.data.corner1),
      Vector2.fromArray(data.data.corner2),
      data.properties.layer
    );

    if (data.properties.color) rect.setColor(data.properties.color);
    if (data.properties.lineWeight) rect.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) rect.setLineType(data.properties.lineType);
    rect.setVisible(data.properties.visible);
    rect.setLocked(data.properties.locked);

    return rect;
  }
}
