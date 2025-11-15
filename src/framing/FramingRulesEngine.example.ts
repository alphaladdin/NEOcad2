/**
 * FramingRulesEngine Usage Examples
 * Demonstrates how to use the framing validation system
 */

import { framingRulesEngine, detectCorners, detectIntersections } from './FramingRulesEngine';
import { RuleSeverity, FramingRuleType } from './FramingRule';
import type { ParametricWall } from '@parametric/ParametricWall';
import { eventBus, Events } from '@core/EventBus';

/**
 * Example 1: Validate a single wall
 */
export function example1_ValidateSingleWall(wall: ParametricWall) {
  console.log('=== Example 1: Validate Single Wall ===');

  // Validate the wall
  const result = wall.validate();

  console.log(`Validation Status: ${result.isValid ? 'PASS' : 'FAIL'}`);
  console.log(`Issues Found: ${result.issues.length}`);
  console.log(`Suggestions: ${result.suggestions.length}`);

  // Display issues
  result.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.message}`);
    if (issue.details) {
      console.log(`  Details: ${issue.details}`);
    }
    if (issue.code) {
      console.log(`  Code: ${issue.code}`);
    }
  });

  // Display suggestions
  result.suggestions.forEach(suggestion => {
    console.log(`💡 ${suggestion.description} (Priority: ${suggestion.priority})`);
  });

  return result;
}

/**
 * Example 2: Validate a corner connection
 */
export function example2_ValidateCorner(wall1: ParametricWall, wall2: ParametricWall) {
  console.log('=== Example 2: Validate Corner ===');

  // Validate the corner
  const result = framingRulesEngine.validateCorner(wall1, wall2);

  console.log(`Corner Validation: ${result.isValid ? 'PASS' : 'FAIL'}`);
  console.log(`Issues: ${result.issues.length}`);

  // Check for specific rule violations
  const cornerPostIssues = result.issues.filter(
    i => i.ruleType === FramingRuleType.CORNER_POST
  );
  const plateOverlapIssues = result.issues.filter(
    i => i.ruleType === FramingRuleType.PLATE_OVERLAP
  );

  console.log(`Corner Post Issues: ${cornerPostIssues.length}`);
  console.log(`Plate Overlap Issues: ${plateOverlapIssues.length}`);

  return result;
}

/**
 * Example 3: Validate all walls in a project
 */
export function example3_ValidateAllWalls(walls: ParametricWall[]) {
  console.log('=== Example 3: Validate All Walls ===');

  // Get all violations
  const violations = framingRulesEngine.getAllViolations(walls);

  console.log(`Total Walls: ${walls.length}`);
  console.log(`Violations Found: ${violations.length}`);

  // Group violations by severity
  const errors = violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.ERROR);
  const warnings = violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.WARNING);
  const info = violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.INFO);

  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info: ${info.length}`);

  return { violations, errors, warnings, info };
}

/**
 * Example 4: Detect corners and intersections
 */
export function example4_DetectGeometry(walls: ParametricWall[]) {
  console.log('=== Example 4: Detect Corners and Intersections ===');

  // Detect corners
  const corners = detectCorners(walls);
  console.log(`Corners Found: ${corners.length}`);

  corners.forEach((corner, index) => {
    console.log(`Corner ${index + 1}:`);
    console.log(`  Type: ${corner.type}`);
    console.log(`  Angle: ${corner.angle.toFixed(1)}°`);
    console.log(`  Exterior: ${corner.isExterior}`);
    console.log(`  Location: (${corner.location.x.toFixed(1)}, ${corner.location.y.toFixed(1)}, ${corner.location.z.toFixed(1)})`);
  });

  // Detect intersections
  const intersections = detectIntersections(walls);
  console.log(`Intersections Found: ${intersections.length}`);

  intersections.forEach((intersection, index) => {
    console.log(`Intersection ${index + 1}:`);
    console.log(`  Type: ${intersection.type}`);
    console.log(`  Walls: ${intersection.walls.length}`);
    if (intersection.angle) {
      console.log(`  Angle: ${intersection.angle.toFixed(1)}°`);
    }
  });

  return { corners, intersections };
}

