import { Vector2 } from '../Vector2';
import { Layer } from '../LayerManager';
import { Dimension, DimensionType } from './Dimension';
import { DimensionStyle } from './DimensionStyle';
import { BoundingBox, TransformMatrix, transformPoint } from '../entities/Entity';

/**
 * AlignedDimension - Dimension aligned with two points
 * Measures the actual distance between two points
 */
export class AlignedDimension extends Dimension {
  private point1: Vector2;
  private point2: Vector2;
  private dimLineOffset: number; // Perpendicular offset from line between points

  constructor(
    point1: Vector2,
    point2: Vector2,
    dimLineOffset: number,
    style: DimensionStyle,
    layer: string = 'A-DIMS'
  ) {
    super(DimensionType.ALIGNED, style, layer);
    this.point1 = point1.clone();
    this.point2 = point2.clone();
    this.dimLineOffset = dimLineOffset;
    this.updateMeasurement();
  }

  /**
   * Get first point
   */
  getPoint1(): Vector2 {
    return this.point1.clone();
  }

  /**
   * Set first point
   */
  setPoint1(point: Vector2): void {
    this.point1 = point.clone();
    this.updateMeasurement();
    this.markBoundingBoxDirty();
  }

  /**
   * Get second point
   */
  getPoint2(): Vector2 {
    return this.point2.clone();
  }

  /**
   * Set second point
   */
  setPoint2(point: Vector2): void {
    this.point2 = point.clone();
    this.updateMeasurement();
    this.markBoundingBoxDirty();
  }

  /**
   * Get dimension line offset
   */
  getDimLineOffset(): number {
    return this.dimLineOffset;
  }

  /**
   * Set dimension line offset
   */
  setDimLineOffset(offset: number): void {
    this.dimLineOffset = offset;
    this.markBoundingBoxDirty();
  }

  /**
   * Calculate measurement (actual distance between points)
   */
  protected calculateMeasurement(): number {
    return this.point1.distanceTo(this.point2);
  }

  /**
   * Get the perpendicular direction for extension lines
   */
  private getPerpendicular(): Vector2 {
    const direction = Vector2.fromPoints(this.point1, this.point2);
    if (direction.length() === 0) {
      return new Vector2(0, 1);
    }
    // Rotate 90 degrees counterclockwise
    return new Vector2(-direction.y, direction.x).normalize();
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    const perpendicular = this.getPerpendicular();
    const offset = perpendicular.clone().multiplyScalar(this.dimLineOffset);

    const points = [
      this.point1,
      this.point2,
      this.point1.clone().add(offset),
      this.point2.clone().add(offset),
    ];

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    return {
      min: new Vector2(Math.min(...xs) - 5, Math.min(...ys) - 5),
      max: new Vector2(Math.max(...xs) + 5, Math.max(...ys) + 5),
    };
  }

  /**
   * Transform dimension
   */
  transform(matrix: TransformMatrix): void {
    this.point1 = transformPoint(this.point1, matrix);
    this.point2 = transformPoint(this.point2, matrix);
    // Scale offset by average scale factor
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
    this.dimLineOffset *= (scaleX + scaleY) / 2;
    this.updateMeasurement();
    this.markBoundingBoxDirty();
  }

  /**
   * Clone dimension
   */
  clone(): AlignedDimension {
    const dim = new AlignedDimension(
      this.point1,
      this.point2,
      this.dimLineOffset,
      this.style,
      this.getLayer()
    );
    dim.setOverrideText(this.overrideText);
    return dim;
  }

  /**
   * Render dimension
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible()) return;

    ctx.save();

    // Calculate perpendicular direction for offset
    const perpendicular = this.getPerpendicular();
    const offset = perpendicular.clone().multiplyScalar(this.dimLineOffset);

    // Calculate dimension line endpoints
    const dimStart = this.point1.clone().add(offset);
    const dimEnd = this.point2.clone().add(offset);

    // Calculate extension line endpoints
    const extLineExtend = perpendicular.clone().multiplyScalar(this.style.extLineExtend);

    const ext1Start = this.point1.clone();
    const ext1End = dimStart.clone().add(extLineExtend);

    const ext2Start = this.point2.clone();
    const ext2End = dimEnd.clone().add(extLineExtend);

    // Render extension lines
    ctx.strokeStyle = this.style.extLineColor;
    ctx.lineWidth = this.style.extLineWeight * 2;

    const ext1StartScreen = worldToScreen(ext1Start);
    const ext1EndScreen = worldToScreen(ext1End);
    ctx.beginPath();
    ctx.moveTo(ext1StartScreen.x, ext1StartScreen.y);
    ctx.lineTo(ext1EndScreen.x, ext1EndScreen.y);
    ctx.stroke();

    const ext2StartScreen = worldToScreen(ext2Start);
    const ext2EndScreen = worldToScreen(ext2End);
    ctx.beginPath();
    ctx.moveTo(ext2StartScreen.x, ext2StartScreen.y);
    ctx.lineTo(ext2EndScreen.x, ext2EndScreen.y);
    ctx.stroke();

    // Render dimension line
    ctx.strokeStyle = this.style.dimLineColor;
    ctx.lineWidth = this.style.dimLineWeight * 2;

    const dimStartScreen = worldToScreen(dimStart);
    const dimEndScreen = worldToScreen(dimEnd);
    ctx.beginPath();
    ctx.moveTo(dimStartScreen.x, dimStartScreen.y);
    ctx.lineTo(dimEndScreen.x, dimEndScreen.y);
    ctx.stroke();

    // Render arrows
    const direction1 = Vector2.fromPoints(dimEnd, dimStart).normalize();
    const direction2 = Vector2.fromPoints(dimStart, dimEnd).normalize();

    this.renderArrow(ctx, dimStart, direction1, worldToScreen);
    this.renderArrow(ctx, dimEnd, direction2, worldToScreen);

    // Render text at midpoint
    const textPos = Vector2.lerp(dimStart, dimEnd, 0.5);
    this.renderText(ctx, textPos, worldToScreen);

    ctx.restore();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      dimensionType: this.dimensionType,
      point1: this.point1.toArray(),
      point2: this.point2.toArray(),
      dimLineOffset: this.dimLineOffset,
      style: this.style,
      overrideText: this.overrideText,
    };
  }

  /**
   * Deserialize
   */
  static deserialize(data: any, style: DimensionStyle): AlignedDimension {
    return new AlignedDimension(
      Vector2.fromArray(data.data.point1),
      Vector2.fromArray(data.data.point2),
      data.data.dimLineOffset,
      data.data.style || style,
      data.properties.layer
    );
  }
}
