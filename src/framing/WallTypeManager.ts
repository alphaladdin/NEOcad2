/**
 * WallTypeManager - Manages library of standard wall types
 * Provides pre-configured wall types for US residential/commercial construction
 */

import * as THREE from 'three';
import { WallType, WallTypeConfig, MaterialLayer, StudSpecification, PlateSpecification } from './WallType';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

/**
 * Singleton manager for wall type library
 */
export class WallTypeManager {
  private static instance: WallTypeManager | null = null;
  private wallTypes: Map<string, WallType> = new Map();
  private defaultWallTypeId: string = '2x4-interior-standard';

  private constructor() {
    this.initializeStandardWallTypes();
    logger.info('WallTypeManager', 'WallTypeManager initialized with standard wall types');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WallTypeManager {
    if (!WallTypeManager.instance) {
      WallTypeManager.instance = new WallTypeManager();
    }
    return WallTypeManager.instance;
  }

  /**
   * Initialize standard US residential/commercial wall types
   */
  private initializeStandardWallTypes(): void {
    // 2x4 Interior Non-Load Bearing Wall
    this.addWallType({
      id: '2x4-interior-standard',
      name: '2x4 Interior Wall (Standard)',
      description: 'Standard interior partition wall, non-load bearing, 16" OC studs',
      nominalThickness: 3.5,
      actualThickness: 4.5, // 3.5" studs + 2× 0.5" drywall
      defaultHeight: 9, // 9 feet ceiling
      stud: {
        nominalSize: '2x4',
        actualWidth: 1.5,
        actualDepth: 3.5,
        spacing: 16, // 16" on center
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x4',
        count: 1, // Single top plate for non-load bearing
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x4',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.5, // 1/2" drywall
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
        {
          name: 'Stud Cavity',
          thickness: 3.5,
          material: 'Air',
          rValue: 1.0,
        },
        {
          name: 'Exterior Drywall',
          thickness: 0.5, // 1/2" drywall
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
      ],
      isLoadBearing: false,
      isExterior: false,
      fireRating: 1, // 1-hour fire rating
      color: new THREE.Color(0xCCCCCC),
      lineWeight: 1.0,
      costPerLinearFoot: 8.50, // Material cost
      laborHoursPerLinearFoot: 0.15,
    });

    // 2x4 Interior Load Bearing Wall
    this.addWallType({
      id: '2x4-interior-loadbearing',
      name: '2x4 Interior Wall (Load Bearing)',
      description: 'Interior load-bearing wall, double top plate, 16" OC studs',
      nominalThickness: 3.5,
      actualThickness: 4.5,
      defaultHeight: 9,
      stud: {
        nominalSize: '2x4',
        actualWidth: 1.5,
        actualDepth: 3.5,
        spacing: 16,
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x4',
        count: 2, // Double top plate for load bearing
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x4',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.5,
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
        {
          name: 'Stud Cavity',
          thickness: 3.5,
          material: 'Air',
          rValue: 1.0,
        },
        {
          name: 'Exterior Drywall',
          thickness: 0.5,
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
      ],
      isLoadBearing: true,
      isExterior: false,
      fireRating: 1,
      color: new THREE.Color(0xAAAAAA),
      lineWeight: 1.5, // Thicker line for load bearing
      costPerLinearFoot: 9.75,
      laborHoursPerLinearFoot: 0.18,
    });

    // 2x4 Exterior Wall (Basic - Drywall + Frame + OSB + Lap Siding)
    this.addWallType({
      id: '2x4-exterior-basic',
      name: '2x4 Exterior Wall (Basic)',
      description: 'Basic exterior wall: 1/2" drywall interior, 2x4 frame, 1/2" OSB, 8" white lap siding',
      nominalThickness: 3.5,
      actualThickness: 5.25, // 0.5" drywall + 3.5" stud + 0.5" OSB + 0.75" lap siding
      defaultHeight: 9,
      stud: {
        nominalSize: '2x4',
        actualWidth: 1.5,
        actualDepth: 3.5,
        spacing: 16,
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x4',
        count: 2, // Double top plate for exterior walls
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x4',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.5, // 1/2" drywall
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE), // Light gray
        },
        {
          name: 'Stud Cavity',
          thickness: 3.5, // 2x4 framing
          material: 'Wood Framing',
          rValue: 4.38, // Air cavity with wood studs
          color: new THREE.Color(0xDEB887), // Burlywood
        },
        {
          name: 'OSB Sheathing',
          thickness: 0.5, // 1/2" OSB plywood
          material: 'OSB',
          rValue: 0.62,
          color: new THREE.Color(0xD4A574), // Tan/brown
        },
        {
          name: '8" Lap Siding',
          thickness: 0.75, // 3/4" lap siding (typical thickness with overlap)
          material: 'Lap Siding',
          rValue: 0.80,
          color: new THREE.Color(0xFFFFFF), // White
        },
      ],
      isLoadBearing: true,
      isExterior: true,
      fireRating: 0.5, // Basic fire resistance
      color: new THREE.Color(0xFFFFFF), // White siding color for exterior walls
      lineWeight: 2.0,
      costPerLinearFoot: 18.00, // With siding added
      laborHoursPerLinearFoot: 0.30,
    });

    // 2x4 Exterior Wall (Climate Zone 3-4)
    this.addWallType({
      id: '2x4-exterior-standard',
      name: '2x4 Exterior Wall (Insulated)',
      description: 'Standard exterior wall with sheathing and siding, R-13 insulation',
      nominalThickness: 3.5,
      actualThickness: 6.0, // 0.5" drywall + 3.5" stud + 0.5" sheathing + 1.5" siding/air gap
      defaultHeight: 9,
      stud: {
        nominalSize: '2x4',
        actualWidth: 1.5,
        actualDepth: 3.5,
        spacing: 16,
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x4',
        count: 2, // Double top plate
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x4',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.5,
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
        {
          name: 'Insulation (R-13)',
          thickness: 3.5,
          material: 'Fiberglass Batt',
          rValue: 13.0,
          color: new THREE.Color(0xFFCC99),
        },
        {
          name: 'OSB Sheathing',
          thickness: 0.5, // 7/16" or 1/2" OSB
          material: 'OSB',
          rValue: 0.62,
          color: new THREE.Color(0xD4A574),
        },
        {
          name: 'Weather Barrier',
          thickness: 0.01, // House wrap
          material: 'Tyvek',
          rValue: 0.0,
        },
        {
          name: 'Siding',
          thickness: 1.0, // Vinyl siding + air gap
          material: 'Vinyl',
          rValue: 0.61,
          color: new THREE.Color(0x8B7355),
        },
      ],
      isLoadBearing: true,
      isExterior: true,
      fireRating: 1,
      color: new THREE.Color(0x8B7355),
      lineWeight: 2.0,
      costPerLinearFoot: 22.50,
      laborHoursPerLinearFoot: 0.35,
    });

    // 2x6 Exterior Wall (Climate Zone 5-8, High Performance)
    this.addWallType({
      id: '2x6-exterior-insulated',
      name: '2x6 Exterior Wall (Insulated)',
      description: 'High-performance exterior wall, R-21 insulation, 24" OC studs',
      nominalThickness: 5.5,
      actualThickness: 8.0, // 0.5" drywall + 5.5" stud + 0.5" sheathing + 1.5" siding/air gap
      defaultHeight: 9,
      stud: {
        nominalSize: '2x6',
        actualWidth: 1.5,
        actualDepth: 5.5,
        spacing: 24, // 24" OC for better insulation (less thermal bridging)
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x6',
        count: 2,
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x6',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.5,
          material: 'Gypsum',
          rValue: 0.45,
          color: new THREE.Color(0xEEEEEE),
        },
        {
          name: 'Insulation (R-21)',
          thickness: 5.5,
          material: 'Fiberglass Batt',
          rValue: 21.0,
          color: new THREE.Color(0xFFCC99),
        },
        {
          name: 'OSB Sheathing',
          thickness: 0.5,
          material: 'OSB',
          rValue: 0.62,
          color: new THREE.Color(0xD4A574),
        },
        {
          name: 'Weather Barrier',
          thickness: 0.01,
          material: 'Tyvek',
          rValue: 0.0,
        },
        {
          name: 'Siding',
          thickness: 1.0,
          material: 'Vinyl',
          rValue: 0.61,
          color: new THREE.Color(0x8B7355),
        },
      ],
      isLoadBearing: true,
      isExterior: true,
      fireRating: 1,
      color: new THREE.Color(0x6B5345),
      lineWeight: 2.5,
      costPerLinearFoot: 28.75,
      laborHoursPerLinearFoot: 0.40,
    });

    // 2x6 Interior Wall (Sound Insulation)
    this.addWallType({
      id: '2x6-interior-acoustic',
      name: '2x6 Interior Wall (Acoustic)',
      description: 'Interior wall with enhanced sound insulation, 5/8" drywall',
      nominalThickness: 5.5,
      actualThickness: 6.75, // 2× 5/8" drywall + 5.5" stud
      defaultHeight: 9,
      stud: {
        nominalSize: '2x6',
        actualWidth: 1.5,
        actualDepth: 5.5,
        spacing: 16,
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x6',
        count: 1,
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x6',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Interior Drywall',
          thickness: 0.625, // 5/8" drywall for better sound attenuation
          material: 'Gypsum',
          rValue: 0.56,
          color: new THREE.Color(0xEEEEEE),
        },
        {
          name: 'Sound Insulation',
          thickness: 5.5,
          material: 'Mineral Wool',
          rValue: 23.0,
          color: new THREE.Color(0xFFDD99),
        },
        {
          name: 'Exterior Drywall',
          thickness: 0.625,
          material: 'Gypsum',
          rValue: 0.56,
          color: new THREE.Color(0xEEEEEE),
        },
      ],
      isLoadBearing: false,
      isExterior: false,
      fireRating: 2, // 2-hour fire rating
      color: new THREE.Color(0xBBBBBB),
      lineWeight: 1.5,
      costPerLinearFoot: 18.50,
      laborHoursPerLinearFoot: 0.25,
    });

