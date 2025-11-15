import { Vector2 } from '../Vector2';
import { Entity, EntityType, BoundingBox, TransformMatrix } from '../entities/Entity';
import { Layer } from '../LayerManager';
import { SnapPoint, SnapType } from '../SnapManager';
import { DimensionStyle } from './DimensionStyle';

/**
 * Dimension types
 */
export enum DimensionType {
  LINEAR = 'linear',
  ALIGNED = 'aligned',
  ANGULAR = 'angular',
  RADIAL = 'radial',
  DIAMETER = 'diameter',
}

/**
 * Dimension - Base class for all dimension entities
 */
export abstract class Dimension extends Entity {
  protected dimensionType: DimensionType;
  protected style: DimensionStyle;
  protected measurement: number = 0;
  protected overrideText: string | null = null;

  constructor(dimensionType: DimensionType, style: DimensionStyle, layer: string = 'A-DIMS') {
    super(EntityType.DIMENSION, layer);
    this.dimensionType = dimensionType;
    this.style = { ...style };
  }

  /**
   * Get dimension type
   */
  getDimensionType(): DimensionType {
    return this.dimensionType;
  }

  /**
   * Get dimension style
   */
  getStyle(): DimensionStyle {
    return { ...this.style };
  }

  /**
   * Set dimension style
   */
  setStyle(style: DimensionStyle): void {
    this.style = { ...style };
    this.markBoundingBoxDirty();
  }

  /**
   * Get measurement value
   */
  getMeasurement(): number {
    return this.measurement;
  }

  /**
   * Get formatted text
   */
  getText(): string {
    if (this.overrideText) {
      return this.overrideText;
    }
    return this.formatMeasurement();
  }

  /**
   * Set override text
   */
  setOverrideText(text: string | null): void {
    this.overrideText = text;
  }

  /**
   * Format measurement based on style
   */
  protected formatMeasurement(): string {
    const value = this.measurement;
    const style = this.style;

    switch (style.unitFormat) {
      case 'architectural':
        return this.formatArchitectural(value);
      case 'fractional':
        return this.formatFractional(value);
      default:
        return this.formatDecimal(value);
    }
  }

  private formatDecimal(value: number): string {
    let formatted = value.toFixed(this.style.precision);
    if (this.style.suppressZeros) {
      formatted = formatted.replace(/\.?0+$/, '');
    }
    if (this.style.showUnits) {
      formatted += ` ${this.style.units}`;
    }
    return formatted;
  }

  private formatArchitectural(valueInMeters: number): string {
    const totalInches = valueInMeters * 39.3701;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    const inchesRounded = Math.round(inches * Math.pow(10, this.style.precision)) / Math.pow(10, this.style.precision);

    if (feet === 0) return `${inchesRounded}"`;
    if (inchesRounded === 0) return `${feet}'`;
    return `${feet}'-${inchesRounded}"`;
  }

  private formatFractional(value: number): string {
    const precision = Math.pow(2, this.style.precision + 2);
    const whole = Math.floor(value);
    const fraction = value - whole;
    const numerator = Math.round(fraction * precision);

    if (numerator === 0) return `${whole}`;
    if (numerator === precision) return `${whole + 1}`;

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(numerator, precision);
    const simplifiedNum = numerator / divisor;
    const simplifiedDen = precision / divisor;

    if (whole === 0) return `${simplifiedNum}/${simplifiedDen}`;
    return `${whole} ${simplifiedNum}/${simplifiedDen}`;
  }

  /**
   * Render dimension arrow
   */
  protected renderArrow(
    ctx: CanvasRenderingContext2D,
    position: Vector2,
    direction: Vector2,
    worldToScreen: (p: Vector2) => Vector2
  ): void {
    const posScreen = worldToScreen(position);
    const size = this.style.arrowSize * 2; // Scale for visibility

    ctx.save();
    ctx.fillStyle = this.style.dimLineColor;
    ctx.strokeStyle = this.style.dimLineColor;

    switch (this.style.arrowType) {
      case 'arrow':
        this.renderArrowHead(ctx, posScreen, direction, size);
        break;
      case 'tick':
        this.renderTick(ctx, posScreen, direction, size);
        break;
      case 'dot':
        this.renderDot(ctx, posScreen, size);
        break;
    }

    ctx.restore();
  }

  private renderArrowHead(ctx: CanvasRenderingContext2D, pos: Vector2, dir: Vector2, size: number): void {
    const angle = Math.atan2(-dir.y, dir.x); // Negate Y for screen coordinates
    const perpAngle1 = angle + (150 * Math.PI) / 180;
    const perpAngle2 = angle - (150 * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(perpAngle1) * size, pos.y - Math.sin(perpAngle1) * size);
    ctx.lineTo(pos.x + Math.cos(perpAngle2) * size, pos.y - Math.sin(perpAngle2) * size);
    ctx.closePath();
    ctx.fill();
  }

  private renderTick(ctx: CanvasRenderingContext2D, pos: Vector2, dir: Vector2, size: number): void {
    const angle = Math.atan2(-dir.y, dir.x);
    const tickAngle = angle + Math.PI / 4;

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      pos.x - Math.cos(tickAngle) * size,
      pos.y + Math.sin(tickAngle) * size
    );
    ctx.lineTo(
      pos.x + Math.cos(tickAngle) * size,
      pos.y - Math.sin(tickAngle) * size
    );
    ctx.stroke();
  }

  private renderDot(ctx: CanvasRenderingContext2D, pos: Vector2, size: number): void {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render dimension text
   */
  protected renderText(
    ctx: CanvasRenderingContext2D,
    position: Vector2,
    worldToScreen: (p: Vector2) => Vector2
  ): void {
    const posScreen = worldToScreen(position);
    const text = this.getText();

    ctx.save();
    ctx.fillStyle = this.style.textColor;
    ctx.font = `${this.style.textHeight * 3}px ${this.style.textFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background
    const metrics = ctx.measureText(text);
    const padding = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(
      posScreen.x - metrics.width / 2 - padding,
      posScreen.y - this.style.textHeight * 1.5 - padding,
      metrics.width + padding * 2,
      this.style.textHeight * 3 + padding * 2
    );

    // Text
    ctx.fillStyle = this.style.textColor;
    ctx.fillText(text, posScreen.x, posScreen.y);

    ctx.restore();
  }

  /**
   * Calculate dimension measurement (to be implemented by subclasses)
   */
  protected abstract calculateMeasurement(): number;

  /**
   * Update measurement
   */
  protected updateMeasurement(): void {
    this.measurement = this.calculateMeasurement();
  }

  // Implement abstract methods from Entity
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    return []; // Dimensions typically don't provide snap points
  }

  distanceToPoint(point: Vector2): number {
    return Infinity; // Dimensions are not selectable by point
  }

  getNearestPoint(point: Vector2): Vector2 {
    return point.clone();
  }

  containsPoint(point: Vector2, tolerance: number): boolean {
    return false;
  }

  intersectsRectangle(min: Vector2, max: Vector2): boolean {
    const bbox = this.getBoundingBox();
    return !(
      bbox.max.x < min.x ||
      bbox.min.x > max.x ||
      bbox.max.y < min.y ||
      bbox.min.y > max.y
    );
  }
}
