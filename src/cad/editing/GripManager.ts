import { Vector2 } from '../Vector2';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { Circle } from '../entities/Circle';
import { Arc } from '../entities/Arc';
import { Rectangle } from '../entities/Rectangle';

/**
 * Grip type
 */
export enum GripType {
  MOVE = 'move',
  STRETCH = 'stretch',
  ROTATE = 'rotate',
  SCALE = 'scale',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
}

/**
 * Grip point
 */
export interface Grip {
  position: Vector2;
  type: GripType;
  entity: Entity;
  index?: number; // For multi-point entities
  hot?: boolean; // Currently hovered/selected
}

/**
 * GripManager - Manage grip points for entity editing
 */
export class GripManager {
  private grips: Grip[] = [];
  private activeGrip: Grip | null = null;
  private hoveredGrip: Grip | null = null;
  private gripSize: number = 6;

  /**
   * Generate grips for selected entities
   */
  generateGrips(entities: Entity[]): void {
    this.grips = [];

    for (const entity of entities) {
      const entityGrips = this.getEntityGrips(entity);
      this.grips.push(...entityGrips);
    }
  }

  /**
   * Get grips for a specific entity
   */
  private getEntityGrips(entity: Entity): Grip[] {
    const grips: Grip[] = [];

    if (entity instanceof Line) {
      const start = entity.getStart();
      const end = entity.getEnd();
      const mid = Vector2.lerp(start, end, 0.5);

      grips.push(
        { position: start, type: GripType.STRETCH, entity, index: 0 },
        { position: end, type: GripType.STRETCH, entity, index: 1 },
        { position: mid, type: GripType.MIDPOINT, entity }
      );
    } else if (entity instanceof Circle) {
      const center = entity.getCenter();
      const radius = entity.getRadius();

      grips.push({ position: center, type: GripType.CENTER, entity });

      // Quadrant grips
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      angles.forEach((angle, index) => {
        const pos = new Vector2(
          center.x + Math.cos(angle) * radius,
          center.y + Math.sin(angle) * radius
        );
        grips.push({ position: pos, type: GripType.STRETCH, entity, index });
      });
    } else if (entity instanceof Arc) {
      const center = entity.getCenter();
      const start = entity.getStartPoint();
      const end = entity.getEndPoint();
      const mid = entity.getMidPoint();

      grips.push(
        { position: center, type: GripType.CENTER, entity },
        { position: start, type: GripType.STRETCH, entity, index: 0 },
        { position: end, type: GripType.STRETCH, entity, index: 1 },
        { position: mid, type: GripType.MIDPOINT, entity }
      );
    } else if (entity instanceof Rectangle) {
      const corners = entity.getCorners();
      const center = entity.getCenter();

      grips.push({ position: center, type: GripType.CENTER, entity });

      corners.forEach((corner, index) => {
        grips.push({ position: corner, type: GripType.STRETCH, entity, index });
      });

      // Midpoint grips on edges
      for (let i = 0; i < 4; i++) {
        const mid = Vector2.lerp(corners[i], corners[(i + 1) % 4], 0.5);
        grips.push({ position: mid, type: GripType.MIDPOINT, entity, index: i + 4 });
      }
    }

    return grips;
  }

  /**
   * Get all grips
   */
  getGrips(): Grip[] {
    return this.grips;
  }

  /**
   * Find grip at position
   */
  findGripAt(position: Vector2, tolerance: number = 10): Grip | null {
    let closestGrip: Grip | null = null;
    let minDistance = tolerance;

    for (const grip of this.grips) {
      const distance = grip.position.distanceTo(position);
      if (distance < minDistance) {
        minDistance = distance;
        closestGrip = grip;
      }
    }

    return closestGrip;
  }

  /**
   * Set hovered grip
   */
  setHoveredGrip(grip: Grip | null): void {
    if (this.hoveredGrip) {
      this.hoveredGrip.hot = false;
    }

    this.hoveredGrip = grip;

    if (this.hoveredGrip) {
      this.hoveredGrip.hot = true;
    }
  }

  /**
   * Get hovered grip
   */
  getHoveredGrip(): Grip | null {
    return this.hoveredGrip;
  }

  /**
   * Set active grip (being dragged)
   */
  setActiveGrip(grip: Grip | null): void {
    this.activeGrip = grip;
  }

  /**
   * Get active grip
   */
  getActiveGrip(): Grip | null {
    return this.activeGrip;
  }

