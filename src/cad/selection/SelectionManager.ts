import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';

/**
 * Selection mode
 */
export enum SelectionMode {
  SINGLE = 'single',
  WINDOW = 'window',
  CROSSING = 'crossing',
  FENCE = 'fence',
  ALL = 'all',
}

/**
 * Selection filter
 */
export interface SelectionFilter {
  entityTypes?: string[];
  layers?: string[];
  colors?: string[];
  locked?: boolean;
  visible?: boolean;
}

/**
 * Selection event data
 */
export interface SelectionEvent {
  added: Entity[];
  removed: Entity[];
  selected: Entity[];
}

/**
 * SelectionManager - Manages entity selection
 */
export class SelectionManager {
  private selectedEntities: Set<Entity> = new Set();
  private allEntities: Entity[] = [];
  private selectionChangedCallbacks: Array<(event: SelectionEvent) => void> = [];
  private filter: SelectionFilter | null = null;

  /**
   * Set all entities available for selection
   */
  setEntities(entities: Entity[]): void {
    this.allEntities = entities;
  }

  /**
   * Get all entities
   */
  getEntities(): Entity[] {
    return this.allEntities;
  }

  /**
   * Select a single entity
   */
  select(entity: Entity, addToSelection: boolean = false): void {
    if (!this.canSelect(entity)) {
      return;
    }

    const wasSelected = this.selectedEntities.has(entity);

    if (!addToSelection) {
      this.clearSelection(true);
    }

    if (!wasSelected) {
      this.selectedEntities.add(entity);
      entity.setSelected(true);

      this.notifySelectionChanged({
        added: [entity],
        removed: [],
        selected: this.getSelectedEntities(),
      });
    }
  }

  /**
   * Deselect a single entity
   */
  deselect(entity: Entity): void {
    if (this.selectedEntities.has(entity)) {
      this.selectedEntities.delete(entity);
      entity.setSelected(false);

      this.notifySelectionChanged({
        added: [],
        removed: [entity],
        selected: this.getSelectedEntities(),
      });
    }
  }

  /**
   * Toggle entity selection
   */
  toggle(entity: Entity): void {
    if (this.selectedEntities.has(entity)) {
      this.deselect(entity);
    } else {
      this.select(entity, true);
    }
  }

  /**
   * Select multiple entities
   */
  selectMultiple(entities: Entity[], addToSelection: boolean = false): void {
    const added: Entity[] = [];

    if (!addToSelection) {
      this.clearSelection(true);
    }

    for (const entity of entities) {
      if (!this.canSelect(entity)) continue;

      if (!this.selectedEntities.has(entity)) {
        this.selectedEntities.add(entity);
        entity.setSelected(true);
        added.push(entity);
      }
    }

    if (added.length > 0) {
      this.notifySelectionChanged({
        added,
        removed: [],
        selected: this.getSelectedEntities(),
      });
    }
  }

  /**
   * Clear selection
   */
  clearSelection(suppressEvent: boolean = false): void {
    const removed = this.getSelectedEntities();

    for (const entity of this.selectedEntities) {
      entity.setSelected(false);
    }

    this.selectedEntities.clear();

    if (!suppressEvent && removed.length > 0) {
      this.notifySelectionChanged({
        added: [],
        removed,
        selected: [],
      });
    }
  }

  /**
   * Select all entities
   */
  selectAll(): void {
    const selectableEntities = this.allEntities.filter((e) => this.canSelect(e));
    this.selectMultiple(selectableEntities, false);
  }

  /**
   * Invert selection
   */
  invertSelection(): void {
    const toSelect: Entity[] = [];
    const toDeselect: Entity[] = [];

    for (const entity of this.allEntities) {
      if (!this.canSelect(entity)) continue;

      if (this.selectedEntities.has(entity)) {
        toDeselect.push(entity);
      } else {
        toSelect.push(entity);
      }
    }

    for (const entity of toDeselect) {
      this.selectedEntities.delete(entity);
      entity.setSelected(false);
    }

    for (const entity of toSelect) {
      this.selectedEntities.add(entity);
      entity.setSelected(true);
    }

    this.notifySelectionChanged({
      added: toSelect,
      removed: toDeselect,
      selected: this.getSelectedEntities(),
    });
  }

  /**
   * Get selected entities
   */
  getSelectedEntities(): Entity[] {
    return Array.from(this.selectedEntities);
  }

  /**
   * Get selected count
   */
  getSelectedCount(): number {
    return this.selectedEntities.size;
  }

  /**
   * Check if entity is selected
   */
  isSelected(entity: Entity): boolean {
    return this.selectedEntities.has(entity);
  }

  /**
   * Check if any entities are selected
   */
  hasSelection(): boolean {
    return this.selectedEntities.size > 0;
  }

