import { Vector2 } from '../Vector2';
import { Layer } from '../LayerManager';
import { SnapPoint, SnapType } from '../SnapManager';
import {
  Entity,
  EntityType,
  BoundingBox,
  TransformMatrix,
  transformPoint,
} from './Entity';

/**
 * Room type enumeration
 */
export enum RoomType {
  UNDEFINED = 'undefined',
  BEDROOM = 'bedroom',
  MASTER_BEDROOM = 'master_bedroom',
  BATHROOM = 'bathroom',
  MASTER_BATHROOM = 'master_bathroom',
  KITCHEN = 'kitchen',
  LIVING_ROOM = 'living_room',
  DINING_ROOM = 'dining_room',
  FAMILY_ROOM = 'family_room',
  OFFICE = 'office',
  LAUNDRY = 'laundry',
  GARAGE = 'garage',
  HALLWAY = 'hallway',
  CLOSET = 'closet',
  PANTRY = 'pantry',
  MUDROOM = 'mudroom',
  FOYER = 'foyer',
  UTILITY = 'utility',
}

/**
 * Room component - represents BIM components in a room
 */
export interface RoomComponent {
  type: string;
  name: string;
  quantity: number;
  properties?: Record<string, any>;
}

/**
 * Room material assignment
 */
export interface RoomMaterial {
  surface: 'floor' | 'wall' | 'ceiling';
  materialId: string;
  materialName: string;
  properties?: Record<string, any>;
}

/**
 * Room properties
 */
export interface RoomProperties {
  name: string;
  type: RoomType;
  area?: number;
  perimeter?: number;
  components: RoomComponent[];
  materials: RoomMaterial[];
  customProperties?: Record<string, any>;
}

/**
 * Room entity - Represents an enclosed space with BIM properties
 */
export class Room extends Entity {
  private boundary: Vector2[];
  private properties: RoomProperties;
  private labelPosition: Vector2 | null = null;

  constructor(
    boundary: Vector2[],
    roomType: RoomType = RoomType.UNDEFINED,
    name?: string,
    layer: string = 'A-AREA-ROOM'
  ) {
    super(EntityType.ROOM, layer);
    this.boundary = boundary.map(v => v.clone());

    // Initialize properties
    this.properties = {
      name: name || this.getDefaultRoomName(roomType),
      type: roomType,
      components: [],
      materials: [],
    };

    // Calculate area and perimeter
    this.updateGeometricProperties();

    // Set default components and materials based on room type
    this.applyDefaultsForRoomType(roomType);

    // Calculate label position (centroid)
    this.calculateLabelPosition();
  }

  /**
   * Get default room name based on type
   */
  private getDefaultRoomName(type: RoomType): string {
    const typeNames: Record<RoomType, string> = {
      [RoomType.UNDEFINED]: 'Undefined Room',
      [RoomType.BEDROOM]: 'Bedroom',
      [RoomType.MASTER_BEDROOM]: 'Master Bedroom',
      [RoomType.BATHROOM]: 'Bathroom',
      [RoomType.MASTER_BATHROOM]: 'Master Bathroom',
      [RoomType.KITCHEN]: 'Kitchen',
      [RoomType.LIVING_ROOM]: 'Living Room',
      [RoomType.DINING_ROOM]: 'Dining Room',
      [RoomType.FAMILY_ROOM]: 'Family Room',
      [RoomType.OFFICE]: 'Office',
      [RoomType.LAUNDRY]: 'Laundry',
      [RoomType.GARAGE]: 'Garage',
      [RoomType.HALLWAY]: 'Hallway',
      [RoomType.CLOSET]: 'Closet',
      [RoomType.PANTRY]: 'Pantry',
      [RoomType.MUDROOM]: 'Mudroom',
      [RoomType.FOYER]: 'Foyer',
      [RoomType.UTILITY]: 'Utility',
    };
    return typeNames[type] || 'Room';
  }

  /**
   * Apply default components and materials based on room type
   */
  private applyDefaultsForRoomType(type: RoomType): void {
    // This will be populated with actual defaults from the BIM database
    // For now, we'll set up the structure
    this.properties.components = this.getDefaultComponents(type);
    this.properties.materials = this.getDefaultMaterials(type);
  }

