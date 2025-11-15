/**
 * AppearanceManager - Manages library of appearance styles for visual rendering
 * Provides pre-configured appearance styles for different presentation modes
 */

import * as THREE from 'three';
import { AppearanceStyle, AppearanceStyleConfig, DisplayMode } from './AppearanceStyle';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

/**
 * Singleton manager for appearance style library
 */
export class AppearanceManager {
  private static instance: AppearanceManager | null = null;
  private styles: Map<string, AppearanceStyle> = new Map();
  private defaultStyleId: string = 'default';

  private constructor() {
    this.initializeStandardStyles();
    logger.info('AppearanceManager', 'AppearanceManager initialized with standard styles');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AppearanceManager {
    if (!AppearanceManager.instance) {
      AppearanceManager.instance = new AppearanceManager();
    }
    return AppearanceManager.instance;
  }

  /**
   * Initialize standard appearance styles
   */
  private initializeStandardStyles(): void {
    // Default - Standard 3D view with basic shading
    this.addStyle({
      id: 'default',
      name: 'Default',
      description: 'Standard 3D view with basic material shading',
      materialSettings: {
        color: new THREE.Color(0xcccccc),
        opacity: 1.0,
        metalness: 0.1,
        roughness: 0.7,
        transparent: false,
        flatShading: false,
        side: THREE.DoubleSide,
      },
      lineWeight: 1.0,
      lineColor: new THREE.Color(0x000000),
      displayMode: DisplayMode.SOLID,
      showDimensions: true,
      showLabels: true,
      castShadow: true,
      receiveShadow: true,
      depthTest: true,
      depthWrite: true,
    });

    // Construction - Construction document style with thick lines
    this.addStyle({
      id: 'construction',
      name: 'Construction',
      description: 'Construction document style with thick lines, no textures, flat shading',
      materialSettings: {
        color: new THREE.Color(0xe0e0e0),
        opacity: 1.0,
        metalness: 0.0,
        roughness: 1.0,
        transparent: false,
        flatShading: true,
        side: THREE.DoubleSide,
      },
      lineWeight: 2.5,
      lineColor: new THREE.Color(0x000000),
      displayMode: DisplayMode.SOLID,
      showDimensions: true,
      showLabels: true,
      castShadow: false,
      receiveShadow: false,
      depthTest: true,
      depthWrite: true,
    });

    // Presentation - Realistic materials with shadows
    this.addStyle({
      id: 'presentation',
      name: 'Presentation',
      description: 'Realistic materials with shadows and smooth shading for presentations',
      materialSettings: {
        color: new THREE.Color(0xffffff),
        opacity: 1.0,
        metalness: 0.3,
        roughness: 0.4,
        transparent: false,
        flatShading: false,
        side: THREE.DoubleSide,
      },
      lineWeight: 0.5,
      lineColor: new THREE.Color(0x333333),
      displayMode: DisplayMode.REALISTIC,
      showDimensions: false,
      showLabels: false,
      castShadow: true,
      receiveShadow: true,
      depthTest: true,
      depthWrite: true,
    });

    // Schematic - Simple colors, thin lines
    this.addStyle({
      id: 'schematic',
      name: 'Schematic',
      description: 'Simple colors with thin lines for schematic diagrams',
      materialSettings: {
        color: new THREE.Color(0xaaaaaa),
        opacity: 1.0,
        metalness: 0.0,
        roughness: 1.0,
        transparent: false,
        flatShading: true,
        side: THREE.DoubleSide,
      },
      lineWeight: 0.75,
      lineColor: new THREE.Color(0x000000),
      displayMode: DisplayMode.SOLID,
      showDimensions: true,
      showLabels: true,
      castShadow: false,
      receiveShadow: false,
      depthTest: true,
      depthWrite: true,
    });

    // Hidden Line - Architectural hidden line rendering
    this.addStyle({
      id: 'hidden-line',
      name: 'Hidden Line',
      description: 'Architectural hidden line rendering with white faces and black edges',
      materialSettings: {
        color: new THREE.Color(0xffffff),
        opacity: 1.0,
        metalness: 0.0,
        roughness: 1.0,
        transparent: false,
        flatShading: false,
        side: THREE.DoubleSide,
      },
      lineWeight: 1.5,
      lineColor: new THREE.Color(0x000000),
      displayMode: DisplayMode.HIDDEN_LINE,
      showDimensions: false,
      showLabels: false,
      castShadow: false,
      receiveShadow: false,
      depthTest: true,
      depthWrite: true,
    });

    // Wireframe - Pure wireframe mode
    this.addStyle({
      id: 'wireframe',
      name: 'Wireframe',
      description: 'Wireframe display mode showing only edges',
      materialSettings: {
        color: new THREE.Color(0x00ff00),
        opacity: 1.0,
        metalness: 0.0,
        roughness: 1.0,
        wireframe: true,
        transparent: false,
        side: THREE.DoubleSide,
      },
      lineWeight: 1.0,
      lineColor: new THREE.Color(0x00ff00),
      displayMode: DisplayMode.WIREFRAME,
      showDimensions: false,
      showLabels: false,
      castShadow: false,
      receiveShadow: false,
      depthTest: true,
      depthWrite: true,
    });

    // X-Ray - Semi-transparent view for seeing through objects
    this.addStyle({
      id: 'xray',
      name: 'X-Ray',
      description: 'Semi-transparent view for seeing through objects',
      materialSettings: {
        color: new THREE.Color(0x88ccff),
        opacity: 0.3,
        metalness: 0.0,
        roughness: 0.8,
        transparent: true,
        flatShading: false,
        side: THREE.DoubleSide,
      },
      lineWeight: 0.5,
      lineColor: new THREE.Color(0x0066cc),
      displayMode: DisplayMode.SOLID,
      showDimensions: false,
      showLabels: false,
      castShadow: false,
      receiveShadow: false,
      depthTest: true,
      depthWrite: false, // Allow seeing through
    });

    logger.info('AppearanceManager', `Loaded ${this.styles.size} standard appearance styles`);
  }

  /**
   * Add an appearance style to the library
   */
  addStyle(config: AppearanceStyleConfig): AppearanceStyle {
    const style = new AppearanceStyle(config);
    this.styles.set(style.id, style);

    eventBus.emit(Events.APPEARANCE_STYLE_ADDED, { style });
    logger.debug('AppearanceManager', `Added appearance style: ${style.name}`);

    return style;
  }

  /**
   * Get an appearance style by ID
   */
  getStyle(id: string): AppearanceStyle | undefined {
    return this.styles.get(id);
  }

  /**
   * Get all appearance styles
   */
  getAllStyles(): AppearanceStyle[] {
    return Array.from(this.styles.values());
  }

  /**
   * Get styles filtered by display mode
   */
  getStylesByDisplayMode(displayMode: DisplayMode): AppearanceStyle[] {
    return this.getAllStyles().filter((style) => style.displayMode === displayMode);
  }

  /**
   * Get default appearance style
   */
  getDefaultStyle(): AppearanceStyle {
    const style = this.styles.get(this.defaultStyleId);
    if (!style) {
      throw new Error(`Default appearance style not found: ${this.defaultStyleId}`);
    }
    return style;
  }

  /**
   * Set default appearance style
   */
  setDefaultStyle(id: string): void {
    if (!this.styles.has(id)) {
      throw new Error(`Appearance style not found: ${id}`);
    }
    this.defaultStyleId = id;
    logger.info('AppearanceManager', `Default appearance style set to: ${id}`);
  }

  /**
   * Remove an appearance style
   */
  removeStyle(id: string): boolean {
    if (id === this.defaultStyleId) {
      logger.warn('AppearanceManager', 'Cannot remove default appearance style');
      return false;
    }

    const style = this.styles.get(id);
    if (style) {
      this.styles.delete(id);
      eventBus.emit(Events.APPEARANCE_STYLE_REMOVED, { style });
      logger.info('AppearanceManager', `Removed appearance style: ${style.name}`);
      return true;
    }
    return false;
  }

  /**
   * Apply style to a single mesh
   */
  applyStyleToMesh(mesh: THREE.Mesh, styleId: string): boolean {
    const style = this.styles.get(styleId);
    if (!style) {
      logger.error('AppearanceManager', `Style not found: ${styleId}`);
      return false;
    }

    style.applyToMesh(mesh);
    eventBus.emit(Events.APPEARANCE_STYLE_APPLIED, { mesh, style });
    return true;
  }

  /**
   * Apply style to multiple meshes
   */
  applyStyleToMeshes(meshes: THREE.Mesh[], styleId: string): number {
    const style = this.styles.get(styleId);
    if (!style) {
      logger.error('AppearanceManager', `Style not found: ${styleId}`);
      return 0;
    }

    let count = 0;
    meshes.forEach((mesh) => {
      try {
        style.applyToMesh(mesh);
        count++;
      } catch (error) {
        logger.error('AppearanceManager', `Error applying style to mesh`, error);
      }
    });

    if (count > 0) {
      eventBus.emit(Events.APPEARANCE_STYLE_APPLIED, { meshes, style, count });
      logger.info('AppearanceManager', `Applied style "${style.name}" to ${count} meshes`);
    }

    return count;
  }

  /**
   * Apply style to an entire scene or object3D hierarchy
   */
  applyStyleToScene(sceneOrObject: THREE.Object3D, styleId: string): number {
    const style = this.styles.get(styleId);
    if (!style) {
      logger.error('AppearanceManager', `Style not found: ${styleId}`);
      return 0;
    }

    let count = 0;
    sceneOrObject.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        try {
          style.applyToMesh(object);
          count++;
        } catch (error) {
          logger.error('AppearanceManager', `Error applying style to mesh in scene`, error);
        }
      }
    });

    if (count > 0) {
      eventBus.emit(Events.APPEARANCE_STYLE_APPLIED, { scene: sceneOrObject, style, count });
      logger.info('AppearanceManager', `Applied style "${style.name}" to ${count} meshes in scene`);
    }

    return count;
  }

  /**
   * Clone an appearance style with modifications
   */
  cloneStyle(sourceId: string, newId: string, overrides: Partial<AppearanceStyleConfig> = {}): AppearanceStyle | null {
    const sourceStyle = this.styles.get(sourceId);
    if (!sourceStyle) {
      logger.error('AppearanceManager', `Source appearance style not found: ${sourceId}`);
      return null;
    }

    const clonedStyle = sourceStyle.clone({
      id: newId,
      ...overrides,
    });

    this.styles.set(clonedStyle.id, clonedStyle);
    eventBus.emit(Events.APPEARANCE_STYLE_ADDED, { style: clonedStyle });
    logger.info('AppearanceManager', `Cloned appearance style: ${sourceId} -> ${newId}`);

    return clonedStyle;
  }

  /**
   * Export appearance style library to JSON
   */
  exportLibrary(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      defaultStyleId: this.defaultStyleId,
      styles: Array.from(this.styles.values()).map((style) => style.toJSON()),
    };
  }

  /**
   * Import appearance style library from JSON
   */
  importLibrary(data: any, replaceExisting: boolean = false): void {
    if (!data.styles || !Array.isArray(data.styles)) {
      logger.error('AppearanceManager', 'Invalid appearance style library data');
      return;
    }

    if (replaceExisting) {
      this.styles.clear();
    }

    data.styles.forEach((styleData: any) => {
      const style = AppearanceStyle.fromJSON(styleData);
      this.styles.set(style.id, style);
    });

    if (data.defaultStyleId && this.styles.has(data.defaultStyleId)) {
      this.defaultStyleId = data.defaultStyleId;
    }

    logger.info('AppearanceManager', `Imported ${data.styles.length} appearance styles`);
  }

  /**
   * Export a single style to JSON
   */
  exportStyle(styleId: string): any | null {
    const style = this.styles.get(styleId);
    if (!style) {
      logger.error('AppearanceManager', `Style not found: ${styleId}`);
      return null;
    }

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      style: style.toJSON(),
    };
  }

  /**
   * Import a single style from JSON
   */
  importStyle(data: any): AppearanceStyle | null {
    if (!data.style) {
      logger.error('AppearanceManager', 'Invalid appearance style data');
      return null;
    }

    const style = AppearanceStyle.fromJSON(data.style);
    this.styles.set(style.id, style);

    eventBus.emit(Events.APPEARANCE_STYLE_ADDED, { style });
    logger.info('AppearanceManager', `Imported appearance style: ${style.name}`);

    return style;
  }

  /**
   * Search styles by name or description
   */
  searchStyles(query: string): AppearanceStyle[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllStyles().filter(
      (style) =>
        style.name.toLowerCase().includes(lowerQuery) ||
        style.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get appearance style statistics
   */
  getStatistics(): {
    totalStyles: number;
    byDisplayMode: Map<DisplayMode, number>;
    withShadows: number;
    transparent: number;
  } {
    const stats = {
      totalStyles: this.styles.size,
      byDisplayMode: new Map<DisplayMode, number>(),
      withShadows: 0,
      transparent: 0,
    };

    this.getAllStyles().forEach((style) => {
      // Count by display mode
      const mode = style.displayMode;
      stats.byDisplayMode.set(mode, (stats.byDisplayMode.get(mode) || 0) + 1);

      // Count shadows
      if (style.castShadow || style.receiveShadow) {
        stats.withShadows++;
      }

      // Count transparent
      if (style.materialSettings.transparent || style.materialSettings.opacity < 1.0) {
        stats.transparent++;
      }
    });

    return stats;
  }

  /**
   * Reset to default appearance styles only
   */
  reset(): void {
    this.styles.clear();
    this.initializeStandardStyles();
    this.defaultStyleId = 'default';
    logger.info('AppearanceManager', 'Reset to default appearance styles');
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.styles.clear();
    logger.info('AppearanceManager', 'AppearanceManager disposed');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    if (AppearanceManager.instance) {
      AppearanceManager.instance.dispose();
      AppearanceManager.instance = null;
    }
  }
}

// Export convenience function
export const getAppearanceManager = (): AppearanceManager => {
  return AppearanceManager.getInstance();
};
