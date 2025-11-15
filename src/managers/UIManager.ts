/**
 * UIManager - Manages all UI components
 */

import { logger } from '@utils/Logger';
import { Toolbar, Icons } from '@ui/Toolbar';
import { StatusBar } from '@ui/StatusBar';
import { PropertiesPanel } from '@ui/PropertiesPanel';
import { IFCProjectPanel } from '@ui/IFCProjectPanel';
import { ObjectTreePanel } from '@ui/ObjectTreePanel';
import { LoadingIndicator } from '@ui/LoadingIndicator';
import { MeasurementPanel } from '@ui/MeasurementPanel';
import { ClippingPanel } from '@ui/ClippingPanel';
import { CameraPresetsPanel } from '@ui/CameraPresetsPanel';
import { ModelComparisonPanel } from '@ui/ModelComparisonPanel';
import { AnnotationPanel } from '@ui/AnnotationPanel';
import { FilterPanel } from '@ui/FilterPanel';
import { ClashDetectionPanel } from '@ui/ClashDetectionPanel';
import { WallTypePanel } from '@ui/WallTypePanel';
import { DesignToolbar } from '@ui/DesignToolbar';
import { PanelManager } from './PanelManager';
import { FilePicker } from '@utils/FilePicker';
import { eventBus, Events } from '@core/EventBus';
import { modeManager, type AppMode } from '@core/ModeManager';
import type { ViewportManager } from './ViewportManager';
import type { IFCLoader } from '@loaders/IFCLoader';
import type { WallCreationTool } from '@tools/WallCreationTool';
import type { DoorPlacementTool } from '@tools/DoorPlacementTool';
import type { WindowPlacementTool } from '@tools/WindowPlacementTool';
import type { SketchMode } from '@tools/SketchMode';

export class UIManager {
  public toolbar: Toolbar;
  public statusBar: StatusBar;
  public panelManager: PanelManager;
  public propertiesPanel: PropertiesPanel;
  public ifcProjectPanel: IFCProjectPanel;
  public objectTreePanel: ObjectTreePanel;
  public measurementPanel: MeasurementPanel;
  public clippingPanel: ClippingPanel;
  public cameraPresetsPanel: CameraPresetsPanel;
  public modelComparisonPanel: ModelComparisonPanel;
  public annotationPanel: AnnotationPanel;
  public filterPanel: FilterPanel;
  public clashDetectionPanel: ClashDetectionPanel;
  public wallTypePanel: WallTypePanel;
  public designToolbar: DesignToolbar;
  private loadingIndicator: LoadingIndicator;
  private viewportManager: ViewportManager | null = null;
  private ifcLoader: IFCLoader | null = null;
  private wallCreationTool: WallCreationTool | null = null;
  private doorPlacementTool: DoorPlacementTool | null = null;
  private windowPlacementTool: WindowPlacementTool | null = null;
  private sketchMode: SketchMode | null = null;
  private modeToggleButton: HTMLButtonElement | null = null;

