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
 * Text alignment
 */
export enum TextAlignment {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
  TOP_LEFT = 'top-left',
  TOP_CENTER = 'top-center',
  TOP_RIGHT = 'top-right',
  MIDDLE_LEFT = 'middle-left',
  MIDDLE_CENTER = 'middle-center',
  MIDDLE_RIGHT = 'middle-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_CENTER = 'bottom-center',
  BOTTOM_RIGHT = 'bottom-right',
}

/**
 * Text entity
 */
export class Text extends Entity {
  private position: Vector2;
  private text: string;
  private height: number;
  private rotation: number; // In radians
  private alignment: TextAlignment;
  private fontFamily: string;
  private bold: boolean;
  private italic: boolean;

  constructor(
    position: Vector2,
    text: string,
    height: number = 10,
    layer: string = 'A-ANNO-TEXT'
  ) {
    super(EntityType.TEXT, layer);
    this.position = position.clone();
    this.text = text;
    this.height = height;
    this.rotation = 0;
    this.alignment = TextAlignment.LEFT;
    this.fontFamily = 'Arial';
    this.bold = false;
    this.italic = false;
  }

  /**
   * Get position
   */
  getPosition(): Vector2 {
    return this.position.clone();
  }

  /**
   * Set position
   */
  setPosition(position: Vector2): void {
    this.position = position.clone();
    this.markBoundingBoxDirty();
  }

  /**
   * Get text content
   */
  getText(): string {
    return this.text;
  }

  /**
   * Set text content
   */
  setText(text: string): void {
    this.text = text;
    this.markBoundingBoxDirty();
  }

  /**
   * Get height
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Set height
   */
  setHeight(height: number): void {
    this.height = height;
    this.markBoundingBoxDirty();
  }

  /**
   * Get rotation (radians)
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set rotation (radians)
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
    this.markBoundingBoxDirty();
  }

  /**
   * Get alignment
   */
  getAlignment(): TextAlignment {
    return this.alignment;
  }

  /**
   * Set alignment
   */
  setAlignment(alignment: TextAlignment): void {
    this.alignment = alignment;
    this.markBoundingBoxDirty();
  }

  /**
   * Get font family
   */
  getFontFamily(): string {
    return this.fontFamily;
  }

  /**
   * Set font family
   */
  setFontFamily(fontFamily: string): void {
    this.fontFamily = fontFamily;
    this.markBoundingBoxDirty();
  }

  /**
   * Is bold
   */
  isBold(): boolean {
    return this.bold;
  }

  /**
   * Set bold
   */
  setBold(bold: boolean): void {
    this.bold = bold;
    this.markBoundingBoxDirty();
  }

  /**
   * Is italic
   */
  isItalic(): boolean {
    return this.italic;
  }

  /**
   * Set italic
   */
  setItalic(italic: boolean): void {
    this.italic = italic;
    this.markBoundingBoxDirty();
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    // Approximate text width (will be more accurate in render context)
    const approxWidth = this.text.length * this.height * 0.6;
    const approxHeight = this.height * 1.2;

    // Get alignment offset
    const offset = this.getAlignmentOffset(approxWidth, approxHeight);

    // Calculate corners
    const corners = [
      new Vector2(offset.x, offset.y),
      new Vector2(offset.x + approxWidth, offset.y),
      new Vector2(offset.x + approxWidth, offset.y + approxHeight),
      new Vector2(offset.x, offset.y + approxHeight),
    ];

    // Rotate corners if needed
    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);

