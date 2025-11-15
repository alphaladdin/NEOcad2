/**
 * CameraPreset - Stores camera position and orientation
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export type PresetType = 'custom' | 'standard';
export type StandardViewName = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'iso' | 'iso-back';

export interface CameraPresetData {
  id: string;
  name: string;
  type: PresetType;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom?: number;
  projection?: 'perspective' | 'orthographic';
  timestamp: number;
}

export class CameraPreset {
  public readonly id: string;
  public name: string;
  public type: PresetType;
  public position: THREE.Vector3;
  public target: THREE.Vector3;
  public zoom: number;
  public projection: 'perspective' | 'orthographic';
  public timestamp: number;

  constructor(
    name: string,
    position: THREE.Vector3,
    target: THREE.Vector3,
    type: PresetType = 'custom',
    zoom: number = 1,
    projection: 'perspective' | 'orthographic' = 'perspective'
  ) {
    this.id = THREE.MathUtils.generateUUID();
    this.name = name;
    this.type = type;
    this.position = position.clone();
    this.target = target.clone();
    this.zoom = zoom;
    this.projection = projection;
    this.timestamp = Date.now();

    logger.debug('CameraPreset', `Created preset: ${name}`);
  }

  /**
   * Create a preset from camera state
   */
  static fromCamera(
    name: string,
    camera: THREE.Camera,
    target: THREE.Vector3,
    type: PresetType = 'custom'
  ): CameraPreset {
    const position = camera.position.clone();
    const zoom = (camera as any).zoom || 1;
    const projection = camera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic';

    return new CameraPreset(name, position, target, type, zoom, projection);
  }

  /**
   * Create a standard view preset
   */
  static createStandardView(
    viewName: StandardViewName,
    boundingBox?: THREE.Box3
  ): CameraPreset {
    const center = boundingBox ? boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
    const size = boundingBox ? boundingBox.getSize(new THREE.Vector3()).length() : 20;
    const distance = size * 1.5;

    let position: THREE.Vector3;
    let name: string;

    switch (viewName) {
      case 'top':
        position = new THREE.Vector3(center.x, center.y + distance, center.z);
        name = 'Top View';
        break;
      case 'bottom':
        position = new THREE.Vector3(center.x, center.y - distance, center.z);
        name = 'Bottom View';
        break;
      case 'front':
        position = new THREE.Vector3(center.x, center.y, center.z + distance);
        name = 'Front View';
        break;
      case 'back':
        position = new THREE.Vector3(center.x, center.y, center.z - distance);
        name = 'Back View';
        break;
      case 'left':
        position = new THREE.Vector3(center.x - distance, center.y, center.z);
        name = 'Left View';
        break;
      case 'right':
        position = new THREE.Vector3(center.x + distance, center.y, center.z);
        name = 'Right View';
        break;
      case 'iso':
        position = new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.7,
          center.z + distance * 0.7
        );
        name = 'Isometric View';
        break;
      case 'iso-back':
        position = new THREE.Vector3(
          center.x - distance * 0.7,
          center.y + distance * 0.7,
          center.z - distance * 0.7
        );
        name = 'Isometric Back View';
        break;
      default:
        position = new THREE.Vector3(center.x, center.y, center.z + distance);
        name = 'Front View';
    }

    return new CameraPreset(name, position, center, 'standard', 1, 'orthographic');
  }

  /**
   * Apply this preset to a camera
   */
  applyToCamera(camera: THREE.Camera, animate: boolean = true): void {
    if (!animate) {
      camera.position.copy(this.position);
      if ((camera as any).zoom !== undefined) {
        (camera as any).zoom = this.zoom;
      }
      camera.updateProjectionMatrix();
      logger.debug('CameraPreset', `Applied preset ${this.name} instantly`);
    } else {
      // Animation would be handled by the CameraPresetManager
      logger.debug('CameraPreset', `Applying preset ${this.name} with animation`);
    }
  }

  /**
   * Get distance from camera position to target
   */
  getDistance(): number {
    return this.position.distanceTo(this.target);
  }

  /**
   * Get camera direction vector
   */
  getDirection(): THREE.Vector3 {
    return new THREE.Vector3().subVectors(this.target, this.position).normalize();
  }

  /**
   * Update preset with current camera state
   */
  update(camera: THREE.Camera, target: THREE.Vector3): void {
    this.position.copy(camera.position);
    this.target.copy(target);
    this.zoom = (camera as any).zoom || 1;
    this.timestamp = Date.now();
    logger.debug('CameraPreset', `Updated preset: ${this.name}`);
  }

  /**
   * Clone this preset
   */
  clone(newName?: string): CameraPreset {
    return new CameraPreset(
      newName || `${this.name} (Copy)`,
      this.position,
      this.target,
      this.type,
      this.zoom,
      this.projection
    );
  }

  /**
   * Export preset data
   */
  toJSON(): CameraPresetData {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      zoom: this.zoom,
      projection: this.projection,
      timestamp: this.timestamp,
    };
  }

  /**
   * Import preset from data
   */
  static fromJSON(data: CameraPresetData): CameraPreset {
    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    const target = new THREE.Vector3(data.target.x, data.target.y, data.target.z);
    const preset = new CameraPreset(
      data.name,
      position,
      target,
      data.type,
      data.zoom || 1,
      data.projection || 'perspective'
    );
    preset.timestamp = data.timestamp;
    return preset;
  }
}
