/**
 * Panel - Base collapsible panel component for sidebars
 */

import { logger } from '@utils/Logger';

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  defaultCollapsed?: boolean;
  resizable?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

export class Panel {
  private config: PanelConfig;
  private container: HTMLElement;
  private headerElement: HTMLElement;
  private contentElement: HTMLElement;
  private toggleButton: HTMLButtonElement;
  private isCollapsed: boolean;
  private contentHeight: number = 300; // Default height

  constructor(config: PanelConfig) {
    this.config = config;
    this.isCollapsed = config.defaultCollapsed ?? false;

    this.container = this.createContainer();
    this.headerElement = this.createHeader();
    this.contentElement = this.createContent();
    this.toggleButton = this.createToggleButton();

    this.headerElement.appendChild(this.toggleButton);
    this.container.appendChild(this.headerElement);
    this.container.appendChild(this.contentElement);

    this.setupEventListeners();

    if (this.isCollapsed) {
      this.collapse(false); // Collapse without animation on init
    }

    logger.debug('Panel', `Panel created: ${config.id}`);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel';
    container.id = `panel-${this.config.id}`;
    container.setAttribute('data-panel-id', this.config.id);
    return container;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'panel-header';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'panel-title';

    if (this.config.icon) {
      const icon = document.createElement('span');
      icon.className = 'panel-icon';
      icon.innerHTML = this.config.icon;
      titleContainer.appendChild(icon);
    }

    const title = document.createElement('span');
    title.textContent = this.config.title;
    titleContainer.appendChild(title);

    header.appendChild(titleContainer);

    return header;
  }

  private createToggleButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'panel-toggle';
    button.setAttribute('aria-label', 'Toggle panel');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;
    return button;
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'panel-content';

    if (this.config.resizable) {
      content.style.height = `${this.contentHeight}px`;
    }

    return content;
  }

  private setupEventListeners(): void {
    // Toggle collapse on header click
    this.headerElement.addEventListener('click', () => {
      this.toggle();
    });

    // Resize handle if resizable
    if (this.config.resizable) {
      this.setupResize();
    }
  }

  private setupResize(): void {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'panel-resize-handle';
    this.container.appendChild(resizeHandle);

    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent header toggle

      startY = e.clientY;
      startHeight = this.contentElement.offsetHeight;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      this.container.classList.add('resizing');
    };

    const onMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      let newHeight = startHeight + deltaY;

      // Apply constraints
      if (this.config.minHeight) {
        newHeight = Math.max(newHeight, this.config.minHeight);
      }
      if (this.config.maxHeight) {
        newHeight = Math.min(newHeight, this.config.maxHeight);
      }

      this.contentHeight = newHeight;
      this.contentElement.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.container.classList.remove('resizing');
    };

    resizeHandle.addEventListener('mousedown', onMouseDown);
  }

  /**
   * Toggle panel collapsed state
   */
  toggle(): void {
    if (this.isCollapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Collapse panel
   */
  collapse(animate: boolean = true): void {
    this.isCollapsed = true;
    this.container.classList.add('collapsed');
    this.toggleButton.classList.add('collapsed');

    if (!animate) {
      this.contentElement.style.transition = 'none';
      this.contentElement.offsetHeight; // Force reflow
      this.contentElement.style.transition = '';
    }

    logger.debug('Panel', `Panel collapsed: ${this.config.id}`);
  }

  /**
   * Expand panel
   */
  expand(): void {
    this.isCollapsed = false;
    this.container.classList.remove('collapsed');
    this.toggleButton.classList.remove('collapsed');

    logger.debug('Panel', `Panel expanded: ${this.config.id}`);
  }

  /**
   * Set panel content
   */
  setContent(content: HTMLElement | string): void {
    if (typeof content === 'string') {
      this.contentElement.innerHTML = content;
    } else {
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(content);
    }
  }

  /**
   * Get the panel container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Get the content container element
   */
  getContentElement(): HTMLElement {
    return this.contentElement;
  }

  /**
   * Check if panel is collapsed
   */
  isCollapsedState(): boolean {
    return this.isCollapsed;
  }

  /**
   * Hide panel completely
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('Panel', `Panel hidden: ${this.config.id}`);
  }

  /**
   * Show panel
   */
  show(): void {
    this.container.style.display = '';
    logger.debug('Panel', `Panel shown: ${this.config.id}`);
  }

  /**
   * Dispose panel
   */
  dispose(): void {
    this.container.remove();
    logger.debug('Panel', `Panel disposed: ${this.config.id}`);
  }
}
