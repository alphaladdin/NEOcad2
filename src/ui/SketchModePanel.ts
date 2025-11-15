import { WallTypeManager } from '../framing/WallTypeManager';
import { WallType } from '../framing/WallType';
import { SketchMode } from '../tools/SketchMode';
import { EventBus, Events } from '../core/EventBus';

/**
 * UI Panel for controlling sketch mode settings and wall type selection
 */
export class SketchModePanel {
  private container: HTMLElement;
  private sketchMode: SketchMode;
  private wallTypeManager: WallTypeManager;
  private eventBus: EventBus;

  // UI Elements
  private wallTypeSelect: HTMLSelectElement | null = null;
  private gridToggle: HTMLInputElement | null = null;
  private orthoToggle: HTMLInputElement | null = null;
  private snapToggle: HTMLInputElement | null = null;
  private zoomSlider: HTMLInputElement | null = null;
  private wallCountDisplay: HTMLElement | null = null;

  constructor(
    sketchMode: SketchMode,
    wallTypeManager: WallTypeManager,
    eventBus: EventBus
  ) {
    this.sketchMode = sketchMode;
    this.wallTypeManager = wallTypeManager;
    this.eventBus = eventBus;

    this.container = this.createPanel();
    this.setupEventListeners();
  }

  /**
   * Create the panel UI
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'sketch-mode-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 280px;
      background: rgba(30, 30, 30, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 1001;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #ffffff;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Sketch Mode</h3>
        <button id="sketch-close-btn" style="
          background: none;
          border: none;
          color: #999;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
        Draw walls in 2D, see them in 3D instantly
      </p>
    `;
    panel.appendChild(header);

    // Wall Type Selector
    const wallTypeSection = this.createWallTypeSelector();
    panel.appendChild(wallTypeSection);

    // Drawing Options
    const optionsSection = this.createOptionsSection();
    panel.appendChild(optionsSection);

    // View Controls
    const viewSection = this.createViewSection();
    panel.appendChild(viewSection);

    // Stats
    const statsSection = this.createStatsSection();
    panel.appendChild(statsSection);

    // Actions
    const actionsSection = this.createActionsSection();
    panel.appendChild(actionsSection);

    // Keyboard Shortcuts
    const shortcutsSection = this.createShortcutsSection();
    panel.appendChild(shortcutsSection);

    return panel;
  }

  /**
   * Create wall type selector
   */
  private createWallTypeSelector(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const label = document.createElement('label');
    label.textContent = 'Wall Type';
    label.style.cssText = `
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #ccc;
    `;

    this.wallTypeSelect = document.createElement('select');
    this.wallTypeSelect.style.cssText = `
      width: 100%;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #ffffff;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    // Populate wall types
    const wallTypes = this.wallTypeManager.getAllWallTypes();
    wallTypes.forEach((wallType) => {
      const option = document.createElement('option');
      option.value = wallType.id;
      option.textContent = wallType.name;
      this.wallTypeSelect!.appendChild(option);
    });

    // Set initial value
    this.wallTypeSelect.value = this.sketchMode.getActiveWallType().id;

    section.appendChild(label);
    section.appendChild(this.wallTypeSelect);

    return section;
  }

  /**
   * Create drawing options section
   */
  private createOptionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('div');
    title.textContent = 'Drawing Options';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #ccc;
    `;
    section.appendChild(title);

    // Grid toggle
    const gridOption = this.createToggleOption(
      'Show Grid',
      'grid-toggle',
      true
    );
    this.gridToggle = gridOption.querySelector('input') as HTMLInputElement;
    section.appendChild(gridOption);

    // Snap to grid toggle
    const snapOption = this.createToggleOption(
      'Snap to Grid',
      'snap-toggle',
      true
    );
    this.snapToggle = snapOption.querySelector('input') as HTMLInputElement;
    section.appendChild(snapOption);

    // Orthogonal snap toggle
    const orthoOption = this.createToggleOption(
      'Orthogonal Snap',
      'ortho-toggle',
      true
    );
    this.orthoToggle = orthoOption.querySelector('input') as HTMLInputElement;
    section.appendChild(orthoOption);

    return section;
  }

