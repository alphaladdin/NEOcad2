/**
 * ContextMenu - Reusable context menu component
 */

import { logger } from '@utils/Logger';

export interface MenuItem {
  label: string;
  icon?: string;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
}

export class ContextMenu {
  private container: HTMLElement;
  private items: MenuItem[] = [];
  private visible: boolean = false;

  constructor() {
    this.container = this.createContainer();
    this.setupEventListeners();
    logger.debug('ContextMenu', 'ContextMenu created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'context-menu';
    container.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 180px;
      padding: 4px;
      display: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  private setupEventListeners(): void {
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Prevent context menu from opening context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * Show context menu at position
   */
  show(x: number, y: number, items: MenuItem[]): void {
    this.items = items;
    this.render();

    // Position the menu
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.style.display = 'block';
    this.visible = true;

    // Adjust position if menu goes off screen
    const rect = this.container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      this.container.style.left = `${viewportWidth - rect.width - 8}px`;
    }

    if (rect.bottom > viewportHeight) {
      this.container.style.top = `${viewportHeight - rect.height - 8}px`;
    }

    logger.debug('ContextMenu', `Context menu shown at (${x}, ${y})`);
  }

  /**
   * Hide context menu
   */
  hide(): void {
    if (!this.visible) return;
    this.container.style.display = 'none';
    this.visible = false;
    logger.debug('ContextMenu', 'Context menu hidden');
  }

  /**
   * Check if menu is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Render menu items
   */
  private render(): void {
    this.container.innerHTML = '';

    this.items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.style.cssText = `
          height: 1px;
          background: var(--color-border);
          margin: 4px 0;
        `;
        this.container.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('button');
      menuItem.className = 'context-menu-item';
      menuItem.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        text-align: left;
        cursor: pointer;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.15s ease;
        ${item.disabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}
      `;

      if (item.icon) {
        const icon = document.createElement('span');
        icon.textContent = item.icon;
        icon.style.cssText = 'font-size: 14px;';
        menuItem.appendChild(icon);
      }

      const label = document.createElement('span');
      label.textContent = item.label;
      label.style.cssText = 'flex: 1;';
      menuItem.appendChild(label);

      if (!item.disabled) {
        menuItem.addEventListener('click', () => {
          item.action();
          this.hide();
        });

        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.background = 'var(--color-surface-3)';
        });

        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.background = 'transparent';
        });
      }

      this.container.appendChild(menuItem);
    });
  }

  /**
   * Dispose context menu
   */
  dispose(): void {
    this.hide();
    document.body.removeChild(this.container);
    logger.debug('ContextMenu', 'ContextMenu disposed');
  }
}
