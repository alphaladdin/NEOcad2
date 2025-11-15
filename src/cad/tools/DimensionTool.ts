import { Vector2 } from '../Vector2';
import { Dimension, DimensionType } from '../entities/Dimension';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * DimensionTool - Create linear dimensions
 */
export class DimensionTool extends DrawingTool {
  private firstPoint: Vector2 | null = null;
  private secondPoint: Vector2 | null = null;
  private textPosition: Vector2 | null = null;
  private firstPointClicked: boolean = false;
  private secondPointClicked: boolean = false;

  getName(): string {
    return 'Dimension';
  }

  getDescription(): string {
    return 'Create linear dimensions to show measurements';
  }

  getPrompt(): string {
    if (!this.firstPointClicked) {
      return 'Specify first extension line origin';
    }
    if (!this.secondPointClicked) {
      return 'Specify second extension line origin';
    }
    return 'Specify dimension line location';
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
    } else if (!this.secondPointClicked) {
      // Second click - set second point
      this.secondPoint = snappedPoint;
      this.secondPointClicked = true;
      this.polarTracking.setBasePoint(this.secondPoint);
      this.dynamicInput.setBasePoint(this.secondPoint);
    } else {
      // Third click - set text position and complete
      this.textPosition = snappedPoint;
      this.completeDimension();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.firstPointClicked) return;

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.secondPointClicked) {
      // Haven't clicked second point yet, just update temp position
      this.secondPoint = snappedPoint;
    } else {
      // Have second point, update text position
      this.textPosition = snappedPoint;
    }

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for dimension tool
  }

  onKeyDown(event: KeyEventData): boolean {
    if (event.key === 'Escape') {
      this.reset();
      this.viewport.requestRedraw();
      return true;
    }
    return false;
  }

  private updatePreview(): void {
    if (!this.firstPoint || !this.secondPoint || !this.textPosition) {
      this.previewEntity = null;
      return;
    }

    // Create preview dimension
    const dimension = new Dimension(
      this.firstPoint,
      this.secondPoint,
      this.textPosition,
      DimensionType.LINEAR
    );

    this.previewEntity = dimension;
  }

  private completeDimension(): void {
    if (!this.firstPoint || !this.secondPoint || !this.textPosition) return;

    // Create final dimension entity
    const dimension = new Dimension(
      this.firstPoint,
      this.secondPoint,
      this.textPosition,
      DimensionType.LINEAR,
      'A-ANNO-DIMS'
    );

    this.completedEntities.push(dimension);

    // Add to snap manager
    this.snapManager.addEntity(dimension as any);
  }

  protected onReset(): void {
    this.firstPoint = null;
    this.secondPoint = null;
    this.textPosition = null;
    this.firstPointClicked = false;
    this.secondPointClicked = false;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render preview dimension
    if (this.previewEntity && this.firstPoint && this.secondPoint && this.textPosition) {
      const dimension = this.previewEntity as Dimension;
      dimension.render(ctx, (p) => this.viewport.worldToScreen(p));
    } else if (this.firstPoint && this.secondPoint) {
      // Draw temporary line between first two points
      const p1Screen = this.viewport.worldToScreen(this.firstPoint);
      const p2Screen = this.viewport.worldToScreen(this.secondPoint);

      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(p1Screen.x, p1Screen.y);
      ctx.lineTo(p2Screen.x, p2Screen.y);
      ctx.stroke();

      // Draw points
      ctx.setLineDash([]);
      ctx.fillStyle = '#4a9eff';

      ctx.beginPath();
      ctx.arc(p1Screen.x, p1Screen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p2Screen.x, p2Screen.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (this.firstPoint) {
      // Draw first point
      const p1Screen = this.viewport.worldToScreen(this.firstPoint);

      ctx.save();
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(p1Screen.x, p1Screen.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render polar tracking if enabled
    if (this.secondPoint && this.textPosition && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.textPosition, this.secondPoint);
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
    if (this.textPosition || this.secondPoint || this.firstPoint) {
      const currentPoint = this.textPosition || this.secondPoint || this.firstPoint;
      if (currentPoint) {
        const objectSnap = this.snapManager.findSnap(currentPoint, (p) =>
          this.viewport.worldToScreen(p)
        );
        if (objectSnap) {
          this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
            this.viewport.worldToScreen(p)
          );
        }
      }
    }

    // Render dynamic input
    if (this.textPosition) {
      const cursorScreen = this.viewport.worldToScreen(this.textPosition);
      this.dynamicInput.updateFromCursor(this.textPosition, this.secondPoint || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    } else if (this.secondPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.secondPoint);
      this.dynamicInput.updateFromCursor(this.secondPoint, this.firstPoint || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }
}
