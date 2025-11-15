/**
 * IFCLoader - Loads and processes IFC files using That Open Company's Fragments
 */

import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface IFCLoadResult {
  model: FRAGS.FragmentsModel;
  modelID: string;
  fileName: string;
}

export interface IFCLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: 'reading' | 'parsing' | 'geometry' | 'properties' | 'complete';
}

export class IFCLoader {
  private components: OBC.Components;
  private fragmentsManager: OBC.FragmentsManager;
  private ifcLoader: OBC.IfcLoader;
  private loadedModels: Map<string, FRAGS.FragmentsModel> = new Map();
  private isReady: boolean = false;

  constructor(components: OBC.Components) {
    this.components = components;

    // Get or create FragmentsManager
    try {
      this.fragmentsManager = components.get(OBC.FragmentsManager);
    } catch {
      // If FragmentsManager doesn't exist, create it
      this.fragmentsManager = new OBC.FragmentsManager(components);
    }

    // Get or create IFC Loader
    try {
      this.ifcLoader = components.get(OBC.IfcLoader);
    } catch {
      // If IfcLoader doesn't exist, create it
      this.ifcLoader = new OBC.IfcLoader(components);
    }

    // Setup will be called separately
    logger.debug('IFCLoader', 'IFCLoader created');
  }

  /**
   * Initialize the IFC loader (must be called before loading files)
   */
  async initialize(): Promise<void> {
    if (this.isReady) return;

    await this.setupIFCLoader();
    this.isReady = true;

    logger.info('IFCLoader', 'IFCLoader initialized');
  }

  private async setupIFCLoader(): Promise<void> {
    try {
      // Initialize FragmentsManager with worker URL
      logger.debug('IFCLoader', 'Initializing FragmentsManager...');

      // Use the local worker file from public directory
      const workerUrl = '/worker.mjs';
      logger.debug('IFCLoader', 'Using local worker from:', workerUrl);

      this.fragmentsManager.init(workerUrl);
      logger.debug('IFCLoader', 'FragmentsManager initialized');

      // Configure IFC loader settings
      logger.debug('IFCLoader', 'Setting up IfcLoader...');
      await this.ifcLoader.setup({
        autoSetWasm: false,
        wasm: {
          path: '/wasm/',
          absolute: false,
        },
      });

      // Enable geometry optimization
      this.ifcLoader.settings.webIfc.OPTIMIZE_PROFILES = true;
      this.ifcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

      logger.debug('IFCLoader', 'IFC Loader configured');
    } catch (error) {
      logger.error('IFCLoader', 'Failed to setup IFC loader', error);
      throw error;
    }
  }

  /**
   * Load IFC file from File object
   */
  async loadIFCFile(file: File): Promise<IFCLoadResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    logger.info('IFCLoader', `Loading IFC file: ${file.name}`);

    try {
      // Read file as buffer
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Emit progress: reading
      this.emitProgress({
        loaded: 0,
        total: 100,
        percentage: 0,
        stage: 'reading',
      });

      // Load IFC model
      // The load method requires: data, coordinate (for origin), and filename
      const model = await this.ifcLoader.load(
        data,
        true, // coordinate to origin
        file.name
      );

      // Emit progress: complete
      this.emitProgress({
        loaded: 100,
        total: 100,
        percentage: 100,
        stage: 'complete',
      });

      // Store model
      const modelID = model.uuid;
      this.loadedModels.set(modelID, model);

      // Note: The IfcLoader automatically adds the model to fragmentsManager.groups
      // No need to manually add it again

      const result: IFCLoadResult = {
        model,
        modelID,
        fileName: file.name,
      };

      logger.info('IFCLoader', `IFC file loaded successfully: ${file.name}`);
      eventBus.emit(Events.MODEL_LOADED, result);

      return result;
    } catch (error) {
      logger.error('IFCLoader', `Failed to load IFC file: ${error}`);
      eventBus.emit(Events.MODEL_LOAD_ERROR, { error, fileName: file.name });
      throw error;
    }
  }

  /**
   * Load IFC file from URL
   */
  async loadIFCFromURL(url: string): Promise<IFCLoadResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    logger.info('IFCLoader', `Loading IFC from URL: ${url}`);

    try {
      // Fetch file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Extract filename from URL
      const fileName = url.split('/').pop() || 'model.ifc';

      // Load IFC model
      // The load method requires: data, coordinate (for origin), and filename
      const model = await this.ifcLoader.load(
        data,
        true, // coordinate to origin
        fileName
      );

      // Store model
      const modelID = model.uuid;
      this.loadedModels.set(modelID, model);

      // Note: The IfcLoader automatically adds the model to fragmentsManager.groups
      // No need to manually add it again

      const result: IFCLoadResult = {
        model,
        modelID,
        fileName,
      };

      logger.info('IFCLoader', `IFC file loaded from URL: ${url}`);
      eventBus.emit(Events.MODEL_LOADED, result);

      return result;
    } catch (error) {
      logger.error('IFCLoader', `Failed to load IFC from URL: ${error}`);
      eventBus.emit(Events.MODEL_LOAD_ERROR, { error, url });
      throw error;
    }
  }

  /**
   * Get loaded model by ID
   */
  getModel(modelID: string): FRAGS.FragmentsModel | undefined {
    return this.loadedModels.get(modelID);
  }

  /**
   * Get all loaded models
   */
  getAllModels(): FRAGS.FragmentsModel[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * Unload a model
   */
  async unloadModel(modelID: string): Promise<void> {
    const model = this.loadedModels.get(modelID);
    if (!model) {
      logger.warn('IFCLoader', `Model not found: ${modelID}`);
      return;
    }

    // Remove from fragments manager using the core API
    if (this.fragmentsManager.list.has(modelID)) {
      await this.fragmentsManager.core.delete(modelID);
    }

    // Dispose model
    await model.dispose();

    // Remove from loaded models
    this.loadedModels.delete(modelID);

    logger.info('IFCLoader', `Model unloaded: ${modelID}`);
    eventBus.emit(Events.MODEL_UNLOADED, { modelID });
  }

  /**
   * Unload all models
   */
  async unloadAllModels(): Promise<void> {
    for (const modelID of this.loadedModels.keys()) {
      await this.unloadModel(modelID);
    }
    logger.info('IFCLoader', 'All models unloaded');
  }

  /**
   * Get IFC properties for an object
   */
  async getProperties(modelID: string, expressID: number): Promise<any> {
    const model = this.loadedModels.get(modelID);
    if (!model) {
      throw new Error(`Model not found: ${modelID}`);
    }

    // Get properties from the model's properties manager
    try {
      const properties = await model.getProperties(expressID);
      return properties;
    } catch (error) {
      logger.error('IFCLoader', `Failed to get properties: ${error}`);
      return null;
    }
  }

  /**
   * Get all properties for a model
   */
  async getAllProperties(modelID: string): Promise<any> {
    const model = this.loadedModels.get(modelID);
    if (!model) {
      throw new Error(`Model not found: ${modelID}`);
    }

    return model.getAllPropertiesOfType();
  }

  /**
   * Emit loading progress event
   */
  private emitProgress(progress: IFCLoadProgress): void {
    eventBus.emit(Events.MODEL_LOAD_PROGRESS, progress);
  }

  /**
   * Dispose loader
   */
  async dispose(): Promise<void> {
    await this.unloadAllModels();
    this.loadedModels.clear();
    logger.info('IFCLoader', 'IFCLoader disposed');
  }
}
