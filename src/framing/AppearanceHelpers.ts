/**
 * AppearanceHelpers - Helper functions for appearance style operations
 * Provides utilities for material conversion, batch operations, and preset management
 */

import * as THREE from 'three';
import { AppearanceStyle, MaterialSettings } from './AppearanceStyle';
import { AppearanceManager } from './AppearanceManager';
import { logger } from '@utils/Logger';

/**
 * Convert a Three.js material to MaterialSettings
 */
export function materialToSettings(material: THREE.Material): MaterialSettings {
  const settings: MaterialSettings = {
    color: new THREE.Color(0xcccccc),
    opacity: 1.0,
    metalness: 0.0,
    roughness: 0.5,
  };

  if (material instanceof THREE.MeshStandardMaterial) {
    if (material.color) settings.color = material.color.clone();
    settings.opacity = material.opacity;
    settings.metalness = material.metalness;
    settings.roughness = material.roughness;
    settings.wireframe = material.wireframe;
    settings.transparent = material.transparent;
    settings.flatShading = material.flatShading;
    settings.side = material.side;
  } else if (material instanceof THREE.MeshBasicMaterial) {
    if (material.color) settings.color = material.color.clone();
    settings.opacity = material.opacity;
    settings.wireframe = material.wireframe;
    settings.transparent = material.transparent;
    settings.side = material.side;
  } else if (material instanceof THREE.MeshPhongMaterial) {
    if (material.color) settings.color = material.color.clone();
    settings.opacity = material.opacity;
    settings.wireframe = material.wireframe;
    settings.transparent = material.transparent;
    settings.flatShading = material.flatShading;
    settings.side = material.side;
  } else if (material instanceof THREE.MeshLambertMaterial) {
    if (material.color) settings.color = material.color.clone();
    settings.opacity = material.opacity;
    settings.wireframe = material.wireframe;
    settings.transparent = material.transparent;
    settings.side = material.side;
  }

  return settings;
}

/**
 * Convert MaterialSettings to a Three.js material
 */
export function settingsToMaterial(
  settings: MaterialSettings,
  materialType: 'standard' | 'basic' | 'phong' | 'lambert' = 'standard'
): THREE.Material {
  const commonProps = {
    color: settings.color,
    opacity: settings.opacity,
    transparent: settings.transparent ?? settings.opacity < 1.0,
    wireframe: settings.wireframe,
    side: settings.side ?? THREE.DoubleSide,
  };

  switch (materialType) {
    case 'standard':
      return new THREE.MeshStandardMaterial({
        ...commonProps,
        metalness: settings.metalness,
        roughness: settings.roughness,
        flatShading: settings.flatShading,
      });

    case 'basic':
      return new THREE.MeshBasicMaterial(commonProps);

    case 'phong':
      return new THREE.MeshPhongMaterial({
        ...commonProps,
        flatShading: settings.flatShading,
      });

    case 'lambert':
      return new THREE.MeshLambertMaterial({
        ...commonProps,
        flatShading: settings.flatShading,
      });

    default:
      return new THREE.MeshStandardMaterial({
        ...commonProps,
        metalness: settings.metalness,
        roughness: settings.roughness,
      });
  }
}

/**
 * Apply an appearance style to multiple objects in a scene
 */
export function applyStyleToObjects(
  objects: THREE.Object3D[],
  styleId: string,
  appearanceManager?: AppearanceManager
): number {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const style = manager.getStyle(styleId);

  if (!style) {
    logger.error('AppearanceHelpers', `Style not found: ${styleId}`);
    return 0;
  }

  let count = 0;
  objects.forEach((object) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        style.applyToMesh(child);
        count++;
      }
    });
  });

  logger.info('AppearanceHelpers', `Applied style "${style.name}" to ${count} meshes`);
  return count;
}

/**
 * Apply an appearance style to all meshes with a specific name pattern
 */
