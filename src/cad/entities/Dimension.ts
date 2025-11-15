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
 * Dimension type
 */
export enum DimensionType {
  LINEAR = 'linear',
  ALIGNED = 'aligned',
  ANGULAR = 'angular',
  RADIAL = 'radial',
  DIAMETER = 'diameter',
}

/**
 * Dimension entity - Shows measurements and annotations
 */
export class Dimension extends Entity {
  private startPoint: Vector2;
  private endPoint: Vector2;
  private textPosition: Vector2;
  private dimensionType: DimensionType;
  private textOverride: string | null = null;
  private arrowSize: number = 0.2; // Arrow size in world units
  private textHeight: number = 0.25; // Text height in world units
  private extensionLineOffset: number = 0.1; // Offset from measured points
  private extensionLineExtension: number = 0.2; // Extension beyond dimension line

  constructor(
    startPoint: Vector2,
    endPoint: Vector2,
    textPosition: Vector2,
    dimensionType: DimensionType = DimensionType.LINEAR,
    layer: string = 'A-ANNO-DIMS'
  ) {
    super(EntityType.DIMENSION, layer);
    this.startPoint = startPoint.clone();
    this.endPoint = endPoint.clone();
    this.textPosition = textPosition.clone();
    this.dimensionType = dimensionType;
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
   * Get text position
   */
  getTextPosition(): Vector2 {
    return this.textPosition.clone();
  }

  /**
   * Set text position
   */
  setTextPosition(point: Vector2): void {
    this.textPosition = point.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get dimension type
   */
  getDimensionType(): DimensionType {
    return this.dimensionType;
  }

  /**
   * Set text override (custom text instead of measured value)
   */
  setTextOverride(text: string | null): void {
    this.textOverride = text;
  }

  /**
   * Get text override
   */
  getTextOverride(): string | null {
    return this.textOverride;
  }

  /**
   * Get measured distance
   */
  getMeasuredDistance(): number {
    return this.startPoint.distanceTo(this.endPoint);
  }

  /**
   * Get dimension text (formatted measurement or override)
   */
  getDimensionText(): string {
    if (this.textOverride) {
      return this.textOverride;
    }

    const distance = this.getMeasuredDistance();

    // Format based on size
    if (distance >= 100) {
      return `${(distance / 12).toFixed(1)}'`; // Convert to feet
    } else if (distance >= 1) {
      return `${distance.toFixed(2)}"`; // Show in inches with 2 decimals
    } else {
      return `${distance.toFixed(3)}"`; // Show in inches with 3 decimals for small values
    }
  }

  /**
   * Set arrow size
   */
  setArrowSize(size: number): void {
    this.arrowSize = size;
  }

  /**
   * Get arrow size
   */
  getArrowSize(): number {
    return this.arrowSize;
  }

  /**
   * Set text height
   */
  setTextHeight(height: number): void {
    this.textHeight = height;
  }

  /**
   * Get text height
   */
  getTextHeight(): number {
    return this.textHeight;
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    const points = [this.startPoint, this.endPoint, this.textPosition];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    // Add padding for arrows and text
    const padding = Math.max(this.arrowSize, this.textHeight);

    return {
      min: new Vector2(minX - padding, minY - padding),
      max: new Vector2(maxX + padding, maxY + padding),
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
   * Get distance from point to dimension
   */
  distanceToPoint(point: Vector2): number {
    // Check distance to dimension line
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
   * Check if dimension contains point
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  /**
   * Transform dimension
   */
  transform(matrix: TransformMatrix): void {
    this.startPoint = transformPoint(this.startPoint, matrix);
    this.endPoint = transformPoint(this.endPoint, matrix);
    this.textPosition = transformPoint(this.textPosition, matrix);
    this.markBoundingBoxDirty();
  }

  /**
   * Clone dimension
   */
  clone(): Dimension {
    const dim = new Dimension(
      this.startPoint,
      this.endPoint,
      this.textPosition,
      this.dimensionType,
      this.getLayer()
    );
    dim.setColor(this.getColor());
    dim.setLineWeight(this.getLineWeight());
    dim.setLineType(this.getLineType() as any);
    dim.setVisible(this.isVisible());
    dim.setLocked(this.isLocked());
    dim.setTextOverride(this.textOverride);
    dim.setArrowSize(this.arrowSize);
    dim.setTextHeight(this.textHeight);
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

    const startScreen = worldToScreen(this.startPoint);
    const endScreen = worldToScreen(this.endPoint);
    const textPosScreen = worldToScreen(this.textPosition);

    ctx.save();

    // Apply line style
    const color = this.getColor() || layer?.color || '#00ff00';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;

    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.fillStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 1.5 : lineWeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';

    // Calculate dimension line direction
    const dimVector = new Vector2(
      endScreen.x - startScreen.x,
      endScreen.y - startScreen.y
    );
    const dimLength = Math.sqrt(dimVector.x * dimVector.x + dimVector.y * dimVector.y);

    if (dimLength > 0) {
      // Normalize
      dimVector.x /= dimLength;
      dimVector.y /= dimLength;

      // Calculate perpendicular vector
      const perpVector = new Vector2(-dimVector.y, dimVector.x);

      // Convert world units to screen units for arrows
      const arrowSizeScreen = this.arrowSize * 50; // Scale factor for screen

      // Draw extension lines
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(
        textPosScreen.x - dimVector.x * dimLength / 2,
        textPosScreen.y - dimVector.y * dimLength / 2
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endScreen.x, endScreen.y);
      ctx.lineTo(
        textPosScreen.x + dimVector.x * dimLength / 2,
        textPosScreen.y + dimVector.y * dimLength / 2
      );
      ctx.stroke();

      // Draw dimension line
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(
        textPosScreen.x - dimVector.x * dimLength / 2,
        textPosScreen.y - dimVector.y * dimLength / 2
      );
      ctx.lineTo(
        textPosScreen.x + dimVector.x * dimLength / 2,
        textPosScreen.y + dimVector.y * dimLength / 2
      );
      ctx.stroke();

      // Draw arrows
      this.drawArrow(
        ctx,
        textPosScreen.x - dimVector.x * dimLength / 2,
        textPosScreen.y - dimVector.y * dimLength / 2,
        dimVector.x,
        dimVector.y,
        arrowSizeScreen
      );

      this.drawArrow(
        ctx,
        textPosScreen.x + dimVector.x * dimLength / 2,
        textPosScreen.y + dimVector.y * dimLength / 2,
        -dimVector.x,
        -dimVector.y,
        arrowSizeScreen
      );

      // Draw text
      ctx.font = `${this.textHeight * 50}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = this.getDimensionText();
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = this.textHeight * 50;

      // Calculate text position offset from dimension line (perpendicular to line)
      const textOffset = textHeight * 0.8; // Offset distance in screen units
      const textX = textPosScreen.x + perpVector.x * textOffset;
      const textY = textPosScreen.y + perpVector.y * textOffset;

      // Draw text background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(
        textX - textWidth / 2 - 4,
        textY - textHeight / 2 - 2,
        textWidth + 8,
        textHeight + 4
      );

      // Draw text
      ctx.fillStyle = this.isSelected() ? '#4a9eff' : color;
      ctx.fillText(text, textX, textY);
    }

    ctx.restore();
  }

  /**
   * Draw an arrow
   */
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    size: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - dirX * size + dirY * size / 3,
      y - dirY * size - dirX * size / 3
    );
    ctx.lineTo(
      x - dirX * size - dirY * size / 3,
      y - dirY * size + dirX * size / 3
    );
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      startPoint: this.startPoint.toArray(),
      endPoint: this.endPoint.toArray(),
      textPosition: this.textPosition.toArray(),
      dimensionType: this.dimensionType,
      textOverride: this.textOverride,
      arrowSize: this.arrowSize,
      textHeight: this.textHeight,
    };
  }

  /**
   * Deserialize dimension
   */
  static deserialize(data: any): Dimension {
    const dim = new Dimension(
      Vector2.fromArray(data.data.startPoint),
      Vector2.fromArray(data.data.endPoint),
      Vector2.fromArray(data.data.textPosition),
      data.data.dimensionType,
      data.properties.layer
    );

    if (data.properties.color) dim.setColor(data.properties.color);
    if (data.properties.lineWeight) dim.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) dim.setLineType(data.properties.lineType);
    dim.setVisible(data.properties.visible);
    dim.setLocked(data.properties.locked);

    if (data.data.textOverride) dim.setTextOverride(data.data.textOverride);
    if (data.data.arrowSize) dim.setArrowSize(data.data.arrowSize);
    if (data.data.textHeight) dim.setTextHeight(data.data.textHeight);

    return dim;
  }
}
