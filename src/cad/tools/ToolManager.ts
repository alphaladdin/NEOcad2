import { DrawingTool, MouseEventData, KeyEventData } from './DrawingTool';
import { Entity } from '../entities/Entity';

/**
 * Tool change event data
 */
export interface ToolChangeEvent {
  previousTool: DrawingTool | null;
  currentTool: DrawingTool | null;
}

/**
 * Entity created event data
 */
export interface EntityCreatedEvent {
  entities: Entity[];
  tool: DrawingTool;
}

/**
 * ToolManager - Manages active drawing tools and tool switching
 */
export class ToolManager {
  private tools: Map<string, DrawingTool> = new Map();
  private activeTool: DrawingTool | null = null;
  private entities: Entity[] = [];
  private eventCallbacks: Map<string, Set<Function>> = new Map();

  /**
   * Register a tool
   */
  registerTool(name: string, tool: DrawingTool): void {
    this.tools.set(name, tool);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): DrawingTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Map<string, DrawingTool> {
    return new Map(this.tools);
  }

  /**
   * Set active tool
   */
  setActiveTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      console.warn(`Tool ${name} not found`);
      return false;
    }

    const previousTool = this.activeTool;

    // Deactivate current tool
    if (this.activeTool) {
      // Collect any completed entities before deactivating
      const completedEntities = this.activeTool.getCompletedEntities();
      if (completedEntities.length > 0) {
        this.entities.push(...completedEntities);
        this.emit('entitiesCreated', {
          entities: completedEntities,
          tool: this.activeTool,
        });
      }

      this.activeTool.deactivate();
    }

    // Activate new tool
    this.activeTool = tool;
    this.activeTool.activate();

    // Emit tool change event
    this.emit('toolChanged', {
      previousTool,
      currentTool: tool,
    });

    return true;
  }

  /**
   * Get active tool
   */
  getActiveTool(): DrawingTool | null {
    return this.activeTool;
  }

  /**
   * Check if a tool is active
   */
  hasActiveTool(): boolean {
    return this.activeTool !== null;
  }

  /**
   * Deactivate current tool
   */
  deactivateTool(): void {
    if (this.activeTool) {
      // Collect any completed entities before deactivating
      const completedEntities = this.activeTool.getCompletedEntities();
      if (completedEntities.length > 0) {
        this.entities.push(...completedEntities);
        this.emit('entitiesCreated', {
          entities: completedEntities,
          tool: this.activeTool,
        });
      }

      const previousTool = this.activeTool;
      this.activeTool.deactivate();
      this.activeTool = null;

      this.emit('toolChanged', {
        previousTool,
        currentTool: null,
      });
    }
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(event: MouseEventData): void {
    if (this.activeTool) {
      this.activeTool.onMouseDown(event);

      // Check for completed entities after mouse down
      this.collectCompletedEntities();
    }
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(event: MouseEventData): void {
    if (this.activeTool) {
      this.activeTool.onMouseMove(event);
    }
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(event: MouseEventData): void {
    if (this.activeTool) {
      this.activeTool.onMouseUp(event);
    }
  }

  /**
   * Handle key down event
   */
  handleKeyDown(event: KeyEventData): boolean {
    if (this.activeTool) {
      return this.activeTool.onKeyDown(event);
    }
    return false;
  }

  /**
   * Render active tool graphics
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.activeTool) {
      this.activeTool.render(ctx);
    }
  }

  /**
   * Collect completed entities from active tool
   */
  private collectCompletedEntities(): void {
    if (!this.activeTool) return;

    const completedEntities = this.activeTool.getCompletedEntities();
    console.log('[ToolManager] Collecting completed entities:', completedEntities.length);
    if (completedEntities.length > 0) {
      console.log('[ToolManager] Emitting entitiesCreated event with', completedEntities.length, 'entities');
      this.entities.push(...completedEntities);
      this.emit('entitiesCreated', {
        entities: completedEntities,
        tool: this.activeTool,
      });

      // Clear the tool's completed entities after collecting them
      // We need to access the protected property to clear it
      (this.activeTool as any).completedEntities = [];
    }
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
    this.emit('entityAdded', entity);
  }

  /**
   * Remove entity
   */
  removeEntity(entity: Entity): boolean {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
      this.emit('entityRemoved', entity);
      return true;
    }
    return false;
  }

  /**
   * Clear all entities
   */
  clearEntities(): void {
    this.entities = [];
    this.emit('entitiesCleared');
  }

  /**
   * Get entities on a specific layer
   */
  getEntitiesByLayer(layer: string): Entity[] {
    return this.entities.filter((e) => e.getLayer() === layer);
  }

  /**
   * Get selected entities
   */
  getSelectedEntities(): Entity[] {
    return this.entities.filter((e) => e.isSelected());
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
   * Get cursor style for active tool
   */
  getCursor(): string {
    return this.activeTool ? this.activeTool.getCursor() : 'default';
  }

  /**
   * Get current prompt message
   */
  getPrompt(): string {
    return this.activeTool ? this.activeTool.getPrompt() : '';
  }
}
