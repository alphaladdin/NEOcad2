/**
 * IFCPropertyParser - Parses IFC properties from FragmentsModel
 */

import * as FRAGS from '@thatopen/fragments';
import { logger } from './Logger';

export interface IFCElementProperties {
  // Basic IFC Info
  expressID?: number;
  type?: string;
  name?: string;
  description?: string;
  tag?: string;
  globalId?: string;

  // Spatial
  building?: string;
  storey?: string;
  space?: string;

  // Material & Quantities
  material?: string;
  volume?: number;
  area?: number;
  length?: number;

  // Custom Properties
  properties?: Record<string, any>;
  propertysets?: Record<string, Record<string, any>>;
}

export interface IFCProjectInfo {
  name?: string;
  description?: string;
  phase?: string;
  author?: string;
  organization?: string;
}

export class IFCPropertyParser {
  /**
   * Parse IFC element type from class name
   */
  static getIFCElementType(type: string): string {
    // Convert IFC type to readable format
    const typeMap: Record<string, string> = {
      IFCWALL: 'Wall',
      IFCWALLSTANDARDCASE: 'Wall',
      IFCDOOR: 'Door',
      IFCWINDOW: 'Window',
      IFCSLAB: 'Slab',
      IFCBEAM: 'Beam',
      IFCCOLUMN: 'Column',
      IFCSTAIR: 'Stair',
      IFCROOF: 'Roof',
      IFCFURNISHINGELEMENT: 'Furniture',
      IFCSPACE: 'Space',
      IFCBUILDING: 'Building',
      IFCBUILDINGSTOREY: 'Building Storey',
      IFCSITE: 'Site',
      IFCPROJECT: 'Project',
    };

    const upperType = type.toUpperCase();
    return typeMap[upperType] || type;
  }

  /**
   * Parse properties from FragmentsModel
   */
  static async parseElementProperties(
    model: FRAGS.FragmentsModel,
    expressID: number
  ): Promise<IFCElementProperties | null> {
    try {
      // Get item data using the new API
      const itemData = await model.getItemsData([expressID]);
      if (!itemData || itemData.length === 0) return null;

      const properties: any = itemData[0];

      const parsed: IFCElementProperties = {
        expressID,
        type: properties.type ? this.getIFCElementType(String(properties.type)) : undefined,
        name: properties.Name?.value || properties.name,
        description: properties.Description?.value || properties.description,
        tag: properties.Tag?.value || properties.tag,
        globalId: properties.GlobalId?.value || properties.globalId,
      };

      // Parse material
      if (properties.Material) {
        parsed.material = properties.Material.value || properties.Material;
      }

      // Parse quantities
      if (properties.Quantities) {
        const quantities = properties.Quantities;
        parsed.volume = quantities.Volume?.value || quantities.volume;
        parsed.area = quantities.Area?.value || quantities.area;
        parsed.length = quantities.Length?.value || quantities.length;
      }

      // Parse spatial structure
      if (properties.ContainedInStructure) {
        const structure = properties.ContainedInStructure;
        parsed.building = structure.Building?.value;
        parsed.storey = structure.Storey?.value;
        parsed.space = structure.Space?.value;
      }

      // Store all raw properties
      parsed.properties = properties;

      logger.debug('IFCPropertyParser', `Parsed properties for ${expressID}`, parsed);
      return parsed;
    } catch (error) {
      logger.error('IFCPropertyParser', `Failed to parse properties for ${expressID}`, error);
      return null;
    }
  }

