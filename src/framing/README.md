# Framing Rules Engine

A comprehensive validation system for wall framing that ensures compliance with IRC 2021 (International Residential Code) building standards for US residential and commercial construction.

## Features

- **IRC 2021 Compliance**: Built-in rules based on current building code standards
- **Geometric Analysis**: Automatic detection of corners, T-intersections, and cross intersections
- **Validation Events**: Real-time validation feedback through EventBus
- **Custom Rules**: Register custom validation rules for project-specific requirements
- **Severity Levels**: ERROR, WARNING, and INFO severities for different violation types
- **Detailed Reporting**: Comprehensive validation results with suggestions and code references

## Architecture

### Core Components

1. **FramingRule.ts** - Defines rule types, validation interfaces, and building code constants
2. **FramingRulesEngine.ts** - Singleton engine with built-in validators and geometry helpers
3. **ParametricWall Integration** - Wall validation methods and status tracking

### Rule Types

- `CORNER` - Corner post configuration validation
- `T_INTERSECTION` - T-intersection blocking and backing
- `CROSS_INTERSECTION` - Cross (4-way) intersection framing
- `OPENING` - Door/window opening validation
- `PLATE_OVERLAP` - Top plate overlap requirements
- `STUD_SPACING` - Stud spacing validation (16" or 24" OC)
- `HEADER_SIZING` - Header sizing for openings
- `PLATE_CONTINUITY` - Plate continuity and double top plate requirements

## Usage

### Basic Validation

```typescript
import { framingRulesEngine } from '@framing/FramingRulesEngine';
import type { ParametricWall } from '@parametric/ParametricWall';

// Validate a single wall
const result = wall.validate();
console.log(`Valid: ${result.isValid}`);
console.log(`Issues: ${result.issues.length}`);

// Or use the engine directly
const result = framingRulesEngine.validateWall(wall);
```

### Validate Corners

```typescript
// Validate a corner between two walls
const result = framingRulesEngine.validateCorner(wall1, wall2);

// Check for specific violations
const hasCornerPostIssue = result.issues.some(
  issue => issue.ruleType === FramingRuleType.CORNER_POST
);
```

### Validate All Walls

```typescript
// Get all violations in a project
const violations = framingRulesEngine.getAllViolations(walls);

// Group by severity
const errors = violations
  .flatMap(v => v.issues)
  .filter(i => i.severity === RuleSeverity.ERROR);
```

### Detect Geometry

```typescript
import { detectCorners, detectIntersections } from '@framing/FramingRulesEngine';

// Detect corners
const corners = detectCorners(walls);
corners.forEach(corner => {
  console.log(`Corner at ${corner.angle}°, Exterior: ${corner.isExterior}`);
});

// Detect intersections
const intersections = detectIntersections(walls);
intersections.forEach(intersection => {
  console.log(`${intersection.type}: ${intersection.walls.length} walls`);
});
```

### Listen to Validation Events

```typescript
import { eventBus, Events } from '@core/EventBus';

// Listen for violations
eventBus.on(Events.FRAMING_RULE_VIOLATED, (data) => {
  console.log(`Wall ${data.wallId} has ${data.issues.length} issues`);
});

// Listen for resolved violations
eventBus.on(Events.FRAMING_RULE_RESOLVED, (data) => {
  console.log(`Wall ${data.wallId} issues resolved`);
});

// Listen for validation complete
eventBus.on(Events.FRAMING_VALIDATION_COMPLETE, (data) => {
  console.log(`Validated ${data.wallCount} walls, found ${data.violationCount} violations`);
});
```

### Manage Rules

```typescript
// Get all rules
const rules = framingRulesEngine.getRules();

// Enable/disable specific rules
framingRulesEngine.disableRule('stud-spacing');
framingRulesEngine.enableRule('stud-spacing');

// Disable all rules
framingRulesEngine.disableAll();

// Enable all rules
framingRulesEngine.enableAll();
```

### Register Custom Rules

