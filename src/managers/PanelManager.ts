/**
 * PanelManager - Manages sidebar panels
 */

import { logger } from '@utils/Logger';
import type { Panel } from '@ui/Panel';

export type PanelPosition = 'left' | 'right';

export interface PanelRegistration {
  panel: Panel;
  position: PanelPosition;
}

export class PanelManager {
  private panels: Map<string, PanelRegistration> = new Map();
  private leftSidebar: HTMLElement | null = null;
  private rightSidebar: HTMLElement | null = null;

  constructor() {
    this.initializeSidebars();
    logger.info('PanelManager', 'PanelManager initialized');
  }

  private initializeSidebars(): void {
    this.leftSidebar = document.getElementById('sidebar-left');
    this.rightSidebar = document.getElementById('sidebar-right');

    if (!this.leftSidebar || !this.rightSidebar) {
      logger.warn('PanelManager', 'Sidebar containers not found');
    }
  }

  /**
   * Register a panel to a sidebar
   */
  registerPanel(
    panelId: string,
    panel: Panel,
    position: PanelPosition = 'right'
  ): void {
    // Check if panel already registered
    if (this.panels.has(panelId)) {
      logger.warn('PanelManager', `Panel already registered: ${panelId}`);
      return;
    }

    this.panels.set(panelId, { panel, position });

    // Add panel to appropriate sidebar
    const sidebar = position === 'left' ? this.leftSidebar : this.rightSidebar;
    if (sidebar) {
      sidebar.appendChild(panel.getElement());
      this.showSidebar(position);
    }

    logger.debug('PanelManager', `Panel registered: ${panelId} (${position})`);
  }

  /**
   * Unregister a panel
   */
  unregisterPanel(panelId: string): void {
    const registration = this.panels.get(panelId);
    if (!registration) {
      logger.warn('PanelManager', `Panel not found: ${panelId}`);
      return;
    }

    registration.panel.dispose();
    this.panels.delete(panelId);

    // Hide sidebar if empty
    this.updateSidebarVisibility(registration.position);

    logger.debug('PanelManager', `Panel unregistered: ${panelId}`);
  }

  /**
   * Get a panel by ID
   */
  getPanel(panelId: string): Panel | undefined {
    return this.panels.get(panelId)?.panel;
  }

  /**
   * Show a sidebar
   */
  showSidebar(position: PanelPosition): void {
    const sidebar = position === 'left' ? this.leftSidebar : this.rightSidebar;
    if (sidebar) {
      sidebar.classList.remove('hidden');
    }
  }

  /**
   * Hide a sidebar
   */
  hideSidebar(position: PanelPosition): void {
    const sidebar = position === 'left' ? this.leftSidebar : this.rightSidebar;
    if (sidebar) {
      sidebar.classList.add('hidden');
    }
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar(position: PanelPosition): void {
    const sidebar = position === 'left' ? this.leftSidebar : this.rightSidebar;
    if (sidebar) {
      sidebar.classList.toggle('hidden');
    }
  }

  /**
   * Update sidebar visibility based on panel count
   */
  private updateSidebarVisibility(position: PanelPosition): void {
    const hasPanels = Array.from(this.panels.values()).some(
      (reg) => reg.position === position
    );

    if (!hasPanels) {
      this.hideSidebar(position);
    }
  }

  /**
   * Get all panels in a sidebar
   */
  getPanelsByPosition(position: PanelPosition): Panel[] {
    return Array.from(this.panels.values())
      .filter((reg) => reg.position === position)
      .map((reg) => reg.panel);
  }

  /**
   * Collapse all panels in a position
   */
  collapseAllPanels(position?: PanelPosition): void {
    const panels = position
      ? this.getPanelsByPosition(position)
      : Array.from(this.panels.values()).map((reg) => reg.panel);

    panels.forEach((panel) => panel.collapse());
    logger.debug('PanelManager', 'All panels collapsed');
  }

  /**
   * Expand all panels in a position
   */
  expandAllPanels(position?: PanelPosition): void {
    const panels = position
      ? this.getPanelsByPosition(position)
      : Array.from(this.panels.values()).map((reg) => reg.panel);

    panels.forEach((panel) => panel.expand());
    logger.debug('PanelManager', 'All panels expanded');
  }

  /**
   * Hide all panels (used for Design Mode)
   */
  hideAllPanels(): void {
    this.panels.forEach((registration) => {
      registration.panel.hide();
    });
    this.hideSidebar('left');
    this.hideSidebar('right');
    logger.debug('PanelManager', 'All panels hidden');
  }

  /**
   * Toggle a specific panel visibility
   */
  togglePanel(panelId: string): void {
    const registration = this.panels.get(panelId);
    if (!registration) {
      logger.warn('PanelManager', `Panel not found: ${panelId}`);
      return;
    }

    // Show the panel
    registration.panel.show();
    registration.panel.toggle();

    // Make sure the sidebar is visible
    this.showSidebar(registration.position);

    logger.debug('PanelManager', `Panel toggled: ${panelId}`);
  }

  /**
   * Dispose all panels
   */
  dispose(): void {
    this.panels.forEach((registration) => {
      registration.panel.dispose();
    });
    this.panels.clear();
    logger.info('PanelManager', 'PanelManager disposed');
  }
}
