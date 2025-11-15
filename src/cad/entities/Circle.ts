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
 * Circle entity
 */
export class Circle extends Entity {
  private center: Vector2;
  private radius: number;

  constructor(center: Vector2, radius: number, layer: string = 'G-CONS') {
    super(EntityType.CIRCLE, layer);
    this.center = center.clone();
    this.radius = radius;
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

  getDiameter(): number {
    return this.radius * 2;
  }

  getCircumference(): number {
    return 2 * Math.PI * this.radius;
  }

  getArea(): number {
    return Math.PI * this.radius * this.radius;
  }

  protected calculateBoundingBox(): BoundingBox {
    return {
      min: new Vector2(this.center.x - this.radius, this.center.y - this.radius),
      max: new Vector2(this.center.x + this.radius, this.center.y + this.radius),
    };
  }

  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.CENTER)) {
      points.push({ point: this.center.clone(), type: SnapType.CENTER, entity: this });
    }

    if (snapTypes.includes(SnapType.QUADRANT)) {
      const quadrants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      quadrants.forEach((angle) => {
        const point = new Vector2(
          this.center.x + Math.cos(angle) * this.radius,
          this.center.y + Math.sin(angle) * this.radius
        );
        points.push({ point, type: SnapType.QUADRANT, entity: this });
      });
    }

    return points;
  }

  distanceToPoint(point: Vector2): number {
    const distToCenter = this.center.distanceTo(point);
    return Math.abs(distToCenter - this.radius);
  }

  getNearestPoint(point: Vector2): Vector2 {
    const direction = Vector2.fromPoints(this.center, point);
    if (direction.length() === 0) {
      return new Vector2(this.center.x + this.radius, this.center.y);
    }
    direction.normalize().multiplyScalar(this.radius);
    return this.center.clone().add(direction);
  }

  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    // Find closest point on rectangle to circle center
    const closest = new Vector2(
      Math.max(min.x, Math.min(this.center.x, max.x)),
      Math.max(min.y, Math.min(this.center.y, max.y))
    );

    const distance = this.center.distanceTo(closest);
    return distance <= this.radius;
  }

  transform(matrix: TransformMatrix): void {
    this.center = transformPoint(this.center, matrix);
    // Scale radius by average of x and y scale
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
    this.radius *= (scaleX + scaleY) / 2;
    this.markBoundingBoxDirty();
  }

  clone(): Circle {
    const circle = new Circle(this.center, this.radius, this.getLayer());
    circle.setColor(this.getColor());
    circle.setLineWeight(this.getLineWeight());
    circle.setLineType(this.getLineType() as any);
    circle.setVisible(this.isVisible());
    circle.setLocked(this.isLocked());
    return circle;
  }

  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    const centerScreen = worldToScreen(this.center);
    // Calculate screen radius (approximate)
    const radiusPoint = worldToScreen(new Vector2(this.center.x + this.radius, this.center.y));
    const radiusScreen = Math.abs(radiusPoint.x - centerScreen.x);

    ctx.save();

    const color = this.getColor() || layer?.color || '#ffffff';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 2 : lineWeight * 2;

    ctx.beginPath();
    ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, 0, Math.PI * 2);
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

      // Quadrant handles
      [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach((angle) => {
        const x = centerScreen.x + Math.cos(angle) * radiusScreen;
        const y = centerScreen.y + Math.sin(angle) * radiusScreen;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    ctx.restore();
  }

  protected serializeData(): any {
    return {
      center: this.center.toArray(),
      radius: this.radius,
    };
  }

  static deserialize(data: any): Circle {
    const circle = new Circle(
      Vector2.fromArray(data.data.center),
      data.data.radius,
      data.properties.layer
    );
    if (data.properties.color) circle.setColor(data.properties.color);
    if (data.properties.lineWeight) circle.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) circle.setLineType(data.properties.lineType);
    circle.setVisible(data.properties.visible);
    circle.setLocked(data.properties.locked);
    return circle;
  }
}
