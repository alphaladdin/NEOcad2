/**
 * Dimension style configuration
 * Based on ISO and ANSI standards
 */
export interface DimensionStyle {
  name: string;

  // Text properties
  textHeight: number;
  textColor: string;
  textFont: string;
  textOffset: number; // Offset from dimension line

  // Arrow properties
  arrowSize: number;
  arrowType: 'arrow' | 'tick' | 'dot' | 'none';

  // Line properties
  dimLineColor: string;
  dimLineWeight: number;
  extLineColor: string;
  extLineWeight: number;
  extLineExtend: number; // Extension beyond dimension line
  extLineOffset: number; // Offset from point

  // Dimension line
  dimLineExtend: number; // Extension beyond extension lines

  // Precision
  precision: number; // Decimal places
  units: 'mm' | 'cm' | 'm' | 'ft' | 'in';
  unitFormat: 'decimal' | 'architectural' | 'fractional';

  // Display
  showUnits: boolean;
  suppressZeros: boolean;

  // Scale
  scale: number;
}

/**
 * DimensionStyleManager - Manages dimension styles
 */
export class DimensionStyleManager {
  private styles: Map<string, DimensionStyle> = new Map();
  private activeStyleName: string = 'Standard';

  constructor() {
    this.initializeDefaultStyles();
  }

  /**
   * Initialize default dimension styles
   */
  private initializeDefaultStyles(): void {
    // Standard (ISO) style
    this.addStyle({
      name: 'Standard',
      textHeight: 2.5,
      textColor: '#ffffff',
      textFont: 'Arial',
      textOffset: 1,
      arrowSize: 2.5,
      arrowType: 'arrow',
      dimLineColor: '#00ff00',
      dimLineWeight: 0.25,
      extLineColor: '#00ff00',
      extLineWeight: 0.18,
      extLineExtend: 1.25,
      extLineOffset: 0.625,
      dimLineExtend: 1.25,
      precision: 2,
      units: 'm',
      unitFormat: 'decimal',
      showUnits: true,
      suppressZeros: true,
      scale: 1,
    });

    // Architectural style (feet and inches)
    this.addStyle({
      name: 'Architectural',
      textHeight: 3,
      textColor: '#ffffff',
      textFont: 'Arial',
      textOffset: 1.5,
      arrowSize: 3,
      arrowType: 'tick',
      dimLineColor: '#00ff00',
      dimLineWeight: 0.35,
      extLineColor: '#00ff00',
      extLineWeight: 0.25,
      extLineExtend: 1.5,
      extLineOffset: 1,
      dimLineExtend: 1.5,
      precision: 2,
      units: 'ft',
      unitFormat: 'architectural',
      showUnits: true,
      suppressZeros: true,
      scale: 1,
    });

    // Mechanical style (millimeters)
    this.addStyle({
      name: 'Mechanical',
      textHeight: 2,
      textColor: '#ffffff',
      textFont: 'Arial',
      textOffset: 0.8,
      arrowSize: 2,
      arrowType: 'arrow',
      dimLineColor: '#00ff00',
      dimLineWeight: 0.18,
      extLineColor: '#00ff00',
      extLineWeight: 0.13,
      extLineExtend: 1,
      extLineOffset: 0.5,
      dimLineExtend: 1,
      precision: 1,
      units: 'mm',
      unitFormat: 'decimal',
      showUnits: true,
      suppressZeros: true,
      scale: 1,
    });
  }

  /**
   * Add or update a dimension style
   */
  addStyle(style: DimensionStyle): void {
    this.styles.set(style.name, style);
  }

  /**
   * Get a dimension style
   */
  getStyle(name: string): DimensionStyle | undefined {
    return this.styles.get(name);
  }

  /**
   * Get all dimension styles
   */
  getAllStyles(): DimensionStyle[] {
    return Array.from(this.styles.values());
  }

  /**
   * Get active dimension style
   */
  getActiveStyle(): DimensionStyle {
    return this.styles.get(this.activeStyleName) || this.styles.get('Standard')!;
  }

  /**
   * Set active dimension style
   */
  setActiveStyle(name: string): boolean {
    if (this.styles.has(name)) {
      this.activeStyleName = name;
      return true;
    }
    return false;
  }

  /**
   * Remove a dimension style
   */
  removeStyle(name: string): boolean {
    if (name === 'Standard') {
      console.warn('Cannot remove Standard style');
      return false;
    }
    if (name === this.activeStyleName) {
      this.activeStyleName = 'Standard';
    }
    return this.styles.delete(name);
  }

  /**
   * Format dimension value based on style
   */
  formatValue(value: number, style: DimensionStyle): string {
    switch (style.unitFormat) {
      case 'architectural':
        return this.formatArchitectural(value, style);
      case 'fractional':
        return this.formatFractional(value, style);
      default:
        return this.formatDecimal(value, style);
    }
  }

  /**
   * Format as decimal
   */
  private formatDecimal(value: number, style: DimensionStyle): string {
    let formatted = value.toFixed(style.precision);

    if (style.suppressZeros) {
      formatted = formatted.replace(/\.?0+$/, '');
    }

    if (style.showUnits) {
      formatted += ` ${style.units}`;
    }

    return formatted;
  }

  /**
   * Format as architectural (feet and inches)
   */
  private formatArchitectural(valueInMeters: number, style: DimensionStyle): string {
    // Convert to feet
    const totalInches = valueInMeters * 39.3701; // meters to inches
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;

    const inchesRounded = Math.round(inches * Math.pow(10, style.precision)) / Math.pow(10, style.precision);

    if (feet === 0) {
      return `${inchesRounded}"`;
    }

    if (inchesRounded === 0) {
      return `${feet}'`;
    }

    return `${feet}'-${inchesRounded}"`;
  }

  /**
   * Format as fractional
   */
  private formatFractional(value: number, style: DimensionStyle): string {
    const precision = Math.pow(2, style.precision + 2); // 1/4, 1/8, 1/16, 1/32...
    const whole = Math.floor(value);
    const fraction = value - whole;
    const numerator = Math.round(fraction * precision);

    if (numerator === 0) {
      return `${whole}`;
    }

    if (numerator === precision) {
      return `${whole + 1}`;
    }

    // Simplify fraction
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(numerator, precision);
    const simplifiedNum = numerator / divisor;
    const simplifiedDen = precision / divisor;

    if (whole === 0) {
      return `${simplifiedNum}/${simplifiedDen}`;
    }

    return `${whole} ${simplifiedNum}/${simplifiedDen}`;
  }
}