```typescript
framingRulesEngine.registerRule({
  id: 'custom-rule',
  type: FramingRuleType.STUD_SPACING,
  name: 'Custom Validation Rule',
  description: 'Description of the custom rule',
  severity: RuleSeverity.WARNING,
  enabled: true,
  codeReference: 'Custom-001',
  validator: (context) => {
    const { wall } = context;

    // Custom validation logic
    const isValid = /* your validation logic */;

    return {
      isValid,
      issues: isValid ? [] : [/* validation issues */],
      suggestions: [/* suggestions */],
      timestamp: Date.now(),
      ruleId: 'custom-rule',
    };
  },
});
```

## Built-in Rules

### 1. Corner Post Configuration (IRC R602.3)
- **Severity**: ERROR
- **Validates**: Proper stud configuration at corners (3-stud or 4-stud)
- **Checks**: Stud size compatibility, load-bearing requirements

### 2. T-Intersection Blocking (IRC R602.3.3)
- **Severity**: ERROR
- **Validates**: Backing/nailers for drywall attachment at T-intersections
- **Suggests**: Ladder blocking or continuous backing

### 3. Plate Overlap at Corners (IRC R602.3.2)
- **Severity**: ERROR
- **Validates**: Minimum 48" plate overlap at corners
- **Checks**: Wall length sufficient for proper overlap

### 4. Opening Header Sizing (IRC R602.7)
- **Severity**: ERROR
- **Validates**: Proper header sizing for door/window openings
- **Provides**: Recommended header size based on span and loading

### 5. Plate Continuity (IRC R602.3)
- **Severity**: ERROR
- **Validates**: No gaps in top and bottom plates
- **Checks**: Double top plate requirement

### 6. Stud Spacing (IRC R602.3.1)
- **Severity**: WARNING
- **Validates**: Standard 16" or 24" on-center spacing
- **Notes**: 24" spacing restrictions

### 7. Cross Intersection (IRC R602.3)
- **Severity**: ERROR
- **Validates**: Proper framing at 4-way intersections
- **Suggests**: Special post configuration and backing

## Building Code Constants

### Standard Stud Spacing
```typescript
STANDARD_STUD_SPACING = {
  SIXTEEN_OC: 16,   // 16" on center (most common)
  TWENTY_FOUR_OC: 24, // 24" on center
  TWELVE_OC: 12,    // 12" on center (special conditions)
}
```

### Header Span Table
Simplified span table based on IRC Table R502.5:

| Header Size | Light Load | Medium Load | Heavy Load |
|-------------|------------|-------------|------------|
| 2x4         | 3'         | 2.5'        | 2'         |
| 2x6         | 5'         | 4'          | 3.5'       |
| 2x8         | 7'         | 6'          | 5'         |
| 2x10        | 9'         | 8'          | 7'         |
| 2x12        | 11'        | 10'         | 9'         |
| LVL 1.75x9.5| 12'        | 11'         | 10'        |

### Plate Requirements
```typescript
PLATE_REQUIREMENTS = {
  MIN_OVERLAP: 48,              // Minimum 48" overlap at corners
  MAX_GAP: 0,                   // No gaps allowed
  DOUBLE_TOP_PLATE_REQUIRED: true,
  SPLICE_MIN_LENGTH: 48,        // Minimum 48" splice length
}
```

### Corner Requirements
```typescript
CORNER_REQUIREMENTS = {
  MIN_STUDS: 3,                 // Minimum 3 studs at corner
  MIN_BEARING_STUDS: 2,         // Minimum 2 studs for load bearing
  BLOCKING_SPACING: 24,         // Maximum 24" blocking spacing
}
```

## Validation Result Structure

```typescript
interface ValidationResult {
  isValid: boolean;              // Overall validation status
  issues: ValidationIssue[];     // Array of validation issues
  suggestions: ValidationSuggestion[]; // Array of suggestions
  timestamp: number;             // Validation timestamp
  ruleId: string;               // Rule identifier
}

interface ValidationIssue {
  ruleId: string;               // Rule that generated issue
  ruleType: FramingRuleType;    // Type of rule
  severity: RuleSeverity;       // ERROR, WARNING, or INFO
  message: string;              // Issue description
  details?: string;             // Additional details
  affectedWalls: string[];      // Wall IDs affected
  location?: Vector3;           // 3D location of issue
  code?: string;                // IRC code reference
}

interface ValidationSuggestion {
  description: string;          // Suggestion description
  autoFixable: boolean;         // Can be automatically fixed
  priority: 'high' | 'medium' | 'low'; // Priority level
}
```

