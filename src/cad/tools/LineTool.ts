import { Vector2 } from '../Vector2';
import { Line } from '../entities/Line';
import { Wall } from '../entities/Wall';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * LineTool - Draw lines by clicking two points
 */
export class LineTool extends DrawingTool {
  private startPoint: Vector2 | null = null;
  private currentPoint: Vector2 | null = null;
  private continuous: boolean = true;

  getName(): string {
    return 'Line';
  }

  getDescription(): string {
    return 'Draw straight lines between two points';
  }

  getPrompt(): string {
    if (!this.startPoint) {
      return 'Specify first point';
    }
    return this.continuous
      ? 'Specify next point or press Enter to finish'
      : 'Specify second point';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.startPoint) {
      // First click - set start point
      this.startPoint = snappedPoint;
      this.polarTracking.setBasePoint(this.startPoint);
      this.dynamicInput.setBasePoint(this.startPoint);
      this.state = ToolState.PREVIEW;
    } else {
      // Second click - complete line
      this.currentPoint = snappedPoint;
      this.completeLine();

      // Continue drawing if continuous mode
      if (this.continuous) {
        this.startPoint = snappedPoint;
        this.polarTracking.setBasePoint(this.startPoint);
        this.dynamicInput.setBasePoint(this.startPoint);
        this.currentPoint = null;
      } else {
        this.reset();
      }
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.startPoint) return;

    this.currentPoint = this.applySnap(event.worldPos);

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for line tool
  }

  onKeyDown(event: KeyEventData): boolean {
    // Handle Enter to finish continuous mode
    if (event.key === 'Enter' && this.continuous && this.completedEntities.length > 0) {
      this.complete();
      return true;
    }

    // Handle 'C' to toggle continuous mode
    if (event.key === 'c' || event.key === 'C') {
      this.continuous = !this.continuous;
      return true;
    }

    return super.onKeyDown(event);
  }

  private updatePreview(): void {
    if (!this.startPoint || !this.currentPoint) {
      this.previewEntity = null;
      return;
    }

    this.previewEntity = new Line(this.startPoint, this.currentPoint);
  }

  private completeLine(): void {
    if (!this.startPoint || !this.currentPoint) return;

    // Create wall entity with proper assembly
    const wallTypeId = '2x4-exterior-basic'; // Use exterior wall type
    const wall = new Wall(this.startPoint, this.currentPoint, wallTypeId, 'A-WALL');
    this.completedEntities.push(wall);

    // Add to snap manager
    this.snapManager.addEntity(wall as any);
  }

  protected onReset(): void {
    this.startPoint = null;
    this.currentPoint = null;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render preview line
    if (this.previewEntity && this.startPoint && this.currentPoint) {
      const startScreen = this.viewport.worldToScreen(this.startPoint);
      const endScreen = this.viewport.worldToScreen(this.currentPoint);

      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();

      // Draw start point
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Render polar tracking if enabled
    if (this.startPoint && this.currentPoint && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.currentPoint, this.startPoint);
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
    if (this.currentPoint) {
      const objectSnap = this.snapManager.findSnap(this.currentPoint, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.currentPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.currentPoint);
      this.dynamicInput.updateFromCursor(this.currentPoint, this.startPoint || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }

  /**
   * Set continuous mode (chain lines)
   */
  setContinuous(continuous: boolean): void {
    this.continuous = continuous;
  }

  /**
   * Get continuous mode
   */
  isContinuous(): boolean {
    return this.continuous;
  }
}