export function applyStyleByName(
  scene: THREE.Scene,
  namePattern: string | RegExp,
  styleId: string,
  appearanceManager?: AppearanceManager
): number {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const style = manager.getStyle(styleId);

  if (!style) {
    logger.error('AppearanceHelpers', `Style not found: ${styleId}`);
    return 0;
  }

  const pattern = typeof namePattern === 'string' ? new RegExp(namePattern) : namePattern;
  let count = 0;

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && pattern.test(object.name)) {
      style.applyToMesh(object);
      count++;
    }
  });

  logger.info(
    'AppearanceHelpers',
    `Applied style "${style.name}" to ${count} meshes matching pattern "${namePattern}"`
  );
  return count;
}

/**
 * Apply an appearance style to all meshes with a specific material type
 */
export function applyStyleByMaterialType(
  scene: THREE.Scene,
  materialType: 'standard' | 'basic' | 'phong' | 'lambert',
  styleId: string,
  appearanceManager?: AppearanceManager
): number {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const style = manager.getStyle(styleId);

  if (!style) {
    logger.error('AppearanceHelpers', `Style not found: ${styleId}`);
    return 0;
  }

  let count = 0;
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const material = object.material;
      let matches = false;

      if (Array.isArray(material)) {
        matches = material.some((mat) => matchesMaterialType(mat, materialType));
      } else {
        matches = matchesMaterialType(material, materialType);
      }

      if (matches) {
        style.applyToMesh(object);
        count++;
      }
    }
  });

  logger.info(
    'AppearanceHelpers',
    `Applied style "${style.name}" to ${count} meshes with ${materialType} material`
  );
  return count;
}

/**
 * Helper function to check if a material matches a specific type
 */
function matchesMaterialType(
  material: THREE.Material,
  materialType: 'standard' | 'basic' | 'phong' | 'lambert'
): boolean {
  switch (materialType) {
    case 'standard':
      return material instanceof THREE.MeshStandardMaterial;
    case 'basic':
      return material instanceof THREE.MeshBasicMaterial;
    case 'phong':
      return material instanceof THREE.MeshPhongMaterial;
    case 'lambert':
      return material instanceof THREE.MeshLambertMaterial;
    default:
      return false;
  }
}

/**
 * Collect all unique materials from a scene
 */
export function collectSceneMaterials(scene: THREE.Scene): THREE.Material[] {
  const materials = new Set<THREE.Material>();

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => materials.add(mat));
      } else {
        materials.add(object.material);
      }
    }
  });

  return Array.from(materials);
}

/**
 * Create appearance styles from all materials in a scene
 */
export function createStylesFromScene(
  scene: THREE.Scene,
  idPrefix: string = 'scene-style',
  appearanceManager?: AppearanceManager
): AppearanceStyle[] {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const materials = collectSceneMaterials(scene);
  const styles: AppearanceStyle[] = [];

  materials.forEach((material, index) => {
    const id = `${idPrefix}-${index}`;
    const name = material.name || `Scene Material ${index}`;

    try {
      const style = AppearanceStyle.fromMaterial(material, id, name);
      manager.addStyle(style.toJSON());
      styles.push(style);
    } catch (error) {
      logger.error('AppearanceHelpers', `Error creating style from material: ${name}`, error);
    }
  });

  logger.info('AppearanceHelpers', `Created ${styles.length} styles from scene materials`);
  return styles;
}

/**
 * Save appearance preset to JSON file format
 */
export function saveAppearancePreset(
  styleIds: string[],
  presetName: string,
  appearanceManager?: AppearanceManager
): any {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const styles: any[] = [];

  styleIds.forEach((id) => {
    const style = manager.getStyle(id);
    if (style) {
      styles.push(style.toJSON());
    } else {
      logger.warn('AppearanceHelpers', `Style not found: ${id}`);
    }
  });

  return {
    version: '1.0',
    type: 'appearance-preset',
    name: presetName,
    timestamp: new Date().toISOString(),
    styles,
  };
}

/**
 * Load appearance preset from JSON
 */
export function loadAppearancePreset(
  presetData: any,
  appearanceManager?: AppearanceManager
): AppearanceStyle[] {
  const manager = appearanceManager || AppearanceManager.getInstance();

  if (!presetData.styles || !Array.isArray(presetData.styles)) {
    logger.error('AppearanceHelpers', 'Invalid preset data: missing styles array');
    return [];
  }

  const styles: AppearanceStyle[] = [];

  presetData.styles.forEach((styleData: any) => {
    try {
      const style = AppearanceStyle.fromJSON(styleData);
      manager.addStyle(style.toJSON());
      styles.push(style);
    } catch (error) {
      logger.error('AppearanceHelpers', `Error loading style: ${styleData.name}`, error);
    }
  });

  logger.info('AppearanceHelpers', `Loaded ${styles.length} styles from preset "${presetData.name}"`);
  return styles;
}

