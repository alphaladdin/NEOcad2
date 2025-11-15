/**
 * BitbybitService - Integration wrapper for bitbybit-dev CAD library
 * Provides parametric modeling capabilities using OpenCascade, JSCAD, and Manifold
 */

import * as THREE from 'three';
import { BitByBitBase } from '@bitbybit-dev/core';
import { OCCTWorkerManager } from '@bitbybit-dev/occt';
import { logger } from '@utils/Logger';

export interface BitbybitConfig {
  engine?: 'opencascade' | 'jscad' | 'manifold';
  workerPath?: string;
}

export class BitbybitService {
  private static instance: BitbybitService | null = null;
  private initialized: boolean = false;
  private engine: string = 'opencascade';
  private bitbybit: BitByBitBase | null = null;
  private occt: OCCTWorkerManager | null = null;

  private constructor() {
    logger.info('BitbybitService', 'BitbybitService instance created');
  }

  static getInstance(): BitbybitService {
    if (!BitbybitService.instance) {
      BitbybitService.instance = new BitbybitService();
    }
    return BitbybitService.instance;
  }

  /**
   * Initialize bitbybit with OpenCascade or other CAD kernels
   */
  async initialize(config: BitbybitConfig = {}): Promise<void> {
    if (this.initialized) {
      logger.warn('BitbybitService', 'Already initialized');
      return;
    }

    try {
      logger.info('BitbybitService', `Initializing with engine: ${config.engine || 'opencascade'}`);

      this.engine = config.engine || 'opencascade';

      // Initialize bitbybit core
      this.bitbybit = new BitByBitBase();
      logger.debug('BitbybitService', 'BitByBitBase initialized');

      // Initialize OpenCascade wrapper
      if (this.engine === 'opencascade') {
        this.occt = new OCCTWorkerManager();

        const occtConfig: any = {};
        if (config.workerPath) {
          occtConfig.workerPath = config.workerPath;
        }

        await this.occt.init(occtConfig);
        logger.info('BitbybitService', 'OCCT engine initialized');
      }

      this.initialized = true;
      logger.info('BitbybitService', 'Bitbybit initialized successfully');
    } catch (error) {
      logger.error('BitbybitService', 'Failed to initialize bitbybit:', error);
      this.bitbybit = null;
      this.occt = null;
      throw error;
    }
  }

  /**
   * Create a parametric door using bitbybit primitives
   */
  async createParametricDoor(params: {
    width: number;
    height: number;
    thickness: number;
    panelStyle?: 'solid' | 'glazed' | 'paneled';
  }): Promise<THREE.Mesh> {
    if (!this.initialized) {
      throw new Error('BitbybitService not initialized');
    }

    logger.info('BitbybitService', `Creating door: ${params.width}x${params.height}mm`);

    // TODO: Implement using bitbybit OCCT operations
    // Example pseudo-code:
    // const doorFrame = await this.occt.shapes.solid.createBox({
    //   width: params.width / 1000,
    //   height: params.height / 1000,
    //   depth: params.thickness / 1000
    // });

    // const panelCutout = await this.occt.shapes.solid.createBox({ ... });
    // const result = await this.occt.operations.booleans.difference(doorFrame, panelCutout);

    // const mesh = await this.occt.converters.toThreeJsMesh(result);
    // return mesh;

    // Temporary placeholder
    const geometry = new THREE.BoxGeometry(
      params.width / 1000,
      params.height / 1000,
      params.thickness / 1000
    );
    const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(geometry, material);

    logger.info('BitbybitService', 'Door created (placeholder)');
    return mesh;
  }

  /**
   * Create a parametric window using bitbybit
   */
  async createParametricWindow(params: {
    width: number;
    height: number;
    frameDepth: number;
    glazingThickness: number;
    mullions?: { horizontal: number; vertical: number };
  }): Promise<THREE.Group> {
    if (!this.initialized) {
      throw new Error('BitbybitService not initialized');
    }

    logger.info('BitbybitService', `Creating window: ${params.width}x${params.height}mm`);

    // TODO: Implement using bitbybit OCCT operations
    // - Create frame using box and boolean operations
    // - Create glass panels
    // - Add mullions if specified
    // - Assemble into THREE.Group

    const group = new THREE.Group();

    // Temporary placeholder
    const frameGeom = new THREE.BoxGeometry(
      params.width / 1000,
      params.height / 1000,
      params.frameDepth / 1000
    );
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    group.add(frame);

    logger.info('BitbybitService', 'Window created (placeholder)');
    return group;
  }

  /**
   * Perform boolean operation using bitbybit's OCCT engine
   * Note: For production use, consider using GeometryEngine from @thatopen/fragments
   * which is already integrated and working well for wall boolean operations.
   * This method is for advanced use cases requiring OpenCascade features.
   */
  async booleanOperation(
    operation: 'union' | 'difference' | 'intersection',
    meshA: THREE.Mesh,
    meshB: THREE.Mesh
  ): Promise<THREE.Mesh> {
    if (!this.initialized || !this.occt) {
      throw new Error('BitbybitService OCCT not initialized');
    }

    logger.info('BitbybitService', `Boolean operation: ${operation}`);

    try {
      // Note: Full OCCT integration requires:
      // 1. Converting THREE.Mesh to OCCT TopoDS_Shape
      // 2. Performing boolean operation via OCCT booleans service
      // 3. Converting result back to THREE.BufferGeometry
      //
      // This is complex and requires deep OCCT integration.
      // For simpler boolean operations, use GeometryEngine from @thatopen/fragments
      // which is already working in ParametricWall.ts

      logger.warn('BitbybitService', 'Advanced OCCT boolean operations not yet implemented');
      logger.info('BitbybitService', 'Consider using GeometryEngine from @thatopen/fragments for boolean operations');

      return meshA;
    } catch (error) {
      logger.error('BitbybitService', `Boolean operation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Create complex profile extrusion (useful for frames, trim)
   */
  async extrudeProfile(
    profile: THREE.Vector2[],
    depth: number
  ): Promise<THREE.Mesh> {
    if (!this.initialized) {
      throw new Error('BitbybitService not initialized');
    }

    // TODO: Implement using bitbybit OCCT wire/face extrusion
    // const wire = await this.occt.shapes.wire.createPolygon({ points: profile });
    // const face = await this.occt.shapes.face.createFromWire(wire);
    // const solid = await this.occt.operations.extrude(face, { distance: depth });
    // return await this.occt.converters.toThreeJsMesh(solid);

    logger.warn('BitbybitService', 'Extrude profile not yet implemented');
    return new THREE.Mesh();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.initialized) {
      // Cleanup bitbybit resources
      if (this.occt) {
        // OCCT worker cleanup if available
        this.occt = null;
      }

      if (this.bitbybit) {
        this.bitbybit = null;
      }

      this.initialized = false;
      logger.info('BitbybitService', 'BitbybitService disposed');
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

// Export singleton instance getter
export const getBitbybitService = (): BitbybitService => {
  return BitbybitService.getInstance();
};
