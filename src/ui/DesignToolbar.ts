/**
 * DesignToolbar - Narrow left sidebar for Design Mode
 * Contains drawing tools: Room, Wall, Door, Window, Railing
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface DesignTool {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
}

/**
 * DesignToolbar class
 */
export class DesignToolbar {
  private container: HTMLElement;
  private tools: DesignTool[] = [];
  private activeTool: string | null = null;
  private toolButtons: Map<string, HTMLButtonElement> = new Map();
  private orthoSnapEnabled: boolean = true;
  private orthoSnapToggle: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initializeTools();
    this.render();
  }

  /**
   * Initialize drawing tools
   */
  private initializeTools(): void {
    this.tools = [
      {
        id: 'sketch',
        name: 'Sketch',
        icon: '✏️',
        description: 'Quick sketch-to-3D mode',
        isActive: false,
      },
      {
        id: 'room',
        name: 'Room',
        icon: '⬜',
        description: 'Draw rooms and spaces',
        isActive: false,
      },
      {
        id: 'wall',
        name: 'Wall',
        icon: '┃',
        description: 'Draw walls',
        isActive: false,
      },
      {
        id: 'door',
        name: 'Door',
        icon: '🚪',
        description: 'Place doors',
        isActive: false,
      },
      {
        id: 'window',
        name: 'Window',
        icon: '🪟',
        description: 'Place windows',
        isActive: false,
      },
      {
        id: 'railing',
        name: 'Railing',
        icon: '═',
        description: 'Draw railings',
        isActive: false,
      },
    ];
  }

  /**
   * Render the toolbar
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'design-toolbar';

    // Create toolbar header
    const header = document.createElement('div');
    header.className = 'design-toolbar-header';
    header.innerHTML = `
      <h3>Drawing Tools</h3>
    `;
    this.container.appendChild(header);

    // Create tools list
    const toolsList = document.createElement('div');
    toolsList.className = 'design-toolbar-tools';

    this.tools.forEach((tool) => {
      const toolButton = this.createToolButton(tool);
      this.toolButtons.set(tool.id, toolButton);
      toolsList.appendChild(toolButton);
    });

    this.container.appendChild(toolsList);

    // Create settings section at bottom
    const settingsSection = document.createElement('div');
    settingsSection.className = 'design-toolbar-settings';

    // Add ortho snap toggle
    this.orthoSnapToggle = this.createOrthoSnapToggle();
    settingsSection.appendChild(this.orthoSnapToggle);

    this.container.appendChild(settingsSection);

    logger.debug('DesignToolbar', 'Toolbar rendered');
  }

  /**
   * Create a tool button
   */
  private createToolButton(tool: DesignTool): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'design-tool-button';
    button.dataset.toolId = tool.id;
    button.title = tool.description;

    button.innerHTML = `
      <span class="tool-icon">${tool.icon}</span>
      <span class="tool-name">${tool.name}</span>
    `;

    button.addEventListener('click', () => {
      this.selectTool(tool.id);
    });

    return button;
  }

  /**
   * Create ortho snap toggle button
   */
  private createOrthoSnapToggle(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'design-setting-toggle';
    button.title = 'Toggle orthogonal snap (constrains walls to 0°, 90°, 180°, 270°)';

    this.updateOrthoSnapButton(button);

    button.addEventListener('click', () => {
      this.orthoSnapEnabled = !this.orthoSnapEnabled;
      this.updateOrthoSnapButton(button);

      // Emit event to update wall creation tool
      eventBus.emit('design:ortho-snap-changed', {
        enabled: this.orthoSnapEnabled,
      });

      logger.info('DesignToolbar', `Ortho snap ${this.orthoSnapEnabled ? 'enabled' : 'disabled'}`);
    });

    return button;
  }

  /**
   * Update ortho snap button appearance
   */
  private updateOrthoSnapButton(button: HTMLButtonElement): void {
    if (this.orthoSnapEnabled) {
      button.classList.add('active');
      button.innerHTML = `
        <span class="setting-icon">⊞</span>
        <span class="setting-name">Ortho ON</span>
      `;
    } else {
      button.classList.remove('active');
      button.innerHTML = `
        <span class="setting-icon">⊟</span>
        <span class="setting-name">Ortho OFF</span>
      `;
    }
  }

  /**
   * Select a tool
   */
  selectTool(toolId: string): void {
    // Deactivate current tool
    if (this.activeTool) {
      const currentTool = this.tools.find((t) => t.id === this.activeTool);
      if (currentTool) {
        currentTool.isActive = false;
        const currentButton = this.toolButtons.get(this.activeTool);
        if (currentButton) {
          currentButton.classList.remove('active');
        }
      }
    }

    // Activate new tool
    const newTool = this.tools.find((t) => t.id === toolId);
    if (newTool) {
      newTool.isActive = true;
      this.activeTool = toolId;

      const newButton = this.toolButtons.get(toolId);
      if (newButton) {
        newButton.classList.add('active');
      }

      // Emit tool activated event
      eventBus.emit(Events.TOOL_ACTIVATED, {
        tool: toolId,
        mode: 'design',
      });

      logger.info('DesignToolbar', `Tool selected: ${toolId}`);
    }
  }

  /**
   * Deselect current tool
   */
  deselectTool(): void {
    if (this.activeTool) {
      const currentTool = this.tools.find((t) => t.id === this.activeTool);
      if (currentTool) {
        currentTool.isActive = false;
        const currentButton = this.toolButtons.get(this.activeTool);
        if (currentButton) {
          currentButton.classList.remove('active');
        }

        eventBus.emit(Events.TOOL_DEACTIVATED, {
          tool: this.activeTool,
          mode: 'design',
        });
      }

      this.activeTool = null;
      logger.info('DesignToolbar', 'Tool deselected');
    }
  }

  /**
   * Get active tool
   */
  getActiveTool(): string | null {
    return this.activeTool;
  }

  /**
   * Show toolbar
   */
  show(): void {
    this.container.style.display = 'flex';
    logger.debug('DesignToolbar', 'Toolbar shown');
  }

  /**
   * Hide toolbar
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('DesignToolbar', 'Toolbar hidden');
  }

  /**
   * Destroy toolbar
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.toolButtons.clear();
    logger.info('DesignToolbar', 'Toolbar destroyed');
  }
}
