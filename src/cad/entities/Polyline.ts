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
 * Polyline entity - Connected series of line segments
 */
export class Polyline extends Entity {
  private vertices: Vector2[];
  private closed: boolean;

  constructor(vertices: Vector2[], closed: boolean = false, layer: string = 'A-WALL') {
    super(EntityType.POLYLINE, layer);
    this.vertices = vertices.map((v) => v.clone());
    this.closed = closed;
  }

  /**
   * Get vertices
   */
  getVertices(): Vector2[] {
    return this.vertices.map((v) => v.clone());
  }

  /**
   * Set vertices
   */
  setVertices(vertices: Vector2[]): void {
    this.vertices = vertices.map((v) => v.clone());
    this.markBoundingBoxDirty();
  }

  /**
   * Add vertex at the end
   */
  addVertex(vertex: Vector2): void {
    this.vertices.push(vertex.clone());
    this.markBoundingBoxDirty();
  }

  /**
   * Insert vertex at index
   */
  insertVertex(index: number, vertex: Vector2): void {
    this.vertices.splice(index, 0, vertex.clone());
    this.markBoundingBoxDirty();
  }

  /**
   * Remove vertex at index
   */
  removeVertex(index: number): void {
    if (this.vertices.length <= 2) {
      throw new Error('Polyline must have at least 2 vertices');
    }
    this.vertices.splice(index, 1);
    this.markBoundingBoxDirty();
  }

  /**
   * Update vertex at index
   */
  updateVertex(index: number, vertex: Vector2): void {
    if (index < 0 || index >= this.vertices.length) {
      throw new Error('Index out of bounds');
    }
    this.vertices[index] = vertex.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get vertex count
   */
  getVertexCount(): number {
    return this.vertices.length;
  }

  /**
   * Check if polyline is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Set closed state
   */
  setClosed(closed: boolean): void {
    this.closed = closed;
  }

  /**
   * Get segment count
   */
  getSegmentCount(): number {
    return this.closed ? this.vertices.length : this.vertices.length - 1;
  }

  /**
   * Get segment at index (returns start and end points)
   */
  getSegment(index: number): [Vector2, Vector2] {
    const segmentCount = this.getSegmentCount();
    if (index < 0 || index >= segmentCount) {
      throw new Error('Segment index out of bounds');
    }

    const start = this.vertices[index].clone();
    const end = this.vertices[(index + 1) % this.vertices.length].clone();
    return [start, end];
  }

  /**
   * Get total length of polyline
   */
  getTotalLength(): number {
    let length = 0;
    const segmentCount = this.getSegmentCount();

    for (let i = 0; i < segmentCount; i++) {
      const [start, end] = this.getSegment(i);
      length += start.distanceTo(end);
    }

    return length;
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    if (this.vertices.length === 0) {
      return { min: new Vector2(0, 0), max: new Vector2(0, 0) };
    }

    const xs = this.vertices.map((v) => v.x);
    const ys = this.vertices.map((v) => v.y);

    return {
      min: new Vector2(Math.min(...xs), Math.min(...ys)),
      max: new Vector2(Math.max(...xs), Math.max(...ys)),
    };
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      // Add all vertices as endpoints
      this.vertices.forEach((vertex) => {
        points.push({ point: vertex.clone(), type: SnapType.ENDPOINT, entity: this });
      });
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      // Add midpoint of each segment
      const segmentCount = this.getSegmentCount();
      for (let i = 0; i < segmentCount; i++) {
        const [start, end] = this.getSegment(i);
        const midpoint = Vector2.lerp(start, end, 0.5);
        points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
      }
    }

    return points;
  }

  /**
   * Get distance from point to polyline
   */
  distanceToPoint(point: Vector2): number {
    const nearestPoint = this.getNearestPoint(point);
    return point.distanceTo(nearestPoint);
  }

  /**
   * Get nearest point on polyline
   */
  getNearestPoint(point: Vector2): Vector2 {
    let minDist = Infinity;
    let nearestPoint = this.vertices[0].clone();

    const segmentCount = this.getSegmentCount();
    for (let i = 0; i < segmentCount; i++) {
      const [start, end] = this.getSegment(i);
      const segmentPoint = this.getNearestPointOnSegment(point, start, end);
      const dist = point.distanceTo(segmentPoint);

      if (dist < minDist) {
        minDist = dist;
        nearestPoint = segmentPoint;
      }
    }

    return nearestPoint;
  }

