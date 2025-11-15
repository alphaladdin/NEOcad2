/**
 * AngleMeasurementTool - Measure angles between three points
 */

import * as THREE from 'three';
import { BaseMeasurementTool, Measurement, MeasurementPoint, MeasurementType } from './BaseMeasurementTool';

export class AngleMeasurementTool extends BaseMeasurementTool {
  getType(): MeasurementType {
    return 'angle';
  }

  getMinPoints(): number {
    return 3;
  }

  calculateValue(points: MeasurementPoint[]): number {
    if (points.length < 3) return 0;

    // Calculate angle at the middle point (vertex)
    const p1 = points[0].position;
    const vertex = points[1].position;
    const p2 = points[2].position;

    // Create vectors from vertex to the other two points
    const v1 = new THREE.Vector3().subVectors(p1, vertex);
    const v2 = new THREE.Vector3().subVectors(p2, vertex);

    // Calculate angle in radians
    const angle = v1.angleTo(v2);

    // Convert to degrees
    return THREE.MathUtils.radToDeg(angle);
  }

  formatValue(value: number): string {
    return `${value.toFixed(2)}°`;
  }

  createVisuals(measurement: Measurement): THREE.Object3D[] {
    const visuals: THREE.Object3D[] = [];

    if (measurement.points.length < 3) return visuals;

    const p1 = measurement.points[0].position;
    const vertex = measurement.points[1].position;
    const p2 = measurement.points[2].position;

    // Create lines from vertex to both points
    const line1Geometry = new THREE.BufferGeometry().setFromPoints([vertex, p1]);
    const line1 = new THREE.Line(line1Geometry, this.lineMaterial);
    visuals.push(line1);

    const line2Geometry = new THREE.BufferGeometry().setFromPoints([vertex, p2]);
    const line2 = new THREE.Line(line2Geometry, this.lineMaterial);
    visuals.push(line2);

    // Create arc to show the angle
    const v1 = new THREE.Vector3().subVectors(p1, vertex).normalize();
    const v2 = new THREE.Vector3().subVectors(p2, vertex).normalize();
    const angle = v1.angleTo(v2);

    // Create arc curve
    const radius = Math.min(vertex.distanceTo(p1), vertex.distanceTo(p2)) * 0.3;
    const arcPoints: THREE.Vector3[] = [];
    const segments = 32;

    // Calculate the rotation axis and create arc
    const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const currentAngle = angle * t;

      const point = v1.clone();
      point.applyAxisAngle(axis, currentAngle);
      point.multiplyScalar(radius);
      point.add(vertex);

      arcPoints.push(point);
    }

    const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arc = new THREE.Line(arcGeometry, this.lineMaterial);
    visuals.push(arc);

    // Create label at the arc midpoint
    const midAngle = angle / 2;
    const labelPoint = v1.clone();
    labelPoint.applyAxisAngle(axis, midAngle);
    labelPoint.multiplyScalar(radius * 1.5);
    labelPoint.add(vertex);

    const label = this.createLabel(measurement.label, labelPoint);
    visuals.push(label);
    this.labelSprites.set(measurement.id, label);

    return visuals;
  }
}
