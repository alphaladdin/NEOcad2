/**
 * ClippingManager - Manages clipping planes using @thatopen/components Clipper
 *
 * This is a wrapper around @thatopen/components Clipper component to provide
 * a consistent API and integration with our event system.
 */

import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface ClippingManagerConfig {
  color?: THREE.Color;
  opacity?: number;
  size?: number;
}

/**
 * Manager for clipping planes using @thatopen/components Clipper
 */
export class ClippingManager {
  private components: OBC.Components;
  private clipper: OBC.Clipper;
  private world: OBC.SimpleWorld;
  private isActive: boolean = false;

  constructor(
    components: OBC.Components,
    world: OBC.SimpleWorld,
    config: ClippingManagerConfig = {}
  ) {
    this.components = components;
    this.world = world;

    // Get or create the Clipper component
    this.clipper = this.components.get(OBC.Clipper);

    // Configure clipper
    this.clipper.setup({
      color: config.color || new THREE.Color(0x0080ff),
      opacity: config.opacity ?? 0.8,
      size: config.size ?? 1,
    });

    // Enable clipper
    this.clipper.enabled = true;

    // Setup event listeners
    this.setupEventListeners();

    logger.info('ClippingManager', 'ClippingManager created with @thatopen Clipper');
  }

  /**
   * Setup event listeners for clipper events
   */
  private setupEventListeners(): void {
    // Listen to clipper events and forward to our event bus
    this.clipper.onAfterCreate.add((plane) => {
      logger.info('ClippingManager', `Created clipping plane`);
      eventBus.emit(Events.CLIPPING_PLANE_CREATED, { plane });
    });

    this.clipper.onAfterDelete.add(() => {
      logger.info('ClippingManager', `Deleted clipping plane`);
      eventBus.emit(Events.CLIPPING_PLANE_REMOVED, {});
    });
  }

  /**
   * Create a new clipping plane interactively
   * User clicks to place the plane
   */
  async createPlane(): Promise<OBC.SimplePlane | null> {
    if (!this.isActive) {
      logger.warn('ClippingManager', 'Clipping mode not activated');
      return null;
    }

    const plane = await this.clipper.create(this.world);
    return plane;
  }

  /**
   * Create a plane programmatically from normal and point
   */
  createPlaneFromNormalAndPoint(
    normal: THREE.Vector3,
    point: THREE.Vector3
  ): string {
    const planeId = this.clipper.createFromNormalAndCoplanarPoint(
      this.world,
      normal,
      point
    );

    logger.info('ClippingManager', `Created plane from normal and point: ${planeId}`);
    return planeId;
  }

  /**
   * Create a plane from the current camera view
   */
  createPlaneFromView(camera: THREE.Camera): string {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const position = camera.position.clone();

    return this.createPlaneFromNormalAndPoint(direction, position);
  }

  /**
   * Create an oriented plane (X, Y, or Z axis)
   */
  createOrientedPlane(
    axis: 'x' | 'y' | 'z',
    position: THREE.Vector3 = new THREE.Vector3()
  ): string {
    const normals = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
    };

    return this.createPlaneFromNormalAndPoint(normals[axis], position);
  }

  /**
   * Delete a specific plane
   */
  async deletePlane(planeId?: string): Promise<void> {
    await this.clipper.delete(this.world, planeId);
  }

  /**
   * Delete all clipping planes
   */
  deleteAll(): void {
    this.clipper.deleteAll();
    logger.info('ClippingManager', 'Cleared all clipping planes');
    eventBus.emit(Events.CLIPPING_CLEARED);
  }

  /**
   * Get all planes
   */
  getAllPlanes(): OBC.SimplePlane[] {
    return Array.from(this.clipper.list.values());
  }

  /**
   * Get a plane by ID
   */
  getPlane(id: string): OBC.SimplePlane | undefined {
    return this.clipper.list.get(id);
  }

  /**
   * Get enabled planes
   */
  getEnabledPlanes(): OBC.SimplePlane[] {
    return this.getAllPlanes().filter((p) => p.enabled);
  }

  /**
   * Toggle plane visibility
   */
  togglePlane(id: string): void {
    const plane = this.getPlane(id);
    if (!plane) {
      logger.warn('ClippingManager', `Plane ${id} not found`);
      return;
    }

    plane.enabled = !plane.enabled;
    eventBus.emit(Events.CLIPPING_PLANE_TOGGLED, { id, enabled: plane.enabled });
  }

  /**
   * Set all planes enabled/disabled
   */
  setAllEnabled(enabled: boolean): void {
    this.getAllPlanes().forEach((plane) => {
      plane.enabled = enabled;
    });
    logger.info('ClippingManager', `Set all planes enabled: ${enabled}`);
  }

  /**
   * Show/hide all planes
   */
  setVisible(visible: boolean): void {
    this.clipper.visible = visible;
    logger.info('ClippingManager', `Set clipper visible: ${visible}`);
  }

  /**
   * Activate clipping mode (enables creating planes)
   */
  activate(): void {
    this.isActive = true;
    this.clipper.enabled = true;
    logger.info('ClippingManager', 'Clipping mode activated');
    eventBus.emit(Events.CLIPPING_ACTIVATED);
  }

  /**
   * Deactivate clipping mode
   */
  deactivate(): void {
    this.isActive = false;
    logger.info('ClippingManager', 'Clipping mode deactivated');
    eventBus.emit(Events.CLIPPING_DEACTIVATED);
  }

  /**
   * Check if clipping mode is active
   */
  isActivated(): boolean {
    return this.isActive;
  }

  /**
   * Get clipping statistics
   */
  getStats(): { total: number; enabled: number } {
    return {
      total: this.clipper.list.size,
      enabled: this.getEnabledPlanes().length,
    };
  }

  /**
   * Set clipper configuration
   */
  setConfig(config: Partial<OBC.ClipperConfig>): void {
    this.clipper.setup(config);
  }

  /**
   * Get clipper component (for advanced usage)
   */
  getClipper(): OBC.Clipper {
    return this.clipper;
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.deleteAll();
    // Note: We don't dispose the clipper itself as it's managed by Components
    logger.info('ClippingManager', 'ClippingManager disposed');
  }
}
