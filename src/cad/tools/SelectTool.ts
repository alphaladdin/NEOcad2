import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * SelectTool - Select and manipulate entities
 */
export class SelectTool extends DrawingTool {
  private selectionStart: Vector2 | null = null;
  private selectionEnd: Vector2 | null = null;
  private isBoxSelecting: boolean = false;
  private selectedEntities: Set<Entity> = new Set();
  private hoverEntity: Entity | null = null;

  // Reference to the entities array (will be injected)
  private allEntities: Entity[] = [];

  // Dragging state
  private isDragging: boolean = false;
  private dragStartPoint: Vector2 | null = null;
  private dragCurrentPoint: Vector2 | null = null;
  private dragLastPoint: Vector2 | null = null;
  private entityDragOffsets: Map<Entity, Vector2> = new Map();

  getName(): string {
    return 'Select';
  }

  getDescription(): string {
    return 'Select and manipulate entities';
  }

  getPrompt(): string {
    if (this.isDragging) {
      return `Dragging ${this.selectedEntities.size} entity(s). Click to place`;
    }
    if (this.selectedEntities.size > 0) {
      return `${this.selectedEntities.size} entity(s) selected. Click and drag to move, Delete to remove, ESC to deselect`;
    }
    return 'Click to select entity, or drag to select multiple';
  }

  /**
   * Set the entities array to work with
   */
  setEntities(entities: Entity[]): void {
    this.allEntities = entities;
  }

  /**
   * Get selected entities
   */
  getSelectedEntities(): Entity[] {
    return Array.from(this.selectedEntities);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedEntities.forEach(entity => entity.setSelected(false));
    this.selectedEntities.clear();
    this.emitSelectionChanged();
  }

  /**
   * Emit selection changed event
   */
  private emitSelectionChanged(): void {
    this.emit('selectionChanged', {
      selectedEntities: this.getSelectedEntities(),
    });
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    // If we're already dragging, complete the drag
    if (this.isDragging) {
      this.completeDrag();
      this.viewport.requestRedraw();
      return;
    }

    // Check if clicking on an entity
    const clickedEntity = this.findEntityAtPoint(snappedPoint);

    if (clickedEntity) {
      // Clicking on an entity
      if (event.shiftKey) {
        // Shift+click: toggle selection
        if (this.selectedEntities.has(clickedEntity)) {
          clickedEntity.setSelected(false);
          this.selectedEntities.delete(clickedEntity);
        } else {
          clickedEntity.setSelected(true);
          this.selectedEntities.add(clickedEntity);
        }
        this.emitSelectionChanged();
      } else {
        // Regular click on entity
        if (!this.selectedEntities.has(clickedEntity)) {
          // Select this entity if not already selected
          this.clearSelection();
          clickedEntity.setSelected(true);
          this.selectedEntities.add(clickedEntity);
          this.emitSelectionChanged();
        }

        // Start dragging the selected entities
        this.startDrag(snappedPoint);
      }
    } else {
      // Clicking on empty space: start box selection
      if (!event.shiftKey) {
        this.clearSelection();
      }
      this.selectionStart = snappedPoint;
      this.selectionEnd = snappedPoint;
      this.isBoxSelecting = true;
      this.state = ToolState.PREVIEW;
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    const worldPos = this.applySnap(event.worldPos);

    // If dragging, update drag position
    if (this.isDragging) {
      this.dragCurrentPoint = worldPos;
      this.updateDrag();
      this.viewport.requestRedraw();
      return;
    }

    // Update hover entity for visual feedback
    this.hoverEntity = this.findEntityAtPoint(worldPos);

    if (this.isBoxSelecting && this.selectionStart) {
      // Update selection box
      this.selectionEnd = worldPos;
      this.viewport.requestRedraw();
    }
  }

  onMouseUp(event: MouseEventData): void {
    if (this.isBoxSelecting && this.selectionStart && this.selectionEnd) {
      // Complete box selection
      const min = new Vector2(
        Math.min(this.selectionStart.x, this.selectionEnd.x),
        Math.min(this.selectionStart.y, this.selectionEnd.y)
      );
      const max = new Vector2(
        Math.max(this.selectionStart.x, this.selectionEnd.x),
        Math.max(this.selectionStart.y, this.selectionEnd.y)
      );

      // Find entities within selection box
      const entitiesInBox = this.allEntities.filter(entity =>
        entity.intersectsRectangle(min, max)
      );

      if (event.shiftKey) {
        // Add to selection
        entitiesInBox.forEach(entity => {
          entity.setSelected(true);
          this.selectedEntities.add(entity);
        });
      } else {
        // Replace selection
        entitiesInBox.forEach(entity => {
          entity.setSelected(true);
          this.selectedEntities.add(entity);
        });
      }

      this.isBoxSelecting = false;
      this.selectionStart = null;
      this.selectionEnd = null;
      this.state = ToolState.ACTIVE;
      this.emitSelectionChanged();
      this.viewport.requestRedraw();
    }
  }

  onKeyDown(event: KeyEventData): boolean {
    // ESC to cancel drag or clear selection
    if (event.key === 'Escape') {
      if (this.isDragging) {
        this.cancelDrag();
        this.viewport.requestRedraw();
        return true;
      }
      if (this.selectedEntities.size > 0) {
        this.clearSelection();
        this.viewport.requestRedraw();
        return true;
      }
    }

    // Delete selected entities
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedEntities.size > 0 && !this.isDragging) {
        // Emit deletion event (the demo will handle actual deletion)
        const entitiesToDelete = Array.from(this.selectedEntities);
        this.emit('entitiesDeleted', entitiesToDelete);
        this.clearSelection();
        return true;
      }
    }