/**
 * Example 5: Enable/Disable specific rules
 */
export function example5_ManageRules() {
  console.log('=== Example 5: Manage Rules ===');

  // Get all rules
  const rules = framingRulesEngine.getRules();
  console.log(`Total Rules: ${rules.length}`);

  // List all rules
  rules.forEach(rule => {
    console.log(`${rule.id}: ${rule.name} [${rule.enabled ? 'ENABLED' : 'DISABLED'}]`);
    console.log(`  Type: ${rule.type}`);
    console.log(`  Severity: ${rule.severity}`);
    if (rule.codeReference) {
      console.log(`  Code: ${rule.codeReference}`);
    }
  });

  // Disable a specific rule
  console.log('\nDisabling stud-spacing rule...');
  framingRulesEngine.disableRule('stud-spacing');

  // Enable it again
  console.log('Re-enabling stud-spacing rule...');
  framingRulesEngine.enableRule('stud-spacing');

  // Disable all rules temporarily
  console.log('Disabling all rules...');
  framingRulesEngine.disableAll();

  // Re-enable all
  console.log('Re-enabling all rules...');
  framingRulesEngine.enableAll();
}

/**
 * Example 6: Register a custom rule
 */
export function example6_CustomRule() {
  console.log('=== Example 6: Custom Rule ===');

  // Register a custom rule
  framingRulesEngine.registerRule({
    id: 'custom-wall-length',
    type: FramingRuleType.STUD_SPACING,
    name: 'Maximum Wall Length',
    description: 'Walls should not exceed 40 feet without intermediate support',
    severity: RuleSeverity.WARNING,
    enabled: true,
    codeReference: 'Custom',
    validator: (context) => {
      const { wall } = context;

      if (!wall) {
        return {
          isValid: true,
          issues: [],
          suggestions: [],
          timestamp: Date.now(),
          ruleId: 'custom-wall-length',
        };
      }

      const lengthFeet = wall.getLength() / 25.4 / 12; // Convert mm to feet
      const maxLength = 40;

      if (lengthFeet > maxLength) {
        return {
          isValid: false,
          issues: [
            {
              ruleId: 'custom-wall-length',
              ruleType: FramingRuleType.STUD_SPACING,
              severity: RuleSeverity.WARNING,
              message: `Wall length ${lengthFeet.toFixed(1)}' exceeds recommended maximum of ${maxLength}'`,
              details: 'Consider adding intermediate support or breaking into multiple walls',
              affectedWalls: [wall.id],
              code: 'Custom',
            },
          ],
          suggestions: [
            {
              description: 'Add intermediate posts or columns for support',
              autoFixable: false,
              priority: 'medium',
            },
          ],
          timestamp: Date.now(),
          ruleId: 'custom-wall-length',
        };
      }

      return {
        isValid: true,
        issues: [],
        suggestions: [],
        timestamp: Date.now(),
        ruleId: 'custom-wall-length',
      };
    },
  });

  console.log('Custom rule registered: custom-wall-length');
}

/**
 * Example 7: Listen to validation events
 */
