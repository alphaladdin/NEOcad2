/**
 * ClippingPlane - Represents a single clipping plane
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export type PlaneOrientation = 'x' | 'y' | 'z' | 'custom';

export interface ClippingPlaneConfig {
  position?: THREE.Vector3;
  normal?: THREE.Vector3;
  orientation?: PlaneOrientation;
  size?: number;
  color?: THREE.Color;
  enabled?: boolean;
}

export class ClippingPlane {
  public readonly id: string;
  public plane: THREE.Plane;
  public helper: THREE.PlaneHelper;
  public enabled: boolean;
  public orientation: PlaneOrientation;
  private size: number;
  private color: THREE.Color;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, config: ClippingPlaneConfig = {}) {
    this.id = THREE.MathUtils.generateUUID();
    this.scene = scene;
    this.enabled = config.enabled !== false;
    this.orientation = config.orientation || 'z';
    this.size = config.size || 10;
    this.color = config.color || new THREE.Color(0xff6b00);

    // Create the plane
    const normal = config.normal || this.getOrientationNormal(this.orientation);
    const position = config.position || new THREE.Vector3(0, 0, 0);
    const constant = -normal.dot(position);

    this.plane = new THREE.Plane(normal.clone(), constant);

    // Create visual helper
    this.helper = new THREE.PlaneHelper(this.plane, this.size, this.color);
    this.helper.visible = this.enabled;
    this.scene.add(this.helper);

    logger.debug('ClippingPlane', `Created clipping plane ${this.id}`);
  }

  /**
   * Get default normal vector for orientation
   */
  private getOrientationNormal(orientation: PlaneOrientation): THREE.Vector3 {
    switch (orientation) {
      case 'x':
        return new THREE.Vector3(1, 0, 0);
      case 'y':
        return new THREE.Vector3(0, 1, 0);
      case 'z':
        return new THREE.Vector3(0, 0, 1);
      case 'custom':
      default:
        return new THREE.Vector3(0, 0, 1);
    }
  }

  /**
   * Set plane position
   */
  setPosition(position: THREE.Vector3): void {
    const constant = -this.plane.normal.dot(position);
    this.plane.constant = constant;
    this.helper.updateMatrixWorld();
    logger.debug('ClippingPlane', `Updated position for plane ${this.id}`);
  }

  /**
   * Set plane normal (direction)
   */
  setNormal(normal: THREE.Vector3): void {
    this.plane.normal.copy(normal).normalize();
    this.helper.updateMatrixWorld();
    logger.debug('ClippingPlane', `Updated normal for plane ${this.id}`);
  }

  /**
   * Translate plane along its normal
   */
  translate(distance: number): void {
    this.plane.constant -= distance;
    this.helper.updateMatrixWorld();
  }

  /**
   * Flip plane direction
   */
  flip(): void {
    this.plane.normal.negate();
    this.plane.constant = -this.plane.constant;
    this.helper.updateMatrixWorld();
    logger.debug('ClippingPlane', `Flipped plane ${this.id}`);
  }

  /**
   * Set plane from three points
   */
  setFromPoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): void {
    this.plane.setFromCoplanarPoints(p1, p2, p3);
    this.orientation = 'custom';
    this.helper.updateMatrixWorld();
    logger.debug('ClippingPlane', `Set plane ${this.id} from points`);
  }

  /**
   * Toggle plane enabled state
   */
  toggle(): void {
    this.enabled = !this.enabled;
    this.helper.visible = this.enabled;
    logger.debug('ClippingPlane', `Toggled plane ${this.id}: ${this.enabled}`);
  }

  /**
   * Set plane enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.helper.visible = enabled;
  }

  /**
   * Update helper visualization
   */
  updateHelper(): void {
    this.helper.updateMatrixWorld();
  }

  /**
   * Get plane center position
   */
  getPosition(): THREE.Vector3 {
    const position = new THREE.Vector3();
    this.plane.projectPoint(new THREE.Vector3(0, 0, 0), position);
    return position;
  }

  /**
   * Get distance from origin
   */
  getDistance(): number {
    return Math.abs(this.plane.constant);
  }

  /**
   * Set helper size
   */
  setSize(size: number): void {
    this.size = size;
    this.scene.remove(this.helper);
    this.helper = new THREE.PlaneHelper(this.plane, this.size, this.color);
    this.helper.visible = this.enabled;
    this.scene.add(this.helper);
  }

  /**
   * Set helper color
   */
  setColor(color: THREE.Color): void {
    this.color = color;
    if (this.helper.material instanceof THREE.MeshBasicMaterial) {
      this.helper.material.color = color;
    }
  }

  /**
   * Dispose the clipping plane
   */
  dispose(): void {
    this.scene.remove(this.helper);
    if (this.helper.geometry) {
      this.helper.geometry.dispose();
    }
    if (this.helper.material instanceof THREE.Material) {
      this.helper.material.dispose();
    }
    logger.debug('ClippingPlane', `Disposed clipping plane ${this.id}`);
  }
}
