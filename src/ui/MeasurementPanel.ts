/**
 * Enhanced MeasurementPanel - UI for managing measurements with export, units, and advanced features
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { MeasurementManager } from '@managers/MeasurementManager';
import { Measurement, MeasurementType } from '@tools/BaseMeasurementTool';
import { UnitConverter, UnitSettings, LengthUnit, AreaUnit, VolumeUnit, UnitSystem } from '@utils/UnitConverter';

export class MeasurementPanel {
  private container: HTMLElement;
  private measurementManager: MeasurementManager | null = null;
  private activeTool: MeasurementType | null = null;
  private measurementList: HTMLElement;
  private unitSettingsSection: HTMLElement | null = null;
  private statsSection: HTMLElement | null = null;

  constructor() {
    this.container = this.createContainer();
    this.measurementList = this.createMeasurementList();
    this.setupEventListeners();
    logger.debug('MeasurementPanel', 'Enhanced MeasurementPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel measurement-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      left: 16px;
      width: 320px;
      max-height: calc(100vh - 100px);
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = this.createHeader();

    // Unit Settings
    this.unitSettingsSection = this.createUnitSettings();

    // Toolbar
    const toolbar = this.createToolbar();

    // Stats
    this.statsSection = this.createStatsSection();

    container.appendChild(header);
    container.appendChild(this.unitSettingsSection);
    container.appendChild(toolbar);
    container.appendChild(this.statsSection);

    document.body.appendChild(container);
    return container;
  }

  private createHeader(): HTMLElement {
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

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⬇';
    exportBtn.title = 'Export measurements';
    exportBtn.style.cssText = `
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      width: 28px;
      height: 28px;
    `;
    exportBtn.onclick = () => this.showExportMenu(exportBtn);

    // Close button
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

    actions.appendChild(exportBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);

    return header;
  }

  private createUnitSettings(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'unit-settings';
    section.style.cssText = `
      padding: 12px;
      border-bottom: var(--border);
      background: var(--color-surface-2);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Unit System';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '▼';
    toggleBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      padding: 0;
      font-size: 12px;
    `;

    const content = document.createElement('div');
    content.className = 'unit-settings-content';
    content.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    toggleBtn.onclick = () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'flex' : 'none';
      toggleBtn.textContent = isHidden ? '▼' : '▶';
    };

    // System selector
    const systemRow = document.createElement('div');
    systemRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    const metricBtn = this.createUnitButton('Metric', () => this.setUnitSystem('metric'));
    const imperialBtn = this.createUnitButton('Imperial', () => this.setUnitSystem('imperial'));

    systemRow.appendChild(metricBtn);
    systemRow.appendChild(imperialBtn);

    // Length unit selector
    const lengthRow = this.createUnitRow('Length:', [
      { label: 'mm', value: 'mm' },
      { label: 'cm', value: 'cm' },
      { label: 'm', value: 'm' },
      { label: 'in', value: 'in' },
      { label: 'ft', value: 'ft' },
    ], 'length');

    // Area unit selector
    const areaRow = this.createUnitRow('Area:', [
      { label: 'm²', value: 'm2' },
      { label: 'cm²', value: 'cm2' },
      { label: 'ft²', value: 'ft2' },
    ], 'area');

    // Volume unit selector
    const volumeRow = this.createUnitRow('Volume:', [
      { label: 'm³', value: 'm3' },
      { label: 'cm³', value: 'cm3' },
      { label: 'ft³', value: 'ft3' },
    ], 'volume');

    content.appendChild(systemRow);
    content.appendChild(lengthRow);
    content.appendChild(areaRow);
    content.appendChild(volumeRow);

    header.appendChild(title);
    header.appendChild(toggleBtn);
    section.appendChild(header);
    section.appendChild(content);

    return section;
  }

  private createUnitButton(label: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    btn.onclick = onClick;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--color-surface-3)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'var(--color-surface-1)';
    });

    return btn;
  }

  private createUnitRow(label: string, units: Array<{ label: string; value: string }>, type: 'length' | 'area' | 'volume'): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    `;

    const buttonsRow = document.createElement('div');
    buttonsRow.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    units.forEach(unit => {
      const btn = document.createElement('button');
      btn.textContent = unit.label;
      btn.dataset.unit = unit.value;
      btn.dataset.type = type;
      btn.className = `unit-btn unit-btn-${type}`;
      btn.style.cssText = `
        flex: 1;
        padding: 4px;
        background: var(--color-surface-1);
        border: var(--border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-size-xs);
        cursor: pointer;
      `;

      btn.onclick = () => this.setUnit(type, unit.value);

      buttonsRow.appendChild(btn);
    });

    row.appendChild(labelEl);
    row.appendChild(buttonsRow);

    return row;
  }

  private createStatsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.style.cssText = `
      padding: 12px;
      border-bottom: var(--border);
      background: var(--color-surface-2);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    `;

    section.innerHTML = 'No measurements';

    return section;
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
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    `;

    const tools: Array<{ type: MeasurementType; label: string; icon: string }> = [
      { type: 'distance', label: 'Distance', icon: '📏' },
      { type: 'area', label: 'Area', icon: '⬜' },
      { type: 'angle', label: 'Angle', icon: '📐' },
      { type: 'volume', label: 'Volume', icon: '📦' },
    ];

    tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.className = `measurement-tool-btn measurement-tool-${tool.type}`;
      btn.innerHTML = `<div style="font-size: 20px; margin-bottom: 4px;">${tool.icon}</div><div style="font-size: 11px;">${tool.label}</div>`;
      btn.style.cssText = `
        padding: 12px 8px;
        background: var(--color-surface-2);
        border: var(--border);
        border-radius: var(--radius-md);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
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
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 4px;
    `;

    const completeBtn = this.createActionButton('✓ Complete', 'var(--color-primary)', () => this.completeMeasurement());
    const cancelBtn = this.createActionButton('✕ Cancel', 'var(--color-surface-2)', () => this.cancelMeasurement());
    const clearBtn = this.createActionButton('Clear All', 'var(--color-surface-2)', () => this.clearAll(), 'var(--color-danger)');

    actionContainer.appendChild(completeBtn);
    actionContainer.appendChild(cancelBtn);
    actionContainer.appendChild(clearBtn);

    toolbar.appendChild(actionContainer);

    return toolbar;
  }

  private createActionButton(text: string, bgColor: string, onClick: () => void, textColor?: string): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 6px 4px;
      background: ${bgColor};
      border: ${bgColor === 'var(--color-primary)' ? 'none' : 'var(--border)'};
      border-radius: var(--radius-md);
      color: ${textColor || (bgColor === 'var(--color-primary)' ? 'white' : 'var(--color-text-primary)')};
      font-size: var(--font-size-xs);
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    btn.onclick = onClick;

    return btn;
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
      this.updateStats();
    });

    eventBus.on(Events.MEASUREMENT_REMOVED, (data: { id: string }) => {
      this.removeMeasurementItem(data.id);
      this.updateStats();
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
      this.updateStats();
    }
  }

  private addMeasurementItem(measurement: Measurement): void {
    const item = document.createElement('div');
    item.className = 'measurement-item';
    item.dataset.id = measurement.id;
    item.style.cssText = `
      padding: 10px;
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

    const type = document.createElement('div');
    type.textContent = measurement.type.charAt(0).toUpperCase() + measurement.type.slice(1);
    type.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      font-weight: 600;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = measurement.visible ? '👁' : '👁‍🗨';
    toggleBtn.title = 'Toggle visibility';
    toggleBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    toggleBtn.onclick = () => {
      if (this.measurementManager) {
        this.measurementManager.toggleVisibility(measurement.id);
        measurement.visible = !measurement.visible;
        toggleBtn.textContent = measurement.visible ? '👁' : '👁‍🗨';
      }
    };

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏';
    editBtn.title = 'Edit label';
    editBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: var(--color-text-secondary);
    `;
    editBtn.onclick = () => this.editMeasurementLabel(measurement);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
    deleteBtn.title = 'Delete measurement';
    deleteBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: var(--color-danger);
    `;
    deleteBtn.onclick = () => {
      if (this.measurementManager) {
        this.measurementManager.removeMeasurement(measurement.id);
      }
    };

    actions.appendChild(toggleBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(type);
    header.appendChild(actions);

    const value = document.createElement('div');
    value.className = 'measurement-value';
    value.textContent = measurement.label;
    value.style.cssText = `
      font-size: var(--font-size-md);
      color: var(--color-text-primary);
      font-weight: 600;
      word-break: break-word;
    `;

    const points = document.createElement('div');
    points.textContent = `${measurement.points.length} point${measurement.points.length !== 1 ? 's' : ''}`;
    points.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-top: 4px;
    `;

    item.appendChild(header);
    item.appendChild(value);
    item.appendChild(points);

    this.measurementList.appendChild(item);
  }

  private removeMeasurementItem(id: string): void {
    const item = this.measurementList.querySelector(`[data-id="${id}"]`);
    if (item) {
      this.measurementList.removeChild(item);
    }
  }

  private editMeasurementLabel(measurement: Measurement): void {
    const newLabel = prompt('Enter new label:', measurement.label);
    if (newLabel && newLabel !== measurement.label && this.measurementManager) {
      this.measurementManager.updateMeasurementLabel(measurement.id, newLabel);
      measurement.label = newLabel;

      // Update UI
      const item = this.measurementList.querySelector(`[data-id="${measurement.id}"]`);
      if (item) {
        const valueEl = item.querySelector('.measurement-value');
        if (valueEl) {
          valueEl.textContent = newLabel;
        }
      }
    }
  }

  private updateStats(): void {
    if (!this.measurementManager || !this.statsSection) return;

    const stats = this.measurementManager.getStatistics();
    this.statsSection.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">Statistics</div>
      <div>Total: ${stats.total} measurements</div>
      <div style="font-size: var(--font-size-xs); margin-top: 4px;">
        Distance: ${stats.byType.distance} |
        Area: ${stats.byType.area} |
        Angle: ${stats.byType.angle} |
        Volume: ${stats.byType.volume}
      </div>
    `;
  }

  private setUnitSystem(system: UnitSystem): void {
    if (!this.measurementManager) return;

    const settings: Partial<UnitSettings> = { system };

    if (system === 'metric') {
      settings.length = 'm';
      settings.area = 'm2';
      settings.volume = 'm3';
    } else {
      settings.length = 'ft';
      settings.area = 'ft2';
      settings.volume = 'ft3';
    }

    this.measurementManager.updateUnitSettings(settings);
    logger.info('MeasurementPanel', `Unit system changed to ${system}`);
  }

  private setUnit(type: 'length' | 'area' | 'volume', unit: string): void {
    if (!this.measurementManager) return;

    const settings: Partial<UnitSettings> = {};
    settings[type] = unit as any;

    this.measurementManager.updateUnitSettings(settings);

    // Update button styles
    const buttons = this.container.querySelectorAll(`.unit-btn-${type}`);
    buttons.forEach(btn => {
      const htmlBtn = btn as HTMLElement;
      if (htmlBtn.dataset.unit === unit) {
        htmlBtn.style.background = 'var(--color-primary)';
        htmlBtn.style.color = 'white';
        htmlBtn.style.borderColor = 'var(--color-primary)';
      } else {
        htmlBtn.style.background = 'var(--color-surface-1)';
        htmlBtn.style.color = 'var(--color-text-primary)';
        htmlBtn.style.borderColor = 'var(--color-border)';
      }
    });

    logger.info('MeasurementPanel', `${type} unit changed to ${unit}`);
  }

  private showExportMenu(button: HTMLElement): void {
    if (!this.measurementManager) return;

    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      top: ${button.getBoundingClientRect().bottom + 4}px;
      right: 16px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      padding: 8px;
      z-index: 10000;
      min-width: 150px;
    `;

    const createMenuItem = (text: string, onClick: () => void) => {
      const item = document.createElement('div');
      item.textContent = text;
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-radius: var(--radius-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--color-surface-2)';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });

      item.addEventListener('click', () => {
        onClick();
        document.body.removeChild(menu);
      });

      return item;
    };

    menu.appendChild(createMenuItem('Export as JSON', () => this.exportJSON()));
    menu.appendChild(createMenuItem('Export as CSV', () => this.exportCSV()));
    menu.appendChild(createMenuItem('Import from JSON', () => this.importJSON()));

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== button) {
        document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  private exportJSON(): void {
    if (!this.measurementManager) return;

    const json = this.measurementManager.exportMeasurements();
    this.downloadFile(json, 'measurements.json', 'application/json');
    logger.info('MeasurementPanel', 'Exported measurements as JSON');
  }

  private exportCSV(): void {
    if (!this.measurementManager) return;

    const csv = this.measurementManager.exportMeasurementsCSV();
    this.downloadFile(csv, 'measurements.csv', 'text/csv');
    logger.info('MeasurementPanel', 'Exported measurements as CSV');
  }

  private importJSON(): void {
    if (!this.measurementManager) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          this.measurementManager!.importMeasurements(json);
          this.refreshMeasurementList();
          logger.info('MeasurementPanel', 'Imported measurements from JSON');
        } catch (error) {
          logger.error('MeasurementPanel', 'Failed to import measurements', error);
          alert('Failed to import measurements. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private refreshMeasurementList(): void {
    if (!this.measurementManager) return;

    this.measurementList.innerHTML = '';
    const measurements = this.measurementManager.getAllMeasurements();
    measurements.forEach(m => this.addMeasurementItem(m));
    this.updateStats();
  }

  /**
   * Set the measurement manager
   */
  setMeasurementManager(manager: MeasurementManager): void {
    this.measurementManager = manager;
    this.updateStats();
    logger.debug('MeasurementPanel', 'MeasurementManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.updateStats();
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
