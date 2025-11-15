/**
 * Units - Unit conversion utilities for NEOcad
 *
 * CRITICAL: NEOcad uses two coordinate systems:
 * - Storage Layer (Parameters): MILLIMETERS
 * - Rendering Layer (Three.js): METERS
 *
 * Always use these conversion functions at system boundaries.
 */

import * as THREE from 'three';

/**
 * Branded types for compile-time unit safety
 * These prevent accidentally mixing millimeters and meters
 */
export type Millimeters = number & { readonly __brand: 'Millimeters' };
export type Meters = number & { readonly __brand: 'Meters' };

/**
 * Unit conversion constants
 */
export const UNITS = {
  MM_PER_METER: 1000,
  METERS_PER_MM: 0.001,
} as const;

/**
 * Core unit conversion utilities
 */
export class Units {
  /**
   * Convert millimeters to meters
   * Use this when going from parametric storage → Three.js rendering
   *
   * @param mm - Value in millimeters
   * @returns Value in meters
   *
   * @example
   * const widthMM = 762; // Storage layer
   * const widthM = Units.mmToMeters(widthMM); // 0.762 for rendering
   */
  static mmToMeters(mm: number): number {
    return mm * UNITS.METERS_PER_MM;
  }

  /**
   * Convert meters to millimeters
   * Use this when going from Three.js rendering → parametric storage
   *
   * @param m - Value in meters
   * @returns Value in millimeters
   *
   * @example
   * const raycastPoint = raycaster.intersect(...); // meters
   * const pointMM = Units.metersToMM(raycastPoint.x); // millimeters for storage
   */
  static metersToMM(m: number): number {
    return m * UNITS.MM_PER_METER;
  }

  /**
   * Convert Vector3 from millimeters to meters
   * Creates a NEW vector (does not mutate)
   *
   * @param vectorMM - Vector in millimeters
   * @returns New vector in meters
   *
   * @example
   * const startMM = wall.getStartPoint(); // millimeters
   * const startM = Units.vectorMMToMeters(startMM); // meters for Three.js
   */
  static vectorMMToMeters(vectorMM: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      Units.mmToMeters(vectorMM.x),
      Units.mmToMeters(vectorMM.y),
      Units.mmToMeters(vectorMM.z)
    );
  }

  /**
   * Convert Vector3 from meters to millimeters
   * Creates a NEW vector (does not mutate)
   *
   * @param vectorM - Vector in meters
   * @returns New vector in millimeters
   *
   * @example
   * const raycastPoint = raycaster.intersect(...); // meters
   * const pointMM = Units.vectorMetersToMM(raycastPoint.point); // millimeters
   */
  static vectorMetersToMM(vectorM: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      Units.metersToMM(vectorM.x),
      Units.metersToMM(vectorM.y),
      Units.metersToMM(vectorM.z)
    );
  }

  /**
   * Convert Vector2 from millimeters to meters
   * Creates a NEW vector (does not mutate)
   */
  static vector2MMToMeters(vectorMM: THREE.Vector2): THREE.Vector2 {
    return new THREE.Vector2(
      Units.mmToMeters(vectorMM.x),
      Units.mmToMeters(vectorMM.y)
    );
  }

  /**
   * Convert Vector2 from meters to millimeters
   * Creates a NEW vector (does not mutate)
   */
  static vector2MetersToMM(vectorM: THREE.Vector2): THREE.Vector2 {
    return new THREE.Vector2(
      Units.metersToMM(vectorM.x),
      Units.metersToMM(vectorM.y)
    );
  }

  /**
   * Check if a value is a valid measurement in millimeters
   * (positive, finite number)
   */
  static isValidMM(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  /**
   * Check if a value is a valid measurement in meters
   * (positive, finite number)
   */
  static isValidMeters(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  /**
   * Format millimeters for display
   *
   * @param mm - Value in millimeters
   * @param decimals - Number of decimal places (default: 1)
   * @returns Formatted string with unit
   *
   * @example
   * Units.formatMM(762) // "762.0mm"
   * Units.formatMM(762.123, 2) // "762.12mm"
   */
  static formatMM(mm: number, decimals: number = 1): string {
    return `${mm.toFixed(decimals)}mm`;
  }

  /**
   * Format meters for display
   *
   * @param m - Value in meters
   * @param decimals - Number of decimal places (default: 3)
   * @returns Formatted string with unit
   *
   * @example
   * Units.formatMeters(0.762) // "0.762m"
   * Units.formatMeters(0.762, 2) // "0.76m"
   */
  static formatMeters(m: number, decimals: number = 3): string {
    return `${m.toFixed(decimals)}m`;
  }

  /**
   * Format vector in millimeters for logging
   *
   * @example
   * Units.formatVectorMM(new Vector3(100, 200, 300))
   * // "(100.0, 200.0, 300.0)mm"
   */
  static formatVectorMM(v: THREE.Vector3, decimals: number = 1): string {
    return `(${v.x.toFixed(decimals)}, ${v.y.toFixed(decimals)}, ${v.z.toFixed(decimals)})mm`;
  }

  /**
   * Format vector in meters for logging
   *
   * @example
   * Units.formatVectorMeters(new Vector3(0.1, 0.2, 0.3))
   * // "(0.100, 0.200, 0.300)m"
   */
  static formatVectorMeters(v: THREE.Vector3, decimals: number = 3): string {
    return `(${v.x.toFixed(decimals)}, ${v.y.toFixed(decimals)}, ${v.z.toFixed(decimals)})m`;
  }
}

/**
 * Conversion helper for common imperial units to millimeters
 */
export class ImperialUnits {
  static readonly INCHES_TO_MM = 25.4;
  static readonly FEET_TO_MM = 304.8;

  /**
   * Convert inches to millimeters
   *
   * @example
   * ImperialUnits.inchesToMM(30) // 762 (standard door width)
   */
  static inchesToMM(inches: number): number {
    return inches * ImperialUnits.INCHES_TO_MM;
  }

  /**
   * Convert feet to millimeters
   *
   * @example
   * ImperialUnits.feetToMM(9) // 2743.2 (standard wall height)
   */
  static feetToMM(feet: number): number {
    return feet * ImperialUnits.FEET_TO_MM;
  }

  /**
   * Convert millimeters to inches
   */
  static mmToInches(mm: number): number {
    return mm / ImperialUnits.INCHES_TO_MM;
  }

  /**
   * Convert millimeters to feet
   */
  static mmToFeet(mm: number): number {
    return mm / ImperialUnits.FEET_TO_MM;
  }

  /**
   * Format feet and inches
   *
   * @example
   * ImperialUnits.formatFeetInches(2743.2) // "9'-0\""
   */
  static formatFeetInches(mm: number): string {
    const totalInches = mm / ImperialUnits.INCHES_TO_MM;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'-${inches}"`;
  }
}
