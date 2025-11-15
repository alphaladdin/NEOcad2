/**
 * StatusBar - Bottom status bar with information display
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface StatusItem {
  id: string;
  label: string;
  value: string;
  order?: number;
}

export class StatusBar {
  private container: HTMLElement;
  private items: Map<string, StatusItem> = new Map();
  private itemElements: Map<string, HTMLDivElement> = new Map();

  constructor(containerId: string = 'statusbar') {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`StatusBar container #${containerId} not found`);
    }
    this.container = container;

    this.setupDefaultItems();

    logger.info('StatusBar', 'StatusBar initialized');
  }

  private setupDefaultItems(): void {
    // Mouse position
    this.addItem({
      id: 'mouse-pos',
      label: 'Mouse',
      value: '0.00, 0.00, 0.00',
      order: 1,
    });

    // Selection count
    this.addItem({
      id: 'selection',
      label: 'Selected',
      value: '0',
      order: 2,
    });

    // FPS counter
    this.addItem({
      id: 'fps',
      label: 'FPS',
      value: '60',
      order: 10,
    });

    // Start FPS monitoring
    this.startFPSMonitor();

    // Listen to selection events
    eventBus.on(Events.OBJECT_SELECTED, () => this.updateSelection());
    eventBus.on(Events.OBJECT_DESELECTED, () => this.updateSelection());
    eventBus.on(Events.SELECTION_CLEARED, () => this.updateSelection());
  }

  /**
   * Add a status item
   */
  addItem(item: StatusItem): void {
    this.items.set(item.id, item);

    const itemEl = document.createElement('div');
    itemEl.className = 'statusbar-item';
    itemEl.id = `statusbar-item-${item.id}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'statusbar-label';
    labelEl.textContent = item.label + ':';

    const valueEl = document.createElement('span');
    valueEl.className = 'statusbar-value';
    valueEl.textContent = item.value;
    valueEl.id = `statusbar-value-${item.id}`;

    itemEl.appendChild(labelEl);
    itemEl.appendChild(valueEl);

    this.itemElements.set(item.id, itemEl);

    // Insert in order
    const items = Array.from(this.items.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    const index = items.findIndex((i) => i.id === item.id);
    const nextItem = items[index + 1];

    if (nextItem) {
      const nextEl = this.itemElements.get(nextItem.id);
      if (nextEl) {
        this.container.insertBefore(itemEl, nextEl);
      } else {
        this.container.appendChild(itemEl);
      }
    } else {
      this.container.appendChild(itemEl);
    }

    // Add separator after item
    if (index < items.length - 1) {
      const separator = document.createElement('div');
      separator.className = 'statusbar-separator';
      this.container.insertBefore(separator, itemEl.nextSibling);
    }

    logger.debug('StatusBar', `Added item: ${item.id}`);
  }

  /**
   * Update item value
   */
  setValue(itemId: string, value: string): void {
    const item = this.items.get(itemId);
    if (item) {
      item.value = value;
    }

    const valueEl = document.getElementById(`statusbar-value-${itemId}`);
    if (valueEl) {
      valueEl.textContent = value;
    }
  }

  /**
   * Update mouse position
   */
  updateMousePosition(x: number, y: number, z: number = 0): void {
    this.setValue('mouse-pos', `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
  }

  /**
   * Update selection count
   */
  private updateSelection(): void {
    // This will be connected to the highlighter later
    // For now, just a placeholder
    this.setValue('selection', '0');
  }

  /**
   * Start FPS monitoring
   */
  private startFPSMonitor(): void {
    let lastTime = performance.now();
    let frames = 0;

    const updateFPS = () => {
      frames++;
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= 1000) {
        const fps = Math.round((frames * 1000) / deltaTime);
        this.setValue('fps', fps.toString());
        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(updateFPS);
    };

    requestAnimationFrame(updateFPS);
  }

  /**
   * Remove an item
   */
  removeItem(itemId: string): void {
    const itemEl = this.itemElements.get(itemId);
    if (itemEl) {
      // Remove separator after it
      const separator = itemEl.nextElementSibling;
      if (separator && separator.classList.contains('statusbar-separator')) {
        separator.remove();
      }
      itemEl.remove();
      this.itemElements.delete(itemId);
    }

    this.items.delete(itemId);
    logger.debug('StatusBar', `Removed item: ${itemId}`);
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.container.innerHTML = '';
    this.items.clear();
    this.itemElements.clear();
    logger.debug('StatusBar', 'StatusBar cleared');
  }

  /**
   * Dispose statusbar
   */
  dispose(): void {
    this.clear();
    logger.info('StatusBar', 'StatusBar disposed');
  }
}
