/**
 * NEOcad - The New Standard for Web-Based CAD/BIM
 * Main application class and singleton
 */

import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { logger, LogLevel } from '@utils/Logger';
import { eventBus, Events } from './EventBus';
import { stateManager } from './StateManager';
import { ViewportManager } from '@managers/ViewportManager';
import { UIManager } from '@managers/UIManager';
import { IFCLoader } from '@loaders/IFCLoader';
import { KeyboardManager } from '@managers/KeyboardManager';
import { ParameterEngine } from '@parametric/ParameterEngine';
import { getGeometryEngine } from '@parametric/GeometryEngineWrapper';
import { WallCreationTool } from '@tools/WallCreationTool';
import { DoorPlacementTool } from '@tools/DoorPlacementTool';
import { WindowPlacementTool } from '@tools/WindowPlacementTool';
import { SketchMode } from '@tools/SketchMode';
import { WallTypeManager } from '@framing/WallTypeManager';
import * as TWEEN from '@tweenjs/tween.js';

export interface NEOcadConfig {
  container: HTMLElement;
  logLevel?: LogLevel;
  autoInit?: boolean;
}

export class NEOcad {
  private static instance: NEOcad | null = null;

  // Core Fragments components
  public readonly components: OBC.Components;

  // Managers
  public viewportManager!: ViewportManager;
  public uiManager!: UIManager;
  public ifcLoader!: IFCLoader;
  public keyboardManager!: KeyboardManager;

  // Parametric system
  public parameterEngine!: ParameterEngine;
  public wallCreationTool!: WallCreationTool;
  public doorPlacementTool!: DoorPlacementTool;
  public windowPlacementTool!: WindowPlacementTool;
  public sketchMode!: SketchMode;

  // Configuration
  private config: NEOcadConfig;

  // Initialization state
  private _initialized = false;
  private _initializing = false;

  // Animation loop
  private animationFrameId: number | null = null;

  private constructor(config: NEOcadConfig) {
    this.config = config;
    this.components = new OBC.Components();

    logger.info('NEOcad', 'NEOcad instance created');

    if (config.logLevel !== undefined) {
      logger.setLogLevel(config.logLevel);
    }

    // Load saved state
    stateManager.load();
  }

  /**
   * Get the NEOcad singleton instance
   */
  static getInstance(): NEOcad | null {
    return NEOcad.instance;
  }

  /**
   * Create and initialize NEOcad
   */
  static async create(config: NEOcadConfig): Promise<NEOcad> {
    if (NEOcad.instance) {
      logger.warn('NEOcad', 'NEOcad instance already exists');
      return NEOcad.instance;
    }

    NEOcad.instance = new NEOcad(config);

    if (config.autoInit !== false) {
      await NEOcad.instance.init();
    }

    return NEOcad.instance;
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    if (this._initialized) {
      logger.warn('NEOcad', 'NEOcad already initialized');
      return;
    }

    if (this._initializing) {
      logger.warn('NEOcad', 'NEOcad initialization already in progress');
      return;
    }

    this._initializing = true;
    stateManager.set('loading', true);

    try {
      logger.info('NEOcad', 'Initializing NEOcad...');
      eventBus.emit(Events.APP_INIT);

      // Initialize Components
      this.components.init();
      logger.info('NEOcad', 'Components initialized');

      // Initialize Viewport Manager
      this.viewportManager = new ViewportManager(this.components);

      // Create primary viewport
      this.viewportManager.createViewport({
        container: this.config.container,
        enableGrid: true,
        enableShadows: false,
      });

      logger.info('NEOcad', 'Primary viewport created');

      // Initialize UI Manager
      this.uiManager = new UIManager();
      this.uiManager.setViewportManager(this.viewportManager);
      logger.info('NEOcad', 'UI Manager initialized');

      // Initialize IFC Loader
      this.ifcLoader = new IFCLoader(this.components);
      await this.ifcLoader.initialize();
      this.uiManager.setIFCLoader(this.ifcLoader);
      logger.info('NEOcad', 'IFC Loader initialized');

      // Initialize Keyboard Manager
      this.keyboardManager = new KeyboardManager();
      this.setupKeyboardShortcuts();
      logger.info('NEOcad', 'Keyboard Manager initialized');

      // Initialize Parametric System
      await this.initializeParametricSystem();
      logger.info('NEOcad', 'Parametric System initialized');

      // TODO: Initialize other managers
      // - ProjectManager
      // - ToolManager
      // - DataManager

      this._initialized = true;
      this._initializing = false;
      stateManager.set('initialized', true);
      stateManager.set('loading', false);

      // Start animation loop for TWEEN updates
      this.startAnimationLoop();

      logger.info('NEOcad', 'NEOcad initialized successfully');
      await eventBus.emit(Events.APP_READY);
    } catch (error) {
      this._initializing = false;
      stateManager.set('loading', false);
      logger.error('NEOcad', 'Failed to initialize NEOcad', error);
      eventBus.emit(Events.APP_ERROR, error);
      throw error;
    }
  }

