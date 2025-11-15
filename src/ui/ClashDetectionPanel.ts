/**
 * ClashDetectionPanel - UI for managing clash detection
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ClashDetectionManager } from '@managers/ClashDetectionManager';
import { Clash, ClashSeverity, ClashStatus } from '@tools/Clash';

export class ClashDetectionPanel {
  private container: HTMLElement;
  private clashManager: ClashDetectionManager | null = null;
  private clashList: HTMLElement;
  private summaryElement: HTMLElement;
  private progressBar!: HTMLElement;
  private progressContainer: HTMLElement;
  private filterSeverity: string = 'all';
  private filterStatus: string = 'all';
  private selectedRuleId: string | null = null;

  constructor() {
    this.container = this.createContainer();
    this.progressContainer = this.createProgressBar();
    this.summaryElement = this.createSummary();
    const controls = this.createControls();
    const filters = this.createFilters();
    this.clashList = this.createClashList();

    this.container.appendChild(controls);
    this.container.appendChild(this.progressContainer);
    this.container.appendChild(this.summaryElement);
    this.container.appendChild(filters);
    this.container.appendChild(this.clashList);

    this.setupEventListeners();
    logger.debug('ClashDetectionPanel', 'ClashDetectionPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel clash-detection-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      right: 16px;
      width: 360px;
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
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--color-surface-2);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Clash Detection';
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
    container.appendChild(header);

    document.body.appendChild(container);
    return container;
  }

  private createControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.style.cssText = `
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-bottom: var(--border);
    `;

    // Rule selector
    const ruleLabel = document.createElement('label');
    ruleLabel.textContent = 'Select Rule:';
    ruleLabel.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: -4px;
    `;

    const ruleSelect = document.createElement('select');
    ruleSelect.className = 'rule-select';
    ruleSelect.style.cssText = `
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;

    // Will be populated when manager is set
    ruleSelect.innerHTML = '<option value="">All Enabled Rules</option>';

    ruleSelect.onchange = (e) => {
      const select = e.target as HTMLSelectElement;
      this.selectedRuleId = select.value || null;
    };

    // Run button
    const runBtn = document.createElement('button');
    runBtn.className = 'run-clash-detection-btn';
    runBtn.textContent = 'Run Clash Detection';
    runBtn.style.cssText = `
      padding: 10px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-size: var(--font-size-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    runBtn.onmouseover = () => {
      runBtn.style.background = 'var(--color-primary-hover)';
    };
    runBtn.onmouseout = () => {
      runBtn.style.background = 'var(--color-primary)';
    };
    runBtn.onclick = () => this.runClashDetection();

    // Action buttons
    const actionRow = document.createElement('div');
    actionRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All';
    clearBtn.style.cssText = `
      flex: 1;
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    clearBtn.onclick = () => this.clearClashes();

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.style.cssText = `
      flex: 1;
      padding: 8px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;
    exportBtn.onclick = () => this.showExportMenu(exportBtn);

    actionRow.appendChild(clearBtn);
    actionRow.appendChild(exportBtn);

    controls.appendChild(ruleLabel);
    controls.appendChild(ruleSelect);
    controls.appendChild(runBtn);
    controls.appendChild(actionRow);

    return controls;
  }

  private createProgressBar(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'progress-container';
    container.style.cssText = `
      padding: 8px 12px;
      background: var(--color-surface-2);
      border-bottom: var(--border);
      display: none;
    `;

    const label = document.createElement('div');
    label.textContent = 'Running clash detection...';
    label.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    `;

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = `
      width: 100%;
      height: 4px;
      background: var(--color-surface-3);
      border-radius: 2px;
      overflow: hidden;
    `;

    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: var(--color-primary);
      transition: width 0.3s ease;
    `;

    progressBar.appendChild(progressFill);
    container.appendChild(label);
    container.appendChild(progressBar);

    this.progressBar = progressFill;
    return container;
  }

  private createSummary(): HTMLElement {
    const summary = document.createElement('div');
    summary.className = 'clash-summary';
    summary.style.cssText = `
      padding: 12px;
      background: var(--color-surface-2);
      border-bottom: var(--border);
      display: none;
      flex-direction: column;
      gap: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Summary';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 4px;
    `;

    const stats = document.createElement('div');
    stats.className = 'clash-stats';
    stats.style.cssText = `
      display: flex;
      gap: 12px;
      font-size: var(--font-size-sm);
    `;

    summary.appendChild(title);
    summary.appendChild(stats);

    return summary;
  }

  private createFilters(): HTMLElement {
    const filters = document.createElement('div');
    filters.style.cssText = `
      padding: 12px;
      display: flex;
      gap: 8px;
      border-bottom: var(--border);
      background: var(--color-surface-2);
    `;

    // Severity filter
    const severitySelect = document.createElement('select');
    severitySelect.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-xs);
      cursor: pointer;
    `;
    severitySelect.innerHTML = `
      <option value="all">All Severities</option>
      <option value="hard">Hard</option>
      <option value="soft">Soft</option>
      <option value="warning">Warning</option>
    `;
    severitySelect.onchange = (e) => {
      this.filterSeverity = (e.target as HTMLSelectElement).value;
      this.updateClashList();
    };

    // Status filter
    const statusSelect = document.createElement('select');
    statusSelect.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-xs);
      cursor: pointer;
    `;
    statusSelect.innerHTML = `
      <option value="all">All Statuses</option>
      <option value="new">New</option>
      <option value="active">Active</option>
      <option value="resolved">Resolved</option>
      <option value="ignored">Ignored</option>
    `;
    statusSelect.onchange = (e) => {
      this.filterStatus = (e.target as HTMLSelectElement).value;
      this.updateClashList();
    };

    filters.appendChild(severitySelect);
    filters.appendChild(statusSelect);

    return filters;
  }

  private createClashList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'clash-list';
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;

    // Empty state
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.style.cssText = `
      padding: 24px;
      text-align: center;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    `;
    emptyState.textContent = 'No clashes detected. Run clash detection to find conflicts.';
    list.appendChild(emptyState);

    return list;
  }

  private setupEventListeners(): void {
    // Listen for clash detection events
    eventBus.on(Events.CLASH_DETECTION_STARTED, () => {
      this.onDetectionStarted();
    });

    eventBus.on(Events.CLASH_DETECTION_PROGRESS, (data: { current: number; total: number }) => {
      this.onDetectionProgress(data);
    });

    eventBus.on(Events.CLASH_DETECTION_COMPLETE, (data: any) => {
      this.onDetectionComplete(data);
    });

    eventBus.on(Events.CLASH_CREATED, () => {
      // Could add individual clash to list
    });

    eventBus.on(Events.CLASH_UPDATED, () => {
      this.updateClashList();
    });
  }

  private async runClashDetection(): Promise<void> {
    if (!this.clashManager) {
      logger.warn('ClashDetectionPanel', 'ClashDetectionManager not set');
      return;
    }

    try {
      await this.clashManager.runClashDetection(this.selectedRuleId || undefined);
    } catch (error) {
      logger.error('ClashDetectionPanel', 'Error running clash detection:', error);
      alert(`Error running clash detection: ${error}`);
    }
  }

  private onDetectionStarted(): void {
    this.progressContainer.style.display = 'block';
    this.progressBar.style.width = '0%';

    // Disable run button
    const runBtn = this.container.querySelector('.run-clash-detection-btn') as HTMLButtonElement;
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.style.opacity = '0.5';
      runBtn.style.cursor = 'not-allowed';
    }
  }

  private onDetectionProgress(data: { current: number; total: number }): void {
    const percentage = (data.current / data.total) * 100;
    this.progressBar.style.width = `${percentage}%`;
  }

  private onDetectionComplete(data: any): void {
    this.progressContainer.style.display = 'none';

    // Enable run button
    const runBtn = this.container.querySelector('.run-clash-detection-btn') as HTMLButtonElement;
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.style.opacity = '1';
      runBtn.style.cursor = 'pointer';
    }

    // Update summary
    this.updateSummary(data);

    // Update clash list
    this.updateClashList();
  }

  private updateSummary(data: any): void {
    const stats = this.summaryElement.querySelector('.clash-stats');
    if (!stats) return;

    stats.innerHTML = `
      <div style="flex: 1;">
        <div style="color: var(--color-text-secondary); font-size: 10px; text-transform: uppercase;">Total</div>
        <div style="font-weight: 600; font-size: 18px;">${data.total || 0}</div>
      </div>
      <div style="flex: 1;">
        <div style="color: #ff4444; font-size: 10px; text-transform: uppercase;">Hard</div>
        <div style="font-weight: 600; font-size: 18px; color: #ff4444;">${data.hard || 0}</div>
      </div>
      <div style="flex: 1;">
        <div style="color: #ffaa00; font-size: 10px; text-transform: uppercase;">Soft</div>
        <div style="font-weight: 600; font-size: 18px; color: #ffaa00;">${data.soft || 0}</div>
      </div>
    `;

    this.summaryElement.style.display = 'flex';
  }

  private updateClashList(): void {
    if (!this.clashManager) return;

    const clashes = this.clashManager.getClashes();

    // Filter clashes
    const filteredClashes = clashes.filter(clash => {
      if (this.filterSeverity !== 'all' && clash.severity !== this.filterSeverity) {
        return false;
      }
      if (this.filterStatus !== 'all' && clash.status !== this.filterStatus) {
        return false;
      }
      return true;
    });

    // Clear list
    this.clashList.innerHTML = '';

    if (filteredClashes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        padding: 24px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      `;
      emptyState.textContent = clashes.length === 0
        ? 'No clashes detected.'
        : 'No clashes match the current filters.';
      this.clashList.appendChild(emptyState);
      return;
    }

    // Add clash items
    filteredClashes.forEach(clash => {
      this.addClashItem(clash);
    });
  }

  private addClashItem(clash: Clash): void {
    const item = document.createElement('div');
    item.className = 'clash-item';
    item.dataset.id = clash.id;
    item.style.cssText = `
      padding: 10px;
      background: var(--color-surface-2);
      border: var(--border);
      border-left: 3px solid ${this.getSeverityColorHex(clash.severity)};
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    item.onmouseover = () => {
      item.style.background = 'var(--color-surface-3)';
    };
    item.onmouseout = () => {
      item.style.background = 'var(--color-surface-2)';
    };

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    `;

    const severity = document.createElement('span');
    severity.textContent = clash.severity.toUpperCase();
    severity.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      color: ${this.getSeverityColorHex(clash.severity)};
      text-transform: uppercase;
    `;

    const statusSelect = document.createElement('select');
    statusSelect.value = clash.status;
    statusSelect.style.cssText = `
      padding: 2px 6px;
      font-size: 10px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      cursor: pointer;
    `;
    statusSelect.innerHTML = `
      <option value="new">New</option>
      <option value="active">Active</option>
      <option value="resolved">Resolved</option>
      <option value="approved">Approved</option>
      <option value="ignored">Ignored</option>
    `;
    statusSelect.onclick = (e) => e.stopPropagation();
    statusSelect.onchange = (e) => {
      e.stopPropagation();
      const newStatus = (e.target as HTMLSelectElement).value as ClashStatus;
      this.clashManager?.updateClashStatus(clash.id, newStatus);
    };

    header.appendChild(severity);
    header.appendChild(statusSelect);

    // Elements
    const elements = document.createElement('div');
    elements.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      margin-bottom: 6px;
    `;
    elements.innerHTML = `
      <div style="margin-bottom: 2px;">
        <strong>A:</strong> ${clash.elementA.type} (${clash.elementA.expressID})
      </div>
      <div>
        <strong>B:</strong> ${clash.elementB.type} (${clash.elementB.expressID})
      </div>
    `;

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 6px;
      margin-top: 8px;
    `;

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-sm);
      color: white;
      cursor: pointer;
    `;
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.viewClash(clash.id);
    };

    const focusBtn = document.createElement('button');
    focusBtn.textContent = 'Focus';
    focusBtn.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
      background: var(--color-surface-3);
      border: var(--border);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      cursor: pointer;
    `;
    focusBtn.onclick = (e) => {
      e.stopPropagation();
      this.focusClash(clash.id);
    };

    actions.appendChild(viewBtn);
    actions.appendChild(focusBtn);

    item.appendChild(header);
    item.appendChild(elements);
    item.appendChild(actions);

    this.clashList.appendChild(item);
  }

  private viewClash(clashId: string): void {
    if (!this.clashManager) return;
    this.clashManager.visualizeClash(clashId);
    logger.info('ClashDetectionPanel', `Viewing clash ${clashId}`);
  }

  private focusClash(clashId: string): void {
    if (!this.clashManager) return;
    this.clashManager.focusOnClash(clashId);
    this.clashManager.visualizeClash(clashId);
    logger.info('ClashDetectionPanel', `Focused on clash ${clashId}`);
  }

  private clearClashes(): void {
    if (!this.clashManager) return;

    if (confirm('Are you sure you want to clear all clashes?')) {
      this.clashManager.clearClashes();
      this.summaryElement.style.display = 'none';
      this.updateClashList();
      logger.info('ClashDetectionPanel', 'Cleared all clashes');
    }
  }

  private showExportMenu(button: HTMLElement): void {
    if (!this.clashManager) return;

    // Create export menu
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      padding: 4px;
      z-index: 1000;
      min-width: 120px;
    `;

    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    const csvOption = this.createMenuOption('Export CSV', () => {
      this.exportCSV();
      document.body.removeChild(menu);
    });

    const bcfOption = this.createMenuOption('Export BCF', () => {
      this.exportBCF();
      document.body.removeChild(menu);
    });

    menu.appendChild(csvOption);
    menu.appendChild(bcfOption);

    document.body.appendChild(menu);

    // Close menu on click outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== button) {
        document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private createMenuOption(label: string, onClick: () => void): HTMLElement {
    const option = document.createElement('div');
    option.textContent = label;
    option.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    `;
    option.onmouseover = () => {
      option.style.background = 'var(--color-surface-3)';
    };
    option.onmouseout = () => {
      option.style.background = 'transparent';
    };
    option.onclick = onClick;
    return option;
  }

  private exportCSV(): void {
    if (!this.clashManager) return;

    const csv = this.clashManager.exportToCSV();
    this.downloadFile(csv, 'clashes.csv', 'text/csv');
    logger.info('ClashDetectionPanel', 'Exported clashes to CSV');
  }

  private exportBCF(): void {
    if (!this.clashManager) return;

    const bcf = this.clashManager.exportToBCF();
    this.downloadFile(bcf, 'clashes.bcf.json', 'application/json');
    logger.info('ClashDetectionPanel', 'Exported clashes to BCF');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getSeverityColorHex(severity: ClashSeverity): string {
    switch (severity) {
      case ClashSeverity.HARD:
        return '#ff4444';
      case ClashSeverity.SOFT:
        return '#ffaa00';
      case ClashSeverity.WARNING:
        return '#ffff00';
      default:
        return '#ff4444';
    }
  }

  private updateRulesList(): void {
    if (!this.clashManager) return;

    const ruleSelect = this.container.querySelector('.rule-select') as HTMLSelectElement;
    if (!ruleSelect) return;

    const rules = this.clashManager.getRules();
    ruleSelect.innerHTML = '<option value="">All Enabled Rules</option>';

    rules.forEach(rule => {
      const option = document.createElement('option');
      option.value = rule.id;
      option.textContent = `${rule.name}${rule.enabled ? '' : ' (disabled)'}`;
      ruleSelect.appendChild(option);
    });
  }

  /**
   * Set the clash detection manager
   */
  setClashDetectionManager(manager: ClashDetectionManager): void {
    this.clashManager = manager;
    this.updateRulesList();
    logger.debug('ClashDetectionPanel', 'ClashDetectionManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    logger.debug('ClashDetectionPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('ClashDetectionPanel', 'Panel hidden');
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
    logger.debug('ClashDetectionPanel', 'Panel disposed');
  }
}
