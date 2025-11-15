/**
 * Highlighter - Visual feedback for object selection and hover
 */

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface HighlighterConfig {
  hoverColor?: THREE.Color;
  selectColor?: THREE.Color;
  multiSelectColor?: THREE.Color;
  outlineThickness?: number;
}

export class Highlighter {
  private config: HighlighterConfig;

  // Currently highlighted objects
  private hoveredObjects: Set<THREE.Object3D> = new Set();
  private selectedObjects: Set<THREE.Object3D> = new Set();

  // IFC selection tracking (model -> Set of expressIDs)
  public selection: {
    selected: Map<any, Set<number>>;
  } = {
    selected: new Map(),
  };

  // Outline materials for highlighting
  private hoverOutline: THREE.LineBasicMaterial;
  private selectOutline: THREE.LineBasicMaterial;
  private multiSelectOutline: THREE.LineBasicMaterial;

  // Store original materials for restoration
  private originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();

  // Store original emissive properties to avoid material cloning
  private originalEmissive: Map<THREE.Object3D, { color: THREE.Color; intensity: number }> = new Map();

  constructor(_components: OBC.Components, _world: OBC.SimpleWorld, config: HighlighterConfig = {}) {
    // Components and world params kept for future use (e.g., Fragments highlighting)
    // Prefixed with _ to indicate intentionally unused
    this.config = {
      hoverColor: new THREE.Color(0x6366f1),
      selectColor: new THREE.Color(0x10b981),
      multiSelectColor: new THREE.Color(0xf59e0b),
      outlineThickness: 2,
      ...config,
    };

    // Create outline materials
    this.hoverOutline = new THREE.LineBasicMaterial({
      color: this.config.hoverColor,
      linewidth: this.config.outlineThickness,
    });

    this.selectOutline = new THREE.LineBasicMaterial({
      color: this.config.selectColor,
      linewidth: this.config.outlineThickness,
    });

    this.multiSelectOutline = new THREE.LineBasicMaterial({
      color: this.config.multiSelectColor,
      linewidth: this.config.outlineThickness,
    });

    logger.debug('Highlighter', 'Highlighter created');
  }

  /**
   * Highlight object on hover
   */
  highlightHover(object: THREE.Object3D | null): void {
    // Clear previous hover highlights
    this.clearHover();

    if (!object) return;

    // Add to hovered set
    this.hoveredObjects.add(object);

    // Apply hover effect
    this.applyHoverEffect(object);

    logger.debug('Highlighter', `Hover: ${object.uuid}`);
    eventBus.emit(Events.OBJECT_HOVERED, { object });
  }

  /**
   * Clear hover highlight
   */
  clearHover(): void {
    this.hoveredObjects.forEach((obj) => {
      this.removeHoverEffect(obj);
    });
    this.hoveredObjects.clear();
  }

  /**
   * Select object
   * If object is not provided but model and expressID are, will attempt to find the object
   */
  select(object: THREE.Object3D | null, model?: any, expressID?: number, source: string = 'viewport'): void {
    // If no object provided, try to find it using model and expressID
    if (!object && model && expressID !== undefined) {
      // For IFC elements, we track selection by model + expressID
      // The visual highlight will be applied when the fragment is rendered
      if (!this.selection.selected.has(model)) {
        this.selection.selected.set(model, new Set());
      }
      this.selection.selected.get(model)!.add(expressID);

      logger.info('Highlighter', `Selected IFC element: expressID=${expressID}`);

      // Emit with IFC data
      const eventData: any = { model, expressID, source };
      eventBus.emit(Events.OBJECT_SELECTED, eventData);
      return;
    }

    if (!object) return;
    if (this.selectedObjects.has(object)) return;

    this.selectedObjects.add(object);

    // Check if this is a multi-select (more than one object already selected)
    const isMultiSelect = this.selectedObjects.size > 1;
    this.applySelectEffect(object, isMultiSelect);

    // Update visual effects for all previously selected objects
    if (isMultiSelect) {
      this.updateMultiSelectVisuals();
    }

    // Track IFC selection
    if (model && expressID !== undefined) {
      if (!this.selection.selected.has(model)) {
        this.selection.selected.set(model, new Set());
      }
      this.selection.selected.get(model)!.add(expressID);
    }

    logger.info('Highlighter', `Selected: ${object.uuid}`);

    // Emit with IFC data if available
    const eventData: any = { object, source };
    if (model) eventData.model = model;
    if (expressID !== undefined) eventData.expressID = expressID;

    eventBus.emit(Events.OBJECT_SELECTED, eventData);
  }

  /**
   * Deselect object
   */
  deselect(object: THREE.Object3D): void {
    if (!this.selectedObjects.has(object)) return;

    this.selectedObjects.delete(object);
    this.removeSelectEffect(object);

    logger.info('Highlighter', `Deselected: ${object.uuid}`);
    eventBus.emit(Events.OBJECT_DESELECTED, { object });
  }

