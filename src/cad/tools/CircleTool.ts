import { Vector2 } from '../Vector2';
import { Circle } from '../entities/Circle';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * CircleTool - Draw circles by clicking center and radius point
 */
export class CircleTool extends DrawingTool {
  private centerPoint: Vector2 | null = null;
  private radiusPoint: Vector2 | null = null;

  getName(): string {
    return 'Circle';
  }

  getDescription(): string {
    return 'Draw circles by specifying center and radius';
  }

  getPrompt(): string {
    if (!this.centerPoint) {
      return 'Specify center point';
    }
    return 'Specify radius (click to set distance from center)';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.centerPoint) {
      // First click - set center point
      this.centerPoint = snappedPoint;
      this.polarTracking.setBasePoint(this.centerPoint);
      this.dynamicInput.setBasePoint(this.centerPoint);
      this.state = ToolState.PREVIEW;
    } else {
      // Second click - complete circle
      this.radiusPoint = snappedPoint;
      this.completeCircle();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.centerPoint) return;

    this.radiusPoint = this.applySnap(event.worldPos);

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for circle tool
  }

  private updatePreview(): void {
    if (!this.centerPoint || !this.radiusPoint) {
      this.previewEntity = null;
      return;
    }

    const radius = this.centerPoint.distanceTo(this.radiusPoint);
    if (radius > 0) {
      this.previewEntity = new Circle(this.centerPoint, radius);
    } else {
      this.previewEntity = null;
    }
  }

  private completeCircle(): void {
    if (!this.centerPoint || !this.radiusPoint) return;

    const radius = this.centerPoint.distanceTo(this.radiusPoint);
    if (radius <= 0) return; // Don't create zero-radius circles

    // Create final circle entity
    const circle = new Circle(this.centerPoint, radius, 'A-WALL');
    this.completedEntities.push(circle);

    // Add to snap manager
    this.snapManager.addEntity(circle as any);
  }

  protected onReset(): void {
    this.centerPoint = null;
    this.radiusPoint = null;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render preview circle
    if (this.previewEntity && this.centerPoint && this.radiusPoint) {
      const centerScreen = this.viewport.worldToScreen(this.centerPoint);
      const radiusPointScreen = this.viewport.worldToScreen(this.radiusPoint);
      const radiusScreen = Math.abs(radiusPointScreen.x - centerScreen.x);

      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Draw preview circle
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, 0, Math.PI * 2);
      ctx.stroke();

      // Draw radius line
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerScreen.x, centerScreen.y);
      ctx.lineTo(radiusPointScreen.x, radiusPointScreen.y);
      ctx.stroke();

      // Draw center point
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw radius point
      ctx.beginPath();
      ctx.arc(radiusPointScreen.x, radiusPointScreen.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Render polar tracking if enabled
    if (this.centerPoint && this.radiusPoint && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.radiusPoint, this.centerPoint);
      if (trackResult) {
        const bounds = this.viewport.getCamera().getViewBounds(
          this.viewport.getCanvas().width,
          this.viewport.getCanvas().height
        );
        this.polarTracking.renderGuides(
          ctx,
          trackResult,
          (p) => this.viewport.worldToScreen(p),
          bounds
        );
      }
    }

    // Render snap indicator
    if (this.radiusPoint) {
      const objectSnap = this.snapManager.findSnap(this.radiusPoint, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.radiusPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.radiusPoint);
      this.dynamicInput.updateFromCursor(this.radiusPoint, this.centerPoint || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }
}
