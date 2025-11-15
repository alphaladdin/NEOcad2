import { Vector2 } from '../Vector2';
import { Entity, TransformMatrix } from '../entities/Entity';

/**
 * Block definition - Template for reusable entity groups
 */
export class BlockDefinition {
  name: string;
  basePoint: Vector2;
  entities: Entity[];
  description: string;
  created: Date;

  constructor(name: string, entities: Entity[], basePoint: Vector2 = new Vector2(0, 0)) {
    this.name = name;
    this.entities = entities;
    this.basePoint = basePoint.clone();
    this.description = '';
    this.created = new Date();
  }

  /**
   * Clone the block definition
   */
  clone(): BlockDefinition {
    const clonedEntities = this.entities.map((e) => e.clone());
    const block = new BlockDefinition(this.name, clonedEntities, this.basePoint);
    block.description = this.description;
    return block;
  }

  /**
   * Get bounding box of all entities
   */
  getBoundingBox(): { min: Vector2; max: Vector2 } | null {
    if (this.entities.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of this.entities) {
      const bbox = entity.getBoundingBox();
      minX = Math.min(minX, bbox.min.x);
      minY = Math.min(minY, bbox.min.y);
      maxX = Math.max(maxX, bbox.max.x);
      maxY = Math.max(maxY, bbox.max.y);
    }

    return {
      min: new Vector2(minX, minY),
      max: new Vector2(maxX, maxY),
    };
  }
}

/**
 * Block instance - Reference to a block definition with transformation
 */
export class BlockInstance {
  definition: BlockDefinition;
  position: Vector2;
  rotation: number; // Radians
  scale: Vector2;
  layer: string;

  constructor(
    definition: BlockDefinition,
    position: Vector2,
    rotation: number = 0,
    scale: Vector2 = new Vector2(1, 1),
    layer: string = 'G-CONS'
  ) {
    this.definition = definition;
    this.position = position.clone();
    this.rotation = rotation;
    this.scale = scale.clone();
    this.layer = layer;
  }

  /**
   * Get transformation matrix for this instance
   */
  getTransformMatrix(): TransformMatrix {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    // Translate from base point
    const baseOffset = this.definition.basePoint.clone().multiplyScalar(-1);

    return {
      a: this.scale.x * cos,
      b: this.scale.x * sin,
      c: -this.scale.y * sin,
      d: this.scale.y * cos,
      e:
        this.position.x +
        baseOffset.x * this.scale.x * cos -
        baseOffset.y * this.scale.y * sin,
      f:
        this.position.y +
        baseOffset.x * this.scale.x * sin +
        baseOffset.y * this.scale.y * cos,
    };
  }

  /**
   * Get all entities as individual entities with transformations applied
   */
  explode(): Entity[] {
    const matrix = this.getTransformMatrix();
    const entities: Entity[] = [];

    for (const entity of this.definition.entities) {
      const cloned = entity.clone();
      cloned.transform(matrix);
      cloned.setLayer(this.layer);
      entities.push(cloned);
    }

    return entities;
  }

  /**
   * Render block instance
   */
  render(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Vector2) => Vector2
  ): void {
    ctx.save();

    // Get transformation
    const posScreen = worldToScreen(this.position);

    ctx.translate(posScreen.x, posScreen.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale.x, this.scale.y);

    // Render each entity
    for (const entity of this.definition.entities) {
      // Create a modified worldToScreen function for the block's coordinate system
      const blockWorldToScreen = (p: Vector2) => {
        const transformed = new Vector2(
          p.x - this.definition.basePoint.x,
          p.y - this.definition.basePoint.y
        );
        return worldToScreen(transformed);
      };

      entity.render(ctx, blockWorldToScreen);
    }

    ctx.restore();
  }

  /**
   * Clone instance
   */
  clone(): BlockInstance {
    return new BlockInstance(
      this.definition,
      this.position,
      this.rotation,
      this.scale,
      this.layer
    );
  }
}

/**
 * BlockManager - Manage block definitions and instances
 */
export class BlockManager {
  private definitions: Map<string, BlockDefinition> = new Map();
  private instances: BlockInstance[] = [];

  /**
   * Add block definition
   */
  defineBlock(name: string, entities: Entity[], basePoint?: Vector2): BlockDefinition {
    const block = new BlockDefinition(name, entities, basePoint);
    this.definitions.set(name, block);
    return block;
  }

