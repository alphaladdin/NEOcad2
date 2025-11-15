/**
 * Raycaster - Object picking and hover detection
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export interface RaycastResult {
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  face?: THREE.Face | null;
  faceIndex?: number | null;
  uv?: THREE.Vector2;
}

export interface RaycasterConfig {
  recursive?: boolean;
  threshold?: number;
  layers?: THREE.Layers;
}

export class Raycaster {
  private raycaster: THREE.Raycaster;
  private config: RaycasterConfig;

  constructor(config: RaycasterConfig = {}) {
    this.config = {
      recursive: true,
      threshold: 0.1,
      ...config,
    };

    this.raycaster = new THREE.Raycaster();

    // Configure raycaster
    if (this.config.threshold) {
      this.raycaster.params.Line = { threshold: this.config.threshold };
      this.raycaster.params.Points = { threshold: this.config.threshold };
    }

    if (this.config.layers) {
      this.raycaster.layers = this.config.layers;
    }

    logger.debug('Raycaster', 'Raycaster created');
  }

  /**
   * Cast a ray from camera through NDC position
   */
  castFromCamera(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
  ): RaycastResult[] {
    // Update raycaster from camera and mouse position
    this.raycaster.setFromCamera(ndc, camera);

    // Perform raycast
    const intersects = this.raycaster.intersectObjects(
      objects,
      this.config.recursive ?? true
    );

    // Convert to our result format
    return intersects.map((intersect) => ({
      object: intersect.object,
      point: intersect.point,
      distance: intersect.distance,
      face: intersect.face,
      faceIndex: intersect.faceIndex,
      uv: intersect.uv,
    }));
  }

  /**
   * Cast a ray from camera and get the first hit object
   */
  castFirstFromCamera(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
  ): RaycastResult | null {
    const results = this.castFromCamera(ndc, camera, objects);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Cast a ray from a specific point in a direction
   */
  castFromPoint(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    objects: THREE.Object3D[]
  ): RaycastResult[] {
    this.raycaster.set(origin, direction.normalize());

    const intersects = this.raycaster.intersectObjects(
      objects,
      this.config.recursive ?? true
    );

    return intersects.map((intersect) => ({
      object: intersect.object,
      point: intersect.point,
      distance: intersect.distance,
      face: intersect.face,
      faceIndex: intersect.faceIndex,
      uv: intersect.uv,
    }));
  }

  /**
   * Check if any object is hit by the ray
   */
  hasHit(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
  ): boolean {
    return this.castFirstFromCamera(ndc, camera, objects) !== null;
  }

  /**
   * Get all meshes from raycaster results
   */
  static getMeshes(results: RaycastResult[]): THREE.Mesh[] {
    return results
      .map((result) => result.object)
      .filter((obj): obj is THREE.Mesh => obj instanceof THREE.Mesh);
  }

  /**
   * Get the top-level parent object (useful for grouped objects)
   */
  static getTopParent(object: THREE.Object3D): THREE.Object3D {
    let parent = object;
    while (parent.parent && parent.parent.type !== 'Scene') {
      parent = parent.parent;
    }
    return parent;
  }

  /**
   * Filter results by distance
   */
  static filterByDistance(
    results: RaycastResult[],
    maxDistance: number
  ): RaycastResult[] {
    return results.filter((result) => result.distance <= maxDistance);
  }

  /**
   * Filter results by object type
   */
  static filterByType<T extends THREE.Object3D>(
    results: RaycastResult[],
    type: new (...args: any[]) => T
  ): RaycastResult[] {
    return results.filter((result) => result.object instanceof type);
  }

  /**
   * Update raycaster configuration
   */
  setThreshold(threshold: number): void {
    this.config.threshold = threshold;
    this.raycaster.params.Line = { threshold };
    this.raycaster.params.Points = { threshold };
  }

  /**
   * Set raycaster layers
   */
  setLayers(layers: THREE.Layers): void {
    this.raycaster.layers = layers;
  }

  /**
   * Get the underlying Three.js raycaster
   */
  get three(): THREE.Raycaster {
    return this.raycaster;
  }
}
