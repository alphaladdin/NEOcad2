/**
 * ModelComparisonManager - Manages model comparisons and visualizations
 */

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { ModelComparison, ComparisonResult, ComparisonStatus } from '@tools/ModelComparison';

export interface ModelComparisonConfig {
  showUnchanged?: boolean;
  colorByStatus?: boolean;
  propertiesToCompare?: string[];
}

export class ModelComparisonManager {
  private scene: THREE.Scene;
  private components: OBC.Components;
  private activeComparison: ModelComparison | null = null;
  private comparisons: Map<string, ModelComparison> = new Map();
  private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();
  private config: ModelComparisonConfig;

  constructor(scene: THREE.Scene, components: OBC.Components, config: ModelComparisonConfig = {}) {
    this.scene = scene;
    this.components = components;
    this.config = {
      showUnchanged: config.showUnchanged !== false,
      colorByStatus: config.colorByStatus !== false,
      propertiesToCompare: config.propertiesToCompare || [],
    };

    logger.info('ModelComparisonManager', 'ModelComparisonManager created');
  }

  /**
   * Create a new comparison between two models
   */
  async createComparison(
    name: string,
    baseModelFragments: OBC.FragmentsGroup,
    compareModelFragments: OBC.FragmentsGroup
  ): Promise<ModelComparison> {
    logger.info('ModelComparisonManager', `Creating comparison: ${name}`);

    const comparison = new ModelComparison(
      name,
      baseModelFragments.name || 'Base Model',
      compareModelFragments.name || 'Compare Model'
    );

    // Extract element data from both models
    const baseElements = this.extractElementData(baseModelFragments);
    const compareElements = this.extractElementData(compareModelFragments);

    // Compare elements
    const results = ModelComparison.compareElements(
      baseElements,
      compareElements,
      this.config.propertiesToCompare
    );

    // Add results to comparison
    results.forEach((result) => comparison.addResult(result));

    // Store comparison
    this.comparisons.set(comparison.id, comparison);

    logger.info(
      'ModelComparisonManager',
      `Comparison complete: ${comparison.getTotalDifferences()} differences found`
    );

    eventBus.emit(Events.MODEL_COMPARISON_CREATED, { comparison });

    return comparison;
  }

  /**
   * Extract element data from fragments group
   */
  private extractElementData(fragments: OBC.FragmentsGroup): Map<string, any> {
    const elements = new Map<string, any>();

    try {
      // Iterate through all fragments in the group
      for (const fragment of fragments.items) {
        const fragmentData = fragment.data;
        if (!fragmentData) continue;

        // Get all express IDs in this fragment
        const ids = fragment.ids;
        for (const expressId of ids) {
          // Get properties for this element
          const properties = fragmentData[expressId];
          if (properties) {
            elements.set(expressId.toString(), properties);
          }
        }
      }
    } catch (error) {
      logger.error('ModelComparisonManager', 'Error extracting element data', error);
    }

    return elements;
  }

  /**
   * Apply a comparison visualization
   */
  applyComparison(comparisonId: string): void {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) {
      logger.warn('ModelComparisonManager', `Comparison ${comparisonId} not found`);
      return;
    }

    // Clear previous comparison
    if (this.activeComparison) {
      this.clearComparison();
    }

    this.activeComparison = comparison;

    if (this.config.colorByStatus) {
      this.applyColorVisualization(comparison);
    }

