import { Vector2 } from './Vector2';

/**
 * Object snap types (osnap) - standard CAD snap modes
 */
export enum SnapType {
  NONE = 'none',
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  QUADRANT = 'quadrant',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent',
  NEAREST = 'nearest',
  NODE = 'node',
  INSERTION = 'insertion',
  EXTENSION = 'extension',
}

/**
 * Snap result with type and location
 */
export interface SnapResult {
  point: Vector2;
  type: SnapType;
  entity?: any; // Reference to snapped entity
  distance: number; // Distance from cursor to snap point
}

/**
 * Entity interface for snapping
 */
export interface SnapEntity {
  type: 'line' | 'circle' | 'arc' | 'polyline' | 'point';
  getSnapPoints(snapTypes: SnapType[]): SnapPoint[];
}

/**
 * Snap point with metadata
 */
export interface SnapPoint {
  point: Vector2;
  type: SnapType;
  entity: any;
}

/**
 * Line segment for snapping
 */
export class LineEntity implements SnapEntity {
  type: 'line' = 'line';

  constructor(public start: Vector2, public end: Vector2) {}

  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    // Endpoint
    if (snapTypes.includes(SnapType.ENDPOINT)) {
      points.push(
        { point: this.start.clone(), type: SnapType.ENDPOINT, entity: this },
        { point: this.end.clone(), type: SnapType.ENDPOINT, entity: this }
      );
    }

    // Midpoint
    if (snapTypes.includes(SnapType.MIDPOINT)) {
      const midpoint = Vector2.lerp(this.start, this.end, 0.5);
      points.push({ point: midpoint, type: SnapType.MIDPOINT, entity: this });
    }

    return points;
  }

  /**
   * Get nearest point on line
   */
  getNearestPoint(point: Vector2): Vector2 {
    const line = Vector2.fromPoints(this.start, this.end);
    const len = line.length();
    if (len === 0) return this.start.clone();

    const t = Math.max(0, Math.min(1,
      point.clone().sub(this.start).dot(line) / (len * len)
    ));

    return Vector2.lerp(this.start, this.end, t);
  }

  /**
   * Get perpendicular point from another point
   */
  getPerpendicularPoint(from: Vector2): Vector2 {
    return this.getNearestPoint(from);
  }
}

/**
 * Circle for snapping
 */
export class CircleEntity implements SnapEntity {
  type: 'circle' = 'circle';

  constructor(public center: Vector2, public radius: number) {}

  getSnapPoints(snapTypes: SnapType[]): SnapPoint[] {
    const points: SnapPoint[] = [];

    // Center
    if (snapTypes.includes(SnapType.CENTER)) {
      points.push({ point: this.center.clone(), type: SnapType.CENTER, entity: this });
    }

    // Quadrants (0°, 90°, 180°, 270°)
    if (snapTypes.includes(SnapType.QUADRANT)) {
      const quadrants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      quadrants.forEach((angle) => {
        const point = new Vector2(
          this.center.x + Math.cos(angle) * this.radius,
          this.center.y + Math.sin(angle) * this.radius
        );
        points.push({ point, type: SnapType.QUADRANT, entity: this });
      });
    }

    return points;
  }

  /**
   * Get nearest point on circle
   */
  getNearestPoint(point: Vector2): Vector2 {
    const direction = Vector2.fromPoints(this.center, point);
    if (direction.length() === 0) return new Vector2(this.center.x + this.radius, this.center.y);
    direction.normalize().multiplyScalar(this.radius);
    return this.center.clone().add(direction);
  }
}

/**
 * SnapManager configuration
 */
export interface SnapConfig {
  enabled: boolean;
  snapDistance: number; // Maximum distance to snap (in screen pixels)
  enabledTypes: SnapType[];
  showIndicators: boolean;
  indicatorSize: number;
  priorityOrder: SnapType[]; // Order of priority when multiple snaps available
}

/**
 * SnapManager - Handles object snapping in CAD viewport
 */
export class SnapManager {
  private config: SnapConfig;
  private entities: SnapEntity[] = [];
  private lastSnapResult: SnapResult | null = null;

  constructor(config?: Partial<SnapConfig>) {
    this.config = {
      enabled: true,
      snapDistance: 15, // pixels
      enabledTypes: [
        SnapType.ENDPOINT,
        SnapType.MIDPOINT,
        SnapType.CENTER,
        SnapType.NEAREST,
      ],
      showIndicators: true,
      indicatorSize: 8,
      priorityOrder: [
        SnapType.ENDPOINT,
        SnapType.MIDPOINT,
        SnapType.CENTER,
        SnapType.QUADRANT,
        SnapType.INTERSECTION,
        SnapType.PERPENDICULAR,
        SnapType.NEAREST,
      ],
      ...config,
    };
  }

