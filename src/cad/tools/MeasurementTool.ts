import { Vector2 } from '../Vector2';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';
import { UnitsConverter } from '../utils/UnitsConverter';
import { DrawingUnits } from '../document/Drawing';

/**
 * Measurement mode
 */
export enum MeasurementMode {
  DISTANCE = 'distance',
  AREA = 'area',
  ANGLE = 'angle',
  RADIUS = 'radius',
}

/**
 * MeasurementTool - Measure distances, areas, and angles
 */
export class MeasurementTool extends DrawingTool {
  private mode: MeasurementMode = MeasurementMode.DISTANCE;
  private points: Vector2[] = [];
  private currentPoint: Vector2 | null = null;
  private units: DrawingUnits = DrawingUnits.MILLIMETERS;
  private measurements: string[] = [];

  constructor(
    viewport: any,
    snapManager: any,
    polarTracking: any,
    dynamicInput: any,
    mode: MeasurementMode = MeasurementMode.DISTANCE
  ) {
    super(viewport, snapManager, polarTracking, dynamicInput);
    this.mode = mode;
  }

  getName(): string {
    return `Measure ${this.mode}`;
  }

  getDescription(): string {
    switch (this.mode) {
      case MeasurementMode.DISTANCE:
        return 'Measure distance between points';
      case MeasurementMode.AREA:
        return 'Measure area of polygon';
      case MeasurementMode.ANGLE:
        return 'Measure angle between lines';
      case MeasurementMode.RADIUS:
        return 'Measure radius/diameter of circles';
    }
  }

  getPrompt(): string {
    switch (this.mode) {
      case MeasurementMode.DISTANCE:
        if (this.points.length === 0) return 'Specify first point';
        if (this.points.length === 1) return 'Specify second point';
        return 'Specify next point or press Enter to finish';

      case MeasurementMode.AREA:
        if (this.points.length < 3) return `Specify point ${this.points.length + 1}`;
        return 'Specify next point or press Enter to calculate area';

      case MeasurementMode.ANGLE:
        if (this.points.length === 0) return 'Specify angle vertex';
        if (this.points.length === 1) return 'Specify first point';
        return 'Specify second point';

      case MeasurementMode.RADIUS:
        return 'Click on a circle or arc';
    }
  }

  setMode(mode: MeasurementMode): void {
    this.mode = mode;
    this.reset();
  }

  setUnits(units: DrawingUnits): void {
    this.units = units;
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return;

    const snappedPoint = this.applySnap(event.worldPos);

    switch (this.mode) {
      case MeasurementMode.DISTANCE:
        this.handleDistanceClick(snappedPoint);
        break;

      case MeasurementMode.AREA:
        this.handleAreaClick(snappedPoint);
        break;

      case MeasurementMode.ANGLE:
        this.handleAngleClick(snappedPoint);
        break;

      case MeasurementMode.RADIUS:
        this.handleRadiusClick(snappedPoint);
        break;
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    this.currentPoint = this.applySnap(event.worldPos);
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used
  }

  onKeyDown(event: KeyEventData): boolean {
    // Enter to finish measurement
    if (event.key === 'Enter') {
      if (this.mode === MeasurementMode.DISTANCE && this.points.length >= 2) {
        this.finishDistanceMeasurement();
      } else if (this.mode === MeasurementMode.AREA && this.points.length >= 3) {
        this.finishAreaMeasurement();
      }
      return true;
    }

    return super.onKeyDown(event);
  }

  private handleDistanceClick(point: Vector2): void {
    this.points.push(point);

    if (this.points.length >= 2) {
      this.calculateDistance();
    }

    this.state = ToolState.PREVIEW;
  }

  private handleAreaClick(point: Vector2): void {
    this.points.push(point);
    this.state = ToolState.PREVIEW;
  }

  private handleAngleClick(point: Vector2): void {
    this.points.push(point);

    if (this.points.length === 3) {
      this.calculateAngle();
      this.reset();
    }

    this.state = ToolState.PREVIEW;
  }

  private handleRadiusClick(point: Vector2): void {
    // In a real implementation, would check for circle/arc at point
    console.log('Radius measurement at:', point);
    this.reset();
  }

  private calculateDistance(): void {
    if (this.points.length < 2) return;

    let totalDistance = 0;
    const segments: string[] = [];

    for (let i = 0; i < this.points.length - 1; i++) {
      const distance = this.points[i].distanceTo(this.points[i + 1]);
      totalDistance += distance;
      segments.push(
        `Segment ${i + 1}: ${UnitsConverter.format(distance, this.units, 3)}`
      );
    }

    this.measurements = [
      `Total Distance: ${UnitsConverter.format(totalDistance, this.units, 3)}`,
      ...segments,
    ];
  }

  private finishDistanceMeasurement(): void {
    this.calculateDistance();
    this.complete();
  }

  private finishAreaMeasurement(): void {
    this.calculateArea();
    this.complete();
  }

  private calculateArea(): void {
    if (this.points.length < 3) return;

    // Calculate area using shoelace formula
    let area = 0;
    for (let i = 0; i < this.points.length; i++) {
      const j = (i + 1) % this.points.length;
      area += this.points[i].x * this.points[j].y;
      area -= this.points[j].x * this.points[i].y;
    }
    area = Math.abs(area / 2);

    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < this.points.length; i++) {
      const j = (i + 1) % this.points.length;
      perimeter += this.points[i].distanceTo(this.points[j]);
    }

    this.measurements = [
      `Area: ${UnitsConverter.formatArea(area, this.units, 3)}`,
      `Perimeter: ${UnitsConverter.format(perimeter, this.units, 3)}`,
      `Points: ${this.points.length}`,
    ];
  }

