/**
 * CameraPresetsPanel - UI for managing camera presets
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { CameraPresetManager } from '@managers/CameraPresetManager';
import { CameraPreset } from '@tools/CameraPreset';

export class CameraPresetsPanel {
  private container: HTMLElement;
  private presetManager: CameraPresetManager | null = null;
  private standardViewsList: HTMLElement;
  private customPresetsList: HTMLElement;

  constructor() {
    this.standardViewsList = document.createElement('div');
    this.customPresetsList = document.createElement('div');
    this.container = this.createContainer();
    this.setupEventListeners();
    logger.debug('CameraPresetsPanel', 'CameraPresetsPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel camera-presets-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      left: 320px;
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
    title.textContent = 'Camera Views';
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

    // Content
    const content = this.createContent();

    container.appendChild(header);
    container.appendChild(content);

    document.body.appendChild(container);
    return container;
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Standard Views Section
    const standardSection = document.createElement('div');

    const standardHeader = document.createElement('div');
    standardHeader.textContent = 'Standard Views';
    standardHeader.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    this.standardViewsList.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    `;

    standardSection.appendChild(standardHeader);
    standardSection.appendChild(this.standardViewsList);

    // Custom Presets Section
    const customSection = document.createElement('div');

    const customHeader = document.createElement('div');
    customHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const customTitle = document.createElement('div');
    customTitle.textContent = 'Saved Views';
    customTitle.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '+ Save Current';
    saveBtn.style.cssText = `
      padding: 4px 8px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-sm);
      color: white;
      font-size: var(--font-size-xs);
      cursor: pointer;
    `;
    saveBtn.onclick = () => this.saveCurrentView();

    customHeader.appendChild(customTitle);
    customHeader.appendChild(saveBtn);

    this.customPresetsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    customSection.appendChild(customHeader);
    customSection.appendChild(this.customPresetsList);

    content.appendChild(standardSection);
    content.appendChild(customSection);

    return content;
  }

  private setupEventListeners(): void {
    eventBus.on(Events.CAMERA_PRESET_CREATED, () => {
      this.refreshPresets();
    });

    eventBus.on(Events.CAMERA_PRESET_REMOVED, () => {
      this.refreshPresets();
    });

    eventBus.on(Events.CAMERA_PRESET_UPDATED, () => {
      this.refreshPresets();
    });
  }

  private saveCurrentView(): void {
    if (!this.presetManager) return;

    const name = prompt('Enter a name for this view:');
    if (!name) return;

    this.presetManager.saveCurrentView(name);
  }

  private refreshPresets(): void {
    if (!this.presetManager) return;

    // Refresh standard views
    this.standardViewsList.innerHTML = '';
    const standardPresets = this.presetManager.getStandardPresets();
    standardPresets.forEach((preset) => {
      this.addStandardViewButton(preset);
    });

    // Refresh custom presets
    this.customPresetsList.innerHTML = '';
    const customPresets = this.presetManager.getCustomPresets();
    customPresets.forEach((preset) => {
      this.addCustomPresetItem(preset);
    });
  }

  private addStandardViewButton(preset: CameraPreset): void {
    const btn = document.createElement('button');
    btn.textContent = preset.name.replace(' View', '');
    btn.style.cssText = `
      padding: 12px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--color-surface-3)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'var(--color-surface-2)';
    });

    btn.addEventListener('click', () => {
      if (this.presetManager) {
        this.presetManager.applyPreset(preset.id);
      }
    });

    this.standardViewsList.appendChild(btn);
  }

  private addCustomPresetItem(preset: CameraPreset): void {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
    `;

    const nameBtn = document.createElement('button');
    nameBtn.textContent = preset.name;
    nameBtn.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      background: transparent;
      border: none;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      text-align: left;
      cursor: pointer;
    `;
    nameBtn.onclick = () => {
      if (this.presetManager) {
        this.presetManager.applyPreset(preset.id);
      }
    };

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const updateBtn = document.createElement('button');
    updateBtn.textContent = '↻';
    updateBtn.title = 'Update with current view';
    updateBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    updateBtn.onclick = () => {
      if (this.presetManager) {
        this.presetManager.updatePreset(preset.id);
      }
    };

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✎';
    renameBtn.title = 'Rename';
    renameBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    renameBtn.onclick = () => {
      const newName = prompt('Enter new name:', preset.name);
      if (newName && this.presetManager) {
        this.presetManager.renamePreset(preset.id, newName);
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: var(--color-danger);
    `;
    deleteBtn.onclick = () => {
      if (confirm(`Delete preset "${preset.name}"?`) && this.presetManager) {
        this.presetManager.removePreset(preset.id);
      }
    };

    actions.appendChild(updateBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(nameBtn);
    item.appendChild(actions);

    this.customPresetsList.appendChild(item);
  }

  /**
   * Set the preset manager
   */
  setPresetManager(manager: CameraPresetManager): void {
    this.presetManager = manager;
    this.refreshPresets();
    logger.debug('CameraPresetsPanel', 'PresetManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.refreshPresets();
    logger.debug('CameraPresetsPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('CameraPresetsPanel', 'Panel hidden');
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
    logger.debug('CameraPresetsPanel', 'Panel disposed');
  }
}