  /**
   * Toggle selection
   */
  toggleSelect(object: THREE.Object3D, model?: any, expressID?: number, source: string = 'viewport'): void {
    if (this.selectedObjects.has(object)) {
      this.deselect(object);
    } else {
      this.select(object, model, expressID, source);
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedObjects.forEach((obj) => {
      this.removeSelectEffect(obj);
    });
    this.selectedObjects.clear();
    this.selection.selected.clear();
    eventBus.emit(Events.SELECTION_CLEARED, { source: 'viewport' });
  }

  /**
   * Get selected objects
   */
  getSelected(): THREE.Object3D[] {
    return Array.from(this.selectedObjects);
  }

  /**
   * Check if object is selected
   */
  isSelected(object: THREE.Object3D): boolean {
    return this.selectedObjects.has(object);
  }

  /**
   * Apply hover visual effect
   * Optimized to modify emissive properties directly instead of cloning material
   */
  private applyHoverEffect(object: THREE.Object3D): void {
    if (!(object instanceof THREE.Mesh)) return;

    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      // Store original emissive properties
      if (!this.originalEmissive.has(object)) {
        this.originalEmissive.set(object, {
          color: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        });
      }

      // Modify emissive properties directly (no cloning!)
      material.emissive.copy(this.config.hoverColor!);
      material.emissiveIntensity = 0.3;
      material.needsUpdate = true;
    }
  }

  /**
   * Remove hover visual effect
   */
  private removeHoverEffect(object: THREE.Object3D): void {
    if (!(object instanceof THREE.Mesh)) return;

    // Don't restore if object is selected (keep selection highlight)
    if (this.selectedObjects.has(object)) return;

    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      const original = this.originalEmissive.get(object);
      if (original) {
        // Restore original emissive properties
        material.emissive.copy(original.color);
        material.emissiveIntensity = original.intensity;
        material.needsUpdate = true;
        this.originalEmissive.delete(object);
      }
    }
  }

  /**
   * Apply selection visual effect
   * Optimized to modify emissive properties directly instead of cloning material
   */
  private applySelectEffect(object: THREE.Object3D, isMultiSelect: boolean = false): void {
    if (!(object instanceof THREE.Mesh)) return;

    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      // Store original emissive properties
      if (!this.originalEmissive.has(object)) {
        this.originalEmissive.set(object, {
          color: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        });
      }

      // Use different color for multi-selection
      const color = isMultiSelect ? this.config.multiSelectColor! : this.config.selectColor!;
      const intensity = isMultiSelect ? 0.4 : 0.5;

      // Modify emissive properties directly (no cloning!)
      material.emissive.copy(color);
      material.emissiveIntensity = intensity;
      material.needsUpdate = true;
    }
  }

  /**
   * Remove selection visual effect
   */
  private removeSelectEffect(object: THREE.Object3D): void {
    if (!(object instanceof THREE.Mesh)) return;

    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      const original = this.originalEmissive.get(object);
      if (original) {
        // Restore original emissive properties
        material.emissive.copy(original.color);
        material.emissiveIntensity = original.intensity;
        material.needsUpdate = true;
        this.originalEmissive.delete(object);
      }
    }
  }

  /**
   * Update multi-select visual effects for all selected objects
   */
  private updateMultiSelectVisuals(): void {
    const isMultiSelect = this.selectedObjects.size > 1;

    this.selectedObjects.forEach((obj) => {
      // Remove current effect and reapply with correct color
      this.removeSelectEffect(obj);
      this.applySelectEffect(obj, isMultiSelect);
    });
  }

  /**
   * Select multiple objects at once
   */
  selectMultiple(objects: THREE.Object3D[], models?: any[], expressIDs?: number[]): void {
    objects.forEach((obj, index) => {
      const model = models?.[index];
      const expressID = expressIDs?.[index];

      if (!this.selectedObjects.has(obj)) {
        this.selectedObjects.add(obj);

        // Track IFC selection
        if (model && expressID !== undefined) {
          if (!this.selection.selected.has(model)) {
            this.selection.selected.set(model, new Set());
          }
          this.selection.selected.get(model)!.add(expressID);
        }
      }
    });

    // Apply multi-select visual effect to all
    this.updateMultiSelectVisuals();

    logger.info('Highlighter', `Selected ${objects.length} objects`);
  }

  /**
   * Update highlighter colors
   */
  setHoverColor(color: THREE.Color): void {
    this.config.hoverColor = color;
    this.hoverOutline.color = color;
  }

  setSelectColor(color: THREE.Color): void {
    this.config.selectColor = color;
    this.selectOutline.color = color;
  }

  setMultiSelectColor(color: THREE.Color): void {
    this.config.multiSelectColor = color;
    this.multiSelectOutline.color = color;
  }

  /**
   * Dispose highlighter
   */
  dispose(): void {
    this.clearHover();
    this.clearSelection();
    this.hoverOutline.dispose();
    this.selectOutline.dispose();
    this.multiSelectOutline.dispose();
    this.originalMaterials.clear();
    this.originalEmissive.clear();

    logger.debug('Highlighter', 'Highlighter disposed');
  }
}
