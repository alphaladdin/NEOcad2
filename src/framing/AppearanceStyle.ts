/**
 * AppearanceStyle - Defines visual styles and rendering settings for building elements
 * Supports multiple display modes and material configurations for Three.js
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';

export enum DisplayMode {
  SOLID = 'solid',
  WIREFRAME = 'wireframe',
  HIDDEN_LINE = 'hidden_line',
  REALISTIC = 'realistic',
}

export interface MaterialSettings {
  color: THREE.Color;
  opacity: number;
  metalness: number;
  roughness: number;
  wireframe?: boolean;
  transparent?: boolean;
  flatShading?: boolean;
  side?: THREE.Side;
}

export interface AppearanceStyleConfig {
  id: string;
  name: string;
  description?: string;

  // Material settings
  materialSettings: MaterialSettings;

  // Line rendering
  lineWeight: number;
  lineColor: THREE.Color;

  // Display mode
  displayMode: DisplayMode;

  // Annotation visibility
  showDimensions: boolean;
  showLabels: boolean;

  // Additional rendering options
  castShadow?: boolean;
  receiveShadow?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
}

/**
 * AppearanceStyle class representing a complete visual style configuration
 */
export class AppearanceStyle {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;

  // Material settings
  public readonly materialSettings: MaterialSettings;

  // Line rendering
  public readonly lineWeight: number;
  public readonly lineColor: THREE.Color;

  // Display mode
  public readonly displayMode: DisplayMode;

  // Annotation visibility
  public readonly showDimensions: boolean;
  public readonly showLabels: boolean;

  // Shadow and depth settings
  public readonly castShadow: boolean;
  public readonly receiveShadow: boolean;
  public readonly depthTest: boolean;
  public readonly depthWrite: boolean;

  constructor(config: AppearanceStyleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';

    this.materialSettings = { ...config.materialSettings };
    this.lineWeight = config.lineWeight;
    this.lineColor = config.lineColor.clone();

    this.displayMode = config.displayMode;

    this.showDimensions = config.showDimensions;
    this.showLabels = config.showLabels;

    this.castShadow = config.castShadow ?? true;
    this.receiveShadow = config.receiveShadow ?? true;
    this.depthTest = config.depthTest ?? true;
    this.depthWrite = config.depthWrite ?? true;
  }

  /**
   * Apply this style to a Three.js mesh
   */
  applyToMesh(mesh: THREE.Mesh): void {
    if (!mesh || !mesh.material) {
      logger.warn('AppearanceStyle', 'Cannot apply style to invalid mesh');
      return;
    }

    // Apply material based on display mode
    const material = this.createMaterial();
    mesh.material = material;

    // Apply shadow settings
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;

    logger.debug('AppearanceStyle', `Applied style "${this.name}" to mesh`);
  }

