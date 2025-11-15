import { Vector2 } from '../Vector2';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';
import { SelectionManager } from '../selection/SelectionManager';

/**
 * SelectionTool - Select entities using click, window, or crossing
 */
export class SelectionTool extends DrawingTool {
  private selectionManager: SelectionManager;
  private selectionStart: Vector2 | null = null;
  private selectionCurrent: Vector2 | null = null;
  private isWindowSelection: boolean = true;

  constructor(
    viewport: any,
    snapManager: any,
    polarTracking: any,
    dynamicInput: any,
    selectionManager: SelectionManager
  ) {
    super(viewport, snapManager, polarTracking, dynamicInput);
    this.selectionManager = selectionManager;
  }

  getName(): string {
    return 'Select';
  }

  getDescription(): string {
    return 'Select entities using click, window, or crossing selection';
  }

  getPrompt(): string {
    if (!this.selectionStart) {
      return 'Click to select entities, or drag for window/crossing selection';
    }
    return this.isWindowSelection
      ? 'Window selection: drag right-to-left'
      : 'Crossing selection: drag left-to-right';
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return;

    this.selectionStart = event.worldPos.clone();
    this.selectionCurrent = event.worldPos.clone();
    this.state = ToolState.PREVIEW;

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (!this.selectionStart) return;

    this.selectionCurrent = event.worldPos.clone();

    // Determine if window or crossing based on drag direction
    this.isWindowSelection = this.selectionCurrent.x > this.selectionStart.x;

    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    if (!this.selectionStart) return;

    const dragDistance = this.selectionStart.distanceTo(event.worldPos);
    const addToSelection = event.shiftKey || event.ctrlKey;

    if (dragDistance < 5) {
      // Click selection
      this.selectionManager.selectByPoint(
        event.worldPos,
        addToSelection,
        10 / this.viewport.getCamera().getZoom()
      );
    } else {
      // Box selection
      if (this.isWindowSelection) {
        this.selectionManager.selectByWindow(
          this.selectionStart,
          event.worldPos,
          addToSelection
        );
      } else {
        this.selectionManager.selectByCrossing(
          this.selectionStart,
          event.worldPos,
          addToSelection
        );
      }
    }

    this.selectionStart = null;
    this.selectionCurrent = null;
    this.state = ToolState.ACTIVE;

    this.viewport.requestRedraw();
  }

  onKeyDown(event: KeyEventData): boolean {
    // Ctrl+A: Select all
    if (event.ctrlKey && event.key === 'a') {
      this.selectionManager.selectAll();
      return true;
    }

    // Ctrl+I: Invert selection
    if (event.ctrlKey && event.key === 'i') {
      this.selectionManager.invertSelection();
      return true;
    }

    // Escape: Clear selection
    if (event.key === 'Escape') {
      this.selectionManager.clearSelection();
      return true;
    }

    // Delete: Delete selected entities
    if (event.key === 'Delete') {
      const selected = this.selectionManager.getSelectedEntities();
      // Note: Actual deletion would be handled by the application
      // This tool just manages selection
      console.log('Delete key pressed, selected entities:', selected.length);
      return true;
    }

    return super.onKeyDown(event);
  }

  protected onReset(): void {
    this.selectionStart = null;
    this.selectionCurrent = null;
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.selectionStart || !this.selectionCurrent) return;

    const startScreen = this.viewport.worldToScreen(this.selectionStart);
    const currentScreen = this.viewport.worldToScreen(this.selectionCurrent);

    ctx.save();

    // Draw selection box
    const width = currentScreen.x - startScreen.x;
    const height = currentScreen.y - startScreen.y;

    if (this.isWindowSelection) {
      // Window selection: solid blue
      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    } else {
      // Crossing selection: dashed green
      ctx.fillStyle = 'rgba(74, 255, 158, 0.1)';
      ctx.strokeStyle = 'rgba(74, 255, 158, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
    }

    ctx.fillRect(startScreen.x, startScreen.y, width, height);
    ctx.strokeRect(startScreen.x, startScreen.y, width, height);

    ctx.restore();
  }

  getCursor(): string {
    return 'default';
  }
}
