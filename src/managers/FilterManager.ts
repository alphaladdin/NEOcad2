/**
 * FilterManager - Manages filter rules and applies them to BIM elements
 */

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { FilterRule, FilterCondition, FilterLogic } from '@tools/FilterRule';

export interface FilterManagerConfig {
  defaultColor?: THREE.Color;
  highlightFiltered?: boolean;
}

export class FilterManager {
  private filters: Map<string, FilterRule> = new Map();
  private scene: THREE.Scene;
  private components: OBC.Components;
  private config: FilterManagerConfig;
  private elementDataCache: Map<string, Record<string, any>> = new Map();
  private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();
  private activeFilterId: string | null = null;

  constructor(scene: THREE.Scene, components: OBC.Components, config: FilterManagerConfig = {}) {
    this.scene = scene;
    this.components = components;
    this.config = {
      defaultColor: config.defaultColor || new THREE.Color(0x3498db),
      highlightFiltered: config.highlightFiltered !== false,
    };

    logger.info('FilterManager', 'FilterManager created');
  }

  /**
   * Extract element data from fragments model (Fragments 3.2 API)
   */
  private async extractElementData(model: FRAGS.FragmentsModel): Promise<Map<string, Record<string, any>>> {
    const elementData = new Map<string, Record<string, any>>();

    try {
      // Get all item IDs with geometry
      const itemIds = await model.getItemsIdsWithGeometry();

      // For each item, get its data
      for (const localId of itemIds) {
        try {
          // Use FragmentsManager.getData to get item properties
          // This returns a record with all the item's attributes
          const itemDataArray = await this.components.get(OBC.FragmentsManager).getData({
            [model.modelId]: [localId]
          });

          if (itemDataArray && itemDataArray[model.modelId]) {
            const itemData = itemDataArray[model.modelId][0];
            if (itemData) {
              elementData.set(`${model.modelId}_${localId}`, {
                modelId: model.modelId,
                localId,
                ...itemData
              });
            }
          }
        } catch (error) {
          logger.debug('FilterManager', `Error getting data for item ${localId}:`, error);
        }
      }

      logger.debug('FilterManager', `Extracted data for ${elementData.size} elements from model ${model.modelId}`);
    } catch (error) {
      logger.error('FilterManager', 'Error extracting element data:', error);
    }

    return elementData;
  }

  /**
   * Build element data cache from loaded models
   */
  async buildElementCache(): Promise<void> {
    this.elementDataCache.clear();

    // Get all loaded fragment groups
    const fragmentsManager = this.components.get(OBC.FragmentsManager);
    const models = fragmentsManager.list;

    for (const [modelId, model] of models) {
      const elementData = await this.extractElementData(model);
      elementData.forEach((data, id) => {
        this.elementDataCache.set(id, data);
      });
    }

    logger.info('FilterManager', `Built cache with ${this.elementDataCache.size} elements`);
  }

  /**
   * Create a new filter rule
   */
  createFilter(
    name: string,
    description: string = '',
    conditions: FilterCondition[] = [],
    logic: FilterLogic = 'AND'
  ): FilterRule {
    const filter = new FilterRule(name, description, conditions, logic);
    this.filters.set(filter.id, filter);

    logger.info('FilterManager', `Created filter: ${name}`);
    eventBus.emit(Events.FILTER_CREATED, { filter });

    return filter;
  }

  /**
   * Apply a filter rule to elements
   */
  async applyFilter(filterId: string): Promise<void> {
    const filter = this.filters.get(filterId);
    if (!filter) {
      logger.warn('FilterManager', `Filter ${filterId} not found`);
      return;
    }

    // Build cache if empty
    if (this.elementDataCache.size === 0) {
      await this.buildElementCache();
    }

    // Clear previous active filter
    if (this.activeFilterId && this.activeFilterId !== filterId) {
      this.clearFilter();
    }

    // Find matching elements
    const matchedElements: string[] = [];
    this.elementDataCache.forEach((data, elementId) => {
      if (filter.matches(data)) {
        matchedElements.push(elementId);
      }
    });

    // Cache matched elements
    filter.setMatchedElements(matchedElements);

    logger.info('FilterManager', `Filter "${filter.name}" matched ${matchedElements.length} elements`);

    // Apply visualization
    if (filter.isolate) {
      this.isolateElements(matchedElements);
    } else if (filter.color) {
      this.highlightElements(matchedElements, filter.color);
    } else if (!filter.visible) {
      this.hideElements(matchedElements);
    } else {
      this.showElements(matchedElements);
    }

    this.activeFilterId = filterId;
    eventBus.emit(Events.FILTER_APPLIED, { filter, matchedCount: matchedElements.length });
  }

