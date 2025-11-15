/**
 * VolumeMeasurementTool - Measure volumes of IFC elements
 */

import * as THREE from 'three';
import { BaseMeasurementTool, Measurement, MeasurementPoint, MeasurementType } from './BaseMeasurementTool';
import { logger } from '@utils/Logger';

export class VolumeMeasurementTool extends BaseMeasurementTool {
  getType(): MeasurementType {
    return 'volume';
  }

  getMinPoints(): number {
    return 1; // Just need to select an object
  }

  /**
   * Calculate volume from selected object
   */
  calculateValue(points: MeasurementPoint[]): number {
    if (points.length < 1) return 0;

    // Get the object associated with the first point
    const point = points[0];
    if (!point.marker || !point.marker.userData.targetObject) {
      // If no object, calculate bounding box volume
      return this.calculateBoundingBoxVolume(points);
    }

    const object = point.marker.userData.targetObject as THREE.Object3D;
    return this.calculateObjectVolume(object);
  }

  /**
   * Calculate volume of an object
   */
  private calculateObjectVolume(object: THREE.Object3D): number {
    let totalVolume = 0;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry;

        // If BufferGeometry, try to calculate volume
        if (geometry instanceof THREE.BufferGeometry) {
          const volume = this.calculateMeshVolume(child);
          if (volume > 0) {
            totalVolume += volume;
          }
        }
      }
    });

    // If couldn't calculate from geometry, use bounding box
    if (totalVolume === 0) {
      const bbox = new THREE.Box3().setFromObject(object);
      const size = bbox.getSize(new THREE.Vector3());
      totalVolume = size.x * size.y * size.z;
    }

    return totalVolume;
  }

  /**
   * Calculate volume of a mesh using signed volume of triangles
   */
  private calculateMeshVolume(mesh: THREE.Mesh): number {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position;
    const index = geometry.index;

    if (!position) return 0;

    let volume = 0;
    const vertices: THREE.Vector3[] = [];

    // Get world matrix for transformations
    const worldMatrix = mesh.matrixWorld;

    // Extract vertices and transform to world space
    for (let i = 0; i < position.count; i++) {
      const vertex = new THREE.Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      );
      vertex.applyMatrix4(worldMatrix);
      vertices.push(vertex);
    }

    // Calculate signed volume using triangles
    if (index) {
      // Indexed geometry
      for (let i = 0; i < index.count; i += 3) {
        const i0 = index.getX(i);
        const i1 = index.getX(i + 1);
        const i2 = index.getX(i + 2);

        const v0 = vertices[i0];
        const v1 = vertices[i1];
        const v2 = vertices[i2];

        volume += this.signedVolumeOfTriangle(v0, v1, v2);
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < vertices.length; i += 3) {
        const v0 = vertices[i];
        const v1 = vertices[i + 1];
        const v2 = vertices[i + 2];

        volume += this.signedVolumeOfTriangle(v0, v1, v2);
      }
    }

    return Math.abs(volume);
  }

  /**
   * Calculate signed volume of a triangle
   */
  private signedVolumeOfTriangle(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number {
    return p1.dot(new THREE.Vector3().crossVectors(p2, p3)) / 6.0;
  }

  /**
   * Calculate bounding box volume from points
   */
  private calculateBoundingBoxVolume(points: MeasurementPoint[]): number {
    if (points.length < 2) {
      // Single point - can't calculate volume
      return 0;
    }

    const bbox = new THREE.Box3();
    points.forEach(point => bbox.expandByPoint(point.position));

    const size = bbox.getSize(new THREE.Vector3());
    return size.x * size.y * size.z;
  }

  formatValue(value: number): string {
    // Format based on scale (assuming meters)
    if (value < 0.000001) {
      return `${(value * 1000000000).toFixed(2)} mm³`;
    } else if (value < 0.001) {
      return `${(value * 1000000).toFixed(2)} cm³`;
    } else if (value < 1000) {
      return `${value.toFixed(2)} m³`;
    } else {
      return `${(value / 1000).toFixed(2)} km³`;
    }
  }

  createVisuals(measurement: Measurement): THREE.Object3D[] {
    const visuals: THREE.Object3D[] = [];

    if (measurement.points.length < 1) return visuals;

    // For single point (object selection), create a bounding box visualization
    if (measurement.points.length === 1) {
      const point = measurement.points[0];

      if (point.marker && point.marker.userData.targetObject) {
        const object = point.marker.userData.targetObject as THREE.Object3D;

        // Create bounding box helper
        const bbox = new THREE.Box3().setFromObject(object);
        const boxHelper = new THREE.Box3Helper(bbox, 0xff6b00);
        if (boxHelper.material instanceof THREE.LineBasicMaterial) {
          boxHelper.material.linewidth = 2;
          boxHelper.material.depthTest = false;
          boxHelper.material.depthWrite = false;
        }
        visuals.push(boxHelper);

        // Create label at the center of the bounding box
        const center = bbox.getCenter(new THREE.Vector3());
        const label = this.createLabel(measurement.label, center);
        visuals.push(label);
        this.labelSprites.set(measurement.id, label);
      }
    } else {
      // Multiple points - show bounding box of points
      const bbox = new THREE.Box3();
      measurement.points.forEach(p => bbox.expandByPoint(p.position));

      const boxHelper = new THREE.Box3Helper(bbox, 0xff6b00);
      if (boxHelper.material instanceof THREE.LineBasicMaterial) {
        boxHelper.material.linewidth = 2;
        boxHelper.material.depthTest = false;
        boxHelper.material.depthWrite = false;
      }
      visuals.push(boxHelper);

      // Create label at the center
      const center = bbox.getCenter(new THREE.Vector3());
      const label = this.createLabel(measurement.label, center);
      visuals.push(label);
      this.labelSprites.set(measurement.id, label);
    }

    return visuals;
  }

  /**
   * Override addPoint to handle object selection
   */
  addPoint(position: THREE.Vector3, targetObject?: THREE.Object3D): void {
    if (!this.currentMeasurement) {
      this.startMeasurement();
    }

    // Create marker for the point
    const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.copy(position);
    marker.renderOrder = 999;

    // Store reference to the target object
    if (targetObject) {
      marker.userData.targetObject = targetObject;
      logger.debug('VolumeMeasurementTool', `Measuring volume of object: ${targetObject.name || 'unnamed'}`);
    }

    this.scene.add(marker);

    this.currentMeasurement!.points.push({ position: position.clone(), marker });

    // Update visuals
    this.updateCurrentMeasurement();

    logger.debug('VolumeMeasurementTool', `Added point for volume measurement`);
  }
}