    // Ctrl+A to select all
    if (event.ctrlKey && event.key === 'a') {
      this.clearSelection();
      this.allEntities.forEach(entity => {
        entity.setSelected(true);
        this.selectedEntities.add(entity);
      });
      this.viewport.requestRedraw();
      return true;
    }

    return super.onKeyDown(event);
  }

  /**
   * Find entity at a point (within tolerance)
   */
  private findEntityAtPoint(point: Vector2, tolerance: number = 0.2): Entity | null {
    // Search in reverse order (top to bottom in Z-order)
    for (let i = this.allEntities.length - 1; i >= 0; i--) {
      const entity = this.allEntities[i];
      if (entity.containsPoint(point, tolerance)) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Start dragging selected entities
   */
  private startDrag(startPoint: Vector2): void {
    if (this.selectedEntities.size === 0) return;

    this.isDragging = true;
    this.dragStartPoint = startPoint.clone();
    this.dragCurrentPoint = startPoint.clone();
    this.dragLastPoint = startPoint.clone();

    // Store the original positions/offsets for each entity
    this.entityDragOffsets.clear();
    this.selectedEntities.forEach(entity => {
      const bbox = entity.getBoundingBox();
      const center = new Vector2(
        (bbox.min.x + bbox.max.x) / 2,
        (bbox.min.y + bbox.max.y) / 2
      );
      // Store offset from drag start to entity center
      const offset = Vector2.fromPoints(startPoint, center);
      this.entityDragOffsets.set(entity, offset);
    });

    this.state = ToolState.PREVIEW;
  }

  /**
   * Update dragging - move entities to follow cursor
   */
  private updateDrag(): void {
    if (!this.isDragging || !this.dragLastPoint || !this.dragCurrentPoint) return;

    // Calculate incremental delta from last position to current
    const delta = Vector2.fromPoints(this.dragLastPoint, this.dragCurrentPoint);

    // Only apply if there's actual movement
    if (delta.length() > 0.001) {
      // Apply incremental delta to each selected entity
      this.selectedEntities.forEach(entity => {
        this.moveEntity(entity, delta);
      });

      // Update last point
      this.dragLastPoint = this.dragCurrentPoint.clone();
    }
  }

  /**
   * Complete the drag operation
   */
  private completeDrag(): void {
    if (!this.isDragging) return;

    // Emit event that entities were modified
    const modifiedEntities = Array.from(this.selectedEntities);
    this.emit('entitiesModified', modifiedEntities);

    // Reset drag state
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragCurrentPoint = null;
    this.dragLastPoint = null;
    this.entityDragOffsets.clear();
    this.state = ToolState.ACTIVE;
  }

  /**
   * Cancel the drag operation
   */
  private cancelDrag(): void {
    if (!this.isDragging || !this.dragStartPoint || !this.dragLastPoint) return;

    // Calculate reverse delta to undo the drag
    const delta = Vector2.fromPoints(this.dragLastPoint, this.dragStartPoint);

    // Move entities back to original positions
    this.selectedEntities.forEach(entity => {
      this.moveEntity(entity, delta);
    });

    // Reset drag state
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragCurrentPoint = null;
    this.dragLastPoint = null;
    this.entityDragOffsets.clear();
    this.state = ToolState.ACTIVE;
  }

  /**
   * Move an entity by a delta
   */
  private moveEntity(entity: Entity, delta: Vector2): void {
    // Use the entity's transform method to apply translation
    const translationMatrix = {
      a: 1, b: 0, c: 0,
      d: 1, e: delta.x, f: delta.y,
    };
    entity.transform(translationMatrix);

    // Update snap manager
    this.snapManager.removeEntity(entity);
    this.snapManager.addEntity(entity);
  }

  /**
   * Emit custom events
   */
  private emit(event: string, data: any): void {
    // Create a custom event on the viewport canvas
    const customEvent = new CustomEvent(event, { detail: data });
    this.viewport.getCanvas().dispatchEvent(customEvent);
  }

  protected onReset(): void {
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isBoxSelecting = false;
    this.hoverEntity = null;

    // Cancel any active drag
    if (this.isDragging) {
      this.cancelDrag();
    }
  }

  protected onActivate(): void {
    // Keep selections when activating
  }

  protected onDeactivate(): void {
    // Clear selections when switching away
    this.clearSelection();
    this.viewport.requestRedraw();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render selection box if actively selecting
    if (this.isBoxSelecting && this.selectionStart && this.selectionEnd) {
      const startScreen = this.viewport.worldToScreen(this.selectionStart);
      const endScreen = this.viewport.worldToScreen(this.selectionEnd);

      ctx.save();

      // Draw selection box
      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const width = Math.abs(endScreen.x - startScreen.x);
      const height = Math.abs(endScreen.y - startScreen.y);

      // Fill
      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
      ctx.fillRect(x, y, width, height);

      // Border
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);

      ctx.restore();
    }

    // Highlight hover entity
    if (this.hoverEntity && !this.selectedEntities.has(this.hoverEntity)) {
      ctx.save();

      const bbox = this.hoverEntity.getBoundingBox();
      const minScreen = this.viewport.worldToScreen(bbox.min);
      const maxScreen = this.viewport.worldToScreen(bbox.max);

      const x = Math.min(minScreen.x, maxScreen.x) - 5;
      const y = Math.min(minScreen.y, maxScreen.y) - 5;
      const width = Math.abs(maxScreen.x - minScreen.x) + 10;
      const height = Math.abs(maxScreen.y - minScreen.y) + 10;

      ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);

      ctx.restore();
    }
  }

  getCursor(): string {
    if (this.isDragging) {
      return 'move';
    }
    return this.hoverEntity ? 'pointer' : 'default';
  }
}
