/**
 * ClashDetectionManager - Manages clash detection between IFC elements
 *
 * Detects geometric intersections between building elements to identify conflicts
 * in BIM models. Uses bounding box intersection for performance with optional
 * detailed mesh intersection.
 */

import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import {
  Clash,
  ClashRule,
  ClashSeverity,
  ClashStatus,
  ClashIntersection,
  ElementRef,
  BCFExport,
  ClashStats
} from '@tools/Clash';

export class ClashDetectionManager {
  private clashes: Map<string, Clash> = new Map();
  private rules: Map<string, ClashRule> = new Map();
  private isRunning: boolean = false;
  private visualMarkers: Map<string, THREE.Object3D[]> = new Map();

  constructor(
    private components: OBC.Components,
    private world: OBC.SimpleWorld
  ) {
    this.setupDefaultRules();
    logger.info('ClashDetectionManager', 'ClashDetectionManager created');
  }

  /**
   * Run clash detection with specified rules
   */
  public async runClashDetection(ruleId?: string): Promise<Clash[]> {
    if (this.isRunning) {
      throw new Error('Clash detection already running');
    }

    this.isRunning = true;
    const newClashes: Clash[] = [];

    try {
      logger.info('ClashDetectionManager', 'Starting clash detection...');
      eventBus.emit(Events.CLASH_DETECTION_STARTED);

      // Get rules to run
      const rules = ruleId
        ? [this.rules.get(ruleId)!]
        : Array.from(this.rules.values()).filter(r => r.enabled);

      if (rules.length === 0) {
        logger.warn('ClashDetectionManager', 'No enabled rules found');
        return [];
      }

      // Get all loaded models
      const fragmentsManager = this.components.get(OBC.FragmentsManager);
      const models = Array.from(fragmentsManager.list.values());

      if (models.length === 0) {
        logger.warn('ClashDetectionManager', 'No models loaded');
        return [];
      }

      logger.info('ClashDetectionManager', `Found ${models.length} models to check`);

      // For each rule
      for (const rule of rules) {
        logger.info('ClashDetectionManager', `Running rule: ${rule.name}`);

        // Get elements in set A and set B
        const elementsA = await this.getElementsByRule(models, rule.setA);
        const elementsB = await this.getElementsByRule(models, rule.setB);

        logger.info('ClashDetectionManager',
          `Set A: ${elementsA.length} elements, Set B: ${elementsB.length} elements`);

        // Check each pair for intersections
        const clashes = await this.checkIntersections(
          elementsA,
          elementsB,
          rule
        );

        newClashes.push(...clashes);

        logger.info('ClashDetectionManager',
          `Rule ${rule.name} found ${clashes.length} clashes`);
      }

      // Store new clashes
      for (const clash of newClashes) {
        this.clashes.set(clash.id, clash);
      }

      // Emit completion event
      logger.info('ClashDetectionManager',
        `Clash detection complete: ${newClashes.length} total clashes`);

      eventBus.emit(Events.CLASH_DETECTION_COMPLETE, {
        total: newClashes.length,
        hard: newClashes.filter(c => c.severity === ClashSeverity.HARD).length,
        soft: newClashes.filter(c => c.severity === ClashSeverity.SOFT).length
      });

      return newClashes;

    } catch (error) {
      logger.error('ClashDetectionManager', 'Error during clash detection:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check intersections between two sets of elements
   */
  private async checkIntersections(
    elementsA: ElementRef[],
    elementsB: ElementRef[],
    rule: ClashRule
  ): Promise<Clash[]> {
    const clashes: Clash[] = [];

    // Get bounding boxes for all elements (optimization)
    const boxesA = elementsA.map(e => this.getBoundingBox(e));
    const boxesB = elementsB.map(e => this.getBoundingBox(e));

    // Broad phase: check bounding box intersections
    for (let i = 0; i < elementsA.length; i++) {
      for (let j = 0; j < elementsB.length; j++) {
        // Skip if same element
        if (elementsA[i].expressID === elementsB[j].expressID &&
            elementsA[i].model === elementsB[j].model) {
          continue;
        }

        // Check bounding box intersection
        if (!boxesA[i].intersectsBox(boxesB[j])) {
          continue;
        }

        // Narrow phase: detailed intersection check
        const intersection = this.checkDetailedIntersection(
          elementsA[i],
          elementsB[j],
          boxesA[i],
          boxesB[j],
          rule.tolerance
        );

        if (intersection) {
          const clash = this.createClash(
            elementsA[i],
            elementsB[j],
            intersection,
            rule
          );
          clashes.push(clash);
        }
      }

      // Update progress
      if (i % 10 === 0) {
        eventBus.emit(Events.CLASH_DETECTION_PROGRESS, {
          current: i,
          total: elementsA.length
        });
      }
    }

    return clashes;
  }

  /**
   * Get bounding box for element
   */
  private getBoundingBox(element: ElementRef): THREE.Box3 {
    const box = new THREE.Box3();

    try {
      // Get geometry from model
      const geometry = this.getElementGeometry(element);
      if (!geometry) {
        return box;
      }

      // Compute bounding box if not already computed
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      if (geometry.boundingBox) {
        box.copy(geometry.boundingBox);

        // Apply transformation matrix if available
        if (element.matrix) {
          box.applyMatrix4(element.matrix);
        }
      }
    } catch (error) {
      logger.error('ClashDetectionManager',
        `Error computing bounding box for element ${element.expressID}:`, error);
    }

    return box;
  }

  /**
   * Get geometry for an element
   */
  private getElementGeometry(element: ElementRef): THREE.BufferGeometry | null {
    try {
      const model = element.model;
      const expressID = element.expressID;

      // Get fragment ID map from model
      const fragmentIDMap = model.data.get(expressID);
      if (!fragmentIDMap) {
        return null;
      }

      // Get first fragment geometry (simplified approach)
      for (const [fragID] of fragmentIDMap) {
        const fragment = model.fragments.get(fragID);
        if (fragment?.mesh?.geometry) {
          return fragment.mesh.geometry;
        }
      }
    } catch (error) {
      logger.error('ClashDetectionManager',
        `Error getting geometry for element ${element.expressID}:`, error);
    }

    return null;
  }

  /**
   * Detailed intersection check between two elements
   */
  private checkDetailedIntersection(
    _elementA: ElementRef,
    _elementB: ElementRef,
    boxA: THREE.Box3,
    boxB: THREE.Box3,
    tolerance: number
  ): ClashIntersection | null {
    // Expand box A by tolerance
    const expandedBoxA = boxA.clone();
    expandedBoxA.expandByScalar(tolerance);

    // Check if expanded box intersects with box B
    if (!expandedBoxA.intersectsBox(boxB)) {
      return null;
    }

    // Calculate intersection box
    const intersectionBox = new THREE.Box3();
    intersectionBox.copy(expandedBoxA).intersect(boxB);

    // Calculate intersection point (center of overlap)
    const point = new THREE.Vector3();
    intersectionBox.getCenter(point);

    // Calculate intersection volume
    const size = new THREE.Vector3();
    intersectionBox.getSize(size);
    const volume = size.x * size.y * size.z;

    return {
      point,
      volume
    };
  }

  /**
   * Create a clash object from detected intersection
   */
  private createClash(
    elementA: ElementRef,
    elementB: ElementRef,
    intersection: ClashIntersection,
    rule: ClashRule
  ): Clash {
    const id = `clash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const clash: Clash = {
      id,
      severity: rule.checkType === 'hard' ? ClashSeverity.HARD : ClashSeverity.SOFT,
      status: ClashStatus.NEW,
      elementA: {
        model: elementA.model,
        expressID: elementA.expressID,
        type: elementA.type,
        name: elementA.name
      },
      elementB: {
        model: elementB.model,
        expressID: elementB.expressID,
        type: elementB.type,
        name: elementB.name
      },
      intersection,
      created: new Date()
    };

    eventBus.emit(Events.CLASH_CREATED, clash);
    return clash;
  }

  /**
   * Get elements from models that match rule filter
   */
  private async getElementsByRule(
    models: any[], // FRAGS.FragmentsGroup[] - using any due to library export issues
    filter: { types?: string[]; properties?: Map<string, any> }
  ): Promise<ElementRef[]> {
    const elements: ElementRef[] = [];

    for (const model of models) {
      try {
        // Get all elements with properties
        const properties = await model.getAllPropertiesOfType();
        if (!properties) continue;

        // Iterate through all IFC types in the model
        for (const [expressID, props] of properties) {
          // Check if element matches type filter
          if (filter.types && filter.types.length > 0) {
            const elementType = props.type || '';

            // Check if type matches any in the filter
            const matchesType = filter.types.some(t =>
              elementType.includes(t) || t.includes(elementType)
            );

            if (!matchesType) {
              continue;
            }
          }

          // TODO: Add property filter support
          // if (filter.properties) { ... }

          // Add element to results
          elements.push({
            model,
            expressID: Number(expressID),
            type: props.type || 'Unknown',
            name: props.Name?.value || props.name || undefined
          });
        }
      } catch (error) {
        logger.error('ClashDetectionManager',
          `Error processing model:`, error);
      }
    }

    return elements;
  }

  /**
   * Setup default clash detection rules
   */
  private setupDefaultRules(): void {
    // Rule 1: Structural clashes
    this.addRule({
      id: 'structural',
      name: 'Structural Elements',
      enabled: true,
      setA: {
        types: ['IfcWall', 'IfcSlab', 'IfcColumn', 'IfcBeam']
      },
      setB: {
        types: ['IfcWall', 'IfcSlab', 'IfcColumn', 'IfcBeam']
      },
      tolerance: 0,
      checkType: 'hard'
    });

    // Rule 2: MEP vs Structure
    this.addRule({
      id: 'mep-structure',
      name: 'MEP vs Structure',
      enabled: true,
      setA: {
        types: ['IfcPipeSegment', 'IfcDuctSegment', 'IfcCableSegment',
                'IfcFlowSegment', 'IfcDistributionElement']
      },
      setB: {
        types: ['IfcWall', 'IfcSlab', 'IfcColumn', 'IfcBeam', 'IfcRoof']
      },
      tolerance: 0,
      checkType: 'hard'
    });

    // Rule 3: Clearance check
    this.addRule({
      id: 'clearance',
      name: 'Clearance Requirements',
      enabled: false,
      setA: {
        types: ['IfcDoor', 'IfcWindow']
      },
      setB: {
        types: ['IfcFurnishingElement', 'IfcFurniture']
      },
      tolerance: 100,  // 100mm clearance
      checkType: 'soft'
    });

    logger.debug('ClashDetectionManager', 'Default rules setup complete');
  }

  /**
   * Add a clash detection rule
   */
  public addRule(rule: ClashRule): void {
    this.rules.set(rule.id, rule);
    logger.info('ClashDetectionManager', `Added rule: ${rule.name}`);
  }

  /**
   * Remove a rule
   */
  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('ClashDetectionManager', `Removed rule: ${ruleId}`);
  }

  /**
   * Get all rules
   */
  public getRules(): ClashRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a rule by ID
   */
  public getRule(ruleId: string): ClashRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Toggle rule enabled state
   */
  public toggleRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      logger.info('ClashDetectionManager',
        `Rule ${rule.name} ${rule.enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get all clashes
   */
  public getClashes(): Clash[] {
    return Array.from(this.clashes.values());
  }

  /**
   * Get a clash by ID
   */
  public getClash(clashId: string): Clash | undefined {
    return this.clashes.get(clashId);
  }

  /**
   * Update clash status
   */
  public updateClashStatus(clashId: string, status: ClashStatus): void {
    const clash = this.clashes.get(clashId);
    if (clash) {
      clash.status = status;
      clash.modified = new Date();
      this.clashes.set(clashId, clash);

      eventBus.emit(Events.CLASH_UPDATED, clash);

      if (status === ClashStatus.RESOLVED) {
        eventBus.emit(Events.CLASH_RESOLVED, clash);
      }

      logger.info('ClashDetectionManager',
        `Clash ${clashId} status updated to ${status}`);
    }
  }

  /**
   * Clear all clashes
   */
  public clearClashes(): void {
    this.clearAllVisualizations();
    this.clashes.clear();
    logger.info('ClashDetectionManager', 'All clashes cleared');
  }

  /**
   * Visualize a clash with sphere marker
   */
  public visualizeClash(clashId: string): void {
    const clash = this.clashes.get(clashId);
    if (!clash) return;

    // Remove existing visualization
    this.removeVisualization(clashId);

    const markers: THREE.Object3D[] = [];

    // Create sphere at intersection point
    const geometry = new THREE.SphereGeometry(0.3);
    const material = new THREE.MeshBasicMaterial({
      color: this.getSeverityColor(clash.severity),
      transparent: true,
      opacity: 0.7,
      depthTest: false
    });

    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(clash.intersection.point);
    marker.name = `clash-marker-${clashId}`;
    marker.renderOrder = 999;

    this.world.scene.three.add(marker);
    markers.push(marker);

    // Highlight clashing elements
    this.highlightClashElements(clash);

    this.visualMarkers.set(clashId, markers);

    logger.debug('ClashDetectionManager', `Visualized clash ${clashId}`);
  }

  /**
   * Remove visualization for a clash
   */
  public removeVisualization(clashId: string): void {
    const markers = this.visualMarkers.get(clashId);
    if (markers) {
      markers.forEach(marker => {
        this.world.scene.three.remove(marker);
        if (marker instanceof THREE.Mesh) {
          marker.geometry.dispose();
          if (marker.material instanceof THREE.Material) {
            marker.material.dispose();
          }
        }
      });
      this.visualMarkers.delete(clashId);
    }
  }

  /**
   * Clear all visualizations
   */
  public clearAllVisualizations(): void {
    for (const clashId of this.visualMarkers.keys()) {
      this.removeVisualization(clashId);
    }
  }

  /**
   * Highlight clashing elements
   * Note: Highlighting will be handled by viewport's highlighter when elements are selected
   */
  private highlightClashElements(clash: Clash): void {
    // Store which elements should be highlighted
    // The actual highlighting will be done by the Viewport's Highlighter
    // when the user views or focuses on the clash
    logger.debug('ClashDetectionManager',
      `Clash elements marked for highlighting: ${clash.elementA.expressID}, ${clash.elementB.expressID}`);
  }

  /**
   * Focus camera on clash
   */
  public focusOnClash(clashId: string): void {
    const clash = this.clashes.get(clashId);
    if (!clash) return;

    const camera = this.world.camera as OBC.OrthoPerspectiveCamera;

    if (camera?.controls) {
      const point = clash.intersection.point;

      // Calculate camera position (offset from clash point)
      const offset = 5;

      camera.controls.setLookAt(
        point.x + offset,
        point.y + offset,
        point.z + offset,
        point.x,
        point.y,
        point.z,
        true
      );

      logger.debug('ClashDetectionManager', `Focused on clash ${clashId}`);
    }
  }

  /**
   * Get severity color for visualization
   */
  private getSeverityColor(severity: ClashSeverity): number {
    switch (severity) {
      case ClashSeverity.HARD:
        return 0xff0000; // Red
      case ClashSeverity.SOFT:
        return 0xffaa00; // Orange
      case ClashSeverity.WARNING:
        return 0xffff00; // Yellow
      default:
        return 0xff0000;
    }
  }

  /**
   * Get clash statistics
   */
  public getStats(): ClashStats {
    const clashes = Array.from(this.clashes.values());

    return {
      total: clashes.length,
      hard: clashes.filter(c => c.severity === ClashSeverity.HARD).length,
      soft: clashes.filter(c => c.severity === ClashSeverity.SOFT).length,
      warning: clashes.filter(c => c.severity === ClashSeverity.WARNING).length,
      new: clashes.filter(c => c.status === ClashStatus.NEW).length,
      active: clashes.filter(c => c.status === ClashStatus.ACTIVE).length,
      resolved: clashes.filter(c => c.status === ClashStatus.RESOLVED).length,
      approved: clashes.filter(c => c.status === ClashStatus.APPROVED).length,
      ignored: clashes.filter(c => c.status === ClashStatus.IGNORED).length
    };
  }

  /**
   * Export clashes to CSV format
   */
  public exportToCSV(): string {
    let csv = 'ID,Severity,Status,Element A Type,Element A ID,Element B Type,Element B ID,Location X,Location Y,Location Z,Volume,Created\n';

    for (const clash of this.clashes.values()) {
      const pos = clash.intersection.point;
      const volume = clash.intersection.volume?.toFixed(4) || 'N/A';

      csv += `"${clash.id}",`;
      csv += `${clash.severity},`;
      csv += `${clash.status},`;
      csv += `${clash.elementA.type},`;
      csv += `${clash.elementA.expressID},`;
      csv += `${clash.elementB.type},`;
      csv += `${clash.elementB.expressID},`;
      csv += `${pos.x.toFixed(3)},`;
      csv += `${pos.y.toFixed(3)},`;
      csv += `${pos.z.toFixed(3)},`;
      csv += `${volume},`;
      csv += `${clash.created.toISOString()}\n`;
    }

    return csv;
  }

  /**
   * Export clashes to BCF-JSON format
   */
  public exportToBCF(): string {
    const bcf: BCFExport = {
      project: {
        name: 'Clash Detection Results',
        date: new Date().toISOString()
      },
      topics: Array.from(this.clashes.values()).map(clash => ({
        guid: clash.id,
        title: `Clash: ${clash.elementA.type} vs ${clash.elementB.type}`,
        priority: clash.severity === ClashSeverity.HARD ? 'high' : 'normal',
        status: clash.status,
        creation_date: clash.created.toISOString(),
        viewpoint: {
          camera_position: clash.intersection.point,
          elements: [clash.elementA.expressID, clash.elementB.expressID]
        }
      }))
    };

    return JSON.stringify(bcf, null, 2);
  }

  /**
   * Check if clash detection is running
   */
  public isDetectionRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Dispose the manager
   */
  public dispose(): void {
    this.clearAllVisualizations();
    this.clashes.clear();
    this.rules.clear();
    logger.info('ClashDetectionManager', 'ClashDetectionManager disposed');
  }
}
