/**
 * State Manager for NEOcad
 * Provides reactive state management across the application
 */

import { logger } from '@utils/Logger';
import { eventBus } from './EventBus';

export type StateChangeCallback<T> = (newValue: T, oldValue: T) => void;

export interface ApplicationState {
  // Application
  initialized: boolean;
  loading: boolean;

  // Project
  projectName: string | null;
  projectModified: boolean;

  // Models
  activeModels: string[];
  selectedElements: Set<string>;

  // Viewport
  viewportCount: number;
  activeViewport: number;
  navigationMode: 'Orbit' | 'Plan' | 'FirstPerson';

  // Tools
  activeTool: string | null;

  // UI
  theme: 'light' | 'dark';
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;

  // Performance
  fps: number;
  memoryUsage: number;
}

export class StateManager {
  private static instance: StateManager;
  private state: ApplicationState;
  private listeners: Map<keyof ApplicationState, Set<StateChangeCallback<any>>>;

  private constructor() {
    this.state = this.getInitialState();
    this.listeners = new Map();
    logger.info('StateManager', 'State manager initialized');
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  private getInitialState(): ApplicationState {
    return {
      initialized: false,
      loading: false,
      projectName: null,
      projectModified: false,
      activeModels: [],
      selectedElements: new Set(),
      viewportCount: 1,
      activeViewport: 0,
      navigationMode: 'Orbit',
      activeTool: null,
      theme: 'dark',
      leftPanelOpen: true,
      rightPanelOpen: true,
      bottomPanelOpen: false,
      fps: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Get a state value
   */
  get<K extends keyof ApplicationState>(key: K): ApplicationState[K] {
    return this.state[key];
  }

  /**
   * Set a state value
   */
  set<K extends keyof ApplicationState>(key: K, value: ApplicationState[K]): void {
    const oldValue = this.state[key];

    if (oldValue === value) {
      return; // No change
    }

    this.state[key] = value;

    logger.debug('StateManager', `State changed: ${key}`, { oldValue, newValue: value });

    // Notify listeners
    this.notifyListeners(key, value, oldValue);

    // Emit global event
    eventBus.emit(`state:${key}:changed`, value, oldValue);
  }

  /**
   * Update multiple state values at once
   */
  update(updates: Partial<ApplicationState>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key as keyof ApplicationState, value);
    }
  }

  /**
   * Subscribe to state changes for a specific key
   */
  subscribe<K extends keyof ApplicationState>(
    key: K,
    callback: StateChangeCallback<ApplicationState[K]>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(key, callback);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe<K extends keyof ApplicationState>(
    key: K,
    callback: StateChangeCallback<ApplicationState[K]>
  ): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Notify all listeners for a specific key
   */
  private notifyListeners<K extends keyof ApplicationState>(
    key: K,
    newValue: ApplicationState[K],
    oldValue: ApplicationState[K]
  ): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          logger.error('StateManager', `Error in state listener for ${key}`, error);
        }
      });
    }
  }

  /**
   * Get the entire state (readonly)
   */
  getState(): Readonly<ApplicationState> {
    return { ...this.state };
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    const initialState = this.getInitialState();
    for (const key in initialState) {
      this.set(key as keyof ApplicationState, initialState[key as keyof ApplicationState]);
    }
    logger.info('StateManager', 'State reset to initial values');
  }

  /**
   * Save state to localStorage
   */
  save(): void {
    try {
      const stateToSave = {
        theme: this.state.theme,
        leftPanelOpen: this.state.leftPanelOpen,
        rightPanelOpen: this.state.rightPanelOpen,
        bottomPanelOpen: this.state.bottomPanelOpen,
        navigationMode: this.state.navigationMode,
      };

      localStorage.setItem('neocad-state', JSON.stringify(stateToSave));
      logger.info('StateManager', 'State saved to localStorage');
    } catch (error) {
      logger.error('StateManager', 'Failed to save state', error);
    }
  }

  /**
   * Load state from localStorage
   */
  load(): void {
    try {
      const saved = localStorage.getItem('neocad-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.update(parsed);
        logger.info('StateManager', 'State loaded from localStorage');
      }
    } catch (error) {
      logger.error('StateManager', 'Failed to load state', error);
    }
  }
}

// Export singleton instance
export const stateManager = StateManager.getInstance();