    // Fire-Rated Wall (1-hour)
    this.addWallType({
      id: '2x4-fire-1hr',
      name: '2x4 Fire Wall (1-hour)',
      description: '1-hour fire-rated wall with 5/8" Type X drywall',
      nominalThickness: 3.5,
      actualThickness: 4.75, // 2× 5/8" Type X drywall + 3.5" stud
      defaultHeight: 9,
      stud: {
        nominalSize: '2x4',
        actualWidth: 1.5,
        actualDepth: 3.5,
        spacing: 16,
        material: 'SPF (Spruce-Pine-Fir)',
      },
      topPlate: {
        nominalSize: '2x4',
        count: 2,
        type: 'top',
      },
      bottomPlate: {
        nominalSize: '2x4',
        count: 1,
        type: 'bottom',
      },
      layers: [
        {
          name: 'Type X Drywall',
          thickness: 0.625,
          material: 'Gypsum Type X',
          rValue: 0.56,
          color: new THREE.Color(0xFFEEEE),
        },
        {
          name: 'Stud Cavity',
          thickness: 3.5,
          material: 'Air',
          rValue: 1.0,
        },
        {
          name: 'Type X Drywall',
          thickness: 0.625,
          material: 'Gypsum Type X',
          rValue: 0.56,
          color: new THREE.Color(0xFFEEEE),
        },
      ],
      isLoadBearing: false,
      isExterior: false,
      fireRating: 1,
      color: new THREE.Color(0xDD8888),
      lineWeight: 2.0,
      costPerLinearFoot: 12.75,
      laborHoursPerLinearFoot: 0.20,
    });

