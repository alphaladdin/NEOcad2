/**
 * WallType - Defines a parametric wall type with material specifications
 * Supports US residential/commercial construction standards
 */

import * as THREE from 'three';

export interface MaterialLayer {
  name: string;
  thickness: number; // in inches
  material: string; // material type (wood, gypsum, OSB, etc.)
  rValue?: number; // thermal resistance
  color?: THREE.Color;
}

export interface StudSpecification {
  nominalSize: string; // e.g., "2x4", "2x6"
  actualWidth: number; // actual width in inches (1.5" for 2x, 3.5" for 4x)
  actualDepth: number; // actual depth in inches (3.5" for 4", 5.5" for 6")
  spacing: number; // on-center spacing in inches (16" or 24")
  material: string; // SPF, Doug Fir, LVL, etc.
}

export interface PlateSpecification {
  nominalSize: string; // e.g., "2x4"
  count: number; // 1 = single, 2 = double top plate
  type: 'top' | 'bottom';
}

export interface WallTypeConfig {
  id: string;
  name: string;
  description?: string;

  // Core dimensions
  nominalThickness: number; // in inches (e.g., 3.5" for 2x4)
  actualThickness: number; // in inches including finishes
  defaultHeight: number; // in feet (e.g., 9' ceiling)

  // Framing specifications
  stud: StudSpecification;
  topPlate: PlateSpecification;
  bottomPlate: PlateSpecification;

  // Material layers (from interior to exterior)
  layers: MaterialLayer[];

  // Structural properties
  isLoadBearing: boolean;
  isExterior: boolean;
  fireRating?: number; // in hours

  // Appearance
  color?: THREE.Color;
  lineWeight?: number;

  // Cost estimation
  costPerLinearFoot?: number;
  laborHoursPerLinearFoot?: number;
}

/**
 * Wall Type class representing a complete wall assembly
 */
export class WallType {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;

  // Dimensions (in meters for Three.js, stored as imperial for display)
  public readonly nominalThickness: number; // inches
  public readonly actualThickness: number; // inches
  public readonly defaultHeight: number; // feet

  // Framing
  public readonly stud: StudSpecification;
  public readonly topPlate: PlateSpecification;
  public readonly bottomPlate: PlateSpecification;

  // Layers
  public readonly layers: MaterialLayer[];

  // Properties
  public readonly isLoadBearing: boolean;
  public readonly isExterior: boolean;
  public readonly fireRating?: number;

  // Appearance
  public readonly color: THREE.Color;
  public readonly lineWeight: number;

  // Costing
  public readonly costPerLinearFoot: number;
  public readonly laborHoursPerLinearFoot: number;

  constructor(config: WallTypeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';

    this.nominalThickness = config.nominalThickness;
    this.actualThickness = config.actualThickness;
    this.defaultHeight = config.defaultHeight;

    this.stud = config.stud;
    this.topPlate = config.topPlate;
    this.bottomPlate = config.bottomPlate;

    this.layers = config.layers;

    this.isLoadBearing = config.isLoadBearing;
    this.isExterior = config.isExterior;
    this.fireRating = config.fireRating;

    this.color = config.color || new THREE.Color(0xcccccc);
    this.lineWeight = config.lineWeight || 1.0;

    this.costPerLinearFoot = config.costPerLinearFoot || 0;
    this.laborHoursPerLinearFoot = config.laborHoursPerLinearFoot || 0;
  }

  /**
   * Get wall thickness in meters (for Three.js)
   */
  getThicknessMeters(): number {
    return (this.actualThickness * 0.0254); // inches to meters
  }

  /**
   * Get wall height in meters (for Three.js)
   */
  getHeightMeters(): number {
    return (this.defaultHeight * 0.3048); // feet to meters
  }

  /**
   * Get total R-value of wall assembly
   */
  getTotalRValue(): number {
    return this.layers.reduce((sum, layer) => sum + (layer.rValue || 0), 0);
  }

  /**
   * Get material quantities for a given wall length
   */
  getMaterialQuantities(lengthFeet: number): Map<string, number> {
    const quantities = new Map<string, number>();

    // Calculate number of studs
    const studCount = Math.ceil((lengthFeet * 12) / this.stud.spacing) + 1; // +1 for end stud
    quantities.set(`${this.stud.nominalSize} stud`, studCount);

    // Calculate plate lengths
    quantities.set(`${this.topPlate.nominalSize} top plate`, lengthFeet * this.topPlate.count);
    quantities.set(`${this.bottomPlate.nominalSize} bottom plate`, lengthFeet);

    // Calculate layer materials
    const wallAreaSqFt = lengthFeet * this.defaultHeight;
    this.layers.forEach(layer => {
      const volume = wallAreaSqFt * (layer.thickness / 12); // cubic feet
      quantities.set(`${layer.name} (${layer.material})`, volume);
    });

    return quantities;
  }

  /**
   * Estimate cost for a given wall length
   */
  estimateCost(lengthFeet: number): { material: number; labor: number; total: number } {
    const material = lengthFeet * this.costPerLinearFoot;
    const labor = lengthFeet * this.laborHoursPerLinearFoot * 50; // $50/hr assumed labor rate
    return {
      material,
      labor,
      total: material + labor,
    };
  }

  /**
   * Clone this wall type with modifications
   */
  clone(overrides: Partial<WallTypeConfig> = {}): WallType {
    return new WallType({
      id: overrides.id || `${this.id}_copy`,
      name: overrides.name || `${this.name} (Copy)`,
      description: overrides.description || this.description,
      nominalThickness: overrides.nominalThickness || this.nominalThickness,
      actualThickness: overrides.actualThickness || this.actualThickness,
      defaultHeight: overrides.defaultHeight || this.defaultHeight,
      stud: overrides.stud || this.stud,
      topPlate: overrides.topPlate || this.topPlate,
      bottomPlate: overrides.bottomPlate || this.bottomPlate,
      layers: overrides.layers || this.layers,
      isLoadBearing: overrides.isLoadBearing !== undefined ? overrides.isLoadBearing : this.isLoadBearing,
      isExterior: overrides.isExterior !== undefined ? overrides.isExterior : this.isExterior,
      fireRating: overrides.fireRating || this.fireRating,
      color: overrides.color || this.color,
      lineWeight: overrides.lineWeight || this.lineWeight,
      costPerLinearFoot: overrides.costPerLinearFoot || this.costPerLinearFoot,
      laborHoursPerLinearFoot: overrides.laborHoursPerLinearFoot || this.laborHoursPerLinearFoot,
    });
  }

  /**
   * Export wall type to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nominalThickness: this.nominalThickness,
      actualThickness: this.actualThickness,
      defaultHeight: this.defaultHeight,
      stud: this.stud,
      topPlate: this.topPlate,
      bottomPlate: this.bottomPlate,
      layers: this.layers.map(layer => ({
        ...layer,
        color: layer.color?.getHex(),
      })),
      isLoadBearing: this.isLoadBearing,
      isExterior: this.isExterior,
      fireRating: this.fireRating,
      color: this.color.getHex(),
      lineWeight: this.lineWeight,
      costPerLinearFoot: this.costPerLinearFoot,
      laborHoursPerLinearFoot: this.laborHoursPerLinearFoot,
    };
  }

  /**
   * Create wall type from JSON
   */
  static fromJSON(data: any): WallType {
    return new WallType({
      ...data,
      layers: data.layers.map((layer: any) => ({
        ...layer,
        color: layer.color ? new THREE.Color(layer.color) : undefined,
      })),
      color: new THREE.Color(data.color),
    });
  }
}
