/**
 * FilterRule - Represents a filter rule for querying and filtering BIM elements
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export type FilterOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'starts-with'
  | 'ends-with'
  | 'greater-than'
  | 'less-than'
  | 'greater-or-equal'
  | 'less-or-equal'
  | 'in'
  | 'not-in'
  | 'exists'
  | 'not-exists';

export type FilterLogic = 'AND' | 'OR';

export interface FilterCondition {
  property: string;
  operator: FilterOperator;
  value?: any;
}

export interface FilterRuleData {
  id: string;
  name: string;
  description: string;
  conditions: FilterCondition[];
  logic: FilterLogic;
  color?: { r: number; g: number; b: number };
  visible: boolean;
  isolate: boolean;
  createdAt: number;
  updatedAt: number;
}

export class FilterRule {
  public readonly id: string;
  public name: string;
  public description: string;
  public conditions: FilterCondition[];
  public logic: FilterLogic;
  public color: THREE.Color | null;
  public visible: boolean;
  public isolate: boolean;
  public createdAt: number;
  public updatedAt: number;

  // Matched elements cache
  private matchedElements: Set<string> = new Set();

  constructor(
    name: string,
    description: string = '',
    conditions: FilterCondition[] = [],
    logic: FilterLogic = 'AND'
  ) {
    this.id = THREE.MathUtils.generateUUID();
    this.name = name;
    this.description = description;
    this.conditions = conditions;
    this.logic = logic;
    this.color = null;
    this.visible = true;
    this.isolate = false;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    logger.debug('FilterRule', `Created filter rule: ${name}`);
  }

  /**
   * Add a condition to the filter
   */
  addCondition(condition: FilterCondition): void {
    this.conditions.push(condition);
    this.updatedAt = Date.now();
    this.matchedElements.clear();
  }

  /**
   * Remove a condition from the filter
   */
  removeCondition(index: number): void {
    if (index >= 0 && index < this.conditions.length) {
      this.conditions.splice(index, 1);
      this.updatedAt = Date.now();
      this.matchedElements.clear();
    }
  }

  /**
   * Update a condition
   */
  updateCondition(index: number, condition: FilterCondition): void {
    if (index >= 0 && index < this.conditions.length) {
      this.conditions[index] = condition;
      this.updatedAt = Date.now();
      this.matchedElements.clear();
    }
  }

  /**
   * Test if an element matches this filter rule
   */
  matches(elementData: Record<string, any>): boolean {
    if (this.conditions.length === 0) {
      return false;
    }

    const results = this.conditions.map((condition) =>
      this.evaluateCondition(condition, elementData)
    );

    if (this.logic === 'AND') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: FilterCondition, elementData: Record<string, any>): boolean {
    const { property, operator, value } = condition;
    const elementValue = this.getPropertyValue(elementData, property);

    switch (operator) {
      case 'equals':
        return elementValue === value;

      case 'not-equals':
        return elementValue !== value;

      case 'contains':
        if (typeof elementValue === 'string' && typeof value === 'string') {
          return elementValue.toLowerCase().includes(value.toLowerCase());
        }
        if (Array.isArray(elementValue)) {
          return elementValue.includes(value);
        }
        return false;

      case 'not-contains':
        if (typeof elementValue === 'string' && typeof value === 'string') {
          return !elementValue.toLowerCase().includes(value.toLowerCase());
        }
        if (Array.isArray(elementValue)) {
          return !elementValue.includes(value);
        }
        return true;

      case 'starts-with':
        if (typeof elementValue === 'string' && typeof value === 'string') {
          return elementValue.toLowerCase().startsWith(value.toLowerCase());
        }
        return false;

      case 'ends-with':
        if (typeof elementValue === 'string' && typeof value === 'string') {
          return elementValue.toLowerCase().endsWith(value.toLowerCase());
        }
        return false;

      case 'greater-than':
        if (typeof elementValue === 'number' && typeof value === 'number') {
          return elementValue > value;
        }
        return false;

      case 'less-than':
        if (typeof elementValue === 'number' && typeof value === 'number') {
          return elementValue < value;
        }
        return false;

      case 'greater-or-equal':
        if (typeof elementValue === 'number' && typeof value === 'number') {
          return elementValue >= value;
        }
        return false;

      case 'less-or-equal':
        if (typeof elementValue === 'number' && typeof value === 'number') {
          return elementValue <= value;
        }
        return false;

      case 'in':
        if (Array.isArray(value)) {
          return value.includes(elementValue);
        }
        return false;

      case 'not-in':
        if (Array.isArray(value)) {
          return !value.includes(elementValue);
        }
        return true;

      case 'exists':
        return elementValue !== undefined && elementValue !== null;

      case 'not-exists':
        return elementValue === undefined || elementValue === null;

      default:
        logger.warn('FilterRule', `Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get property value from element data (supports nested properties)
   */
  private getPropertyValue(elementData: Record<string, any>, propertyPath: string): any {
    const parts = propertyPath.split('.');
    let value: any = elementData;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Set color for this filter
   */
  setColor(color: THREE.Color): void {
    this.color = color;
    this.updatedAt = Date.now();
  }

  /**
   * Clear color
   */
  clearColor(): void {
    this.color = null;
    this.updatedAt = Date.now();
  }

  /**
   * Cache matched elements
   */
  setMatchedElements(elementIds: string[]): void {
    this.matchedElements = new Set(elementIds);
  }

  /**
   * Get cached matched elements
   */
  getMatchedElements(): string[] {
    return Array.from(this.matchedElements);
  }

  /**
   * Check if element is in cache
   */
  hasMatchedElement(elementId: string): boolean {
    return this.matchedElements.has(elementId);
  }

  /**
   * Clear matched elements cache
   */
  clearMatchedElements(): void {
    this.matchedElements.clear();
  }

  /**
   * Get a human-readable description of the filter
   */
  getDescription(): string {
    if (this.conditions.length === 0) {
      return 'No conditions';
    }

    const conditionStrings = this.conditions.map((c) => {
      const operator = this.getOperatorLabel(c.operator);
      const value = c.value !== undefined ? ` "${c.value}"` : '';
      return `${c.property} ${operator}${value}`;
    });

    return conditionStrings.join(` ${this.logic} `);
  }

  /**
   * Get operator label
   */
  private getOperatorLabel(operator: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
      'equals': '=',
      'not-equals': '≠',
      'contains': 'contains',
      'not-contains': 'does not contain',
      'starts-with': 'starts with',
      'ends-with': 'ends with',
      'greater-than': '>',
      'less-than': '<',
      'greater-or-equal': '≥',
      'less-or-equal': '≤',
      'in': 'in',
      'not-in': 'not in',
      'exists': 'exists',
      'not-exists': 'does not exist',
    };
    return labels[operator] || operator;
  }

  /**
   * Export filter rule data
   */
  toJSON(): FilterRuleData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      conditions: this.conditions.map((c) => ({ ...c })),
      logic: this.logic,
      color: this.color
        ? { r: this.color.r, g: this.color.g, b: this.color.b }
        : undefined,
      visible: this.visible,
      isolate: this.isolate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Import filter rule from data
   */
  static fromJSON(data: FilterRuleData): FilterRule {
    const rule = new FilterRule(data.name, data.description, data.conditions, data.logic);

    rule.visible = data.visible;
    rule.isolate = data.isolate;
    rule.createdAt = data.createdAt;
    rule.updatedAt = data.updatedAt;

    if (data.color) {
      rule.color = new THREE.Color(data.color.r, data.color.g, data.color.b);
    }

    return rule;
  }

  /**
   * Clone this filter rule
   */
  clone(): FilterRule {
    const cloned = new FilterRule(
      `${this.name} (Copy)`,
      this.description,
      this.conditions.map((c) => ({ ...c })),
      this.logic
    );

    cloned.visible = this.visible;
    cloned.isolate = this.isolate;

    if (this.color) {
      cloned.color = this.color.clone();
    }

    return cloned;
  }
}
