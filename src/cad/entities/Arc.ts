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
 * Arc entity - Circular arc defined by center, radius, start angle, and end angle
 */
export class Arc extends Entity {
  private center: Vector2;
  private radius: number;
  private startAngle: number; // In radians
  private endAngle: number; // In radians
  private counterClockwise: boolean;

  constructor(
    center: Vector2,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterClockwise: boolean = true,
    layer: string = 'G-CONS'
  ) {
    super(EntityType.ARC, layer);
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.counterClockwise = counterClockwise;
  }

  /**
   * Create arc from three points
   */
  static fromThreePoints(p1: Vector2, p2: Vector2, p3: Vector2, layer?: string): Arc | null {
    // Calculate center using perpendicular bisectors
    const mid12 = Vector2.lerp(p1, p2, 0.5);
    const mid23 = Vector2.lerp(p2, p3, 0.5);

    const dir12 = Vector2.fromPoints(p1, p2);
    const dir23 = Vector2.fromPoints(p2, p3);

    const perp12 = new Vector2(-dir12.y, dir12.x);
    const perp23 = new Vector2(-dir23.y, dir23.x);

    // Find intersection of perpendicular bisectors
    const center = Arc.lineIntersection(mid12, mid12.clone().add(perp12), mid23, mid23.clone().add(perp23));

    if (!center) {
      return null; // Points are collinear
    }

    const radius = center.distanceTo(p1);

    // Calculate angles
    const angle1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const angle2 = Math.atan2(p2.y - center.y, p2.x - center.x);
    const angle3 = Math.atan2(p3.y - center.y, p3.x - center.x);

    // Determine direction
    const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    const counterClockwise = cross > 0;

    return new Arc(center, radius, angle1, angle3, counterClockwise, layer);
  }

  private static lineIntersection(p1: Vector2, p2: Vector2, p3: Vector2, p4: Vector2): Vector2 | null {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-10) return null;

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    return new Vector2(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
  }

  getCenter(): Vector2 {
    return this.center.clone();
  }

  setCenter(center: Vector2): void {
    this.center = center.clone();
    this.markBoundingBoxDirty();
  }

  getRadius(): number {
    return this.radius;
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.markBoundingBoxDirty();
  }

  getStartAngle(): number {
    return this.startAngle;
  }

  setStartAngle(angle: number): void {
    this.startAngle = angle;
    this.markBoundingBoxDirty();
  }

  getEndAngle(): number {
    return this.endAngle;
  }

  setEndAngle(angle: number): void {
    this.endAngle = angle;
    this.markBoundingBoxDirty();
  }

  isCounterClockwise(): boolean {
    return this.counterClockwise;
  }

  setCounterClockwise(ccw: boolean): void {
    this.counterClockwise = ccw;
  }

  /**
   * Get start point of arc
   */
  getStartPoint(): Vector2 {
    return new Vector2(
      this.center.x + Math.cos(this.startAngle) * this.radius,
      this.center.y + Math.sin(this.startAngle) * this.radius
    );
  }

  /**
   * Get end point of arc
   */
  getEndPoint(): Vector2 {
    return new Vector2(
      this.center.x + Math.cos(this.endAngle) * this.radius,
      this.center.y + Math.sin(this.endAngle) * this.radius
    );
  }

  /**
   * Get midpoint of arc
   */
  getMidPoint(): Vector2 {
    const midAngle = this.getMidAngle();
    return new Vector2(
      this.center.x + Math.cos(midAngle) * this.radius,
      this.center.y + Math.sin(midAngle) * this.radius
    );
  }

  /**
   * Get middle angle of arc
   */
  getMidAngle(): number {
    let angle = (this.startAngle + this.endAngle) / 2;

    if (this.counterClockwise) {
      if (this.endAngle < this.startAngle) {
        angle += Math.PI;
      }
    } else {
      if (this.endAngle > this.startAngle) {
        angle += Math.PI;
      }
    }

    return angle;
  }

  /**
   * Get arc length
   */
  getArcLength(): number {
    const sweepAngle = this.getSweepAngle();
    return Math.abs(sweepAngle) * this.radius;
  }

  /**
   * Get sweep angle (always positive)
   */
  getSweepAngle(): number {
    let sweep = this.endAngle - this.startAngle;

    if (this.counterClockwise) {
      if (sweep < 0) sweep += 2 * Math.PI;
    } else {
      if (sweep > 0) sweep -= 2 * Math.PI;
    }

    return sweep;
  }

