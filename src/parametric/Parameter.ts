/**
 * Parameter - Represents a parametric value with dependencies and formulas
 */

import { logger } from '@utils/Logger';

export enum ParameterType {
  LENGTH = 'length',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  STRING = 'string',
  VECTOR3 = 'vector3',
  MATERIAL = 'material',
  REFERENCE = 'reference',
}

export enum ParameterUnit {
  // Length
  MM = 'mm',
  CM = 'cm',
  M = 'm',
  IN = 'in',
  FT = 'ft',

  // Angle
  DEGREES = 'degrees',
  RADIANS = 'radians',

  // Area
  MM2 = 'mm²',
  M2 = 'm²',
  FT2 = 'ft²',

  // Volume
  MM3 = 'mm³',
  M3 = 'm³',
  FT3 = 'ft³',

  // None
  NONE = 'none',
}

export interface ParameterOptions {
  name: string;
  value: any;
  type: ParameterType;
  unit?: ParameterUnit;
  formula?: string;
  isReadOnly?: boolean;
  description?: string;
  group?: string;
}

export class Parameter {
  public readonly id: string;
  public name: string;
  public type: ParameterType;
  public unit: ParameterUnit;
  public description: string;
  public group: string;
  public isReadOnly: boolean;

  private _value: any;
  private _formula: string | null;
  private _dependencies: Set<Parameter>;
  private _dependents: Set<Parameter>;
  private _isEvaluating: boolean;

  constructor(options: ParameterOptions) {
    this.id = this.generateId();
    this.name = options.name;
    this.type = options.type;
    this.unit = options.unit || ParameterUnit.NONE;
    this.description = options.description || '';
    this.group = options.group || 'General';
    this.isReadOnly = options.isReadOnly || false;

    this._value = options.value;
    this._formula = options.formula || null;
    this._dependencies = new Set();
    this._dependents = new Set();
    this._isEvaluating = false;

    logger.debug('Parameter', `Created parameter: ${this.name} = ${this._value}`);
  }

  private generateId(): string {
    return `param_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current value
   */
  get value(): any {
    return this._value;
  }

  /**
   * Set the value (if not formula-driven)
   */
  set value(newValue: any) {
    if (this.isReadOnly) {
      logger.warn('Parameter', `Cannot set value for read-only parameter: ${this.name}`);
      return;
    }

    if (this._formula) {
      logger.warn('Parameter', `Cannot set value for formula-driven parameter: ${this.name}`);
      return;
    }

    if (this._value !== newValue) {
      this._value = newValue;
      logger.debug('Parameter', `Updated parameter: ${this.name} = ${this._value}`);
    }
  }

  /**
   * Get the formula
   */
  get formula(): string | null {
    return this._formula;
  }

  /**
   * Set the formula
   */
  set formula(formula: string | null) {
    this._formula = formula;
    if (formula) {
      logger.debug('Parameter', `Set formula for ${this.name}: ${formula}`);
    }
  }

  /**
   * Check if this parameter has a formula
   */
  get hasFormula(): boolean {
    return this._formula !== null;
  }

  /**
   * Check if this parameter is currently being evaluated
   */
  get isEvaluating(): boolean {
    return this._isEvaluating;
  }

  /**
   * Set evaluating state
   */
  setEvaluating(value: boolean): void {
    this._isEvaluating = value;
  }

  /**
   * Update the value (used by formula evaluation)
   */
  updateValue(newValue: any): void {
    if (this._value !== newValue) {
      const oldValue = this._value;
      this._value = newValue;
      logger.debug(
        'Parameter',
        `Formula updated ${this.name}: ${oldValue} -> ${this._value}`
      );
    }
  }

  /**
   * Add a dependency (this parameter depends on another)
   */
  addDependency(parameter: Parameter): void {
    this._dependencies.add(parameter);
    parameter._dependents.add(this);
  }

  /**
   * Remove a dependency
   */
  removeDependency(parameter: Parameter): void {
    this._dependencies.delete(parameter);
    parameter._dependents.delete(this);
  }

  /**
   * Get all parameters this depends on
   */
  getDependencies(): Parameter[] {
    return Array.from(this._dependencies);
  }

  /**
   * Get all parameters that depend on this
   */
  getDependents(): Parameter[] {
    return Array.from(this._dependents);
  }

  /**
   * Clear all dependencies
   */
  clearDependencies(): void {
    // Remove from dependents
    this._dependencies.forEach((dep) => {
      dep._dependents.delete(this);
    });
    this._dependencies.clear();
  }

  /**
   * Clone this parameter
   */
  clone(): Parameter {
    const cloned = new Parameter({
      name: this.name,
      value: this._value,
      type: this.type,
      unit: this.unit,
      formula: this._formula || undefined,
      isReadOnly: this.isReadOnly,
      description: this.description,
      group: this.group,
    });
    return cloned;
  }

  /**
   * Export to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      value: this._value,
      type: this.type,
      unit: this.unit,
      formula: this._formula,
      isReadOnly: this.isReadOnly,
      description: this.description,
      group: this.group,
    };
  }

  /**
   * Import from JSON
   */
  static fromJSON(data: any): Parameter {
    return new Parameter({
      name: data.name,
      value: data.value,
      type: data.type as ParameterType,
      unit: data.unit as ParameterUnit,
      formula: data.formula,
      isReadOnly: data.isReadOnly,
      description: data.description,
      group: data.group,
    });
  }

  /**
   * Convert unit (basic implementation)
   */
  static convertUnit(value: number, fromUnit: ParameterUnit, toUnit: ParameterUnit): number {
    if (fromUnit === toUnit) return value;

    // Length conversions
    const lengthToMM: Record<string, number> = {
      [ParameterUnit.MM]: 1,
      [ParameterUnit.CM]: 10,
      [ParameterUnit.M]: 1000,
      [ParameterUnit.IN]: 25.4,
      [ParameterUnit.FT]: 304.8,
    };

    // Angle conversions
    const angleToRadians: Record<string, number> = {
      [ParameterUnit.RADIANS]: 1,
      [ParameterUnit.DEGREES]: Math.PI / 180,
    };

    // Try length conversion
    if (lengthToMM[fromUnit] && lengthToMM[toUnit]) {
      const mm = value * lengthToMM[fromUnit];
      return mm / lengthToMM[toUnit];
    }

    // Try angle conversion
    if (angleToRadians[fromUnit] && angleToRadians[toUnit]) {
      const radians = value * angleToRadians[fromUnit];
      return radians / angleToRadians[toUnit];
    }

    logger.warn('Parameter', `Cannot convert from ${fromUnit} to ${toUnit}`);
    return value;
  }

  /**
   * Format value with unit
   */
  getFormattedValue(): string {
    let formattedValue = this._value;

    // Format numbers
    if (typeof this._value === 'number') {
      formattedValue = this._value.toFixed(2);
    }

    // Add unit if applicable
    if (this.unit !== ParameterUnit.NONE) {
      return `${formattedValue} ${this.unit}`;
    }

    return formattedValue.toString();
  }
}
