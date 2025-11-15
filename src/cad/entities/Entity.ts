import { Vector2 } from '../Vector2';
import { Layer } from '../LayerManager';
import { SnapPoint, SnapType } from '../SnapManager';

/**
 * Entity type enumeration
 */
export enum EntityType {
  LINE = 'line',
  CIRCLE = 'circle',
  ARC = 'arc',
  RECTANGLE = 'rectangle',
  POLYLINE = 'polyline',
  SPLINE = 'spline',
  TEXT = 'text',
  DIMENSION = 'dimension',
  POINT = 'point',
  ROOM = 'room',
  WALL = 'wall',
}

/**
 * Entity properties
 */
export interface EntityProperties {
  id: string;
  type: EntityType;
  layer: string;
  color?: string;
  lineWeight?: number;
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'hidden';
  visible: boolean;
  locked: boolean;
  selected: boolean;
  metadata?: Record<string, any>;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  min: Vector2;
  max: Vector2;
}

/**
 * Entity - Base class for all drawable CAD entities
 */
export abstract class Entity {
  protected properties: EntityProperties;
  private _boundingBox: BoundingBox | null = null;
  private _boundingBoxDirty: boolean = true;

  constructor(type: EntityType, layer: string = 'G-CONS') {
    this.properties = {
      id: this.generateId(),
      type,
      layer,
      visible: true,
      locked: false,
      selected: false,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get entity ID
   */
  getId(): string {
    return this.properties.id;
  }

  /**
   * Get entity type
   */
  getType(): EntityType {
    return this.properties.type;
  }

  /**
   * Get layer
   */
  getLayer(): string {
    return this.properties.layer;
  }

  /**
   * Set layer
   */
  setLayer(layer: string): void {
    this.properties.layer = layer;
  }

  /**
   * Get color (override or use layer color)
   */
  getColor(): string | undefined {
    return this.properties.color;
  }

  /**
   * Set color
   */
  setColor(color: string | undefined): void {
    this.properties.color = color;
  }

  /**
   * Get line weight
   */
  getLineWeight(): number | undefined {
    return this.properties.lineWeight;
  }

  /**
   * Set line weight
   */
  setLineWeight(weight: number | undefined): void {
    this.properties.lineWeight = weight;
  }

  /**
   * Get line type
   */
  getLineType(): string | undefined {
    return this.properties.lineType;
  }

  /**
   * Set line type
   */
  setLineType(lineType: 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'hidden'): void {
    this.properties.lineType = lineType;
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.properties.visible;
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.properties.visible = visible;
  }

  /**
   * Check if locked
   */
  isLocked(): boolean {
    return this.properties.locked;
  }

  /**
   * Set locked
   */
  setLocked(locked: boolean): void {
    this.properties.locked = locked;
  }

  /**
   * Check if selected
   */
  isSelected(): boolean {
    return this.properties.selected;
  }

  /**
   * Set selected
   */
  setSelected(selected: boolean): void {
    this.properties.selected = selected;
  }

  /**
   * Get metadata
   */
  getMetadata(): Record<string, any> {
    return this.properties.metadata || {};
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: Record<string, any>): void {
    this.properties.metadata = metadata;
  }

  /**
   * Get all properties
   */
  getProperties(): EntityProperties {
    return { ...this.properties };
  }

  /**
   * Mark bounding box as dirty
   */
  protected markBoundingBoxDirty(): void {
    this._boundingBoxDirty = true;
  }

  /**
   * Calculate bounding box (to be implemented by subclasses)
   */
  protected abstract calculateBoundingBox(): BoundingBox;

  /**
   * Get bounding box
   */
  getBoundingBox(): BoundingBox {
    if (this._boundingBoxDirty || !this._boundingBox) {
      this._boundingBox = this.calculateBoundingBox();
      this._boundingBoxDirty = false;
    }
    return this._boundingBox;
  }

  /**
   * Check if point is inside bounding box
   */
  isInBoundingBox(point: Vector2): boolean {
    const bbox = this.getBoundingBox();
    return (
      point.x >= bbox.min.x &&
      point.x <= bbox.max.x &&
      point.y >= bbox.min.y &&
      point.y <= bbox.max.y
    );
  }

  /**
   * Get snap points for this entity
   */
  abstract getSnapPoints(snapTypes: SnapType[]): SnapPoint[];

  /**
   * Get distance from point to entity
   */
  abstract distanceToPoint(point: Vector2): number;

  /**
   * Get nearest point on entity
   */
  abstract getNearestPoint(point: Vector2): Vector2;

  /**
   * Check if entity contains point (for selection)
   */
  abstract containsPoint(point: Vector2, tolerance: number): boolean;

  /**
   * Check if entity intersects rectangle (for window selection)
   */
  abstract intersectsRectangle(min: Vector2, max: Vector2): boolean;

  /**
   * Transform entity (translate, rotate, scale)
   */
  abstract transform(matrix: TransformMatrix): void;

  /**
   * Clone entity
   */
  abstract clone(): Entity;

  /**
   * Render entity to canvas
   */
  abstract render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void;

  /**
   * Serialize entity to JSON
   */
  serialize(): any {
    return {
      properties: this.properties,
      data: this.serializeData(),
    };
  }

  /**
   * Serialize entity-specific data (to be implemented by subclasses)
   */
  protected abstract serializeData(): any;

  /**
   * Deserialize entity from JSON (to be implemented by subclasses)
   */
  static deserialize(data: any): Entity {
    throw new Error('Deserialize must be implemented by subclass');
  }
}

/**
 * Transform matrix for 2D transformations
 */
export interface TransformMatrix {
  a: number; // Scale X
  b: number; // Skew Y
  c: number; // Skew X
  d: number; // Scale Y
  e: number; // Translate X
  f: number; // Translate Y
}

/**
 * Create identity transform matrix
 */
export function createIdentityMatrix(): TransformMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * Create translation matrix
 */
export function createTranslationMatrix(dx: number, dy: number): TransformMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
}

/**
 * Create rotation matrix
 */
export function createRotationMatrix(angle: number): TransformMatrix {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

/**
 * Create scale matrix
 */
export function createScaleMatrix(sx: number, sy: number): TransformMatrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

/**
 * Apply transform matrix to point
 */
export function transformPoint(point: Vector2, matrix: TransformMatrix): Vector2 {
  return new Vector2(
    matrix.a * point.x + matrix.c * point.y + matrix.e,
    matrix.b * point.x + matrix.d * point.y + matrix.f
  );
}

/**
 * Multiply two transform matrices
 */
export function multiplyMatrices(m1: TransformMatrix, m2: TransformMatrix): TransformMatrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}
