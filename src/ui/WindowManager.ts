/**
 * Panel interface - Base for all window panels
 */
export interface Panel {
  id: string;
  title: string;
  icon?: string;
  closeable?: boolean;
  element: HTMLElement;
  onClose?: () => void;
  onFocus?: () => void;
  onResize?: () => void;
}

/**
 * Tab container - Manages multiple panels as tabs
 */
export class TabContainer {
  element: HTMLElement;
  private panels: Map<string, Panel> = new Map();
  private activePanel: Panel | null = null;
  private tabsContainer: HTMLElement;
  private contentContainer: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tab-container';

    // Tabs header
    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'tabs-header';
    this.element.appendChild(this.tabsContainer);

    // Content area
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'tabs-content';
    this.element.appendChild(this.contentContainer);
  }

  /**
   * Add panel
   */
  addPanel(panel: Panel): void {
    this.panels.set(panel.id, panel);

    // Create tab
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.panelId = panel.id;

    if (panel.icon) {
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = panel.icon;
      tab.appendChild(icon);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = panel.title;
    tab.appendChild(title);

    if (panel.closeable !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.removePanel(panel.id);
      };
      tab.appendChild(closeBtn);
    }

    tab.onclick = () => this.activatePanel(panel.id);

    this.tabsContainer.appendChild(tab);

    // Add content
    panel.element.style.display = 'none';
    this.contentContainer.appendChild(panel.element);

    // Activate if first panel
    if (this.panels.size === 1) {
      this.activatePanel(panel.id);
    }
  }

  /**
   * Remove panel
   */
  removePanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    // Call onClose callback
    if (panel.onClose) {
      panel.onClose();
    }

    // Remove tab
    const tab = this.tabsContainer.querySelector(`[data-panel-id="${panelId}"]`);
    if (tab) {
      this.tabsContainer.removeChild(tab);
    }

    // Remove content
    this.contentContainer.removeChild(panel.element);

    this.panels.delete(panelId);

    // Activate another panel if this was active
    if (this.activePanel === panel) {
      const remaining = Array.from(this.panels.values());
      if (remaining.length > 0) {
        this.activatePanel(remaining[0].id);
      } else {
        this.activePanel = null;
      }
    }
  }

  /**
   * Activate panel
   */
  activatePanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    // Deactivate current
    if (this.activePanel) {
      this.activePanel.element.style.display = 'none';
      const currentTab = this.tabsContainer.querySelector(
        `[data-panel-id="${this.activePanel.id}"]`
      );
      if (currentTab) {
        currentTab.classList.remove('active');
      }
    }

    // Activate new
    this.activePanel = panel;
    panel.element.style.display = 'flex';
    const tab = this.tabsContainer.querySelector(`[data-panel-id="${panelId}"]`);
    if (tab) {
      tab.classList.add('active');
    }

    if (panel.onFocus) {
      panel.onFocus();
    }
  }

  /**
   * Get active panel
   */
  getActivePanel(): Panel | null {
    return this.activePanel;
  }

  /**
   * Get all panels
   */
  getPanels(): Panel[] {
    return Array.from(this.panels.values());
  }
}

/**
 * Split pane - Resizable container with two children
 */
export class SplitPane {
  element: HTMLElement;
  private direction: 'horizontal' | 'vertical';
  private firstPane: HTMLElement;
  private secondPane: HTMLElement;
  private splitter: HTMLElement;
  private ratio: number = 0.5;
  private isDragging: boolean = false;

  constructor(direction: 'horizontal' | 'vertical' = 'horizontal') {
    this.direction = direction;

    this.element = document.createElement('div');
    this.element.className = `split-pane split-${direction}`;

    this.firstPane = document.createElement('div');
    this.firstPane.className = 'split-pane-first';
    this.element.appendChild(this.firstPane);

    this.splitter = document.createElement('div');
    this.splitter.className = 'split-splitter';
    this.element.appendChild(this.splitter);

    this.secondPane = document.createElement('div');
    this.secondPane.className = 'split-pane-second';
    this.element.appendChild(this.secondPane);

    this.setupSplitter();
    this.updateSizes();
  }

