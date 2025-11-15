/**
 * PropertiesPanel - Displays properties of selected objects
 */

import { Panel } from './Panel';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { IFCPropertyParser, IFCElementProperties } from '@utils/IFCPropertyParser';
import * as FRAGS from '@thatopen/fragments';

export interface PropertyItem {
  label: string;
  value: string | number | boolean;
  type?: 'string' | 'number' | 'boolean' | 'color';
  editable?: boolean;
}

export interface PropertyGroup {
  name: string;
  properties: PropertyItem[];
  expanded?: boolean;
}

export class PropertiesPanel extends Panel {
  private properties: Map<string, PropertyGroup> = new Map();
  private selectedObjectId: string | null = null;
  private selectedModel: FRAGS.FragmentsModel | null = null;
  private selectedExpressID: number | null = null;
  private selectedItems: any[] = []; // For multi-selection

  constructor() {
    super({
      id: 'properties',
      title: 'Properties',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>`,
      resizable: true,
      minHeight: 200,
      maxHeight: 800,
    });

    this.setupEventListeners();
    this.showEmptyState();

    logger.info('PropertiesPanel', 'PropertiesPanel initialized');
  }

  private setupEventListeners(): void {
    eventBus.on(Events.OBJECT_SELECTED, (data: any) => {
      this.onObjectSelected(data);
    });

    eventBus.on(Events.OBJECT_DESELECTED, () => {
      this.onObjectDeselected();
    });

    eventBus.on(Events.SELECTION_CHANGED, (data: any) => {
      this.onSelectionChanged(data);
    });

    eventBus.on(Events.SELECTION_CLEARED, () => {
      this.clearProperties();
    });
  }

  private async onObjectSelected(data: any): Promise<void> {
    logger.debug('PropertiesPanel', 'Object selected:', data);

    if (data && data.object) {
      this.selectedObjectId = data.object.uuid || null;

      // Check if this is an IFC element with model and expressID
      if (data.model && data.expressID !== undefined) {
        this.selectedModel = data.model;
        this.selectedExpressID = data.expressID;
        await this.displayIFCProperties(data.object, data.model, data.expressID);
      } else {
        this.selectedModel = null;
        this.selectedExpressID = null;
        this.displayObjectProperties(data.object);
      }
    }
  }

  private onObjectDeselected(): void {
    // Don't clear if there are still other selections
    if (this.selectedItems.length > 1) {
      // Update to show remaining selections
      this.displayMultiSelectionSummary(this.selectedItems);
    } else {
      this.clearProperties();
    }
  }

  private async onSelectionChanged(data: any): Promise<void> {
    if (!data || !data.selected || !Array.isArray(data.selected)) {
      this.clearProperties();
      return;
    }

    this.selectedItems = data.selected;

    if (data.selected.length === 0) {
      this.clearProperties();
    } else if (data.selected.length === 1) {
      // Single selection - show full properties
      const item = data.selected[0];
      if (item.model && item.expressID !== undefined) {
        await this.displayIFCProperties(item.object, item.model, item.expressID);
      } else if (item.object) {
        this.displayObjectProperties(item.object);
      }
    } else {
      // Multi-selection - show summary
      this.displayMultiSelectionSummary(data.selected);
    }
  }

  /**
   * Display IFC-specific properties
   */
  private async displayIFCProperties(
    object: any,
    model: FRAGS.FragmentsModel,
    expressID: number
  ): Promise<void> {
    this.properties.clear();

    // Parse IFC properties
    const ifcProps = await IFCPropertyParser.parseElementProperties(model, expressID);

    if (!ifcProps) {
      // Fallback to generic properties if IFC parsing fails
      this.displayObjectProperties(object);
      return;
    }

    // IFC Information Group
    const ifcInfoProps: PropertyItem[] = [];
    if (ifcProps.type) {
      ifcInfoProps.push({ label: 'IFC Type', value: ifcProps.type, editable: false });
    }
    if (ifcProps.name) {
      ifcInfoProps.push({ label: 'Name', value: ifcProps.name, editable: false });
    }
    if (ifcProps.description) {
      ifcInfoProps.push({ label: 'Description', value: ifcProps.description, editable: false });
    }
    if (ifcProps.tag) {
      ifcInfoProps.push({ label: 'Tag', value: ifcProps.tag, editable: false });
    }
    if (ifcProps.globalId) {
      ifcInfoProps.push({ label: 'Global ID', value: ifcProps.globalId, editable: false });
    }
    ifcInfoProps.push({ label: 'Express ID', value: expressID, editable: false });

    if (ifcInfoProps.length > 0) {
      this.properties.set('ifc-info', {
        name: 'IFC Information',
        properties: ifcInfoProps,
        expanded: true,
      });
    }

    // Spatial Location Group
    const spatialProps: PropertyItem[] = [];
    if (ifcProps.building) {
      spatialProps.push({ label: 'Building', value: ifcProps.building, editable: false });
    }
    if (ifcProps.storey) {
      spatialProps.push({ label: 'Storey', value: ifcProps.storey, editable: false });
    }
    if (ifcProps.space) {
      spatialProps.push({ label: 'Space', value: ifcProps.space, editable: false });
    }

    if (spatialProps.length > 0) {
      this.properties.set('spatial', {
        name: 'Spatial Location',
        properties: spatialProps,
        expanded: true,
      });
    }

    // Quantities Group
    const quantityProps: PropertyItem[] = [];
    if (ifcProps.volume !== undefined) {
      quantityProps.push({
        label: 'Volume',
        value: `${ifcProps.volume.toFixed(3)} m³`,
        editable: false,
      });
    }
    if (ifcProps.area !== undefined) {
      quantityProps.push({
        label: 'Area',
        value: `${ifcProps.area.toFixed(3)} m²`,
        editable: false,
      });
    }
    if (ifcProps.length !== undefined) {
      quantityProps.push({
        label: 'Length',
        value: `${ifcProps.length.toFixed(3)} m`,
        editable: false,
      });
    }

    if (quantityProps.length > 0) {
      this.properties.set('quantities', {
        name: 'Quantities',
        properties: quantityProps,
        expanded: true,
      });
    }

    // Material Group (IFC)
    if (ifcProps.material) {
      this.properties.set('ifc-material', {
        name: 'Material',
        properties: [{ label: 'Material', value: ifcProps.material, editable: false }],
        expanded: true,
      });
    }

    // Still show transform properties from Three.js object
    if (object.position && object.rotation && object.scale) {
      this.properties.set('transform', {
        name: 'Transform',
        properties: [
          { label: 'Position X', value: object.position.x.toFixed(3), type: 'number', editable: true },
          { label: 'Position Y', value: object.position.y.toFixed(3), type: 'number', editable: true },
          { label: 'Position Z', value: object.position.z.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation X', value: object.rotation.x.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation Y', value: object.rotation.y.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation Z', value: object.rotation.z.toFixed(3), type: 'number', editable: true },
          { label: 'Scale X', value: object.scale.x.toFixed(3), type: 'number', editable: true },
          { label: 'Scale Y', value: object.scale.y.toFixed(3), type: 'number', editable: true },
          { label: 'Scale Z', value: object.scale.z.toFixed(3), type: 'number', editable: true },
        ],
        expanded: false,
      });
    }

    // Geometry info
    if (object.geometry) {
      const geometry = object.geometry;
      const geometryProps: PropertyItem[] = [
        { label: 'Geometry Type', value: geometry.type || 'Unknown', editable: false },
      ];

      if (geometry.attributes.position) {
        geometryProps.push({
          label: 'Vertices',
          value: geometry.attributes.position.count,
          editable: false,
        });
      }

      if (geometry.index) {
        geometryProps.push({
          label: 'Faces',
          value: geometry.index.count / 3,
          editable: false,
        });
      }

      this.properties.set('geometry', {
        name: 'Geometry',
        properties: geometryProps,
        expanded: false,
      });
    }

    this.render();
  }

  private displayObjectProperties(object: any): void {
    this.properties.clear();

    // Basic Info Group
    this.properties.set('basic', {
      name: 'Basic Information',
      properties: [
        { label: 'Name', value: object.name || 'Unnamed', editable: false },
        { label: 'Type', value: object.type || 'Unknown', editable: false },
        { label: 'UUID', value: object.uuid || 'N/A', editable: false },
        { label: 'Visible', value: object.visible ?? true, type: 'boolean', editable: true },
      ],
      expanded: true,
    });

    // Transform Group
    if (object.position && object.rotation && object.scale) {
      this.properties.set('transform', {
        name: 'Transform',
        properties: [
          { label: 'Position X', value: object.position.x.toFixed(3), type: 'number', editable: true },
          { label: 'Position Y', value: object.position.y.toFixed(3), type: 'number', editable: true },
          { label: 'Position Z', value: object.position.z.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation X', value: object.rotation.x.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation Y', value: object.rotation.y.toFixed(3), type: 'number', editable: true },
          { label: 'Rotation Z', value: object.rotation.z.toFixed(3), type: 'number', editable: true },
          { label: 'Scale X', value: object.scale.x.toFixed(3), type: 'number', editable: true },
          { label: 'Scale Y', value: object.scale.y.toFixed(3), type: 'number', editable: true },
          { label: 'Scale Z', value: object.scale.z.toFixed(3), type: 'number', editable: true },
        ],
        expanded: true,
      });
    }

    // Material Group
    if (object.material) {
      const material = object.material;
      const materialProps: PropertyItem[] = [
        { label: 'Material Type', value: material.type || 'Unknown', editable: false },
      ];

      if (material.color) {
        materialProps.push({
          label: 'Color',
          value: `#${material.color.getHexString()}`,
          type: 'color',
          editable: true,
        });
      }

