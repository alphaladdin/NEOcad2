/**
 * CameraPresetManager - Manages camera presets and views
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { CameraPreset, StandardViewName } from '@tools/CameraPreset';
import * as TWEEN from '@tweenjs/tween.js';

export interface CameraPresetManagerConfig {
  animationDuration?: number;
  enableStandardViews?: boolean;
}

export class CameraPresetManager {
  private presets: Map<string, CameraPreset> = new Map();
  private camera: THREE.Camera;
  private controls: any; // Camera controls (e.g., OrbitControls)
  private animationDuration: number;
  private currentAnimation: TWEEN.Tween<any> | null = null;

  constructor(camera: THREE.Camera, controls: any, config: CameraPresetManagerConfig = {}) {
    this.camera = camera;
    this.controls = controls;
    this.animationDuration = config.animationDuration || 1000;

    // Create standard views if enabled
    if (config.enableStandardViews !== false) {
      this.createStandardViews();
    }

    logger.info('CameraPresetManager', 'CameraPresetManager created');
  }

  /**
   * Create standard view presets
   */
  private createStandardViews(boundingBox?: THREE.Box3): void {
    const standardViews: StandardViewName[] = ['top', 'front', 'right', 'iso'];

    standardViews.forEach((viewName) => {
      const preset = CameraPreset.createStandardView(viewName, boundingBox);
      this.presets.set(preset.id, preset);
      logger.debug('CameraPresetManager', `Created standard view: ${preset.name}`);
    });
  }

  /**
   * Update standard views with new bounding box
   */
  updateStandardViews(boundingBox: THREE.Box3): void {
    // Remove old standard views
    const toRemove: string[] = [];
    this.presets.forEach((preset, id) => {
      if (preset.type === 'standard') {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => this.presets.delete(id));

    // Create new standard views
    this.createStandardViews(boundingBox);
    logger.info('CameraPresetManager', 'Updated standard views with new bounding box');
  }

  /**
   * Save current camera position as a preset
   */
  saveCurrentView(name: string): CameraPreset {
    const target = new THREE.Vector3(0, 0, 0);
    if (this.controls) {
      this.controls.getTarget(target);
    }
    const preset = CameraPreset.fromCamera(name, this.camera, target, 'custom');

    this.presets.set(preset.id, preset);

    logger.info('CameraPresetManager', `Saved camera preset: ${name}`);
    eventBus.emit(Events.CAMERA_PRESET_CREATED, { preset });

    return preset;
  }

  /**
   * Apply a preset to the camera
   */
  applyPreset(presetId: string, animate: boolean = true): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      logger.warn('CameraPresetManager', `Preset ${presetId} not found`);
      return;
    }

    if (this.currentAnimation) {
      this.currentAnimation.stop();
      this.currentAnimation = null;
    }

    if (!this.controls) {
      logger.warn('CameraPresetManager', 'Camera controls not available');
      return;
    }

    // Use camera-controls setLookAt method
    this.controls.setLookAt(
      preset.position.x,
      preset.position.y,
      preset.position.z,
      preset.target.x,
      preset.target.y,
      preset.target.z,
      animate
    );

    logger.info('CameraPresetManager', `Applied preset: ${preset.name}`);
    eventBus.emit(Events.CAMERA_PRESET_APPLIED, { preset });
  }

  /**
   * Animation loop for tweens
   */
  private animateTweens(): void {
    const animate = () => {
      if (TWEEN.update()) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  /**
   * Apply a standard view
   */
  applyStandardView(viewName: StandardViewName, animate: boolean = true): void {
    const preset = Array.from(this.presets.values()).find(
      (p) => p.type === 'standard' && p.name.toLowerCase().includes(viewName)
    );

    if (preset) {
      this.applyPreset(preset.id, animate);
    } else {
      logger.warn('CameraPresetManager', `Standard view ${viewName} not found`);
    }
  }

  /**
   * Update an existing preset
   */
  updatePreset(presetId: string): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      logger.warn('CameraPresetManager', `Preset ${presetId} not found`);
      return;
    }

    const target = new THREE.Vector3(0, 0, 0);
    if (this.controls) {
      this.controls.getTarget(target);
    }
    preset.update(this.camera, target);

    logger.info('CameraPresetManager', `Updated preset: ${preset.name}`);
    eventBus.emit(Events.CAMERA_PRESET_UPDATED, { preset });
  }

  /**
   * Remove a preset
   */
  removePreset(presetId: string): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      logger.warn('CameraPresetManager', `Preset ${presetId} not found`);
      return;
    }

    // Don't allow removing standard views
    if (preset.type === 'standard') {
      logger.warn('CameraPresetManager', 'Cannot remove standard view presets');
      return;
    }

    this.presets.delete(presetId);

    logger.info('CameraPresetManager', `Removed preset: ${preset.name}`);
    eventBus.emit(Events.CAMERA_PRESET_REMOVED, { id: presetId });
  }

  /**
   * Get all presets
   */
  getAllPresets(): CameraPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get custom presets only
   */
  getCustomPresets(): CameraPreset[] {
    return this.getAllPresets().filter((p) => p.type === 'custom');
  }

  /**
   * Get standard presets only
   */
  getStandardPresets(): CameraPreset[] {
    return this.getAllPresets().filter((p) => p.type === 'standard');
  }

  /**
   * Get a preset by ID
   */
  getPreset(presetId: string): CameraPreset | undefined {
    return this.presets.get(presetId);
  }

  /**
   * Rename a preset
   */
  renamePreset(presetId: string, newName: string): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      logger.warn('CameraPresetManager', `Preset ${presetId} not found`);
      return;
    }

    if (preset.type === 'standard') {
      logger.warn('CameraPresetManager', 'Cannot rename standard view presets');
      return;
    }

    preset.name = newName;
    logger.info('CameraPresetManager', `Renamed preset to: ${newName}`);
    eventBus.emit(Events.CAMERA_PRESET_UPDATED, { preset });
  }

  /**
   * Export all presets
   */
  exportPresets(): string {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      presets: this.getCustomPresets().map((p) => p.toJSON()),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import presets from JSON
   */
  importPresets(json: string): void {
    try {
      const data = JSON.parse(json);
      if (!data.presets || !Array.isArray(data.presets)) {
        throw new Error('Invalid preset data');
      }

      data.presets.forEach((presetData: any) => {
        const preset = CameraPreset.fromJSON(presetData);
        this.presets.set(preset.id, preset);
      });

      logger.info('CameraPresetManager', `Imported ${data.presets.length} presets`);
    } catch (error) {
      logger.error('CameraPresetManager', 'Failed to import presets', error);
      throw error;
    }
  }

  /**
   * Clear all custom presets
   */
  clearCustomPresets(): void {
    const toRemove: string[] = [];
    this.presets.forEach((preset, id) => {
      if (preset.type === 'custom') {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.presets.delete(id));
    logger.info('CameraPresetManager', `Cleared ${toRemove.length} custom presets`);
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    if (this.currentAnimation) {
      this.currentAnimation.stop();
      this.currentAnimation = null;
    }
    this.presets.clear();
    logger.info('CameraPresetManager', 'CameraPresetManager disposed');
  }
}
