/**
 * Parametric modeling system for NEOcad
 * Provides formula-driven, constraint-based parametric BIM elements
 */

// Core parameter system
export { Parameter, ParameterType, ParameterUnit } from './Parameter';
export type { ParameterOptions } from './Parameter';

// Parameter engine for formula evaluation and dependency management
export { ParameterEngine } from './ParameterEngine';

// Base class for all parametric elements
export { ParametricElement } from './ParametricElement';

// Geometry engine wrapper
export { GeometryEngineWrapper, getGeometryEngine } from './GeometryEngineWrapper';
export type { GeometryEngineConfig } from './GeometryEngineWrapper';

// Parametric elements
export { ParametricWall } from './ParametricWall';
export type { ParametricWallOptions } from './ParametricWall';

export { ParametricDoor } from './ParametricDoor';
export type { ParametricDoorOptions } from './ParametricDoor';

export { ParametricColumn } from './ParametricColumn';
export type { ParametricColumnOptions, CrossSectionType } from './ParametricColumn';

export { ParametricWindow } from './ParametricWindow';
export type { ParametricWindowOptions, WindowType, GlazingType } from './ParametricWindow';
