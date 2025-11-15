/**
 * UnitConverter - Comprehensive unit conversion system
 */

export type LengthUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi';
export type AreaUnit = 'mm2' | 'cm2' | 'm2' | 'km2' | 'ha' | 'in2' | 'ft2' | 'yd2' | 'ac' | 'mi2';
export type VolumeUnit = 'mm3' | 'cm3' | 'm3' | 'in3' | 'ft3' | 'yd3';
export type AngleUnit = 'deg' | 'rad' | 'grad';

export type UnitSystem = 'metric' | 'imperial';

export interface UnitSettings {
  system: UnitSystem;
  length: LengthUnit;
  area: AreaUnit;
  volume: VolumeUnit;
  angle: AngleUnit;
  precision: number;
}

/**
 * Default unit settings
 */
export const DEFAULT_UNIT_SETTINGS: UnitSettings = {
  system: 'metric',
  length: 'm',
  area: 'm2',
  volume: 'm3',
  angle: 'deg',
  precision: 2,
};

/**
 * Unit conversion factors (to meters for length)
 */
const LENGTH_TO_METERS: Record<LengthUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

/**
 * Unit conversion factors (to square meters for area)
 */
const AREA_TO_SQUARE_METERS: Record<AreaUnit, number> = {
  mm2: 0.000001,
  cm2: 0.0001,
  m2: 1,
  km2: 1000000,
  ha: 10000,
  in2: 0.00064516,
  ft2: 0.09290304,
  yd2: 0.83612736,
  ac: 4046.8564224,
  mi2: 2589988.110336,
};

/**
 * Unit conversion factors (to cubic meters for volume)
 */
const VOLUME_TO_CUBIC_METERS: Record<VolumeUnit, number> = {
  mm3: 0.000000001,
  cm3: 0.000001,
  m3: 1,
  in3: 0.000016387064,
  ft3: 0.028316846592,
  yd3: 0.764554857984,
};

/**
 * Unit conversion factors (to radians for angle)
 */
const ANGLE_TO_RADIANS: Record<AngleUnit, number> = {
  deg: Math.PI / 180,
  rad: 1,
  grad: Math.PI / 200,
};

/**
 * Unit display names
 */
export const UNIT_NAMES: Record<string, string> = {
  // Length
  mm: 'millimeters',
  cm: 'centimeters',
  m: 'meters',
  km: 'kilometers',
  in: 'inches',
  ft: 'feet',
  yd: 'yards',
  mi: 'miles',
  // Area
  mm2: 'square millimeters',
  cm2: 'square centimeters',
  m2: 'square meters',
  km2: 'square kilometers',
  ha: 'hectares',
  in2: 'square inches',
  ft2: 'square feet',
  yd2: 'square yards',
  ac: 'acres',
  mi2: 'square miles',
  // Volume
  mm3: 'cubic millimeters',
  cm3: 'cubic centimeters',
  m3: 'cubic meters',
  in3: 'cubic inches',
  ft3: 'cubic feet',
  yd3: 'cubic yards',
  // Angle
  deg: 'degrees',
  rad: 'radians',
  grad: 'gradians',
};

/**
 * UnitConverter class
 */
export class UnitConverter {
  private settings: UnitSettings;

  constructor(settings: Partial<UnitSettings> = {}) {
    this.settings = { ...DEFAULT_UNIT_SETTINGS, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): UnitSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<UnitSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Convert length between units
   */
  convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
    const meters = value * LENGTH_TO_METERS[from];
    return meters / LENGTH_TO_METERS[to];
  }

