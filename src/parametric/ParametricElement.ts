/**
 * ParametricElement - Base class for all parametric BIM elements
 */

import * as THREE from 'three';
import { logger } from '@utils/Logger';
import { Parameter, ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { eventBus, Events } from '@core/EventBus';

export abstract class ParametricElement {
  public readonly id: string;
  public readonly type: string;
  public name: string;

  protected parameters: Map<string, Parameter>;
  protected parameterEngine: ParameterEngine;
  protected geometry: THREE.BufferGeometry | null;
  protected mesh: THREE.Mesh | null;

  protected isUpdating: boolean;
  protected needsUpdate: boolean;

  constructor(type: string, parameterEngine: ParameterEngine) {
    this.id = this.generateId();
    this.type = type;
    this.name = `${type}_${this.id.slice(0, 8)}`;

    this.parameters = new Map();
    this.parameterEngine = parameterEngine;
    this.geometry = null;
    this.mesh = null;

    this.isUpdating = false;
    this.needsUpdate = false;

    logger.debug('ParametricElement', `Created ${this.type}: ${this.name}`);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create and register a parameter
   */
  protected createParameter(
    name: string,
    value: any,
    type: ParameterType,
    unit: ParameterUnit = ParameterUnit.NONE,
    options?: {
      formula?: string;
      isReadOnly?: boolean;
      description?: string;
      group?: string;
    }
  ): Parameter {
    const parameter = new Parameter({
      name,
      value,
      type,
      unit,
      ...options,
    });

    this.parameters.set(name, parameter);
    this.parameterEngine.registerParameter(parameter);

    // If parameter has a formula, set it up (this establishes dependencies)
    if (options?.formula) {
      this.parameterEngine.setFormula(parameter, options.formula);
    }

    // Listen for changes
    this.setupParameterChangeListener(parameter);

    logger.debug(
      'ParametricElement',
      `Created parameter ${name} for ${this.name}: ${value} ${unit}`
    );

    return parameter;
  }

  /**
   * Setup parameter change listener
   */
  private setupParameterChangeListener(parameter: Parameter): void {
    // When a parameter is updated, mark element for update
    const originalUpdateValue = parameter.updateValue.bind(parameter);
    parameter.updateValue = (newValue: any) => {
      originalUpdateValue(newValue);
      this.onParameterChanged(parameter);
    };
  }

  /**
   * Get a parameter by name
   */
  getParameter(name: string): Parameter | undefined {
    return this.parameters.get(name);
  }

  /**
   * Get parameter value
   */
  getParameterValue(name: string): any {
    const param = this.parameters.get(name);
    return param ? param.value : undefined;
  }

  /**
   * Set parameter value
   */
  setParameterValue(name: string, value: any): void {
    const param = this.parameters.get(name);
    if (param) {
      this.parameterEngine.updateParameter(param, value);
    } else {
      logger.warn('ParametricElement', `Parameter not found: ${name} on ${this.name}`);
    }
  }

  /**
   * Set parameter formula
   */
  setParameterFormula(name: string, formula: string): void {
    const param = this.parameters.get(name);
    if (param) {
      this.parameterEngine.setFormula(param, formula);
    } else {
      logger.warn('ParametricElement', `Parameter not found: ${name} on ${this.name}`);
    }
  }

  /**
   * Get all parameters
   */
  getAllParameters(): Parameter[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Called when a parameter changes
   */
  protected onParameterChanged(parameter: Parameter): void {
    logger.debug(
      'ParametricElement',
      `Parameter changed: ${parameter.name} = ${parameter.value} on ${this.name}`
    );

    if (!this.isUpdating) {
      this.needsUpdate = true;
      this.requestUpdate();
    }
  }

  /**
   * Request geometry update (debounced)
   */
  private requestUpdate(): void {
    if (this.isUpdating) {
      return;
    }

    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      if (this.needsUpdate) {
        this.updateGeometry();
      }
    });
  }

  /**
   * Abstract method to generate geometry
   * Must be implemented by subclasses
   */
  protected abstract generateGeometry(): THREE.BufferGeometry;

  /**
   * Update geometry based on current parameters
   */
  updateGeometry(): void {
    if (this.isUpdating) {
      logger.info('ParametricElement', `====> updateGeometry() BLOCKED (isUpdating=true) for ${this.name}`);
      return;
    }

    logger.info('ParametricElement', `====> updateGeometry() called for ${this.name}`);
    this.isUpdating = true;
    this.needsUpdate = false;

    try {
      logger.debug('ParametricElement', `Updating geometry for ${this.name}`);

      // Dispose old geometry
      if (this.geometry) {
        this.geometry.dispose();
      }

      // Generate new geometry
      this.geometry = this.generateGeometry();

      // Update mesh
      if (this.mesh) {
        // Dispose old geometry to prevent memory leaks
        const oldGeometry = this.mesh.geometry;

        // Assign new geometry
        this.mesh.geometry = this.geometry;

        // Mark geometry attributes for update
        this.mesh.geometry.attributes.position.needsUpdate = true;
        if (this.mesh.geometry.attributes.normal) {
          this.mesh.geometry.attributes.normal.needsUpdate = true;
        }
        if (this.mesh.geometry.index) {
          this.mesh.geometry.index.needsUpdate = true;
        }

        // Recompute bounding volumes for raycasting/culling
        this.mesh.geometry.computeBoundingBox();
        this.mesh.geometry.computeBoundingSphere();

        // Dispose old geometry after assignment
        if (oldGeometry && oldGeometry !== this.geometry) {
          oldGeometry.dispose();
        }

        logger.debug('ParametricElement', `Updated mesh geometry for ${this.name}`);
      } else {
        this.createMesh();
      }

      // Emit update event
      eventBus.emit(Events.PARAMETRIC_ELEMENT_UPDATED, {
        element: this,
      });

      logger.debug('ParametricElement', `Geometry updated for ${this.name}`);
    } catch (error) {
      logger.error('ParametricElement', `Error updating geometry for ${this.name}:`, error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Create Three.js mesh from geometry
   */
  protected createMesh(): void {
    if (!this.geometry) {
      logger.warn('ParametricElement', `No geometry to create mesh for ${this.name}`);
      return;
    }

    // TEMP: Using MeshBasicMaterial for debugging visibility
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Bright green for visibility
      wireframe: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = this.name;
    this.mesh.userData.parametricElementId = this.id;
    this.mesh.userData.parametricElementType = this.type;

    logger.debug('ParametricElement', `Created mesh for ${this.name}`);
  }

  /**
   * Get the Three.js mesh
   */
  getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  /**
   * Get the geometry
   */
  getGeometry(): THREE.BufferGeometry | null {
    return this.geometry;
  }

  /**
   * Convert to BIM format (future implementation)
   * This will integrate with the Fragments system for BIM export
   */
  toBIM(): any {
    if (!this.geometry) {
      logger.warn('ParametricElement', `No geometry to convert for ${this.name}`);
      return null;
    }

    // Future: integrate with Fragments system for BIM export
    logger.warn('ParametricElement', 'BIM conversion not yet implemented');
    return null;
  }

  /**
   * Clone this element
   */
  clone(): ParametricElement {
    // Will be implemented by subclasses
    throw new Error('Clone method must be implemented by subclass');
  }

  /**
   * Export to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      parameters: Array.from(this.parameters.values()).map((p) => p.toJSON()),
    };
  }

  /**
   * Dispose element and cleanup resources
   */
  dispose(): void {
    // Dispose geometry
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    // Dispose mesh
    if (this.mesh) {
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach((mat) => mat.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
      this.mesh = null;
    }

    // Unregister parameters
    this.parameters.forEach((param) => {
      this.parameterEngine.unregisterParameter(param);
    });
    this.parameters.clear();

    logger.debug('ParametricElement', `Disposed ${this.name}`);
  }
}