  /**
   * Update grip position (during drag)
   */
  updateGripPosition(grip: Grip, newPosition: Vector2): void {
    const entity = grip.entity;

    if (entity instanceof Line) {
      if (grip.type === GripType.STRETCH) {
        if (grip.index === 0) {
          entity.setStart(newPosition);
        } else if (grip.index === 1) {
          entity.setEnd(newPosition);
        }
      } else if (grip.type === GripType.MIDPOINT) {
        // Move entire line
        const mid = Vector2.lerp(entity.getStart(), entity.getEnd(), 0.5);
        const offset = Vector2.fromPoints(mid, newPosition);
        entity.setStart(entity.getStart().add(offset));
        entity.setEnd(entity.getEnd().add(offset));
      }
    } else if (entity instanceof Circle) {
      if (grip.type === GripType.CENTER) {
        entity.setCenter(newPosition);
      } else if (grip.type === GripType.STRETCH) {
        // Adjust radius
        const newRadius = entity.getCenter().distanceTo(newPosition);
        entity.setRadius(newRadius);
      }
    } else if (entity instanceof Arc) {
      if (grip.type === GripType.CENTER) {
        entity.setCenter(newPosition);
      } else if (grip.type === GripType.STRETCH) {
        if (grip.index === 0) {
          // Update start angle
          const angle = Math.atan2(
            newPosition.y - entity.getCenter().y,
            newPosition.x - entity.getCenter().x
          );
          entity.setStartAngle(angle);
        } else if (grip.index === 1) {
          // Update end angle
          const angle = Math.atan2(
            newPosition.y - entity.getCenter().y,
            newPosition.x - entity.getCenter().x
          );
          entity.setEndAngle(angle);
        }
      }
    } else if (entity instanceof Rectangle) {
      if (grip.type === GripType.CENTER) {
        const center = entity.getCenter();
        const offset = Vector2.fromPoints(center, newPosition);
        entity.setCorner1(entity.getCorner1().add(offset));
        entity.setCorner2(entity.getCorner2().add(offset));
      } else if (grip.type === GripType.STRETCH && grip.index !== undefined) {
        if (grip.index < 4) {
          // Corner grip
          this.updateRectangleCorner(entity, grip.index, newPosition);
        } else {
          // Edge midpoint grip
          this.updateRectangleEdge(entity, grip.index - 4, newPosition);
        }
      }
    }

    // Update grip position after entity modification
    grip.position = newPosition.clone();
  }

  /**
   * Update rectangle corner
   */
  private updateRectangleCorner(rectangle: Rectangle, cornerIndex: number, newPosition: Vector2): void {
    const corners = rectangle.getCorners();
    const oppositeIndex = (cornerIndex + 2) % 4;
    const opposite = corners[oppositeIndex];

    rectangle.setCorner1(opposite);
    rectangle.setCorner2(newPosition);
  }

  /**
   * Update rectangle edge
   */
  private updateRectangleEdge(rectangle: Rectangle, edgeIndex: number, newPosition: Vector2): void {
    const corners = rectangle.getCorners();
    const corner1 = corners[edgeIndex];
    const corner2 = corners[(edgeIndex + 1) % 4];

    // Calculate perpendicular offset
    const edgeDir = Vector2.fromPoints(corner1, corner2);
    const perpDir = new Vector2(-edgeDir.y, edgeDir.x).normalize();
    const midpoint = Vector2.lerp(corner1, corner2, 0.5);
    const offset = Vector2.fromPoints(midpoint, newPosition).dot(perpDir);

    // Update rectangle dimensions
    const newCorner1 = corner1.clone().add(perpDir.clone().multiplyScalar(offset));
    const newCorner2 = corner2.clone().add(perpDir.clone().multiplyScalar(offset));

    // This is simplified - would need more sophisticated logic for proper edge dragging
    rectangle.setCorner1(newCorner1);
    rectangle.setCorner2(corners[(edgeIndex + 2) % 4]);
  }

  /**
   * Clear all grips
   */
  clear(): void {
    this.grips = [];
    this.activeGrip = null;
    this.hoveredGrip = null;
  }

  /**
   * Render grips
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2
  ): void {
    ctx.save();

    for (const grip of this.grips) {
      const screenPos = worldToScreen(grip.position);

      // Determine grip color and size based on state
      let fillColor = '#4a9eff';
      let strokeColor = '#ffffff';
      let size = this.gripSize;

      if (grip.hot || grip === this.activeGrip) {
        fillColor = '#ff4a9e';
        size = this.gripSize + 2;
      }

      if (grip.type === GripType.CENTER) {
        fillColor = '#ffaa00';
      } else if (grip.type === GripType.MIDPOINT) {
        fillColor = '#00ff00';
        size = this.gripSize - 2;
      }

      // Draw grip based on type
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;

      if (grip.type === GripType.CENTER) {
        // Draw as circle
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw as square
        ctx.fillRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size);
        ctx.strokeRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size);
      }
    }

    ctx.restore();
  }
}
