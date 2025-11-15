import { Entity } from '../entities/Entity';
import { LayerManager } from '../LayerManager';
import { DimensionStyleManager } from '../dimensions/DimensionStyle';
import { Vector2 } from '../Vector2';

/**
 * Drawing units
 */
export enum DrawingUnits {
  MILLIMETERS = 'mm',
  CENTIMETERS = 'cm',
  METERS = 'm',
  INCHES = 'in',
  FEET = 'ft',
  YARDS = 'yd',
}

/**
 * Drawing properties
 */
export interface DrawingProperties {
  name: string;
  author: string;
  description: string;
  created: Date;
  modified: Date;
  version: string;
  units: DrawingUnits;
  scale: number;
  paperSize?: string;
  metadata?: Record<string, any>;
}

/**
 * Drawing bounds
 */
export interface DrawingBounds {
  min: Vector2;
  max: Vector2;
}

/**
 * Drawing - Complete CAD drawing document
 */
export class Drawing {
  private properties: DrawingProperties;
  private entities: Entity[] = [];
  private layerManager: LayerManager;
  private dimensionStyleManager: DimensionStyleManager;
  private modified: boolean = false;

  constructor(name: string = 'Untitled') {
    this.properties = {
      name,
      author: '',
      description: '',
      created: new Date(),
      modified: new Date(),
      version: '1.0.0',
      units: DrawingUnits.MILLIMETERS,
      scale: 1.0,
    };

    this.layerManager = new LayerManager();
    this.dimensionStyleManager = new DimensionStyleManager();
  }

  /**
   * Get drawing properties
   */
  getProperties(): DrawingProperties {
    return { ...this.properties };
  }

  /**
   * Set drawing properties
   */
  setProperties(properties: Partial<DrawingProperties>): void {
    this.properties = { ...this.properties, ...properties };
    this.markModified();
  }

  /**
   * Get drawing name
   */
  getName(): string {
    return this.properties.name;
  }

  /**
   * Set drawing name
   */
  setName(name: string): void {
    this.properties.name = name;
    this.markModified();
  }

  /**
   * Get all entities
   */
  getEntities(): Entity[] {
    return [...this.entities];
  }

  /**
   * Add entity
   */
  addEntity(entity: Entity): void {
    this.entities.push(entity);
    this.markModified();
  }

  /**
   * Add multiple entities
   */
  addEntities(entities: Entity[]): void {
    this.entities.push(...entities);
    this.markModified();
  }