  private calculateAngle(): void {
    if (this.points.length !== 3) return;

    const vertex = this.points[0];
    const point1 = this.points[1];
    const point2 = this.points[2];

    const vector1 = Vector2.fromPoints(vertex, point1);
    const vector2 = Vector2.fromPoints(vertex, point2);

    const angle1 = Math.atan2(vector1.y, vector1.x);
    const angle2 = Math.atan2(vector2.y, vector2.x);

    let angle = angle2 - angle1;
    if (angle < 0) angle += 2 * Math.PI;

    const degrees = (angle * 180) / Math.PI;

    this.measurements = [
      `Angle: ${degrees.toFixed(2)}°`,
      `Radians: ${angle.toFixed(4)}`,
      `Complementary: ${(90 - (degrees % 90)).toFixed(2)}°`,
      `Supplementary: ${(180 - degrees).toFixed(2)}°`,
    ];
  }

  getMeasurements(): string[] {
    return [...this.measurements];
  }

  protected onReset(): void {
    this.points = [];
    this.currentPoint = null;
    this.measurements = [];
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    // Keep measurements visible, just reset points
    this.points = [];
    this.currentPoint = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const worldToScreen = (p: Vector2) => this.viewport.worldToScreen(p);

    ctx.save();

    // Draw points
    for (let i = 0; i < this.points.length; i++) {
      const pointScreen = worldToScreen(this.points[i]);

      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(pointScreen.x, pointScreen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw point number
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`${i + 1}`, pointScreen.x + 10, pointScreen.y - 10);
    }

    // Draw lines between points
    if (this.points.length > 0) {
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      const firstScreen = worldToScreen(this.points[0]);
      ctx.moveTo(firstScreen.x, firstScreen.y);

      for (let i = 1; i < this.points.length; i++) {
        const pointScreen = worldToScreen(this.points[i]);
        ctx.lineTo(pointScreen.x, pointScreen.y);
      }

      // Draw to current point
      if (this.currentPoint) {
        const currentScreen = worldToScreen(this.currentPoint);
        ctx.lineTo(currentScreen.x, currentScreen.y);

        // Close polygon for area mode
        if (this.mode === MeasurementMode.AREA && this.points.length >= 2) {
          ctx.lineTo(firstScreen.x, firstScreen.y);
        }
      }

      ctx.stroke();
    }

    // Draw measurements
    if (this.measurements.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(10, 10, 300, 30 + this.measurements.length * 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';

      for (let i = 0; i < this.measurements.length; i++) {
        ctx.fillText(this.measurements[i], 20, 30 + i * 20);
      }
    }

    // Draw current distance if in distance mode
    if (
      this.mode === MeasurementMode.DISTANCE &&
      this.points.length > 0 &&
      this.currentPoint
    ) {
      const lastPoint = this.points[this.points.length - 1];
      const distance = lastPoint.distanceTo(this.currentPoint);

      const midpoint = Vector2.lerp(lastPoint, this.currentPoint, 0.5);
      const midScreen = worldToScreen(midpoint);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(midScreen.x - 50, midScreen.y - 15, 100, 25);

      ctx.fillStyle = '#4a9eff';
      ctx.font = '12px monospace';
      const distText = UnitsConverter.format(distance, this.units, 2);
      ctx.fillText(distText, midScreen.x - 40, midScreen.y + 5);
    }

    ctx.restore();
  }
}