  /**
   * Get default components for a room type
   */
  private getDefaultComponents(type: RoomType): RoomComponent[] {
    const defaults: Record<RoomType, RoomComponent[]> = {
      [RoomType.BEDROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 4 },
        { type: 'switch', name: 'Light Switch', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.BATHROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'toilet', name: 'Standard Toilet', quantity: 1 },
        { type: 'sink', name: 'Bathroom Sink', quantity: 1 },
        { type: 'shower', name: 'Shower/Tub Combo', quantity: 1 },
        { type: 'outlet', name: 'GFCI Outlet', quantity: 2 },
        { type: 'light', name: 'Vanity Light', quantity: 1 },
        { type: 'fan', name: 'Exhaust Fan', quantity: 1 },
      ],
      [RoomType.KITCHEN]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 1 },
        { type: 'sink', name: 'Kitchen Sink', quantity: 1 },
        { type: 'outlet', name: 'GFCI Outlet', quantity: 6 },
        { type: 'light', name: 'Recessed Light', quantity: 4 },
        { type: 'appliance', name: 'Refrigerator', quantity: 1 },
        { type: 'appliance', name: 'Range', quantity: 1 },
        { type: 'appliance', name: 'Dishwasher', quantity: 1 },
      ],
      [RoomType.LIVING_ROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 2 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 6 },
        { type: 'switch', name: 'Light Switch', quantity: 2 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.GARAGE]: [
        { type: 'door', name: 'Garage Door', quantity: 1 },
        { type: 'door', name: 'Entry Door', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 2 },
        { type: 'light', name: 'Garage Light', quantity: 2 },
      ],
      [RoomType.UNDEFINED]: [],
      [RoomType.MASTER_BEDROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 2 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 6 },
        { type: 'switch', name: 'Light Switch', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.MASTER_BATHROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'toilet', name: 'Standard Toilet', quantity: 1 },
        { type: 'sink', name: 'Double Vanity', quantity: 2 },
        { type: 'shower', name: 'Walk-in Shower', quantity: 1 },
        { type: 'tub', name: 'Soaking Tub', quantity: 1 },
        { type: 'outlet', name: 'GFCI Outlet', quantity: 4 },
        { type: 'light', name: 'Vanity Light', quantity: 2 },
        { type: 'fan', name: 'Exhaust Fan', quantity: 1 },
      ],
      [RoomType.DINING_ROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 4 },
        { type: 'switch', name: 'Dimmer Switch', quantity: 1 },
        { type: 'light', name: 'Chandelier', quantity: 1 },
      ],
      [RoomType.FAMILY_ROOM]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 2 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 6 },
        { type: 'switch', name: 'Light Switch', quantity: 2 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.OFFICE]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'window', name: 'Standard Window', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 6 },
        { type: 'switch', name: 'Light Switch', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.LAUNDRY]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 2 },
        { type: 'outlet', name: '220V Outlet', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.HALLWAY]: [
        { type: 'outlet', name: 'Duplex Outlet', quantity: 2 },
        { type: 'switch', name: 'Light Switch', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.CLOSET]: [
        { type: 'door', name: 'Closet Door', quantity: 1 },
        { type: 'light', name: 'Closet Light', quantity: 1 },
      ],
      [RoomType.PANTRY]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.MUDROOM]: [
        { type: 'door', name: 'Exterior Door', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 2 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
      [RoomType.FOYER]: [
        { type: 'door', name: 'Entry Door', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 1 },
        { type: 'switch', name: 'Light Switch', quantity: 1 },
        { type: 'light', name: 'Chandelier', quantity: 1 },
      ],
      [RoomType.UTILITY]: [
        { type: 'door', name: 'Interior Door', quantity: 1 },
        { type: 'outlet', name: 'Duplex Outlet', quantity: 2 },
        { type: 'light', name: 'Ceiling Light', quantity: 1 },
      ],
    };

    return defaults[type] || [];
  }

  /**
   * Get default materials for a room type
   */
  private getDefaultMaterials(type: RoomType): RoomMaterial[] {
    const defaults: Record<RoomType, RoomMaterial[]> = {
      [RoomType.BEDROOM]: [
        { surface: 'floor', materialId: 'carpet-01', materialName: 'Carpet' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.BATHROOM]: [
        { surface: 'floor', materialId: 'tile-01', materialName: 'Ceramic Tile' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.KITCHEN]: [
        { surface: 'floor', materialId: 'tile-02', materialName: 'Porcelain Tile' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.LIVING_ROOM]: [
        { surface: 'floor', materialId: 'hardwood-01', materialName: 'Hardwood' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.GARAGE]: [
        { surface: 'floor', materialId: 'concrete-01', materialName: 'Concrete' },
        { surface: 'wall', materialId: 'drywall-01', materialName: 'Drywall' },
        { surface: 'ceiling', materialId: 'drywall-01', materialName: 'Drywall' },
      ],
      [RoomType.UNDEFINED]: [],
      [RoomType.MASTER_BEDROOM]: [
        { surface: 'floor', materialId: 'carpet-01', materialName: 'Carpet' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.MASTER_BATHROOM]: [
        { surface: 'floor', materialId: 'tile-03', materialName: 'Luxury Vinyl Tile' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.DINING_ROOM]: [
        { surface: 'floor', materialId: 'hardwood-01', materialName: 'Hardwood' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.FAMILY_ROOM]: [
        { surface: 'floor', materialId: 'hardwood-01', materialName: 'Hardwood' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.OFFICE]: [
        { surface: 'floor', materialId: 'hardwood-01', materialName: 'Hardwood' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.LAUNDRY]: [
        { surface: 'floor', materialId: 'vinyl-01', materialName: 'Vinyl' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.HALLWAY]: [
        { surface: 'floor', materialId: 'hardwood-01', materialName: 'Hardwood' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.CLOSET]: [
        { surface: 'floor', materialId: 'carpet-01', materialName: 'Carpet' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.PANTRY]: [
        { surface: 'floor', materialId: 'tile-02', materialName: 'Porcelain Tile' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.MUDROOM]: [
        { surface: 'floor', materialId: 'tile-02', materialName: 'Porcelain Tile' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.FOYER]: [
        { surface: 'floor', materialId: 'tile-02', materialName: 'Porcelain Tile' },
        { surface: 'wall', materialId: 'paint-01', materialName: 'Paint - Eggshell' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
      [RoomType.UTILITY]: [
        { surface: 'floor', materialId: 'concrete-01', materialName: 'Concrete' },
        { surface: 'wall', materialId: 'paint-02', materialName: 'Paint - Semi-gloss' },
        { surface: 'ceiling', materialId: 'paint-01', materialName: 'Paint - Flat' },
      ],
    };

    return defaults[type] || [];
  }

  /**
   * Update geometric properties (area and perimeter)
   */
  private updateGeometricProperties(): void {
    this.properties.area = this.calculateArea();
    this.properties.perimeter = this.calculatePerimeter();
  }

  /**
   * Calculate area using shoelace formula
   */
  private calculateArea(): number {
    const n = this.boundary.length;
    if (n < 3) return 0;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += this.boundary[i].x * this.boundary[j].y;
      area -= this.boundary[j].x * this.boundary[i].y;
    }

    return Math.abs(area / 2);
  }

  /**
   * Calculate perimeter
   */
  private calculatePerimeter(): number {
    const n = this.boundary.length;
    if (n < 2) return 0;

    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += this.boundary[i].distanceTo(this.boundary[j]);
    }

    return perimeter;
  }

  /**
   * Calculate label position (centroid)
   */
  private calculateLabelPosition(): void {
    if (this.boundary.length === 0) {
      this.labelPosition = null;
      return;
    }

    let cx = 0;
    let cy = 0;
    for (const point of this.boundary) {
      cx += point.x;
      cy += point.y;
    }

    this.labelPosition = new Vector2(
      cx / this.boundary.length,
      cy / this.boundary.length
    );
  }

  /**
   * Get room boundary
   */
  getBoundary(): Vector2[] {
    return this.boundary.map(v => v.clone());
  }

  /**
   * Set room boundary
   */
  setBoundary(boundary: Vector2[]): void {
    this.boundary = boundary.map(v => v.clone());
    this.updateGeometricProperties();
    this.calculateLabelPosition();
    this.markBoundingBoxDirty();
  }

  /**
   * Get room properties
   */
  getProperties(): RoomProperties {
    return { ...this.properties };
  }

  /**
   * Get room type
   */
  getRoomType(): RoomType {
    return this.properties.type;
  }

  /**
   * Set room type (and update defaults)
   */
  setRoomType(type: RoomType, preserveExisting: boolean = false): void {
    this.properties.type = type;

    if (!preserveExisting) {
      // Replace with defaults
      this.properties.components = this.getDefaultComponents(type);
      this.properties.materials = this.getDefaultMaterials(type);
    }

    // Update name if it matches old default
    const oldDefaultName = this.getDefaultRoomName(this.properties.type);
    if (this.properties.name === oldDefaultName) {
      this.properties.name = this.getDefaultRoomName(type);
    }
  }

  /**
   * Get room name
   */
  getName(): string {
    return this.properties.name;
  }

  /**
   * Set room name
   */
  setName(name: string): void {
    this.properties.name = name;
  }

  /**
   * Get room area
   */
  getArea(): number {
    return this.properties.area || 0;
  }

  /**
   * Get room perimeter
   */
  getPerimeter(): number {
    return this.properties.perimeter || 0;
  }

  /**
   * Get components
   */
  getComponents(): RoomComponent[] {
    return [...this.properties.components];
  }

  /**
   * Add component
   */
  addComponent(component: RoomComponent): void {
    this.properties.components.push(component);
  }

  /**
   * Remove component
   */
  removeComponent(index: number): void {
    this.properties.components.splice(index, 1);
  }

  /**
   * Get materials
   */
  getMaterials(): RoomMaterial[] {
    return [...this.properties.materials];
  }

  /**
   * Set material for surface
   */
  setMaterial(surface: 'floor' | 'wall' | 'ceiling', materialId: string, materialName: string): void {
    const existing = this.properties.materials.find(m => m.surface === surface);
    if (existing) {
      existing.materialId = materialId;
      existing.materialName = materialName;
    } else {
      this.properties.materials.push({ surface, materialId, materialName });
    }
  }

  /**
   * Get label position
   */
  getLabelPosition(): Vector2 | null {
    return this.labelPosition ? this.labelPosition.clone() : null;
  }

  /**
   * Calculate bounding box
   */
  protected calculateBoundingBox(): BoundingBox {
    if (this.boundary.length === 0) {
      return {
        min: new Vector2(0, 0),
        max: new Vector2(0, 0),
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    this.boundary.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    return {
      min: new Vector2(minX, minY),
      max: new Vector2(maxX, maxY),
    };
  }

  /**
   * Get snap points
   */
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    if (snapTypes.includes(SnapType.ENDPOINT)) {
      this.boundary.forEach(point => {
        points.push({ point, type: SnapType.ENDPOINT, entity: this });
      });
    }

    if (snapTypes.includes(SnapType.MIDPOINT)) {
      for (let i = 0; i < this.boundary.length; i++) {
        const j = (i + 1) % this.boundary.length;
        const midpoint = Vector2.lerp(this.boundary[i], this.boundary[j], 0.5);
        points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
      }
    }

    if (snapTypes.includes(SnapType.CENTER) && this.labelPosition) {
      points.push({ point: this.labelPosition, type: SnapType.CENTER, entity: this });
    }

    return points;
  }

  /**
   * Check if point is inside room (using ray casting algorithm)
   */
  containsPoint(point: Vector2, tolerance: number = 0.1): boolean {
    const n = this.boundary.length;
    if (n < 3) return false;

    let inside = false;
    let p1 = this.boundary[0];

    for (let i = 1; i <= n; i++) {
      const p2 = this.boundary[i % n];

      if (point.y > Math.min(p1.y, p2.y)) {
        if (point.y <= Math.max(p1.y, p2.y)) {
          if (point.x <= Math.max(p1.x, p2.x)) {
            const xIntersection =
              p1.y !== p2.y
                ? ((point.y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x
                : p1.x;

            if (p1.x === p2.x || point.x <= xIntersection) {
              inside = !inside;
            }
          }
        }
      }

      p1 = p2;
    }

    return inside;
  }

  /**
   * Get distance from point to room boundary
   */
  distanceToPoint(point: Vector2): number {
    let minDist = Infinity;

    for (let i = 0; i < this.boundary.length; i++) {
      const j = (i + 1) % this.boundary.length;
      const p1 = this.boundary[i];
      const p2 = this.boundary[j];

      const lineVector = Vector2.fromPoints(p1, p2);
      const len = lineVector.length();

      if (len === 0) {
        minDist = Math.min(minDist, point.distanceTo(p1));
        continue;
      }

      const t = Math.max(
        0,
        Math.min(1, point.clone().sub(p1).dot(lineVector) / (len * len))
      );

      const projection = Vector2.lerp(p1, p2, t);
      minDist = Math.min(minDist, point.distanceTo(projection));
    }

    return minDist;
  }

  /**
   * Transform room
   */
  transform(matrix: TransformMatrix): void {
    this.boundary = this.boundary.map(p => transformPoint(p, matrix));
    this.updateGeometricProperties();
    this.calculateLabelPosition();
    this.markBoundingBoxDirty();
  }

  /**
   * Clone room
   */
  clone(): Room {
    const room = new Room(
      this.boundary,
      this.properties.type,
      this.properties.name,
      this.getLayer()
    );

    room.setColor(this.getColor());
    room.setLineWeight(this.getLineWeight());
    room.setLineType(this.getLineType() as any);
    room.setVisible(this.isVisible());
    room.setLocked(this.isLocked());

    // Copy properties
    room.properties = {
      ...this.properties,
      components: [...this.properties.components],
      materials: [...this.properties.materials],
    };

    return room;
  }

  /**
   * Render room
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2,
    layer?: Layer
  ): void {
    if (!this.isVisible() || this.boundary.length < 3) return;

    ctx.save();

    // Apply style
    const color = this.getColor() || layer?.color || '#00ff00';
    const lineWeight = this.getLineWeight() || layer?.lineWeight || 1;

    // Fill room with semi-transparent color
    ctx.fillStyle = this.isSelected()
      ? 'rgba(74, 158, 255, 0.1)'
      : 'rgba(0, 255, 0, 0.05)';

    ctx.beginPath();
    const firstPoint = worldToScreen(this.boundary[0]);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < this.boundary.length; i++) {
      const point = worldToScreen(this.boundary[i]);
      ctx.lineTo(point.x, point.y);
    }

    ctx.closePath();
    ctx.fill();

    // Draw boundary
    ctx.strokeStyle = this.isSelected() ? '#4a9eff' : color;
    ctx.lineWidth = this.isSelected() ? lineWeight * 1.5 : lineWeight;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // Draw label
    if (this.labelPosition) {
      const labelPos = worldToScreen(this.labelPosition);
      ctx.setLineDash([]);
      ctx.fillStyle = this.isSelected() ? '#4a9eff' : color;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw room name
      ctx.fillText(this.properties.name, labelPos.x, labelPos.y - 10);

      // Draw area
      const areaText = `${this.getArea().toFixed(1)} sq ft`;
      ctx.font = '12px Arial';
      ctx.fillText(areaText, labelPos.x, labelPos.y + 10);
    }

    ctx.restore();
  }

  /**
   * Serialize data
   */
  protected serializeData(): any {
    return {
      boundary: this.boundary.map(p => p.toArray()),
      properties: this.properties,
    };
  }

  /**
   * Deserialize room
   */
  static deserialize(data: any): Room {
    const boundary = data.data.boundary.map((p: number[]) => Vector2.fromArray(p));
    const room = new Room(
      boundary,
      data.data.properties.type,
      data.data.properties.name,
      data.properties.layer
    );

    if (data.properties.color) room.setColor(data.properties.color);
    if (data.properties.lineWeight) room.setLineWeight(data.properties.lineWeight);
    if (data.properties.lineType) room.setLineType(data.properties.lineType);
    room.setVisible(data.properties.visible);
    room.setLocked(data.properties.locked);

    // Restore properties
    room.properties = data.data.properties;

    return room;
  }
}
