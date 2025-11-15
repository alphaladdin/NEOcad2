/**
 * AreaMeasurementTool - Measure areas defined by 3+ points
 */

import * as THREE from 'three';
import { BaseMeasurementTool, Measurement, MeasurementPoint, MeasurementType } from './BaseMeasurementTool';

export class AreaMeasurementTool extends BaseMeasurementTool {
  getType(): MeasurementType {
    return 'area';
  }

  getMinPoints(): number {
    return 3;
  }

  calculateValue(points: MeasurementPoint[]): number {
    if (points.length < 3) return 0;

    // Use the Shoelace formula for polygon area
    // This works for coplanar polygons
    let area = 0;

    // First, we need to project points onto a plane for 3D polygons
    // For simplicity, we'll calculate the area assuming points form a simple polygon
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p1 = points[i].position;
      const p2 = points[j].position;

      // Cross product contribution
      area += p1.x * p2.y - p2.x * p1.y;
    }

    return Math.abs(area / 2);
  }

  formatValue(value: number): string {
    // Format based on scale
    if (value < 0.01) {
      return `${(value * 1000000).toFixed(2)} mm²`;
    } else if (value < 1) {
      return `${(value * 10000).toFixed(2)} cm²`;
    } else if (value < 10000) {
      return `${value.toFixed(2)} m²`;
    } else {
      return `${(value / 10000).toFixed(2)} ha`;
    }
  }

  createVisuals(measurement: Measurement): THREE.Object3D[] {
    const visuals: THREE.Object3D[] = [];

    if (measurement.points.length < 3) return visuals;

    // Create polygon outline
    const points = measurement.points.map(p => p.position);
    points.push(points[0]); // Close the polygon

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, this.lineMaterial);
    visuals.push(line);

    // Create filled polygon mesh
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }

    const shapeGeometry = new THREE.ShapeGeometry(shape);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      opacity: 0.2,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(shapeGeometry, fillMaterial);
    // Position the mesh at the average Z height
    const avgZ = points.reduce((sum, p) => sum + p.z, 0) / points.length;
    mesh.position.z = avgZ;
    visuals.push(mesh);

    // Create label at centroid
    const centroid = new THREE.Vector3();
    measurement.points.forEach(p => centroid.add(p.position));
    centroid.divideScalar(measurement.points.length);

    const label = this.createLabel(measurement.label, centroid);
    visuals.push(label);
    this.labelSprites.set(measurement.id, label);

    return visuals;
  }
}
