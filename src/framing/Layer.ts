/**
 * Layer - Represents a drawing layer for organizing building elements
 * Similar to AutoCAD/Revit layer system with visibility, locking, and color properties
 */

import { logger } from '@utils/Logger';

/**
 * Standard layer types for architectural drawings
 * Following AIA CAD Layer Guidelines
 */
export enum LayerType {
  EXTERIOR_WALLS = 'A-WALL-EXTR',
  INTERIOR_WALLS = 'A-WALL-INTR',
  STRUCTURAL_WALLS = 'A-WALL-STRC',
  PARTITIONS = 'A-WALL-PART',
  DOORS = 'A-DOOR',
  WINDOWS = 'A-WIND',
  COLUMNS = 'A-COLS',
  FLOORS = 'A-FLOR',
  CEILINGS = 'A-CLNG',
  ROOF = 'A-ROOF',
  STAIRS = 'A-STRS',
  FURNITURE = 'A-FURN',
  EQUIPMENT = 'A-EQUP',
  ANNOTATIONS = 'A-ANNO',
  DIMENSIONS = 'A-DIMS',
  GRID = 'A-GRID',
  CUSTOM = 'CUSTOM',
}

/**
 * Layer configuration interface
 */
export interface LayerConfig {
  id: string;
  name: string;
  type: LayerType;
  color: number; // Hex color (e.g., 0xFF0000 for red)
  visible?: boolean;
  locked?: boolean;
  description?: string;
  lineWeight?: number; // Line weight for 2D representation
  plotStyle?: string; // Plot style name
}

/**
 * Layer class for organizing building elements
 */
export class Layer {
  readonly id: string;
  name: string;
  readonly type: LayerType;
  color: number;
  private _visible: boolean;
  private _locked: boolean;
  description: string;
  lineWeight: number;
  plotStyle: string;
  private elementIds: Set<string>; // IDs of elements on this layer

  constructor(config: LayerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.color = config.color;
    this._visible = config.visible ?? true;
    this._locked = config.locked ?? false;
    this.description = config.description || '';
    this.lineWeight = config.lineWeight || 1.0;
    this.plotStyle = config.plotStyle || 'Normal';
    this.elementIds = new Set();

    logger.debug('Layer', `Created layer: ${this.name} (${this.id})`);
  }

  /**
   * Get visibility state
   */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * Get locked state
   */
  get locked(): boolean {
    return this._locked;
  }

  /**
   * Show the layer (make visible)
   */
  show(): void {
    if (!this._visible) {
      this._visible = true;
      logger.debug('Layer', `Layer shown: ${this.name}`);
    }
  }

  /**
   * Hide the layer (make invisible)
   */
  hide(): void {
    if (this._visible) {
      this._visible = false;
      logger.debug('Layer', `Layer hidden: ${this.name}`);
    }
  }

  /**
   * Toggle visibility
   */
  toggleVisibility(): void {
    this._visible = !this._visible;
    logger.debug('Layer', `Layer visibility toggled: ${this.name} -> ${this._visible}`);
  }

  /**
   * Lock the layer (prevent modifications)
   */
  lock(): void {
    if (!this._locked) {
      this._locked = true;
      logger.debug('Layer', `Layer locked: ${this.name}`);
    }
  }

  /**
   * Unlock the layer (allow modifications)
   */
  unlock(): void {
    if (this._locked) {
      this._locked = false;
      logger.debug('Layer', `Layer unlocked: ${this.name}`);
    }
  }

  /**
   * Toggle locked state
   */
  toggleLock(): void {
    this._locked = !this._locked;
    logger.debug('Layer', `Layer lock toggled: ${this.name} -> ${this._locked}`);
  }

  /**
   * Set layer color
   */
  setColor(color: number): void {
    this.color = color;
    logger.debug('Layer', `Layer color changed: ${this.name} -> ${color.toString(16)}`);
  }

  /**
   * Set line weight
   */
  setLineWeight(weight: number): void {
    this.lineWeight = weight;
    logger.debug('Layer', `Layer line weight changed: ${this.name} -> ${weight}`);
  }

  /**
   * Add element to this layer
   */
  addElement(elementId: string): void {
    this.elementIds.add(elementId);
    logger.debug('Layer', `Element ${elementId} added to layer ${this.name}`);
  }

  /**
   * Remove element from this layer
   */
  removeElement(elementId: string): void {
    this.elementIds.delete(elementId);
    logger.debug('Layer', `Element ${elementId} removed from layer ${this.name}`);
  }

  /**
   * Check if element is on this layer
   */
  hasElement(elementId: string): boolean {
    return this.elementIds.has(elementId);
  }

  /**
   * Get all element IDs on this layer
   */
  getElementIds(): string[] {
    return Array.from(this.elementIds);
  }

  /**
   * Get element count on this layer
   */
  getElementCount(): number {
    return this.elementIds.size;
  }

  /**
   * Clear all elements from this layer
   */
  clearElements(): void {
    this.elementIds.clear();
    logger.debug('Layer', `All elements cleared from layer ${this.name}`);
  }

  /**
   * Clone this layer with a new ID
   */
  clone(newId: string, overrides: Partial<LayerConfig> = {}): Layer {
    return new Layer({
      id: newId,
      name: overrides.name || `${this.name} (Copy)`,
      type: overrides.type || this.type,
      color: overrides.color ?? this.color,
      visible: overrides.visible ?? this._visible,
      locked: overrides.locked ?? this._locked,
      description: overrides.description || this.description,
      lineWeight: overrides.lineWeight || this.lineWeight,
      plotStyle: overrides.plotStyle || this.plotStyle,
    });
  }

  /**
   * Export layer to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      color: this.color,
      visible: this._visible,
      locked: this._locked,
      description: this.description,
      lineWeight: this.lineWeight,
      plotStyle: this.plotStyle,
      elementCount: this.elementIds.size,
    };
  }

  /**
   * Create layer from JSON
   */
  static fromJSON(data: any): Layer {
    return new Layer({
      id: data.id,
      name: data.name,
      type: data.type,
      color: data.color,
      visible: data.visible,
      locked: data.locked,
      description: data.description,
      lineWeight: data.lineWeight,
      plotStyle: data.plotStyle,
    });
  }

  /**
   * Get layer color as CSS hex string
   */
  getColorHex(): string {
    return '#' + this.color.toString(16).padStart(6, '0');
  }

  /**
   * Check if layer allows modifications
   */
  canModify(): boolean {
    return !this._locked;
  }

  /**
   * Check if layer is visible and unlocked
   */
  isActive(): boolean {
    return this._visible && !this._locked;
  }
}
