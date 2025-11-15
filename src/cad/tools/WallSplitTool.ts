import { Vector2 } from '../Vector2';
import { Line } from '../entities/Line';
import { Rectangle } from '../entities/Rectangle';
import { Polyline } from '../entities/Polyline';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * WallSplitTool - Split rectangles/polylines by drawing a line through them
 */
export class WallSplitTool extends DrawingTool {
  private firstPoint: Vector2 | null = null;
  private secondPoint: Vector2 | null = null;
  private firstPointClicked: boolean = false;

  getName(): string {
    return 'Wall Split';
  }

  getDescription(): string {
    return 'Split rooms by drawing a dividing line';
  }

  getPrompt(): string {
    if (!this.firstPointClicked) {
      return 'Click first point of dividing line';
    }
    return 'Click second point to complete split';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.firstPointClicked) {
      // First click - set first point
      this.firstPoint = snappedPoint;
      this.firstPointClicked = true;
      this.polarTracking.setBasePoint(this.firstPoint);
      this.dynamicInput.setBasePoint(this.firstPoint);
      this.state = ToolState.PREVIEW;
    } else {
      // Second click - create split line
      this.secondPoint = snappedPoint;
      this.completeSplit();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.firstPointClicked) return;

    const snappedPoint = this.applySnap(event.worldPos);
    this.secondPoint = snappedPoint;

    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for wall split tool
  }

  onKeyDown(event: KeyEventData): boolean {
    if (event.key === 'Escape') {
      this.reset();
      this.viewport.requestRedraw();
      return true;
    }
    return false;
  }

  private completeSplit(): void {
    if (!this.firstPoint || !this.secondPoint) return;

    // Create the dividing line
    const splitLine = new Line(
      this.firstPoint,
      this.secondPoint,
      'A-WALL-INTERIOR'
    );

    this.completedEntities.push(splitLine);

    // Add to snap manager
    this.snapManager.addEntity(splitLine);
  }

  protected onReset(): void {
    this.firstPoint = null;
    this.secondPoint = null;
    this.firstPointClicked = false;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.firstPoint || !this.secondPoint) {
      // Draw first point only
      if (this.firstPoint) {
        const p1Screen = this.viewport.worldToScreen(this.firstPoint);

        ctx.save();
        ctx.fillStyle = '#ff9500';
        ctx.beginPath();
        ctx.arc(p1Screen.x, p1Screen.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    // Draw preview line
    const p1Screen = this.viewport.worldToScreen(this.firstPoint);
    const p2Screen = this.viewport.worldToScreen(this.secondPoint);

    ctx.save();
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(p1Screen.x, p1Screen.y);
    ctx.lineTo(p2Screen.x, p2Screen.y);
    ctx.stroke();

    // Draw points
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff9500';

    ctx.beginPath();
    ctx.arc(p1Screen.x, p1Screen.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p2Screen.x, p2Screen.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Render polar tracking
    if (this.secondPoint && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.secondPoint, this.firstPoint);
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
    if (this.secondPoint) {
      const objectSnap = this.snapManager.findSnap(this.secondPoint, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.secondPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.secondPoint);
      this.dynamicInput.updateFromCursor(this.secondPoint, this.firstPoint);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }
}
