/**
 * WallTypePanel - UI for selecting and managing wall types
 */

import { Panel } from './Panel';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { WallTypeManager } from '@framing/WallTypeManager';
import type { WallType } from '@framing/WallType';
import type { WallCreationTool } from '@tools/WallCreationTool';

export class WallTypePanel extends Panel {
  private wallTypeManager: WallTypeManager;
  private wallCreationTool: WallCreationTool | null = null;
  private activeWallTypeId: string | null = null;
  private searchQuery: string = '';
  private filters: {
    exterior: boolean | null;
    interior: boolean | null;
    loadBearing: boolean | null;
    studSize: string | null;
  } = {
    exterior: null,
    interior: null,
    loadBearing: null,
    studSize: null,
  };

  constructor() {
    super({
      id: 'wall-types',
      title: 'Wall Types',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="9" x2="9" y2="21"/>
        <line x1="15" y1="9" x2="15" y2="21"/>
      </svg>`,
      resizable: true,
      minHeight: 300,
      maxHeight: 800,
    });

    this.wallTypeManager = WallTypeManager.getInstance();
    this.activeWallTypeId = this.wallTypeManager.getDefaultWallType().id;

    this.setupEventListeners();
    this.render();

    logger.info('WallTypePanel', 'WallTypePanel initialized');
  }

  private setupEventListeners(): void {
    // Listen for wall type manager events
    eventBus.on(Events.WALL_TYPE_ADDED, () => {
      this.render();
    });

    eventBus.on(Events.WALL_TYPE_REMOVED, () => {
      this.render();
    });

    eventBus.on(Events.DEFAULT_WALL_TYPE_CHANGED, (data: { wallTypeId: string }) => {
      this.activeWallTypeId = data.wallTypeId;
      this.render();
    });
  }

  /**
   * Set the wall creation tool reference
   */
  setWallCreationTool(tool: WallCreationTool): void {
    this.wallCreationTool = tool;
    const currentWallType = tool.getWallType();
    if (currentWallType) {
      this.activeWallTypeId = currentWallType.id;
      this.render();
    }
    logger.debug('WallTypePanel', 'WallCreationTool reference set');
  }

  /**
   * Render the panel content
   */
  private render(): void {
    const contentEl = this.getContentElement();
    contentEl.innerHTML = '';
    contentEl.style.cssText = `
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    `;

    // Search and filter section
    const searchSection = this.createSearchSection();
    contentEl.appendChild(searchSection);

    // Filter section
    const filterSection = this.createFilterSection();
    contentEl.appendChild(filterSection);

    // Wall type list
    const listContainer = this.createWallTypeList();
    contentEl.appendChild(listContainer);

    // Action buttons
    const actionsSection = this.createActionsSection();
    contentEl.appendChild(actionsSection);
  }

  /**
   * Create search section
   */
  private createSearchSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      padding: var(--space-3);
      border-bottom: var(--border);
      background: var(--color-surface-2);
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search wall types...';
    searchInput.value = this.searchQuery;
    searchInput.style.cssText = `
      width: 100%;
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      background: var(--color-surface-1);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
    });

    searchInput.addEventListener('focus', () => {
      searchInput.style.borderColor = 'var(--color-primary)';
      searchInput.style.background = 'var(--color-surface-2)';
    });

    searchInput.addEventListener('blur', () => {
      searchInput.style.borderColor = 'var(--color-border-default)';
      searchInput.style.background = 'var(--color-surface-1)';
    });

    section.appendChild(searchInput);
    return section;
  }

