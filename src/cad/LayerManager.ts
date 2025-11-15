/**
 * Layer - Represents a drawing layer in CAD
 */
export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  printable: boolean;
  lineWeight: number; // Line weight in mm
  lineType: 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'hidden';
  description?: string;
  parent?: string; // Parent layer ID for hierarchical layers
}

/**
 * AIA (American Institute of Architects) standard layer naming convention
 * Format: Discipline-Major-Minor
 *
 * Disciplines:
 * - A: Architectural
 * - C: Civil
 * - E: Electrical
 * - F: Fire Protection
 * - G: General
 * - I: Interiors
 * - L: Landscape
 * - M: Mechanical
 * - P: Plumbing
 * - S: Structural
 * - T: Telecommunications
 */

/**
 * LayerManager - Manages drawing layers with AIA standards
 */
export class LayerManager {
  private layers: Map<string, Layer> = new Map();
  private activeLayerId: string = 'A-WALL';
  private eventCallbacks: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeAIALayers();
  }

  /**
   * Initialize standard AIA layers
   */
  private initializeAIALayers(): void {
    // Architectural layers
    this.addLayer({
      id: 'A-WALL',
      name: 'Walls',
      color: '#CCCCCC',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.35,
      lineType: 'solid',
      description: 'Wall outlines and centerlines',
    });

    this.addLayer({
      id: 'A-DOOR',
      name: 'Doors',
      color: '#00FF00',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.35,
      lineType: 'solid',
      description: 'Door swings and frames',
    });

    this.addLayer({
      id: 'A-GLAZ',
      name: 'Glazing',
      color: '#00FFFF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.35,
      lineType: 'solid',
      description: 'Windows and glass',
    });

    this.addLayer({
      id: 'A-FLOR',
      name: 'Floor',
      color: '#888888',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.25,
      lineType: 'solid',
      description: 'Floor patterns and materials',
    });

    this.addLayer({
      id: 'A-CEIL',
      name: 'Ceiling',
      color: '#FF00FF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.18,
      lineType: 'dashed',
      description: 'Ceiling grid and features',
    });

    this.addLayer({
      id: 'A-FURN',
      name: 'Furniture',
      color: '#FFFF00',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.25,
      lineType: 'solid',
      description: 'Furniture and equipment',
    });

    this.addLayer({
      id: 'A-ANNO',
      name: 'Annotations',
      color: '#FF0000',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.18,
      lineType: 'solid',
      description: 'Text, dimensions, and notes',
    });

    this.addLayer({
      id: 'A-DIMS',
      name: 'Dimensions',
      color: '#00FF00',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.18,
      lineType: 'solid',
      description: 'Dimension lines and text',
    });

    this.addLayer({
      id: 'A-GRID',
      name: 'Grid',
      color: '#FF0000',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.5,
      lineType: 'dashdot',
      description: 'Column and structural grid lines',
    });

    this.addLayer({
      id: 'A-DETL',
      name: 'Details',
      color: '#FFFFFF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.35,
      lineType: 'solid',
      description: 'Detail marks and callouts',
    });

    // Structural layers
    this.addLayer({
      id: 'S-COLS',
      name: 'Columns',
      color: '#00FFFF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.5,
      lineType: 'solid',
      description: 'Structural columns',
    });

    this.addLayer({
      id: 'S-BEAM',
      name: 'Beams',
      color: '#0000FF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.5,
      lineType: 'solid',
      description: 'Structural beams',
    });

    this.addLayer({
      id: 'S-WALL',
      name: 'Structural Walls',
      color: '#FF00FF',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.5,
      lineType: 'solid',
      description: 'Load-bearing walls',
    });

    // MEP layers
    this.addLayer({
      id: 'M-HVAC',
      name: 'HVAC',
      color: '#FF0000',
      visible: false,
      locked: false,
      printable: true,
      lineWeight: 0.25,
      lineType: 'solid',
      description: 'HVAC equipment and ductwork',
    });

    this.addLayer({
      id: 'P-PLMB',
      name: 'Plumbing',
      color: '#0000FF',
      visible: false,
      locked: false,
      printable: true,
      lineWeight: 0.25,
      lineType: 'solid',
      description: 'Plumbing fixtures and piping',
    });

    this.addLayer({
      id: 'E-LITE',
      name: 'Lighting',
      color: '#FFFF00',
      visible: false,
      locked: false,
      printable: true,
      lineWeight: 0.18,
      lineType: 'solid',
      description: 'Lighting fixtures and switches',
    });

    this.addLayer({
      id: 'E-POWR',
      name: 'Power',
      color: '#FF8800',
      visible: false,
      locked: false,
      printable: true,
      lineWeight: 0.18,
      lineType: 'solid',
      description: 'Power outlets and circuits',
    });

    // General/Reference layers
    this.addLayer({
      id: 'G-SITE',
      name: 'Site',
      color: '#888888',
      visible: true,
      locked: false,
      printable: true,
      lineWeight: 0.25,
      lineType: 'solid',
      description: 'Site boundaries and features',
    });

    this.addLayer({
      id: 'G-REFR',
      name: 'Reference',
      color: '#666666',
      visible: true,
      locked: true,
      printable: false,
      lineWeight: 0.13,
      lineType: 'dotted',
      description: 'Reference lines and construction geometry',
    });

    this.addLayer({
      id: 'G-CONS',
      name: 'Construction',
      color: '#FF00FF',
      visible: true,
      locked: false,
      printable: false,
      lineWeight: 0.13,
      lineType: 'dotted',
      description: 'Construction lines and guides',
    });
  }

  /**
   * Add a new layer
   */
  addLayer(layer: Layer): void {
    this.layers.set(layer.id, layer);
    this.emit('layerAdded', layer);
  }

  /**
   * Remove a layer
   */
  removeLayer(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;

    // Don't allow removing the active layer
    if (layerId === this.activeLayerId) {
      console.warn('Cannot remove the active layer');
      return false;
    }

    this.layers.delete(layerId);
    this.emit('layerRemoved', layerId);
    return true;
  }

  /**
   * Get a layer by ID
   */
  getLayer(layerId: string): Layer | undefined {
    return this.layers.get(layerId);
  }

  /**
   * Get all layers
   */
  getAllLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get visible layers
   */
  getVisibleLayers(): Layer[] {
    return Array.from(this.layers.values()).filter((layer) => layer.visible);
  }

  /**
   * Get the active layer
   */
  getActiveLayer(): Layer | undefined {
    return this.layers.get(this.activeLayerId);
  }

  /**
   * Set the active layer
   */
  setActiveLayer(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) {
      console.warn(`Layer ${layerId} not found`);
      return false;
    }

    if (layer.locked) {
      console.warn(`Layer ${layerId} is locked and cannot be set as active`);
      return false;
    }

    this.activeLayerId = layerId;
    this.emit('activeLayerChanged', layerId);
    return true;
  }

  /**
   * Update layer properties
   */
  updateLayer(layerId: string, updates: Partial<Layer>): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;

    // Don't allow changing the ID
    delete (updates as any).id;

    Object.assign(layer, updates);
    this.emit('layerUpdated', layer);
    return true;
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;

    layer.visible = !layer.visible;
    this.emit('layerUpdated', layer);
    return true;
  }

  /**
   * Toggle layer lock
   */
  toggleLayerLock(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;

    layer.locked = !layer.locked;

    // If locking the active layer, switch to another unlocked layer
    if (layer.locked && layerId === this.activeLayerId) {
      const unlockedLayer = this.getAllLayers().find((l) => !l.locked);
      if (unlockedLayer) {
        this.setActiveLayer(unlockedLayer.id);
      }
    }

    this.emit('layerUpdated', layer);
    return true;
  }

  /**
   * Show all layers
   */
  showAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.visible = true;
    });
    this.emit('layersUpdated');
  }

  /**
   * Hide all layers except the specified ones
   */
  isolateLayers(layerIds: string[]): void {
    this.layers.forEach((layer) => {
      layer.visible = layerIds.includes(layer.id);
    });
    this.emit('layersUpdated');
  }

  /**
   * Lock all layers except the specified ones
   */
  lockAllExcept(layerIds: string[]): void {
    this.layers.forEach((layer) => {
      layer.locked = !layerIds.includes(layer.id);
    });
    this.emit('layersUpdated');
  }

  /**
   * Check if a layer is drawable (visible and unlocked)
   */
  isLayerDrawable(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    return layer ? layer.visible && !layer.locked : false;
  }

  /**
   * Get layers by discipline
   */
  getLayersByDiscipline(discipline: string): Layer[] {
    return Array.from(this.layers.values()).filter((layer) =>
      layer.id.startsWith(discipline + '-')
    );
  }

  /**
   * Event handling
   */
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args));
    }
  }

  /**
   * Serialize layers to JSON
   */
  serialize(): string {
    const layerArray = Array.from(this.layers.values());
    return JSON.stringify({
      layers: layerArray,
      activeLayerId: this.activeLayerId,
    });
  }

  /**
   * Deserialize layers from JSON
   */
  static deserialize(json: string): LayerManager {
    const data = JSON.parse(json);
    const manager = new LayerManager();

    // Clear default layers
    manager.layers.clear();

    // Add deserialized layers
    data.layers.forEach((layer: Layer) => {
      manager.layers.set(layer.id, layer);
    });

    manager.activeLayerId = data.activeLayerId;
    return manager;
  }
}
