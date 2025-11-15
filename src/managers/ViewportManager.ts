/**
 * ViewportManager - Manages all viewports in the application
 */

import * as OBC from '@thatopen/components';
import { Viewport, ViewportConfig } from '../viewport/Viewport';
import { logger } from '@utils/Logger';
import { stateManager } from '@core/StateManager';

export class ViewportManager {
  private components: OBC.Components;
  private viewports: Map<string, Viewport> = new Map();
  private activeViewportId: string | null = null;

  constructor(components: OBC.Components) {
    this.components = components;
    logger.info('ViewportManager', 'ViewportManager initialized');
  }

  /**
   * Create a new viewport
   */
  createViewport(config: ViewportConfig): Viewport {
    const viewport = new Viewport(this.components, config);
    this.viewports.set(viewport.id, viewport);

    // Set as active if it's the first viewport
    if (this.viewports.size === 1) {
      this.setActiveViewport(viewport.id);
    }

    stateManager.set('viewportCount', this.viewports.size);
    logger.info('ViewportManager', `Created viewport ${viewport.id}. Total: ${this.viewports.size}`);

    return viewport;
  }

  /**
   * Get a viewport by ID
   */
  getViewport(id: string): Viewport | undefined {
    return this.viewports.get(id);
  }

  /**
   * Get the active viewport
   */
  getActiveViewport(): Viewport | null {
    if (!this.activeViewportId) return null;
    return this.viewports.get(this.activeViewportId) || null;
  }

  /**
   * Set the active viewport
   */
  setActiveViewport(id: string): void {
    const viewport = this.viewports.get(id);
    if (!viewport) {
      logger.warn('ViewportManager', `Viewport ${id} not found`);
      return;
    }

    this.activeViewportId = id;
    stateManager.set('activeViewport', Array.from(this.viewports.keys()).indexOf(id));
    logger.info('ViewportManager', `Active viewport set to ${id}`);
  }

  /**
   * Delete a viewport
   */
  deleteViewport(id: string): void {
    const viewport = this.viewports.get(id);
    if (!viewport) {
      logger.warn('ViewportManager', `Viewport ${id} not found`);
      return;
    }

    viewport.dispose();
    this.viewports.delete(id);

    // If this was the active viewport, set another one as active
    if (this.activeViewportId === id) {
      const firstViewport = this.viewports.values().next().value;
      if (firstViewport) {
        this.setActiveViewport(firstViewport.id);
      } else {
        this.activeViewportId = null;
      }
    }

    stateManager.set('viewportCount', this.viewports.size);
    logger.info('ViewportManager', `Deleted viewport ${id}. Total: ${this.viewports.size}`);
  }

  /**
   * Get all viewports
   */
  getAllViewports(): Viewport[] {
    return Array.from(this.viewports.values());
  }

  /**
   * Set navigation mode for active viewport
   */
  setNavigationMode(mode: 'Orbit' | 'Plan' | 'FirstPerson'): void {
    const activeViewport = this.getActiveViewport();
    if (activeViewport) {
      activeViewport.setNavigationMode(mode);
      stateManager.set('navigationMode', mode);
    }
  }

  /**
   * Fit to view in active viewport
   */
  fitToView(): void {
    const activeViewport = this.getActiveViewport();
    if (activeViewport) {
      activeViewport.fitToView();
    }
  }

  /**
   * Dispose all viewports
   */
  dispose(): void {
    logger.info('ViewportManager', 'Disposing all viewports');

    for (const viewport of this.viewports.values()) {
      viewport.dispose();
    }

    this.viewports.clear();
    this.activeViewportId = null;
    stateManager.set('viewportCount', 0);
  }
}
