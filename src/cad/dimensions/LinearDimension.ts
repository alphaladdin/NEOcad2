import { Vector2 } from '../Vector2';
import { Layer } from '../LayerManager';
import { Dimension, DimensionType } from './Dimension';
import { DimensionStyle } from './DimensionStyle';
import { BoundingBox, TransformMatrix, transformPoint } from '../entities/Entity';

/**
 * LinearDimension - Horizontal or vertical dimension
 */
export class LinearDimension extends Dimension {
  private point1: Vector2;
  private point2: Vector2;
  private dimLinePosition: Vector2; // Position of dimension line
  private isHorizontal: boolean;

  constructor(
    point1: Vector2,
    point2: Vector2,
    dimLinePosition: Vector2,
    isHorizontal: boolean,
    style: DimensionStyle,
    layer: string = 'A-DIMS'
  ) {
    super(DimensionType.LINEAR, style, layer);
    this.point1 = point1.clone();
    this.point2 = point2.clone();
    this.dimLinePosition = dimLinePosition.clone();
    this.isHorizontal = isHorizontal;
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
   * Get dimension line position
   */
  getDimLinePosition(): Vector2 {
    return this.dimLinePosition.clone();
  }

  /**
   * Set dimension line position
   */
  setDimLinePosition(position: Vector2): void {
    this.dimLinePosition = position.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Calculate measurement
   */
  protected calculateMeasurement(): number {
    if (this.isHorizontal) {
      return Math.abs(this.point2.x - this.point1.x);
    } else {
      return Math.abs(this.point2.y - this.point1.y);
    }
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    const points = [
      this.point1,
      this.point2,
      this.dimLinePosition,
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
    this.dimLinePosition = transformPoint(this.dimLinePosition, matrix);
    this.updateMeasurement();
    this.markBoundingBoxDirty();
  }

  /**
   * Clone dimension
   */
  clone(): LinearDimension {
    const dim = new LinearDimension(
      this.point1,
      this.point2,
      this.dimLinePosition,
      this.isHorizontal,
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

    // Calculate extension line endpoints
    let ext1Start, ext1End, ext2Start, ext2End, dimStart, dimEnd, textPos;

    if (this.isHorizontal) {
      // Horizontal dimension
      const dimY = this.dimLinePosition.y;

      ext1Start = new Vector2(this.point1.x, this.point1.y);
      ext1End = new Vector2(this.point1.x, dimY + this.style.extLineExtend);

      ext2Start = new Vector2(this.point2.x, this.point2.y);
      ext2End = new Vector2(this.point2.x, dimY + this.style.extLineExtend);

      dimStart = new Vector2(this.point1.x, dimY);
      dimEnd = new Vector2(this.point2.x, dimY);

      textPos = new Vector2((this.point1.x + this.point2.x) / 2, dimY);
    } else {
      // Vertical dimension
      const dimX = this.dimLinePosition.x;

      ext1Start = new Vector2(this.point1.x, this.point1.y);
      ext1End = new Vector2(dimX + this.style.extLineExtend, this.point1.y);

      ext2Start = new Vector2(this.point2.x, this.point2.y);
      ext2End = new Vector2(dimX + this.style.extLineExtend, this.point2.y);

      dimStart = new Vector2(dimX, this.point1.y);
      dimEnd = new Vector2(dimX, this.point2.y);

      textPos = new Vector2(dimX, (this.point1.y + this.point2.y) / 2);
    }

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

    // Render text
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
      dimLinePosition: this.dimLinePosition.toArray(),
      isHorizontal: this.isHorizontal,
      style: this.style,
      overrideText: this.overrideText,
    };
  }

  /**
   * Deserialize
   */
  static deserialize(data: any, style: DimensionStyle): LinearDimension {
    return new LinearDimension(
      Vector2.fromArray(data.data.point1),
      Vector2.fromArray(data.data.point2),
      Vector2.fromArray(data.data.dimLinePosition),
      data.data.isHorizontal,
      data.data.style || style,
      data.properties.layer
    );
  }
}
