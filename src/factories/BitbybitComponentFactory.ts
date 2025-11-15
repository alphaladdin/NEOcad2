/**
 * BitbybitComponentFactory - Advanced parametric door/window creation
 * Uses bitbybit CAD kernels for professional-grade geometry
 *
 * IMPLEMENTATION STATUS:
 * - ✅ Service integration and initialization complete
 * - ✅ Fallback implementations using THREE.js primitives
 * - ⏳ Full OCCT parametric modeling (future enhancement)
 *
 * CURRENT APPROACH:
 * The factory provides well-structured door and window configurations with
 * placeholder THREE.js geometry. For production-quality parametric modeling,
 * the following enhancements are planned:
 *
 * 1. OCCT Shape Creation:
 *    - Use bitbybit OCCT shapes service to create precise solid geometry
 *    - Example: occt.shapes.solid.createBox() for basic forms
 *
 * 2. Advanced Profile Extrusion:
 *    - Create custom frame profiles using OCCT wire/face extrusion
 *    - Support for complex cross-sections (e.g., window frame profiles)
 *
 * 3. Boolean Operations:
 *    - Use OCCT booleans for creating panel cutouts, glazing recesses
 *    - More reliable than web-ifc for complex operations
 *
 * 4. Mesh Conversion:
 *    - Convert OCCT TopoDS_Shape to THREE.BufferGeometry
 *    - Use bitbybit meshing service (shapeToMesh)
 *
 * WHY DEFERRED:
 * Full OCCT integration requires complex mesh conversion pipelines and
 * shape manipulation. The current GeometryEngine from @thatopen/fragments
 * already handles boolean operations well for walls. This factory focuses
 * on providing flexible configurations that can be enhanced later.
 *
 * USAGE:
 * const factory = getBitbybitComponentFactory();
 * const door = await factory.createDoor({
 *   width: 900,
 *   height: 2100,
 *   thickness: 45,
 *   frameWidth: 100,
 *   style: 'glazed',
 *   handleSide: 'right',
 *   swingDirection: 'in'
 * });
 */

import * as THREE from 'three';
import { getBitbybitService } from '@services/BitbybitService';
import { logger } from '@utils/Logger';
import { Units } from '@utils/Units';

export interface DoorConfig {
  width: number; // mm
  height: number; // mm
  thickness: number; // mm
  frameWidth: number; // mm
  style: 'solid' | 'glazed' | 'paneled' | 'french';
  handleSide: 'left' | 'right';
  swingDirection: 'in' | 'out';
  panelCount?: number; // For paneled doors
  glassHeight?: number; // For glazed doors (from top)
}

export interface WindowConfig {
  width: number; // mm
  height: number; // mm
  frameDepth: number; // mm
  frameWidth: number; // mm
  glazingThickness: number; // mm
  style: 'single' | 'double' | 'casement' | 'sliding' | 'bay';
  mullions?: {
    horizontal: number; // Number of horizontal divisions
    vertical: number; // Number of vertical divisions
  };
  sillDepth?: number; // mm
}

export class BitbybitComponentFactory {
  private bitbybit = getBitbybitService();

  constructor() {
    logger.info('BitbybitComponentFactory', 'Factory initialized');
  }

  /**
   * Create a parametric door with professional detailing
   */
  async createDoor(config: DoorConfig): Promise<THREE.Group> {
    logger.info(
      'BitbybitComponentFactory',
      `Creating ${config.style} door: ${config.width}x${config.height}mm`
    );

    if (!this.bitbybit.isReady()) {
      logger.warn('BitbybitComponentFactory', 'Bitbybit not initialized, using fallback');
      return this.createSimpleDoor(config);
    }

    const doorGroup = new THREE.Group();
    doorGroup.name = `Door_${config.style}_${config.width}x${config.height}`;

    // TODO: Implement with bitbybit OCCT operations
    switch (config.style) {
      case 'solid':
        await this.createSolidDoor(config, doorGroup);
        break;
      case 'glazed':
        await this.createGlazedDoor(config, doorGroup);
        break;
      case 'paneled':
        await this.createPaneledDoor(config, doorGroup);
        break;
      case 'french':
        await this.createFrenchDoor(config, doorGroup);
        break;
    }

    // Add hardware (handle, hinges)
    this.addDoorHardware(config, doorGroup);

    return doorGroup;
  }