  /**
   * Remove entity
   */
  removeEntity(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      this.markModified();
    }
  }

  /**
   * Remove multiple entities
   */
  removeEntities(entities: Entity[]): void {
    for (const entity of entities) {
      const index = this.entities.indexOf(entity);
      if (index > -1) {
        this.entities.splice(index, 1);
      }
    }
    this.markModified();
  }

  /**
   * Clear all entities
   */
  clearEntities(): void {
    this.entities = [];
    this.markModified();
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entities.length;
  }

  /**
   * Get layer manager
   */
  getLayerManager(): LayerManager {
    return this.layerManager;
  }

  /**
   * Get dimension style manager
   */
  getDimensionStyleManager(): DimensionStyleManager {
    return this.dimensionStyleManager;
  }

  /**
   * Calculate drawing bounds
   */
  getBounds(): DrawingBounds | null {
    if (this.entities.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of this.entities) {
      if (!entity.isVisible()) continue;

      const bbox = entity.getBoundingBox();
      minX = Math.min(minX, bbox.min.x);
      minY = Math.min(minY, bbox.min.y);
      maxX = Math.max(maxX, bbox.max.x);
      maxY = Math.max(maxY, bbox.max.y);
    }

    if (minX === Infinity) {
      return null;
    }

    return {
      min: new Vector2(minX, minY),
      max: new Vector2(maxX, maxY),
    };
  }

  /**
   * Get drawing statistics
   */
  getStatistics(): {
    entityCount: number;
    layerCount: number;
    dimensionStyleCount: number;
    bounds: DrawingBounds | null;
    entityTypes: Map<string, number>;
  } {
    const entityTypes = new Map<string, number>();

    for (const entity of this.entities) {
      const type = entity.getType();
      entityTypes.set(type, (entityTypes.get(type) || 0) + 1);
    }

    return {
      entityCount: this.entities.length,
      layerCount: this.layerManager.getLayers().length,
      dimensionStyleCount: this.dimensionStyleManager.getStyles().length,
      bounds: this.getBounds(),
      entityTypes,
    };
  }

  /**
   * Mark drawing as modified
   */
  private markModified(): void {
    this.modified = true;
    this.properties.modified = new Date();
  }

  /**
   * Check if drawing is modified
   */
  isModified(): boolean {
    return this.modified;
  }

  /**
   * Clear modified flag
   */
  clearModified(): void {
    this.modified = false;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      properties: {
        ...this.properties,
        created: this.properties.created.toISOString(),
        modified: this.properties.modified.toISOString(),
      },
      entities: this.entities.map((entity) => entity.serialize()),
      layers: this.layerManager.getLayers().map((layer) => ({
        name: layer.name,
        color: layer.color,
        lineWeight: layer.lineWeight,
        lineType: layer.lineType,
        visible: layer.visible,
        locked: layer.locked,
        description: layer.description,
      })),
      dimensionStyles: this.dimensionStyleManager.getStyles().map((name) => ({
        name,
        style: this.dimensionStyleManager.getStyle(name),
      })),
      version: '1.0.0',
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): Drawing {
    const drawing = new Drawing(data.properties.name);

    // Set properties
    drawing.properties = {
      ...data.properties,
      created: new Date(data.properties.created),
      modified: new Date(data.properties.modified),
    };

    // Load layers
    if (data.layers) {
      const layerManager = drawing.getLayerManager();
      for (const layerData of data.layers) {
        const layer = layerManager.getLayer(layerData.name);
        if (layer) {
          layer.color = layerData.color;
          layer.lineWeight = layerData.lineWeight;
          layer.lineType = layerData.lineType;
          layer.visible = layerData.visible;
          layer.locked = layerData.locked;
          layer.description = layerData.description;
        }
      }
    }

    // Load dimension styles
    if (data.dimensionStyles) {
      const dimStyleManager = drawing.getDimensionStyleManager();
      for (const styleData of data.dimensionStyles) {
        dimStyleManager.createStyle(styleData.name, styleData.style);
      }
    }

    // Load entities
    if (data.entities) {
      for (const entityData of data.entities) {
        try {
          const entity = Drawing.deserializeEntity(entityData);
          if (entity) {
            drawing.entities.push(entity);
          }
        } catch (error) {
          console.error('Failed to deserialize entity:', error);
        }
      }
    }

    drawing.clearModified();
    return drawing;
  }

  /**
   * Deserialize a single entity
   */
  private static deserializeEntity(data: any): Entity | null {
    // Import entity classes dynamically to avoid circular dependencies
    const { Line } = require('../entities/Line');
    const { Circle } = require('../entities/Circle');
    const { Arc } = require('../entities/Arc');
    const { Rectangle } = require('../entities/Rectangle');
    const { Polyline } = require('../entities/Polyline');
    const { LinearDimension } = require('../dimensions/LinearDimension');
    const { AlignedDimension } = require('../dimensions/AlignedDimension');

    switch (data.properties.type) {
      case 'line':
        return Line.deserialize(data);
      case 'circle':
        return Circle.deserialize(data);
      case 'arc':
        return Arc.deserialize(data);
      case 'rectangle':
        return Rectangle.deserialize(data);
      case 'polyline':
        return Polyline.deserialize(data);
      case 'dimension':
        // Determine dimension subtype
        if (data.data.dimensionType === 'linear') {
          return LinearDimension.deserialize(data, null as any);
        } else if (data.data.dimensionType === 'aligned') {
          return AlignedDimension.deserialize(data, null as any);
        }
        return null;
      default:
        console.warn(`Unknown entity type: ${data.properties.type}`);
        return null;
    }
  }

  /**
   * Create a new empty drawing
   */
  static create(name: string = 'Untitled'): Drawing {
    return new Drawing(name);
  }

  /**
   * Clone drawing
   */
  clone(): Drawing {
    const cloned = new Drawing(this.properties.name + ' (Copy)');
    cloned.properties = { ...this.properties };
    cloned.entities = this.entities.map((e) => e.clone());
    return cloned;
  }
}
