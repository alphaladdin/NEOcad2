/**
 * ModelComparisonPanel - UI for managing model comparisons
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ModelComparisonManager } from '@managers/ModelComparisonManager';
import { ModelComparison, ComparisonStatus } from '@tools/ModelComparison';

export class ModelComparisonPanel {
  private container: HTMLElement;
  private comparisonManager: ModelComparisonManager | null = null;
  private comparisonsList: HTMLElement;
  private statsContainer: HTMLElement;
  private filterButtons: Map<ComparisonStatus | 'all', HTMLButtonElement> = new Map();

  constructor() {
    this.comparisonsList = document.createElement('div');
    this.statsContainer = document.createElement('div');
    this.container = this.createContainer();
    this.setupEventListeners();
    logger.debug('ModelComparisonPanel', 'ModelComparisonPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel model-comparison-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      right: 20px;
      width: 320px;
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
    title.textContent = 'Model Comparison';
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

    // Stats Section
    this.statsContainer.style.cssText = `
      padding: 12px;
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      border: var(--border);
    `;

    // Filter Section
    const filterSection = this.createFilterSection();

    // Comparisons List
    const comparisonsSection = document.createElement('div');

    const comparisonsHeader = document.createElement('div');
    comparisonsHeader.textContent = 'Comparisons';
    comparisonsHeader.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    this.comparisonsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    comparisonsSection.appendChild(comparisonsHeader);
    comparisonsSection.appendChild(this.comparisonsList);

    content.appendChild(this.statsContainer);
    content.appendChild(filterSection);
    content.appendChild(comparisonsSection);

    return content;
  }

  private createFilterSection(): HTMLElement {
    const section = document.createElement('div');

    const header = document.createElement('div');
    header.textContent = 'Filter by Status';
    header.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    `;

    // Create filter buttons
    const filters: Array<{ status: ComparisonStatus | 'all'; label: string }> = [
      { status: 'all', label: 'All' },
      { status: 'added', label: 'Added' },
      { status: 'removed', label: 'Removed' },
      { status: 'modified', label: 'Modified' },
    ];

    filters.forEach(({ status, label }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 6px 12px;
        background: var(--color-surface-2);
        border: var(--border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-size-xs);
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-surface-3)';
      });

      btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('active')) {
          btn.style.background = 'var(--color-surface-2)';
        }
      });

      btn.addEventListener('click', () => {
        if (status === 'all') {
          this.clearFilters();
        } else {
          this.filterByStatus(status);
        }
        this.updateFilterButtons(status);
      });

      this.filterButtons.set(status, btn);
      buttonsContainer.appendChild(btn);
    });

    section.appendChild(header);
    section.appendChild(buttonsContainer);

    return section;
  }

  private updateFilterButtons(activeStatus: ComparisonStatus | 'all'): void {
    this.filterButtons.forEach((btn, status) => {
      if (status === activeStatus) {
        btn.classList.add('active');
        btn.style.background = 'var(--color-primary)';
        btn.style.color = 'white';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'var(--color-surface-2)';
        btn.style.color = 'var(--color-text-primary)';
      }
    });
  }

  private setupEventListeners(): void {
    eventBus.on(Events.MODEL_COMPARISON_CREATED, () => {
      this.refreshComparisons();
    });

    eventBus.on(Events.MODEL_COMPARISON_REMOVED, () => {
      this.refreshComparisons();
    });

    eventBus.on(Events.MODEL_COMPARISON_APPLIED, ({ comparison }) => {
      this.updateStats(comparison);
    });

    eventBus.on(Events.MODEL_COMPARISON_CLEARED, () => {
      this.clearStats();
    });
  }

  private refreshComparisons(): void {
    if (!this.comparisonManager) return;

    this.comparisonsList.innerHTML = '';
    const comparisons = this.comparisonManager.getAllComparisons();

    if (comparisons.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No comparisons yet';
      empty.style.cssText = `
        padding: 16px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      `;
      this.comparisonsList.appendChild(empty);
      return;
    }

    comparisons.forEach((comparison) => {
      this.addComparisonItem(comparison);
    });
  }

  private addComparisonItem(comparison: ModelComparison): void {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const name = document.createElement('div');
    name.textContent = comparison.name;
    name.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = '👁';
    applyBtn.title = 'Apply comparison';
    applyBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    applyBtn.onclick = () => {
      if (this.comparisonManager) {
        this.comparisonManager.applyComparison(comparison.id);
      }
    };

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '↺';
    clearBtn.title = 'Clear comparison';
    clearBtn.style.cssText = `
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    clearBtn.onclick = () => {
      if (this.comparisonManager) {
        this.comparisonManager.clearComparison();
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
      if (confirm(`Delete comparison "${comparison.name}"?`) && this.comparisonManager) {
        this.comparisonManager.removeComparison(comparison.id);
      }
    };

    actions.appendChild(applyBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(name);
    header.appendChild(actions);

    // Info
    const info = document.createElement('div');
    info.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    `;

    const totalDiffs = comparison.getTotalDifferences();
    info.innerHTML = `
      <div>${comparison.baseModelName} vs ${comparison.compareModelName}</div>
      <div>${totalDiffs} difference${totalDiffs !== 1 ? 's' : ''} found</div>
    `;

    item.appendChild(header);
    item.appendChild(info);

    this.comparisonsList.appendChild(item);
  }

  private updateStats(comparison: ModelComparison): void {
    this.statsContainer.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Comparison Statistics';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    const stats = document.createElement('div');
    stats.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: var(--font-size-xs);
    `;

    const statItems = [
      { label: 'Added', value: comparison.stats.added, color: '#00ff00' },
      { label: 'Removed', value: comparison.stats.removed, color: '#ff0000' },
      { label: 'Modified', value: comparison.stats.modified, color: '#ffaa00' },
      { label: 'Unchanged', value: comparison.stats.unchanged, color: '#808080' },
    ];

    statItems.forEach(({ label, value, color }) => {
      const stat = document.createElement('div');
      stat.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 12px;
        height: 12px;
        background: ${color};
        border-radius: 2px;
      `;

      const text = document.createElement('div');
      text.textContent = `${label}: ${value}`;

      stat.appendChild(colorBox);
      stat.appendChild(text);
      stats.appendChild(stat);
    });

    this.statsContainer.appendChild(title);
    this.statsContainer.appendChild(stats);
  }

  private clearStats(): void {
    this.statsContainer.innerHTML = '';
    const message = document.createElement('div');
    message.textContent = 'No active comparison';
    message.style.cssText = `
      padding: 16px;
      text-align: center;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    `;
    this.statsContainer.appendChild(message);
  }

  private filterByStatus(status: ComparisonStatus): void {
    if (this.comparisonManager) {
      this.comparisonManager.highlightByStatus(status);
    }
  }

  private clearFilters(): void {
    if (this.comparisonManager) {
      const activeComparison = this.comparisonManager.getActiveComparison();
      if (activeComparison) {
        this.comparisonManager.applyComparison(activeComparison.id);
      }
    }
  }

  /**
   * Set the comparison manager
   */
  setComparisonManager(manager: ModelComparisonManager): void {
    this.comparisonManager = manager;
    this.refreshComparisons();
    logger.debug('ModelComparisonPanel', 'ComparisonManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.refreshComparisons();
    this.clearStats();
    logger.debug('ModelComparisonPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('ModelComparisonPanel', 'Panel hidden');
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
    logger.debug('ModelComparisonPanel', 'Panel disposed');
  }
}