  /**
   * Get nearest point on a line segment
   */
  private getNearestPointOnSegment(point: Vector2, start: Vector2, end: Vector2): Vector2 {
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

  /**
   * Check if polyline contains point (within tolerance)
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  /**
   * Check if point is inside closed polyline (uses ray casting algorithm)
   */
  containsPointInside(point: Vector2): boolean {
    if (!this.closed) {
      return false;
    }

    let inside = false;
    const n = this.vertices.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = this.vertices[i].x;
      const yi = this.vertices[i].y;
      const xj = this.vertices[j].x;
      const yj = this.vertices[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Check if polyline intersects rectangle
   */
  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    // Check if any vertex is inside rectangle
    for (const vertex of this.vertices) {
      if (
        vertex.x >= min.x &&
        vertex.x <= max.x &&
        vertex.y >= min.y &&
        vertex.y <= max.y
      ) {
        return true;
      }
    }

    // Check if any segment intersects rectangle edges
    const rectCorners = [
      new Vector2(min.x, min.y),
      new Vector2(max.x, min.y),
      new Vector2(max.x, max.y),
      new Vector2(min.x, max.y),
    ];

    const segmentCount = this.getSegmentCount();
    for (let i = 0; i < segmentCount; i++) {
      const [start, end] = this.getSegment(i);

      // Check intersection with each rectangle edge
      for (let j = 0; j < 4; j++) {
        const rectStart = rectCorners[j];
        const rectEnd = rectCorners[(j + 1) % 4];

        if (this.segmentsIntersect(start, end, rectStart, rectEnd)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if two line segments intersect
   */
  private segmentsIntersect(
    p1: Vector2,
    p2: Vector2,
    q1: Vector2,
    q2: Vector2
  ): boolean {
    const r = Vector2.fromPoints(p1, p2);
    const s = Vector2.fromPoints(q1, q2);

    const rxs = r.cross(s);
    const qpxr = Vector2.fromPoints(p1, q1).cross(r);

    if (Math.abs(rxs) < 0.0001) {
      return false;
    }

    const t = Vector2.fromPoints(p1, q1).cross(s) / rxs;
    const u = qpxr / rxs;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /**
   * Transform polyline
   */
  transform(matrix: TransformMatrix): void {
    this.vertices = this.vertices.map((v) => transformPoint(v, matrix));
    this.markBoundingBoxDirty();
  }

  /**
   * Clone polyline
   */
  clone(): Polyline {
    const polyline = new Polyline(this.vertices, this.closed, this.getLayer());
    polyline.setColor(this.getColor());
    polyline.setLineWeight(this.getLineWeight());
    polyline.setLineType(this.getLineType() as any);
    polyline.setVisible(this.isVisible());
    polyline.setLocked(this.isLocked());
    return polyline;
  }

  /**
   * Render polyline
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible() || this.vertices.length < 2) return;

    const verticesScreen = this.vertices.map((v) => worldToScreen(v));

    ctx.save();

    // Apply line style
    const color = this.getColor() || layer?.color || '#ffffff';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;
    const lineType = this.getLineType() || layer?.lineType || 'solid';

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 2 : lineWeight * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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

    // Draw polyline
    ctx.beginPath();
    ctx.moveTo(verticesScreen[0].x, verticesScreen[0].y);
    for (let i = 1; i < verticesScreen.length; i++) {
      ctx.lineTo(verticesScreen[i].x, verticesScreen[i].y);
    }
    if (this.closed) {
      ctx.closePath();
    }
    ctx.stroke();

    // Draw selection handles if selected
    if (this.isSelected()) {
      this.renderSelectionHandles(ctx, verticesScreen);
    }

    ctx.restore();
  }

  /**
   * Render selection handles
   */
  private renderSelectionHandles(
    ctx: CanvasRenderingContext2D,
    verticesScreen: Vector2[]
  ): void {
    const handleSize = 6;

    ctx.setLineDash([]);
    ctx.fillStyle = '#4a9eff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Vertex handles
    verticesScreen.forEach((vertex, index) => {
      ctx.beginPath();
      ctx.arc(vertex.x, vertex.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Midpoint handles
    ctx.fillStyle = '#ffffff';
    const segmentCount = this.getSegmentCount();
    for (let i = 0; i < segmentCount; i++) {
      const start = verticesScreen[i];
      const end = verticesScreen[(i + 1) % verticesScreen.length];
      const mid = Vector2.lerp(start, end, 0.5);

      ctx.beginPath();
      ctx.arc(mid.x, mid.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      vertices: this.vertices.map((v) => v.toArray()),
      closed: this.closed,
    };
  }

  /**
   * Deserialize polyline
   */
  static deserialize(data: any): Polyline {
    const vertices = data.data.vertices.map((v: number[]) => Vector2.fromArray(v));
    const polyline = new Polyline(vertices, data.data.closed, data.properties.layer);

    if (data.properties.color) polyline.setColor(data.properties.color);
    if (data.properties.lineWeight) polyline.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) polyline.setLineType(data.properties.lineType);
    polyline.setVisible(data.properties.visible);
    polyline.setLocked(data.properties.locked);

    return polyline;
  }
}