## Wall Validation Status

Each ParametricWall tracks its validation status:

```typescript
// Check validation status
wall.getValidationStatus(); // Returns: 'valid' | 'warning' | 'error' | 'not-validated'

// Check for errors
wall.hasValidationErrors(); // Returns: boolean

// Get validation issues
wall.validationIssues; // Returns: ValidationResult | null

// Clear validation
wall.clearValidationIssues();
```

## Geometric Detection

The engine includes helpers for detecting wall relationships:

### Detect Corners
```typescript
const corners = detectCorners(walls);
// Returns Corner[] with:
// - walls: [wall1, wall2]
// - angle: angle in degrees
// - type: IntersectionType
// - location: {x, y, z}
// - isExterior: boolean
```

### Detect Intersections
```typescript
const intersections = detectIntersections(walls);
// Returns Intersection[] with:
// - walls: ParametricWall[]
// - type: IntersectionType
// - location: {x, y, z}
// - angle?: angle in degrees (for T-intersections)
```

### Find Adjacent Walls
```typescript
const adjacent = findAdjacentWalls(wall, walls);
// Returns ParametricWall[] that connect to the given wall
```

## Events

The FramingRulesEngine emits events through the EventBus:

### FRAMING_RULE_VIOLATED
Emitted when a wall fails validation:
```typescript
{
  wallId: string,
  issues: ValidationIssue[],
  timestamp: number
}
```

### FRAMING_RULE_RESOLVED
Emitted when previously invalid wall becomes valid:
```typescript
{
  wallId: string,
  timestamp: number
}
```

### FRAMING_VALIDATION_COMPLETE
Emitted when validation completes for multiple walls:
```typescript
{
  wallCount: number,
  violationCount: number,
  results: ValidationResult[]
}
```

## Best Practices

1. **Validate Early and Often**: Run validation after any wall modification
2. **Use Events**: Subscribe to validation events for real-time feedback
3. **Check Severity**: Prioritize ERROR issues over WARNING issues
4. **Review Suggestions**: Consider suggested fixes for violations
5. **Custom Rules**: Add project-specific rules for special requirements
6. **Batch Validation**: Use `getAllViolations()` for project-wide validation
7. **Export Reports**: Generate validation reports for documentation

## Integration with ParametricWall

The validation system is tightly integrated with ParametricWall:

```typescript
// Validation is automatically tracked
const result = wall.validate();

// Status is included in JSON export
const json = wall.toJSON();
console.log(json.validationStatus); // 'valid' | 'warning' | 'error' | 'not-validated'
console.log(json.validationIssues); // Summary of issues

// Events are emitted automatically
// No need for manual event emission
```

## Performance Considerations

- **Singleton Pattern**: FramingRulesEngine uses singleton for efficiency
- **Lazy Validation**: Walls are only validated when `validate()` is called
- **Selective Rules**: Disable unused rules to improve performance
- **Batch Processing**: `getAllViolations()` efficiently processes multiple walls
- **Geometric Tolerance**: 1mm tolerance for intersection detection

## IRC 2021 References

This system implements the following IRC 2021 code sections:

- **R602.3**: Wall framing general requirements
- **R602.3.1**: Stud spacing
- **R602.3.2**: Top plate requirements
- **R602.3.3**: Bearing walls and corner framing
- **R602.7**: Headers and girders

For complete code requirements, consult the IRC 2021 publication.

## Future Enhancements

Potential future additions:

- [ ] Auto-fix capabilities for simple violations
- [ ] Visual highlighting of violations in 3D view
- [ ] Load path analysis
- [ ] Wind/seismic load validation
- [ ] Material-specific rules (steel vs. wood framing)
- [ ] Multi-story wall validation
- [ ] Shear wall requirements
- [ ] Foundation connection validation

## Examples

See `FramingRulesEngine.example.ts` for 10 comprehensive usage examples covering:

1. Single wall validation
2. Corner validation
3. All walls validation
4. Geometry detection
5. Rule management
6. Custom rule registration
7. Event listeners
8. Validation status checking
9. Header sizing validation
10. Validation report export

## License

Part of the NEOcad project.
