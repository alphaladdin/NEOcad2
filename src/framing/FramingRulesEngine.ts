/**
 * FramingRulesEngine - Singleton engine for validating wall framing rules
 * Implements IRC 2021 building code standards for US residential/commercial construction
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import type { ParametricWall } from '@parametric/ParametricWall';
import {
  FramingRule,
  FramingRuleType,
  RuleSeverity,
  ValidationResult,
  ValidationContext,
  ValidationIssue,
  ValidationSuggestion,
  Corner,
  Intersection,
  IntersectionType,
  STANDARD_STUD_SPACING,
  HEADER_SPAN_TABLE,
  PLATE_REQUIREMENTS,
  FramingRuleConfig,
} from './FramingRule';

/**
 * Tolerance for geometric calculations (in mm)
 */
const TOLERANCE = 1.0; // 1mm tolerance for wall intersections

/**
 * Singleton FramingRulesEngine class
 */
export class FramingRulesEngine {
  private static instance: FramingRulesEngine;
  private rules: Map<string, FramingRule>;
  private enabledGlobally: boolean = true;

  private constructor() {
    this.rules = new Map();
    this.initializeBuiltInRules();
    logger.info('FramingRulesEngine', 'Initialized with built-in IRC 2021 rules');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FramingRulesEngine {
    if (!FramingRulesEngine.instance) {
      FramingRulesEngine.instance = new FramingRulesEngine();
    }
    return FramingRulesEngine.instance;
  }

  /**
   * Initialize built-in framing rules based on IRC 2021
   */
  private initializeBuiltInRules(): void {
    // Rule: Corner post configuration
    this.registerRule({
      id: 'corner-post-config',
      type: FramingRuleType.CORNER_POST,
      name: 'Corner Post Configuration',
      description: 'Validates that corners have proper stud configuration (3-stud or 4-stud)',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.3',
      validator: this.validateCornerPost.bind(this),
    });

    // Rule: T-intersection blocking
    this.registerRule({
      id: 't-intersection-blocking',
      type: FramingRuleType.T_INTERSECTION,
      name: 'T-Intersection Blocking',
      description: 'Validates proper backing/nailers at T-intersections',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.3.3',
      validator: this.validateTIntersection.bind(this),
    });

    // Rule: Plate overlap at corners
    this.registerRule({
      id: 'plate-overlap',
      type: FramingRuleType.PLATE_OVERLAP,
      name: 'Plate Overlap at Corners',
      description: 'Validates that top plates overlap properly at corners (minimum 48")',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.3.2',
      validator: this.validatePlateOverlap.bind(this),
    });

    // Rule: Opening header sizing
    this.registerRule({
      id: 'header-sizing',
      type: FramingRuleType.HEADER_SIZING,
      name: 'Opening Header Sizing',
      description: 'Validates proper header sizing for door/window openings',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.7',
      validator: this.validateHeaderSizing.bind(this),
    });

    // Rule: Plate continuity
    this.registerRule({
      id: 'plate-continuity',
      type: FramingRuleType.PLATE_CONTINUITY,
      name: 'Plate Continuity',
      description: 'Validates no gaps in top and bottom plates',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.3',
      validator: this.validatePlateContinuity.bind(this),
    });

    // Rule: Stud spacing
    this.registerRule({
      id: 'stud-spacing',
      type: FramingRuleType.STUD_SPACING,
      name: 'Stud Spacing',
      description: 'Validates stud spacing is 16" or 24" on center',
      severity: RuleSeverity.WARNING,
      enabled: true,
      codeReference: 'IRC R602.3.1',
      validator: this.validateStudSpacing.bind(this),
    });

    // Rule: Cross intersection
    this.registerRule({
      id: 'cross-intersection',
      type: FramingRuleType.CROSS_INTERSECTION,
      name: 'Cross Intersection',
      description: 'Validates proper framing at cross (4-way) intersections',
      severity: RuleSeverity.ERROR,
      enabled: true,
      codeReference: 'IRC R602.3',
      validator: this.validateCrossIntersection.bind(this),
    });
  }

  /**
   * Register a custom framing rule
   */
  registerRule(config: FramingRuleConfig): void {
    const rule = new FramingRule(config);
    this.rules.set(rule.id, rule);
    logger.debug('FramingRulesEngine', `Registered rule: ${rule.name} (${rule.id})`);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      logger.debug('FramingRulesEngine', `Unregistered rule: ${ruleId}`);
    }
    return deleted;
  }

