/**
 * Annotation - Represents a note or comment attached to a 3D position
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export type AnnotationType = 'note' | 'issue' | 'question' | 'markup';
export type AnnotationStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type AnnotationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AnnotationData {
  id: string;
  type: AnnotationType;
  title: string;
  description: string;
  position: { x: number; y: number; z: number };
  cameraPosition?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
  elementId?: string;
  status: AnnotationStatus;
  priority: AnnotationPriority;
  author: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  attachments?: string[];
}

export class Annotation {
  public readonly id: string;
  public type: AnnotationType;
  public title: string;
  public description: string;
  public position: THREE.Vector3;
  public cameraPosition: THREE.Vector3 | null;
  public cameraTarget: THREE.Vector3 | null;
  public elementId: string | null;
  public status: AnnotationStatus;
  public priority: AnnotationPriority;
  public author: string;
  public createdAt: number;
  public updatedAt: number;
  public tags: string[];
  public attachments: string[];

  // 3D visualization
  public marker: THREE.Object3D | null = null;
  public label: THREE.Sprite | null = null;

  constructor(
    title: string,
    description: string,
    position: THREE.Vector3,
    type: AnnotationType = 'note',
    author: string = 'User'
  ) {
    this.id = THREE.MathUtils.generateUUID();
    this.type = type;
    this.title = title;
    this.description = description;
    this.position = position.clone();
    this.cameraPosition = null;
    this.cameraTarget = null;
    this.elementId = null;
    this.status = 'open';
    this.priority = 'medium';
    this.author = author;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.tags = [];
    this.attachments = [];

    logger.debug('Annotation', `Created annotation: ${title}`);
  }

  /**
   * Update annotation properties
   */
  update(updates: Partial<AnnotationData>): void {
    if (updates.title !== undefined) this.title = updates.title;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.type !== undefined) this.type = updates.type;
    if (updates.status !== undefined) this.status = updates.status;
    if (updates.priority !== undefined) this.priority = updates.priority;
    if (updates.tags !== undefined) this.tags = updates.tags;
    if (updates.attachments !== undefined) this.attachments = updates.attachments;

    if (updates.position) {
      this.position.set(updates.position.x, updates.position.y, updates.position.z);
    }

    this.updatedAt = Date.now();
    logger.debug('Annotation', `Updated annotation: ${this.title}`);
  }

  /**
   * Save camera viewpoint
   */
  saveCameraViewpoint(cameraPosition: THREE.Vector3, cameraTarget: THREE.Vector3): void {
    this.cameraPosition = cameraPosition.clone();
    this.cameraTarget = cameraTarget.clone();
    this.updatedAt = Date.now();
  }

  /**
   * Get color based on type
   */
  static getTypeColor(type: AnnotationType): THREE.Color {
    switch (type) {
      case 'note':
        return new THREE.Color(0x4a90e2); // Blue
      case 'issue':
        return new THREE.Color(0xe74c3c); // Red
      case 'question':
        return new THREE.Color(0xf39c12); // Orange
      case 'markup':
        return new THREE.Color(0x9b59b6); // Purple
      default:
        return new THREE.Color(0x95a5a6); // Gray
    }
  }

  /**
   * Get color based on status
   */
  static getStatusColor(status: AnnotationStatus): THREE.Color {
    switch (status) {
      case 'open':
        return new THREE.Color(0xe74c3c); // Red
      case 'in-progress':
        return new THREE.Color(0xf39c12); // Orange
      case 'resolved':
        return new THREE.Color(0x2ecc71); // Green
      case 'closed':
        return new THREE.Color(0x95a5a6); // Gray
      default:
        return new THREE.Color(0x3498db); // Blue
    }
  }

  /**
   * Get color based on priority
   */
  static getPriorityColor(priority: AnnotationPriority): THREE.Color {
    switch (priority) {
      case 'low':
        return new THREE.Color(0x95a5a6); // Gray
      case 'medium':
        return new THREE.Color(0x3498db); // Blue
      case 'high':
        return new THREE.Color(0xf39c12); // Orange
      case 'critical':
        return new THREE.Color(0xe74c3c); // Red
      default:
        return new THREE.Color(0x95a5a6); // Gray
    }
  }

  /**
   * Get icon for type
   */
  static getTypeIcon(type: AnnotationType): string {
    switch (type) {
      case 'note':
        return '📝';
      case 'issue':
        return '⚠️';
      case 'question':
        return '❓';
      case 'markup':
        return '✏️';
      default:
        return '📌';
    }
  }

  /**
   * Get label for type
   */
  static getTypeLabel(type: AnnotationType): string {
    switch (type) {
      case 'note':
        return 'Note';
      case 'issue':
        return 'Issue';
      case 'question':
        return 'Question';
      case 'markup':
        return 'Markup';
      default:
        return 'Annotation';
    }
  }

  /**
   * Get label for status
   */
  static getStatusLabel(status: AnnotationStatus): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in-progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get label for priority
   */
  static getPriorityLabel(priority: AnnotationPriority): string {
    switch (priority) {
      case 'low':
        return 'Low';
      case 'medium':
        return 'Medium';
      case 'high':
        return 'High';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  }

  /**
   * Add a tag
   */
  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = Date.now();
    }
  }

  /**
   * Remove a tag
   */
  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = Date.now();
    }
  }

  /**
   * Export annotation data
   */
  toJSON(): AnnotationData {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      cameraPosition: this.cameraPosition
        ? { x: this.cameraPosition.x, y: this.cameraPosition.y, z: this.cameraPosition.z }
        : undefined,
      cameraTarget: this.cameraTarget
        ? { x: this.cameraTarget.x, y: this.cameraTarget.y, z: this.cameraTarget.z }
        : undefined,
      elementId: this.elementId || undefined,
      status: this.status,
      priority: this.priority,
      author: this.author,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tags: [...this.tags],
      attachments: [...this.attachments],
    };
  }

  /**
   * Import annotation from data
   */
  static fromJSON(data: AnnotationData): Annotation {
    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    const annotation = new Annotation(data.title, data.description, position, data.type, data.author);

    annotation.status = data.status;
    annotation.priority = data.priority;
    annotation.createdAt = data.createdAt;
    annotation.updatedAt = data.updatedAt;
    annotation.tags = [...data.tags];
    annotation.attachments = data.attachments ? [...data.attachments] : [];
    annotation.elementId = data.elementId || null;

    if (data.cameraPosition) {
      annotation.cameraPosition = new THREE.Vector3(
        data.cameraPosition.x,
        data.cameraPosition.y,
        data.cameraPosition.z
      );
    }

    if (data.cameraTarget) {
      annotation.cameraTarget = new THREE.Vector3(
        data.cameraTarget.x,
        data.cameraTarget.y,
        data.cameraTarget.z
      );
    }

    return annotation;
  }

  /**
   * Clone this annotation
   */
  clone(): Annotation {
    const cloned = new Annotation(
      `${this.title} (Copy)`,
      this.description,
      this.position,
      this.type,
      this.author
    );

    cloned.status = this.status;
    cloned.priority = this.priority;
    cloned.tags = [...this.tags];
    cloned.attachments = [...this.attachments];
    cloned.elementId = this.elementId;

    if (this.cameraPosition) {
      cloned.cameraPosition = this.cameraPosition.clone();
    }

    if (this.cameraTarget) {
      cloned.cameraTarget = this.cameraTarget.clone();
    }

    return cloned;
  }
}
