import { Vector2 } from '../Vector2';
import { Entity, BoundingBox } from '../entities/Entity';

/**
 * QuadTree node
 */
class QuadTreeNode {
  bounds: BoundingBox;
  entities: Entity[] = [];
  children: QuadTreeNode[] | null = null;
  capacity: number;
  maxDepth: number;
  depth: number;

  constructor(bounds: BoundingBox, capacity: number, maxDepth: number, depth: number = 0) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  /**
   * Check if node is subdivided
   */
  isSubdivided(): boolean {
    return this.children !== null;
  }

  /**
   * Subdivide node into 4 children
   */
  subdivide(): void {
    const { min, max } = this.bounds;
    const midX = (min.x + max.x) / 2;
    const midY = (min.y + max.y) / 2;

    // Create 4 child quadrants
    this.children = [
      // Top-left
      new QuadTreeNode(
        { min: new Vector2(min.x, midY), max: new Vector2(midX, max.y) },
        this.capacity,
        this.maxDepth,
        this.depth + 1
      ),
      // Top-right
      new QuadTreeNode(
        { min: new Vector2(midX, midY), max: new Vector2(max.x, max.y) },
        this.capacity,
        this.maxDepth,
        this.depth + 1
      ),
      // Bottom-left
      new QuadTreeNode(
        { min: new Vector2(min.x, min.y), max: new Vector2(midX, midY) },
        this.capacity,
        this.maxDepth,
        this.depth + 1
      ),
      // Bottom-right
      new QuadTreeNode(
        { min: new Vector2(midX, min.y), max: new Vector2(max.x, midY) },
        this.capacity,
        this.maxDepth,
        this.depth + 1
      ),
    ];
  }

  /**
   * Insert entity into node
   */
  insert(entity: Entity): boolean {
    const bbox = entity.getBoundingBox();

    // Check if entity fits in this node
    if (!this.intersects(bbox)) {
      return false;
    }

    // If not subdivided and under capacity, add here
    if (!this.isSubdivided()) {
      if (this.entities.length < this.capacity || this.depth >= this.maxDepth) {
        this.entities.push(entity);
        return true;
      }

      // Need to subdivide
      this.subdivide();

      // Move existing entities to children
      const existingEntities = [...this.entities];
      this.entities = [];

      for (const e of existingEntities) {
        this.insertIntoChildren(e);
      }
    }

    // Insert into children
    return this.insertIntoChildren(entity);
  }

  /**
   * Insert entity into children
   */
  private insertIntoChildren(entity: Entity): boolean {
    if (!this.children) return false;

    let inserted = false;
    for (const child of this.children) {
      if (child.insert(entity)) {
        inserted = true;
      }
    }

    // If entity spans multiple children, keep reference in parent too
    if (!inserted) {
      this.entities.push(entity);
      inserted = true;
    }

    return inserted;
  }

  /**
   * Query entities in range
   */
  query(range: BoundingBox, found: Entity[] = []): Entity[] {
    // If range doesn't intersect this node, return
    if (!this.intersects(range)) {
      return found;
    }

    // Add entities in this node
    for (const entity of this.entities) {
      const bbox = entity.getBoundingBox();
      if (this.boxIntersects(bbox, range) && !found.includes(entity)) {
        found.push(entity);
      }
    }

    // Query children
    if (this.isSubdivided() && this.children) {
      for (const child of this.children) {
        child.query(range, found);
      }
    }

    return found;
  }

  /**
   * Query entities at point
   */
  queryPoint(point: Vector2, tolerance: number, found: Entity[] = []): Entity[] {
    const range: BoundingBox = {
      min: new Vector2(point.x - tolerance, point.y - tolerance),
      max: new Vector2(point.x + tolerance, point.y + tolerance),
    };

    return this.query(range, found);
  }

  /**
   * Check if bounding box intersects node bounds
   */
  private intersects(bbox: BoundingBox): boolean {
    return this.boxIntersects(bbox, this.bounds);
  }