  /**
   * Setup splitter dragging
   */
  private setupSplitter(): void {
    this.splitter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      document.body.style.cursor =
        this.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const rect = this.element.getBoundingClientRect();

      if (this.direction === 'horizontal') {
        const x = e.clientX - rect.left;
        this.ratio = Math.max(0.1, Math.min(0.9, x / rect.width));
      } else {
        const y = e.clientY - rect.top;
        this.ratio = Math.max(0.1, Math.min(0.9, y / rect.height));
      }

      this.updateSizes();
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    });
  }

  /**
   * Update pane sizes
   */
  private updateSizes(): void {
    const splitterSize = 4; // px
    const firstPercent = this.ratio * 100;
    const secondPercent = (1 - this.ratio) * 100;

    if (this.direction === 'horizontal') {
      this.firstPane.style.width = `calc(${firstPercent}% - ${splitterSize / 2}px)`;
      this.secondPane.style.width = `calc(${secondPercent}% - ${splitterSize / 2}px)`;
    } else {
      this.firstPane.style.height = `calc(${firstPercent}% - ${splitterSize / 2}px)`;
      this.secondPane.style.height = `calc(${secondPercent}% - ${splitterSize / 2}px)`;
    }
  }

  /**
   * Set first pane content
   */
  setFirstPane(content: HTMLElement): void {
    this.firstPane.innerHTML = '';
    this.firstPane.appendChild(content);
  }

  /**
   * Set second pane content
   */
  setSecondPane(content: HTMLElement): void {
    this.secondPane.innerHTML = '';
    this.secondPane.appendChild(content);
  }

  /**
   * Set split ratio
   */
  setRatio(ratio: number): void {
    this.ratio = Math.max(0.1, Math.min(0.9, ratio));
    this.updateSizes();
  }

  /**
   * Get split ratio
   */
  getRatio(): number {
    return this.ratio;
  }
}

/**
 * Window Manager - Manages the entire window layout
 */
export class WindowManager {
  private container: HTMLElement;
  private layout: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.injectStyles();
  }

  /**
   * Create default layout
   */
  createDefaultLayout(): {
    leftPanel: TabContainer;
    centerPanel: TabContainer;
    rightPanel: TabContainer;
    bottomPanel: TabContainer;
  } {
    // Clear container
    this.container.innerHTML = '';

    // Create main split (left | rest)
    const mainSplit = new SplitPane('horizontal');
    mainSplit.setRatio(0.2);

    // Left panel
    const leftPanel = new TabContainer();

    // Create center split (center | right)
    const centerSplit = new SplitPane('horizontal');
    centerSplit.setRatio(0.75);

    // Center panel
    const centerPanel = new TabContainer();

    // Right panel
    const rightPanel = new TabContainer();

    // Create vertical split for center (top | bottom)
    const verticalSplit = new SplitPane('vertical');
    verticalSplit.setRatio(0.75);

    // Bottom panel
    const bottomPanel = new TabContainer();

    // Assemble layout
    mainSplit.setFirstPane(leftPanel.element);

    verticalSplit.setFirstPane(centerPanel.element);
    verticalSplit.setSecondPane(bottomPanel.element);

    centerSplit.setFirstPane(verticalSplit.element);
    centerSplit.setSecondPane(rightPanel.element);

    mainSplit.setSecondPane(centerSplit.element);

    this.layout = mainSplit.element;
    this.container.appendChild(this.layout);

    return { leftPanel, centerPanel, rightPanel, bottomPanel };
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (document.getElementById('window-manager-styles')) return;

    const style = document.createElement('style');
    style.id = 'window-manager-styles';
    style.textContent = `
      /* Tab Container */
      .tab-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
      }

      .tabs-header {
        display: flex;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        min-height: 35px;
        overflow-x: auto;
        overflow-y: hidden;
      }

      .tabs-header::-webkit-scrollbar {
        height: 4px;
      }

      .tabs-header::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 2px;
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: #2d2d30;
        border-right: 1px solid #3e3e42;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        transition: background 0.2s;
      }

      .tab:hover {
        background: #3e3e42;
      }

      .tab.active {
        background: #1e1e1e;
        border-bottom: 2px solid #4a9eff;
      }

      .tab-icon {
        font-size: 14px;
      }

      .tab-title {
        font-size: 13px;
        color: #cccccc;
      }

      .tab.active .tab-title {
        color: #ffffff;
      }

      .tab-close {
        background: none;
        border: none;
        color: #888;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: all 0.2s;
      }

      .tab-close:hover {
        background: #e81123;
        color: white;
      }

      .tabs-content {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .tabs-content > * {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
      }

      /* Split Pane */
      .split-pane {
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .split-pane.split-horizontal {
        flex-direction: row;
      }

      .split-pane.split-vertical {
        flex-direction: column;
      }

      .split-pane-first,
      .split-pane-second {
        overflow: hidden;
      }

      .split-splitter {
        background: #3e3e42;
        flex-shrink: 0;
        transition: background 0.2s;
      }

      .split-horizontal .split-splitter {
        width: 4px;
        cursor: col-resize;
      }

      .split-vertical .split-splitter {
        height: 4px;
        cursor: row-resize;
      }

      .split-splitter:hover {
        background: #4a9eff;
      }

      /* Prevent text selection during drag */
      body.dragging {
        user-select: none;
      }
    `;

    document.head.appendChild(style);
  }
}