  /**
   * Clear active filter
   */
  clearFilter(): void {
    if (!this.activeFilterId) {
      return;
    }

    // Restore original materials and visibility
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const elementId = object.userData.fragmentID || object.uuid;

        // Restore material
        if (this.originalMaterials.has(elementId)) {
          object.material = this.originalMaterials.get(elementId)!;
          this.originalMaterials.delete(elementId);
        }

        // Restore visibility
        object.visible = true;
      }
    });

    logger.info('FilterManager', 'Cleared active filter');
    this.activeFilterId = null;
    eventBus.emit(Events.FILTER_CLEARED);
  }

  /**
   * Highlight elements with a color
   */
  private highlightElements(elementIds: string[], color: THREE.Color): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const elementId = object.userData.fragmentID || object.uuid;

        if (elementIds.includes(elementId)) {
          // Store original material
          if (!this.originalMaterials.has(elementId)) {
            this.originalMaterials.set(elementId, object.material);
          }

          // Apply highlight material
          const highlightMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
          });
          object.material = highlightMaterial;
        }
      }
    });

    logger.debug('FilterManager', `Highlighted ${elementIds.length} elements`);
  }

  /**
   * Isolate elements (hide everything else)
   */
  private isolateElements(elementIds: string[]): void {
    const elementSet = new Set(elementIds);

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const elementId = object.userData.fragmentID || object.uuid;

        if (elementSet.has(elementId)) {
          object.visible = true;
        } else {
          object.visible = false;
        }
      }
    });

    logger.debug('FilterManager', `Isolated ${elementIds.length} elements`);
  }

  /**
   * Hide elements
   */
  private hideElements(elementIds: string[]): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const elementId = object.userData.fragmentID || object.uuid;

        if (elementIds.includes(elementId)) {
          object.visible = false;
        }
      }
    });

    logger.debug('FilterManager', `Hid ${elementIds.length} elements`);
  }

  /**
   * Show elements
   */
  private showElements(elementIds: string[]): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const elementId = object.userData.fragmentID || object.uuid;

        if (elementIds.includes(elementId)) {
          object.visible = true;
        }
      }
    });

    logger.debug('FilterManager', `Showed ${elementIds.length} elements`);
  }

  /**
   * Update a filter rule
   */
  updateFilter(filterId: string): void {
    const filter = this.filters.get(filterId);
    if (!filter) {
      logger.warn('FilterManager', `Filter ${filterId} not found`);
      return;
    }

    // Clear matched elements cache
    filter.clearMatchedElements();

    // Re-apply if this is the active filter
    if (this.activeFilterId === filterId) {
      this.clearFilter();
      this.applyFilter(filterId);
    }

    logger.info('FilterManager', `Updated filter: ${filter.name}`);
    eventBus.emit(Events.FILTER_UPDATED, { filter });
  }

  /**
   * Remove a filter rule
   */
  removeFilter(filterId: string): void {
    const filter = this.filters.get(filterId);
    if (!filter) {
      logger.warn('FilterManager', `Filter ${filterId} not found`);
      return;
    }

    // Clear if this is the active filter
    if (this.activeFilterId === filterId) {
      this.clearFilter();
    }

    this.filters.delete(filterId);

    logger.info('FilterManager', `Removed filter: ${filter.name}`);
    eventBus.emit(Events.FILTER_REMOVED, { id: filterId });
  }

  /**
   * Get all filters
   */
  getAllFilters(): FilterRule[] {
    return Array.from(this.filters.values());
  }

  /**
   * Get a filter by ID
   */
  getFilter(filterId: string): FilterRule | undefined {
    return this.filters.get(filterId);
  }

  /**
   * Get active filter
   */
  getActiveFilter(): FilterRule | null {
    if (this.activeFilterId) {
      return this.filters.get(this.activeFilterId) || null;
    }
    return null;
  }

  /**
   * Get available properties from cache
   */
  getAvailableProperties(): string[] {
    const properties = new Set<string>();

    this.elementDataCache.forEach((data) => {
      Object.keys(data).forEach((key) => {
        properties.add(key);
      });
    });

    return Array.from(properties).sort();
  }

  /**
   * Get unique values for a property
   */
  getUniqueValuesForProperty(property: string): any[] {
    const values = new Set<any>();

    this.elementDataCache.forEach((data) => {
      const value = data[property];
      if (value !== undefined && value !== null) {
        values.add(value);
      }
    });

    return Array.from(values).sort();
  }

  /**
   * Export all filters
   */
  exportFilters(): string {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      filters: this.getAllFilters().map((f) => f.toJSON()),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import filters from JSON
   */
  importFilters(json: string): void {
    try {
      const data = JSON.parse(json);
      if (!data.filters || !Array.isArray(data.filters)) {
        throw new Error('Invalid filter data');
      }

      data.filters.forEach((filterData: any) => {
        const filter = FilterRule.fromJSON(filterData);
        this.filters.set(filter.id, filter);
      });

      logger.info('FilterManager', `Imported ${data.filters.length} filters`);
      eventBus.emit(Events.FILTERS_IMPORTED, { count: data.filters.length });
    } catch (error) {
      logger.error('FilterManager', 'Failed to import filters', error);
      throw error;
    }
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.clearFilter();
    this.filters.clear();
    logger.info('FilterManager', 'Cleared all filters');
    eventBus.emit(Events.FILTERS_CLEARED);
  }

  /**
   * Get filter statistics
   */
  getStatistics(): {
    totalFilters: number;
    activeFilter: string | null;
    cachedElements: number;
  } {
    return {
      totalFilters: this.filters.size,
      activeFilter: this.activeFilterId,
      cachedElements: this.elementDataCache.size,
    };
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clearFilter();
    this.filters.clear();
    this.elementDataCache.clear();
    this.originalMaterials.clear();
    logger.info('FilterManager', 'FilterManager disposed');
  }
}