  /**
   * Get block definition
   */
  getDefinition(name: string): BlockDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if block exists
   */
  hasDefinition(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * Get all block names
   */
  getDefinitionNames(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get all definitions
   */
  getDefinitions(): BlockDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Delete block definition
   */
  deleteDefinition(name: string): boolean {
    // Remove all instances using this definition
    this.instances = this.instances.filter((inst) => inst.definition.name !== name);
    return this.definitions.delete(name);
  }

  /**
   * Rename block definition
   */
  renameDefinition(oldName: string, newName: string): boolean {
    const def = this.definitions.get(oldName);
    if (!def) return false;

    def.name = newName;
    this.definitions.delete(oldName);
    this.definitions.set(newName, def);

    return true;
  }

  /**
   * Insert block instance
   */
  insertBlock(
    definitionName: string,
    position: Vector2,
    rotation: number = 0,
    scale?: Vector2,
    layer?: string
  ): BlockInstance | null {
    const definition = this.definitions.get(definitionName);
    if (!definition) {
      console.error(`Block definition '${definitionName}' not found`);
      return null;
    }

    const instance = new BlockInstance(definition, position, rotation, scale, layer);
    this.instances.push(instance);
    return instance;
  }

  /**
   * Remove block instance
   */
  removeInstance(instance: BlockInstance): boolean {
    const index = this.instances.indexOf(instance);
    if (index > -1) {
      this.instances.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all instances
   */
  getInstances(): BlockInstance[] {
    return [...this.instances];
  }

  /**
   * Get instances of a specific block
   */
  getInstancesOfBlock(definitionName: string): BlockInstance[] {
    return this.instances.filter((inst) => inst.definition.name === definitionName);
  }

  /**
   * Explode block instance (convert to individual entities)
   */
  explodeInstance(instance: BlockInstance): Entity[] {
    const entities = instance.explode();
    this.removeInstance(instance);
    return entities;
  }

  /**
   * Explode all instances of a block
   */
  explodeAllInstancesOfBlock(definitionName: string): Entity[] {
    const instances = this.getInstancesOfBlock(definitionName);
    const entities: Entity[] = [];

    for (const instance of instances) {
      entities.push(...instance.explode());
      this.removeInstance(instance);
    }

    return entities;
  }

  /**
   * Create block from selection
   */
  createFromEntities(
    name: string,
    entities: Entity[],
    basePoint?: Vector2
  ): BlockDefinition {
    // Clone entities to avoid modifying originals
    const clonedEntities = entities.map((e) => e.clone());

    // Calculate base point if not provided (use centroid)
    if (!basePoint) {
      basePoint = this.calculateCentroid(entities);
    }

    return this.defineBlock(name, clonedEntities, basePoint);
  }

  /**
   * Calculate centroid of entities
   */
  private calculateCentroid(entities: Entity[]): Vector2 {
    if (entities.length === 0) return new Vector2(0, 0);

    let sumX = 0;
    let sumY = 0;

    for (const entity of entities) {
      const bbox = entity.getBoundingBox();
      const center = new Vector2(
        (bbox.min.x + bbox.max.x) / 2,
        (bbox.min.y + bbox.max.y) / 2
      );
      sumX += center.x;
      sumY += center.y;
    }

    return new Vector2(sumX / entities.length, sumY / entities.length);
  }

  /**
   * Get usage statistics
   */
  getStatistics(): {
    definitionCount: number;
    instanceCount: number;
    definitions: Array<{ name: string; instanceCount: number }>;
  } {
    const stats: Array<{ name: string; instanceCount: number }> = [];

    for (const def of this.definitions.values()) {
      stats.push({
        name: def.name,
        instanceCount: this.getInstancesOfBlock(def.name).length,
      });
    }

    return {
      definitionCount: this.definitions.size,
      instanceCount: this.instances.length,
      definitions: stats,
    };
  }

  /**
   * Clear all blocks and instances
   */
  clear(): void {
    this.definitions.clear();
    this.instances = [];
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      definitions: Array.from(this.definitions.values()).map((def) => ({
        name: def.name,
        description: def.description,
        basePoint: def.basePoint.toArray(),
        entities: def.entities.map((e) => e.serialize()),
      })),
      instances: this.instances.map((inst) => ({
        definitionName: inst.definition.name,
        position: inst.position.toArray(),
        rotation: inst.rotation,
        scale: inst.scale.toArray(),
        layer: inst.layer,
      })),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): BlockManager {
    const manager = new BlockManager();

    // Load definitions first
    if (data.definitions) {
      for (const defData of data.definitions) {
        // Would need entity deserialization here
        // Simplified for now
        const entities: Entity[] = []; // TODO: deserialize entities
        const def = manager.defineBlock(
          defData.name,
          entities,
          Vector2.fromArray(defData.basePoint)
        );
        def.description = defData.description;
      }
    }

    // Load instances
    if (data.instances) {
      for (const instData of data.instances) {
        manager.insertBlock(
          instData.definitionName,
          Vector2.fromArray(instData.position),
          instData.rotation,
          Vector2.fromArray(instData.scale),
          instData.layer
        );
      }
    }

    return manager;
  }
}