  /**
   * Create a toggle option
   */
  private createToggleOption(
    label: string,
    id: string,
    defaultChecked: boolean
  ): HTMLElement {
    const option = document.createElement('div');
    option.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    `;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = id;
    labelEl.style.cssText = `
      font-size: 13px;
      color: #ddd;
      cursor: pointer;
    `;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = id;
    toggle.checked = defaultChecked;
    toggle.style.cssText = `
      width: 40px;
      height: 20px;
      cursor: pointer;
    `;

    option.appendChild(labelEl);
    option.appendChild(toggle);

    return option;
  }

  /**
   * Create view controls section
   */
  private createViewSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('div');
    title.textContent = 'View';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #ccc;
    `;
    section.appendChild(title);

    // Zoom control
    const zoomControl = document.createElement('div');
    zoomControl.style.cssText = `
      margin-bottom: 10px;
    `;

    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'Zoom';
    zoomLabel.style.cssText = `
      display: block;
      font-size: 12px;
      color: #999;
      margin-bottom: 6px;
    `;

    this.zoomSlider = document.createElement('input');
    this.zoomSlider.type = 'range';
    this.zoomSlider.min = '50';
    this.zoomSlider.max = '200';
    this.zoomSlider.value = '100';
    this.zoomSlider.style.cssText = `
      width: 100%;
      cursor: pointer;
    `;

    zoomControl.appendChild(zoomLabel);
    zoomControl.appendChild(this.zoomSlider);
    section.appendChild(zoomControl);

    // Reset view button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset View';
    resetBtn.style.cssText = `
      width: 100%;
      padding: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #ffffff;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    resetBtn.addEventListener('mouseenter', () => {
      resetBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    resetBtn.addEventListener('mouseleave', () => {
      resetBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    section.appendChild(resetBtn);

    return section;
  }

  /**
   * Create stats section
   */
  private createStatsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('div');
    title.textContent = 'Stats';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #ccc;
    `;
    section.appendChild(title);

    this.wallCountDisplay = document.createElement('div');
    this.wallCountDisplay.style.cssText = `
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #ddd;
    `;
    this.wallCountDisplay.innerHTML = `
      <span>Walls:</span>
      <span id="wall-count">0</span>
    `;
    section.appendChild(this.wallCountDisplay);

    return section;
  }

  /**
   * Create actions section
   */
  private createActionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('div');
    title.textContent = 'Actions';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #ccc;
    `;
    section.appendChild(title);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All Walls';
    clearBtn.id = 'sketch-clear-btn';
    clearBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      border: none;
      border-radius: 6px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.transform = 'translateY(-1px)';
      clearBtn.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
    });
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.transform = 'translateY(0)';
      clearBtn.style.boxShadow = 'none';
    });
    section.appendChild(clearBtn);

    return section;
  }

  /**
   * Create keyboard shortcuts section
   */
  private createShortcutsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 0;
    `;

    const title = document.createElement('div');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #ccc;
    `;
    section.appendChild(title);

    const shortcuts = [
      { key: 'Click', action: 'Place wall point' },
      { key: 'Shift + Drag', action: 'Pan view' },
      { key: 'Backspace', action: 'Remove last wall' },
      { key: 'C', action: 'Clear all walls' },
      { key: 'ESC', action: 'Exit sketch mode' },
    ];

    shortcuts.forEach((shortcut) => {
      const shortcutEl = document.createElement('div');
      shortcutEl.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 12px;
      `;
      shortcutEl.innerHTML = `
        <span style="color: #999;">${shortcut.key}</span>
        <span style="color: #ddd;">${shortcut.action}</span>
      `;
      section.appendChild(shortcutEl);
    });

    return section;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Wall type change
    this.wallTypeSelect?.addEventListener('change', () => {
      const wallTypeId = this.wallTypeSelect!.value;
      this.sketchMode.setWallType(wallTypeId);
    });

    // Drawing options
    this.gridToggle?.addEventListener('change', () => {
      // Update sketch mode grid visibility
      // Note: This would require adding a method to SketchMode
    });

    this.snapToggle?.addEventListener('change', () => {
      // Update sketch mode snap setting
      // Note: This would require adding a method to SketchMode
    });

    this.orthoToggle?.addEventListener('change', () => {
      // Update sketch mode ortho snap setting
      // Note: This would require adding a method to SketchMode
    });

    // Zoom
    this.zoomSlider?.addEventListener('input', () => {
      // Update sketch mode zoom
      // Note: This would require adding a method to SketchMode
    });

    // Clear button
    const clearBtn = this.container.querySelector('#sketch-clear-btn');
    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear all walls? This cannot be undone.')) {
        this.sketchMode.clearWalls();
        this.updateWallCount(0);
      }
    });

    // Close button
    const closeBtn = this.container.querySelector('#sketch-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.sketchMode.deactivate();
    });

    // Listen for sketch mode activation/deactivation
    this.eventBus.on(Events.SKETCH_MODE_ACTIVATED, () => {
      this.show();
    });

    this.eventBus.on(Events.SKETCH_MODE_DEACTIVATED, () => {
      this.hide();
    });

    // Listen for wall events
    this.eventBus.on(Events.SKETCH_WALL_ADDED, () => {
      this.updateWallCount();
    });

    this.eventBus.on(Events.SKETCH_WALL_REMOVED, () => {
      this.updateWallCount();
    });

    this.eventBus.on(Events.SKETCH_CLEARED, () => {
      this.updateWallCount(0);
    });
  }

  /**
   * Update wall count display
   */
  private updateWallCount(count?: number): void {
    const wallCountEl = this.container.querySelector('#wall-count');
    if (wallCountEl) {
      wallCountEl.textContent = count?.toString() || '0';
    }
  }

  /**
   * Show the panel
   */
  public show(): void {
    this.container.style.display = 'block';
  }

  /**
   * Hide the panel
   */
  public hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * Get the panel container element
   */
  public getContainer(): HTMLElement {
    return this.container;
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
