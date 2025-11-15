/**
 * SelectionManager - Centralized selection management for IFC elements and 3D objects
 * Provides multi-selection, box selection, and selection state tracking
 */

import * as THREE from 'three';
import * as FRAGS from '@thatopen/fragments';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface SelectionItem {
  object: THREE.Object3D;
  model?: FRAGS.FragmentsModel;
  expressID?: number;
}

export interface SelectionState {
  items: SelectionItem[];
  mode: 'single' | 'multi' | 'range';
}

export class SelectionManager {
  // Current selection state
  private selectedItems: Map<string, SelectionItem> = new Map();
  private lastSelectedIndex: number = -1;

  // Selection mode flags
  private isMultiSelectMode: boolean = false;
  private isRangeSelectMode: boolean = false;

  // Box selection state
  private isBoxSelecting: boolean = false;
  private boxSelectStart: THREE.Vector2 | null = null;
  private boxSelectEnd: THREE.Vector2 | null = null;

  constructor() {
    logger.info('SelectionManager', 'SelectionManager initialized');
  }

  /**
   * Generate unique key for selection item
   */
  private getItemKey(item: SelectionItem): string {
    if (item.model && item.expressID !== undefined) {
      // FragmentsModel may not have uuid property, use any type cast
      const modelId = (item.model as any).uuid || (item.model as any).id || 'unknown';
      return `${modelId}_${item.expressID}`;
    }
    return item.object.uuid;
  }

  /**
   * Select a single element
   */
  selectElement(
    object: THREE.Object3D,
    model?: FRAGS.FragmentsModel,
    expressID?: number,
    source: string = 'viewport'
  ): void {
    const item: SelectionItem = { object, model, expressID };
    const key = this.getItemKey(item);

    // If not in multi-select mode, clear previous selections
    if (!this.isMultiSelectMode && !this.isRangeSelectMode) {
      this.clearSelection(source);
    }

    // Add to selection
    this.selectedItems.set(key, item);

    logger.info('SelectionManager', `Selected element: ${key}`);

    // Emit selection event
    const eventData: any = { object, source };
    if (model) eventData.model = model;
    if (expressID !== undefined) eventData.expressID = expressID;

    eventBus.emit(Events.OBJECT_SELECTED, eventData);

    // Emit selection changed event with all selected items
    this.emitSelectionChanged(source);
  }

  /**
   * Deselect a single element
   */
  deselectElement(
    object: THREE.Object3D,
    model?: FRAGS.FragmentsModel,
    expressID?: number,
    source: string = 'viewport'
  ): void {
    const item: SelectionItem = { object, model, expressID };
    const key = this.getItemKey(item);

    if (!this.selectedItems.has(key)) return;

    this.selectedItems.delete(key);

    logger.info('SelectionManager', `Deselected element: ${key}`);

    // Emit deselection event
    eventBus.emit(Events.OBJECT_DESELECTED, { object, source });

    // Emit selection changed event
    this.emitSelectionChanged(source);
  }

  /**
   * Toggle element selection
   */
  toggleElement(
    object: THREE.Object3D,
    model?: FRAGS.FragmentsModel,
    expressID?: number,
    source: string = 'viewport'
  ): void {
    const item: SelectionItem = { object, model, expressID };
    const key = this.getItemKey(item);

    if (this.selectedItems.has(key)) {
      this.deselectElement(object, model, expressID, source);
    } else {
      this.selectElement(object, model, expressID, source);
    }
  }

  /**
   * Select multiple elements
   */
  selectMultiple(
    items: SelectionItem[],
    source: string = 'viewport',
    clearPrevious: boolean = true
  ): void {
    if (clearPrevious) {
      this.clearSelection(source);
    }

    items.forEach((item) => {
      const key = this.getItemKey(item);
      this.selectedItems.set(key, item);
    });

    logger.info('SelectionManager', `Selected ${items.length} elements`);

    // Emit selection changed event
    this.emitSelectionChanged(source);
  }

  /**
   * Clear all selections
   */
  clearSelection(source: string = 'viewport'): void {
    if (this.selectedItems.size === 0) return;

    this.selectedItems.clear();
    this.lastSelectedIndex = -1;

    logger.info('SelectionManager', 'Selection cleared');

    eventBus.emit(Events.SELECTION_CLEARED, { source });
  }

  /**
   * Get all selected elements
   */
  getSelectedElements(): SelectionItem[] {
    return Array.from(this.selectedItems.values());
  }

  /**
   * Get selected element count
   */
  getSelectionCount(): number {
    return this.selectedItems.size;
  }

  /**
   * Check if element is selected
   */
  isSelected(object: THREE.Object3D, model?: FRAGS.FragmentsModel, expressID?: number): boolean {
    const item: SelectionItem = { object, model, expressID };
    const key = this.getItemKey(item);
    return this.selectedItems.has(key);
  }

  /**
   * Get selected IFC elements grouped by model
   */
  getSelectedByModel(): Map<FRAGS.FragmentsModel, Set<number>> {
    const grouped = new Map<FRAGS.FragmentsModel, Set<number>>();

    this.selectedItems.forEach((item) => {
      if (item.model && item.expressID !== undefined) {
        if (!grouped.has(item.model)) {
          grouped.set(item.model, new Set());
        }
        grouped.get(item.model)!.add(item.expressID);
      }
    });

    return grouped;
  }