  /**
   * Select by point (click)
   */
  selectByPoint(
    point: Vector2,
    addToSelection: boolean = false,
    tolerance: number = 5
  ): Entity | null {
    let closestEntity: Entity | null = null;
    let minDistance = tolerance;

    for (const entity of this.allEntities) {
      if (!this.canSelect(entity)) continue;

      const distance = entity.distanceToPoint(point);
      if (distance < minDistance) {
        minDistance = distance;
        closestEntity = entity;
      }
    }

    if (closestEntity) {
      if (addToSelection) {
        this.toggle(closestEntity);
      } else {
        this.select(closestEntity, false);
      }
    } else if (!addToSelection) {
      this.clearSelection();
    }

    return closestEntity;
  }

  /**
   * Select by window (left-to-right selection box)
   */
  selectByWindow(corner1: Vector2, corner2: Vector2, addToSelection: boolean = false): void {
    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);

    const min = new Vector2(minX, minY);
    const max = new Vector2(maxX, maxY);

    const selected: Entity[] = [];

    for (const entity of this.allEntities) {
      if (!this.canSelect(entity)) continue;

      // Window selection: entity must be completely inside
      const bbox = entity.getBoundingBox();
      if (
        bbox.min.x >= min.x &&
        bbox.max.x <= max.x &&
        bbox.min.y >= min.y &&
        bbox.max.y <= max.y
      ) {
        selected.push(entity);
      }
    }

    this.selectMultiple(selected, addToSelection);
  }

  /**
   * Select by crossing (right-to-left selection box)
   */
  selectByCrossing(corner1: Vector2, corner2: Vector2, addToSelection: boolean = false): void {
    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);

    const min = new Vector2(minX, minY);
    const max = new Vector2(maxX, maxY);

    const selected: Entity[] = [];

    for (const entity of this.allEntities) {
      if (!this.canSelect(entity)) continue;

      // Crossing selection: entity can partially intersect
      if (entity.intersectsRectangle(min, max)) {
        selected.push(entity);
      }
    }

    this.selectMultiple(selected, addToSelection);
  }

  /**
   * Select by fence (polyline crossing)
   */
  selectByFence(fencePoints: Vector2[], addToSelection: boolean = false): void {
    const selected: Entity[] = [];

    for (const entity of this.allEntities) {
      if (!this.canSelect(entity)) continue;

      // Check if entity intersects any fence segment
      for (let i = 0; i < fencePoints.length - 1; i++) {
        const p1 = fencePoints[i];
        const p2 = fencePoints[i + 1];

        // Simple bounding box check for performance
        const bbox = entity.getBoundingBox();
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (
          bbox.max.x >= minX &&
          bbox.min.x <= maxX &&
          bbox.max.y >= minY &&
          bbox.min.y <= maxY
        ) {
          selected.push(entity);
          break;
        }
      }
    }

    this.selectMultiple(selected, addToSelection);
  }

  /**
   * Set selection filter
   */
  setFilter(filter: SelectionFilter | null): void {
    this.filter = filter;
  }

  /**
   * Get selection filter
   */
  getFilter(): SelectionFilter | null {
    return this.filter;
  }

  /**
   * Clear selection filter
   */
  clearFilter(): void {
    this.filter = null;
  }

  /**
   * Check if entity can be selected based on filter
   */
  private canSelect(entity: Entity): boolean {
    if (!this.filter) {
      return !entity.isLocked() && entity.isVisible();
    }

    // Check locked state
    if (this.filter.locked !== undefined && entity.isLocked() !== this.filter.locked) {
      return false;
    }

    // Check visible state
    if (this.filter.visible !== undefined && entity.isVisible() !== this.filter.visible) {
      return false;
    }

    // Check entity types
    if (this.filter.entityTypes && this.filter.entityTypes.length > 0) {
      if (!this.filter.entityTypes.includes(entity.getType())) {
        return false;
      }
    }

    // Check layers
    if (this.filter.layers && this.filter.layers.length > 0) {
      if (!this.filter.layers.includes(entity.getLayer())) {
        return false;
      }
    }

    // Check colors
    if (this.filter.colors && this.filter.colors.length > 0) {
      const color = entity.getColor();
      if (!color || !this.filter.colors.includes(color)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add selection changed callback
   */
  onSelectionChanged(callback: (event: SelectionEvent) => void): void {
    this.selectionChangedCallbacks.push(callback);
  }

  /**
   * Remove selection changed callback
   */
  offSelectionChanged(callback: (event: SelectionEvent) => void): void {
    const index = this.selectionChangedCallbacks.indexOf(callback);
    if (index > -1) {
      this.selectionChangedCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify selection changed
   */
  private notifySelectionChanged(event: SelectionEvent): void {
    for (const callback of this.selectionChangedCallbacks) {
      callback(event);
    }
  }

  /**
   * Get selection statistics
   */
  getSelectionStats(): {
    count: number;
    types: Map<string, number>;
    layers: Map<string, number>;
  } {
    const types = new Map<string, number>();
    const layers = new Map<string, number>();

    for (const entity of this.selectedEntities) {
      const type = entity.getType();
      types.set(type, (types.get(type) || 0) + 1);

      const layer = entity.getLayer();
      layers.set(layer, (layers.get(layer) || 0) + 1);
    }

    return {
      count: this.selectedEntities.size,
      types,
      layers,
    };
  }
}
