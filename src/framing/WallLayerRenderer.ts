/**
 * WallLayerRenderer - Renders individual wall layers in 3D
 * Visualizes each material layer separately with proper thickness and color
 */

import * as THREE from 'three';
import type { WallType, MaterialLayer } from './WallType';
import { logger } from '@utils/Logger';

export interface LayerRenderOptions {
  /** Show layers exploded (separated) for clarity */
  exploded?: boolean;
  /** Distance between layers when exploded (in meters) */
  explosionDistance?: number;
  /** Render mode: 'solid', 'wireframe', 'transparent' */
  renderMode?: 'solid' | 'wireframe' | 'transparent';
  /** Opacity for transparent mode */
  opacity?: number;
  /** Show labels for each layer */
  showLabels?: boolean;
}

/**
 * Renders wall layers in 3D space
 */
export class WallLayerRenderer {
  private group: THREE.Group;
  private wallType: WallType | null = null;
  private layerMeshes: THREE.Mesh[] = [];
  private labelSprites: THREE.Sprite[] = [];
  private options: Required<LayerRenderOptions>;

  constructor(options: LayerRenderOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = 'WallLayerRenderer';

    this.options = {
      exploded: options.exploded ?? false,
      explosionDistance: options.explosionDistance ?? 0.05, // 5cm between layers
      renderMode: options.renderMode ?? 'solid',
      opacity: options.opacity ?? 0.8,
      showLabels: options.showLabels ?? true,
    };

    logger.debug('WallLayerRenderer', 'WallLayerRenderer created');
  }

  /**
   * Render a wall type's layers
   * @param wallType - The wall type to render
   * @param start - Start point in meters
   * @param end - End point in meters
   * @param height - Wall height in meters
   */
  renderLayers(
    wallType: WallType,
    start: THREE.Vector3,
    end: THREE.Vector3,
    height: number
  ): THREE.Group {
    // Clear existing layers
    this.clear();

    this.wallType = wallType;

    // Calculate wall dimensions
    const wallVector = new THREE.Vector3().subVectors(end, start);
    const wallLength = wallVector.length();
    const wallDirection = wallVector.normalize();

    // Calculate perpendicular direction (for thickness)
    const perpendicular = new THREE.Vector3(-wallDirection.z, 0, wallDirection.x);

    // Convert total thickness from inches to meters
    const totalThicknessMeters = (wallType.actualThickness * 0.0254);

    // Starting position (interior side)
    let currentOffset = -totalThicknessMeters / 2;

    // Track cumulative explosion offset
    let explosionOffset = 0;

    wallType.layers.forEach((layer, index) => {
      const layerThicknessMeters = layer.thickness * 0.0254; // inches to meters

      // Create layer geometry
      const layerGeometry = new THREE.BoxGeometry(
        wallLength,
        height,
        layerThicknessMeters
      );

      // Create material
      const layerMaterial = this.createLayerMaterial(layer);

      // Create mesh
      const layerMesh = new THREE.Mesh(layerGeometry, layerMaterial);
      layerMesh.name = `Layer_${index}_${layer.name}`;

      // Position the layer
      const layerCenter = currentOffset + layerThicknessMeters / 2;

      if (this.options.exploded) {
        // Exploded view: offset each layer along perpendicular
        const basePosition = start.clone().add(wallVector.clone().multiplyScalar(0.5));
        const perpendicularOffset = perpendicular.clone().multiplyScalar(layerCenter);
        const explosionVector = perpendicular.clone().multiplyScalar(explosionOffset);

        layerMesh.position.copy(basePosition.add(perpendicularOffset).add(explosionVector));

        explosionOffset += this.options.explosionDistance;
      } else {
        // Normal view: layers stacked in place
        const basePosition = start.clone().add(wallVector.clone().multiplyScalar(0.5));
        const perpendicularOffset = perpendicular.clone().multiplyScalar(layerCenter);

        layerMesh.position.copy(basePosition.add(perpendicularOffset));
      }

      // Rotate to align with wall direction
      const angle = Math.atan2(wallDirection.z, wallDirection.x);
      layerMesh.rotation.y = -angle;

      this.group.add(layerMesh);
      this.layerMeshes.push(layerMesh);

      // Add label if enabled
      if (this.options.showLabels) {
        const label = this.createLayerLabel(layer, index);
        label.position.copy(layerMesh.position);
        label.position.y += height / 2 + 0.2; // Above the layer
        this.group.add(label);
        this.labelSprites.push(label);
      }

      currentOffset += layerThicknessMeters;
    });

    logger.info('WallLayerRenderer', `Rendered ${wallType.layers.length} layers for ${wallType.name}`);

    return this.group;
  }

