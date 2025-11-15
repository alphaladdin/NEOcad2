/**
 * ModelComparison - Represents a comparison between two model versions
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export type ComparisonStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ComparisonResult {
  elementId: string;
  status: ComparisonStatus;
  property?: string;
  oldValue?: any;
  newValue?: any;
}

export interface ModelComparisonData {
  id: string;
  name: string;
  baseModelName: string;
  compareModelName: string;
  timestamp: number;
  results: ComparisonResult[];
  stats: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export class ModelComparison {
  public readonly id: string;
  public name: string;
  public baseModelName: string;
  public compareModelName: string;
  public timestamp: number;
  public results: Map<string, ComparisonResult> = new Map();
  public stats: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };

  constructor(name: string, baseModelName: string, compareModelName: string) {
    this.id = THREE.MathUtils.generateUUID();
    this.name = name;
    this.baseModelName = baseModelName;
    this.compareModelName = compareModelName;
    this.timestamp = Date.now();
    this.stats = {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    };

    logger.debug('ModelComparison', `Created comparison: ${name}`);
  }

  /**
   * Add a comparison result
   */
  addResult(result: ComparisonResult): void {
    this.results.set(result.elementId, result);
    this.stats[result.status]++;
  }

  /**
   * Get result for a specific element
   */
  getResult(elementId: string): ComparisonResult | undefined {
    return this.results.get(elementId);
  }

  /**
   * Get all results with a specific status
   */
  getResultsByStatus(status: ComparisonStatus): ComparisonResult[] {
    return Array.from(this.results.values()).filter((r) => r.status === status);
  }

  /**
   * Get color for a comparison status
   */
  static getStatusColor(status: ComparisonStatus): THREE.Color {
    switch (status) {
      case 'added':
        return new THREE.Color(0x00ff00); // Green
      case 'removed':
        return new THREE.Color(0xff0000); // Red
      case 'modified':
        return new THREE.Color(0xffaa00); // Orange
      case 'unchanged':
        return new THREE.Color(0x808080); // Gray
      default:
        return new THREE.Color(0xffffff); // White
    }
  }

  /**
   * Get status label
   */
  static getStatusLabel(status: ComparisonStatus): string {
    switch (status) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'modified':
        return 'Modified';
      case 'unchanged':
        return 'Unchanged';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get total differences (excluding unchanged)
   */
  getTotalDifferences(): number {
    return this.stats.added + this.stats.removed + this.stats.modified;
  }

  /**
   * Get total elements compared
   */
  getTotalElements(): number {
    return this.results.size;
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results.clear();
    this.stats = {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    };
    logger.debug('ModelComparison', 'Cleared all results');
  }

  /**
   * Export comparison data
   */
  toJSON(): ModelComparisonData {
    return {
      id: this.id,
      name: this.name,
      baseModelName: this.baseModelName,
      compareModelName: this.compareModelName,
      timestamp: this.timestamp,
      results: Array.from(this.results.values()),
      stats: { ...this.stats },
    };
  }

  /**
   * Import comparison from JSON
   */
  static fromJSON(data: ModelComparisonData): ModelComparison {
    const comparison = new ModelComparison(data.name, data.baseModelName, data.compareModelName);
    comparison.timestamp = data.timestamp;
    comparison.stats = { ...data.stats };

    data.results.forEach((result) => {
      comparison.results.set(result.elementId, result);
    });

    return comparison;
  }

  /**
   * Compare two sets of element properties
   */
  static compareElements(
    baseElements: Map<string, any>,
    compareElements: Map<string, any>,
    propertiesToCompare: string[] = []
  ): ComparisonResult[] {
    const results: ComparisonResult[] = [];
    const processedIds = new Set<string>();

    // Check base elements
    baseElements.forEach((baseProps, elementId) => {
      processedIds.add(elementId);

      if (!compareElements.has(elementId)) {
        // Element removed
        results.push({
          elementId,
          status: 'removed',
        });
      } else {
        // Element exists in both - check for modifications
        const compareProps = compareElements.get(elementId);
        const modifications = this.findPropertyDifferences(
          baseProps,
          compareProps,
          propertiesToCompare
        );

        if (modifications.length > 0) {
          modifications.forEach((mod) => {
            results.push({
              elementId,
              status: 'modified',
              property: mod.property,
              oldValue: mod.oldValue,
              newValue: mod.newValue,
            });
          });
        } else {
          results.push({
            elementId,
            status: 'unchanged',
          });
        }
      }
    });

    // Check for new elements in compare model
    compareElements.forEach((compareProps, elementId) => {
      if (!processedIds.has(elementId)) {
        results.push({
          elementId,
          status: 'added',
        });
      }
    });

    return results;
  }

  /**
   * Find differences between two property sets
   */
  private static findPropertyDifferences(
    baseProps: any,
    compareProps: any,
    propertiesToCompare: string[] = []
  ): Array<{ property: string; oldValue: any; newValue: any }> {
    const differences: Array<{ property: string; oldValue: any; newValue: any }> = [];

    // If no specific properties specified, compare all properties
    const propsToCheck =
      propertiesToCompare.length > 0
        ? propertiesToCompare
        : Object.keys({ ...baseProps, ...compareProps });

    propsToCheck.forEach((prop) => {
      const baseValue = baseProps[prop];
      const compareValue = compareProps[prop];

      if (!this.areValuesEqual(baseValue, compareValue)) {
        differences.push({
          property: prop,
          oldValue: baseValue,
          newValue: compareValue,
        });
      }
    });

    return differences;
  }

  /**
   * Compare two values for equality (handles objects, arrays, primitives)
   */
  private static areValuesEqual(value1: any, value2: any): boolean {
    // Handle null/undefined
    if (value1 === value2) return true;
    if (value1 == null || value2 == null) return false;

    // Handle arrays
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) return false;
      return value1.every((val, index) => this.areValuesEqual(val, value2[index]));
    }

    // Handle objects
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      const keys1 = Object.keys(value1);
      const keys2 = Object.keys(value2);

      if (keys1.length !== keys2.length) return false;

      return keys1.every((key) => this.areValuesEqual(value1[key], value2[key]));
    }

    // Primitives
    return value1 === value2;
  }
}
