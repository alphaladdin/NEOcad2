import { Vector2 } from './Vector2';

/**
 * Polar tracking configuration
 */
export interface PolarTrackingConfig {
  enabled: boolean;
  increment: number; // Angle increment in degrees (e.g., 45, 30, 15)
  snapDistance: number; // Snap distance in world units
  showGuides: boolean;
  guideLength: number; // Length of guide lines in screen pixels
  guideColor: string;
  guideWidth: number;
  showAngleLabel: boolean;
}

/**
 * Polar tracking result
 */
export interface PolarTrackingResult {
  point: Vector2;
  angle: number; // Angle in radians
  angleDegrees: number; // Angle in degrees
  basePoint: Vector2;
  snapped: boolean;
}

/**
 * PolarTrackingManager - Provides angular constraints for drawing
 * Similar to AutoCAD's polar tracking feature
 */
export class PolarTrackingManager {
  private config: PolarTrackingConfig;
  private basePoint: Vector2 | null = null;
  private lastResult: PolarTrackingResult | null = null;

  constructor(config?: Partial<PolarTrackingConfig>) {
    this.config = {
      enabled: true,
      increment: 45, // 45° increments by default
      snapDistance: 0.1, // 0.1 unit snap distance
      showGuides: true,
      guideLength: 1000, // pixels
      guideColor: 'rgba(255, 255, 0, 0.5)',
      guideWidth: 1,
      showAngleLabel: true,
      ...config,
    };
  }

  /**
   * Set the base point for polar tracking
   */
  setBasePoint(point: Vector2 | null): void {
    this.basePoint = point;
  }

  /**
   * Get the base point
   */
  getBasePoint(): Vector2 | null {
    return this.basePoint;
  }

  /**
   * Apply polar tracking to a cursor position
   */
  track(
    cursorWorld: Vector2,
    basePoint?: Vector2
  ): PolarTrackingResult | null {
    if (!this.config.enabled) return null;

    const base = basePoint || this.basePoint;
    if (!base) return null;

    // Calculate angle from base point to cursor
    const direction = Vector2.fromPoints(base, cursorWorld);
    const distance = direction.length();

    if (distance < 0.001) {
      return null;
    }

    const angle = direction.angle();
    const angleDegrees = (angle * 180) / Math.PI;

    // Find nearest increment angle
    const incrementRadians = (this.config.increment * Math.PI) / 180;
    const snappedAngle = Math.round(angle / incrementRadians) * incrementRadians;
    const snappedAngleDegrees = (snappedAngle * 180) / Math.PI;

    // Calculate angular difference
    const angleDiff = Math.abs(angle - snappedAngle);
    const angleDiffDegrees = (angleDiff * 180) / Math.PI;

    // Check if we should snap (within tolerance)
    const snapTolerance = (this.config.increment / 4) * (Math.PI / 180); // 1/4 of increment
    const shouldSnap = angleDiff < snapTolerance;

    let resultPoint: Vector2;
    let resultAngle: number;

    if (shouldSnap) {
      // Snap to polar angle, maintain distance
      resultPoint = base.clone().add(
        Vector2.fromAngle(snappedAngle, distance)
      );
      resultAngle = snappedAngle;
    } else {
      // No snap, use original point
      resultPoint = cursorWorld.clone();
      resultAngle = angle;
    }

    const result: PolarTrackingResult = {
      point: resultPoint,
      angle: resultAngle,
      angleDegrees: (resultAngle * 180) / Math.PI,
      basePoint: base.clone(),
      snapped: shouldSnap,
    };

    this.lastResult = result;
    return result;
  }

  /**
   * Get the last tracking result
   */
  getLastResult(): PolarTrackingResult | null {
    return this.lastResult;
  }

  /**
   * Enable/disable polar tracking
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if polar tracking is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set angle increment
   */
  setIncrement(degrees: number): void {
    this.config.increment = degrees;
  }

  /**
   * Get angle increment
   */
  getIncrement(): number {
    return this.config.increment;
  }

  /**
   * Set common angle increments (90, 45, 30, 15, 10, 5)
   */
  setStandardIncrement(degrees: 90 | 45 | 30 | 15 | 10 | 5): void {
    this.config.increment = degrees;
  }