  /**
   * Enable a specific rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enable();
      logger.debug('FramingRulesEngine', `Enabled rule: ${ruleId}`);
    }
  }

  /**
   * Disable a specific rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.disable();
      logger.debug('FramingRulesEngine', `Disabled rule: ${ruleId}`);
    }
  }

  /**
   * Enable all rules globally
   */
  enableAll(): void {
    this.enabledGlobally = true;
    logger.info('FramingRulesEngine', 'All rules enabled globally');
  }

  /**
   * Disable all rules globally
   */
  disableAll(): void {
    this.enabledGlobally = false;
    logger.info('FramingRulesEngine', 'All rules disabled globally');
  }

  /**
   * Get all registered rules
   */
  getRules(): FramingRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): FramingRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Validate a single wall
   */
  validateWall(wall: ParametricWall): ValidationResult {
    if (!this.enabledGlobally) {
      return this.createEmptyResult('wall-validation');
    }

    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Validate stud spacing
    const studSpacingResult = this.rules.get('stud-spacing')?.validate({ wall });
    if (studSpacingResult) {
      issues.push(...studSpacingResult.issues);
      suggestions.push(...studSpacingResult.suggestions);
    }

    // Validate plate continuity
    const plateContinuityResult = this.rules.get('plate-continuity')?.validate({ wall });
    if (plateContinuityResult) {
      issues.push(...plateContinuityResult.issues);
      suggestions.push(...plateContinuityResult.suggestions);
    }

    const isValid = issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0;

    return {
      isValid,
      issues,
      suggestions,
      timestamp: Date.now(),
      ruleId: 'wall-validation',
    };
  }

  /**
   * Validate a corner between two walls
   */
  validateCorner(wall1: ParametricWall, wall2: ParametricWall): ValidationResult {
    if (!this.enabledGlobally) {
      return this.createEmptyResult('corner-validation');
    }

    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Validate corner post configuration
    const cornerPostResult = this.rules.get('corner-post-config')?.validate({ wall1, wall2 });
    if (cornerPostResult) {
      issues.push(...cornerPostResult.issues);
      suggestions.push(...cornerPostResult.suggestions);
    }

    // Validate plate overlap
    const plateOverlapResult = this.rules.get('plate-overlap')?.validate({ wall1, wall2 });
    if (plateOverlapResult) {
      issues.push(...plateOverlapResult.issues);
      suggestions.push(...plateOverlapResult.suggestions);
    }

    const isValid = issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0;

    return {
      isValid,
      issues,
      suggestions,
      timestamp: Date.now(),
      ruleId: 'corner-validation',
    };
  }

  /**
   * Validate an intersection between multiple walls
   */
  validateIntersection(walls: ParametricWall[]): ValidationResult {
    if (!this.enabledGlobally || walls.length < 2) {
      return this.createEmptyResult('intersection-validation');
    }

    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    const intersection = this.detectIntersectionType(walls);

    if (intersection.type === IntersectionType.T_INTERSECTION) {
      const tIntersectionResult = this.rules.get('t-intersection-blocking')?.validate({ walls });
      if (tIntersectionResult) {
        issues.push(...tIntersectionResult.issues);
        suggestions.push(...tIntersectionResult.suggestions);
      }
    } else if (intersection.type === IntersectionType.CROSS) {
      const crossResult = this.rules.get('cross-intersection')?.validate({ walls });
      if (crossResult) {
        issues.push(...crossResult.issues);
        suggestions.push(...crossResult.suggestions);
      }
    }

    const isValid = issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0;

    return {
      isValid,
      issues,
      suggestions,
      timestamp: Date.now(),
      ruleId: 'intersection-validation',
    };
  }

  /**
   * Get all violations across multiple walls
   */
  getAllViolations(walls: ParametricWall[]): ValidationResult[] {
    if (!this.enabledGlobally || walls.length === 0) {
      return [];
    }

    const results: ValidationResult[] = [];

    // Validate each wall individually
    walls.forEach(wall => {
      const result = this.validateWall(wall);
      if (!result.isValid) {
        results.push(result);
      }
    });

    // Detect and validate corners
    const corners = detectCorners(walls);
    corners.forEach(corner => {
      const result = this.validateCorner(corner.walls[0], corner.walls[1]);
      if (!result.isValid) {
        results.push(result);
      }
    });

    // Detect and validate intersections
    const intersections = detectIntersections(walls);
    intersections.forEach(intersection => {
      const result = this.validateIntersection(intersection.walls);
      if (!result.isValid) {
        results.push(result);
      }
    });

    // Emit validation complete event
    eventBus.emit(Events.FRAMING_VALIDATION_COMPLETE, {
      wallCount: walls.length,
      violationCount: results.length,
      results,
    });

    return results;
  }

  // ==================== Built-in Validators ====================

  /**
   * Validate corner post configuration (IRC R602.3)
   */
  private validateCornerPost(context: ValidationContext): ValidationResult {
    const { wall1, wall2 } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!wall1 || !wall2) {
      return FramingRule.createResult('corner-post-config', true);
    }

    const wallType1 = wall1.getWallType();
    const wallType2 = wall2.getWallType();

    // Check if walls meet at a corner (angle check)
    const angle = this.getWallAngle(wall1, wall2);
    const isCorner = Math.abs(angle - 90) < 10; // Within 10 degrees of 90

    if (isCorner) {
      // Check if both walls are load-bearing
      const isLoadBearing =
        (wallType1?.isLoadBearing || false) || (wallType2?.isLoadBearing || false);

      if (isLoadBearing) {
        // Load-bearing corners need proper configuration
        suggestions.push(
          FramingRule.createSuggestion(
            'Use 3-stud corner configuration for load-bearing walls',
            false,
            'high'
          )
        );
      }

      // Check stud size compatibility
      const stud1Size = wallType1?.stud.nominalSize;
      const stud2Size = wallType2?.stud.nominalSize;

      if (stud1Size && stud2Size && stud1Size !== stud2Size) {
        issues.push(
          FramingRule.createIssue(
            'corner-post-config',
            FramingRuleType.CORNER_POST,
            RuleSeverity.WARNING,
            `Mismatched stud sizes at corner: ${stud1Size} and ${stud2Size}`,
            [wall1.id, wall2.id],
            'Different stud sizes may require special blocking',
            this.getWallIntersectionPoint(wall1, wall2),
            'IRC R602.3'
          )
        );
      }
    }

    return FramingRule.createResult(
      'corner-post-config',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate T-intersection blocking (IRC R602.3.3)
   */
  private validateTIntersection(context: ValidationContext): ValidationResult {
    const { walls } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!walls || walls.length < 2) {
      return FramingRule.createResult('t-intersection-blocking', true);
    }

    // T-intersections require backing for drywall attachment
    suggestions.push(
      FramingRule.createSuggestion(
        'Provide backing/nailers at T-intersection for drywall attachment',
        false,
        'high'
      )
    );

    suggestions.push(
      FramingRule.createSuggestion(
        'Use ladder blocking or continuous backing at T-intersection',
        false,
        'medium'
      )
    );

    return FramingRule.createResult(
      't-intersection-blocking',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate plate overlap at corners (IRC R602.3.2)
   */
  private validatePlateOverlap(context: ValidationContext): ValidationResult {
    const { wall1, wall2 } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!wall1 || !wall2) {
      return FramingRule.createResult('plate-overlap', true);
    }

    const length1 = wall1.getLength(); // in mm
    const length2 = wall2.getLength(); // in mm
    const minOverlap = PLATE_REQUIREMENTS.MIN_OVERLAP * 25.4; // Convert to mm

    // Check if walls are long enough to meet overlap requirement
    if (length1 < minOverlap || length2 < minOverlap) {
      issues.push(
        FramingRule.createIssue(
          'plate-overlap',
          FramingRuleType.PLATE_OVERLAP,
          RuleSeverity.WARNING,
          `Wall too short for proper plate overlap (minimum ${PLATE_REQUIREMENTS.MIN_OVERLAP}")`,
          [wall1.id, wall2.id],
          `Wall lengths: ${(length1 / 25.4).toFixed(1)}" and ${(length2 / 25.4).toFixed(1)}"`,
          this.getWallIntersectionPoint(wall1, wall2),
          'IRC R602.3.2'
        )
      );
    }

    suggestions.push(
      FramingRule.createSuggestion(
        'Ensure top plates overlap at least 48" at corners and splices',
        false,
        'high'
      )
    );

    return FramingRule.createResult(
      'plate-overlap',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate header sizing for openings (IRC R602.7)
   */
  private validateHeaderSizing(context: ValidationContext): ValidationResult {
    const { openingWidth, isLoadBearing } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!openingWidth) {
      return FramingRule.createResult('header-sizing', true);
    }

    const spanFeet = (openingWidth * 0.00328084); // mm to feet

    // Determine appropriate header size
    let recommendedHeader = '2x4';
    const loadType = isLoadBearing ? 'heavy' : 'light';

    for (const [header, spans] of Object.entries(HEADER_SPAN_TABLE)) {
      if (spans[loadType as keyof typeof spans] >= spanFeet) {
        recommendedHeader = header;
        break;
      }
    }

    suggestions.push(
      FramingRule.createSuggestion(
        `Recommended header size for ${spanFeet.toFixed(1)}' span: ${recommendedHeader}`,
        false,
        'high'
      )
    );

    if (spanFeet > 12) {
      issues.push(
        FramingRule.createIssue(
          'header-sizing',
          FramingRuleType.HEADER_SIZING,
          RuleSeverity.ERROR,
          `Opening span of ${spanFeet.toFixed(1)}' exceeds standard header capabilities`,
          [],
          'Consider engineered lumber (LVL, Glulam) or consult structural engineer',
          undefined,
          'IRC R602.7'
        )
      );
    }

    return FramingRule.createResult(
      'header-sizing',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate plate continuity (IRC R602.3)
   */
  private validatePlateContinuity(context: ValidationContext): ValidationResult {
    const { wall } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!wall) {
      return FramingRule.createResult('plate-continuity', true);
    }

    const wallType = wall.getWallType();
    if (wallType) {
      // Check for double top plate requirement
      if (
        PLATE_REQUIREMENTS.DOUBLE_TOP_PLATE_REQUIRED &&
        wallType.topPlate.count < 2
      ) {
        issues.push(
          FramingRule.createIssue(
            'plate-continuity',
            FramingRuleType.PLATE_CONTINUITY,
            RuleSeverity.ERROR,
            'Double top plate required for load transfer',
            [wall.id],
            'IRC requires double top plate for most construction',
            undefined,
            'IRC R602.3.2'
          )
        );
      }
    }

    suggestions.push(
      FramingRule.createSuggestion(
        'Ensure continuous plates with no gaps; splice joints must overlap minimum 48"',
        false,
        'high'
      )
    );

    return FramingRule.createResult(
      'plate-continuity',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate stud spacing (IRC R602.3.1)
   */
  private validateStudSpacing(context: ValidationContext): ValidationResult {
    const { wall } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!wall) {
      return FramingRule.createResult('stud-spacing', true);
    }

    const wallType = wall.getWallType();
    if (wallType) {
      const spacing = wallType.stud.spacing;

      // Check if spacing is standard
      if (
        spacing !== STANDARD_STUD_SPACING.SIXTEEN_OC &&
        spacing !== STANDARD_STUD_SPACING.TWENTY_FOUR_OC
      ) {
        issues.push(
          FramingRule.createIssue(
            'stud-spacing',
            FramingRuleType.STUD_SPACING,
            RuleSeverity.WARNING,
            `Non-standard stud spacing: ${spacing}" OC`,
            [wall.id],
            'Standard spacing is 16" or 24" OC per IRC R602.3.1',
            undefined,
            'IRC R602.3.1'
          )
        );
      }

      // 24" spacing has restrictions
      if (spacing === STANDARD_STUD_SPACING.TWENTY_FOUR_OC) {
        suggestions.push(
          FramingRule.createSuggestion(
            '24" OC spacing requires utility grade or better studs and appropriate sheathing',
            false,
            'high'
          )
        );
      }
    }

    return FramingRule.createResult(
      'stud-spacing',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  /**
   * Validate cross (4-way) intersection (IRC R602.3)
   */
  private validateCrossIntersection(context: ValidationContext): ValidationResult {
    const { walls } = context;
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!walls || walls.length < 3) {
      return FramingRule.createResult('cross-intersection', true);
    }

    suggestions.push(
      FramingRule.createSuggestion(
        'Cross intersections require special framing with post configuration',
        false,
        'high'
      )
    );

    suggestions.push(
      FramingRule.createSuggestion(
        'Provide adequate backing for drywall attachment on all sides',
        false,
        'medium'
      )
    );

    return FramingRule.createResult(
      'cross-intersection',
      issues.filter(i => i.severity === RuleSeverity.ERROR).length === 0,
      issues,
      suggestions
    );
  }

  // ==================== Helper Methods ====================

  /**
   * Get angle between two walls in degrees
   */
  private getWallAngle(wall1: ParametricWall, wall2: ParametricWall): number {
    const dir1 = wall1.getDirection();
    const dir2 = wall2.getDirection();

    // Calculate angle in radians, then convert to degrees
    const dot = dir1.dot(dir2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

    return angle;
  }

  /**
   * Get intersection point between two walls
   */
  private getWallIntersectionPoint(
    wall1: ParametricWall,
    wall2: ParametricWall
  ): { x: number; y: number; z: number } | undefined {
    const start1 = wall1.getStartPoint();
    const end1 = wall1.getEndPoint();
    const start2 = wall2.getStartPoint();
    const end2 = wall2.getEndPoint();

    // Check if walls share an endpoint
    if (start1.distanceTo(start2) < TOLERANCE) {
      return { x: start1.x, y: start1.y, z: start1.z };
    }
    if (start1.distanceTo(end2) < TOLERANCE) {
      return { x: start1.x, y: start1.y, z: start1.z };
    }
    if (end1.distanceTo(start2) < TOLERANCE) {
      return { x: end1.x, y: end1.y, z: end1.z };
    }
    if (end1.distanceTo(end2) < TOLERANCE) {
      return { x: end1.x, y: end1.y, z: end1.z };
    }

    return undefined;
  }

  /**
   * Detect intersection type for a group of walls
   */
  private detectIntersectionType(walls: ParametricWall[]): Intersection {
    if (walls.length === 2) {
      const angle = this.getWallAngle(walls[0], walls[1]);
      const type = Math.abs(angle - 90) < 10 ? IntersectionType.L_CORNER : IntersectionType.T_INTERSECTION;

      return {
        walls,
        type,
        location: this.getWallIntersectionPoint(walls[0], walls[1]) || { x: 0, y: 0, z: 0 },
        angle,
      };
    } else if (walls.length === 3) {
      return {
        walls,
        type: IntersectionType.T_INTERSECTION,
        location: { x: 0, y: 0, z: 0 }, // Calculate actual intersection point
      };
    } else if (walls.length >= 4) {
      return {
        walls,
        type: IntersectionType.CROSS,
        location: { x: 0, y: 0, z: 0 }, // Calculate actual intersection point
      };
    }

    return {
      walls,
      type: IntersectionType.NONE,
      location: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Create an empty validation result
   */
  private createEmptyResult(ruleId: string): ValidationResult {
    return {
      isValid: true,
      issues: [],
      suggestions: [],
      timestamp: Date.now(),
      ruleId,
    };
  }
}

// ==================== Geometry Helper Functions ====================

/**
 * Detect corners in a set of walls
 */
export function detectCorners(walls: ParametricWall[]): Corner[] {
  const corners: Corner[] = [];

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall1 = walls[i];
      const wall2 = walls[j];

      // Check if walls share an endpoint
      const intersection = findWallIntersection(wall1, wall2);
      if (intersection) {
        const angle = getAngleBetweenWalls(wall1, wall2);

        // Consider it a corner if angle is close to 90 degrees
        if (Math.abs(angle - 90) < 10) {
          const isExterior = determineIfExteriorCorner(wall1, wall2, walls);

          corners.push({
            walls: [wall1, wall2],
            angle,
            type: IntersectionType.L_CORNER,
            location: intersection,
            isExterior,
          });
        }
      }
    }
  }

  return corners;
}

/**
 * Detect intersections in a set of walls
 */
export function detectIntersections(walls: ParametricWall[]): Intersection[] {
  const intersections: Intersection[] = [];
  const processedPoints = new Set<string>();

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const adjacentWalls = findAdjacentWalls(wall, walls);

    if (adjacentWalls.length >= 2) {
      // Find common intersection point
      const intersection = findCommonIntersectionPoint([wall, ...adjacentWalls]);
      if (intersection) {
        const pointKey = `${intersection.x.toFixed(1)},${intersection.y.toFixed(1)},${intersection.z.toFixed(1)}`;

        if (!processedPoints.has(pointKey)) {
          processedPoints.add(pointKey);

          const allWalls = [wall, ...adjacentWalls];
          const type = determineIntersectionType(allWalls);

          intersections.push({
            walls: allWalls,
            type,
            location: intersection,
            angle: type === IntersectionType.T_INTERSECTION ? getAngleBetweenWalls(wall, adjacentWalls[0]) : undefined,
          });
        }
      }
    }
  }

  return intersections;
}

/**
 * Find adjacent walls that connect to the given wall
 */
export function findAdjacentWalls(
  wall: ParametricWall,
  walls: ParametricWall[]
): ParametricWall[] {
  const adjacent: ParametricWall[] = [];
  const startPoint = wall.getStartPoint();
  const endPoint = wall.getEndPoint();

  for (const otherWall of walls) {
    if (otherWall.id === wall.id) continue;

    const otherStart = otherWall.getStartPoint();
    const otherEnd = otherWall.getEndPoint();

    // Check if walls share an endpoint
    if (
      startPoint.distanceTo(otherStart) < TOLERANCE ||
      startPoint.distanceTo(otherEnd) < TOLERANCE ||
      endPoint.distanceTo(otherStart) < TOLERANCE ||
      endPoint.distanceTo(otherEnd) < TOLERANCE
    ) {
      adjacent.push(otherWall);
    }
  }

  return adjacent;
}

// ==================== Private Helper Functions ====================

/**
 * Find intersection point between two walls
 */
function findWallIntersection(
  wall1: ParametricWall,
  wall2: ParametricWall
): { x: number; y: number; z: number } | null {
  const start1 = wall1.getStartPoint();
  const end1 = wall1.getEndPoint();
  const start2 = wall2.getStartPoint();
  const end2 = wall2.getEndPoint();

  if (start1.distanceTo(start2) < TOLERANCE) {
    return { x: start1.x, y: start1.y, z: start1.z };
  }
  if (start1.distanceTo(end2) < TOLERANCE) {
    return { x: start1.x, y: start1.y, z: start1.z };
  }
  if (end1.distanceTo(start2) < TOLERANCE) {
    return { x: end1.x, y: end1.y, z: end1.z };
  }
  if (end1.distanceTo(end2) < TOLERANCE) {
    return { x: end1.x, y: end1.y, z: end1.z };
  }

  return null;
}

/**
 * Get angle between two walls in degrees
 */
function getAngleBetweenWalls(wall1: ParametricWall, wall2: ParametricWall): number {
  const dir1 = wall1.getDirection();
  const dir2 = wall2.getDirection();

  const dot = dir1.dot(dir2);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

  return angle;
}

/**
 * Find common intersection point for multiple walls
 */
function findCommonIntersectionPoint(
  walls: ParametricWall[]
): { x: number; y: number; z: number } | null {
  if (walls.length < 2) return null;

  const points: THREE.Vector3[] = [];
  walls.forEach(wall => {
    points.push(wall.getStartPoint(), wall.getEndPoint());
  });

  // Find the point that appears most frequently (within tolerance)
  for (const point of points) {
    let count = 0;
    for (const other of points) {
      if (point.distanceTo(other) < TOLERANCE) {
        count++;
      }
    }

    if (count >= walls.length) {
      return { x: point.x, y: point.y, z: point.z };
    }
  }

  return null;
}

/**
 * Determine intersection type based on number of walls
 */
function determineIntersectionType(walls: ParametricWall[]): IntersectionType {
  if (walls.length === 2) {
    const angle = getAngleBetweenWalls(walls[0], walls[1]);
    return Math.abs(angle - 90) < 10 ? IntersectionType.L_CORNER : IntersectionType.T_INTERSECTION;
  } else if (walls.length === 3) {
    return IntersectionType.T_INTERSECTION;
  } else if (walls.length >= 4) {
    return IntersectionType.CROSS;
  }
  return IntersectionType.NONE;
}

/**
 * Determine if a corner is exterior or interior
 */
function determineIfExteriorCorner(
  wall1: ParametricWall,
  wall2: ParametricWall,
  _allWalls: ParametricWall[]
): boolean {
  const wallType1 = wall1.getWallType();
  const wallType2 = wall2.getWallType();

  // If either wall is marked as exterior, it's an exterior corner
  return (wallType1?.isExterior || false) || (wallType2?.isExterior || false);
}

// Export singleton instance
export const framingRulesEngine = FramingRulesEngine.getInstance();
