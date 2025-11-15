/**
 * GeometryEngineWrapper - Wrapper around @thatopen/fragments GeometryEngine
 * Provides initialized access to web-ifc geometry creation capabilities
 */

import * as THREE from 'three';
import * as WEBIFC from 'web-ifc';
import {
  GeometryEngine,
  type WallData,
  type ExtrusionData,
  type SweepData,
  type ProfileData,
  type BooleanOperationData,
  type BboxData,
  type CircularSweepData,
  type RevolveData,
  type CylindricalRevolveData,
  type ArcData,
  type ParabolaData,
  type ClothoidData,
} from '@thatopen/fragments';
import { logger } from '@utils/Logger';

export interface GeometryEngineConfig {
  wasmPath?: string;
}

/**
 * Singleton wrapper for GeometryEngine
 * Handles web-ifc initialization and provides typed access to geometry creation
 */
export class GeometryEngineWrapper {
  private static instance: GeometryEngineWrapper | null = null;
  private ifcAPI: WEBIFC.IfcAPI | null = null;
  private geometryEngine: GeometryEngine | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): GeometryEngineWrapper {
    if (!GeometryEngineWrapper.instance) {
      GeometryEngineWrapper.instance = new GeometryEngineWrapper();
    }
    return GeometryEngineWrapper.instance;
  }

  /**
   * Initialize the geometry engine
   * @param config - Configuration for web-ifc initialization
   */
  async initialize(config: GeometryEngineConfig = {}): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.geometryEngine) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._initialize(config);
    await this.initializationPromise;
  }

  private async _initialize(config: GeometryEngineConfig): Promise<void> {
    try {
      logger.info('GeometryEngineWrapper', 'Initializing web-ifc and GeometryEngine...');

      // Create IFC API instance
      this.ifcAPI = new WEBIFC.IfcAPI();

      // Set WASM path if provided
      if (config.wasmPath) {
        this.ifcAPI.SetWasmPath(config.wasmPath);
      }

      // Initialize web-ifc
      await this.ifcAPI.Init();

      // Create GeometryEngine with initialized IFC API
      this.geometryEngine = new GeometryEngine(this.ifcAPI);

      this.isInitialized = true;
      logger.info('GeometryEngineWrapper', 'GeometryEngine initialized successfully');
    } catch (error) {
      logger.error('GeometryEngineWrapper', 'Failed to initialize GeometryEngine:', error);
      this.ifcAPI = null;
      this.geometryEngine = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Check if the engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.geometryEngine !== null;
  }

  /**
   * Get the underlying GeometryEngine instance
   * @throws Error if not initialized
   */
  getEngine(): GeometryEngine {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized. Call initialize() first.');
    }
    return this.geometryEngine;
  }

  /**
   * Get the underlying IFC API instance
   * @throws Error if not initialized
   */
  getIfcAPI(): WEBIFC.IfcAPI {
    if (!this.ifcAPI) {
      throw new Error('IFC API not initialized. Call initialize() first.');
    }
    return this.ifcAPI;
  }

  /**
   * Generate wall geometry
   */
  getWall(geometry: THREE.BufferGeometry, data: WallData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getWall(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated wall geometry');
  }

  /**
   * Generate extrusion geometry
   */
  getExtrusion(geometry: THREE.BufferGeometry, data: ExtrusionData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getExtrusion(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated extrusion geometry');
  }

  /**
   * Generate sweep geometry
   */
  getSweep(geometry: THREE.BufferGeometry, data: SweepData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getSweep(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated sweep geometry');
  }

  /**
   * Generate profile geometry
   */
  getProfile(geometry: THREE.BufferGeometry, data: ProfileData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getProfile(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated profile geometry');
  }

  /**
   * Generate boolean operation geometry
   */
  getBooleanOperation(geometry: THREE.BufferGeometry, data: BooleanOperationData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getBooleanOperation(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated boolean operation geometry');
  }

  /**
   * Generate bounding box geometry
   */
  getBbox(geometry: THREE.BufferGeometry, data: BboxData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getBbox(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated bbox geometry');
  }

  /**
   * Generate circular sweep geometry
   */
  getCircularSweep(geometry: THREE.BufferGeometry, data: CircularSweepData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getCircularSweep(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated circular sweep geometry');
  }

  /**
   * Generate revolve geometry
   */
  getRevolve(geometry: THREE.BufferGeometry, data: RevolveData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getRevolve(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated revolve geometry');
  }

  /**
   * Generate cylindrical revolve geometry
   */
  getCylindricalRevolve(geometry: THREE.BufferGeometry, data: CylindricalRevolveData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getCylindricalRevolve(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated cylindrical revolve geometry');
  }

  /**
   * Generate arc geometry
   */
  getArc(geometry: THREE.BufferGeometry, data: ArcData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getArc(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated arc geometry');
  }

  /**
   * Generate parabola geometry
   */
  getParabola(geometry: THREE.BufferGeometry, data: ParabolaData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getParabola(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated parabola geometry');
  }

  /**
   * Generate clothoid geometry
   */
  getClothoid(geometry: THREE.BufferGeometry, data: ClothoidData): void {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    this.geometryEngine.getClothoid(geometry, data);
    logger.debug('GeometryEngineWrapper', 'Generated clothoid geometry');
  }

  /**
   * Get profile points
   */
  getProfilePoints(data: ProfileData): number[] {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    return this.geometryEngine.getProfilePoints(data);
  }

  /**
   * Transform points
   */
  transformPoints(points: number[], transform: THREE.Matrix4): number[] {
    if (!this.geometryEngine) {
      throw new Error('GeometryEngine not initialized');
    }
    return this.geometryEngine.transformPoints(points, transform);
  }

  /**
   * Dispose the geometry engine
   */
  dispose(): void {
    if (this.ifcAPI) {
      // Clean up IFC API resources if needed
      this.ifcAPI = null;
    }

    this.geometryEngine = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    logger.info('GeometryEngineWrapper', 'GeometryEngine disposed');
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static reset(): void {
    if (GeometryEngineWrapper.instance) {
      GeometryEngineWrapper.instance.dispose();
      GeometryEngineWrapper.instance = null;
    }
  }
}

// Export a convenience function to get the singleton instance
export const getGeometryEngine = (): GeometryEngineWrapper => {
  return GeometryEngineWrapper.getInstance();
};
