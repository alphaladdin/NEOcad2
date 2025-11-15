import { DrawingUnits } from '../document/Drawing';

/**
 * Unit conversion factors (to millimeters)
 */
const UNIT_FACTORS: Record<DrawingUnits, number> = {
  [DrawingUnits.MILLIMETERS]: 1,
  [DrawingUnits.CENTIMETERS]: 10,
  [DrawingUnits.METERS]: 1000,
  [DrawingUnits.INCHES]: 25.4,
  [DrawingUnits.FEET]: 304.8,
  [DrawingUnits.YARDS]: 914.4,
};

/**
 * Unit display names
 */
const UNIT_NAMES: Record<DrawingUnits, string> = {
  [DrawingUnits.MILLIMETERS]: 'Millimeters',
  [DrawingUnits.CENTIMETERS]: 'Centimeters',
  [DrawingUnits.METERS]: 'Meters',
  [DrawingUnits.INCHES]: 'Inches',
  [DrawingUnits.FEET]: 'Feet',
  [DrawingUnits.YARDS]: 'Yards',
};

/**
 * Unit abbreviations
 */
const UNIT_ABBREVIATIONS: Record<DrawingUnits, string> = {
  [DrawingUnits.MILLIMETERS]: 'mm',
  [DrawingUnits.CENTIMETERS]: 'cm',
  [DrawingUnits.METERS]: 'm',
  [DrawingUnits.INCHES]: 'in',
  [DrawingUnits.FEET]: 'ft',
  [DrawingUnits.YARDS]: 'yd',
};

/**
 * UnitsConverter - Convert between different measurement units
 */
export class UnitsConverter {
  /**
   * Convert value from one unit to another
   */
  static convert(value: number, fromUnit: DrawingUnits, toUnit: DrawingUnits): number {
    if (fromUnit === toUnit) return value;

    // Convert to millimeters first, then to target unit
    const mm = value * UNIT_FACTORS[fromUnit];
    return mm / UNIT_FACTORS[toUnit];
  }

  /**
   * Format value with unit
   */
  static format(
    value: number,
    unit: DrawingUnits,
    precision: number = 2,
    showUnit: boolean = true
  ): string {
    const formatted = value.toFixed(precision);
    return showUnit ? `${formatted} ${UNIT_ABBREVIATIONS[unit]}` : formatted;
  }

  /**
   * Format value as architectural (feet and inches)
   */
  static formatArchitectural(value: number, sourceUnit: DrawingUnits): string {
    // Convert to inches
    const inches = this.convert(value, sourceUnit, DrawingUnits.INCHES);

    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;

    if (feet === 0) {
      return `${remainingInches.toFixed(2)}"`;
    }

    if (remainingInches === 0) {
      return `${feet}'`;
    }

    return `${feet}'-${remainingInches.toFixed(2)}"`;
  }

  /**
   * Format value as fractional
   */
  static formatFractional(
    value: number,
    unit: DrawingUnits,
    denominator: number = 16
  ): string {
    const whole = Math.floor(value);
    const fraction = value - whole;

    if (fraction === 0) {
      return `${whole} ${UNIT_ABBREVIATIONS[unit]}`;
    }

    // Find closest fraction
    const numerator = Math.round(fraction * denominator);

    if (numerator === 0) {
      return `${whole} ${UNIT_ABBREVIATIONS[unit]}`;
    }

    if (numerator === denominator) {
      return `${whole + 1} ${UNIT_ABBREVIATIONS[unit]}`;
    }

    // Simplify fraction
    const gcd = this.gcd(numerator, denominator);
    const simplifiedNum = numerator / gcd;
    const simplifiedDen = denominator / gcd;

    if (whole === 0) {
      return `${simplifiedNum}/${simplifiedDen} ${UNIT_ABBREVIATIONS[unit]}`;
    }

    return `${whole} ${simplifiedNum}/${simplifiedDen} ${UNIT_ABBREVIATIONS[unit]}`;
  }

  /**
   * Greatest common divisor
   */
  private static gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  /**
   * Parse value from string
   */
  static parse(input: string, defaultUnit: DrawingUnits = DrawingUnits.MILLIMETERS): number {
    input = input.trim().toLowerCase();

    // Try to extract unit
    let value = 0;
    let unit = defaultUnit;

    // Check for unit suffix
    for (const [unitType, abbr] of Object.entries(UNIT_ABBREVIATIONS)) {
      if (input.endsWith(abbr)) {
        unit = unitType as DrawingUnits;
        input = input.substring(0, input.length - abbr.length).trim();
        break;
      }
    }

    // Parse architectural format (e.g., 5'-6")
    const archMatch = input.match(/^(\d+)'\s*-?\s*(\d+\.?\d*)"?$/);
    if (archMatch) {
      const feet = parseInt(archMatch[1]);
      const inches = parseFloat(archMatch[2]);
      return this.convert(feet * 12 + inches, DrawingUnits.INCHES, unit);
    }

    // Parse fractional format (e.g., 3 1/2)
    const fracMatch = input.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
    if (fracMatch) {
      const whole = fracMatch[1] ? parseInt(fracMatch[1]) : 0;
      const numerator = parseInt(fracMatch[2]);
      const denominator = parseInt(fracMatch[3]);
      value = whole + numerator / denominator;
    } else {
      value = parseFloat(input);
    }

    return isNaN(value) ? 0 : value;
  }

  /**
   * Get unit name
   */
  static getUnitName(unit: DrawingUnits): string {
    return UNIT_NAMES[unit];
  }

  /**
   * Get unit abbreviation
   */
  static getUnitAbbreviation(unit: DrawingUnits): string {
    return UNIT_ABBREVIATIONS[unit];
  }

  /**
   * Get all available units
   */
  static getAvailableUnits(): DrawingUnits[] {
    return Object.values(DrawingUnits);
  }

  /**
   * Get conversion factor to millimeters
   */
  static getConversionFactor(unit: DrawingUnits): number {
    return UNIT_FACTORS[unit];
  }

  /**
   * Calculate scale factor between two units
   */
  static getScaleFactor(fromUnit: DrawingUnits, toUnit: DrawingUnits): number {
    return UNIT_FACTORS[fromUnit] / UNIT_FACTORS[toUnit];
  }

  /**
   * Format area with unit
   */
  static formatArea(
    area: number,
    unit: DrawingUnits,
    precision: number = 2,
    showUnit: boolean = true
  ): string {
    const formatted = area.toFixed(precision);
    return showUnit ? `${formatted} ${UNIT_ABBREVIATIONS[unit]}²` : formatted;
  }

  /**
   * Format volume with unit
   */
  static formatVolume(
    volume: number,
    unit: DrawingUnits,
    precision: number = 2,
    showUnit: boolean = true
  ): string {
    const formatted = volume.toFixed(precision);
    return showUnit ? `${formatted} ${UNIT_ABBREVIATIONS[unit]}³` : formatted;
  }

  /**
   * Convert area between units
   */
  static convertArea(area: number, fromUnit: DrawingUnits, toUnit: DrawingUnits): number {
    const factor = this.getScaleFactor(fromUnit, toUnit);
    return area * factor * factor;
  }

  /**
   * Convert volume between units
   */
  static convertVolume(volume: number, fromUnit: DrawingUnits, toUnit: DrawingUnits): number {
    const factor = this.getScaleFactor(fromUnit, toUnit);
    return volume * factor * factor * factor;
  }
}