  /**
   * Enable multi-select mode (Ctrl key)
   */
  enableMultiSelectMode(): void {
    this.isMultiSelectMode = true;
    logger.debug('SelectionManager', 'Multi-select mode enabled');
  }

  /**
   * Disable multi-select mode
   */
  disableMultiSelectMode(): void {
    this.isMultiSelectMode = false;
    logger.debug('SelectionManager', 'Multi-select mode disabled');
  }

  /**
   * Enable range select mode (Shift key)
   */
  enableRangeSelectMode(): void {
    this.isRangeSelectMode = true;
    logger.debug('SelectionManager', 'Range select mode enabled');
  }

  /**
   * Disable range select mode
   */
  disableRangeSelectMode(): void {
    this.isRangeSelectMode = false;
    logger.debug('SelectionManager', 'Range select mode disabled');
  }

  /**
   * Check if multi-select mode is active
   */
  isMultiSelectActive(): boolean {
    return this.isMultiSelectMode;
  }

  /**
   * Check if range select mode is active
   */
  isRangeSelectActive(): boolean {
    return this.isRangeSelectMode;
  }

  /**
   * Start box selection
   */
  startBoxSelection(start: THREE.Vector2): void {
    this.isBoxSelecting = true;
    this.boxSelectStart = start.clone();
    this.boxSelectEnd = start.clone();
    logger.debug('SelectionManager', 'Box selection started', start);
  }

  /**
   * Update box selection
   */
  updateBoxSelection(end: THREE.Vector2): void {
    if (!this.isBoxSelecting || !this.boxSelectStart) return;
    this.boxSelectEnd = end.clone();
  }

  /**
   * End box selection
   */
  endBoxSelection(): THREE.Box2 | null {
    if (!this.isBoxSelecting || !this.boxSelectStart || !this.boxSelectEnd) {
      this.isBoxSelecting = false;
      return null;
    }

    this.isBoxSelecting = false;

    // Create box from start and end points
    const box = new THREE.Box2();
    box.setFromPoints([this.boxSelectStart, this.boxSelectEnd]);

    logger.debug('SelectionManager', 'Box selection ended', box);

    // Reset box selection state
    this.boxSelectStart = null;
    this.boxSelectEnd = null;

    return box;
  }

  /**
   * Cancel box selection
   */
  cancelBoxSelection(): void {
    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.boxSelectEnd = null;
    logger.debug('SelectionManager', 'Box selection cancelled');
  }

  /**
   * Check if box selection is active
   */
  isBoxSelectionActive(): boolean {
    return this.isBoxSelecting;
  }

  /**
   * Get current box selection bounds (for visual feedback)
   */
  getBoxSelectionBounds(): THREE.Box2 | null {
    if (!this.isBoxSelecting || !this.boxSelectStart || !this.boxSelectEnd) {
      return null;
    }

    const box = new THREE.Box2();
    box.setFromPoints([this.boxSelectStart, this.boxSelectEnd]);
    return box;
  }

  /**
   * Select range of elements (for tree view)
   */
  selectRange(
    startIndex: number,
    endIndex: number,
    allItems: SelectionItem[],
    source: string = 'tree'
  ): void {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    const rangeItems = allItems.slice(start, end + 1);
    this.selectMultiple(rangeItems, source, false);

    this.lastSelectedIndex = endIndex;

    logger.info('SelectionManager', `Selected range: ${start} to ${end} (${rangeItems.length} items)`);
  }

  /**
   * Get selection state for serialization
   */
  getSelectionState(): SelectionState {
    const items = this.getSelectedElements();
    let mode: 'single' | 'multi' | 'range' = 'single';

    if (items.length > 1) {
      mode = this.isRangeSelectMode ? 'range' : 'multi';
    }

    return { items, mode };
  }

  /**
   * Restore selection state
   */
  restoreSelectionState(state: SelectionState, source: string = 'restore'): void {
    this.clearSelection(source);
    this.selectMultiple(state.items, source, false);
    logger.info('SelectionManager', `Restored selection state: ${state.items.length} items`);
  }

  /**
   * Emit selection changed event with current state
   */
  private emitSelectionChanged(source: string = 'viewport'): void {
    const selected = this.getSelectedElements();

    eventBus.emit(Events.SELECTION_CHANGED, {
      selected,
      count: selected.length,
      source,
    });
  }

  /**
   * Filter selected elements by predicate
   */
  filterSelection(predicate: (item: SelectionItem) => boolean): SelectionItem[] {
    return this.getSelectedElements().filter(predicate);
  }

  /**
   * Get selected elements of specific IFC type
   */
  getSelectedByType(ifcType: string): SelectionItem[] {
    return this.filterSelection((item) => {
      // Check if item has IFC type information in userData
      const userData = item.object.userData;
      return userData && userData.type?.toUpperCase().includes(ifcType.toUpperCase());
    });
  }

  /**
   * Dispose selection manager
   */
  dispose(): void {
    this.clearSelection();
    logger.info('SelectionManager', 'SelectionManager disposed');
  }
}
