/**
 * Global Event Bus for NEOcad
 * Facilitates communication between different parts of the application
 */

import { logger } from '@utils/Logger';

export type EventCallback = (...args: any[]) => void | Promise<void>;

export class EventBus {
  private static instance: EventBus;
  private events: Map<string, Set<EventCallback>>;

  private constructor() {
    this.events = new Map();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    this.events.get(event)!.add(callback);
    logger.debug('EventBus', `Subscribed to event: ${event}`);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event, but only trigger once
   */
  once(event: string, callback: EventCallback): () => void {
    const onceCallback: EventCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };

    return this.on(event, onceCallback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      logger.debug('EventBus', `Unsubscribed from event: ${event}`);

      if (callbacks.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emit an event
   */
  async emit(event: string, ...args: any[]): Promise<void> {
    const callbacks = this.events.get(event);

    if (!callbacks || callbacks.size === 0) {
      logger.debug('EventBus', `No listeners for event: ${event}`);
      return;
    }

    logger.debug('EventBus', `Emitting event: ${event}`, { listenerCount: callbacks.size });

    const promises: Promise<void>[] = [];

    for (const callback of callbacks) {
      try {
        const result = callback(...args);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        logger.error('EventBus', `Error in event handler for ${event}`, error);
      }
    }

    // Wait for all async handlers to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Remove all listeners for a specific event
   */
  clear(event?: string): void {
    if (event) {
      this.events.delete(event);
      logger.info('EventBus', `Cleared all listeners for event: ${event}`);
    } else {
      this.events.clear();
      logger.info('EventBus', 'Cleared all event listeners');
    }
  }

  /**
   * Get all registered event names
   */
  getEvents(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get listener count for an event
   */
  getListenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();

// Define common event names
export const Events = {
  // Application lifecycle
  APP_INIT: 'app:init',
  APP_READY: 'app:ready',
  APP_ERROR: 'app:error',

  // Project events
  PROJECT_NEW: 'project:new',
  PROJECT_OPEN: 'project:open',
  PROJECT_CLOSE: 'project:close',
  PROJECT_SAVE: 'project:save',

  // Model events
  MODEL_LOADING: 'model:loading',
  MODEL_LOADED: 'model:loaded',
  MODEL_UNLOADED: 'model:unloaded',
  MODEL_ERROR: 'model:error',
  MODEL_LOAD_PROGRESS: 'model:load:progress',
  MODEL_LOAD_ERROR: 'model:load:error',

  // Selection events
  SELECTION_CHANGED: 'selection:changed',
  SELECTION_CLEARED: 'selection:cleared',
  OBJECT_SELECTED: 'object:selected',
  OBJECT_DESELECTED: 'object:deselected',
  OBJECT_HOVERED: 'object:hovered',

  // Viewport events
  VIEWPORT_RESIZE: 'viewport:resize',
  VIEWPORT_CAMERA_CHANGED: 'viewport:camera:changed',
  VIEWPORT_NAVIGATION_MODE_CHANGED: 'viewport:navigation:mode:changed',
  VIEWPORT_UPDATED: 'viewport:updated',

  // Tool events
  TOOL_ACTIVATED: 'tool:activated',
  TOOL_DEACTIVATED: 'tool:deactivated',

  // UI events
  UI_PANEL_OPENED: 'ui:panel:opened',
  UI_PANEL_CLOSED: 'ui:panel:closed',
  UI_THEME_CHANGED: 'ui:theme:changed',

  // Collaboration events
  BCF_TOPIC_CREATED: 'bcf:topic:created',
  BCF_TOPIC_UPDATED: 'bcf:topic:updated',
  BCF_COMMENT_ADDED: 'bcf:comment:added',

  // Measurement events
  MEASUREMENT_TOOL_ACTIVATED: 'measurement:tool:activated',
  MEASUREMENT_TOOL_DEACTIVATED: 'measurement:tool:deactivated',
  MEASUREMENT_CREATED: 'measurement:created',
  MEASUREMENT_REMOVED: 'measurement:removed',

  // Clipping events
  CLIPPING_ACTIVATED: 'clipping:activated',
  CLIPPING_DEACTIVATED: 'clipping:deactivated',
  CLIPPING_PLANE_CREATED: 'clipping:plane:created',
  CLIPPING_PLANE_REMOVED: 'clipping:plane:removed',
  CLIPPING_PLANE_TOGGLED: 'clipping:plane:toggled',
  CLIPPING_CLEARED: 'clipping:cleared',

  // Camera preset events
  CAMERA_PRESET_CREATED: 'camera:preset:created',
  CAMERA_PRESET_UPDATED: 'camera:preset:updated',
  CAMERA_PRESET_REMOVED: 'camera:preset:removed',
  CAMERA_PRESET_APPLIED: 'camera:preset:applied',

  // Model comparison events
  MODEL_COMPARISON_CREATED: 'model:comparison:created',
  MODEL_COMPARISON_APPLIED: 'model:comparison:applied',
  MODEL_COMPARISON_CLEARED: 'model:comparison:cleared',
  MODEL_COMPARISON_REMOVED: 'model:comparison:removed',

  // Annotation events
  ANNOTATION_CREATED: 'annotation:created',
  ANNOTATION_UPDATED: 'annotation:updated',
  ANNOTATION_REMOVED: 'annotation:removed',
  ANNOTATION_FOCUSED: 'annotation:focused',
  ANNOTATIONS_IMPORTED: 'annotations:imported',
  ANNOTATIONS_CLEARED: 'annotations:cleared',

  // Filter events
  FILTER_CREATED: 'filter:created',
  FILTER_UPDATED: 'filter:updated',
  FILTER_REMOVED: 'filter:removed',
  FILTER_APPLIED: 'filter:applied',
  FILTER_CLEARED: 'filter:cleared',
  FILTERS_IMPORTED: 'filters:imported',
  FILTERS_CLEARED: 'filters:cleared',

  // Clash detection events
  CLASH_DETECTION_STARTED: 'clash:detection:started',
  CLASH_DETECTION_PROGRESS: 'clash:detection:progress',
  CLASH_DETECTION_COMPLETE: 'clash:detection:complete',
  CLASH_CREATED: 'clash:created',
  CLASH_UPDATED: 'clash:updated',
  CLASH_RESOLVED: 'clash:resolved',

  // Parametric modeling events
  PARAMETRIC_ELEMENT_CREATED: 'parametric:element:created',
  PARAMETRIC_ELEMENT_UPDATED: 'parametric:element:updated',
  PARAMETRIC_ELEMENT_REMOVED: 'parametric:element:removed',
  PARAMETRIC_PARAMETER_CHANGED: 'parametric:parameter:changed',

  // Camera and object interaction events
  CAMERA_FOCUS: 'camera:focus',
  ISOLATE_OBJECTS: 'isolate:objects',

  // Wall type manager events
  WALL_TYPE_ADDED: 'walltype:added',
  WALL_TYPE_REMOVED: 'walltype:removed',
  DEFAULT_WALL_TYPE_CHANGED: 'walltype:default:changed',

  // Appearance manager events
  APPEARANCE_STYLE_ADDED: 'appearance:style:added',
  APPEARANCE_STYLE_REMOVED: 'appearance:style:removed',
  APPEARANCE_STYLE_APPLIED: 'appearance:style:applied',

  // Framing validation events
  FRAMING_RULE_VIOLATED: 'framing:rule:violated',
  FRAMING_RULE_RESOLVED: 'framing:rule:resolved',
  FRAMING_VALIDATION_COMPLETE: 'framing:validation:complete',

  // Layer manager events
  LAYER_ADDED: 'layer:added',
  LAYER_REMOVED: 'layer:removed',
  LAYER_VISIBILITY_CHANGED: 'layer:visibility:changed',
  LAYER_LOCKED_CHANGED: 'layer:locked:changed',

  // Sketch mode events
  SKETCH_MODE_ACTIVATED: 'sketch:mode:activated',
  SKETCH_MODE_DEACTIVATED: 'sketch:mode:deactivated',
  SKETCH_WALL_ADDED: 'sketch:wall:added',
  SKETCH_WALL_REMOVED: 'sketch:wall:removed',
  SKETCH_CLEARED: 'sketch:cleared',

  // Wall events
  WALL_ADDED: 'wall:added',
  WALL_REMOVED: 'wall:removed',
  WALL_UPDATED: 'wall:updated',
} as const;
