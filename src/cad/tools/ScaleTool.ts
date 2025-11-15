import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * ScaleTool - Scale entities from a base point
 */
export class ScaleTool extends DrawingTool {
  private entitiesToScale: Entity[] = [];
  private basePoint: Vector2 | null = null;
  private referencePoint: Vector2 | null = null;
  private currentPoint: Vector2 | null = null;
  private copyMode: boolean = false;
  private uniformScale: boolean = true;

  constructor(
    viewport: any,
    snapManager: any,
    polarTracking: any,
    dynamicInput: any,
    entities: Entity[]
  ) {
    super(viewport, snapManager, polarTracking, dynamicInput);
    this.entitiesToScale = entities;
  }

  getName(): string {
    return 'Scale';
  }

  getDescription(): string {
    return 'Scale entities from a base point';
  }

  getPrompt(): string {
    if (!this.basePoint) {
      return 'Specify base point';
    }
    if (!this.referencePoint) {
      return 'Specify reference length';
    }
    return this.copyMode ? 'Specify new length (copying)' : 'Specify new length';
  }

  setCopyMode(copy: boolean): void {
    this.copyMode = copy;
  }

  setEntitiesToScale(entities: Entity[]): void {
    this.entitiesToScale = entities;
  }

  setUniformScale(uniform: boolean): void {
    this.uniformScale = uniform;
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
    } else if (!this.referencePoint) {
      // Second click - set reference
      this.referencePoint = snappedPoint;
    } else {
      // Third click - complete scale
      this.currentPoint = snappedPoint;
      this.completeScale();
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

    // Toggle uniform scale with U key
    if (event.key === 'u' || event.key === 'U') {
      this.uniformScale = !this.uniformScale;
      return true;
    }

    return super.onKeyDown(event);
  }

  private getScaleFactor(): number {
    if (!this.basePoint || !this.referencePoint || !this.currentPoint) {
      return 1;
    }

    const refDistance = this.basePoint.distanceTo(this.referencePoint);
    const newDistance = this.basePoint.distanceTo(this.currentPoint);

    if (refDistance === 0) return 1;

    return newDistance / refDistance;
  }

  private completeScale(): void {
    if (!this.basePoint || this.entitiesToScale.length === 0) {
      return;
    }

    const scale = this.getScaleFactor();

    const matrix: TransformMatrix = {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: this.basePoint.x * (1 - scale),
      f: this.basePoint.y * (1 - scale),
    };

    if (this.copyMode) {
      // Create copies
      const copies: Entity[] = [];
      for (const entity of this.entitiesToScale) {
        const copy = entity.clone();
        copy.transform(matrix);
        copies.push(copy);
      }
      this.completedEntities.push(...copies);
    } else {
      // Scale originals
      for (const entity of this.entitiesToScale) {
        entity.transform(matrix);
      }
    }
  }

  protected onReset(): void {
    this.basePoint = null;
    this.referencePoint = null;
    this.currentPoint = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const worldToScreen = (p: Vector2) => this.viewport.worldToScreen(p);

    // Draw base point
    if (this.basePoint) {
      const baseScreen = worldToScreen(this.basePoint);
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(baseScreen.x, baseScreen.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw reference line
    if (this.basePoint && this.referencePoint) {
      const baseScreen = worldToScreen(this.basePoint);
      const refScreen = worldToScreen(this.referencePoint);

      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(baseScreen.x, baseScreen.y);
      ctx.lineTo(refScreen.x, refScreen.y);
      ctx.stroke();

      // Draw reference distance
      const refDist = this.basePoint.distanceTo(this.referencePoint);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      const midX = (baseScreen.x + refScreen.x) / 2;
      const midY = (baseScreen.y + refScreen.y) / 2;
      ctx.fillText(`Ref: ${refDist.toFixed(2)}`, midX, midY - 10);
    }

    // Draw current line and scale factor
    if (this.basePoint && this.referencePoint && this.currentPoint) {
      const baseScreen = worldToScreen(this.basePoint);
      const currentScreen = worldToScreen(this.currentPoint);

      ctx.strokeStyle = '#ff4a9e';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(baseScreen.x, baseScreen.y);
      ctx.lineTo(currentScreen.x, currentScreen.y);
      ctx.stroke();

      // Draw scale factor
      const scale = this.getScaleFactor();
      const currentDist = this.basePoint.distanceTo(this.currentPoint);
      ctx.fillStyle = '#ffffff';
      const midX = (baseScreen.x + currentScreen.x) / 2;
      const midY = (baseScreen.y + currentScreen.y) / 2;
      ctx.fillText(`Scale: ${scale.toFixed(3)}x`, midX, midY + 20);
      ctx.fillText(`New: ${currentDist.toFixed(2)}`, midX, midY + 35);

      // Draw preview of scaled entities
      if (this.entitiesToScale.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;

        const matrix: TransformMatrix = {
          a: scale,
          b: 0,
          c: 0,
          d: scale,
          e: this.basePoint.x * (1 - scale),
          f: this.basePoint.y * (1 - scale),
        };

        for (const entity of this.entitiesToScale) {
          const clone = entity.clone();
          clone.transform(matrix);
          clone.render(ctx, worldToScreen);
        }

        ctx.restore();
      }
    }
  }
}
