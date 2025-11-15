/**
 * FramingRule - Defines framing validation rules for NEOcad
 * Based on IRC 2021 (International Residential Code) and US construction standards
 */

import type { ParametricWall } from '@parametric/ParametricWall';

/**
 * Rule types for different framing scenarios
 */
export enum FramingRuleType {
  CORNER = 'CORNER',
  T_INTERSECTION = 'T_INTERSECTION',
  CROSS_INTERSECTION = 'CROSS_INTERSECTION',
  OPENING = 'OPENING',
  PLATE_OVERLAP = 'PLATE_OVERLAP',
  STUD_SPACING = 'STUD_SPACING',
  HEADER_SIZING = 'HEADER_SIZING',
  PLATE_CONTINUITY = 'PLATE_CONTINUITY',
  CORNER_POST = 'CORNER_POST',
  BLOCKING = 'BLOCKING',
}

/**
 * Severity levels for validation issues
 */
export enum RuleSeverity {
  ERROR = 'ERROR', // Violates building code, must be fixed
  WARNING = 'WARNING', // Not ideal but acceptable
  INFO = 'INFO', // Informational, best practice suggestion
}

/**
 * Validation issue details
 */
export interface ValidationIssue {
  ruleId: string;
  ruleType: FramingRuleType;
  severity: RuleSeverity;
  message: string;
  details?: string;
  affectedWalls: string[]; // Wall IDs
  location?: { x: number; y: number; z: number };
  code?: string; // IRC code reference (e.g., "R602.3.1")
}

/**
 * Validation suggestion
 */
export interface ValidationSuggestion {
  description: string;
  autoFixable: boolean;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  timestamp: number;
  ruleId: string;
}

/**
 * Corner configuration types (IRC 2021 compliant)
 */
export enum CornerType {
  THREE_STUD = 'THREE_STUD', // Three stud corner (most common)
  FOUR_STUD = 'FOUR_STUD', // Four stud corner (traditional)
  TWO_STUD_CALIFORNIA = 'TWO_STUD_CALIFORNIA', // California corner with blocking
}

/**
 * Intersection configuration
 */
export enum IntersectionType {
  T_INTERSECTION = 'T_INTERSECTION',
  L_CORNER = 'L_CORNER',
  CROSS = 'CROSS',
  NONE = 'NONE',
}

/**
 * Header sizing requirements based on span and load
 */
export interface HeaderRequirement {
  minHeight: number; // inches
  minWidth: number; // inches
  material: string; // e.g., "2x6", "LVL", "Glulam"
  maxSpan: number; // feet
  isLoadBearing: boolean;
}

/**
 * Framing rule configuration
 */
export interface FramingRuleConfig {
  id: string;
  type: FramingRuleType;
  name: string;
  description: string;
  severity: RuleSeverity;
  enabled: boolean;
  codeReference?: string; // IRC 2021 code section
  validator: FramingRuleValidator;
}

/**
 * Validator function type
 */
export type FramingRuleValidator = (
  context: ValidationContext
) => ValidationResult;

/**
 * Validation context passed to rule validators
 */
export interface ValidationContext {
  wall?: ParametricWall;
  walls?: ParametricWall[];
  wall1?: ParametricWall;
  wall2?: ParametricWall;
  openingWidth?: number;
  openingHeight?: number;
  isLoadBearing?: boolean;
  studSpacing?: number; // inches
  additionalData?: Record<string, any>;
}

/**
 * Corner detection result
 */
export interface Corner {
  walls: [ParametricWall, ParametricWall];
  angle: number; // degrees
  type: IntersectionType;
  location: { x: number; y: number; z: number };
  isExterior: boolean;
}

/**
 * Intersection detection result
 */
export interface Intersection {
  walls: ParametricWall[];
  type: IntersectionType;
  location: { x: number; y: number; z: number };
  angle?: number; // degrees (for T-intersections)
}

/**
 * Base FramingRule class
 */
export class FramingRule {
  public readonly id: string;
  public readonly type: FramingRuleType;
  public readonly name: string;
  public readonly description: string;
  public readonly severity: RuleSeverity;
  public readonly codeReference?: string;
  public enabled: boolean;
  private validator: FramingRuleValidator;

  constructor(config: FramingRuleConfig) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
    this.description = config.description;
    this.severity = config.severity;
    this.enabled = config.enabled;
    this.codeReference = config.codeReference;
    this.validator = config.validator;
  }

  /**
   * Validate using this rule
   */
  validate(context: ValidationContext): ValidationResult {
    if (!this.enabled) {
      return {
        isValid: true,
        issues: [],
        suggestions: [],
        timestamp: Date.now(),
        ruleId: this.id,
      };
    }

    return this.validator(context);
  }

  /**
   * Enable this rule
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable this rule
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Create a validation issue
   */
  static createIssue(
    ruleId: string,
    ruleType: FramingRuleType,
    severity: RuleSeverity,
    message: string,
    affectedWalls: string[],
    details?: string,
    location?: { x: number; y: number; z: number },
    codeReference?: string
  ): ValidationIssue {
    return {
      ruleId,
      ruleType,
      severity,
      message,
      details,
      affectedWalls,
      location,
      code: codeReference,
    };
  }

  /**
   * Create a validation suggestion
   */
  static createSuggestion(
    description: string,
    autoFixable: boolean = false,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): ValidationSuggestion {
    return {
      description,
      autoFixable,
      priority,
    };
  }

  /**
   * Create a validation result
   */
  static createResult(
    ruleId: string,
    isValid: boolean,
    issues: ValidationIssue[] = [],
    suggestions: ValidationSuggestion[] = []
  ): ValidationResult {
    return {
      isValid,
      issues,
      suggestions,
      timestamp: Date.now(),
      ruleId,
    };
  }
}

/**
 * Standard stud spacing values (IRC 2021)
 */
export const STANDARD_STUD_SPACING = {
  SIXTEEN_OC: 16, // 16" on center (most common)
  TWENTY_FOUR_OC: 24, // 24" on center (allowed for certain conditions)
  TWELVE_OC: 12, // 12" on center (special conditions)
} as const;

/**
 * Header span tables (simplified, based on IRC Table R502.5)
 * Maps header size to maximum span in feet for different loading conditions
 */
export const HEADER_SPAN_TABLE = {
  '2x4': { light: 3, medium: 2.5, heavy: 2 },
  '2x6': { light: 5, medium: 4, heavy: 3.5 },
  '2x8': { light: 7, medium: 6, heavy: 5 },
  '2x10': { light: 9, medium: 8, heavy: 7 },
  '2x12': { light: 11, medium: 10, heavy: 9 },
  'LVL-1.75x9.5': { light: 12, medium: 11, heavy: 10 },
  'LVL-1.75x11.875': { light: 15, medium: 14, heavy: 12 },
} as const;

/**
 * Minimum corner stud configuration (IRC R602.3)
 */
export const CORNER_REQUIREMENTS = {
  MIN_STUDS: 3, // Minimum number of studs at corner
  MIN_BEARING_STUDS: 2, // Minimum studs for load bearing
  BLOCKING_SPACING: 24, // Maximum spacing for blocking in inches
} as const;

/**
 * Plate specifications (IRC R602.3)
 */
export const PLATE_REQUIREMENTS = {
  MIN_OVERLAP: 48, // Minimum overlap at corners in inches (4 feet)
  MAX_GAP: 0, // Maximum gap in plates (no gaps allowed)
  DOUBLE_TOP_PLATE_REQUIRED: true, // Double top plate required for most construction
  SPLICE_MIN_LENGTH: 48, // Minimum splice length in inches
} as const;