  /**
   * Parse project information
   */
  static async parseProjectInfo(
    model: FRAGS.FragmentsModel
  ): Promise<IFCProjectInfo | null> {
    try {
      // Get spatial structure which contains project info
      const spatialStructure: any = await model.getSpatialStructure();

      if (!spatialStructure || !spatialStructure.project) {
        logger.warn('IFCPropertyParser', 'No IFC project found in model');
        return null;
      }

      const projectData = spatialStructure.project;

      // The project data could be an array or an object
      const firstProject = Array.isArray(projectData)
        ? projectData[0]
        : Object.values(projectData)[0];

      if (!firstProject) return null;

      const info: IFCProjectInfo = {
        name: (firstProject as any).Name?.value || (firstProject as any).name || (firstProject as any).LongName?.value,
        description: (firstProject as any).Description?.value || (firstProject as any).description,
        phase: (firstProject as any).Phase?.value || (firstProject as any).phase,
      };

      // Try to get author/organization from OwnerHistory
      if ((firstProject as any).OwnerHistory) {
        const ownerHistory = (firstProject as any).OwnerHistory;
        info.author = ownerHistory.OwningUser?.value;
        info.organization = ownerHistory.OwningApplication?.value;
      }

      logger.debug('IFCPropertyParser', 'Parsed project info', info);
      return info;
    } catch (error) {
      logger.error('IFCPropertyParser', 'Failed to parse project info', error);
      return null;
    }
  }

  /**
   * Get all elements of a specific type
   */
  static async getElementsByType(
    model: FRAGS.FragmentsModel,
    ifcType: string
  ): Promise<number[]> {
    try {
      // Use getItemsByQuery to filter by category (IFC type)
      const items = await model.getItemsByQuery({
        categories: [new RegExp(ifcType.toUpperCase())],
      });

      logger.debug('IFCPropertyParser', `Found ${items.length} elements of type ${ifcType}`);
      return items;
    } catch (error) {
      logger.error('IFCPropertyParser', `Failed to get elements of type ${ifcType}`, error);
      return [];
    }
  }

  /**
   * Get all elements with geometry in the model
   */
  static async getAllElements(
    model: FRAGS.FragmentsModel
  ): Promise<number[]> {
    try {
      const ids = await model.getItemsIdsWithGeometry();
      logger.debug('IFCPropertyParser', `Found ${ids.length} elements with geometry`);
      return ids;
    } catch (error) {
      logger.error('IFCPropertyParser', 'Failed to get all elements', error);
      return [];
    }
  }

  /**
   * Get elements grouped by IFC type
   */
  static async getElementsGroupedByType(
    model: FRAGS.FragmentsModel
  ): Promise<{ [type: string]: number[] }> {
    try {
      // Get all element IDs with geometry
      const ids = await model.getItemsIdsWithGeometry();

      if (ids.length === 0) {
        logger.warn('IFCPropertyParser', 'No elements with geometry found');
        return {};
      }

      // Get data for all elements in batch
      const itemsData = await model.getItemsData(ids);

      // Group by IFC type
      const grouped: { [type: string]: number[] } = {};

      for (const item of itemsData) {
        const type = (item as any).type?.value || (item as any).type || 'UNKNOWN';
        if (!grouped[type]) {
          grouped[type] = [];
        }
        grouped[type].push((item as any).expressID);
      }

      logger.debug('IFCPropertyParser', `Grouped elements into ${Object.keys(grouped).length} types`, grouped);
      return grouped;
    } catch (error) {
      logger.error('IFCPropertyParser', 'Failed to group elements by type', error);
      return {};
    }
  }

  /**
   * Get spatial structure (Building → Storey → Elements)
   */
  static async getSpatialStructure(
    model: FRAGS.FragmentsModel
  ): Promise<any> {
    try {
      // Use the FragmentsModel's built-in getSpatialStructure method
      const spatialStructure: any = await model.getSpatialStructure();

      if (!spatialStructure) {
        logger.warn('IFCPropertyParser', 'No spatial structure found in model');
        return null;
      }

      // The structure should already be in the format we need
      const structure: any = {
        project: spatialStructure.project || null,
        sites: spatialStructure.sites || [],
        buildings: spatialStructure.buildings || [],
        storeys: spatialStructure.storeys || [],
      };

      logger.debug('IFCPropertyParser', 'Parsed spatial structure', structure);
      return structure;
    } catch (error) {
      logger.error('IFCPropertyParser', 'Failed to parse spatial structure', error);
      return null;
    }
  }

  /**
   * Format property value for display
   */
  static formatPropertyValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';

    if (typeof value === 'object') {
      if (value.value !== undefined) return this.formatPropertyValue(value.value);
      return JSON.stringify(value);
    }

    if (typeof value === 'number') {
      return value.toFixed(2);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  }
}
