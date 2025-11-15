import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * RotateTool - Rotate entities around a center point
 */
export class RotateTool extends DrawingTool {
  private entitiesToRotate: Entity[] = [];
  private centerPoint: Vector2 | null = null;
  private startPoint: Vector2 | null = null;
  private currentPoint: Vector2 | null = null;
  private copyMode: boolean = false;

  constructor(
    viewport: any,
    snapManager: any,
    polarTracking: any,
    dynamicInput: any,
    entities: Entity[]
  ) {
    super(viewport, snapManager, polarTracking, dynamicInput);
    this.entitiesToRotate = entities;
  }

  getName(): string {
    return 'Rotate';
  }

  getDescription(): string {
    return 'Rotate entities around a center point';
  }

  getPrompt(): string {
    if (!this.centerPoint) {
      return 'Specify rotation center';
    }
    if (!this.startPoint) {
      return 'Specify reference angle';
    }
    return this.copyMode ? 'Specify rotation angle (copying)' : 'Specify rotation angle';
  }

  setCopyMode(copy: boolean): void {
    this.copyMode = copy;
  }

  setEntitiesToRotate(entities: Entity[]): void {
    this.entitiesToRotate = entities;
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return;

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.centerPoint) {
      // First click - set center
      this.centerPoint = snappedPoint;
      this.polarTracking.setBasePoint(this.centerPoint);
      this.dynamicInput.setBasePoint(this.centerPoint);
      this.state = ToolState.PREVIEW;
    } else if (!this.startPoint) {
      // Second click - set reference angle
      this.startPoint = snappedPoint;
    } else {
      // Third click - complete rotation
      this.currentPoint = snappedPoint;
      this.completeRotation();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.centerPoint) return;

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.startPoint) {
      this.currentPoint = snappedPoint;
    } else {
      this.currentPoint = snappedPoint;
    }

    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used
  }

  onKeyDown(event: KeyEventData): boolean {
    // Toggle copy mode with C key
    if (event.key === 'c' || event.key === 'C') {
      this.copyMode = !this.copyMode;
      return true;
    }

    return super.onKeyDown(event);
  }

  private getRotationAngle(): number {
    if (!this.centerPoint || !this.startPoint || !this.currentPoint) {
      return 0;
    }

    const refAngle = Math.atan2(
      this.startPoint.y - this.centerPoint.y,
      this.startPoint.x - this.centerPoint.x
    );

    const currentAngle = Math.atan2(
      this.currentPoint.y - this.centerPoint.y,
      this.currentPoint.x - this.centerPoint.x
    );

    return currentAngle - refAngle;
  }

  private completeRotation(): void {
    if (!this.centerPoint || this.entitiesToRotate.length === 0) {
      return;
    }

    const angle = this.getRotationAngle();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const matrix: TransformMatrix = {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      e: this.centerPoint.x - this.centerPoint.x * cos + this.centerPoint.y * sin,
      f: this.centerPoint.y - this.centerPoint.x * sin - this.centerPoint.y * cos,
    };

    if (this.copyMode) {
      // Create copies
      const copies: Entity[] = [];
      for (const entity of this.entitiesToRotate) {
        const copy = entity.clone();
        copy.transform(matrix);
        copies.push(copy);
      }
      this.completedEntities.push(...copies);
    } else {
      // Rotate originals
      for (const entity of this.entitiesToRotate) {
        entity.transform(matrix);
      }
    }
  }

  protected onReset(): void {
    this.centerPoint = null;
    this.startPoint = null;
    this.currentPoint = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const worldToScreen = (p: Vector2) => this.viewport.worldToScreen(p);

    // Draw center point
    if (this.centerPoint) {
      const centerScreen = worldToScreen(this.centerPoint);
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw reference line
    if (this.centerPoint && this.startPoint) {
      const centerScreen = worldToScreen(this.centerPoint);
      const startScreen = worldToScreen(this.startPoint);

      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(centerScreen.x, centerScreen.y);
      ctx.lineTo(startScreen.x, startScreen.y);
      ctx.stroke();
    }

    // Draw current angle line and preview
    if (this.centerPoint && this.startPoint && this.currentPoint) {
      const centerScreen = worldToScreen(this.centerPoint);
      const currentScreen = worldToScreen(this.currentPoint);

      ctx.strokeStyle = '#ff4a9e';
      ctx.beginPath();
      ctx.moveTo(centerScreen.x, centerScreen.y);
      ctx.lineTo(currentScreen.x, currentScreen.y);
      ctx.stroke();

      // Draw angle arc
      const refAngle = Math.atan2(
        this.startPoint.y - this.centerPoint.y,
        this.startPoint.x - this.centerPoint.x
      );
      const currentAngle = Math.atan2(
        this.currentPoint.y - this.centerPoint.y,
        this.currentPoint.x - this.centerPoint.x
      );

      ctx.strokeStyle = '#4a9eff';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 30, refAngle, currentAngle);
      ctx.stroke();

      // Draw angle text
      const angleDegrees = ((currentAngle - refAngle) * 180) / Math.PI;
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`${angleDegrees.toFixed(1)}°`, centerScreen.x + 35, centerScreen.y);

      // Draw preview of rotated entities
      if (this.entitiesToRotate.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;

        const angle = this.getRotationAngle();
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const matrix: TransformMatrix = {
          a: cos,
          b: sin,
          c: -sin,
          d: cos,
          e: this.centerPoint.x - this.centerPoint.x * cos + this.centerPoint.y * sin,
          f: this.centerPoint.y - this.centerPoint.x * sin - this.centerPoint.y * cos,
        };

        for (const entity of this.entitiesToRotate) {
          const clone = entity.clone();
          clone.transform(matrix);
          clone.render(ctx, worldToScreen);
        }

        ctx.restore();
      }
    }
  }
}