  /**
   * Get configuration
   */
  getConfig(): PolarTrackingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PolarTrackingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Render polar tracking guides
   */
  renderGuides(
    ctx: CanvasRenderingContext2D,
    result: PolarTrackingResult,
    worldToScreen: (point: Vector2) => Vector2,
    viewBounds: { min: Vector2; max: Vector2 }
  ): void {
    if (!this.config.showGuides || !result.snapped) return;

    const baseScreen = worldToScreen(result.basePoint);
    const cursorScreen = worldToScreen(result.point);

    ctx.save();
    ctx.strokeStyle = this.config.guideColor;
    ctx.lineWidth = this.config.guideWidth;
    ctx.setLineDash([5, 5]);

    // Draw guide line from base point in the snapped direction
    const direction = new Vector2(
      Math.cos(result.angle),
      Math.sin(result.angle)
    );

    // Calculate where guide line intersects view bounds
    const guideStart = result.basePoint.clone();
    const guideEnd = result.basePoint.clone().add(
      direction.clone().multiplyScalar(1000) // Very long line
    );

    const startScreen = worldToScreen(guideStart);
    const endScreen = worldToScreen(guideEnd);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    // Draw guide line in opposite direction
    const guideEndOpposite = result.basePoint.clone().add(
      direction.clone().multiplyScalar(-1000)
    );
    const endScreenOpposite = worldToScreen(guideEndOpposite);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreenOpposite.x, endScreenOpposite.y);
    ctx.stroke();

    ctx.restore();

    // Draw angle label
    if (this.config.showAngleLabel) {
      this.renderAngleLabel(ctx, result, cursorScreen);
    }

    // Draw cursor indicator
    this.renderCursorIndicator(ctx, cursorScreen);
  }

  /**
   * Render angle label
   */
  private renderAngleLabel(
    ctx: CanvasRenderingContext2D,
    result: PolarTrackingResult,
    screenPos: Vector2
  ): void {
    // Normalize angle to 0-360 range
    let displayAngle = result.angleDegrees;
    while (displayAngle < 0) displayAngle += 360;
    while (displayAngle >= 360) displayAngle -= 360;

    const label = `${displayAngle.toFixed(0)}°`;
    const padding = 6;
    const offset = 20;

    ctx.save();
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metrics = ctx.measureText(label);
    const width = metrics.width + padding * 2;
    const height = 18;

    // Position label near cursor
    const labelX = screenPos.x + offset;
    const labelY = screenPos.y - offset;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.fillRect(labelX, labelY - height, width, height);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX, labelY - height, width, height);

    // Text
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, labelX + padding, labelY - height + padding);

    ctx.restore();
  }

  /**
   * Render cursor indicator for polar tracking
   */
  private renderCursorIndicator(
    ctx: CanvasRenderingContext2D,
    screenPos: Vector2
  ): void {
    const size = 6;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;

    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(screenPos.x - size, screenPos.y);
    ctx.lineTo(screenPos.x + size, screenPos.y);
    ctx.moveTo(screenPos.x, screenPos.y - size);
    ctx.lineTo(screenPos.x, screenPos.y + size);
    ctx.stroke();

    // Draw circle
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Get all snap angles in radians
   */
  getSnapAngles(): number[] {
    const angles: number[] = [];
    const incrementRadians = (this.config.increment * Math.PI) / 180;
    const count = Math.floor((2 * Math.PI) / incrementRadians);

    for (let i = 0; i < count; i++) {
      angles.push(i * incrementRadians);
    }

    return angles;
  }

  /**
   * Check if an angle is near a snap angle
   */
  isNearSnapAngle(angle: number): boolean {
    const incrementRadians = (this.config.increment * Math.PI) / 180;
    const snappedAngle = Math.round(angle / incrementRadians) * incrementRadians;
    const angleDiff = Math.abs(angle - snappedAngle);
    const snapTolerance = (this.config.increment / 4) * (Math.PI / 180);

    return angleDiff < snapTolerance;
  }

  /**
   * Calculate distance from point to cursor
   */
  calculateDistance(result: PolarTrackingResult, cursor: Vector2): number {
    return result.basePoint.distanceTo(cursor);
  }

  /**
   * Render all snap angle guides from base point
   */
  renderAllSnapAngles(
    ctx: CanvasRenderingContext2D,
    basePoint: Vector2,
    worldToScreen: (point: Vector2) => Vector2,
    radius: number = 50
  ): void {
    if (!this.config.enabled || !this.config.showGuides) return;

    const angles = this.getSnapAngles();
    const baseScreen = worldToScreen(basePoint);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    angles.forEach((angle) => {
      const endScreen = new Vector2(
        baseScreen.x + Math.cos(angle) * radius,
        baseScreen.y - Math.sin(angle) * radius // Negate for screen Y
      );

      ctx.beginPath();
      ctx.moveTo(baseScreen.x, baseScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();
    });

    ctx.restore();
  }
}
