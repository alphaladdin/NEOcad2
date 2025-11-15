/**
 * Dimension style configuration
 */
export interface DimensionStyle {
  /** Arrow size in world units */
  arrowSize?: number;
  /** Text height in world units */
  textHeight?: number;
  /** Font family */
  fontFamily?: string;
  /** Text color (overrides entity color) */
  textColor?: string | null;
  /** Line color (overrides entity color) */
  lineColor?: string | null;
  /** Text background color */
  textBackgroundColor?: string;
  /** Show text background */
  showTextBackground?: boolean;
  /** Extension line offset from measured points */
  extensionLineOffset?: number;
  /** Extension line extension beyond dimension line */
  extensionLineExtension?: number;
  /** Text offset from dimension line */
  textOffset?: number;
}

/**
 * Predefined dimension styles
 */
export class DimensionStyles {
  static readonly ARCHITECTURAL: DimensionStyle = {
    arrowSize: 0.2,
    textHeight: 0.25,
    fontFamily: 'Arial',
    showTextBackground: true,
    textBackgroundColor: '#1a1a1a',
    extensionLineOffset: 0.1,
    extensionLineExtension: 0.2,
    textOffset: 0.8,
  };

  static readonly MECHANICAL: DimensionStyle = {
    arrowSize: 0.15,
    textHeight: 0.2,
    fontFamily: 'Arial',
    showTextBackground: true,
    textBackgroundColor: '#ffffff',
    textColor: '#000000',
    lineColor: '#000000',
    extensionLineOffset: 0.05,
    extensionLineExtension: 0.15,
    textOffset: 0.6,
  };

  static readonly MINIMAL: DimensionStyle = {
    arrowSize: 0.1,
    textHeight: 0.2,
    fontFamily: 'Arial',
    showTextBackground: false,
    extensionLineOffset: 0.05,
    extensionLineExtension: 0.1,
    textOffset: 0.5,
  };

  static readonly BOLD: DimensionStyle = {
    arrowSize: 0.3,
    textHeight: 0.35,
    fontFamily: 'Arial Bold',
    showTextBackground: true,
    textBackgroundColor: '#000000',
    textColor: '#ffff00',
    lineColor: '#ffff00',
    extensionLineOffset: 0.15,
    extensionLineExtension: 0.25,
    textOffset: 1.0,
  };
}
