import { Vector2 } from '../Vector2';
import { Arc } from '../entities/Arc';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * ArcTool - Draw arcs by clicking three points
 */
export class ArcTool extends DrawingTool {
  private firstPoint: Vector2 | null = null;
  private secondPoint: Vector2 | null = null;
  private thirdPoint: Vector2 | null = null;
  private secondPointClicked: boolean = false;

  getName(): string {
    return 'Arc';
  }

  getDescription(): string {
    return 'Draw arcs by specifying three points';
  }

  getPrompt(): string {
    if (!this.firstPoint) {
      return 'Specify first point on arc';
    }
    if (!this.secondPointClicked) {
      return 'Specify second point on arc';
    }
    return 'Specify third point to complete arc';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.firstPoint) {
      // First click - set first point
      this.firstPoint = snappedPoint;
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
      // Third click - complete arc
      this.thirdPoint = snappedPoint;
      this.completeArc();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.firstPoint) return;

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.secondPointClicked) {
      // Haven't clicked second point yet, just update temp position
      this.secondPoint = snappedPoint;
    } else {
      // Have second point, update third point
      this.thirdPoint = snappedPoint;
    }

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for arc tool
  }

  private updatePreview(): void {
    if (!this.firstPoint || !this.secondPoint || !this.thirdPoint) {
      this.previewEntity = null;
      return;
    }

    // Create preview arc from three points
    const arc = Arc.fromThreePoints(this.firstPoint, this.secondPoint, this.thirdPoint);
    this.previewEntity = arc;
  }

  private completeArc(): void {
    if (!this.firstPoint || !this.secondPoint || !this.thirdPoint) return;

    // Create final arc entity
    const arc = Arc.fromThreePoints(
      this.firstPoint,
      this.secondPoint,
      this.thirdPoint,
      'A-WALL'
    );

    if (arc) {
      this.completedEntities.push(arc);
      // Add to snap manager
      this.snapManager.addEntity(arc as any);
    }
  }

  protected onReset(): void {
    this.firstPoint = null;
    this.secondPoint = null;
    this.thirdPoint = null;
    this.secondPointClicked = false;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render preview arc
    if (this.previewEntity && this.firstPoint && this.secondPoint && this.thirdPoint) {
      const arc = this.previewEntity as Arc;
      const centerScreen = this.viewport.worldToScreen(arc.getCenter());
      const radiusPoint = this.viewport.worldToScreen(
        new Vector2(arc.getCenter().x + arc.getRadius(), arc.getCenter().y)
      );
      const radiusScreen = Math.abs(radiusPoint.x - centerScreen.x);

      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Draw preview arc
      ctx.beginPath();
      ctx.arc(
        centerScreen.x,
        centerScreen.y,
        radiusScreen,
        arc.getStartAngle(),
        arc.getEndAngle(),
        arc.isCounterClockwise()
      );
      ctx.stroke();

      // Draw the three points
      ctx.setLineDash([]);
      ctx.fillStyle = '#4a9eff';

      const p1Screen = this.viewport.worldToScreen(this.firstPoint);
      const p2Screen = this.viewport.worldToScreen(this.secondPoint);
      const p3Screen = this.viewport.worldToScreen(this.thirdPoint);

      ctx.beginPath();
      ctx.arc(p1Screen.x, p1Screen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p2Screen.x, p2Screen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p3Screen.x, p3Screen.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw center point
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (this.firstPoint && this.secondPoint && !this.thirdPoint) {
      // Draw line between first two points as temporary preview
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
    if (this.secondPoint && this.thirdPoint && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.thirdPoint, this.secondPoint);
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
    if (this.thirdPoint) {
      const objectSnap = this.snapManager.findSnap(this.thirdPoint, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.thirdPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.thirdPoint);
      this.dynamicInput.updateFromCursor(this.thirdPoint, this.secondPoint || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }
}