  /**
   * Initialize the parametric modeling system
   */
  private async initializeParametricSystem(): Promise<void> {
    try {
      logger.info('NEOcad', 'Initializing parametric system...');

      // Create parameter engine
      this.parameterEngine = new ParameterEngine();

      // Get and initialize geometry engine
      const geometryEngine = getGeometryEngine();
      await geometryEngine.initialize({
        wasmPath: '/wasm/',
      });

      logger.info('NEOcad', 'GeometryEngine initialized successfully');

      // Create parametric design tools
      const viewport = this.viewportManager.getActiveViewport();
      if (viewport) {
        // Wall creation tool
        this.wallCreationTool = new WallCreationTool(
          viewport.world.scene.three as THREE.Scene,
          viewport.world.camera.three,
          this.parameterEngine,
          geometryEngine
        );

        // Door placement tool
        this.doorPlacementTool = new DoorPlacementTool(
          viewport.world.scene.three as THREE.Scene,
          viewport.world.camera.three,
          this.parameterEngine,
          geometryEngine
        );

        // Window placement tool
        this.windowPlacementTool = new WindowPlacementTool(
          viewport.world.scene.three as THREE.Scene,
          viewport.world.camera.three,
          this.parameterEngine,
          geometryEngine
        );

        // Sketch mode
        const wallTypeManager = WallTypeManager.getInstance();
        this.sketchMode = new SketchMode(
          viewport.world.scene.three as THREE.Scene,
          wallTypeManager,
          eventBus,
          {
            parameterEngine: this.parameterEngine,
            geometryEngine: geometryEngine,
          }
        );

        // Pass the tools to viewport and UIManager
        viewport.wallCreationTool = this.wallCreationTool;
        viewport.doorPlacementTool = this.doorPlacementTool;
        viewport.windowPlacementTool = this.windowPlacementTool;

        this.uiManager.setWallCreationTool(this.wallCreationTool);
        this.uiManager.setDoorPlacementTool(this.doorPlacementTool);
        this.uiManager.setWindowPlacementTool(this.windowPlacementTool);
        this.uiManager.setSketchMode(this.sketchMode);

        // Update door and window tools with walls whenever walls change
        this.setupWallsSync();

        logger.info('NEOcad', 'WallCreationTool initialized');
        logger.info('NEOcad', 'DoorPlacementTool initialized');
        logger.info('NEOcad', 'WindowPlacementTool initialized');
        logger.info('NEOcad', 'SketchMode initialized');
      }

      logger.info('NEOcad', 'Parametric system ready for use');
    } catch (error) {
      logger.error('NEOcad', 'Failed to initialize parametric system:', error);
      logger.warn('NEOcad', 'Parametric modeling features will not be available');
      // Don't throw - allow app to continue without parametric features
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    const viewport = this.viewportManager.getActiveViewport();

    // Delete - Hide selected elements
    this.keyboardManager.registerShortcut({
      key: 'delete',
      description: 'Hide selected elements',
      action: () => {
        if (viewport) {
          viewport.hideSelected();
        }
      },
    });

    // Escape - Clear selection
    this.keyboardManager.registerShortcut({
      key: 'escape',
      description: 'Clear selection',
      action: () => {
        if (viewport && viewport.highlighter) {
          viewport.highlighter.clearSelection();
        }
      },
    });

    // Ctrl+A - Select all visible elements
    this.keyboardManager.registerShortcut({
      key: 'a',
      ctrl: true,
      description: 'Select all visible elements',
      action: () => {
        // TODO: Implement select all
        logger.info('KeyboardManager', 'Select all - Not yet implemented');
      },
    });

    // F - Focus/Frame selected elements
    this.keyboardManager.registerShortcut({
      key: 'f',
      description: 'Focus on selected elements',
      action: () => {
        if (viewport) {
          viewport.focusSelected();
        }
      },
    });

    // H - Hide selected
    this.keyboardManager.registerShortcut({
      key: 'h',
      description: 'Hide selected elements',
      action: () => {
        if (viewport) {
          viewport.hideSelected();
        }
      },
    });

    // Shift+H - Show all
    this.keyboardManager.registerShortcut({
      key: 'h',
      shift: true,
      description: 'Show all elements',
      action: () => {
        if (viewport) {
          viewport.showAll();
        }
      },
    });

    // I - Isolate selected
    this.keyboardManager.registerShortcut({
      key: 'i',
      description: 'Isolate selected elements',
      action: () => {
        if (viewport) {
          viewport.isolateSelected();
        }
      },
    });

    // O - Orbit navigation mode
    this.keyboardManager.registerShortcut({
      key: 'o',
      description: 'Orbit navigation mode',
      action: () => {
        if (viewport) {
          viewport.setNavigationMode('Orbit');
        }
      },
    });

    // P - Plan navigation mode
    this.keyboardManager.registerShortcut({
      key: 'p',
      description: 'Plan navigation mode',
      action: () => {
        if (viewport) {
          viewport.setNavigationMode('Plan');
        }
      },
    });

    logger.debug('NEOcad', 'Keyboard shortcuts configured');
  }

  /**
   * Setup synchronization of walls to door/window placement tools
   */
  private setupWallsSync(): void {
    // Listen for wall creation/removal events and update door/window tools
    eventBus.on(Events.PARAMETRIC_ELEMENT_CREATED, (event: any) => {
      if (event.type === 'wall') {
        this.updateToolWalls();
      }
    });

    eventBus.on(Events.PARAMETRIC_ELEMENT_REMOVED, (event: any) => {
      if (event.type === 'wall') {
        this.updateToolWalls();
      }
    });

    // Initial update
    this.updateToolWalls();

    logger.debug('NEOcad', 'Walls sync configured for door and window tools');
  }

  /**
   * Update walls in door and window placement tools
   */
  private updateToolWalls(): void {
    if (this.wallCreationTool && this.doorPlacementTool && this.windowPlacementTool) {
      const walls = this.wallCreationTool.getWalls();
      this.doorPlacementTool.setWalls(walls);
      this.windowPlacementTool.setWalls(walls);
      logger.debug('NEOcad', `Updated tool walls: ${walls.length} walls available`);
    }
  }

  /**
   * Start animation loop for TWEEN updates
   */
  private startAnimationLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      TWEEN.update();
    };

