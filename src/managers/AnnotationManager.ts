/**
 * AnnotationManager - Manages annotations and their 3D visualization
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { Annotation, AnnotationType, AnnotationStatus, AnnotationPriority } from '@tools/Annotation';

export interface AnnotationManagerConfig {
  markerSize?: number;
  labelSize?: number;
  showLabels?: boolean;
}

export class AnnotationManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private annotations: Map<string, Annotation> = new Map();
  private annotationGroup: THREE.Group;
  private config: AnnotationManagerConfig;
  private isCreatingAnnotation: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera, config: AnnotationManagerConfig = {}) {
    this.scene = scene;
    this.camera = camera;
    this.config = {
      markerSize: config.markerSize || 0.5,
      labelSize: config.labelSize || 64,
      showLabels: config.showLabels !== false,
    };

    this.annotationGroup = new THREE.Group();
    this.annotationGroup.name = 'Annotations';
    this.scene.add(this.annotationGroup);

    logger.info('AnnotationManager', 'AnnotationManager created');
  }

  /**
   * Start annotation creation mode
   */
  startCreatingAnnotation(): void {
    this.isCreatingAnnotation = true;
    logger.debug('AnnotationManager', 'Started annotation creation mode');
  }

  /**
   * Stop annotation creation mode
   */
  stopCreatingAnnotation(): void {
    this.isCreatingAnnotation = false;
    logger.debug('AnnotationManager', 'Stopped annotation creation mode');
  }

  /**
   * Check if in annotation creation mode
   */
  isCreating(): boolean {
    return this.isCreatingAnnotation;
  }

  /**
   * Create annotation at position
   */
  createAnnotation(
    title: string,
    description: string,
    position: THREE.Vector3,
    type: AnnotationType = 'note',
    author: string = 'User'
  ): Annotation {
    const annotation = new Annotation(title, description, position, type, author);

    // Save current camera viewpoint
    const cameraPos = this.camera.position.clone();
    const cameraTarget = new THREE.Vector3(); // Would get from controls in real implementation
    annotation.saveCameraViewpoint(cameraPos, cameraTarget);

    // Create 3D visualization
    this.createAnnotationMarker(annotation);

    // Store annotation
    this.annotations.set(annotation.id, annotation);

    logger.info('AnnotationManager', `Created annotation: ${title}`);
    eventBus.emit(Events.ANNOTATION_CREATED, { annotation });

    return annotation;
  }

  /**
   * Create 3D marker for annotation
   */
  private createAnnotationMarker(annotation: Annotation): void {
    const group = new THREE.Group();
    group.name = `Annotation-${annotation.id}`;
    group.position.copy(annotation.position);

    // Create marker sphere
    const markerGeometry = new THREE.SphereGeometry(this.config.markerSize, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: Annotation.getTypeColor(annotation.type),
      transparent: true,
      opacity: 0.8,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.userData.annotationId = annotation.id;
    group.add(marker);

    // Create number label
    if (this.config.showLabels) {
      const label = this.createTextSprite(
        `${this.annotations.size}`,
        Annotation.getTypeColor(annotation.type)
      );
      label.position.set(0, this.config.markerSize! * 1.5, 0);
      label.scale.setScalar(this.config.markerSize! * 2);
      group.add(label);
      annotation.label = label;
    }

    this.annotationGroup.add(group);
    annotation.marker = group;
  }

  /**
   * Create a text sprite for labels
   */
  private createTextSprite(text: string, color: THREE.Color): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = this.config.labelSize!;
    canvas.height = this.config.labelSize!;

    // Draw background circle
    context.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, 2 * Math.PI);
    context.fill();

    // Draw text
    context.fillStyle = 'white';
    context.font = 'bold 40px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);

    return sprite;
  }

  /**
   * Update annotation
   */
  updateAnnotation(annotationId: string, updates: Partial<Annotation>): void {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) {
      logger.warn('AnnotationManager', `Annotation ${annotationId} not found`);
      return;
    }

    annotation.update(updates as any);

    // Update marker if type changed
    if (updates.type && annotation.marker) {
      const marker = annotation.marker.children[0] as THREE.Mesh;
      (marker.material as THREE.MeshBasicMaterial).color.copy(
        Annotation.getTypeColor(annotation.type)
      );
    }

    logger.info('AnnotationManager', `Updated annotation: ${annotation.title}`);
    eventBus.emit(Events.ANNOTATION_UPDATED, { annotation });
  }

  /**
   * Remove annotation
   */
  removeAnnotation(annotationId: string): void {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) {
      logger.warn('AnnotationManager', `Annotation ${annotationId} not found`);
      return;
    }

    // Remove 3D marker
    if (annotation.marker) {
      this.annotationGroup.remove(annotation.marker);
      annotation.marker = null;
    }

    this.annotations.delete(annotationId);

    logger.info('AnnotationManager', `Removed annotation: ${annotation.title}`);
    eventBus.emit(Events.ANNOTATION_REMOVED, { id: annotationId });
  }

  /**
   * Get annotation by ID
   */
  getAnnotation(annotationId: string): Annotation | undefined {
    return this.annotations.get(annotationId);
  }

  /**
   * Get all annotations
   */
  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  /**
   * Get annotations by type
   */
  getAnnotationsByType(type: AnnotationType): Annotation[] {
    return this.getAllAnnotations().filter((a) => a.type === type);
  }

  /**
   * Get annotations by status
   */
  getAnnotationsByStatus(status: AnnotationStatus): Annotation[] {
    return this.getAllAnnotations().filter((a) => a.status === status);
  }

  /**
   * Get annotations by priority
   */
  getAnnotationsByPriority(priority: AnnotationPriority): Annotation[] {
    return this.getAllAnnotations().filter((a) => a.priority === priority);
  }

  /**
   * Get annotations by tag
   */
  getAnnotationsByTag(tag: string): Annotation[] {
    return this.getAllAnnotations().filter((a) => a.tags.includes(tag));
  }

  /**
   * Focus on annotation (navigate camera to viewpoint)
   */
  focusAnnotation(annotationId: string): void {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) {
      logger.warn('AnnotationManager', `Annotation ${annotationId} not found`);
      return;
    }

    logger.info('AnnotationManager', `Focusing annotation: ${annotation.title}`);
    eventBus.emit(Events.ANNOTATION_FOCUSED, { annotation });
  }

  /**
   * Show/hide all annotations
   */
  setAnnotationsVisible(visible: boolean): void {
    this.annotationGroup.visible = visible;
    logger.debug('AnnotationManager', `Annotations visibility: ${visible}`);
  }

  /**
   * Show/hide annotations by type
   */
  setAnnotationTypeVisible(type: AnnotationType, visible: boolean): void {
    this.annotations.forEach((annotation) => {
      if (annotation.type === type && annotation.marker) {
        annotation.marker.visible = visible;
      }
    });
    logger.debug('AnnotationManager', `${type} annotations visibility: ${visible}`);
  }

  /**
   * Show/hide annotation labels
   */
  setLabelsVisible(visible: boolean): void {
    this.config.showLabels = visible;
    this.annotations.forEach((annotation) => {
      if (annotation.label) {
        annotation.label.visible = visible;
      }
    });
    logger.debug('AnnotationManager', `Labels visibility: ${visible}`);
  }

  /**
   * Export all annotations
   */
  exportAnnotations(): string {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      annotations: this.getAllAnnotations().map((a) => a.toJSON()),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import annotations from JSON
   */
  importAnnotations(json: string): void {
    try {
      const data = JSON.parse(json);
      if (!data.annotations || !Array.isArray(data.annotations)) {
        throw new Error('Invalid annotation data');
      }

      data.annotations.forEach((annotationData: any) => {
        const annotation = Annotation.fromJSON(annotationData);
        this.annotations.set(annotation.id, annotation);
        this.createAnnotationMarker(annotation);
      });

      logger.info('AnnotationManager', `Imported ${data.annotations.length} annotations`);
      eventBus.emit(Events.ANNOTATIONS_IMPORTED, { count: data.annotations.length });
    } catch (error) {
      logger.error('AnnotationManager', 'Failed to import annotations', error);
      throw error;
    }
  }

  /**
   * Clear all annotations
   */
  clearAnnotations(): void {
    this.annotations.forEach((annotation) => {
      if (annotation.marker) {
        this.annotationGroup.remove(annotation.marker);
      }
    });

    this.annotations.clear();
    logger.info('AnnotationManager', 'Cleared all annotations');
    eventBus.emit(Events.ANNOTATIONS_CLEARED);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<AnnotationType, number>;
    byStatus: Record<AnnotationStatus, number>;
    byPriority: Record<AnnotationPriority, number>;
  } {
    const stats = {
      total: this.annotations.size,
      byType: {
        note: 0,
        issue: 0,
        question: 0,
        markup: 0,
      } as Record<AnnotationType, number>,
      byStatus: {
        open: 0,
        'in-progress': 0,
        resolved: 0,
        closed: 0,
      } as Record<AnnotationStatus, number>,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<AnnotationPriority, number>,
    };

    this.annotations.forEach((annotation) => {
      stats.byType[annotation.type]++;
      stats.byStatus[annotation.status]++;
      stats.byPriority[annotation.priority]++;
    });

    return stats;
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clearAnnotations();
    this.scene.remove(this.annotationGroup);
    logger.info('AnnotationManager', 'AnnotationManager disposed');
  }
}