  /**
   * Convert area between units
   */
  convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
    const squareMeters = value * AREA_TO_SQUARE_METERS[from];
    return squareMeters / AREA_TO_SQUARE_METERS[to];
  }

  /**
   * Convert volume between units
   */
  convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
    const cubicMeters = value * VOLUME_TO_CUBIC_METERS[from];
    return cubicMeters / VOLUME_TO_CUBIC_METERS[to];
  }

  /**
   * Convert angle between units
   */
  convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
    const radians = value * ANGLE_TO_RADIANS[from];
    return radians / ANGLE_TO_RADIANS[to];
  }

  /**
   * Format length with automatic unit selection
   */
  formatLength(value: number, sourceUnit: LengthUnit = 'm'): string {
    const meters = value * LENGTH_TO_METERS[sourceUnit];
    const targetUnit = this.settings.length;
    const converted = this.convertLength(value, sourceUnit, targetUnit);
    return `${converted.toFixed(this.settings.precision)} ${targetUnit}`;
  }

  /**
   * Format length with smart unit selection (auto-scale)
   */
  formatLengthSmart(value: number, sourceUnit: LengthUnit = 'm'): string {
    const meters = value * LENGTH_TO_METERS[sourceUnit];

    if (this.settings.system === 'metric') {
      if (meters < 0.01) {
        return `${(meters * 1000).toFixed(this.settings.precision)} mm`;
      } else if (meters < 1) {
        return `${(meters * 100).toFixed(this.settings.precision)} cm`;
      } else if (meters < 1000) {
        return `${meters.toFixed(this.settings.precision)} m`;
      } else {
        return `${(meters / 1000).toFixed(this.settings.precision)} km`;
      }
    } else {
      // Imperial
      const inches = meters / LENGTH_TO_METERS['in'];
      if (inches < 12) {
        return `${inches.toFixed(this.settings.precision)} in`;
      } else if (inches < 36) {
        return `${(inches / 12).toFixed(this.settings.precision)} ft`;
      } else if (inches < 63360) {
        return `${(inches / 36).toFixed(this.settings.precision)} yd`;
      } else {
        return `${(inches / 63360).toFixed(this.settings.precision)} mi`;
      }
    }
  }

  /**
   * Format area with automatic unit selection
   */
  formatArea(value: number, sourceUnit: AreaUnit = 'm2'): string {
    const squareMeters = value * AREA_TO_SQUARE_METERS[sourceUnit];
    const targetUnit = this.settings.area;
    const converted = this.convertArea(value, sourceUnit, targetUnit);
    return `${converted.toFixed(this.settings.precision)} ${targetUnit}`;
  }

  /**
   * Format area with smart unit selection (auto-scale)
   */
  formatAreaSmart(value: number, sourceUnit: AreaUnit = 'm2'): string {
    const squareMeters = value * AREA_TO_SQUARE_METERS[sourceUnit];

    if (this.settings.system === 'metric') {
      if (squareMeters < 0.01) {
        return `${(squareMeters * 1000000).toFixed(this.settings.precision)} mm²`;
      } else if (squareMeters < 1) {
        return `${(squareMeters * 10000).toFixed(this.settings.precision)} cm²`;
      } else if (squareMeters < 10000) {
        return `${squareMeters.toFixed(this.settings.precision)} m²`;
      } else {
        return `${(squareMeters / 10000).toFixed(this.settings.precision)} ha`;
      }
    } else {
      // Imperial
      const squareFeet = squareMeters / AREA_TO_SQUARE_METERS['ft2'];
      if (squareFeet < 1) {
        return `${(squareFeet * 144).toFixed(this.settings.precision)} in²`;
      } else if (squareFeet < 43560) {
        return `${squareFeet.toFixed(this.settings.precision)} ft²`;
      } else {
        return `${(squareFeet / 43560).toFixed(this.settings.precision)} ac`;
      }
    }
  }

  /**
   * Format volume with automatic unit selection
   */
  formatVolume(value: number, sourceUnit: VolumeUnit = 'm3'): string {
    const cubicMeters = value * VOLUME_TO_CUBIC_METERS[sourceUnit];
    const targetUnit = this.settings.volume;
    const converted = this.convertVolume(value, sourceUnit, targetUnit);
    return `${converted.toFixed(this.settings.precision)} ${targetUnit}`;
  }

  /**
   * Format volume with smart unit selection (auto-scale)
   */
  formatVolumeSmart(value: number, sourceUnit: VolumeUnit = 'm3'): string {
    const cubicMeters = value * VOLUME_TO_CUBIC_METERS[sourceUnit];

    if (this.settings.system === 'metric') {
      if (cubicMeters < 0.000001) {
        return `${(cubicMeters * 1000000000).toFixed(this.settings.precision)} mm³`;
      } else if (cubicMeters < 0.001) {
        return `${(cubicMeters * 1000000).toFixed(this.settings.precision)} cm³`;
      } else {
        return `${cubicMeters.toFixed(this.settings.precision)} m³`;
      }
    } else {
      // Imperial
      const cubicFeet = cubicMeters / VOLUME_TO_CUBIC_METERS['ft3'];
      if (cubicFeet < 1) {
        return `${(cubicFeet * 1728).toFixed(this.settings.precision)} in³`;
      } else if (cubicFeet < 27) {
        return `${cubicFeet.toFixed(this.settings.precision)} ft³`;
      } else {
        return `${(cubicFeet / 27).toFixed(this.settings.precision)} yd³`;
      }
    }
  }

  /**
   * Format angle with automatic unit selection
   */
  formatAngle(value: number, sourceUnit: AngleUnit = 'rad'): string {
    const targetUnit = this.settings.angle;
    const converted = this.convertAngle(value, sourceUnit, targetUnit);
    return `${converted.toFixed(this.settings.precision)}${targetUnit === 'deg' ? '°' : targetUnit}`;
  }

  /**
   * Get available units for a measurement type
   */
  static getAvailableUnits(type: 'length' | 'area' | 'volume' | 'angle'): string[] {
    switch (type) {
      case 'length':
        return Object.keys(LENGTH_TO_METERS);
      case 'area':
        return Object.keys(AREA_TO_SQUARE_METERS);
      case 'volume':
        return Object.keys(VOLUME_TO_CUBIC_METERS);
      case 'angle':
        return Object.keys(ANGLE_TO_RADIANS);
      default:
        return [];
    }
  }

  /**
   * Get unit system from unit
   */
  static getUnitSystem(unit: LengthUnit | AreaUnit | VolumeUnit): UnitSystem {
    const imperialUnits = ['in', 'ft', 'yd', 'mi', 'in2', 'ft2', 'yd2', 'ac', 'mi2', 'in3', 'ft3', 'yd3'];
    return imperialUnits.includes(unit) ? 'imperial' : 'metric';
  }

  /**
   * Parse value with unit from string
   */
  static parseValueWithUnit(
    str: string
  ): { value: number; unit: LengthUnit | AreaUnit | VolumeUnit | AngleUnit } | null {
    const match = str.match(/^([\d.]+)\s*([a-zA-Z°²³]+)$/);
    if (!match) return null;

    const value = parseFloat(match[1]);
    let unit = match[2];

    // Normalize unit strings
    if (unit === '°') unit = 'deg';
    if (unit === '²') unit = 'm2'; // Default to m2 if only ² is given

    return { value, unit: unit as any };
  }
}