    animate();
    logger.debug('NEOcad', 'Animation loop started');
  }

  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      logger.debug('NEOcad', 'Animation loop stopped');
    }
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    logger.info('NEOcad', 'Disposing NEOcad...');

    try {
      // Stop animation loop
      this.stopAnimationLoop();

      // Save state before disposing
      stateManager.save();

      // Dispose managers
      if (this.keyboardManager) {
        this.keyboardManager.dispose();
      }

      if (this.ifcLoader) {
        await this.ifcLoader.dispose();
      }

      if (this.uiManager) {
        this.uiManager.dispose();
      }

      if (this.viewportManager) {
        this.viewportManager.dispose();
      }

      // Dispose components
      await this.components.dispose();

      // Clear event listeners
      eventBus.clear();

      this._initialized = false;
      NEOcad.instance = null;

      logger.info('NEOcad', 'NEOcad disposed successfully');
    } catch (error) {
      logger.error('NEOcad', 'Error during disposal', error);
      throw error;
    }
  }

  /**
   * Check if NEOcad is initialized
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Check if NEOcad is initializing
   */
  get initializing(): boolean {
    return this._initializing;
  }

  /**
   * Get the container element
   */
  get container(): HTMLElement {
    return this.config.container;
  }
}

// Export convenience function
export async function createNEOcad(config: NEOcadConfig): Promise<NEOcad> {
  return NEOcad.create(config);
}