      for (const corner of corners) {
        const x = corner.x;
        const y = corner.y;
        corner.x = x * cos - y * sin;
        corner.y = x * sin + y * cos;
      }
    }

    // Translate to position
    for (const corner of corners) {
      corner.add(this.position);
    }

    // Find min/max
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);

    return {
      min: new Vector2(Math.min(...xs), Math.min(...ys)),
      max: new Vector2(Math.max(...xs), Math.max(...ys)),
    };
  }

  /**
   * Get alignment offset
   */
  private getAlignmentOffset(width: number, height: number): Vector2 {
    const offset = new Vector2(0, 0);

    // Horizontal alignment
    if (
      this.alignment.includes('center') ||
      this.alignment.includes('middle')
    ) {
      offset.x = -width / 2;
    } else if (this.alignment.includes('right')) {
      offset.x = -width;
    }

    // Vertical alignment
    if (this.alignment.includes('top')) {
      offset.y = 0;
    } else if (this.alignment.includes('middle')) {
      offset.y = -height / 2;
    } else if (this.alignment.includes('bottom')) {
      offset.y = -height;
    }

    return offset;
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      points.push({ point: this.position.clone(), type: SnapType.ENDPOINT, entity: this });
    }

    return points;
  }

  /**
   * Get distance to point
   */
  distanceToPoint(point: Vector2): number {
    const bbox = this.getBoundingBox();

    // If point is inside bbox, distance is 0
    if (
      point.x >= bbox.min.x &&
      point.x <= bbox.max.x &&
      point.y >= bbox.min.y &&
      point.y <= bbox.max.y
    ) {
      return 0;
    }

    // Calculate distance to closest edge
    const dx = Math.max(bbox.min.x - point.x, 0, point.x - bbox.max.x);
    const dy = Math.max(bbox.min.y - point.y, 0, point.y - bbox.max.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get nearest point
   */
  getNearestPoint(point: Vector2): Vector2 {
    return this.position.clone();
  }

  /**
   * Contains point
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    return this.distanceToPoint(point) <= tolerance;
  }

  /**
   * Intersects rectangle
   */
  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    const bbox = this.getBoundingBox();
    return !(
      bbox.max.x < min.x ||
      bbox.min.x > max.x ||
      bbox.max.y < min.y ||
      bbox.min.y > max.y
    );
  }

  /**
   * Transform
   */
  transform(matrix: TransformMatrix): void {
    this.position = transformPoint(this.position, matrix);

    // Extract rotation from matrix
    const angle = Math.atan2(matrix.b, matrix.a);
    this.rotation += angle;

    // Extract scale
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    this.height *= scaleX;

    this.markBoundingBoxDirty();
  }

  /**
   * Clone
   */
  clone(): Text {
    const text = new Text(this.position, this.text, this.height, this.getLayer());
    text.setRotation(this.rotation);
    text.setAlignment(this.alignment);
    text.setFontFamily(this.fontFamily);
    text.setBold(this.bold);
    text.setItalic(this.italic);
    text.setColor(this.getColor());
    text.setLineWeight(this.getLineWeight());
    text.setVisible(this.isVisible());
    text.setLocked(this.isLocked());
    return text;
  }

  /**
   * Render
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible() || !this.text) return;

    const posScreen = worldToScreen(this.position);

    ctx.save();

    // Transform for rotation
    ctx.translate(posScreen.x, posScreen.y);
    ctx.rotate(this.rotation);

    // Set font
    const weight = this.bold ? 'bold' : 'normal';
    const style = this.italic ? 'italic' : 'normal';
    ctx.font = `${style} ${weight} ${this.height * 2}px ${this.fontFamily}`;

    // Set text alignment
    if (this.alignment.includes('center')) {
      ctx.textAlign = 'center';
    } else if (this.alignment.includes('right')) {
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }

    if (this.alignment.includes('top')) {
      ctx.textBaseline = 'top';
    } else if (this.alignment.includes('middle')) {
      ctx.textBaseline = 'middle';
    } else if (this.alignment.includes('bottom')) {
      ctx.textBaseline = 'bottom';
    } else {
      ctx.textBaseline = 'alphabetic';
    }

    // Set color
    const color = this.getColor() || layer?.color || '#ffffff';
    ctx.fillStyle = this.isSelected() ? '#4a9eff' : color;

    // Draw text
    ctx.fillText(this.text, 0, 0);

    // Draw selection box
    if (this.isSelected()) {
      const metrics = ctx.measureText(this.text);
      const width = metrics.width;
      const height = this.height * 2;

      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      const offset = this.getAlignmentOffset(width, height);
      ctx.strokeRect(offset.x, offset.y, width, height);
    }

    ctx.restore();
  }

  /**
   * Serialize
   */
  protected serializeData(): any {
    return {
      position: this.position.toArray(),
      text: this.text,
      height: this.height,
      rotation: this.rotation,
      alignment: this.alignment,
      fontFamily: this.fontFamily,
      bold: this.bold,
      italic: this.italic,
    };
  }

  /**
   * Deserialize
   */
  static deserialize(data: any): Text {
    const text = new Text(
      Vector2.fromArray(data.data.position),
      data.data.text,
      data.data.height,
      data.properties.layer
    );

    text.setRotation(data.data.rotation || 0);
    text.setAlignment(data.data.alignment || TextAlignment.LEFT);
    text.setFontFamily(data.data.fontFamily || 'Arial');
    text.setBold(data.data.bold || false);
    text.setItalic(data.data.italic || false);

    if (data.properties.color) text.setColor(data.properties.color);
    text.setVisible(data.properties.visible);
    text.setLocked(data.properties.locked);

    return text;
  }
}