  /**
   * Check if two bounding boxes intersect
   */
  private boxIntersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.max.x < b.min.x ||
      a.min.x > b.max.x ||
      a.max.y < b.min.y ||
      a.min.y > b.max.y
    );
  }

  /**
   * Remove entity from node
   */
  remove(entity: Entity): boolean {
    let removed = false;

    // Remove from this node
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      removed = true;
    }

    // Remove from children
    if (this.isSubdivided() && this.children) {
      for (const child of this.children) {
        if (child.remove(entity)) {
          removed = true;
        }
      }
    }

    return removed;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities = [];
    this.children = null;
  }

  /**
   * Get total entity count (including children)
   */
  getEntityCount(): number {
    let count = this.entities.length;

    if (this.isSubdivided() && this.children) {
      for (const child of this.children) {
        count += child.getEntityCount();
      }
    }

    return count;
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    let count = 1;

    if (this.isSubdivided() && this.children) {
      for (const child of this.children) {
        count += child.getNodeCount();
      }
    }

    return count;
  }
}

/**
 * QuadTree - Spatial indexing structure for fast entity queries
 */
export class QuadTree {
  private root: QuadTreeNode;
  private capacity: number;
  private maxDepth: number;

  constructor(bounds: BoundingBox, capacity: number = 10, maxDepth: number = 8) {
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.root = new QuadTreeNode(bounds, capacity, maxDepth);
  }

  /**
   * Insert entity
   */
  insert(entity: Entity): boolean {
    return this.root.insert(entity);
  }

  /**
   * Insert multiple entities
   */
  insertMany(entities: Entity[]): void {
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  /**
   * Remove entity
   */
  remove(entity: Entity): boolean {
    return this.root.remove(entity);
  }

  /**
   * Query entities in range
   */
  query(range: BoundingBox): Entity[] {
    return this.root.query(range);
  }

  /**
   * Query entities at point
   */
  queryPoint(point: Vector2, tolerance: number = 0.1): Entity[] {
    return this.root.queryPoint(point, tolerance);
  }

  /**
   * Query entities in circle
   */
  queryCircle(center: Vector2, radius: number): Entity[] {
    // Use bounding box of circle
    const range: BoundingBox = {
      min: new Vector2(center.x - radius, center.y - radius),
      max: new Vector2(center.x + radius, center.y + radius),
    };

    const entities = this.query(range);

    // Filter to actual circle
    return entities.filter((entity) => {
      const bbox = entity.getBoundingBox();
      const closest = new Vector2(
        Math.max(bbox.min.x, Math.min(center.x, bbox.max.x)),
        Math.max(bbox.min.y, Math.min(center.y, bbox.max.y))
      );
      return center.distanceTo(closest) <= radius;
    });
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.root.clear();
  }

  /**
   * Rebuild tree
   */
  rebuild(entities: Entity[], bounds?: BoundingBox): void {
    // Calculate bounds if not provided
    if (!bounds && entities.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const entity of entities) {
        const bbox = entity.getBoundingBox();
        minX = Math.min(minX, bbox.min.x);
        minY = Math.min(minY, bbox.min.y);
        maxX = Math.max(maxX, bbox.max.x);
        maxY = Math.max(maxY, bbox.max.y);
      }

      // Add padding
      const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
      bounds = {
        min: new Vector2(minX - padding, minY - padding),
        max: new Vector2(maxX + padding, maxY + padding),
      };
    }

    if (!bounds) {
      bounds = {
        min: new Vector2(-1000, -1000),
        max: new Vector2(1000, 1000),
      };
    }

    // Create new root
    this.root = new QuadTreeNode(bounds, this.capacity, this.maxDepth);

    // Insert all entities
    this.insertMany(entities);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    entityCount: number;
    nodeCount: number;
    capacity: number;
    maxDepth: number;
  } {
    return {
      entityCount: this.root.getEntityCount(),
      nodeCount: this.root.getNodeCount(),
      capacity: this.capacity,
      maxDepth: this.maxDepth,
    };
  }

  /**
   * Get bounds
   */
  getBounds(): BoundingBox {
    return this.root.bounds;
  }
}