  /**
   * Create a Three.js material based on this style's settings
   */
  createMaterial(): THREE.Material {
    const settings = this.materialSettings;

    switch (this.displayMode) {
      case DisplayMode.SOLID:
        return new THREE.MeshStandardMaterial({
          color: settings.color,
          opacity: settings.opacity,
          transparent: settings.opacity < 1.0 || settings.transparent,
          metalness: settings.metalness,
          roughness: settings.roughness,
          flatShading: settings.flatShading ?? false,
          side: settings.side ?? THREE.DoubleSide,
          depthTest: this.depthTest,
          depthWrite: this.depthWrite,
        });

      case DisplayMode.WIREFRAME:
        return new THREE.MeshBasicMaterial({
          color: this.lineColor,
          wireframe: true,
          opacity: settings.opacity,
          transparent: settings.opacity < 1.0 || settings.transparent,
          side: settings.side ?? THREE.DoubleSide,
          depthTest: this.depthTest,
          depthWrite: this.depthWrite,
        });

      case DisplayMode.HIDDEN_LINE:
        // Hidden line rendering: solid white faces with black edges
        return new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xffffff),
          opacity: 1.0,
          transparent: false,
          side: settings.side ?? THREE.DoubleSide,
          depthTest: this.depthTest,
          depthWrite: this.depthWrite,
        });

      case DisplayMode.REALISTIC:
        return new THREE.MeshStandardMaterial({
          color: settings.color,
          opacity: settings.opacity,
          transparent: settings.opacity < 1.0 || settings.transparent,
          metalness: settings.metalness,
          roughness: settings.roughness,
          flatShading: false,
          side: settings.side ?? THREE.DoubleSide,
          depthTest: this.depthTest,
          depthWrite: this.depthWrite,
          envMapIntensity: 1.0,
        });

      default:
        logger.warn('AppearanceStyle', `Unknown display mode: ${this.displayMode}, using SOLID`);
        return new THREE.MeshStandardMaterial({
          color: settings.color,
          opacity: settings.opacity,
          transparent: settings.opacity < 1.0,
        });
    }
  }

  /**
   * Update material settings from an existing Three.js material
   */
  static fromMaterial(material: THREE.Material, id: string, name: string): AppearanceStyle {
    let color = new THREE.Color(0xcccccc);
    let opacity = 1.0;
    let metalness = 0.0;
    let roughness = 0.5;
    let wireframe = false;
    let displayMode = DisplayMode.SOLID;

    if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
      if (material.color) color = material.color.clone();
      opacity = material.opacity;
      if ('metalness' in material) metalness = material.metalness;
      if ('roughness' in material) roughness = material.roughness;
      wireframe = material.wireframe;
      displayMode = wireframe ? DisplayMode.WIREFRAME : DisplayMode.SOLID;
    }

    return new AppearanceStyle({
      id,
      name,
      materialSettings: {
        color,
        opacity,
        metalness,
        roughness,
        wireframe,
        transparent: opacity < 1.0,
      },
      lineWeight: 1.0,
      lineColor: new THREE.Color(0x000000),
      displayMode,
      showDimensions: true,
      showLabels: true,
    });
  }

  /**
   * Clone this style with modifications
   */
  clone(overrides: Partial<AppearanceStyleConfig> = {}): AppearanceStyle {
    return new AppearanceStyle({
      id: overrides.id || `${this.id}_copy`,
      name: overrides.name || `${this.name} (Copy)`,
      description: overrides.description || this.description,
      materialSettings: overrides.materialSettings || { ...this.materialSettings },
      lineWeight: overrides.lineWeight || this.lineWeight,
      lineColor: overrides.lineColor || this.lineColor.clone(),
      displayMode: overrides.displayMode || this.displayMode,
      showDimensions: overrides.showDimensions !== undefined ? overrides.showDimensions : this.showDimensions,
      showLabels: overrides.showLabels !== undefined ? overrides.showLabels : this.showLabels,
      castShadow: overrides.castShadow !== undefined ? overrides.castShadow : this.castShadow,
      receiveShadow: overrides.receiveShadow !== undefined ? overrides.receiveShadow : this.receiveShadow,
      depthTest: overrides.depthTest !== undefined ? overrides.depthTest : this.depthTest,
      depthWrite: overrides.depthWrite !== undefined ? overrides.depthWrite : this.depthWrite,
    });
  }

  /**
   * Export appearance style to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      materialSettings: {
        ...this.materialSettings,
        color: this.materialSettings.color.getHex(),
      },
      lineWeight: this.lineWeight,
      lineColor: this.lineColor.getHex(),
      displayMode: this.displayMode,
      showDimensions: this.showDimensions,
      showLabels: this.showLabels,
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
      depthTest: this.depthTest,
      depthWrite: this.depthWrite,
    };
  }

  /**
   * Create appearance style from JSON
   */
  static fromJSON(data: any): AppearanceStyle {
    return new AppearanceStyle({
      id: data.id,
      name: data.name,
      description: data.description,
      materialSettings: {
        ...data.materialSettings,
        color: new THREE.Color(data.materialSettings.color),
      },
      lineWeight: data.lineWeight,
      lineColor: new THREE.Color(data.lineColor),
      displayMode: data.displayMode,
      showDimensions: data.showDimensions,
      showLabels: data.showLabels,
      castShadow: data.castShadow,
      receiveShadow: data.receiveShadow,
      depthTest: data.depthTest,
      depthWrite: data.depthWrite,
    });
  }

  /**
   * Get a human-readable description of this style
   */
  getDescription(): string {
    return `${this.name}: ${this.displayMode} mode, ${this.showDimensions ? 'with' : 'without'} dimensions`;
  }

  /**
   * Check if this style is compatible with a given material type
   */
  isCompatibleWith(material: THREE.Material): boolean {
    // All styles are compatible with MeshStandardMaterial and MeshBasicMaterial
    return (
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshBasicMaterial ||
      material instanceof THREE.MeshPhongMaterial ||
      material instanceof THREE.MeshLambertMaterial
    );
  }
}
