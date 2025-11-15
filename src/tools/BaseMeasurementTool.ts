/**
 * BaseMeasurementTool - Abstract base class for measurement tools
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export type MeasurementType = 'distance' | 'area' | 'angle' | 'volume';

export interface MeasurementPoint {
  position: THREE.Vector3;
  marker?: THREE.Mesh;
}

export interface Measurement {
  id: string;
  type: MeasurementType;
  points: MeasurementPoint[];
  value: number;
  label: string;
  visible: boolean;
  objects: THREE.Object3D[];
}

export abstract class BaseMeasurementTool {
  protected measurements: Map<string, Measurement> = new Map();
  protected currentMeasurement: Measurement | null = null;
  protected scene: THREE.Scene;
  protected camera: THREE.Camera;

  // Visual elements
  protected markerGeometry: THREE.SphereGeometry;
  protected markerMaterial: THREE.MeshBasicMaterial;
  protected lineMaterial: THREE.LineBasicMaterial;
  protected labelSprites: Map<string, THREE.Sprite> = new Map();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Create shared geometries and materials
    this.markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    this.markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      depthTest: false,
      depthWrite: false,
    });
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff6b00,
      linewidth: 2,
      depthTest: false,
      depthWrite: false,
    });

    logger.debug('BaseMeasurementTool', `${this.getType()} tool created`);
  }

  /**
   * Get the measurement type
   */
  abstract getType(): MeasurementType;

  /**
   * Get the minimum number of points needed for this measurement
   */
  abstract getMinPoints(): number;

  /**
   * Calculate the measurement value from points
   */
  abstract calculateValue(points: MeasurementPoint[]): number;

  /**
   * Format the measurement value for display
   */
  abstract formatValue(value: number): string;

  /**
   * Create visual representation for the measurement
   */
  abstract createVisuals(measurement: Measurement): THREE.Object3D[];

  /**
   * Start a new measurement
   */
  startMeasurement(): void {
    const id = `measurement_${Date.now()}`;
    this.currentMeasurement = {
      id,
      type: this.getType(),
      points: [],
      value: 0,
      label: '',
      visible: true,
      objects: [],
    };
    logger.debug('BaseMeasurementTool', `Started new ${this.getType()} measurement: ${id}`);
  }

  /**
   * Add a point to the current measurement
   */
  addPoint(position: THREE.Vector3): void {
    if (!this.currentMeasurement) {
      this.startMeasurement();
    }

    // Create marker for the point
    const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.copy(position);
    marker.renderOrder = 999;
    this.scene.add(marker);

    this.currentMeasurement!.points.push({ position: position.clone(), marker });

    // Update visuals
    this.updateCurrentMeasurement();

    logger.debug('BaseMeasurementTool', `Added point ${this.currentMeasurement!.points.length}`);
  }

  /**
   * Update the current measurement
   */
  protected updateCurrentMeasurement(): void {
    if (!this.currentMeasurement) return;

    // Remove old visuals
    this.currentMeasurement.objects.forEach(obj => this.scene.remove(obj));
    this.currentMeasurement.objects = [];

    // Check if we have enough points
    if (this.currentMeasurement.points.length < this.getMinPoints()) {
      return;
    }

    // Calculate value
    this.currentMeasurement.value = this.calculateValue(this.currentMeasurement.points);
    this.currentMeasurement.label = this.formatValue(this.currentMeasurement.value);

    // Create visuals
    const visuals = this.createVisuals(this.currentMeasurement);
    visuals.forEach(obj => {
      obj.renderOrder = 999;
      this.scene.add(obj);
    });
    this.currentMeasurement.objects = visuals;
  }

  /**
   * Complete the current measurement
   */
  completeMeasurement(): Measurement | null {
    if (!this.currentMeasurement) return null;

    if (this.currentMeasurement.points.length < this.getMinPoints()) {
      logger.warn('BaseMeasurementTool', 'Not enough points to complete measurement');
      this.cancelMeasurement();
      return null;
    }

    this.measurements.set(this.currentMeasurement.id, this.currentMeasurement);
    const completed = this.currentMeasurement;
    this.currentMeasurement = null;

    logger.info('BaseMeasurementTool', `Completed ${this.getType()} measurement: ${completed.label}`);
    eventBus.emit(Events.MEASUREMENT_CREATED, completed);

    return completed;
  }

  /**
   * Cancel the current measurement
   */
  cancelMeasurement(): void {
    if (!this.currentMeasurement) return;

    // Remove markers
    this.currentMeasurement.points.forEach(point => {
      if (point.marker) {
        this.scene.remove(point.marker);
      }
    });

    // Remove visuals
    this.currentMeasurement.objects.forEach(obj => this.scene.remove(obj));

    this.currentMeasurement = null;
    logger.debug('BaseMeasurementTool', 'Cancelled measurement');
  }

  /**
   * Remove a measurement by ID
   */
  removeMeasurement(id: string): void {
    const measurement = this.measurements.get(id);
    if (!measurement) return;

    // Remove markers
    measurement.points.forEach(point => {
      if (point.marker) {
        this.scene.remove(point.marker);
      }
    });

    // Remove visuals
    measurement.objects.forEach(obj => this.scene.remove(obj));

    // Remove label
    const label = this.labelSprites.get(id);
    if (label) {
      this.scene.remove(label);
      this.labelSprites.delete(id);
    }

    this.measurements.delete(id);
    logger.info('BaseMeasurementTool', `Removed measurement: ${id}`);
    eventBus.emit(Events.MEASUREMENT_REMOVED, { id });
  }

  /**
   * Clear all measurements
   */
  clearAll(): void {
    this.cancelMeasurement();

    this.measurements.forEach((_, id) => {
      this.removeMeasurement(id);
    });

    logger.info('BaseMeasurementTool', 'Cleared all measurements');
  }

  /**
   * Get all measurements
   */
  getMeasurements(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Get measurement by ID
   */
  getMeasurement(id: string): Measurement | undefined {
    return this.measurements.get(id);
  }

  /**
   * Toggle measurement visibility
   */
  toggleVisibility(id: string): void {
    const measurement = this.measurements.get(id);
    if (!measurement) return;

    measurement.visible = !measurement.visible;

    // Toggle markers
    measurement.points.forEach(point => {
      if (point.marker) {
        point.marker.visible = measurement.visible;
      }
    });

    // Toggle visuals
    measurement.objects.forEach(obj => {
      obj.visible = measurement.visible;
    });

    // Toggle label
    const label = this.labelSprites.get(id);
    if (label) {
      label.visible = measurement.visible;
    }

    logger.debug('BaseMeasurementTool', `Toggled visibility for ${id}: ${measurement.visible}`);
  }

  /**
   * Create a text label sprite
   */
  protected createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#ffffff';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(2, 0.5, 1);
    sprite.renderOrder = 1000;

    return sprite;
  }

  /**
   * Dispose the tool
   */
  dispose(): void {
    this.clearAll();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.lineMaterial.dispose();
    logger.debug('BaseMeasurementTool', `${this.getType()} tool disposed`);
  }
}