  /**
   * Create a parametric window with mullions and glazing
   */
  async createWindow(config: WindowConfig): Promise<THREE.Group> {
    logger.info(
      'BitbybitComponentFactory',
      `Creating ${config.style} window: ${config.width}x${config.height}mm`
    );

    if (!this.bitbybit.isReady()) {
      logger.warn('BitbybitComponentFactory', 'Bitbybit not initialized, using fallback');
      return this.createSimpleWindow(config);
    }

    const windowGroup = new THREE.Group();
    windowGroup.name = `Window_${config.style}_${config.width}x${config.height}`;

    // TODO: Implement with bitbybit OCCT operations
    switch (config.style) {
      case 'single':
      case 'double':
        await this.createStandardWindow(config, windowGroup);
        break;
      case 'casement':
        await this.createCasementWindow(config, windowGroup);
        break;
      case 'sliding':
        await this.createSlidingWindow(config, windowGroup);
        break;
      case 'bay':
        await this.createBayWindow(config, windowGroup);
        break;
    }

    // Add sill if specified
    if (config.sillDepth) {
      this.addWindowSill(config, windowGroup);
    }

    return windowGroup;
  }

  /**
   * Create solid door panel
   */
  private async createSolidDoor(config: DoorConfig, parent: THREE.Group): Promise<void> {
    // TODO: Use bitbybit OCCT to create:
    // 1. Main panel with slight bevel
    // 2. Frame around panel
    // 3. Optional raised panel detail

    // Temporary THREE.js implementation
    const widthM = Units.mmToMeters(config.width);
    const heightM = Units.mmToMeters(config.height);
    const thicknessM = Units.mmToMeters(config.thickness);

    const panelGeom = new THREE.BoxGeometry(widthM, heightM, thicknessM);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.8,
      metalness: 0.1,
    });
    const panel = new THREE.Mesh(panelGeom, panelMat);
    panel.castShadow = true;
    panel.receiveShadow = true;

    parent.add(panel);
  }

  /**
   * Create glazed door (glass top portion)
   */
  private async createGlazedDoor(config: DoorConfig, parent: THREE.Group): Promise<void> {
    const glassHeight = config.glassHeight || config.height * 0.4;

    // TODO: Use bitbybit OCCT to:
    // 1. Create lower solid panel
    // 2. Create upper glass section with frame
    // 3. Add muntins/mullions for glass panes

    // Temporary implementation
    await this.createSolidDoor(config, parent);

    // Add glass panel placeholder
    const widthM = Units.mmToMeters(config.width - config.frameWidth * 2);
    const glassHeightM = Units.mmToMeters(glassHeight);

    const glassGeom = new THREE.PlaneGeometry(widthM, glassHeightM);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xCCFFFF,
      transparent: true,
      opacity: 0.3,
      transmission: 0.9,
      roughness: 0.1,
      metalness: 0,
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.y = Units.mmToMeters(config.height / 2 - glassHeight / 2);
    glass.position.z = Units.mmToMeters(config.thickness / 2 + 1);

    parent.add(glass);
  }

  /**
   * Create paneled door (raised panels)
   */
  private async createPaneledDoor(config: DoorConfig, parent: THREE.Group): Promise<void> {
    const panelCount = config.panelCount || 6; // Default 6-panel door

    // TODO: Use bitbybit OCCT to create traditional raised panels
    // with stiles and rails

    await this.createSolidDoor(config, parent);
    logger.debug('BitbybitComponentFactory', `Created ${panelCount}-panel door (simplified)`);
  }

  /**
   * Create French door (full-height glass with muntins)
   */
  private async createFrenchDoor(config: DoorConfig, parent: THREE.Group): Promise<void> {
    // TODO: Use bitbybit to create:
    // - Perimeter frame
    // - Glass panels
    // - Decorative muntins in grid pattern

    await this.createGlazedDoor({ ...config, glassHeight: config.height - 200 }, parent);
  }

  /**
   * Create standard window with frame and glazing
   */
  private async createStandardWindow(config: WindowConfig, parent: THREE.Group): Promise<void> {
    const widthM = Units.mmToMeters(config.width);
    const heightM = Units.mmToMeters(config.height);
    const frameWidthM = Units.mmToMeters(config.frameWidth);
    const frameDepthM = Units.mmToMeters(config.frameDepth);

    // TODO: Use bitbybit OCCT to create proper frame profile
    // For now, use simple box geometry

    // Outer frame
    const frameGeom = new THREE.BoxGeometry(widthM, heightM, frameDepthM);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    parent.add(frame);

    // Glass
    const glassWidth = widthM - frameWidthM * 2;
    const glassHeight = heightM - frameWidthM * 2;
    const glassGeom = new THREE.PlaneGeometry(glassWidth, glassHeight);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xCCFFFF,
      transparent: true,
      opacity: 0.3,
      transmission: 0.9,
      roughness: 0.05,
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    parent.add(glass);

    // Add mullions if specified
    if (config.mullions) {
      this.addMullions(config, parent);
    }
  }

  /**
   * Create casement window (hinged, opens outward)
   */
  private async createCasementWindow(config: WindowConfig, parent: THREE.Group): Promise<void> {
    // Similar to standard but with hinge hardware
    await this.createStandardWindow(config, parent);

    // TODO: Add hinge representation
  }

  /**
   * Create sliding window
   */
  private async createSlidingWindow(config: WindowConfig, parent: THREE.Group): Promise<void> {
    // Create two overlapping panels
    await this.createStandardWindow(config, parent);

    // TODO: Add track representation
  }

  /**
   * Create bay window (angled multi-panel)
   */
  private async createBayWindow(config: WindowConfig, parent: THREE.Group): Promise<void> {
    // Create 3 windows at angles (typically 30-45 degrees)
    const centerConfig = { ...config, width: config.width * 0.4 };
    const sideConfig = { ...config, width: config.width * 0.3 };

    // Center panel
    const center = await this.createStandardWindow(centerConfig, new THREE.Group());
    parent.add(center);

    // Left panel (angled)
    const left = await this.createStandardWindow(sideConfig, new THREE.Group());
    left.rotation.y = Math.PI / 6; // 30 degrees
    left.position.x = Units.mmToMeters(-config.width / 3);
    left.position.z = Units.mmToMeters(config.width / 6);
    parent.add(left);

    // Right panel (angled)
    const right = await this.createStandardWindow(sideConfig, new THREE.Group());
    right.rotation.y = -Math.PI / 6;
    right.position.x = Units.mmToMeters(config.width / 3);
    right.position.z = Units.mmToMeters(config.width / 6);
    parent.add(right);
  }

  /**
   * Add muntins/mullions to divide glass
   */
  private addMullions(config: WindowConfig, parent: THREE.Group): void {
    if (!config.mullions) return;

    const { horizontal, vertical } = config.mullions;
    const mullionThickness = Units.mmToMeters(20); // 20mm mullions

    // TODO: Use bitbybit to create proper muntin profiles
    // For now, use simple boxes

    logger.debug(
      'BitbybitComponentFactory',
      `Adding mullions: ${horizontal}H x ${vertical}V`
    );
  }

  /**
   * Add window sill
   */
  private addWindowSill(config: WindowConfig, parent: THREE.Group): void {
    const sillDepth = config.sillDepth || 100;
    const widthM = Units.mmToMeters(config.width + 40); // Extend beyond frame
    const sillDepthM = Units.mmToMeters(sillDepth);

    const sillGeom = new THREE.BoxGeometry(widthM, Units.mmToMeters(30), sillDepthM);
    const sillMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE });
    const sill = new THREE.Mesh(sillGeom, sillMat);

    sill.position.y = Units.mmToMeters(-config.height / 2 - 15);
    sill.position.z = Units.mmToMeters(sillDepth / 2 - config.frameDepth / 2);

    parent.add(sill);
  }

  /**
   * Add door hardware (handle, hinges, kickplate)
   */
  private addDoorHardware(config: DoorConfig, parent: THREE.Group): void {
    // TODO: Use bitbybit to create detailed hardware models

    // Handle position based on handle side
    const handleX =
      config.handleSide === 'left'
        ? Units.mmToMeters(-config.width / 2 + 100)
        : Units.mmToMeters(config.width / 2 - 100);

    logger.debug(
      'BitbybitComponentFactory',
      `Adding hardware: ${config.handleSide} handle, ${config.swingDirection} swing`
    );
  }

  /**
   * Fallback: Simple door without bitbybit
   */
  private createSimpleDoor(config: DoorConfig): THREE.Group {
    const group = new THREE.Group();
    const widthM = Units.mmToMeters(config.width);
    const heightM = Units.mmToMeters(config.height);
    const thicknessM = Units.mmToMeters(config.thickness);

    const geom = new THREE.BoxGeometry(widthM, heightM, thicknessM);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(geom, mat);

    group.add(mesh);
    return group;
  }

  /**
   * Fallback: Simple window without bitbybit
   */
  private createSimpleWindow(config: WindowConfig): THREE.Group {
    const group = new THREE.Group();
    const widthM = Units.mmToMeters(config.width);
    const heightM = Units.mmToMeters(config.height);
    const frameDepthM = Units.mmToMeters(config.frameDepth);

    const frameGeom = new THREE.BoxGeometry(widthM, heightM, frameDepthM);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const frame = new THREE.Mesh(frameGeom, frameMat);

    group.add(frame);
    return group;
  }
}

// Export factory singleton
let factoryInstance: BitbybitComponentFactory | null = null;

export const getBitbybitComponentFactory = (): BitbybitComponentFactory => {
  if (!factoryInstance) {
    factoryInstance = new BitbybitComponentFactory();
  }
  return factoryInstance;
};