  /**
   * Add entity to snap to
   */
  addEntity(entity: SnapEntity): void {
    this.entities.push(entity);
  }

  /**
   * Remove entity
   */
  removeEntity(entity: SnapEntity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  /**
   * Clear all entities
   */
  clearEntities(): void {
    this.entities = [];
  }

  /**
   * Get all entities
   */
  getEntities(): SnapEntity[] {
    return this.entities;
  }

  /**
   * Find snap point near cursor
   * @param cursorWorld Cursor position in world coordinates
   * @param worldToScreen Function to convert world to screen coordinates
   * @param snapTypes Optional override of enabled snap types
   */
  findSnap(
    cursorWorld: Vector2,
    worldToScreen: (point: Vector2) => Vector2,
    snapTypes?: SnapType[]
  ): SnapResult | null {
    if (!this.config.enabled) return null;

    const types = snapTypes || this.config.enabledTypes;
    const cursorScreen = worldToScreen(cursorWorld);
    let bestSnap: SnapResult | null = null;
    let bestPriority = Infinity;

    // Collect all snap points from all entities
    const allSnapPoints: SnapPoint[] = [];
    this.entities.forEach((entity) => {
      const points = entity.getSnapPoints(types);
      allSnapPoints.push(...points);
    });

    // Add nearest point snaps if enabled
    if (types.includes(SnapType.NEAREST)) {
      this.entities.forEach((entity) => {
        let nearestPoint: Vector2;

        if (entity instanceof LineEntity) {
          nearestPoint = entity.getNearestPoint(cursorWorld);
        } else if (entity instanceof CircleEntity) {
          nearestPoint = entity.getNearestPoint(cursorWorld);
        } else {
          return;
        }

        allSnapPoints.push({
          point: nearestPoint,
          type: SnapType.NEAREST,
          entity,
        });
      });
    }

    // Add perpendicular snaps if enabled
    if (types.includes(SnapType.PERPENDICULAR)) {
      this.entities.forEach((entity) => {
        if (entity instanceof LineEntity) {
          const perpPoint = entity.getPerpendicularPoint(cursorWorld);
          allSnapPoints.push({
            point: perpPoint,
            type: SnapType.PERPENDICULAR,
            entity,
          });
        }
      });
    }

    // Find closest snap point within snap distance
    allSnapPoints.forEach((snapPoint) => {
      const snapScreen = worldToScreen(snapPoint.point);
      const distance = cursorScreen.distanceTo(snapScreen);

      if (distance <= this.config.snapDistance) {
        const priority = this.config.priorityOrder.indexOf(snapPoint.type);

        // Choose snap with better priority, or closer if same priority
        if (priority < bestPriority ||
            (priority === bestPriority && (!bestSnap || distance < bestSnap.distance))) {
          bestPriority = priority;
          bestSnap = {
            point: snapPoint.point,
            type: snapPoint.type,
            entity: snapPoint.entity,
            distance,
          };
        }
      }
    });

    this.lastSnapResult = bestSnap;
    return bestSnap;
  }

  /**
   * Get the last snap result
   */
  getLastSnap(): SnapResult | null {
    return this.lastSnapResult;
  }

  /**
   * Enable/disable snapping
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if snapping is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set enabled snap types
   */
  setEnabledTypes(types: SnapType[]): void {
    this.config.enabledTypes = types;
  }

  /**
   * Get enabled snap types
   */
  getEnabledTypes(): SnapType[] {
    return [...this.config.enabledTypes];
  }

  /**
   * Toggle a snap type
   */
  toggleSnapType(type: SnapType): void {
    const index = this.config.enabledTypes.indexOf(type);
    if (index !== -1) {
      this.config.enabledTypes.splice(index, 1);
    } else {
      this.config.enabledTypes.push(type);
    }
  }

  /**
   * Set snap distance
   */
  setSnapDistance(distance: number): void {
    this.config.snapDistance = distance;
  }

  /**
   * Get snap distance
   */
  getSnapDistance(): number {
    return this.config.snapDistance;
  }

  /**
   * Get configuration
   */
  getConfig(): SnapConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Render snap indicator
   */
  renderSnapIndicator(
    ctx: CanvasRenderingContext2D,
    snapResult: SnapResult,
    worldToScreen: (point: Vector2) => Vector2
  ): void {
    if (!this.config.showIndicators) return;

    const screenPos = worldToScreen(snapResult.point);
    const size = this.config.indicatorSize;

    ctx.save();
    ctx.strokeStyle = this.getSnapColor(snapResult.type);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';

    // Draw different shapes based on snap type
    ctx.beginPath();
    switch (snapResult.type) {
      case SnapType.ENDPOINT:
        // Square
        ctx.rect(screenPos.x - size / 2, screenPos.y - size / 2, size, size);
        break;

      case SnapType.MIDPOINT:
        // Triangle
        ctx.moveTo(screenPos.x, screenPos.y - size / 2);
        ctx.lineTo(screenPos.x + size / 2, screenPos.y + size / 2);
        ctx.lineTo(screenPos.x - size / 2, screenPos.y + size / 2);
        ctx.closePath();
        break;

      case SnapType.CENTER:
        // Circle
        ctx.arc(screenPos.x, screenPos.y, size / 2, 0, Math.PI * 2);
        break;

      case SnapType.QUADRANT:
        // Diamond
        ctx.moveTo(screenPos.x, screenPos.y - size / 2);
        ctx.lineTo(screenPos.x + size / 2, screenPos.y);
        ctx.lineTo(screenPos.x, screenPos.y + size / 2);
        ctx.lineTo(screenPos.x - size / 2, screenPos.y);
        ctx.closePath();
        break;

      case SnapType.INTERSECTION:
        // X shape
        ctx.moveTo(screenPos.x - size / 2, screenPos.y - size / 2);
        ctx.lineTo(screenPos.x + size / 2, screenPos.y + size / 2);
        ctx.moveTo(screenPos.x + size / 2, screenPos.y - size / 2);
        ctx.lineTo(screenPos.x - size / 2, screenPos.y + size / 2);
        break;

      case SnapType.PERPENDICULAR:
        // Right angle symbol
        const offset = size / 3;
        ctx.moveTo(screenPos.x - offset, screenPos.y);
        ctx.lineTo(screenPos.x - offset, screenPos.y - offset);
        ctx.lineTo(screenPos.x, screenPos.y - offset);
        break;

      case SnapType.NEAREST:
        // Small circle
        ctx.arc(screenPos.x, screenPos.y, size / 3, 0, Math.PI * 2);
        break;

      default:
        // Default: circle
        ctx.arc(screenPos.x, screenPos.y, size / 2, 0, Math.PI * 2);
    }

    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw label
    this.renderSnapLabel(ctx, snapResult, screenPos);
  }

  /**
   * Render snap label
   */
  private renderSnapLabel(
    ctx: CanvasRenderingContext2D,
    snapResult: SnapResult,
    screenPos: Vector2
  ): void {
    const label = this.getSnapLabel(snapResult.type);
    const padding = 4;
    const offset = 15;

    ctx.save();
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metrics = ctx.measureText(label);
    const width = metrics.width + padding * 2;
    const height = 16;

    // Position label above and to the right
    const labelX = screenPos.x + offset;
    const labelY = screenPos.y - offset;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(labelX, labelY - height, width, height);

    // Border
    ctx.strokeStyle = this.getSnapColor(snapResult.type);
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX, labelY - height, width, height);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, labelX + padding, labelY - height + padding);

