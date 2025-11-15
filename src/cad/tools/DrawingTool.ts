import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { CanvasViewport } from '../CanvasViewport';
import { SnapManager } from '../SnapManager';
import { PolarTrackingManager } from '../PolarTrackingManager';
import { DynamicInput } from '../DynamicInput';

/**
 * Tool state
 */
export enum ToolState {
  IDLE = 'idle',
  ACTIVE = 'active',
  PREVIEW = 'preview',
  COMPLETE = 'complete',
}

/**
 * Mouse event data
 */
export interface MouseEventData {
  screenPos: Vector2;
  worldPos: Vector2;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/**
 * Key event data
 */
export interface KeyEventData {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/**
 * DrawingTool - Base class for all CAD drawing tools
 */
export abstract class DrawingTool {
  protected viewport: CanvasViewport;
  protected snapManager: SnapManager;
  protected polarTracking: PolarTrackingManager;
  protected dynamicInput: DynamicInput;
  protected state: ToolState = ToolState.IDLE;
  protected previewEntity: Entity | null = null;
  protected completedEntities: Entity[] = [];

  constructor(
    viewport: CanvasViewport,
    snapManager: SnapManager,
    polarTracking: PolarTrackingManager,
    dynamicInput: DynamicInput
  ) {
    this.viewport = viewport;
    this.snapManager = snapManager;
    this.polarTracking = polarTracking;
    this.dynamicInput = dynamicInput;
  }

  /**
   * Get tool name
   */
  abstract getName(): string;

  /**
   * Get tool description
   */
  abstract getDescription(): string;

  /**
   * Get current prompt message for user
   */
  abstract getPrompt(): string;

  /**
   * Get current tool state
   */
  getState(): ToolState {
    return this.state;
  }

  /**
   * Check if tool is active
   */
  isActive(): boolean {
    return this.state !== ToolState.IDLE && this.state !== ToolState.COMPLETE;
  }

  /**
   * Activate tool
   */
  activate(): void {
    this.state = ToolState.ACTIVE;
    this.onActivate();
  }

  /**
   * Deactivate tool
   */
  deactivate(): void {
    this.cleanup();
    this.state = ToolState.IDLE;
    this.onDeactivate();
  }

  /**
   * Reset tool to initial state
   */
  reset(): void {
    this.cleanup();
    this.state = ToolState.ACTIVE;
    this.onReset();
  }

  /**
   * Cleanup tool state
   * NOTE: We don't clear completedEntities here because ToolManager
   * needs to collect them first. ToolManager will clear them after collection.
   */
  protected cleanup(): void {
    this.previewEntity = null;
    // Don't clear completedEntities - ToolManager will do this after collecting them
  }

  /**
   * Handle mouse down
   */
  abstract onMouseDown(event: MouseEventData): void;

  /**
   * Handle mouse move
   */
  abstract onMouseMove(event: MouseEventData): void;

  /**
   * Handle mouse up
   */
  abstract onMouseUp(event: MouseEventData): void;

  /**
   * Handle key down
   */
  onKeyDown(event: KeyEventData): boolean {
    // Common key handlers
    if (event.key === 'Escape') {
      this.reset();
      return true;
    }

    if (event.key === 'Enter') {
      if (this.completedEntities.length > 0) {
        this.complete();
        return true;
      }
    }

    return false;
  }

  /**
   * Apply snapping to a point
   */
  protected applySnap(worldPos: Vector2): Vector2 {
    // Try object snap first
    const objectSnap = this.snapManager.findSnap(worldPos, (p) =>
      this.viewport.worldToScreen(p)
    );

    if (objectSnap) {
      return objectSnap.point;
    }

    // Try polar tracking if enabled and we have a base point
    if (this.polarTracking.isEnabled()) {
      const basePoint = this.polarTracking.getBasePoint();
      if (basePoint) {
        const trackResult = this.polarTracking.track(worldPos, basePoint);
        if (trackResult && trackResult.snapped) {
          return trackResult.point;
        }
      }
    }

    // Fall back to grid snap
    return this.gridSnap(worldPos);
  }

  /**
   * Apply grid snapping
   */
  protected gridSnap(worldPos: Vector2, snapSize: number = 0.5): Vector2 {
    return new Vector2(
      Math.round(worldPos.x / snapSize) * snapSize,
      Math.round(worldPos.y / snapSize) * snapSize
    );
  }

  /**
   * Get preview entity
   */
  getPreviewEntity(): Entity | null {
    return this.previewEntity;
  }

  /**
   * Get completed entities
   */
  getCompletedEntities(): Entity[] {
    return [...this.completedEntities];
  }

  /**
   * Complete tool operation
   */
  protected complete(): void {
    this.state = ToolState.COMPLETE;
    this.onComplete();
  }

  /**
   * Render tool-specific graphics (guides, preview, etc.)
   */
  abstract render(ctx: CanvasRenderingContext2D): void;

  /**
   * Hook called when tool is activated
   */
  protected onActivate(): void {}

  /**
   * Hook called when tool is deactivated
   */
  protected onDeactivate(): void {}

  /**
   * Hook called when tool is reset
   */
  protected onReset(): void {}

  /**
   * Hook called when tool operation is complete
   */
  protected onComplete(): void {}

  /**
   * Get cursor style for this tool
   */
  getCursor(): string {
    return 'crosshair';
  }
}
