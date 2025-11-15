/**
 * ClippingManager - Manages clipping planes for section views
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ClippingPlane, PlaneOrientation, ClippingPlaneConfig } from '@tools/ClippingPlane';

export interface ClippingManagerConfig {
  maxPlanes?: number;
  globalClipping?: boolean;
}

export class ClippingManager {
  private planes: Map<string, ClippingPlane> = new Map();
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private maxPlanes: number;
  private globalClipping: boolean;
  private isActive: boolean = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, config: ClippingManagerConfig = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.maxPlanes = config.maxPlanes || 6; // WebGL typically supports 6-8 clipping planes
    this.globalClipping = config.globalClipping !== false;

    // Enable clipping on renderer
    this.renderer.localClippingEnabled = !this.globalClipping;

    logger.info('ClippingManager', 'ClippingManager created');
  }

  /**
   * Create a new clipping plane
   */
  createPlane(config: ClippingPlaneConfig = {}): ClippingPlane {
    if (this.planes.size >= this.maxPlanes) {
      logger.warn('ClippingManager', `Maximum number of clipping planes (${this.maxPlanes}) reached`);
      throw new Error(`Maximum number of clipping planes (${this.maxPlanes}) reached`);
    }

    const plane = new ClippingPlane(this.scene, config);
    this.planes.set(plane.id, plane);

    this.updateRendererClipping();

    logger.info('ClippingManager', `Created clipping plane: ${plane.id}`);
    eventBus.emit(Events.CLIPPING_PLANE_CREATED, { plane });

    return plane;
  }

  /**
   * Create a plane at a specific orientation
   */
  createOrientedPlane(orientation: PlaneOrientation, position?: THREE.Vector3): ClippingPlane {
    return this.createPlane({
      orientation,
      position,
      enabled: true,
    });
  }

  /**
   * Create a plane from the current view
   */
  createPlaneFromView(camera: THREE.Camera): ClippingPlane {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const position = camera.position.clone();

    return this.createPlane({
      normal: direction,
      position,
      orientation: 'custom',
      enabled: true,
    });
  }

  /**
   * Create a box clipping (6 planes)
   */
  createBox(center: THREE.Vector3, size: THREE.Vector3): ClippingPlane[] {
    const planes: ClippingPlane[] = [];

    // X planes
    planes.push(
      this.createPlane({
        orientation: 'x',
        position: new THREE.Vector3(center.x - size.x / 2, center.y, center.z),
      })
    );
    planes.push(
      this.createPlane({
        orientation: 'x',
        position: new THREE.Vector3(center.x + size.x / 2, center.y, center.z),
      })
    );

    // Y planes
    planes.push(
      this.createPlane({
        orientation: 'y',
        position: new THREE.Vector3(center.x, center.y - size.y / 2, center.z),
      })
    );
    planes.push(
      this.createPlane({
        orientation: 'y',
        position: new THREE.Vector3(center.x, center.y + size.y / 2, center.z),
      })
    );

    // Z planes
    planes.push(
      this.createPlane({
        orientation: 'z',
        position: new THREE.Vector3(center.x, center.y, center.z - size.z / 2),
      })
    );
    planes.push(
      this.createPlane({
        orientation: 'z',
        position: new THREE.Vector3(center.x, center.y, center.z + size.z / 2),
      })
    );

    // Flip the second plane of each pair
    planes[1].flip();
    planes[3].flip();
    planes[5].flip();

    logger.info('ClippingManager', 'Created box clipping with 6 planes');
    return planes;
  }

  /**
   * Remove a clipping plane
   */
  removePlane(id: string): void {
    const plane = this.planes.get(id);
    if (!plane) {
      logger.warn('ClippingManager', `Plane ${id} not found`);
      return;
    }

    plane.dispose();
    this.planes.delete(id);

    this.updateRendererClipping();

    logger.info('ClippingManager', `Removed clipping plane: ${id}`);
    eventBus.emit(Events.CLIPPING_PLANE_REMOVED, { id });
  }

  /**
   * Get a plane by ID
   */
  getPlane(id: string): ClippingPlane | undefined {
    return this.planes.get(id);
  }

  /**
   * Get all planes
   */
  getAllPlanes(): ClippingPlane[] {
    return Array.from(this.planes.values());
  }

  /**
   * Get enabled planes
   */
  getEnabledPlanes(): ClippingPlane[] {
    return this.getAllPlanes().filter((p) => p.enabled);
  }

  /**
   * Clear all planes
   */
  clearAll(): void {
    this.planes.forEach((plane) => plane.dispose());
    this.planes.clear();

    this.updateRendererClipping();

    logger.info('ClippingManager', 'Cleared all clipping planes');
    eventBus.emit(Events.CLIPPING_CLEARED);
  }

  /**
   * Toggle a plane
   */
  togglePlane(id: string): void {
    const plane = this.planes.get(id);
    if (!plane) return;

    plane.toggle();
    this.updateRendererClipping();

    eventBus.emit(Events.CLIPPING_PLANE_TOGGLED, { id, enabled: plane.enabled });
  }

  /**
   * Enable/disable all planes
   */
  setAllEnabled(enabled: boolean): void {
    this.planes.forEach((plane) => plane.setEnabled(enabled));
    this.updateRendererClipping();
    logger.info('ClippingManager', `Set all planes enabled: ${enabled}`);
  }

  /**
   * Activate clipping mode
   */
  activate(): void {
    this.isActive = true;
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
   * Update renderer clipping planes
   */
  private updateRendererClipping(): void {
    const enabledPlanes = this.getEnabledPlanes();
    const threePlanes = enabledPlanes.map((p) => p.plane);

    // Update renderer clipping
    this.renderer.clippingPlanes = threePlanes;

    // Update all materials in the scene
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = object.material;
        if (material) {
          if (Array.isArray(material)) {
            material.forEach((mat) => {
              mat.clippingPlanes = this.globalClipping ? null : threePlanes;
              mat.clipIntersection = false;
              mat.needsUpdate = true;
            });
          } else {
            material.clippingPlanes = this.globalClipping ? null : threePlanes;
            material.clipIntersection = false;
            material.needsUpdate = true;
          }
        }
      }
    });

    logger.debug('ClippingManager', `Updated clipping with ${threePlanes.length} planes`);
  }

  /**
   * Get clipping statistics
   */
  getStats(): { total: number; enabled: number; max: number } {
    return {
      total: this.planes.size,
      enabled: this.getEnabledPlanes().length,
      max: this.maxPlanes,
    };
  }

  /**
   * Export clipping configuration
   */
  export(): any {
    const planes = this.getAllPlanes().map((plane) => ({
      id: plane.id,
      orientation: plane.orientation,
      enabled: plane.enabled,
      normal: plane.plane.normal.toArray(),
      constant: plane.plane.constant,
    }));

    return {
      version: '1.0',
      globalClipping: this.globalClipping,
      planes,
    };
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clearAll();
    this.renderer.clippingPlanes = [];
    logger.info('ClippingManager', 'ClippingManager disposed');
  }
}
