/**
 * DistanceMeasurementTool - Measure distances between points
 */

import * as THREE from 'three';
import { BaseMeasurementTool, Measurement, MeasurementPoint, MeasurementType } from './BaseMeasurementTool';

export class DistanceMeasurementTool extends BaseMeasurementTool {
  getType(): MeasurementType {
    return 'distance';
  }

  getMinPoints(): number {
    return 2;
  }

  calculateValue(points: MeasurementPoint[]): number {
    if (points.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += points[i].position.distanceTo(points[i + 1].position);
    }

    return totalDistance;
  }

  formatValue(value: number): string {
    // Format based on scale
    if (value < 0.01) {
      return `${(value * 1000).toFixed(2)} mm`;
    } else if (value < 1) {
      return `${(value * 100).toFixed(2)} cm`;
    } else if (value < 1000) {
      return `${value.toFixed(2)} m`;
    } else {
      return `${(value / 1000).toFixed(2)} km`;
    }
  }

  createVisuals(measurement: Measurement): THREE.Object3D[] {
    const visuals: THREE.Object3D[] = [];

    if (measurement.points.length < 2) return visuals;

    // Create lines between points
    for (let i = 0; i < measurement.points.length - 1; i++) {
      const start = measurement.points[i].position;
      const end = measurement.points[i + 1].position;

      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const line = new THREE.Line(geometry, this.lineMaterial);
      visuals.push(line);
    }

    // Create label at midpoint
    if (measurement.points.length === 2) {
      const midpoint = new THREE.Vector3()
        .addVectors(measurement.points[0].position, measurement.points[1].position)
        .multiplyScalar(0.5);

      const label = this.createLabel(measurement.label, midpoint);
      visuals.push(label);
      this.labelSprites.set(measurement.id, label);
    } else {
      // For multi-point measurements, place label at the end
      const lastPoint = measurement.points[measurement.points.length - 1].position;
      const offset = new THREE.Vector3(0, 0.5, 0);
      const labelPos = lastPoint.clone().add(offset);

      const label = this.createLabel(measurement.label, labelPos);
      visuals.push(label);
      this.labelSprites.set(measurement.id, label);
    }

    return visuals;
  }
}
