import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * MoveTool - Move entities by specifying base point and destination
 */
export class MoveTool extends DrawingTool {
  private entitiesToMove: Entity[] = [];
  private basePoint: Vector2 | null = null;
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
    this.entitiesToMove = entities;
  }

  getName(): string {
    return this.copyMode ? 'Copy' : 'Move';
  }

  getDescription(): string {
    return this.copyMode
      ? 'Copy entities to a new location'
      : 'Move entities to a new location';
  }

  getPrompt(): string {
    if (!this.basePoint) {
      return 'Specify base point';
    }
    return this.copyMode ? 'Specify destination point (copying)' : 'Specify destination point';
  }

  setCopyMode(copy: boolean): void {
    this.copyMode = copy;
  }

  setEntitiesToMove(entities: Entity[]): void {
    this.entitiesToMove = entities;
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return;

    const snappedPoint = this.applySnap(event.worldPos);

    if (!this.basePoint) {
      // First click - set base point
      this.basePoint = snappedPoint;
      this.polarTracking.setBasePoint(this.basePoint);
      this.dynamicInput.setBasePoint(this.basePoint);
      this.state = ToolState.PREVIEW;
    } else {
      // Second click - complete move
      this.currentPoint = snappedPoint;
      this.completeMove();
      this.reset();
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.basePoint) return;

    this.currentPoint = this.applySnap(event.worldPos);
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

  private completeMove(): void {
    if (!this.basePoint || !this.currentPoint || this.entitiesToMove.length === 0) {
      return;
    }

    const offset = Vector2.fromPoints(this.basePoint, this.currentPoint);

    const matrix: TransformMatrix = {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: offset.x,
      f: offset.y,
    };

    if (this.copyMode) {
      // Create copies
      const copies: Entity[] = [];
      for (const entity of this.entitiesToMove) {
        const copy = entity.clone();
        copy.transform(matrix);
        copies.push(copy);
      }
      this.completedEntities.push(...copies);
    } else {
      // Move originals
      for (const entity of this.entitiesToMove) {
        entity.transform(matrix);
      }
    }
  }

  protected onReset(): void {
    this.basePoint = null;
    this.currentPoint = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.basePoint || !this.currentPoint || this.entitiesToMove.length === 0) {
      return;
    }

    const offset = Vector2.fromPoints(this.basePoint, this.currentPoint);
    const worldToScreen = (p: Vector2) => this.viewport.worldToScreen(p);

    ctx.save();
    ctx.globalAlpha = 0.5;

    // Draw preview of moved entities
    for (const entity of this.entitiesToMove) {
      const clone = entity.clone();
      const matrix: TransformMatrix = {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: offset.x,
        f: offset.y,
      };
      clone.transform(matrix);
      clone.render(ctx, worldToScreen);
    }

    ctx.restore();

    // Draw base point
    const baseScreen = worldToScreen(this.basePoint);
    ctx.fillStyle = '#4a9eff';
    ctx.beginPath();
    ctx.arc(baseScreen.x, baseScreen.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw line from base to current
    const currentScreen = worldToScreen(this.currentPoint);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(baseScreen.x, baseScreen.y);
    ctx.lineTo(currentScreen.x, currentScreen.y);
    ctx.stroke();

    // Render polar tracking
    if (this.polarTracking.isEnabled()) {
      const trackResult = this.polarTracking.track(this.currentPoint, this.basePoint);
      if (trackResult) {
        const bounds = this.viewport.getCamera().getViewBounds(
          this.viewport.getCanvas().width,
          this.viewport.getCanvas().height
        );
        this.polarTracking.renderGuides(ctx, trackResult, worldToScreen, bounds);
      }
    }

    // Render dynamic input
    const cursorScreen = worldToScreen(this.currentPoint);
    this.dynamicInput.updateFromCursor(this.currentPoint, this.basePoint);
    this.dynamicInput.renderTooltip(ctx, cursorScreen);
  }
}