    logger.info('WallTypeManager', `Loaded ${this.wallTypes.size} standard wall types`);
  }

  /**
   * Add a wall type to the library
   */
  addWallType(config: WallTypeConfig): WallType {
    const wallType = new WallType(config);
    this.wallTypes.set(wallType.id, wallType);

    eventBus.emit(Events.WALL_TYPE_ADDED, { wallType });
    logger.debug('WallTypeManager', `Added wall type: ${wallType.name}`);

    return wallType;
  }

  /**
   * Get a wall type by ID
   */
  getWallType(id: string): WallType | undefined {
    return this.wallTypes.get(id);
  }

  /**
   * Get all wall types
   */
  getAllWallTypes(): WallType[] {
    return Array.from(this.wallTypes.values());
  }

  /**
   * Get wall types filtered by category
   */
  getWallTypesByCategory(filter: {
    isExterior?: boolean;
    isLoadBearing?: boolean;
    nominalThickness?: number;
  }): WallType[] {
    return this.getAllWallTypes().filter((wallType) => {
      if (filter.isExterior !== undefined && wallType.isExterior !== filter.isExterior) {
        return false;
      }
      if (filter.isLoadBearing !== undefined && wallType.isLoadBearing !== filter.isLoadBearing) {
        return false;
      }
      if (filter.nominalThickness !== undefined && wallType.nominalThickness !== filter.nominalThickness) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get default wall type
   */
  getDefaultWallType(): WallType {
    const wallType = this.wallTypes.get(this.defaultWallTypeId);
    if (!wallType) {
      throw new Error(`Default wall type not found: ${this.defaultWallTypeId}`);
    }
    return wallType;
  }

  /**
   * Set default wall type
   */
  setDefaultWallType(id: string): void {
    if (!this.wallTypes.has(id)) {
      throw new Error(`Wall type not found: ${id}`);
    }
    this.defaultWallTypeId = id;
    eventBus.emit(Events.DEFAULT_WALL_TYPE_CHANGED, { wallTypeId: id });
    logger.info('WallTypeManager', `Default wall type set to: ${id}`);
  }

  /**
   * Remove a wall type
   */
  removeWallType(id: string): boolean {
    if (id === this.defaultWallTypeId) {
      logger.warn('WallTypeManager', 'Cannot remove default wall type');
      return false;
    }

    const wallType = this.wallTypes.get(id);
    if (wallType) {
      this.wallTypes.delete(id);
      eventBus.emit(Events.WALL_TYPE_REMOVED, { wallType });
      logger.info('WallTypeManager', `Removed wall type: ${wallType.name}`);
      return true;
    }
    return false;
  }

  /**
   * Clone a wall type with modifications
   */
  cloneWallType(sourceId: string, newId: string, overrides: Partial<WallTypeConfig> = {}): WallType | null {
    const sourceWallType = this.wallTypes.get(sourceId);
    if (!sourceWallType) {
      logger.error('WallTypeManager', `Source wall type not found: ${sourceId}`);
      return null;
    }

    const clonedWallType = sourceWallType.clone({
      id: newId,
      ...overrides,
    });

    this.wallTypes.set(clonedWallType.id, clonedWallType);
    eventBus.emit(Events.WALL_TYPE_ADDED, { wallType: clonedWallType });
    logger.info('WallTypeManager', `Cloned wall type: ${sourceId} -> ${newId}`);

    return clonedWallType;
  }

  /**
   * Export wall type library to JSON
   */
  exportLibrary(): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      defaultWallTypeId: this.defaultWallTypeId,
      wallTypes: Array.from(this.wallTypes.values()).map((wt) => wt.toJSON()),
    };
  }

  /**
   * Import wall type library from JSON
   */
  importLibrary(data: any, replaceExisting: boolean = false): void {
    if (!data.wallTypes || !Array.isArray(data.wallTypes)) {
      logger.error('WallTypeManager', 'Invalid wall type library data');
      return;
    }

    if (replaceExisting) {
      this.wallTypes.clear();
    }

    data.wallTypes.forEach((wallTypeData: any) => {
      const wallType = WallType.fromJSON(wallTypeData);
      this.wallTypes.set(wallType.id, wallType);
    });

    if (data.defaultWallTypeId && this.wallTypes.has(data.defaultWallTypeId)) {
      this.defaultWallTypeId = data.defaultWallTypeId;
    }

    logger.info('WallTypeManager', `Imported ${data.wallTypes.length} wall types`);
  }

  /**
   * Get wall types grouped by stud size
   */
  getWallTypesByStudSize(): Map<string, WallType[]> {
    const grouped = new Map<string, WallType[]>();

    this.getAllWallTypes().forEach((wallType) => {
      const studSize = wallType.stud.nominalSize;
      if (!grouped.has(studSize)) {
        grouped.set(studSize, []);
      }
      grouped.get(studSize)!.push(wallType);
    });

    return grouped;
  }

  /**
   * Search wall types by name or description
   */
  searchWallTypes(query: string): WallType[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllWallTypes().filter(
      (wallType) =>
        wallType.name.toLowerCase().includes(lowerQuery) ||
        wallType.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get wall type statistics
   */
  getStatistics(): {
    totalWallTypes: number;
    exteriorWalls: number;
    interiorWalls: number;
    loadBearingWalls: number;
    byStudSize: Map<string, number>;
  } {
    const stats = {
      totalWallTypes: this.wallTypes.size,
      exteriorWalls: 0,
      interiorWalls: 0,
      loadBearingWalls: 0,
      byStudSize: new Map<string, number>(),
    };

    this.getAllWallTypes().forEach((wallType) => {
      if (wallType.isExterior) stats.exteriorWalls++;
      if (!wallType.isExterior) stats.interiorWalls++;
      if (wallType.isLoadBearing) stats.loadBearingWalls++;

      const studSize = wallType.stud.nominalSize;
      stats.byStudSize.set(studSize, (stats.byStudSize.get(studSize) || 0) + 1);
    });

    return stats;
  }

  /**
   * Reset to default wall types only
   */
  reset(): void {
    this.wallTypes.clear();
    this.initializeStandardWallTypes();
    this.defaultWallTypeId = '2x4-interior-standard';
    logger.info('WallTypeManager', 'Reset to default wall types');
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.wallTypes.clear();
    logger.info('WallTypeManager', 'WallTypeManager disposed');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    if (WallTypeManager.instance) {
      WallTypeManager.instance.dispose();
      WallTypeManager.instance = null;
    }
  }
}

// Export convenience function
export const getWallTypeManager = (): WallTypeManager => {
  return WallTypeManager.getInstance();
};
