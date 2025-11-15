/**
 * MeasurementManager - Manages all measurement tools
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { BaseMeasurementTool, Measurement, MeasurementType } from '@tools/BaseMeasurementTool';
import { DistanceMeasurementTool } from '@tools/DistanceMeasurementTool';
import { AreaMeasurementTool } from '@tools/AreaMeasurementTool';
import { AngleMeasurementTool } from '@tools/AngleMeasurementTool';
import { VolumeMeasurementTool } from '@tools/VolumeMeasurementTool';
import { UnitConverter, UnitSettings } from '@utils/UnitConverter';

export interface MeasurementManagerConfig {
  snapToVertices?: boolean;
  snapToEdges?: boolean;
  snapDistance?: number;
  unitSettings?: Partial<UnitSettings>;
  markerColor?: number;
  lineColor?: number;
  lineWidth?: number;
  labelSize?: number;
}

export class MeasurementManager {
  private tools: Map<MeasurementType, BaseMeasurementTool> = new Map();
  private activeTool: BaseMeasurementTool | null = null;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private isActive: boolean = false;
  private unitConverter: UnitConverter;
  private config: MeasurementManagerConfig;

  constructor(scene: THREE.Scene, camera: THREE.Camera, config: MeasurementManagerConfig = {}) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();

    // Store config with defaults
    this.config = {
      snapToVertices: config.snapToVertices ?? true,
      snapToEdges: config.snapToEdges ?? true,
      snapDistance: config.snapDistance ?? 0.5,
      unitSettings: config.unitSettings ?? {},
      markerColor: config.markerColor ?? 0xff6b00,
      lineColor: config.lineColor ?? 0xff6b00,
      lineWidth: config.lineWidth ?? 2,
      labelSize: config.labelSize ?? 256,
    };

    // Initialize unit converter
    this.unitConverter = new UnitConverter(this.config.unitSettings);

    // Initialize measurement tools
    this.tools.set('distance', new DistanceMeasurementTool(scene, camera));
    this.tools.set('area', new AreaMeasurementTool(scene, camera));
    this.tools.set('angle', new AngleMeasurementTool(scene, camera));
    this.tools.set('volume', new VolumeMeasurementTool(scene, camera));

    logger.info('MeasurementManager', 'MeasurementManager created with config', this.config);
  }

  /**
   * Activate a measurement tool
   */
  activateTool(type: MeasurementType): void {
    const tool = this.tools.get(type);
    if (!tool) {
      logger.error('MeasurementManager', `Tool type ${type} not found`);
      return;
    }

    // Deactivate current tool if any
    if (this.activeTool) {
      this.activeTool.cancelMeasurement();
    }

    this.activeTool = tool;
    this.activeTool.startMeasurement();
    this.isActive = true;

    logger.info('MeasurementManager', `Activated ${type} measurement tool`);
    eventBus.emit(Events.MEASUREMENT_TOOL_ACTIVATED, { type });
  }

  /**
   * Deactivate the current tool
   */
  deactivateTool(): void {
    if (!this.activeTool) return;

    this.activeTool.cancelMeasurement();
    this.activeTool = null;
    this.isActive = false;

    logger.info('MeasurementManager', 'Deactivated measurement tool');
    eventBus.emit(Events.MEASUREMENT_TOOL_DEACTIVATED);
  }

  /**
   * Get the currently active tool type
   */
  getActiveTool(): MeasurementType | null {
    return this.activeTool ? this.activeTool.getType() : null;
  }

  /**
   * Check if measurement mode is active
   */
  isActivated(): boolean {
    return this.isActive;
  }

  /**
   * Handle click to add measurement point
   */
  handleClick(event: MouseEvent, canvas: HTMLCanvasElement, objects: THREE.Object3D[]): void {
    if (!this.activeTool) return;

    // Calculate normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to find intersection point
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      let point = intersects[0].point.clone();
      const targetObject = intersects[0].object;

      // Apply snapping if enabled
      if (this.config.snapToVertices || this.config.snapToEdges) {
        const snappedPoint = this.snapPoint(point, intersects[0].object, intersects[0].face);
        if (snappedPoint) {
          point = snappedPoint;
        }
      }

      // For volume tool, pass the target object
      if (this.activeTool.getType() === 'volume') {
        (this.activeTool as any).addPoint(point, targetObject);
      } else {
        this.activeTool.addPoint(point);
      }

      // Check if measurement is complete
      const currentPoints = this.activeTool['currentMeasurement']?.points.length || 0;
      const minPoints = this.activeTool.getMinPoints();

      logger.debug('MeasurementManager', `Added point ${currentPoints}/${minPoints}`);
    }
  }

  /**
   * Snap point to nearest vertex or edge
   */
  private snapPoint(point: THREE.Vector3, object: THREE.Object3D, face: THREE.Face | undefined | null): THREE.Vector3 | null {
    if (!(object instanceof THREE.Mesh)) return null;

    const geometry = object.geometry;
    if (!geometry) return null;

    const snapDistance = this.config.snapDistance!;
    let closestPoint: THREE.Vector3 | null = null;
    let closestDistance = snapDistance;

    // Transform point to local space
    const worldToLocal = object.matrixWorld.clone().invert();
    const localPoint = point.clone().applyMatrix4(worldToLocal);

    // Snap to vertices
    if (this.config.snapToVertices && geometry instanceof THREE.BufferGeometry) {
      const position = geometry.attributes.position;
      if (position) {
        for (let i = 0; i < position.count; i++) {
          const vertex = new THREE.Vector3(
            position.getX(i),
            position.getY(i),
            position.getZ(i)
          );

          const distance = localPoint.distanceTo(vertex);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = vertex.clone().applyMatrix4(object.matrixWorld);
          }
        }
      }
    }

    // Snap to edges
    if (this.config.snapToEdges && !closestPoint && face && geometry instanceof THREE.BufferGeometry) {
      const position = geometry.attributes.position;
      const index = geometry.index;

      if (position && face) {
        // Get face vertices
        const vertices: THREE.Vector3[] = [];

        if (index) {
          // Indexed geometry - need to find the face
          // This is a simplified approach
          for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);

            vertices.push(
              new THREE.Vector3(position.getX(a), position.getY(a), position.getZ(a)),
              new THREE.Vector3(position.getX(b), position.getY(b), position.getZ(b)),
              new THREE.Vector3(position.getX(c), position.getY(c), position.getZ(c))
            );
          }
        }

        // Find closest point on edges
        for (let i = 0; i < vertices.length; i += 3) {
          const edges = [
            [vertices[i], vertices[i + 1]],
            [vertices[i + 1], vertices[i + 2]],
            [vertices[i + 2], vertices[i]],
          ];

          for (const [v1, v2] of edges) {
            const edgePoint = this.closestPointOnLine(localPoint, v1, v2);
            const distance = localPoint.distanceTo(edgePoint);

            if (distance < closestDistance) {
              closestDistance = distance;
              closestPoint = edgePoint.applyMatrix4(object.matrixWorld);
            }
          }
        }
      }
    }

    return closestPoint;
  }

  /**
   * Find closest point on a line segment
   */
  private closestPointOnLine(point: THREE.Vector3, lineStart: THREE.Vector3, lineEnd: THREE.Vector3): THREE.Vector3 {
    const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const length = line.length();
    line.normalize();

    const v = new THREE.Vector3().subVectors(point, lineStart);
    const d = v.dot(line);

    if (d < 0) return lineStart.clone();
    if (d > length) return lineEnd.clone();

    return lineStart.clone().add(line.multiplyScalar(d));
  }

  /**
   * Complete the current measurement
   */
  completeMeasurement(): Measurement | null {
    if (!this.activeTool) return null;

    const measurement = this.activeTool.completeMeasurement();
    if (measurement) {
      // Start a new measurement of the same type
      this.activeTool.startMeasurement();
    }

    return measurement;
  }

  /**
   * Cancel the current measurement
   */
  cancelMeasurement(): void {
    if (!this.activeTool) return;
    this.activeTool.cancelMeasurement();
    this.activeTool.startMeasurement();
  }

  /**
   * Remove a measurement by ID
   */
  removeMeasurement(id: string): void {
    // Find which tool owns this measurement
    for (const tool of this.tools.values()) {
      if (tool.getMeasurement(id)) {
        tool.removeMeasurement(id);
        return;
      }
    }
  }

  /**
   * Clear all measurements
   */
  clearAll(): void {
    this.tools.forEach(tool => tool.clearAll());
    logger.info('MeasurementManager', 'Cleared all measurements');
  }

  /**
   * Clear measurements of a specific type
   */
  clearType(type: MeasurementType): void {
    const tool = this.tools.get(type);
    if (tool) {
      tool.clearAll();
      logger.info('MeasurementManager', `Cleared all ${type} measurements`);
    }
  }

  /**
   * Get all measurements
   */
  getAllMeasurements(): Measurement[] {
    const measurements: Measurement[] = [];
    this.tools.forEach(tool => {
      measurements.push(...tool.getMeasurements());
    });
    return measurements;
  }

  /**
   * Get measurements of a specific type
   */
  getMeasurementsByType(type: MeasurementType): Measurement[] {
    const tool = this.tools.get(type);
    return tool ? tool.getMeasurements() : [];
  }

  /**
   * Toggle measurement visibility
   */
  toggleVisibility(id: string): void {
    for (const tool of this.tools.values()) {
      if (tool.getMeasurement(id)) {
        tool.toggleVisibility(id);
        return;
      }
    }
  }

  /**
   * Get unit converter
   */
  getUnitConverter(): UnitConverter {
    return this.unitConverter;
  }

  /**
   * Update unit settings
   */
  updateUnitSettings(settings: Partial<UnitSettings>): void {
    this.unitConverter.updateSettings(settings);
    logger.info('MeasurementManager', 'Unit settings updated', settings);
  }

  /**
   * Get configuration
   */
  getConfig(): MeasurementManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MeasurementManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update unit converter if unit settings changed
    if (config.unitSettings) {
      this.unitConverter.updateSettings(config.unitSettings);
    }

    logger.info('MeasurementManager', 'Configuration updated', config);
  }

  /**
   * Update measurement label (for editing)
   */
  updateMeasurementLabel(id: string, label: string): void {
    for (const tool of this.tools.values()) {
      const measurement = tool.getMeasurement(id);
      if (measurement) {
        measurement.label = label;
        logger.info('MeasurementManager', `Updated label for measurement ${id}`);
        return;
      }
    }
  }

  /**
   * Export measurements as JSON
   */
  exportMeasurements(): string {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      unitSettings: this.unitConverter.getSettings(),
      measurements: this.getAllMeasurements().map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
        label: m.label,
        visible: m.visible,
        points: m.points.map(p => ({
          x: p.position.x,
          y: p.position.y,
          z: p.position.z,
        })),
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export measurements as CSV
   */
  exportMeasurementsCSV(): string {
    const measurements = this.getAllMeasurements();
    const lines: string[] = [];

    // Header
    lines.push('ID,Type,Value,Label,Point Count,Points');

    // Data rows
    measurements.forEach(m => {
      const points = m.points
        .map(p => `(${p.position.x.toFixed(3)},${p.position.y.toFixed(3)},${p.position.z.toFixed(3)})`)
        .join(';');

      lines.push(`${m.id},${m.type},${m.value},${m.label},${m.points.length},"${points}"`);
    });

    return lines.join('\n');
  }

  /**
   * Import measurements from JSON
   */
  importMeasurements(json: string): void {
    try {
      const data = JSON.parse(json);

      if (!data.measurements || !Array.isArray(data.measurements)) {
        throw new Error('Invalid measurement data');
      }

      // Update unit settings if provided
      if (data.unitSettings) {
        this.updateUnitSettings(data.unitSettings);
      }

      // Import each measurement
      data.measurements.forEach((mData: any) => {
        const tool = this.tools.get(mData.type as MeasurementType);
        if (!tool) {
          logger.warn('MeasurementManager', `Tool type ${mData.type} not found`);
          return;
        }

        // Start a new measurement
        tool.startMeasurement();

        // Add points
        mData.points.forEach((p: any) => {
          tool.addPoint(new THREE.Vector3(p.x, p.y, p.z));
        });

        // Complete the measurement
        const measurement = tool.completeMeasurement();
        if (measurement) {
          measurement.label = mData.label;
          measurement.visible = mData.visible ?? true;
        }
      });

      logger.info('MeasurementManager', `Imported ${data.measurements.length} measurements`);
    } catch (error) {
      logger.error('MeasurementManager', 'Failed to import measurements', error);
      throw error;
    }
  }

  /**
   * Get measurement statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<MeasurementType, number>;
  } {
    const stats = {
      total: 0,
      byType: {
        distance: 0,
        area: 0,
        angle: 0,
        volume: 0,
      } as Record<MeasurementType, number>,
    };

    this.tools.forEach((tool, type) => {
      const count = tool.getMeasurements().length;
      stats.byType[type] = count;
      stats.total += count;
    });

    return stats;
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.deactivateTool();
    this.tools.forEach(tool => tool.dispose());
    this.tools.clear();
    logger.info('MeasurementManager', 'MeasurementManager disposed');
  }
}
