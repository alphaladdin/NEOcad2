/**
 * IFCProjectPanel - Displays IFC project metadata
 */

import { Panel } from './Panel';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { IFCPropertyParser, IFCProjectInfo } from '@utils/IFCPropertyParser';
import * as FRAGS from '@thatopen/fragments';

export class IFCProjectPanel extends Panel {
  private projectInfo: IFCProjectInfo | null = null;
  private spatialStructure: any | null = null;
  private currentModel: FRAGS.FragmentsModel | null = null;

  constructor() {
    super({
      id: 'ifc-project',
      title: 'IFC Project',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`,
      resizable: true,
      minHeight: 150,
      maxHeight: 600,
      defaultCollapsed: false,
    });

    this.setupEventListeners();
    this.showEmptyState();

    logger.info('IFCProjectPanel', 'IFCProjectPanel initialized');
  }

  private setupEventListeners(): void {
    eventBus.on(Events.MODEL_LOADED, async (data: any) => {
      await this.onModelLoaded(data);
    });

    eventBus.on(Events.MODEL_UNLOADED, () => {
      this.clearProjectInfo();
    });
  }

  private async onModelLoaded(data: any): Promise<void> {
    logger.debug('IFCProjectPanel', 'Model loaded, parsing project info:', data);

    if (!data || !data.model) {
      logger.warn('IFCProjectPanel', 'Model data missing');
      return;
    }

    this.currentModel = data.model;

    // Parse project info
    const projectInfo = await IFCPropertyParser.parseProjectInfo(data.model);
    if (projectInfo) {
      this.projectInfo = projectInfo;
    }

    // Parse spatial structure
    const spatialStructure = await IFCPropertyParser.getSpatialStructure(data.model);
    if (spatialStructure) {
      this.spatialStructure = spatialStructure;
    }

    this.render();
  }

  private render(): void {
    const contentEl = this.getContentElement();
    contentEl.innerHTML = '';

    if (!this.projectInfo && !this.spatialStructure) {
      this.showEmptyState();
      return;
    }

    // Project Information Section
    if (this.projectInfo) {
      const projectSection = this.createProjectInfoSection();
      contentEl.appendChild(projectSection);
    }

    // Spatial Structure Section
    if (this.spatialStructure) {
      const spatialSection = this.createSpatialStructureSection();
      contentEl.appendChild(spatialSection);
    }
  }

  private createProjectInfoSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'project-info-section';
    section.style.cssText = `
      padding: 12px;
      border-bottom: 1px solid var(--color-border);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Project Information';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    section.appendChild(title);

    const infoGrid = document.createElement('div');
    infoGrid.className = 'project-info-grid';
    infoGrid.style.cssText = `
      display: grid;
      gap: 8px;
    `;

    if (this.projectInfo?.name) {
      infoGrid.appendChild(this.createInfoRow('Project Name', this.projectInfo.name));
    }

    if (this.projectInfo?.description) {
      infoGrid.appendChild(this.createInfoRow('Description', this.projectInfo.description));
    }

    if (this.projectInfo?.phase) {
      infoGrid.appendChild(this.createInfoRow('Phase', this.projectInfo.phase));
    }

    if (this.projectInfo?.author) {
      infoGrid.appendChild(this.createInfoRow('Author', this.projectInfo.author));
    }

    if (this.projectInfo?.organization) {
      infoGrid.appendChild(this.createInfoRow('Organization', this.projectInfo.organization));
    }

    section.appendChild(infoGrid);
    return section;
  }

  private createSpatialStructureSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'spatial-structure-section';
    section.style.cssText = `
      padding: 12px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Spatial Structure';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    section.appendChild(title);

    const structureList = document.createElement('div');
    structureList.className = 'structure-list';
    structureList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Sites
    if (this.spatialStructure.sites && this.spatialStructure.sites.length > 0) {
      const sitesCount = this.spatialStructure.sites.length;
      structureList.appendChild(
        this.createStructureItem('Sites', sitesCount, '🌍')
      );
    }

    // Buildings
    if (this.spatialStructure.buildings && this.spatialStructure.buildings.length > 0) {
      const buildingsCount = this.spatialStructure.buildings.length;
      structureList.appendChild(
        this.createStructureItem('Buildings', buildingsCount, '🏢')
      );
    }

    // Storeys
    if (this.spatialStructure.storeys && this.spatialStructure.storeys.length > 0) {
      const storeysCount = this.spatialStructure.storeys.length;
      structureList.appendChild(
        this.createStructureItem('Storeys', storeysCount, '📐')
      );
    }

    section.appendChild(structureList);
    return section;
  }

  private createInfoRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.style.cssText = `
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 8px;
      font-size: var(--font-size-sm);
    `;

    const labelEl = document.createElement('div');
    labelEl.className = 'info-label';
    labelEl.textContent = label;
    labelEl.style.cssText = `
      color: var(--color-text-secondary);
      font-weight: 500;
    `;

    const valueEl = document.createElement('div');
    valueEl.className = 'info-value';
    valueEl.textContent = value;
    valueEl.style.cssText = `
      color: var(--color-text-primary);
      word-break: break-word;
    `;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  private createStructureItem(label: string, count: number, icon: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'structure-item';
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
    `;

    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.cssText = `
      font-size: 16px;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = `
      flex: 1;
      color: var(--color-text-primary);
      font-weight: 500;
    `;

    const countEl = document.createElement('span');
    countEl.textContent = count.toString();
    countEl.style.cssText = `
      color: var(--color-text-secondary);
      font-family: var(--font-family-mono);
      background: var(--color-surface-3);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
    `;

    item.appendChild(iconEl);
    item.appendChild(labelEl);
    item.appendChild(countEl);

    return item;
  }

  private showEmptyState(): void {
    const contentEl = this.getContentElement();
    contentEl.innerHTML = `
      <div class="empty-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        text-align: center;
        color: var(--color-text-secondary);
      ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <p style="margin: 0 0 4px 0; font-weight: 500; color: var(--color-text-primary);">No IFC Model Loaded</p>
        <span style="font-size: var(--font-size-sm);">Load an IFC file to view project information</span>
      </div>
    `;
  }

  private clearProjectInfo(): void {
    this.projectInfo = null;
    this.spatialStructure = null;
    this.currentModel = null;
    this.showEmptyState();
    logger.debug('IFCProjectPanel', 'Project info cleared');
  }
}
