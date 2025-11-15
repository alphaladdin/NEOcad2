/**
 * ModeManager - Manages Design Mode and BIM Mode
 *
 * Design Mode: Clean canvas with minimal UI for drawing and layout
 * BIM Mode: Full feature set with property panels, element tree, and advanced tools
 */

import { logger } from '@utils/Logger';
import { eventBus } from './EventBus';

export type AppMode = 'design' | 'bim';

export interface ModeChangeEvent {
  previousMode: AppMode;
  currentMode: AppMode;
  timestamp: Date;
}

/**
 * ModeManager singleton class
 */
export class ModeManager {
  private static instance: ModeManager;
  private currentMode: AppMode = 'design'; // Start in design mode by default
  private readonly STORAGE_KEY = 'neocad_app_mode';

  private constructor() {
    // Load saved mode from localStorage
    this.loadModeFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ModeManager {
    if (!ModeManager.instance) {
      ModeManager.instance = new ModeManager();
    }
    return ModeManager.instance;
  }

  /**
   * Get current mode
   */
  getCurrentMode(): AppMode {
    return this.currentMode;
  }

  /**
   * Set mode
   */
  setMode(mode: AppMode): void {
    if (mode === this.currentMode) {
      logger.debug('ModeManager', `Already in ${mode} mode`);
      return;
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Save to localStorage
    this.saveModeToStorage();

    // Emit mode change event
    const event: ModeChangeEvent = {
      previousMode,
      currentMode: mode,
      timestamp: new Date(),
    };

    eventBus.emit('app:mode:changed', event);

    logger.info('ModeManager', `Mode changed: ${previousMode} → ${mode}`);
  }

  /**
   * Toggle between design and BIM mode
   */
  toggleMode(): void {
    const newMode = this.currentMode === 'design' ? 'bim' : 'design';
    this.setMode(newMode);
  }

  /**
   * Check if current mode is design mode
   */
  isDesignMode(): boolean {
    return this.currentMode === 'design';
  }

  /**
   * Check if current mode is BIM mode
   */
  isBIMMode(): boolean {
    return this.currentMode === 'bim';
  }

  /**
   * Load mode from localStorage
   */
  private loadModeFromStorage(): void {
    try {
      const savedMode = localStorage.getItem(this.STORAGE_KEY) as AppMode | null;
      if (savedMode && (savedMode === 'design' || savedMode === 'bim')) {
        this.currentMode = savedMode;
        logger.info('ModeManager', `Loaded mode from storage: ${savedMode}`);
      }
    } catch (error) {
      logger.warn('ModeManager', 'Failed to load mode from storage', error);
    }
  }

  /**
   * Save mode to localStorage
   */
  private saveModeToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.currentMode);
    } catch (error) {
      logger.warn('ModeManager', 'Failed to save mode to storage', error);
    }
  }

  /**
   * Get mode description
   */
  getModeDescription(mode?: AppMode): string {
    const targetMode = mode || this.currentMode;

    if (targetMode === 'design') {
      return 'Design Mode: Clean canvas for drawing and layout';
    } else {
      return 'BIM Mode: Full feature set with properties and advanced tools';
    }
  }
}

// Export singleton instance
export const modeManager = ModeManager.getInstance();
