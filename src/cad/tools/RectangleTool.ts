import { Vector2 } from '../Vector2';
import { Rectangle } from '../entities/Rectangle';
import { Wall } from '../entities/Wall';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * RectangleTool - Draw rectangles by specifying two opposite corners
 */
export class RectangleTool extends DrawingTool {
  private firstCorner: Vector2 | null = null;
  private secondCorner: Vector2 | null = null;

  getName(): string {
    return 'Rectangle';
  }

  getDescription(): string {
    return 'Draw rectangles by specifying two opposite corners';
  }

  getPrompt(): string {
    if (!this.firstCorner) {
      return 'Specify first corner';
    }
    return 'Specify opposite corner';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.firstCorner) {
      // First click - set first corner
      this.firstCorner = snappedPoint;
      this.polarTracking.setBasePoint(this.firstCorner);
      this.dynamicInput.setBasePoint(this.firstCorner);
      this.state = ToolState.PREVIEW;
    } else {
      // Second click - complete rectangle
      this.secondCorner = snappedPoint;
      this.completeRectangle();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.firstCorner) return;

    this.secondCorner = this.applySnap(event.worldPos);

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for rectangle tool
  }

  onKeyDown(event: KeyEventData): boolean {
    // Handle 'S' to toggle square mode (future feature)
    // For now, just use default handlers
    return super.onKeyDown(event);
  }

  private updatePreview(): void {
    if (!this.firstCorner || !this.secondCorner) {
      this.previewEntity = null;
      return;
    }

    this.previewEntity = new Rectangle(this.firstCorner, this.secondCorner);
  }

  private completeRectangle(): void {
    if (!this.firstCorner || !this.secondCorner) return;

    // Don't create rectangle if corners are too close
    const distance = this.firstCorner.distanceTo(this.secondCorner);
    if (distance < 0.1) {
      return;
    }

    // Calculate the four corners of the rectangle
    const minX = Math.min(this.firstCorner.x, this.secondCorner.x);
    const maxX = Math.max(this.firstCorner.x, this.secondCorner.x);
    const minY = Math.min(this.firstCorner.y, this.secondCorner.y);
    const maxY = Math.max(this.firstCorner.y, this.secondCorner.y);

    const bottomLeft = new Vector2(minX, minY);
    const bottomRight = new Vector2(maxX, minY);
    const topRight = new Vector2(maxX, maxY);
    const topLeft = new Vector2(minX, maxY);

    // Create 4 wall entities in COUNTER-CLOCKWISE order
    // This ensures the perpendicular (left side) points inward, placing drywall inside
    const wallTypeId = '2x4-exterior-basic'; // Use exterior wall type

    const bottomWall = new Wall(bottomRight, bottomLeft, wallTypeId, 'A-WALL'); // Right to Left
    const leftWall = new Wall(bottomLeft, topLeft, wallTypeId, 'A-WALL');       // Bottom to Top
    const topWall = new Wall(topLeft, topRight, wallTypeId, 'A-WALL');          // Left to Right
    const rightWall = new Wall(topRight, bottomRight, wallTypeId, 'A-WALL');    // Top to Bottom

    // Add all walls to completed entities
    this.completedEntities.push(bottomWall, rightWall, topWall, leftWall);

    // Add to snap manager
    this.snapManager.addEntity(bottomWall as any);
    this.snapManager.addEntity(rightWall as any);
    this.snapManager.addEntity(topWall as any);
    this.snapManager.addEntity(leftWall as any);
  }

  protected onReset(): void {
    this.firstCorner = null;
    this.secondCorner = null;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render preview rectangle
    if (this.previewEntity && this.firstCorner && this.secondCorner) {
      const corner1Screen = this.viewport.worldToScreen(this.firstCorner);
      const corner2Screen = this.viewport.worldToScreen(this.secondCorner);

      ctx.save();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.rect(
        corner1Screen.x,
        corner1Screen.y,
        corner2Screen.x - corner1Screen.x,
        corner2Screen.y - corner1Screen.y
      );
      ctx.stroke();

      // Draw first corner
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(corner1Screen.x, corner1Screen.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw dimensions
      this.renderDimensions(ctx, corner1Screen, corner2Screen);

      ctx.restore();
    }

    // Render polar tracking if enabled
    if (this.firstCorner && this.secondCorner && this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.secondCorner, this.firstCorner);
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
    if (this.secondCorner) {
      const objectSnap = this.snapManager.findSnap(this.secondCorner, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.secondCorner) {
      const cursorScreen = this.viewport.worldToScreen(this.secondCorner);
      this.dynamicInput.updateFromCursor(this.secondCorner, this.firstCorner || undefined);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }

  /**
   * Render dimensions on preview
   */
  private renderDimensions(
    ctx: CanvasRenderingContext2D,
    corner1Screen: Vector2,
    corner2Screen: Vector2
  ): void {
    if (!this.firstCorner || !this.secondCorner) return;

    const width = Math.abs(this.secondCorner.x - this.firstCorner.x);
    const height = Math.abs(this.secondCorner.y - this.firstCorner.y);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    // Width dimension (bottom)
    const widthText = width.toFixed(2);
    const widthX = (corner1Screen.x + corner2Screen.x) / 2;
    const widthY = Math.max(corner1Screen.y, corner2Screen.y) + 20;

    ctx.strokeText(widthText, widthX - ctx.measureText(widthText).width / 2, widthY);
    ctx.fillText(widthText, widthX - ctx.measureText(widthText).width / 2, widthY);

    // Height dimension (right)
    const heightText = height.toFixed(2);
    const heightX = Math.max(corner1Screen.x, corner2Screen.x) + 20;
    const heightY = (corner1Screen.y + corner2Screen.y) / 2;

    ctx.save();
    ctx.translate(heightX, heightY);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeText(heightText, -ctx.measureText(heightText).width / 2, 0);
    ctx.fillText(heightText, -ctx.measureText(heightText).width / 2, 0);
    ctx.restore();
  }
}