  /**
   * Create filter section
   */
  private createFilterSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      padding: var(--space-3);
      border-bottom: var(--border);
      background: var(--color-surface-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    `;

    const title = document.createElement('div');
    title.textContent = 'Filters';
    title.style.cssText = `
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-1);
    `;

    // Wall location filters
    const locationRow = document.createElement('div');
    locationRow.style.cssText = `
      display: flex;
      gap: var(--space-2);
    `;

    const exteriorBtn = this.createFilterButton(
      'Exterior',
      this.filters.exterior === true,
      () => {
        this.filters.exterior = this.filters.exterior === true ? null : true;
        this.filters.interior = null;
        this.render();
      }
    );

    const interiorBtn = this.createFilterButton(
      'Interior',
      this.filters.interior === true,
      () => {
        this.filters.interior = this.filters.interior === true ? null : true;
        this.filters.exterior = null;
        this.render();
      }
    );

    locationRow.appendChild(exteriorBtn);
    locationRow.appendChild(interiorBtn);

    // Structural filters
    const structuralRow = document.createElement('div');
    structuralRow.style.cssText = `
      display: flex;
      gap: var(--space-2);
    `;

    const loadBearingBtn = this.createFilterButton(
      'Load Bearing',
      this.filters.loadBearing === true,
      () => {
        this.filters.loadBearing = this.filters.loadBearing === true ? null : true;
        this.render();
      }
    );

    structuralRow.appendChild(loadBearingBtn);

    // Stud size filters
    const studSizeRow = document.createElement('div');
    studSizeRow.style.cssText = `
      display: flex;
      gap: var(--space-2);
    `;

    const studSizes = ['2x4', '2x6'];
    studSizes.forEach((size) => {
      const btn = this.createFilterButton(
        size,
        this.filters.studSize === size,
        () => {
          this.filters.studSize = this.filters.studSize === size ? null : size;
          this.render();
        }
      );
      studSizeRow.appendChild(btn);
    });

    // Clear filters button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Filters';
    clearBtn.style.cssText = `
      padding: var(--space-1) var(--space-2);
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    clearBtn.addEventListener('click', () => {
      this.filters = {
        exterior: null,
        interior: null,
        loadBearing: null,
        studSize: null,
      };
      this.render();
    });

    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.background = 'var(--color-surface-3)';
      clearBtn.style.color = 'var(--color-text-primary)';
    });

    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.background = 'transparent';
      clearBtn.style.color = 'var(--color-text-secondary)';
    });

    section.appendChild(title);
    section.appendChild(locationRow);
    section.appendChild(structuralRow);
    section.appendChild(studSizeRow);
    section.appendChild(clearBtn);

    return section;
  }

  /**
   * Create a filter button
   */
  private createFilterButton(label: string, isActive: boolean, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      flex: 1;
      padding: var(--space-2);
      font-size: var(--font-size-xs);
      color: ${isActive ? 'white' : 'var(--color-text-primary)'};
      background: ${isActive ? 'var(--color-primary)' : 'var(--color-surface-1)'};
      border: 1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-default)'};
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    btn.addEventListener('click', onClick);

    if (!isActive) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-surface-3)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--color-surface-1)';
      });
    }

    return btn;
  }

  /**
   * Create wall type list
   */
  private createWallTypeList(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: var(--space-2);
      background: var(--color-surface-1);
    `;

    const wallTypes = this.getFilteredWallTypes();

    if (wallTypes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.textContent = 'No wall types match your filters';
      emptyState.style.cssText = `
        padding: var(--space-8);
        text-align: center;
        color: var(--color-text-tertiary);
        font-size: var(--font-size-sm);
      `;
      container.appendChild(emptyState);
      return container;
    }

    wallTypes.forEach((wallType) => {
      const item = this.createWallTypeItem(wallType);
      container.appendChild(item);
    });

    return container;
  }

  /**
   * Get filtered wall types
   */
  private getFilteredWallTypes(): WallType[] {
    let wallTypes = this.wallTypeManager.getAllWallTypes();

    // Apply search filter
    if (this.searchQuery) {
      wallTypes = this.wallTypeManager.searchWallTypes(this.searchQuery);
    }

    // Apply category filters
    wallTypes = wallTypes.filter((wallType) => {
      if (this.filters.exterior !== null && wallType.isExterior !== this.filters.exterior) {
        return false;
      }
      if (this.filters.interior !== null && wallType.isExterior === this.filters.interior) {
        return false;
      }
      if (this.filters.loadBearing !== null && wallType.isLoadBearing !== this.filters.loadBearing) {
        return false;
      }
      if (this.filters.studSize !== null && wallType.stud.nominalSize !== this.filters.studSize) {
        return false;
      }
      return true;
    });

    return wallTypes;
  }

  /**
   * Create wall type item
   */
  private createWallTypeItem(wallType: WallType): HTMLElement {
    const isActive = this.activeWallTypeId === wallType.id;
    const isDefault = this.wallTypeManager.getDefaultWallType().id === wallType.id;

    const item = document.createElement('div');
    item.style.cssText = `
      padding: var(--space-3);
      margin-bottom: var(--space-2);
      background: ${isActive ? 'var(--color-selected)' : 'var(--color-surface-2)'};
      border: 1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-default)'};
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    // Header with color swatch and name
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    `;

    const colorSwatch = document.createElement('div');
    colorSwatch.style.cssText = `
      width: 24px;
      height: 24px;
      background: #${wallType.color.getHexString()};
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    `;

    const nameContainer = document.createElement('div');
    nameContainer.style.cssText = 'flex: 1; min-width: 0;';

    const name = document.createElement('div');
    name.textContent = wallType.name;
    name.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const badges = document.createElement('div');
    badges.style.cssText = `
      display: flex;
      gap: var(--space-1);
      margin-top: var(--space-1);
    `;

    if (isDefault) {
      const defaultBadge = this.createBadge('Default', 'var(--color-primary)');
      badges.appendChild(defaultBadge);
    }

    if (wallType.isLoadBearing) {
      const loadBearingBadge = this.createBadge('Load Bearing', 'var(--color-warning)');
      badges.appendChild(loadBearingBadge);
    }

    if (wallType.isExterior) {
      const exteriorBadge = this.createBadge('Exterior', 'var(--color-info)');
      badges.appendChild(exteriorBadge);
    }

    nameContainer.appendChild(name);
    if (badges.children.length > 0) {
      nameContainer.appendChild(badges);
    }

    header.appendChild(colorSwatch);
    header.appendChild(nameContainer);

    // Description
    const description = document.createElement('div');
    description.textContent = wallType.description;
    description.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
      line-height: var(--line-height-normal);
    `;

    // Specifications grid
    const specs = document.createElement('div');
    specs.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
      font-size: var(--font-size-xs);
    `;

    const createSpec = (label: string, value: string) => {
      const spec = document.createElement('div');
      spec.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      `;

      const specLabel = document.createElement('div');
      specLabel.textContent = label;
      specLabel.style.cssText = `
        color: var(--color-text-tertiary);
      `;

      const specValue = document.createElement('div');
      specValue.textContent = value;
      specValue.style.cssText = `
        color: var(--color-text-primary);
        font-family: var(--font-family-mono);
        font-weight: var(--font-weight-medium);
      `;

      spec.appendChild(specLabel);
      spec.appendChild(specValue);
      return spec;
    };

    specs.appendChild(createSpec('Thickness', `${wallType.actualThickness}"`));
    specs.appendChild(createSpec('Height', `${wallType.defaultHeight}'`));
    specs.appendChild(createSpec('Stud Size', wallType.stud.nominalSize));
    specs.appendChild(createSpec('Spacing', `${wallType.stud.spacing}" OC`));
    specs.appendChild(createSpec('Layers', `${wallType.layers.length}`));
    specs.appendChild(createSpec('Cost/LF', `$${wallType.costPerLinearFoot.toFixed(2)}`));

    item.appendChild(header);
    item.appendChild(description);
    item.appendChild(specs);

    // Event handlers
    item.addEventListener('click', () => {
      this.setActiveWallType(wallType.id);
    });

    item.addEventListener('dblclick', () => {
      this.setDefaultWallType(wallType.id);
    });

    item.addEventListener('mouseenter', () => {
      if (!isActive) {
        item.style.background = 'var(--color-surface-3)';
      }
    });

    item.addEventListener('mouseleave', () => {
      if (!isActive) {
        item.style.background = 'var(--color-surface-2)';
      }
    });

    return item;
  }

  /**
   * Create a badge
   */
  private createBadge(text: string, color: string): HTMLElement {
    const badge = document.createElement('span');
    badge.textContent = text;
    badge.style.cssText = `
      display: inline-block;
      padding: 2px var(--space-2);
      font-size: 10px;
      font-weight: var(--font-weight-medium);
      color: white;
      background: ${color};
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    return badge;
  }

  /**
   * Create actions section
   */
  private createActionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      padding: var(--space-3);
      border-top: var(--border);
      background: var(--color-surface-2);
      display: flex;
      gap: var(--space-2);
    `;

    const setActiveBtn = document.createElement('button');
    setActiveBtn.textContent = 'Set Active';
    setActiveBtn.title = 'Set selected wall type for drawing';
    setActiveBtn.style.cssText = `
      flex: 1;
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: white;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    setActiveBtn.addEventListener('click', () => {
      if (this.activeWallTypeId) {
        this.setActiveWallType(this.activeWallTypeId);
      }
    });

    setActiveBtn.addEventListener('mouseenter', () => {
      setActiveBtn.style.background = 'var(--color-primary-hover)';
    });

    setActiveBtn.addEventListener('mouseleave', () => {
      setActiveBtn.style.background = 'var(--color-primary)';
    });

    const setDefaultBtn = document.createElement('button');
    setDefaultBtn.textContent = 'Set Default';
    setDefaultBtn.title = 'Set as default wall type';
    setDefaultBtn.style.cssText = `
      flex: 1;
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      background: var(--color-surface-3);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    setDefaultBtn.addEventListener('click', () => {
      if (this.activeWallTypeId) {
        this.setDefaultWallType(this.activeWallTypeId);
      }
    });

    setDefaultBtn.addEventListener('mouseenter', () => {
      setDefaultBtn.style.background = 'var(--color-surface-4)';
    });

    setDefaultBtn.addEventListener('mouseleave', () => {
      setDefaultBtn.style.background = 'var(--color-surface-3)';
    });

    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = 'Details';
    detailsBtn.title = 'Show full wall type details';
    detailsBtn.style.cssText = `
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      background: var(--color-surface-3);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    detailsBtn.addEventListener('click', () => {
      if (this.activeWallTypeId) {
        this.showDetails(this.activeWallTypeId);
      }
    });

    detailsBtn.addEventListener('mouseenter', () => {
      detailsBtn.style.background = 'var(--color-surface-4)';
    });

    detailsBtn.addEventListener('mouseleave', () => {
      detailsBtn.style.background = 'var(--color-surface-3)';
    });

    const visualizeBtn = document.createElement('button');
    visualizeBtn.textContent = '3D Layers';
    visualizeBtn.title = 'Visualize wall layers in 3D';
    visualizeBtn.style.cssText = `
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: white;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--duration-fast) var(--easing-standard);
    `;

    visualizeBtn.addEventListener('click', () => {
      if (this.activeWallTypeId) {
        this.visualizeLayers(this.activeWallTypeId);
      }
    });

    visualizeBtn.addEventListener('mouseenter', () => {
      visualizeBtn.style.opacity = '0.9';
      visualizeBtn.style.transform = 'translateY(-1px)';
    });

    visualizeBtn.addEventListener('mouseleave', () => {
      visualizeBtn.style.opacity = '1';
      visualizeBtn.style.transform = 'translateY(0)';
    });

    section.appendChild(setActiveBtn);
    section.appendChild(setDefaultBtn);
    section.appendChild(detailsBtn);
    section.appendChild(visualizeBtn);

    return section;
  }

  /**
   * Set active wall type
   */
  private setActiveWallType(wallTypeId: string): void {
    this.activeWallTypeId = wallTypeId;

    if (this.wallCreationTool) {
      this.wallCreationTool.setWallType(wallTypeId);
      logger.info('WallTypePanel', `Active wall type set to: ${wallTypeId}`);
    }

    this.render();
  }

  /**
   * Set default wall type
   */
  private setDefaultWallType(wallTypeId: string): void {
    try {
      this.wallTypeManager.setDefaultWallType(wallTypeId);
      this.activeWallTypeId = wallTypeId;

      if (this.wallCreationTool) {
        this.wallCreationTool.setWallType(wallTypeId);
      }

      this.render();
      logger.info('WallTypePanel', `Default wall type set to: ${wallTypeId}`);
    } catch (error) {
      logger.error('WallTypePanel', 'Failed to set default wall type', error);
    }
  }

  /**
   * Show detailed information about a wall type
   */
  private showDetails(wallTypeId: string): void {
    const wallType = this.wallTypeManager.getWallType(wallTypeId);
    if (!wallType) {
      logger.warn('WallTypePanel', `Wall type not found: ${wallTypeId}`);
      return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      backdrop-filter: blur(4px);
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: var(--space-4);
      border-bottom: var(--border);
      background: var(--color-surface-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const title = document.createElement('h2');
    title.textContent = wallType.name;
    title.style.cssText = `
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary);
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color var(--duration-fast) var(--easing-standard);
    `;

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = 'var(--color-text-primary)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = 'var(--color-text-secondary)';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Modal content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: var(--space-4);
      overflow-y: auto;
      flex: 1;
    `;

    content.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-1);">Description</div>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-primary);">${wallType.description}</div>
      </div>

      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); font-weight: var(--font-weight-semibold); text-transform: uppercase;">Dimensions</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); font-size: var(--font-size-sm);">
          <div><span style="color: var(--color-text-tertiary);">Nominal Thickness:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.nominalThickness}"</span></div>
          <div><span style="color: var(--color-text-tertiary);">Actual Thickness:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.actualThickness}"</span></div>
          <div><span style="color: var(--color-text-tertiary);">Default Height:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.defaultHeight}'</span></div>
        </div>
      </div>

      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); font-weight: var(--font-weight-semibold); text-transform: uppercase;">Framing</div>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-2); font-size: var(--font-size-sm);">
          <div><span style="color: var(--color-text-tertiary);">Stud Size:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.stud.nominalSize} (${wallType.stud.actualWidth}" × ${wallType.stud.actualDepth}")</span></div>
          <div><span style="color: var(--color-text-tertiary);">Stud Spacing:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.stud.spacing}" OC</span></div>
          <div><span style="color: var(--color-text-tertiary);">Stud Material:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.stud.material}</span></div>
          <div><span style="color: var(--color-text-tertiary);">Top Plate:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.topPlate.nominalSize} × ${wallType.topPlate.count}</span></div>
          <div><span style="color: var(--color-text-tertiary);">Bottom Plate:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.bottomPlate.nominalSize} × ${wallType.bottomPlate.count}</span></div>
        </div>
      </div>

      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); font-weight: var(--font-weight-semibold); text-transform: uppercase;">Layers (${wallType.layers.length})</div>
        ${wallType.layers.map((layer, index) => `
          <div style="padding: var(--space-2); background: var(--color-surface-2); border-radius: var(--radius-sm); margin-bottom: var(--space-2);">
            <div style="font-size: var(--font-size-sm); color: var(--color-text-primary); font-weight: var(--font-weight-medium); margin-bottom: var(--space-1);">${index + 1}. ${layer.name}</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
              <div>Material: ${layer.material}</div>
              <div>Thickness: ${layer.thickness}"</div>
              ${layer.rValue ? `<div>R-Value: ${layer.rValue}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); font-weight: var(--font-weight-semibold); text-transform: uppercase;">Properties</div>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-2); font-size: var(--font-size-sm);">
          <div><span style="color: var(--color-text-tertiary);">Load Bearing:</span> <span style="color: ${wallType.isLoadBearing ? 'var(--color-success)' : 'var(--color-text-secondary)'}; font-weight: var(--font-weight-medium);">${wallType.isLoadBearing ? 'Yes' : 'No'}</span></div>
          <div><span style="color: var(--color-text-tertiary);">Exterior:</span> <span style="color: ${wallType.isExterior ? 'var(--color-info)' : 'var(--color-text-secondary)'}; font-weight: var(--font-weight-medium);">${wallType.isExterior ? 'Yes' : 'No'}</span></div>
          ${wallType.fireRating ? `<div><span style="color: var(--color-text-tertiary);">Fire Rating:</span> <span style="color: var(--color-warning); font-weight: var(--font-weight-medium);">${wallType.fireRating} hour${wallType.fireRating > 1 ? 's' : ''}</span></div>` : ''}
          <div><span style="color: var(--color-text-tertiary);">Total R-Value:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.getTotalRValue().toFixed(2)}</span></div>
        </div>
      </div>

      <div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); font-weight: var(--font-weight-semibold); text-transform: uppercase;">Costing</div>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-2); font-size: var(--font-size-sm);">
          <div><span style="color: var(--color-text-tertiary);">Material Cost:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">$${wallType.costPerLinearFoot.toFixed(2)}/LF</span></div>
          <div><span style="color: var(--color-text-tertiary);">Labor Hours:</span> <span style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${wallType.laborHoursPerLinearFoot.toFixed(2)} hrs/LF</span></div>
        </div>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Close on escape key
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', closeOnEscape);
      }
    };
    document.addEventListener('keydown', closeOnEscape);

    document.body.appendChild(overlay);
  }

  /**
   * Visualize wall layers in 3D
   */
  private visualizeLayers(wallTypeId: string): void {
    const wallType = this.wallTypeManager.getWallType(wallTypeId);
    if (!wallType) {
      logger.warn('WallTypePanel', `Wall type not found: ${wallTypeId}`);
      return;
    }

    // Open the layer visualization page in a new tab
    const url = `/test-wall-layers-visual.html?wallType=${encodeURIComponent(wallTypeId)}`;
    window.open(url, '_blank', 'width=1200,height=800');

    logger.info('WallTypePanel', `Opened 3D layer visualization for: ${wallType.name}`);
  }

  /**
   * Dispose the panel
   */
  dispose(): void {
    super.dispose();
    this.wallCreationTool = null;
    logger.info('WallTypePanel', 'WallTypePanel disposed');
  }
}