    logger.info('ModelComparisonManager', `Applied comparison: ${comparison.name}`);
    eventBus.emit(Events.MODEL_COMPARISON_APPLIED, { comparison });
  }

  /**
   * Apply color visualization based on comparison status
   */
  private applyColorVisualization(comparison: ModelComparison): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const userData = object.userData;
        const elementId = userData.expressID?.toString() || userData.id?.toString();

        if (elementId) {
          const result = comparison.getResult(elementId);
          if (result) {
            // Skip unchanged elements if configured
            if (!this.config.showUnchanged && result.status === 'unchanged') {
              object.visible = false;
              return;
            }

            // Store original material
            if (!this.originalMaterials.has(elementId)) {
              this.originalMaterials.set(elementId, object.material);
            }

            // Apply status color
            const color = ModelComparison.getStatusColor(result.status);
            const statusMaterial = new THREE.MeshBasicMaterial({
              color: color,
              transparent: true,
              opacity: 0.8,
            });

            object.material = statusMaterial;
          }
        }
      }
    });

    logger.debug('ModelComparisonManager', 'Color visualization applied');
  }

  /**
   * Clear active comparison visualization
   */
  clearComparison(): void {
    if (!this.activeComparison) return;

    // Restore original materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const userData = object.userData;
        const elementId = userData.expressID?.toString() || userData.id?.toString();

        if (elementId && this.originalMaterials.has(elementId)) {
          object.material = this.originalMaterials.get(elementId)!;
          object.visible = true;
        }
      }
    });

    this.originalMaterials.clear();
    this.activeComparison = null;

    logger.info('ModelComparisonManager', 'Comparison visualization cleared');
    eventBus.emit(Events.MODEL_COMPARISON_CLEARED);
  }

  /**
   * Get active comparison
   */
  getActiveComparison(): ModelComparison | null {
    return this.activeComparison;
  }

  /**
   * Get all comparisons
   */
  getAllComparisons(): ModelComparison[] {
    return Array.from(this.comparisons.values());
  }

  /**
   * Get a comparison by ID
   */
  getComparison(comparisonId: string): ModelComparison | undefined {
    return this.comparisons.get(comparisonId);
  }

  /**
   * Remove a comparison
   */
  removeComparison(comparisonId: string): void {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) {
      logger.warn('ModelComparisonManager', `Comparison ${comparisonId} not found`);
      return;
    }

    // Clear if it's the active comparison
    if (this.activeComparison?.id === comparisonId) {
      this.clearComparison();
    }

    this.comparisons.delete(comparisonId);

    logger.info('ModelComparisonManager', `Removed comparison: ${comparison.name}`);
    eventBus.emit(Events.MODEL_COMPARISON_REMOVED, { id: comparisonId });
  }

  /**
   * Highlight elements by status
   */
  highlightByStatus(status: ComparisonStatus): void {
    if (!this.activeComparison) return;

    const results = this.activeComparison.getResultsByStatus(status);
    const elementIds = new Set(results.map((r) => r.elementId));

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const userData = object.userData;
        const elementId = userData.expressID?.toString() || userData.id?.toString();

        if (elementId) {
          if (elementIds.has(elementId)) {
            // Highlight matching elements
            object.visible = true;
            const color = ModelComparison.getStatusColor(status);
            object.material = new THREE.MeshBasicMaterial({
              color: color,
              transparent: true,
              opacity: 1.0,
            });
          } else {
            // Dim other elements
            object.visible = this.config.showUnchanged!;
          }
        }
      }
    });

    logger.debug('ModelComparisonManager', `Highlighted ${status} elements`);
  }

  /**
   * Export comparison to JSON
   */
  exportComparison(comparisonId: string): string {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) {
      throw new Error(`Comparison ${comparisonId} not found`);
    }

    return JSON.stringify(comparison.toJSON(), null, 2);
  }

  /**
   * Import comparison from JSON
   */
  importComparison(json: string): ModelComparison {
    try {
      const data = JSON.parse(json);
      const comparison = ModelComparison.fromJSON(data);
      this.comparisons.set(comparison.id, comparison);

      logger.info('ModelComparisonManager', `Imported comparison: ${comparison.name}`);
      eventBus.emit(Events.MODEL_COMPARISON_CREATED, { comparison });

      return comparison;
    } catch (error) {
      logger.error('ModelComparisonManager', 'Failed to import comparison', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModelComparisonConfig>): void {
    this.config = { ...this.config, ...config };

    // Reapply active comparison if exists
    if (this.activeComparison) {
      this.clearComparison();
      this.applyComparison(this.activeComparison.id);
    }

    logger.debug('ModelComparisonManager', 'Configuration updated');
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clearComparison();
    this.comparisons.clear();
    logger.info('ModelComparisonManager', 'ModelComparisonManager disposed');
  }
}