export function example7_ValidationEvents() {
  console.log('=== Example 7: Validation Events ===');

  // Listen for validation violations
  const unsubscribeViolated = eventBus.on(
    Events.FRAMING_RULE_VIOLATED,
    (data: any) => {
      console.log('⚠️ Framing rule violated:');
      console.log(`  Wall ID: ${data.wallId}`);
      console.log(`  Issues: ${data.issues.length}`);
      data.issues.forEach((issue: any) => {
        console.log(`    - [${issue.severity}] ${issue.message}`);
      });
    }
  );

  // Listen for resolved violations
  const unsubscribeResolved = eventBus.on(
    Events.FRAMING_RULE_RESOLVED,
    (data: any) => {
      console.log('✅ Framing rule resolved:');
      console.log(`  Wall ID: ${data.wallId}`);
    }
  );

  // Listen for validation complete
  const unsubscribeComplete = eventBus.on(
    Events.FRAMING_VALIDATION_COMPLETE,
    (data: any) => {
      console.log('📊 Validation complete:');
      console.log(`  Walls validated: ${data.wallCount}`);
      console.log(`  Violations found: ${data.violationCount}`);
    }
  );

  console.log('Event listeners registered');

  // Return cleanup function
  return () => {
    unsubscribeViolated();
    unsubscribeResolved();
    unsubscribeComplete();
    console.log('Event listeners removed');
  };
}

/**
 * Example 8: Check validation status
 */
export function example8_CheckValidationStatus(wall: ParametricWall) {
  console.log('=== Example 8: Check Validation Status ===');

  // Check if wall has been validated
  const status = wall.getValidationStatus();
  console.log(`Validation Status: ${status}`);

  // Check for errors
  const hasErrors = wall.hasValidationErrors();
  console.log(`Has Errors: ${hasErrors}`);

  // Get validation issues
  const issues = wall.validationIssues;
  if (issues) {
    console.log('Validation Issues:');
    console.log(`  Valid: ${issues.isValid}`);
    console.log(`  Issue Count: ${issues.issues.length}`);
    console.log(`  Suggestion Count: ${issues.suggestions.length}`);
  } else {
    console.log('No validation performed yet');
  }
}

/**
 * Example 9: Validate opening header sizing
 */
export function example9_ValidateHeaderSizing() {
  console.log('=== Example 9: Validate Header Sizing ===');

  // Test various opening widths
  const openingWidths = [36, 48, 72, 96, 144]; // inches

  openingWidths.forEach(widthInches => {
    const widthMM = widthInches * 25.4;

    // Validate for non-load-bearing
    const resultNonBearing = framingRulesEngine
      .getRule('header-sizing')
      ?.validate({
        openingWidth: widthMM,
        isLoadBearing: false,
      });

    // Validate for load-bearing
    const resultLoadBearing = framingRulesEngine
      .getRule('header-sizing')
      ?.validate({
        openingWidth: widthMM,
        isLoadBearing: true,
      });

    console.log(`\nOpening Width: ${widthInches}"`);
    console.log('Non-Load-Bearing:');
    resultNonBearing?.suggestions.forEach(s => console.log(`  ${s.description}`));
    console.log('Load-Bearing:');
    resultLoadBearing?.suggestions.forEach(s => console.log(`  ${s.description}`));
  });
}

/**
 * Example 10: Export validation report
 */
export function example10_ExportValidationReport(walls: ParametricWall[]) {
  console.log('=== Example 10: Export Validation Report ===');

  const violations = framingRulesEngine.getAllViolations(walls);

  const report = {
    timestamp: new Date().toISOString(),
    wallCount: walls.length,
    violationCount: violations.length,
    summary: {
      errors: violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.ERROR).length,
      warnings: violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.WARNING).length,
      info: violations.flatMap(v => v.issues).filter(i => i.severity === RuleSeverity.INFO).length,
    },
    violations: violations.map(v => ({
      ruleId: v.ruleId,
      isValid: v.isValid,
      timestamp: v.timestamp,
      issues: v.issues.map(i => ({
        type: i.ruleType,
        severity: i.severity,
        message: i.message,
        details: i.details,
        affectedWalls: i.affectedWalls,
        location: i.location,
        code: i.code,
      })),
      suggestions: v.suggestions.map(s => ({
        description: s.description,
        autoFixable: s.autoFixable,
        priority: s.priority,
      })),
    })),
  };

  console.log('Validation Report:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}