    ctx.restore();
  }

  /**
   * Get snap color
   */
  private getSnapColor(type: SnapType): string {
    const colors: Record<SnapType, string> = {
      [SnapType.NONE]: '#888888',
      [SnapType.ENDPOINT]: '#00ff00',
      [SnapType.MIDPOINT]: '#00ffff',
      [SnapType.CENTER]: '#ff0000',
      [SnapType.QUADRANT]: '#ffff00',
      [SnapType.INTERSECTION]: '#ff00ff',
      [SnapType.PERPENDICULAR]: '#00ff88',
      [SnapType.TANGENT]: '#ff8800',
      [SnapType.NEAREST]: '#8888ff',
      [SnapType.NODE]: '#ffffff',
      [SnapType.INSERTION]: '#ff88ff',
      [SnapType.EXTENSION]: '#88ff00',
    };
    return colors[type] || '#888888';
  }

  /**
   * Get snap label
   */
  private getSnapLabel(type: SnapType): string {
    const labels: Record<SnapType, string> = {
      [SnapType.NONE]: 'None',
      [SnapType.ENDPOINT]: 'Endpoint',
      [SnapType.MIDPOINT]: 'Midpoint',
      [SnapType.CENTER]: 'Center',
      [SnapType.QUADRANT]: 'Quadrant',
      [SnapType.INTERSECTION]: 'Intersection',
      [SnapType.PERPENDICULAR]: 'Perpendicular',
      [SnapType.TANGENT]: 'Tangent',
      [SnapType.NEAREST]: 'Nearest',
      [SnapType.NODE]: 'Node',
      [SnapType.INSERTION]: 'Insertion',
      [SnapType.EXTENSION]: 'Extension',
    };
    return labels[type] || 'Snap';
  }
}
