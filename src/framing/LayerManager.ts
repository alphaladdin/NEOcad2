/**
 * LayerManager - Singleton manager for organizing building elements into layers
 * Provides standard architectural layers similar to AutoCAD/Revit
 */

import { Layer, LayerType, LayerConfig } from './Layer';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

/**
 * Layer query filter interface
 */
export interface LayerFilter {
  type?: LayerType;
  visible?: boolean;
  locked?: boolean;
  hasElements?: boolean;
}

/**
 * Singleton manager for layer system
 */
export class LayerManager {
  private static instance: LayerManager | null = null;
  private layers: Map<string, Layer> = new Map();
  private currentLayerId: string = 'A-WALL-INTR';
  private elementLayerMap: Map<string, string> = new Map(); // elementId -> layerId

  private constructor() {
    this.initializeStandardLayers();
    logger.info('LayerManager', 'LayerManager initialized with standard architectural layers');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LayerManager {
    if (!LayerManager.instance) {
      LayerManager.instance = new LayerManager();
    }
    return LayerManager.instance;
  }

  /**
   * Initialize standard architectural layers
   * Following AIA CAD Layer Guidelines
   */
  private initializeStandardLayers(): void {
    // Exterior Walls Layer
    this.addLayer({
      id: 'A-WALL-EXTR',
      name: 'Exterior Walls',
      type: LayerType.EXTERIOR_WALLS,
      color: 0x8B7355, // Brown
      description: 'Exterior building walls',
      lineWeight: 2.0,
      plotStyle: 'Bold',
    });

    // Interior Walls Layer
    this.addLayer({
      id: 'A-WALL-INTR',
      name: 'Interior Walls',
      type: LayerType.INTERIOR_WALLS,
      color: 0xCCCCCC, // Light gray
      description: 'Interior partition walls',
      lineWeight: 1.0,
      plotStyle: 'Normal',
    });

    // Structural Walls Layer
    this.addLayer({
      id: 'A-WALL-STRC',
      name: 'Structural Walls',
      type: LayerType.STRUCTURAL_WALLS,
      color: 0xAAAAAA, // Medium gray
      description: 'Load-bearing structural walls',
      lineWeight: 1.5,
      plotStyle: 'Bold',
    });

    // Partitions Layer
    this.addLayer({
      id: 'A-WALL-PART',
      name: 'Partitions',
      type: LayerType.PARTITIONS,
      color: 0xDDDDDD, // Very light gray
      description: 'Non-structural partition walls',
      lineWeight: 0.5,
      plotStyle: 'Normal',
    });

    // Doors Layer
    this.addLayer({
      id: 'A-DOOR',
      name: 'Doors',
      type: LayerType.DOORS,
      color: 0x8B4513, // Saddle brown
      description: 'Door elements',
      lineWeight: 1.0,
      plotStyle: 'Normal',
    });

    // Windows Layer
    this.addLayer({
      id: 'A-WIND',
      name: 'Windows',
      type: LayerType.WINDOWS,
      color: 0x87CEEB, // Sky blue
      description: 'Window elements',
      lineWeight: 1.0,
      plotStyle: 'Normal',
    });

    // Columns Layer
    this.addLayer({
      id: 'A-COLS',
      name: 'Columns',
      type: LayerType.COLUMNS,
      color: 0x696969, // Dim gray
      description: 'Structural columns',
      lineWeight: 1.5,
      plotStyle: 'Bold',
    });

    // Floors Layer
    this.addLayer({
      id: 'A-FLOR',
      name: 'Floors',
      type: LayerType.FLOORS,
      color: 0xD2B48C, // Tan
      description: 'Floor elements',
      lineWeight: 0.5,
      plotStyle: 'Normal',
    });

    // Ceilings Layer
    this.addLayer({
      id: 'A-CLNG',
      name: 'Ceilings',
      type: LayerType.CEILINGS,
      color: 0xF5F5DC, // Beige
      description: 'Ceiling elements',
      lineWeight: 0.5,
      plotStyle: 'Normal',
    });

    // Roof Layer
    this.addLayer({
      id: 'A-ROOF',
      name: 'Roof',
      type: LayerType.ROOF,
      color: 0x8B0000, // Dark red
      description: 'Roof elements',
      lineWeight: 1.5,
      plotStyle: 'Bold',
    });

    // Stairs Layer
    this.addLayer({
      id: 'A-STRS',
      name: 'Stairs',
      type: LayerType.STAIRS,
      color: 0x556B2F, // Dark olive green
      description: 'Stair elements',
      lineWeight: 1.0,
      plotStyle: 'Normal',
    });

    // Furniture Layer
    this.addLayer({
      id: 'A-FURN',
      name: 'Furniture',
      type: LayerType.FURNITURE,
      color: 0xDDA0DD, // Plum
      description: 'Furniture elements',
      lineWeight: 0.5,
      plotStyle: 'Normal',
    });

    // Equipment Layer
    this.addLayer({
      id: 'A-EQUP',
      name: 'Equipment',
      type: LayerType.EQUIPMENT,
      color: 0xFF6347, // Tomato
      description: 'Equipment and fixtures',
      lineWeight: 0.5,
      plotStyle: 'Normal',
    });

    // Annotations Layer
    this.addLayer({
      id: 'A-ANNO',
      name: 'Annotations',
      type: LayerType.ANNOTATIONS,
      color: 0x000000, // Black
      description: 'Text annotations and labels',
      lineWeight: 0.25,
      plotStyle: 'Normal',
    });

    // Dimensions Layer
    this.addLayer({
      id: 'A-DIMS',
      name: 'Dimensions',
      type: LayerType.DIMENSIONS,
      color: 0xFF0000, // Red
      description: 'Dimension lines and text',
      lineWeight: 0.25,
      plotStyle: 'Normal',
    });

    // Grid Layer
    this.addLayer({
      id: 'A-GRID',
      name: 'Grid',
      type: LayerType.GRID,
      color: 0x00FF00, // Green
      description: 'Reference grid lines',
      lineWeight: 0.25,
      plotStyle: 'Normal',
    });

    logger.info('LayerManager', `Loaded ${this.layers.size} standard architectural layers`);
  }

  /**
   * Add a new layer
   */
  addLayer(config: LayerConfig): Layer {
    const layer = new Layer(config);
    this.layers.set(layer.id, layer);

    eventBus.emit(Events.LAYER_ADDED, { layer });
    logger.debug('LayerManager', `Added layer: ${layer.name} (${layer.id})`);

    return layer;
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  /**
   * Get all layers
   */
  getAllLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get layers filtered by criteria
   */
  getLayersByFilter(filter: LayerFilter): Layer[] {
    return this.getAllLayers().filter((layer) => {
      if (filter.type !== undefined && layer.type !== filter.type) {
        return false;
      }
      if (filter.visible !== undefined && layer.visible !== filter.visible) {
        return false;
      }
      if (filter.locked !== undefined && layer.locked !== filter.locked) {
        return false;
      }
      if (filter.hasElements !== undefined) {
        const hasElements = layer.getElementCount() > 0;
        if (hasElements !== filter.hasElements) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Remove a layer
   */
  removeLayer(id: string): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      logger.warn('LayerManager', `Cannot remove layer: layer not found (${id})`);
      return false;
    }

    // Check if layer has elements
    if (layer.getElementCount() > 0) {
      logger.warn('LayerManager', `Cannot remove layer with elements: ${layer.name} (${layer.getElementCount()} elements)`);
      return false;
    }

    // Cannot remove if it's the current layer
    if (id === this.currentLayerId) {
      logger.warn('LayerManager', `Cannot remove current layer: ${layer.name}`);
      return false;
    }

    this.layers.delete(id);
    eventBus.emit(Events.LAYER_REMOVED, { layer });
    logger.info('LayerManager', `Removed layer: ${layer.name} (${id})`);

    return true;
  }

  /**
   * Get current layer
   */
  getCurrentLayer(): Layer {
    const layer = this.layers.get(this.currentLayerId);
    if (!layer) {
      throw new Error(`Current layer not found: ${this.currentLayerId}`);
    }
    return layer;
  }

  /**
   * Set current layer
   */
  setCurrentLayer(id: string): void {
    if (!this.layers.has(id)) {
      throw new Error(`Layer not found: ${id}`);
    }
    this.currentLayerId = id;
    logger.info('LayerManager', `Current layer set to: ${id}`);
  }

  /**
   * Assign element to a layer
   */
  assignElementToLayer(elementId: string, layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer not found: ${layerId}`);
    }

    // Remove from previous layer if exists
    const previousLayerId = this.elementLayerMap.get(elementId);
    if (previousLayerId) {
      const previousLayer = this.layers.get(previousLayerId);
      if (previousLayer) {
        previousLayer.removeElement(elementId);
      }
    }

    // Add to new layer
    layer.addElement(elementId);
    this.elementLayerMap.set(elementId, layerId);

    logger.debug('LayerManager', `Element ${elementId} assigned to layer ${layerId}`);
  }

  /**
   * Get layer ID for an element
   */
  getElementLayer(elementId: string): string | undefined {
    return this.elementLayerMap.get(elementId);
  }

  /**
   * Remove element from all layers
   */
  removeElement(elementId: string): void {
    const layerId = this.elementLayerMap.get(elementId);
    if (layerId) {
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.removeElement(elementId);
      }
      this.elementLayerMap.delete(elementId);
      logger.debug('LayerManager', `Element ${elementId} removed from layer ${layerId}`);
    }
  }

  /**
   * Get all elements on a layer
   */
  getElementsOnLayer(layerId: string): string[] {
    const layer = this.layers.get(layerId);
    return layer ? layer.getElementIds() : [];
  }

  /**
   * Show a layer
   */
  showLayer(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.show();
      eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layerId: id, visible: true });
    }
  }

  /**
   * Hide a layer
   */
  hideLayer(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.hide();
      eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layerId: id, visible: false });
    }
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.toggleVisibility();
      eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layerId: id, visible: layer.visible });
    }
  }

  /**
   * Lock a layer
   */
  lockLayer(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.lock();
      eventBus.emit(Events.LAYER_LOCKED_CHANGED, { layerId: id, locked: true });
    }
  }

  /**
   * Unlock a layer
   */
  unlockLayer(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.unlock();
      eventBus.emit(Events.LAYER_LOCKED_CHANGED, { layerId: id, locked: false });
    }
  }

  /**
   * Toggle layer locked state
   */
  toggleLayerLock(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.toggleLock();
      eventBus.emit(Events.LAYER_LOCKED_CHANGED, { layerId: id, locked: layer.locked });
    }
  }

  /**
   * Show all layers
   */
  showAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.show();
      eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layerId: layer.id, visible: true });
    });
    logger.info('LayerManager', 'All layers shown');
  }

  /**
   * Hide all layers
   */
  hideAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.hide();
      eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layerId: layer.id, visible: false });
    });
    logger.info('LayerManager', 'All layers hidden');
  }

  /**
   * Unlock all layers
   */
  unlockAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.unlock();
      eventBus.emit(Events.LAYER_LOCKED_CHANGED, { layerId: layer.id, locked: false });
    });
    logger.info('LayerManager', 'All layers unlocked');
  }

  /**
   * Lock all layers
   */
  lockAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.lock();
      eventBus.emit(Events.LAYER_LOCKED_CHANGED, { layerId: layer.id, locked: true });
    });
    logger.info('LayerManager', 'All layers locked');
  }

  /**
   * Clone a layer with modifications
   */
  cloneLayer(sourceId: string, newId: string, overrides: Partial<LayerConfig> = {}): Layer | null {
    const sourceLayer = this.layers.get(sourceId);
    if (!sourceLayer) {
      logger.error('LayerManager', `Source layer not found: ${sourceId}`);
      return null;
    }

    const clonedLayer = sourceLayer.clone(newId, overrides);
    this.layers.set(clonedLayer.id, clonedLayer);
    eventBus.emit(Events.LAYER_ADDED, { layer: clonedLayer });
    logger.info('LayerManager', `Cloned layer: ${sourceId} -> ${newId}`);

    return clonedLayer;
  }

  /**
   * Search layers by name
   */
  searchLayers(query: string): Layer[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllLayers().filter(
      (layer) =>
        layer.name.toLowerCase().includes(lowerQuery) ||
        layer.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get layers grouped by type
   */
  getLayersByType(): Map<LayerType, Layer[]> {
    const grouped = new Map<LayerType, Layer[]>();

    this.getAllLayers().forEach((layer) => {
      if (!grouped.has(layer.type)) {
        grouped.set(layer.type, []);
      }
      grouped.get(layer.type)!.push(layer);
    });

    return grouped;
  }

  /**
   * Get layer statistics
   */
  getStatistics(): {
    totalLayers: number;
    visibleLayers: number;
    lockedLayers: number;
    layersWithElements: number;
    totalElements: number;
    byType: Map<LayerType, number>;
  } {
    const stats = {
      totalLayers: this.layers.size,
      visibleLayers: 0,
      lockedLayers: 0,
      layersWithElements: 0,
      totalElements: 0,
      byType: new Map<LayerType, number>(),
    };

    this.getAllLayers().forEach((layer) => {
      if (layer.visible) stats.visibleLayers++;
      if (layer.locked) stats.lockedLayers++;
      if (layer.getElementCount() > 0) stats.layersWithElements++;
      stats.totalElements += layer.getElementCount();

      stats.byType.set(layer.type, (stats.byType.get(layer.type) || 0) + 1);
    });

    return stats;
  }

  /**
   * Export layer configuration to JSON
   */
  exportConfiguration(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      currentLayerId: this.currentLayerId,
      layers: Array.from(this.layers.values()).map((layer) => layer.toJSON()),
    };
  }

  /**
   * Import layer configuration from JSON
   */
  importConfiguration(data: any, replaceExisting: boolean = false): void {
    if (!data.layers || !Array.isArray(data.layers)) {
      logger.error('LayerManager', 'Invalid layer configuration data');
      return;
    }

    if (replaceExisting) {
      this.layers.clear();
      this.elementLayerMap.clear();
    }

    data.layers.forEach((layerData: any) => {
      const layer = Layer.fromJSON(layerData);
      this.layers.set(layer.id, layer);
    });

    if (data.currentLayerId && this.layers.has(data.currentLayerId)) {
      this.currentLayerId = data.currentLayerId;
    }

    logger.info('LayerManager', `Imported ${data.layers.length} layers`);
  }

  /**
   * Reset to default layers only
   */
  reset(): void {
    this.layers.clear();
    this.elementLayerMap.clear();
    this.initializeStandardLayers();
    this.currentLayerId = 'A-WALL-INTR';
    logger.info('LayerManager', 'Reset to default layers');
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.layers.clear();
    this.elementLayerMap.clear();
    logger.info('LayerManager', 'LayerManager disposed');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    if (LayerManager.instance) {
      LayerManager.instance.dispose();
      LayerManager.instance = null;
    }
  }
}

/**
 * Export convenience function
 */
export const getLayerManager = (): LayerManager => {
  return LayerManager.getInstance();
};