      if (material.opacity !== undefined) {
        materialProps.push({
          label: 'Opacity',
          value: material.opacity.toFixed(2),
          type: 'number',
          editable: true,
        });
      }

      if (material.metalness !== undefined) {
        materialProps.push({
          label: 'Metalness',
          value: material.metalness.toFixed(2),
          type: 'number',
          editable: true,
        });
      }

      if (material.roughness !== undefined) {
        materialProps.push({
          label: 'Roughness',
          value: material.roughness.toFixed(2),
          type: 'number',
          editable: true,
        });
      }

      this.properties.set('material', {
        name: 'Material',
        properties: materialProps,
        expanded: true,
      });
    }

    // Geometry Group
    if (object.geometry) {
      const geometry = object.geometry;
      const geometryProps: PropertyItem[] = [
        { label: 'Geometry Type', value: geometry.type || 'Unknown', editable: false },
      ];

      if (geometry.attributes.position) {
        geometryProps.push({
          label: 'Vertices',
          value: geometry.attributes.position.count,
          editable: false,
        });
      }

      if (geometry.index) {
        geometryProps.push({
          label: 'Faces',
          value: geometry.index.count / 3,
          editable: false,
        });
      }

      this.properties.set('geometry', {
        name: 'Geometry',
        properties: geometryProps,
        expanded: false,
      });
    }

    this.render();
  }

  private render(): void {
    const contentEl = this.getContentElement();
    contentEl.innerHTML = '';

    if (this.properties.size === 0) {
      this.showEmptyState();
      return;
    }

    // Add action buttons at the top
    const actionsEl = this.createActionButtons();
    contentEl.appendChild(actionsEl);

    this.properties.forEach((group, groupId) => {
      const groupEl = this.createPropertyGroup(group, groupId);
      contentEl.appendChild(groupEl);
    });
  }

  /**
   * Create action buttons for copy/export
   */
  private createActionButtons(): HTMLElement {
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 8px;
      border-bottom: var(--border);
      background: var(--color-surface-1);
    `;

    // Copy All as JSON button
    const copyJsonBtn = document.createElement('button');
    copyJsonBtn.textContent = 'Copy JSON';
    copyJsonBtn.title = 'Copy all properties as JSON';
    copyJsonBtn.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      white-space: nowrap;
    `;
    copyJsonBtn.addEventListener('click', () => this.copyAllAsJSON());
    copyJsonBtn.addEventListener('mouseenter', () => {
      copyJsonBtn.style.background = 'var(--color-surface-3)';
    });
    copyJsonBtn.addEventListener('mouseleave', () => {
      copyJsonBtn.style.background = 'var(--color-surface-2)';
    });

    // Export as JSON button
    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.textContent = 'Export JSON';
    exportJsonBtn.title = 'Download properties as JSON file';
    exportJsonBtn.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      white-space: nowrap;
    `;
    exportJsonBtn.addEventListener('click', () => this.exportAsJSON());
    exportJsonBtn.addEventListener('mouseenter', () => {
      exportJsonBtn.style.background = 'var(--color-surface-3)';
    });
    exportJsonBtn.addEventListener('mouseleave', () => {
      exportJsonBtn.style.background = 'var(--color-surface-2)';
    });

    // Export as CSV button
    const exportCsvBtn = document.createElement('button');
    exportCsvBtn.textContent = 'Export CSV';
    exportCsvBtn.title = 'Download properties as CSV file';
    exportCsvBtn.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      white-space: nowrap;
    `;
    exportCsvBtn.addEventListener('click', () => this.exportAsCSV());
    exportCsvBtn.addEventListener('mouseenter', () => {
      exportCsvBtn.style.background = 'var(--color-surface-3)';
    });
    exportCsvBtn.addEventListener('mouseleave', () => {
      exportCsvBtn.style.background = 'var(--color-surface-2)';
    });

    actionsContainer.appendChild(copyJsonBtn);
    actionsContainer.appendChild(exportJsonBtn);
    actionsContainer.appendChild(exportCsvBtn);

    return actionsContainer;
  }

  private createPropertyGroup(group: PropertyGroup, groupId: string): HTMLElement {
    const groupEl = document.createElement('div');
    groupEl.className = 'property-group';
    groupEl.setAttribute('data-group-id', groupId);

    // Group header
    const headerEl = document.createElement('div');
    headerEl.className = 'property-group-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'property-group-title';
    titleEl.textContent = group.name;

    const toggleEl = document.createElement('button');
    toggleEl.className = 'property-group-toggle';
    toggleEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;

    if (!group.expanded) {
      groupEl.classList.add('collapsed');
      toggleEl.classList.add('collapsed');
    }

    headerEl.appendChild(titleEl);
    headerEl.appendChild(toggleEl);

    headerEl.addEventListener('click', () => {
      group.expanded = !group.expanded;
      groupEl.classList.toggle('collapsed');
      toggleEl.classList.toggle('collapsed');
    });

    // Group content
    const contentEl = document.createElement('div');
    contentEl.className = 'property-group-content';

    group.properties.forEach((prop) => {
      const propEl = this.createPropertyRow(prop);
      contentEl.appendChild(propEl);
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(contentEl);

    return groupEl;
  }

  private createPropertyRow(prop: PropertyItem): HTMLElement {
    const rowEl = document.createElement('div');
    rowEl.className = 'property-row';
    rowEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const labelEl = document.createElement('div');
    labelEl.className = 'property-label';
    labelEl.textContent = prop.label;
    labelEl.style.cssText = 'flex: 0 0 40%; min-width: 0;';

    const valueEl = document.createElement('div');
    valueEl.className = 'property-value';
    valueEl.style.cssText = 'flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px;';

    if (prop.editable) {
      const input = this.createPropertyInput(prop);
      input.style.cssText = 'flex: 1; min-width: 0;';
      valueEl.appendChild(input);
    } else {
      const span = document.createElement('span');
      span.textContent = String(prop.value);
      span.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;';
      if (prop.type === 'color') {
        span.style.color = String(prop.value);
      }
      valueEl.appendChild(span);

      // Add copy button for non-editable properties
      const copyBtn = this.createCopyButton(String(prop.value), prop.label);
      valueEl.appendChild(copyBtn);
    }

    rowEl.appendChild(labelEl);
    rowEl.appendChild(valueEl);

    return rowEl;
  }

  private createPropertyInput(prop: PropertyItem): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'property-input';

    switch (prop.type) {
      case 'boolean':
        input.type = 'checkbox';
        input.checked = Boolean(prop.value);
        break;
      case 'number':
        input.type = 'number';
        input.value = String(prop.value);
        input.step = '0.01';
        break;
      case 'color':
        input.type = 'color';
        input.value = String(prop.value);
        break;
      default:
        input.type = 'text';
        input.value = String(prop.value);
    }

    // TODO: Add change handlers to update actual object properties
    input.addEventListener('change', () => {
      logger.debug('PropertiesPanel', `Property changed: ${prop.label} = ${input.value}`);
    });

    return input;
  }

  private showEmptyState(): void {
    const contentEl = this.getContentElement();
    contentEl.innerHTML = `
      <div class="property-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <p>No object selected</p>
        <span>Select an object to view its properties</span>
      </div>
    `;
  }

  /**
   * Create a copy button for a property value
   */
  private createCopyButton(value: string, label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = '📋';
    btn.title = `Copy ${label}`;
    btn.style.cssText = `
      padding: 2px 6px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: 12px;
      cursor: pointer;
      opacity: 0.7;
      flex-shrink: 0;
    `;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.copyToClipboard(value, label);
      btn.innerHTML = '✓';
      setTimeout(() => {
        btn.innerHTML = '📋';
      }, 1000);
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.background = 'var(--color-surface-3)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.7';
      btn.style.background = 'var(--color-surface-2)';
    });
    return btn;
  }

  /**
   * Copy text to clipboard
   */
  private async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      logger.info('PropertiesPanel', `Copied ${label}: ${text}`);
    } catch (error) {
      logger.error('PropertiesPanel', `Failed to copy ${label}`, error);
    }
  }

  /**
   * Copy all properties as JSON
   */
  private async copyAllAsJSON(): Promise<void> {
    const data = this.propertiesToObject();
    const json = JSON.stringify(data, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      logger.info('PropertiesPanel', 'Copied all properties as JSON to clipboard');
    } catch (error) {
      logger.error('PropertiesPanel', 'Failed to copy JSON', error);
    }
  }

  /**
   * Export properties as JSON file
   */
  private exportAsJSON(): void {
    const data = this.propertiesToObject();
    const json = JSON.stringify(data, null, 2);
    const filename = this.getExportFilename('json');
    this.downloadFile(json, filename, 'application/json');
    logger.info('PropertiesPanel', `Exported properties as JSON: ${filename}`);
  }

  /**
   * Export properties as CSV file
   */
  private exportAsCSV(): void {
    const csv = this.propertiesToCSV();
    const filename = this.getExportFilename('csv');
    this.downloadFile(csv, filename, 'text/csv');
    logger.info('PropertiesPanel', `Exported properties as CSV: ${filename}`);
  }

  /**
   * Convert properties to plain object
   */
  private propertiesToObject(): any {
    const obj: any = {};

    this.properties.forEach((group, groupId) => {
      const groupData: any = {};
      group.properties.forEach((prop) => {
        groupData[prop.label] = prop.value;
      });
      obj[group.name] = groupData;
    });

    return obj;
  }

  /**
   * Convert properties to CSV format
   */
  private propertiesToCSV(): string {
    const rows: string[] = [];

    // Header
    rows.push('Group,Property,Value');

    // Data rows
    this.properties.forEach((group) => {
      group.properties.forEach((prop) => {
        const value = String(prop.value).replace(/"/g, '""'); // Escape quotes
        rows.push(`"${group.name}","${prop.label}","${value}"`);
      });
    });

    return rows.join('\n');
  }

  /**
   * Get filename for export
   */
  private getExportFilename(extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let basename = 'properties';

    // Try to use a meaningful name based on selection
    if (this.selectedExpressID !== null) {
      basename = `element-${this.selectedExpressID}`;
    } else if (this.selectedObjectId) {
      basename = `object-${this.selectedObjectId.slice(0, 8)}`;
    }

    return `${basename}-${timestamp}.${extension}`;
  }

  /**
   * Download file helper
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Display multi-selection summary
   */
  private displayMultiSelectionSummary(items: any[]): void {
    this.properties.clear();

    // Selection Summary Group
    const summaryProps: PropertyItem[] = [
      { label: 'Selection Count', value: items.length, editable: false },
    ];

    // Count by IFC type
    const typeCounts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.object && item.object.userData && item.object.userData.type) {
        const type = item.object.userData.type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
    });

    // Add type breakdown
    Object.entries(typeCounts).forEach(([type, count]) => {
      summaryProps.push({
        label: IFCPropertyParser.getIFCElementType(type),
        value: count,
        editable: false,
      });
    });

    this.properties.set('multi-selection', {
      name: 'Multi-Selection Summary',
      properties: summaryProps,
      expanded: true,
    });

    // Common Properties (if all selected items share same type)
    if (Object.keys(typeCounts).length === 1) {
      const commonType = Object.keys(typeCounts)[0];

      this.properties.set('common-type', {
        name: 'Common Type',
        properties: [
          {
            label: 'IFC Type',
            value: IFCPropertyParser.getIFCElementType(commonType),
            editable: false,
          },
        ],
        expanded: true,
      });
    }

    // Aggregate quantities (if available)
    const aggregateProps: PropertyItem[] = [];
    let totalVolume = 0;
    let totalArea = 0;
    let totalLength = 0;
    let hasQuantities = false;

    items.forEach((item) => {
      if (item.model && item.expressID !== undefined) {
        // Would need to fetch properties async - simplified for now
        // In production, you'd aggregate from cached properties
      }
    });

    if (hasQuantities) {
      this.properties.set('aggregate', {
        name: 'Aggregate Quantities',
        properties: aggregateProps,
        expanded: true,
      });
    }

    // Bulk Actions
    const actionsProps: PropertyItem[] = [
      {
        label: 'Actions',
        value: 'Focus (F), Hide (H), Isolate (I)',
        editable: false,
      },
    ];

    this.properties.set('actions', {
      name: 'Bulk Actions',
      properties: actionsProps,
      expanded: false,
    });

    this.render();
  }

  private clearProperties(): void {
    this.properties.clear();
    this.selectedObjectId = null;
    this.selectedItems = [];
    this.showEmptyState();
    logger.debug('PropertiesPanel', 'Properties cleared');
  }
}
