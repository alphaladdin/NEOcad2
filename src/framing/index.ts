/**
 * Framing module - Building framing components, appearance management, and validation
 */

// Wall Type exports
export { WallType } from './WallType';
export type { WallTypeConfig, MaterialLayer, StudSpecification, PlateSpecification } from './WallType';
export { WallTypeManager, getWallTypeManager } from './WallTypeManager';

// Layer exports
export { Layer, LayerType } from './Layer';
export type { LayerConfig } from './Layer';
export { LayerManager, getLayerManager } from './LayerManager';
export type { LayerFilter } from './LayerManager';

// Appearance Style exports
export { AppearanceStyle, DisplayMode } from './AppearanceStyle';
export type { AppearanceStyleConfig, MaterialSettings } from './AppearanceStyle';
export { AppearanceManager, getAppearanceManager } from './AppearanceManager';

// Appearance Helper exports
export {
  materialToSettings,
  settingsToMaterial,
  applyStyleToObjects,
  applyStyleByName,
  applyStyleByMaterialType,
  collectSceneMaterials,
  createStylesFromScene,
  saveAppearancePreset,
  loadAppearancePreset,
  batchApplyStyles,
  interpolateStyles,
  getMeshesWithStyle,
  createStylePreview,
  resetSceneMaterials,
} from './AppearanceHelpers';

// Framing Rules and Validation exports
export {
  FramingRule,
  FramingRuleType,
  RuleSeverity,
  IntersectionType,
  CornerType,
  STANDARD_STUD_SPACING,
  HEADER_SPAN_TABLE,
  CORNER_REQUIREMENTS,
  PLATE_REQUIREMENTS,
} from './FramingRule';
export type {
  ValidationResult,
  ValidationIssue,
  ValidationSuggestion,
  ValidationContext,
  FramingRuleConfig,
  FramingRuleValidator,
  Corner,
  Intersection,
  HeaderRequirement,
} from './FramingRule';

export {
  FramingRulesEngine,
  framingRulesEngine,
  detectCorners,
  detectIntersections,
  findAdjacentWalls,
} from './FramingRulesEngine';
