/**
 * FilterPanel - UI for creating and managing filter rules
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { FilterManager } from '@managers/FilterManager';
import { FilterRule, FilterCondition, FilterOperator, FilterLogic } from '@tools/FilterRule';
import * as THREE from 'three';

export class FilterPanel {
  private container: HTMLElement;
  private filterManager: FilterManager | null = null;
  private filtersList: HTMLElement;
  private statsContainer: HTMLElement;
  private createButton: HTMLButtonElement;
  private currentFilterId: string | null = null;

  constructor() {
    // Create DOM elements BEFORE calling createContainer()
    this.filtersList = document.createElement('div');
    this.statsContainer = document.createElement('div');
    this.createButton = document.createElement('button');

    // Now create the container which uses the above elements
    this.container = this.createContainer();

    this.setupEventListeners();
    logger.debug('FilterPanel', 'FilterPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel filter-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      right: 20px;
      width: 420px;
      max-height: calc(100vh - 120px);
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
    title.textContent = 'Advanced Filters';
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

    // Create Button
    this.createButton.textContent = '+ New Filter';
    this.createButton.style.cssText = `
      padding: 10px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    `;
    this.createButton.onclick = () => this.onCreateFilter();

    // Stats Section
    this.statsContainer.style.cssText = `
      padding: 12px;
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      border: var(--border);
    `;

    // Filters List
    const listSection = document.createElement('div');

    const listHeader = document.createElement('div');
    listHeader.textContent = 'All Filters';
    listHeader.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    this.filtersList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    listSection.appendChild(listHeader);
    listSection.appendChild(this.filtersList);

    content.appendChild(this.createButton);
    content.appendChild(this.statsContainer);
    content.appendChild(listSection);

    return content;
  }

  private setupEventListeners(): void {
    eventBus.on(Events.FILTER_CREATED, () => {
      this.refreshFilters();
    });

    eventBus.on(Events.FILTER_UPDATED, () => {
      this.refreshFilters();
    });

    eventBus.on(Events.FILTER_REMOVED, () => {
      this.refreshFilters();
    });

    eventBus.on(Events.FILTER_APPLIED, () => {
      this.refreshFilters();
    });

    eventBus.on(Events.FILTER_CLEARED, () => {
      this.refreshFilters();
    });
  }

  private onCreateFilter(): void {
    if (!this.filterManager) return;

    // Simple prompt-based filter creation
    const name = prompt('Filter name:');
    if (!name) return;

    const description = prompt('Filter description (optional):');

    // Create filter
    const filter = this.filterManager.createFilter(name, description || '');

    // Open editor
    this.editFilter(filter);
  }

  private editFilter(filter: FilterRule): void {
    if (!this.filterManager) return;

    // Create modal dialog for editing
    const modal = this.createFilterEditorModal(filter);
    document.body.appendChild(modal);
  }

  private createFilterEditorModal(filter: FilterRule): HTMLElement {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--color-surface-1);
      border-radius: var(--radius-lg);
      width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = `Edit Filter: ${filter.name}`;
    title.style.cssText = `
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary);
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Logic selector
    const logicSection = document.createElement('div');
    const logicLabel = document.createElement('label');
    logicLabel.textContent = 'Condition Logic:';
    logicLabel.style.cssText = `
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 6px;
    `;

    const logicSelect = document.createElement('select');
    logicSelect.style.cssText = `
      width: 100%;
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
    `;
    logicSelect.innerHTML = `
      <option value="AND" ${filter.logic === 'AND' ? 'selected' : ''}>Match ALL conditions (AND)</option>
      <option value="OR" ${filter.logic === 'OR' ? 'selected' : ''}>Match ANY condition (OR)</option>
    `;
    logicSelect.onchange = () => {
      filter.logic = logicSelect.value as FilterLogic;
      this.filterManager?.updateFilter(filter.id);
    };

    logicSection.appendChild(logicLabel);
    logicSection.appendChild(logicSelect);

    // Conditions
    const conditionsSection = document.createElement('div');
    const conditionsHeader = document.createElement('div');
    conditionsHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const conditionsLabel = document.createElement('label');
    conditionsLabel.textContent = 'Conditions:';
    conditionsLabel.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const addConditionBtn = document.createElement('button');
    addConditionBtn.textContent = '+ Add Condition';
    addConditionBtn.style.cssText = `
      padding: 4px 8px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-sm);
      color: white;
      font-size: var(--font-size-xs);
      cursor: pointer;
    `;
    addConditionBtn.onclick = () => {
      const property = prompt('Property name:');
      if (!property) return;

      const operator = prompt('Operator (equals, contains, greater-than, etc.):', 'equals');
      if (!operator) return;

      const value = prompt('Value:');

      const condition: FilterCondition = {
        property,
        operator: operator as FilterOperator,
        value: value || undefined,
      };

      filter.addCondition(condition);
      this.filterManager?.updateFilter(filter.id);

      // Refresh dialog
      document.body.removeChild(modal);
      this.editFilter(filter);
    };

    conditionsHeader.appendChild(conditionsLabel);
    conditionsHeader.appendChild(addConditionBtn);

    const conditionsList = document.createElement('div');
    conditionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    filter.conditions.forEach((condition, index) => {
      const conditionItem = document.createElement('div');
      conditionItem.style.cssText = `
        padding: 10px;
        background: var(--color-surface-2);
        border: var(--border);
        border-radius: var(--radius-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const conditionText = document.createElement('div');
      conditionText.textContent = `${condition.property} ${condition.operator} ${condition.value || ''}`;
      conditionText.style.cssText = `
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        flex: 1;
      `;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑️';
      removeBtn.title = 'Remove';
      removeBtn.style.cssText = `
        padding: 4px 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 14px;
      `;
      removeBtn.onclick = () => {
        filter.removeCondition(index);
        this.filterManager?.updateFilter(filter.id);

        // Refresh dialog
        document.body.removeChild(modal);
        this.editFilter(filter);
      };

      conditionItem.appendChild(conditionText);
      conditionItem.appendChild(removeBtn);
      conditionsList.appendChild(conditionItem);
    });

    if (filter.conditions.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No conditions yet. Add one to get started.';
      empty.style.cssText = `
        padding: 16px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        background: var(--color-surface-2);
        border-radius: var(--radius-md);
      `;
      conditionsList.appendChild(empty);
    }

    conditionsSection.appendChild(conditionsHeader);
    conditionsSection.appendChild(conditionsList);

    // Options
    const optionsSection = document.createElement('div');
    const optionsLabel = document.createElement('label');
    optionsLabel.textContent = 'Display Options:';
    optionsLabel.style.cssText = `
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    const isolateCheckbox = this.createCheckbox(
      'Isolate (hide non-matching elements)',
      filter.isolate,
      (checked) => {
        filter.isolate = checked;
        this.filterManager?.updateFilter(filter.id);
      }
    );

    const visibleCheckbox = this.createCheckbox('Visible', filter.visible, (checked) => {
      filter.visible = checked;
      this.filterManager?.updateFilter(filter.id);
    });

    const colorSection = document.createElement('div');
    colorSection.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Highlight Color:';
    colorLabel.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    `;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = filter.color
      ? `#${filter.color.getHexString()}`
      : '#3498db';
    colorInput.style.cssText = `
      width: 50px;
      height: 30px;
      border: var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
    `;
    colorInput.onchange = () => {
      filter.setColor(new THREE.Color(colorInput.value));
      this.filterManager?.updateFilter(filter.id);
    };

    const clearColorBtn = document.createElement('button');
    clearColorBtn.textContent = 'Clear';
    clearColorBtn.style.cssText = `
      padding: 4px 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: var(--font-size-xs);
      cursor: pointer;
    `;
    clearColorBtn.onclick = () => {
      filter.clearColor();
      this.filterManager?.updateFilter(filter.id);
    };

    colorSection.appendChild(colorLabel);
    colorSection.appendChild(colorInput);
    colorSection.appendChild(clearColorBtn);

    optionsSection.appendChild(optionsLabel);
    optionsSection.appendChild(isolateCheckbox);
    optionsSection.appendChild(visibleCheckbox);
    optionsSection.appendChild(colorSection);

    // Add sections to content
    content.appendChild(logicSection);
    content.appendChild(conditionsSection);
    content.appendChild(optionsSection);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 20px;
      border-top: var(--border);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Filter';
    applyBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-weight: 600;
      cursor: pointer;
    `;
    applyBtn.onclick = () => {
      if (this.filterManager) {
        this.filterManager.applyFilter(filter.id);
        document.body.removeChild(modal);
      }
    };

    const closeDialogBtn = document.createElement('button');
    closeDialogBtn.textContent = 'Close';
    closeDialogBtn.style.cssText = `
      padding: 10px 20px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      cursor: pointer;
    `;
    closeDialogBtn.onclick = () => document.body.removeChild(modal);

    footer.appendChild(applyBtn);
    footer.appendChild(closeDialogBtn);

    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    modal.appendChild(dialog);

    return modal;
  }

  private createCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ): HTMLElement {
    const container = document.createElement('label');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      padding: 6px 0;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.onchange = () => onChange(checkbox.checked);

    const labelText = document.createElement('span');
    labelText.textContent = label;

    container.appendChild(checkbox);
    container.appendChild(labelText);

    return container;
  }

  private refreshFilters(): void {
    if (!this.filterManager) return;

    // Update stats
    this.updateStats();

    // Refresh list
    this.filtersList.innerHTML = '';
    const filters = this.filterManager.getAllFilters();

    if (filters.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No filters yet';
      empty.style.cssText = `
        padding: 16px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      `;
      this.filtersList.appendChild(empty);
      return;
    }

    filters.forEach((filter) => {
      this.addFilterItem(filter);
    });
  }

  private addFilterItem(filter: FilterRule): void {
    const activeFilter = this.filterManager?.getActiveFilter();
    const isActive = activeFilter?.id === filter.id;

    const item = document.createElement('div');
    item.style.cssText = `
      padding: 12px;
      background: ${isActive ? 'var(--color-surface-3)' : 'var(--color-surface-2)'};
      border: ${isActive ? '2px solid var(--color-primary)' : 'var(--border)'};
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;
    `;

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

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 8px;
    `;

    const titleSection = document.createElement('div');
    titleSection.style.cssText = `flex: 1;`;

    const title = document.createElement('div');
    title.textContent = filter.name;
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 4px;
    `;

    const description = document.createElement('div');
    description.textContent = filter.getDescription();
    description.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    `;

    titleSection.appendChild(title);
    titleSection.appendChild(description);

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
    `;
    editBtn.onclick = (e) => {
      e.stopPropagation();
      this.editFilter(filter);
    };

    const applyBtn = document.createElement('button');
    applyBtn.textContent = isActive ? '✓' : '▶';
    applyBtn.title = isActive ? 'Active' : 'Apply';
    applyBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: ${isActive ? 'var(--color-success)' : 'var(--color-text-primary)'};
    `;
    applyBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.filterManager) {
        if (isActive) {
          this.filterManager.clearFilter();
        } else {
          this.filterManager.applyFilter(filter.id);
        }
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete filter "${filter.name}"?`) && this.filterManager) {
        this.filterManager.removeFilter(filter.id);
      }
    };

    actions.appendChild(editBtn);
    actions.appendChild(applyBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(titleSection);
    header.appendChild(actions);

    // Metadata
    const metadata = document.createElement('div');
    metadata.style.cssText = `
      display: flex;
      gap: 8px;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    `;

    const conditionsCount = document.createElement('span');
    conditionsCount.textContent = `${filter.conditions.length} condition${filter.conditions.length !== 1 ? 's' : ''}`;

    const logic = document.createElement('span');
    logic.textContent = filter.logic;
    logic.style.cssText = `
      padding: 2px 6px;
      background: var(--color-surface-1);
      border-radius: var(--radius-sm);
    `;

    metadata.appendChild(conditionsCount);
    metadata.appendChild(logic);

    if (filter.color) {
      const colorBadge = document.createElement('span');
      colorBadge.style.cssText = `
        width: 16px;
        height: 16px;
        background: #${filter.color.getHexString()};
        border-radius: 50%;
        display: inline-block;
      `;
      metadata.appendChild(colorBadge);
    }

    item.appendChild(header);
    item.appendChild(metadata);

    // Click to apply/clear
    item.onclick = () => {
      if (this.filterManager) {
        if (isActive) {
          this.filterManager.clearFilter();
        } else {
          this.filterManager.applyFilter(filter.id);
        }
      }
    };

    this.filtersList.appendChild(item);
  }

  private updateStats(): void {
    if (!this.filterManager) return;

    const stats = this.filterManager.getStatistics();

    this.statsContainer.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Statistics';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: var(--font-size-xs);
    `;

    const totalFilters = document.createElement('div');
    totalFilters.innerHTML = `<strong>Total Filters:</strong> ${stats.totalFilters}`;
    grid.appendChild(totalFilters);

    const cachedElements = document.createElement('div');
    cachedElements.innerHTML = `<strong>Cached Elements:</strong> ${stats.cachedElements}`;
    grid.appendChild(cachedElements);

    const activeFilter = document.createElement('div');
    activeFilter.innerHTML = `<strong>Active:</strong> ${stats.activeFilter ? 'Yes' : 'None'}`;
    activeFilter.style.gridColumn = '1 / -1';
    grid.appendChild(activeFilter);

    this.statsContainer.appendChild(title);
    this.statsContainer.appendChild(grid);
  }

  /**
   * Set the filter manager
   */
  setFilterManager(manager: FilterManager): void {
    this.filterManager = manager;
    this.filterManager.buildElementCache();
    this.refreshFilters();
    logger.debug('FilterPanel', 'FilterManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.refreshFilters();
    logger.debug('FilterPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('FilterPanel', 'Panel hidden');
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
    logger.debug('FilterPanel', 'Panel disposed');
  }
}