  protected calculateBoundingBox(): BoundingBox {
    const points: Vector2[] = [this.getStartPoint(), this.getEndPoint()];

    // Check if arc passes through 0°, 90°, 180°, or 270°
    const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

    for (const angle of angles) {
      if (this.containsAngle(angle)) {
        points.push(
          new Vector2(
            this.center.x + Math.cos(angle) * this.radius,
            this.center.y + Math.sin(angle) * this.radius
          )
        );
      }
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    return {
      min: new Vector2(Math.min(...xs), Math.min(...ys)),
      max: new Vector2(Math.max(...xs), Math.max(...ys)),
    };
  }

  /**
   * Check if arc contains a specific angle
   */
  private containsAngle(angle: number): boolean {
    const normalize = (a: number) => {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    };

    const start = normalize(this.startAngle);
    const end = normalize(this.endAngle);
    const test = normalize(angle);

    if (this.counterClockwise) {
      if (start <= end) {
        return test >= start && test <= end;
      } else {
        return test >= start || test <= end;
      }
    } else {
      if (start >= end) {
        return test <= start && test >= end;
      } else {
        return test <= start || test >= end;
      }
    }
  }

  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      points.push(
        { point: this.getStartPoint(), type: SnapType.ENDPOINT, entity: this },
        { point: this.getEndPoint(), type: SnapType.ENDPOINT, entity: this }
      );
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      points.push({ point: this.getMidPoint(), type: SnapType.MIDPOINT, entity: this });
    }

    if (snapTypes.includes(SnapType.CENTER)) {
      points.push({ point: this.center.clone(), type: SnapType.CENTER, entity: this });
    }

    return points;
  }

  distanceToPoint(point: Vector2): number {
    const nearestPoint = this.getNearestPoint(point);
    return point.distanceTo(nearestPoint);
  }

  getNearestPoint(point: Vector2): Vector2 {
    const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);

    if (this.containsAngle(angle)) {
      return new Vector2(
        this.center.x + Math.cos(angle) * this.radius,
        this.center.y + Math.sin(angle) * this.radius
      );
    }

    // Return closest endpoint
    const startPoint = this.getStartPoint();
    const endPoint = this.getEndPoint();
    const distToStart = point.distanceTo(startPoint);
    const distToEnd = point.distanceTo(endPoint);

    return distToStart < distToEnd ? startPoint : endPoint;
  }

  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    // Check if any arc point is inside rectangle
    const bbox = this.getBoundingBox();
    return !(
      bbox.max.x < min.x ||
      bbox.min.x > max.x ||
      bbox.max.y < min.y ||
      bbox.min.y > max.y
    );
  }

  transform(matrix: TransformMatrix): void {
    this.center = transformPoint(this.center, matrix);
    // Scale radius
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
    this.radius *= (scaleX + scaleY) / 2;

    // Transform angles for rotation
    const rotation = Math.atan2(matrix.b, matrix.a);
    this.startAngle += rotation;
    this.endAngle += rotation;

    this.markBoundingBoxDirty();
  }

  clone(): Arc {
    const arc = new Arc(
      this.center,
      this.radius,
      this.startAngle,
      this.endAngle,
      this.counterClockwise,
      this.getLayer()
    );
    arc.setColor(this.getColor());
    arc.setLineWeight(this.getLineWeight());
    arc.setLineType(this.getLineType() as any);
    arc.setVisible(this.isVisible());
    arc.setLocked(this.isLocked());
    return arc;
  }

  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    const centerScreen = worldToScreen(this.center);
    const radiusPoint = worldToScreen(new Vector2(this.center.x + this.radius, this.center.y));
    const radiusScreen = Math.abs(radiusPoint.x - centerScreen.x);

    ctx.save();

    const color = this.getColor() || layer?.color || '#ffffff';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 2 : lineWeight * 2;

    ctx.beginPath();
    ctx.arc(
      centerScreen.x,
      centerScreen.y,
      radiusScreen,
      this.startAngle,
      this.endAngle,
      this.counterClockwise
    );
    ctx.stroke();

    // Draw selection handles if selected
    if (this.isSelected()) {
      ctx.fillStyle = '#4a9eff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Center handle
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Endpoint handles
      const startScreen = worldToScreen(this.getStartPoint());
      const endScreen = worldToScreen(this.getEndPoint());

      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(endScreen.x, endScreen.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  protected serializeData(): any {
    return {
      center: this.center.toArray(),
      radius: this.radius,
      startAngle: this.startAngle,
      endAngle: this.endAngle,
      counterClockwise: this.counterClockwise,
    };
  }

  static deserialize(data: any): Arc {
    const arc = new Arc(
      Vector2.fromArray(data.data.center),
      data.data.radius,
      data.data.startAngle,
      data.data.endAngle,
      data.data.counterClockwise,
      data.properties.layer
    );
    if (data.properties.color) arc.setColor(data.properties.color);
    if (data.properties.lineWeight) arc.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) arc.setLineType(data.properties.lineType);
    arc.setVisible(data.properties.visible);
    arc.setLocked(data.properties.locked);
    return arc;
  }
}