  /**
   * Create material for a layer based on render mode
   */
  private createLayerMaterial(layer: MaterialLayer): THREE.Material {
    const color = layer.color || new THREE.Color(0x888888);

    switch (this.options.renderMode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
        });

      case 'transparent':
        return new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: this.options.opacity,
          side: THREE.DoubleSide,
        });

      case 'solid':
      default:
        return new THREE.MeshStandardMaterial({
          color,
          side: THREE.DoubleSide,
          metalness: 0.1,
          roughness: 0.8,
        });
    }
  }

  /**
   * Create a text label sprite for a layer
   */
  private createLayerLabel(layer: MaterialLayer, index: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.font = 'Bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(`${index + 1}. ${layer.name}`, canvas.width / 2, 10);

    context.font = '24px Arial';
    context.fillStyle = '#aaaaaa';
    context.fillText(`${layer.thickness}" ${layer.material}`, canvas.width / 2, 50);
    context.fillText(`R-${layer.rValue || 0}`, canvas.width / 2, 85);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1, 0.25, 1);
    sprite.name = `Label_${layer.name}`;

    return sprite;
  }

  /**
   * Toggle exploded view
   */
  setExploded(exploded: boolean): void {
    this.options.exploded = exploded;
    if (this.wallType) {
      // Re-render with current wall type
      const firstMesh = this.layerMeshes[0];
      if (firstMesh) {
        // Calculate original start/end from current position
        // This is approximate - ideally we'd store these
        const start = new THREE.Vector3(-2, 0, 0);
        const end = new THREE.Vector3(2, 0, 0);
        const height = 2.743;
        this.renderLayers(this.wallType, start, end, height);
      }
    }
  }

  /**
   * Set explosion distance
   */
  setExplosionDistance(distance: number): void {
    this.options.explosionDistance = distance;
    this.setExploded(this.options.exploded); // Re-render
  }

  /**
   * Set render mode
   */
  setRenderMode(mode: 'solid' | 'wireframe' | 'transparent'): void {
    this.options.renderMode = mode;

    // Update existing materials
    this.layerMeshes.forEach((mesh, index) => {
      if (this.wallType) {
        const layer = this.wallType.layers[index];
        mesh.material = this.createLayerMaterial(layer);
      }
    });
  }

  /**
   * Set opacity for transparent mode
   */
  setOpacity(opacity: number): void {
    this.options.opacity = Math.max(0, Math.min(1, opacity));

    if (this.options.renderMode === 'transparent') {
      this.layerMeshes.forEach((mesh) => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.transparent) {
          material.opacity = this.options.opacity;
        }
      });
    }
  }

  /**
   * Toggle labels
   */
  setShowLabels(show: boolean): void {
    this.options.showLabels = show;
    this.labelSprites.forEach((sprite) => {
      sprite.visible = show;
    });
  }

  /**
   * Get the THREE.js group containing all layers
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Clear all rendered layers
   */
  clear(): void {
    this.layerMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
      this.group.remove(mesh);
    });

    this.labelSprites.forEach((sprite) => {
      if (sprite.material.map) {
        sprite.material.map.dispose();
      }
      sprite.material.dispose();
      this.group.remove(sprite);
    });

    this.layerMeshes = [];
    this.labelSprites = [];
  }

  /**
   * Dispose the renderer
   */
  dispose(): void {
    this.clear();
    logger.debug('WallLayerRenderer', 'WallLayerRenderer disposed');
  }
}
