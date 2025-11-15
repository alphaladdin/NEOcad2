/**
 * ClippingPanel - UI for managing clipping planes
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ClippingManager } from '@managers/ClippingManager';
import { ClippingPlane, PlaneOrientation } from '@tools/ClippingPlane';

export class ClippingPanel {
  private container: HTMLElement;
  private clippingManager: ClippingManager | null = null;
  private planeList: HTMLElement;
  private statsElement: HTMLElement;

  constructor() {
    this.container = this.createContainer();
    this.statsElement = this.createStatsBar();
    this.planeList = this.createPlaneList();
    this.setupEventListeners();
    logger.debug('ClippingPanel', 'ClippingPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel clipping-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      right: 16px;
      width: 300px;
      max-height: calc(100vh - 200px);
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Section Planes';
    title.style.cssText = `
      margin: 0;
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Toolbar
    const toolbar = this.createToolbar();

    container.appendChild(header);
    container.appendChild(toolbar);

    document.body.appendChild(container);
    return container;
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-bottom: var(--border);
    `;

    const label = document.createElement('div');
    label.textContent = 'Create Plane';
    label.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    `;
    toolbar.appendChild(label);

    // Quick create buttons
    const quickCreate = document.createElement('div');
    quickCreate.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    `;

    const orientations: Array<{ orientation: PlaneOrientation; label: string }> = [
      { orientation: 'x', label: 'X Axis' },
      { orientation: 'y', label: 'Y Axis' },
      { orientation: 'z', label: 'Z Axis' },
    ];

    orientations.forEach((item) => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.style.cssText = `
        padding: 8px;
        background: var(--color-surface-2);
        border: var(--border);
        border-radius: var(--radius-md);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        cursor: pointer;
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-surface-3)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--color-surface-2)';
      });

      btn.addEventListener('click', () => {
        this.createPlane(item.orientation);
      });

      quickCreate.appendChild(btn);
    });

    toolbar.appendChild(quickCreate);

    // Action buttons
    const actionContainer = document.createElement('div');
    actionContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 4px;
    `;

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'From View';
    viewBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    viewBtn.onclick = () => this.createPlaneFromView();

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All';
    clearBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    clearBtn.onclick = () => this.clearAll();

    actionContainer.appendChild(viewBtn);
    actionContainer.appendChild(clearBtn);

    toolbar.appendChild(actionContainer);

    return toolbar;
  }

  private createStatsBar(): HTMLElement {
    const stats = document.createElement('div');
    stats.style.cssText = `
      padding: 8px 12px;
      background: var(--color-surface-2);
      border-bottom: var(--border);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    `;
    stats.textContent = 'Planes: 0 / 6 | Active: 0';

    this.container.appendChild(stats);
    return stats;
  }

  private createPlaneList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'clipping-plane-list';
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;

    this.container.appendChild(list);
    return list;
  }

  private setupEventListeners(): void {
    // Listen for clipping events
    eventBus.on(Events.CLIPPING_PLANE_CREATED, (data: { plane: ClippingPlane }) => {
      this.addPlaneItem(data.plane);
      this.updateStats();
    });

    eventBus.on(Events.CLIPPING_PLANE_REMOVED, (data: { id: string }) => {
      this.removePlaneItem(data.id);
      this.updateStats();
    });

    eventBus.on(Events.CLIPPING_PLANE_TOGGLED, () => {
      this.updateStats();
    });

    eventBus.on(Events.CLIPPING_CLEARED, () => {
      this.planeList.innerHTML = '';
      this.updateStats();
    });
  }

  private createPlane(orientation: PlaneOrientation): void {
    if (!this.clippingManager) {
      logger.warn('ClippingPanel', 'ClippingManager not set');
      return;
    }

    try {
      this.clippingManager.createOrientedPlane(orientation);
    } catch (error) {
      logger.error('ClippingPanel', 'Failed to create plane', error);
      alert('Maximum number of clipping planes reached');
    }
  }

  private createPlaneFromView(): void {
    if (!this.clippingManager) {
      logger.warn('ClippingPanel', 'ClippingManager not set');
      return;
    }

    // Get camera from viewport (we'll need to pass this in)
    logger.warn('ClippingPanel', 'Create from view not yet implemented');
  }

  private clearAll(): void {
    if (!this.clippingManager) return;

    if (confirm('Are you sure you want to remove all clipping planes?')) {
      this.clippingManager.clearAll();
    }
  }

  private addPlaneItem(plane: ClippingPlane): void {
    const item = document.createElement('div');
    item.className = 'clipping-plane-item';
    item.dataset.id = plane.id;
    item.style.cssText = `
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = `${plane.orientation.toUpperCase()} Plane`;
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = plane.enabled ? '👁️' : '🚫';
    toggleBtn.title = 'Toggle visibility';
    toggleBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
    `;
    toggleBtn.onclick = () => {
      if (this.clippingManager) {
        this.clippingManager.togglePlane(plane.id);
        toggleBtn.textContent = plane.enabled ? '🚫' : '👁️';
      }
    };

    const flipBtn = document.createElement('button');
    flipBtn.textContent = '🔄';
    flipBtn.title = 'Flip direction';
    flipBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
    `;
    flipBtn.onclick = () => {
      plane.flip();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete plane';
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--color-danger);
    `;
    deleteBtn.onclick = () => {
      if (this.clippingManager) {
        this.clippingManager.removePlane(plane.id);
      }
    };

    actions.appendChild(toggleBtn);
    actions.appendChild(flipBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(title);
    header.appendChild(actions);

    // Position slider
    const sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = 'Position';
    sliderLabel.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    `;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-20';
    slider.max = '20';
    slider.step = '0.1';
    slider.value = '0';
    slider.style.cssText = `
      width: 100%;
    `;

    slider.addEventListener('input', () => {
      const distance = parseFloat(slider.value);
      plane.translate(distance - plane.plane.constant);
    });

    sliderContainer.appendChild(sliderLabel);
    sliderContainer.appendChild(slider);

    item.appendChild(header);
    item.appendChild(sliderContainer);

    this.planeList.appendChild(item);
  }

  private removePlaneItem(id: string): void {
    const item = this.planeList.querySelector(`[data-id="${id}"]`);
    if (item) {
      this.planeList.removeChild(item);
    }
  }

  private updateStats(): void {
    if (!this.clippingManager) return;

    const stats = this.clippingManager.getStats();
    this.statsElement.textContent = `Planes: ${stats.total} / ${stats.max} | Active: ${stats.enabled}`;
  }

  /**
   * Set the clipping manager
   */
  setClippingManager(manager: ClippingManager): void {
    this.clippingManager = manager;
    this.updateStats();
    logger.debug('ClippingPanel', 'ClippingManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.updateStats();
    logger.debug('ClippingPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('ClippingPanel', 'Panel hidden');
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  /**
   * Dispose the panel
   */
  dispose(): void {
    this.hide();
    document.body.removeChild(this.container);
    logger.debug('ClippingPanel', 'Panel disposed');
  }
}