  constructor() {
    this.toolbar = new Toolbar();
    this.statusBar = new StatusBar();
    this.panelManager = new PanelManager();
    this.loadingIndicator = new LoadingIndicator({ showProgress: true });

    // Initialize panels
    this.objectTreePanel = new ObjectTreePanel();
    this.panelManager.registerPanel('object-tree', this.objectTreePanel, 'left');

    this.propertiesPanel = new PropertiesPanel();
    this.panelManager.registerPanel('properties', this.propertiesPanel, 'right');

    this.ifcProjectPanel = new IFCProjectPanel();
    this.panelManager.registerPanel('ifc-project', this.ifcProjectPanel, 'right');

    this.measurementPanel = new MeasurementPanel();
    // Measurement panel is not registered with panel manager as it's standalone

    this.clippingPanel = new ClippingPanel();
    // Clipping panel is not registered with panel manager as it's standalone

    this.cameraPresetsPanel = new CameraPresetsPanel();
    // Camera presets panel is not registered with panel manager as it's standalone

    this.modelComparisonPanel = new ModelComparisonPanel();
    // Model comparison panel is not registered with panel manager as it's standalone

    this.annotationPanel = new AnnotationPanel();
    // Annotation panel is not registered with panel manager as it's standalone

    this.filterPanel = new FilterPanel();
    // Filter panel is not registered with panel manager as it's standalone

    this.clashDetectionPanel = new ClashDetectionPanel();
    // Clash detection panel is not registered with panel manager as it's standalone

    this.wallTypePanel = new WallTypePanel();
    this.panelManager.registerPanel('wall-types', this.wallTypePanel, 'right');

    // Create design toolbar container
    let designToolbarContainer = document.getElementById('design-toolbar-container');
    if (!designToolbarContainer) {
      designToolbarContainer = document.createElement('div');
      designToolbarContainer.id = 'design-toolbar-container';
      document.body.appendChild(designToolbarContainer);
    }
    this.designToolbar = new DesignToolbar(designToolbarContainer);

    this.setupToolbar();
    this.setupModeToggle();
    this.setupEventListeners();

    // Apply mode after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.applyMode(modeManager.getCurrentMode());
    }, 0);

    logger.info('UIManager', 'UIManager initialized');
  }

  /**
   * Set the viewport manager reference
   */
  setViewportManager(viewportManager: ViewportManager): void {
    this.viewportManager = viewportManager;
    logger.debug('UIManager', 'ViewportManager reference set');
  }

  /**
   * Set the IFC loader reference
   */
  setIFCLoader(ifcLoader: IFCLoader): void {
    this.ifcLoader = ifcLoader;
    logger.debug('UIManager', 'IFCLoader reference set');
  }

  /**
   * Set the wall creation tool reference
   */
  setWallCreationTool(wallCreationTool: WallCreationTool): void {
    this.wallCreationTool = wallCreationTool;
    this.wallTypePanel.setWallCreationTool(wallCreationTool);
    logger.debug('UIManager', 'WallCreationTool reference set');
  }

  /**
   * Set the door placement tool reference
   */
  setDoorPlacementTool(doorPlacementTool: DoorPlacementTool): void {
    this.doorPlacementTool = doorPlacementTool;
    logger.debug('UIManager', 'DoorPlacementTool reference set');
  }

  /**
   * Set the window placement tool reference
   */
  setWindowPlacementTool(windowPlacementTool: WindowPlacementTool): void {
    this.windowPlacementTool = windowPlacementTool;
    logger.debug('UIManager', 'WindowPlacementTool reference set');
  }

  /**
   * Set the sketch mode reference
   */
  setSketchMode(sketchMode: SketchMode): void {
    this.sketchMode = sketchMode;
    logger.debug('UIManager', 'SketchMode reference set');
  }

  private setupToolbar(): void {
    // File group
    this.toolbar.addGroup('file', 'File');

    this.toolbar.addButton({
      id: 'open',
      label: 'Open',
      tooltip: 'Open Model (Ctrl+O)',
      icon: Icons.open,
      action: () => this.onOpenModel(),
      group: 'file',
    });

    this.toolbar.addButton({
      id: 'save',
      label: 'Save',
      tooltip: 'Save Model (Ctrl+S)',
      icon: Icons.save,
      action: () => this.onSaveModel(),
      group: 'file',
    });

    // Edit group
    this.toolbar.addGroup('edit', 'Edit');

    this.toolbar.addButton({
      id: 'undo',
      label: 'Undo',
      tooltip: 'Undo (Ctrl+Z)',
      icon: Icons.undo,
      action: () => this.onUndo(),
      group: 'edit',
      disabled: true,
    });

    this.toolbar.addButton({
      id: 'redo',
      label: 'Redo',
      tooltip: 'Redo (Ctrl+Y)',
      icon: Icons.redo,
      action: () => this.onRedo(),
      group: 'edit',
      disabled: true,
    });

    // Tools group
    this.toolbar.addGroup('tools', 'Tools');

    this.toolbar.addButton({
      id: 'select',
      label: 'Select',
      tooltip: 'Select Tool (V)',
      icon: Icons.select,
      action: () => this.onSelectTool(),
      group: 'tools',
      active: true,
    });

    this.toolbar.addButton({
      id: 'move',
      label: 'Move',
      tooltip: 'Move Tool (M)',
      icon: Icons.move,
      action: () => this.onMoveTool(),
      group: 'tools',
    });

    this.toolbar.addButton({
      id: 'rotate',
      label: 'Rotate',
      tooltip: 'Rotate Tool (R)',
      icon: Icons.rotate,
      action: () => this.onRotateTool(),
      group: 'tools',
    });

    this.toolbar.addButton({
      id: 'measure',
      label: 'Measure',
      tooltip: 'Measure Tool (D)',
      icon: Icons.measure,
      action: () => this.onMeasureTool(),
      group: 'tools',
    });

    this.toolbar.addButton({
      id: 'section',
      label: 'Section',
      tooltip: 'Section Planes (C)',
      icon: Icons.section,
      action: () => this.onSectionTool(),
      group: 'tools',
    });

    this.toolbar.addButton({
      id: 'draw-wall',
      label: 'Draw Wall',
      tooltip: 'Draw Parametric Wall (W)',
      icon: Icons.wall || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
      action: () => this.onDrawWall(),
      group: 'tools',
    });

    this.toolbar.addButton({
      id: 'wall-types',
      label: 'Wall Types',
      tooltip: 'Wall Type Library (T)',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>',
      action: () => this.onWallTypes(),
      group: 'tools',
    });

    // View group
    this.toolbar.addGroup('view', 'View');

    this.toolbar.addButton({
      id: 'view-orbit',
      label: 'Orbit',
      tooltip: 'Orbit View (O)',
      icon: Icons.viewOrbit,
      action: () => this.onViewOrbit(),
      group: 'view',
      active: true,
    });

    this.toolbar.addButton({
      id: 'view-plan',
      label: 'Plan',
      tooltip: 'Plan View (P)',
      icon: Icons.viewPlan,
      action: () => this.onViewPlan(),
      group: 'view',
    });

    this.toolbar.addButton({
      id: 'camera-presets',
      label: 'Views',
      tooltip: 'Camera Views',
      icon: Icons.cameraPresets,
      action: () => this.onCameraPresets(),
      group: 'view',
    });

    this.toolbar.addButton({
      id: 'model-comparison',
      label: 'Compare',
      tooltip: 'Model Comparison (B)',
      icon: Icons.compare,
      action: () => this.onModelComparison(),
      group: 'view',
    });

    this.toolbar.addButton({
      id: 'annotations',
      label: 'Annotate',
      tooltip: 'Annotations (N)',
      icon: Icons.annotate,
      action: () => this.onAnnotations(),
      group: 'view',
    });

    this.toolbar.addButton({
      id: 'filter',
      label: 'Filter',
      tooltip: 'Advanced Filters (F)',
      icon: Icons.filter,
      action: () => this.onFilter(),
      group: 'view',
    });

    this.toolbar.addButton({
      id: 'clash-detection',
      label: 'Clashes',
      tooltip: 'Clash Detection (X)',
      icon: Icons.clash || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></svg>',
      action: () => this.onClashDetection(),
      group: 'view',
    });

    // Visibility group
    this.toolbar.addGroup('visibility', 'Visibility');

    this.toolbar.addButton({
      id: 'isolate',
      label: 'Isolate',
      tooltip: 'Isolate Selected (I)',
      icon: Icons.isolate,
      action: () => this.onIsolateSelected(),
      group: 'visibility',
    });

    this.toolbar.addButton({
      id: 'hide',
      label: 'Hide',
      tooltip: 'Hide Selected (H)',
      icon: Icons.hide,
      action: () => this.onHideSelected(),
      group: 'visibility',
    });

    this.toolbar.addButton({
      id: 'show-all',
      label: 'Show All',
      tooltip: 'Show All Elements (Shift+H)',
      icon: Icons.showAll,
      action: () => this.onShowAll(),
      group: 'visibility',
    });

    // Spacer
    this.toolbar.addSpacer();

    // Settings button
    this.toolbar.addButton({
      id: 'settings',
      label: 'Settings',
      tooltip: 'Settings',
      icon: Icons.settings,
      action: () => this.onSettings(),
    });

    // Parametric Test button
    this.toolbar.addButton({
      id: 'parametric-test',
      label: 'Test Parametric',
      tooltip: 'Run Parametric System Tests',
      icon: Icons.test || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      action: () => this.onParametricTest(),
    });

    logger.debug('UIManager', 'Toolbar configured');
  }

  private setupModeToggle(): void {
    // Create mode toggle button and insert it after the save button
    this.modeToggleButton = document.createElement('button');
    this.modeToggleButton.className = 'mode-toggle-button';
    this.modeToggleButton.title = 'Toggle between Design and BIM Mode';

    this.updateModeToggleButton(modeManager.getCurrentMode());

    this.modeToggleButton.addEventListener('click', () => {
      modeManager.toggleMode();
    });

    // Insert after the save button in the toolbar
    const saveButton = document.querySelector('#toolbar button[data-id="save"]');
    if (saveButton && saveButton.parentElement) {
      saveButton.parentElement.insertBefore(
        this.modeToggleButton,
        saveButton.nextSibling
      );
    }

    logger.debug('UIManager', 'Mode toggle button created');
  }

  private updateModeToggleButton(mode: AppMode): void {
    if (!this.modeToggleButton) return;

    const icon = mode === 'design' ? '🎨' : '🏗️';
    const label = mode === 'design' ? 'DESIGN' : 'BIM';

    this.modeToggleButton.innerHTML = `
      <span class="mode-icon">${icon}</span>
      <span class="mode-label">${label}</span>
    `;
  }

  private applyMode(mode: AppMode): void {
    // Set data attribute on body for CSS styling
    document.body.setAttribute('data-mode', mode);

    if (mode === 'design') {
      // Design Mode: Show design toolbar, hide BIM panels
      this.designToolbar.show();
      this.panelManager.hideAllPanels();
    } else {
      // BIM Mode: Hide design toolbar, show BIM panels
      this.designToolbar.hide();
      // Panels will be shown on demand
    }

    logger.info('UIManager', `Applied ${mode} mode`);
  }

  private setupEventListeners(): void {
    // Listen to selection events to update statusbar
    eventBus.on(Events.OBJECT_SELECTED, () => {
      // Will be implemented with proper selection tracking
    });

    eventBus.on(Events.OBJECT_DESELECTED, () => {
      // Will be implemented with proper selection tracking
    });

    // Listen to mode change events
    eventBus.on('app:mode:changed', (event: any) => {
      this.updateModeToggleButton(event.currentMode);
      this.applyMode(event.currentMode);
      logger.info('UIManager', `Mode switched to: ${event.currentMode}`);
    });

    // Listen to ortho snap toggle events
    eventBus.on('design:ortho-snap-changed', (event: any) => {
      if (this.wallCreationTool) {
        this.wallCreationTool.setOrthoSnap(event.enabled);
        logger.info('UIManager', `Ortho snap ${event.enabled ? 'enabled' : 'disabled'} for wall creation tool`);
      }
    });

    // Listen to tool activation events from DesignToolbar
    eventBus.on(Events.TOOL_ACTIVATED, (event: any) => {
      if (event.mode === 'design') {
        this.handleDesignToolActivation(event.tool);
      }
    });
  }

  /**
   * Handle design tool activation from DesignToolbar
   */
  private handleDesignToolActivation(toolId: string): void {
    // Deactivate all parametric tools first
    this.deactivateAllParametricTools();

    // Activate the selected tool
    switch (toolId) {
      case 'sketch':
        this.onActivateSketchMode();
        break;

      case 'wall':
        this.onDrawWall();
        break;

      case 'door':
        this.onPlaceDoor();
        break;

      case 'window':
        this.onPlaceWindow();
        break;

      case 'room':
        // TODO: Implement room tool
        logger.info('UIManager', 'Room tool not yet implemented');
        break;

      case 'railing':
        // TODO: Implement railing tool
        logger.info('UIManager', 'Railing tool not yet implemented');
        break;

      default:
        logger.warn('UIManager', `Unknown design tool: ${toolId}`);
    }
  }

  /**
   * Deactivate all parametric design tools
   */
  private deactivateAllParametricTools(): void {
    if (this.wallCreationTool) {
      this.wallCreationTool.deactivate();
    }
    if (this.doorPlacementTool) {
      this.doorPlacementTool.deactivate();
    }
    if (this.windowPlacementTool) {
      this.windowPlacementTool.deactivate();
    }
    if (this.sketchMode) {
      this.sketchMode.deactivate();
    }
  }

  // Tool actions
  private async onOpenModel(): Promise<void> {
    logger.info('UIManager', 'Open model clicked');

    if (!this.ifcLoader) {
      logger.error('UIManager', 'IFC Loader not initialized');
      return;
    }

    try {
      // Open file picker
      const file = await FilePicker.pickIFCFile();
      if (!file) {
        logger.info('UIManager', 'No file selected');
        return;
      }

      // Show loading indicator
      this.loadingIndicator.show(`Loading ${file.name}...`);
      this.loadingIndicator.setProgress(0);

      // Listen to progress events
      const progressHandler = (progress: any) => {
        this.loadingIndicator.setProgress(progress.percentage);
        this.loadingIndicator.setMessage(`Loading ${file.name}: ${progress.stage}...`);
      };
      eventBus.on(Events.MODEL_LOAD_PROGRESS, progressHandler);

      // Load the IFC file
      const result = await this.ifcLoader.loadIFCFile(file);

      // Remove progress listener
      eventBus.off(Events.MODEL_LOAD_PROGRESS, progressHandler);

      // Hide loading indicator
      this.loadingIndicator.hide();

      logger.info('UIManager', `Model loaded successfully: ${result.fileName}`);
    } catch (error) {
      this.loadingIndicator.hide();
      logger.error('UIManager', `Failed to load model: ${error}`);
      // TODO: Show error dialog
    }
  }

  private onSaveModel(): void {
    logger.info('UIManager', 'Save model clicked');
    // TODO: Implement save dialog
  }

  private onUndo(): void {
    logger.info('UIManager', 'Undo clicked');
    // TODO: Implement undo
  }

  private onRedo(): void {
    logger.info('UIManager', 'Redo clicked');
    // TODO: Implement redo
  }

  private onSelectTool(): void {
    logger.info('UIManager', 'Select tool activated');
    this.setActiveTool('select');
  }

  private onMoveTool(): void {
    logger.info('UIManager', 'Move tool activated');
    this.setActiveTool('move');
  }

  private onRotateTool(): void {
    logger.info('UIManager', 'Rotate tool activated');
    this.setActiveTool('rotate');
  }

  private onMeasureTool(): void {
    logger.info('UIManager', 'Measure tool activated');
    this.setActiveTool('measure');

    // Toggle measurement panel
    this.measurementPanel.toggle();

    // Connect measurement manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.measurementManager) {
        this.measurementPanel.setMeasurementManager(viewport.measurementManager);
      }
    }
  }

  private onSectionTool(): void {
    logger.info('UIManager', 'Section tool activated');
    this.setActiveTool('section');

    // Toggle clipping panel
    this.clippingPanel.toggle();

    // Connect clipping manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.clippingManager) {
        this.clippingPanel.setClippingManager(viewport.clippingManager);
      }
    }
  }

  private onViewOrbit(): void {
    logger.info('UIManager', 'Orbit view activated');
    this.setActiveView('view-orbit');

    // Set navigation mode on active viewport
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport) {
        viewport.setNavigationMode('Orbit');
      }
    }
  }

  private onViewPlan(): void {
    logger.info('UIManager', 'Plan view activated');
    this.setActiveView('view-plan');

    // Set navigation mode on active viewport
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport) {
        viewport.setNavigationMode('Plan');
      }
    }
  }

  private onCameraPresets(): void {
    logger.info('UIManager', 'Camera presets activated');

    // Toggle camera presets panel
    this.cameraPresetsPanel.toggle();

    // Connect camera preset manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.cameraPresetManager) {
        this.cameraPresetsPanel.setPresetManager(viewport.cameraPresetManager);
      }
    }
  }

  private onModelComparison(): void {
    logger.info('UIManager', 'Model comparison activated');

    // Toggle model comparison panel
    this.modelComparisonPanel.toggle();

    // Connect model comparison manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.modelComparisonManager) {
        this.modelComparisonPanel.setComparisonManager(viewport.modelComparisonManager);
      }
    }
  }

  private onAnnotations(): void {
    logger.info('UIManager', 'Annotations activated');

    // Toggle annotation panel
    this.annotationPanel.toggle();

    // Connect annotation manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.annotationManager) {
        this.annotationPanel.setAnnotationManager(viewport.annotationManager);
      }
    }
  }

  private onFilter(): void {
    logger.info('UIManager', 'Filter activated');

    // Toggle filter panel
    this.filterPanel.toggle();

    // Connect filter manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.filterManager) {
        this.filterPanel.setFilterManager(viewport.filterManager);
      }
    }
  }

  private onClashDetection(): void {
    logger.info('UIManager', 'Clash detection activated');

    // Toggle clash detection panel
    this.clashDetectionPanel.toggle();

    // Connect clash detection manager if not already connected
    if (this.viewportManager) {
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport && viewport.clashDetectionManager) {
        this.clashDetectionPanel.setClashDetectionManager(viewport.clashDetectionManager);
      }
    }
  }

  private onSettings(): void {
    logger.info('UIManager', 'Settings clicked');
    // TODO: Implement settings panel
  }

  private async onParametricTest(): Promise<void> {
    logger.info('UIManager', 'Running parametric system tests...');

    try {
      // Import test functions dynamically
      const { runAllParametricTests } = await import('@parametric/parametric-test');

      // Run all tests
      runAllParametricTests();

      logger.info('UIManager', 'Parametric tests complete! Check console for results.');
    } catch (error) {
      logger.error('UIManager', 'Failed to run parametric tests:', error);
    }
  }

  private onActivateSketchMode(): void {
    logger.info('UIManager', 'Sketch Mode activated');

    if (!this.sketchMode) {
      logger.error('UIManager', 'SketchMode not initialized');
      return;
    }

    // Deactivate other tools
    this.deactivateAllParametricTools();

    // Activate sketch mode
    this.sketchMode.activate();

    // Set the active tool button
    this.setActiveTool('sketch');
  }

  private onDrawWall(): void {
    logger.info('UIManager', 'Draw Wall tool activated');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    if (!this.wallCreationTool) {
      logger.error('UIManager', 'WallCreationTool not initialized');
      return;
    }

    // Deactivate other tools
    this.deactivateAllParametricTools();

    // Activate the wall creation tool
    this.wallCreationTool.activate();

    // Set the active tool button
    this.setActiveTool('draw-wall');
  }

  private onPlaceDoor(): void {
    logger.info('UIManager', 'Place Door tool activated');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    if (!this.doorPlacementTool) {
      logger.error('UIManager', 'DoorPlacementTool not initialized');
      return;
    }

    // Deactivate other tools
    this.deactivateAllParametricTools();

    // Activate the door placement tool
    this.doorPlacementTool.activate();

    logger.info('UIManager', 'Door placement tool activated');
  }

  private onPlaceWindow(): void {
    logger.info('UIManager', 'Place Window tool activated');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    if (!this.windowPlacementTool) {
      logger.error('UIManager', 'WindowPlacementTool not initialized');
      return;
    }

    // Deactivate other tools
    this.deactivateAllParametricTools();

    // Activate the window placement tool
    this.windowPlacementTool.activate();

    logger.info('UIManager', 'Window placement tool activated');
  }

  private onWallTypes(): void {
    logger.info('UIManager', 'Wall Types panel toggled');

    // Toggle the wall types panel visibility
    this.panelManager.togglePanel('wall-types');
  }

  private onIsolateSelected(): void {
    logger.info('UIManager', 'Isolate selected clicked');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    const viewport = this.viewportManager.getActiveViewport();
    if (viewport) {
      viewport.isolateSelected();
    }
  }

  private onHideSelected(): void {
    logger.info('UIManager', 'Hide selected clicked');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    const viewport = this.viewportManager.getActiveViewport();
    if (viewport) {
      viewport.hideSelected();
    }
  }

  private onShowAll(): void {
    logger.info('UIManager', 'Show all clicked');

    if (!this.viewportManager) {
      logger.error('UIManager', 'ViewportManager not initialized');
      return;
    }

    const viewport = this.viewportManager.getActiveViewport();
    if (viewport) {
      viewport.showAll();
    }
  }

  private setActiveTool(toolId: string): void {
    // Deactivate all tools in the tools group
    ['select', 'move', 'rotate', 'measure'].forEach((id) => {
      this.toolbar.setActive(id, id === toolId);
    });
  }

  private setActiveView(viewId: string): void {
    // Deactivate all views in the view group
    ['view-orbit', 'view-plan'].forEach((id) => {
      this.toolbar.setActive(id, id === viewId);
    });
  }

  /**
   * Dispose UI manager
   */
  dispose(): void {
    this.toolbar.dispose();
    this.statusBar.dispose();
    this.panelManager.dispose();
    logger.info('UIManager', 'UIManager disposed');
  }
}
