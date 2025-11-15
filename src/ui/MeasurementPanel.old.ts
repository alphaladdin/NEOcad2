/**
 * MeasurementPanel - UI for managing measurements
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { MeasurementManager } from '@managers/MeasurementManager';
import { Measurement, MeasurementType } from '@tools/BaseMeasurementTool';

export class MeasurementPanel {
  private container: HTMLElement;
  private measurementManager: MeasurementManager | null = null;
  private activeTool: MeasurementType | null = null;
  private measurementList: HTMLElement;

  constructor() {
    this.container = this.createContainer();
    this.measurementList = this.createMeasurementList();
    this.setupEventListeners();
    logger.debug('MeasurementPanel', 'MeasurementPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel measurement-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      left: 16px;
      width: 280px;
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
    title.textContent = 'Measurements';
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
    label.textContent = 'Measurement Tools';
    label.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    `;
    toolbar.appendChild(label);

    // Tool buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    const tools: Array<{ type: MeasurementType; label: string; icon: string }> = [
      { type: 'distance', label: 'Distance', icon: '📏' },
      { type: 'area', label: 'Area', icon: '⬜' },
      { type: 'angle', label: 'Angle', icon: '📐' },
    ];

    tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.className = `measurement-tool-btn measurement-tool-${tool.type}`;
      btn.textContent = `${tool.icon} ${tool.label}`;
      btn.style.cssText = `
        flex: 1;
        padding: 8px;
        background: var(--color-surface-2);
        border: var(--border);
        border-radius: var(--radius-md);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      btn.addEventListener('mouseenter', () => {
        if (this.activeTool !== tool.type) {
          btn.style.background = 'var(--color-surface-3)';
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (this.activeTool !== tool.type) {
          btn.style.background = 'var(--color-surface-2)';
        }
      });

      btn.addEventListener('click', () => {
        this.toggleTool(tool.type);
      });

      buttonContainer.appendChild(btn);
    });

    toolbar.appendChild(buttonContainer);

    // Action buttons
    const actionContainer = document.createElement('div');
    actionContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 4px;
    `;

    const completeBtn = document.createElement('button');
    completeBtn.textContent = '✓ Complete';
    completeBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    completeBtn.onclick = () => this.completeMeasurement();

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕ Cancel';
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    cancelBtn.onclick = () => this.cancelMeasurement();

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

    actionContainer.appendChild(completeBtn);
    actionContainer.appendChild(cancelBtn);
    actionContainer.appendChild(clearBtn);

    toolbar.appendChild(actionContainer);

    return toolbar;
  }

  private createMeasurementList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'measurement-list';
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;

    this.container.appendChild(list);
    return list;
  }

  private setupEventListeners(): void {
    // Listen for measurement events
    eventBus.on(Events.MEASUREMENT_CREATED, (measurement: Measurement) => {
      this.addMeasurementItem(measurement);
    });

    eventBus.on(Events.MEASUREMENT_REMOVED, (data: { id: string }) => {
      this.removeMeasurementItem(data.id);
    });

    eventBus.on(Events.MEASUREMENT_TOOL_ACTIVATED, () => {
      this.updateToolButtons();
    });

    eventBus.on(Events.MEASUREMENT_TOOL_DEACTIVATED, () => {
      this.updateToolButtons();
    });
  }

  private toggleTool(type: MeasurementType): void {
    if (!this.measurementManager) {
      logger.warn('MeasurementPanel', 'MeasurementManager not set');
      return;
    }

    if (this.activeTool === type) {
      // Deactivate current tool
      this.measurementManager.deactivateTool();
      this.activeTool = null;
    } else {
      // Activate new tool
      this.measurementManager.activateTool(type);
      this.activeTool = type;
    }

    this.updateToolButtons();
  }

  private updateToolButtons(): void {
    const buttons = this.container.querySelectorAll('.measurement-tool-btn');
    buttons.forEach((btn) => {
      const htmlBtn = btn as HTMLElement;
      const isActive = htmlBtn.classList.contains(`measurement-tool-${this.activeTool}`);

      if (isActive) {
        htmlBtn.style.background = 'var(--color-primary)';
        htmlBtn.style.color = 'white';
        htmlBtn.style.borderColor = 'var(--color-primary)';
      } else {
        htmlBtn.style.background = 'var(--color-surface-2)';
        htmlBtn.style.color = 'var(--color-text-primary)';
        htmlBtn.style.borderColor = 'var(--color-border)';
      }
    });
  }

  private completeMeasurement(): void {
    if (!this.measurementManager) return;
    this.measurementManager.completeMeasurement();
  }

  private cancelMeasurement(): void {
    if (!this.measurementManager) return;
    this.measurementManager.cancelMeasurement();
  }

  private clearAll(): void {
    if (!this.measurementManager) return;

    if (confirm('Are you sure you want to clear all measurements?')) {
      this.measurementManager.clearAll();
      this.measurementList.innerHTML = '';
    }
  }

  private addMeasurementItem(measurement: Measurement): void {
    const item = document.createElement('div');
    item.className = 'measurement-item';
    item.dataset.id = measurement.id;
    item.style.cssText = `
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const info = document.createElement('div');
    info.style.cssText = `
      flex: 1;
    `;

    const type = document.createElement('div');
    type.textContent = measurement.type.charAt(0).toUpperCase() + measurement.type.slice(1);
    type.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      margin-bottom: 2px;
    `;

    const value = document.createElement('div');
    value.textContent = measurement.label;
    value.style.cssText = `
      font-size: var(--font-size-md);
      color: var(--color-text-primary);
      font-weight: 600;
    `;

    info.appendChild(type);
    info.appendChild(value);

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = measurement.visible ? '👁️' : '🚫';
    toggleBtn.title = 'Toggle visibility';
    toggleBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
    `;
    toggleBtn.onclick = () => {
      if (this.measurementManager) {
        this.measurementManager.toggleVisibility(measurement.id);
        measurement.visible = !measurement.visible;
        toggleBtn.textContent = measurement.visible ? '👁️' : '🚫';
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete measurement';
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--color-danger);
    `;
    deleteBtn.onclick = () => {
      if (this.measurementManager) {
        this.measurementManager.removeMeasurement(measurement.id);
      }
    };

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);

    this.measurementList.appendChild(item);
  }

  private removeMeasurementItem(id: string): void {
    const item = this.measurementList.querySelector(`[data-id="${id}"]`);
    if (item) {
      this.measurementList.removeChild(item);
    }
  }

  /**
   * Set the measurement manager
   */
  setMeasurementManager(manager: MeasurementManager): void {
    this.measurementManager = manager;
    logger.debug('MeasurementPanel', 'MeasurementManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    logger.debug('MeasurementPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';

    // Deactivate tool when hiding panel
    if (this.measurementManager && this.activeTool) {
      this.measurementManager.deactivateTool();
      this.activeTool = null;
      this.updateToolButtons();
    }

    logger.debug('MeasurementPanel', 'Panel hidden');
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
    logger.debug('MeasurementPanel', 'Panel disposed');
  }
}