/**
 * Batch apply different styles to different object groups
 */
export function batchApplyStyles(
  styleMap: Map<string, THREE.Object3D[]>,
  appearanceManager?: AppearanceManager
): Map<string, number> {
  const manager = appearanceManager || AppearanceManager.getInstance();
  const results = new Map<string, number>();

  styleMap.forEach((objects, styleId) => {
    const count = applyStyleToObjects(objects, styleId, manager);
    results.set(styleId, count);
  });

  const totalCount = Array.from(results.values()).reduce((sum, count) => sum + count, 0);
  logger.info('AppearanceHelpers', `Batch applied ${results.size} styles to ${totalCount} total meshes`);

  return results;
}

/**
 * Interpolate between two appearance styles
 */
export function interpolateStyles(
  styleA: AppearanceStyle,
  styleB: AppearanceStyle,
  t: number,
  id: string,
  name: string
): AppearanceStyle {
  // Clamp t between 0 and 1
  const factor = Math.max(0, Math.min(1, t));

  // Interpolate colors
  const color = new THREE.Color();
  color.copy(styleA.materialSettings.color).lerp(styleB.materialSettings.color, factor);

  // Interpolate line color
  const lineColor = new THREE.Color();
  lineColor.copy(styleA.lineColor).lerp(styleB.lineColor, factor);

  // Interpolate numeric values
  const opacity = styleA.materialSettings.opacity * (1 - factor) + styleB.materialSettings.opacity * factor;
  const metalness = styleA.materialSettings.metalness * (1 - factor) + styleB.materialSettings.metalness * factor;
  const roughness = styleA.materialSettings.roughness * (1 - factor) + styleB.materialSettings.roughness * factor;
  const lineWeight = styleA.lineWeight * (1 - factor) + styleB.lineWeight * factor;

  // Use style A's display mode for t < 0.5, style B's for t >= 0.5
  const displayMode = factor < 0.5 ? styleA.displayMode : styleB.displayMode;

  return new AppearanceStyle({
    id,
    name,
    description: `Interpolated style (${(factor * 100).toFixed(0)}% ${styleB.name})`,
    materialSettings: {
      color,
      opacity,
      metalness,
      roughness,
      transparent: opacity < 1.0,
    },
    lineWeight,
    lineColor,
    displayMode,
    showDimensions: factor < 0.5 ? styleA.showDimensions : styleB.showDimensions,
    showLabels: factor < 0.5 ? styleA.showLabels : styleB.showLabels,
  });
}

/**
 * Get all meshes in a scene that currently use a specific appearance style
 * Note: This compares material properties, not the style ID
 */
export function getMeshesWithStyle(scene: THREE.Scene, style: AppearanceStyle): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material) {
      // Simple comparison based on color
      if (
        object.material instanceof THREE.MeshStandardMaterial ||
        object.material instanceof THREE.MeshBasicMaterial
      ) {
        if (object.material.color.equals(style.materialSettings.color)) {
          meshes.push(object);
        }
      }
    }
  });

  return meshes;
}

/**
 * Create a material preview sphere for a style
 */
export function createStylePreview(
  style: AppearanceStyle,
  size: number = 1.0,
  position?: THREE.Vector3
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(size, 32, 32);
  const material = style.createMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  if (position) {
    mesh.position.copy(position);
  }

  mesh.name = `preview-${style.id}`;
  mesh.castShadow = style.castShadow;
  mesh.receiveShadow = style.receiveShadow;

  return mesh;
}

/**
 * Reset all materials in a scene to default
 */
export function resetSceneMaterials(
  scene: THREE.Scene,
  defaultStyleId: string = 'default',
  appearanceManager?: AppearanceManager
): number {
  const manager = appearanceManager || AppearanceManager.getInstance();
  return manager.applyStyleToScene(scene, defaultStyleId);
}
