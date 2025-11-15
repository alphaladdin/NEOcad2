/**
 * ObjectTreePanel - Displays IFC spatial structure as a tree
 */

import { Panel } from './Panel';
import { TreeView, TreeNode } from './TreeView';
import { ContextMenu } from './ContextMenu';
import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { IFCPropertyParser } from '@utils/IFCPropertyParser';
import * as FRAGS from '@thatopen/fragments';

export class ObjectTreePanel extends Panel {
  private treeView: TreeView;
  private contextMenu: ContextMenu;
  private currentModel: FRAGS.FragmentsModel | null = null;
  private elementMap: Map<string, { expressID: number }> = new Map();
  private allNodes: TreeNode[] = [];
  private searchInput: HTMLInputElement | null = null;
  private typeFilter: HTMLSelectElement | null = null;
  private availableTypes: Set<string> = new Set();

  constructor() {
    super({
      id: 'object-tree',
      title: 'Object Tree',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        <path d="M9 12h6"/>
      </svg>`,
      resizable: true,
      minHeight: 200,
      maxHeight: 800,
      defaultCollapsed: false,
    });

    this.treeView = new TreeView({
      showCheckboxes: true,
      showIcons: true,
      multiSelect: true,
    });

    this.contextMenu = new ContextMenu();

    this.setupTreeCallbacks();
    this.setupEventListeners();

    const contentEl = this.getContentElement();

    // Add search and filter UI
    const filterContainer = this.createFilterUI();
    contentEl.appendChild(filterContainer);

    contentEl.appendChild(this.treeView.getElement());

    logger.info('ObjectTreePanel', 'ObjectTreePanel initialized');
  }

  private createFilterUI(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tree-filter-container';
    container.style.cssText = `
      padding: 8px;
      border-bottom: var(--border);
      background: var(--color-surface-1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
    `;

    const searchIcon = document.createElement('span');
    searchIcon.innerHTML = '🔍';
    searchIcon.style.cssText = `
      font-size: 14px;
      opacity: 0.7;
    `;

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search elements...';
    this.searchInput.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      outline: none;
    `;

    this.searchInput.addEventListener('input', () => this.applyFilters());

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(this.searchInput);

    // Type filter dropdown
    const filterRow = document.createElement('div');
    filterRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const filterLabel = document.createElement('label');
    filterLabel.textContent = 'Type:';
    filterLabel.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      min-width: 40px;
    `;

    this.typeFilter = document.createElement('select');
    this.typeFilter.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
    `;

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Types';
    this.typeFilter.appendChild(allOption);

    this.typeFilter.addEventListener('change', () => this.applyFilters());

    // Clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.style.cssText = `
      padding: 6px 12px;
      border: var(--border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      white-space: nowrap;
    `;
    clearButton.addEventListener('click', () => this.clearFilters());
    clearButton.addEventListener('mouseenter', () => {
      clearButton.style.background = 'var(--color-surface-3)';
    });
    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.background = 'var(--color-surface-2)';
    });

    filterRow.appendChild(filterLabel);
    filterRow.appendChild(this.typeFilter);
    filterRow.appendChild(clearButton);

    // Expand/Collapse controls
    const expandCollapseRow = document.createElement('div');
    expandCollapseRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const expandAllButton = document.createElement('button');
    expandAllButton.textContent = 'Expand All';
    expandAllButton.style.cssText = `
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
    expandAllButton.addEventListener('click', () => {
      this.treeView.expandAll();
      logger.debug('ObjectTreePanel', 'Expanded all nodes');
    });
    expandAllButton.addEventListener('mouseenter', () => {
      expandAllButton.style.background = 'var(--color-surface-3)';
    });
    expandAllButton.addEventListener('mouseleave', () => {
      expandAllButton.style.background = 'var(--color-surface-2)';
    });

    const collapseAllButton = document.createElement('button');
    collapseAllButton.textContent = 'Collapse All';
    collapseAllButton.style.cssText = `
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
    collapseAllButton.addEventListener('click', () => {
      this.treeView.collapseAll();
      logger.debug('ObjectTreePanel', 'Collapsed all nodes');
    });
    collapseAllButton.addEventListener('mouseenter', () => {
      collapseAllButton.style.background = 'var(--color-surface-3)';
    });
    collapseAllButton.addEventListener('mouseleave', () => {
      collapseAllButton.style.background = 'var(--color-surface-2)';
    });

    expandCollapseRow.appendChild(expandAllButton);
    expandCollapseRow.appendChild(collapseAllButton);

    container.appendChild(searchContainer);
    container.appendChild(filterRow);
    container.appendChild(expandCollapseRow);

    return container;
  }

  private setupTreeCallbacks(): void {
    // Node click - select object(s) in viewport
    this.treeView.setOnNodeClick((node, _event) => {
      logger.debug('ObjectTreePanel', `Node clicked: ${node.label}`, node);

      // Get all currently selected nodes
      const selectedNodeIds = this.treeView.getSelectedNodes();

      if (selectedNodeIds.length === 0) {
        // No selection, clear
        eventBus.emit(Events.SELECTION_CLEARED);
        return;
      }

      // Collect data for all selected elements
      const selectedElements: Array<{ model: FRAGS.FragmentsModel; expressID: number }> = [];

      for (const nodeId of selectedNodeIds) {
        const elementData = this.elementMap.get(nodeId);
        if (elementData && this.currentModel) {
          selectedElements.push({
            model: this.currentModel,
            expressID: elementData.expressID,
          });
        }
      }

      if (selectedElements.length === 0) return;

      // If single selection, use OBJECT_SELECTED event
      if (selectedElements.length === 1) {
        eventBus.emit(Events.OBJECT_SELECTED, {
          ...selectedElements[0],
          source: 'tree',
        });
      } else {
        // If multiple selection, emit a multi-selection event
        eventBus.emit(Events.SELECTION_CHANGED, {
          selected: selectedElements,
          source: 'tree',
        });
      }
    });

    // Node double click - focus on object
    this.treeView.setOnNodeDoubleClick((node) => {
      logger.debug('ObjectTreePanel', `Node double-clicked: ${node.label}`);
      // TODO: Implement camera focus on object
    });

    // Visibility toggle - show/hide object
    this.treeView.setOnNodeVisibilityToggle(async (node) => {
      logger.debug('ObjectTreePanel', `Visibility toggled for: ${node.label}`, node.visible);

      const elementData = this.elementMap.get(node.id);
      if (elementData && this.currentModel) {
        // Use FragmentsModel's setVisible method for IFC elements
        const visible = node.visible !== false;
        try {
          await this.currentModel.setVisible([elementData.expressID], visible);
        } catch (error) {
          logger.warn('ObjectTreePanel', `Failed to set visibility for element ${elementData.expressID}`, error);
        }
      }

      // If node has children, apply visibility recursively
      if (node.children) {
        await this.setChildrenVisibility(node.children, node.visible !== false);
      }
    });

    // Node context menu
    this.treeView.setOnNodeContextMenu((node, event) => {
      logger.debug('ObjectTreePanel', `Context menu for: ${node.label}`);
      this.showContextMenu(node, event);
    });
  }

  private async setChildrenVisibility(children: TreeNode[], visible: boolean): Promise<void> {
    for (const child of children) {
      child.visible = visible;
      const elementData = this.elementMap.get(child.id);
      if (elementData && this.currentModel) {
        // Use FragmentsModel's setVisible method for IFC elements
        try {
          await this.currentModel.setVisible([elementData.expressID], visible);
        } catch (error) {
          logger.warn('ObjectTreePanel', `Failed to set visibility for element ${elementData.expressID}`, error);
        }
      }

      if (child.children) {
        await this.setChildrenVisibility(child.children, visible);
      }
    }
  }

  private showContextMenu(node: TreeNode, event: MouseEvent): void {
    const elementData = this.elementMap.get(node.id);
    const isElement = elementData != null;

    const menuItems = [
      {
        label: 'Focus',
        icon: '🎯',
        action: () => {
          logger.info('ObjectTreePanel', `Focus: ${node.label}`);
          eventBus.emit(Events.CAMERA_FOCUS, { node, elementData });
        },
        disabled: !isElement,
      },
      {
        label: 'Isolate',
        icon: '🔍',
        action: () => {
          logger.info('ObjectTreePanel', `Isolate: ${node.label}`);
          eventBus.emit(Events.ISOLATE_OBJECTS, { node, elementData });
        },
        disabled: !isElement,
      },
      {
        label: node.visible !== false ? 'Hide' : 'Show',
        icon: node.visible !== false ? '👁️' : '👁️‍🗨️',
        action: async () => {
          node.visible = !node.visible;
          if (elementData && this.currentModel) {
            try {
              await this.currentModel.setVisible([elementData.expressID], node.visible);
            } catch (error) {
              logger.warn('ObjectTreePanel', `Failed to set visibility for element ${elementData.expressID}`, error);
            }
          }
          if (node.children) {
            await this.setChildrenVisibility(node.children, node.visible);
          }
          this.treeView.setNodes(this.allNodes);
        },
      },
      {
        label: '',
        separator: true,
        action: () => {},
      },
      {
        label: 'Copy Name',
        icon: '📋',
        action: () => {
          navigator.clipboard.writeText(node.label);
          logger.info('ObjectTreePanel', `Copied name: ${node.label}`);
        },
      },
      {
        label: 'Copy ID',
        icon: '📋',
        action: () => {
          navigator.clipboard.writeText(node.id);
          logger.info('ObjectTreePanel', `Copied ID: ${node.id}`);
        },
      },
    ];

    this.contextMenu.show(event.clientX, event.clientY, menuItems);
  }

  private setupEventListeners(): void {
    eventBus.on(Events.MODEL_LOADED, async (data: any) => {
      await this.onModelLoaded(data);
    });

    eventBus.on(Events.MODEL_UNLOADED, () => {
      this.clearTree();
    });

    eventBus.on(Events.OBJECT_SELECTED, (data: any) => {
      // Don't respond to our own selection events
      if (data.source === 'tree') return;

      // Select the node in the tree
      if (data.expressID !== undefined) {
        const nodeId = `element-${data.expressID}`;
        const success = this.treeView.selectNode(nodeId);

        if (success) {
          logger.debug('ObjectTreePanel', `Selected node in tree: ${nodeId}`);
          // Scroll to the selected node
          this.scrollToNode(nodeId);
        } else {
          logger.warn('ObjectTreePanel', `Node not found in tree: ${nodeId}`);
        }
      }
    });
  }

  private async onModelLoaded(data: any): Promise<void> {
    logger.debug('ObjectTreePanel', 'Model loaded, building tree:', data);

    if (!data || !data.model) {
      logger.warn('ObjectTreePanel', 'Model data missing');
      return;
    }

    this.currentModel = data.model;
    this.elementMap.clear();

    // Build tree from spatial structure
    await this.buildTree(data.model);
  }

  private async buildTree(model: FRAGS.FragmentsModel): Promise<void> {
    try {
      const spatialStructure = await IFCPropertyParser.getSpatialStructure(model);

      const rootNodes: TreeNode[] = [];

      // Try to build spatial hierarchy if available
      if (spatialStructure && spatialStructure.project) {
        const projectData = Object.values(spatialStructure.project)[0] as any;
        const projectNode: TreeNode = {
          id: 'project',
          label: (projectData?.Name?.value || projectData?.name) || 'Project',
          icon: '🏗️',
          expanded: true,
          visible: true,
          selectable: false,
          children: [],
        };

        // Add sites
        if (spatialStructure.sites && spatialStructure.sites.length > 0) {
          for (const site of spatialStructure.sites) {
            const siteNode = await this.createSpatialNode(site, 'Site', '🌍', model);
            projectNode.children?.push(siteNode);
          }
        }

        // Add buildings
        if (spatialStructure.buildings && spatialStructure.buildings.length > 0) {
          for (const building of spatialStructure.buildings) {
            const buildingNode = await this.createSpatialNode(
              building,
              'Building',
              '🏢',
              model,
              spatialStructure
            );
            projectNode.children?.push(buildingNode);
          }
        }

        rootNodes.push(projectNode);
      }

      // Always add an "All Elements" node that lists all elements grouped by type
      const elementsNode = await this.createAllElementsNode(model);
      if (elementsNode) {
        rootNodes.push(elementsNode);
      }

      // Store all nodes for filtering
      this.allNodes = rootNodes;

      // Update type filter options
      this.updateTypeFilterOptions();

      this.treeView.setNodes(rootNodes);
      logger.info('ObjectTreePanel', 'Tree built successfully');
    } catch (error) {
      logger.error('ObjectTreePanel', 'Failed to build tree', error);
    }
  }

  private async createAllElementsNode(model: FRAGS.FragmentsModel): Promise<TreeNode | null> {
    try {
      // Get all elements grouped by type
      const elementsByType = await IFCPropertyParser.getElementsGroupedByType(model);

      if (Object.keys(elementsByType).length === 0) {
        logger.debug('ObjectTreePanel', 'No elements found in model');
        return null;
      }

      const totalElements = Object.values(elementsByType).reduce((sum, arr) => sum + arr.length, 0);

      const elementsNode: TreeNode = {
        id: 'all-elements',
        label: `All Elements (${totalElements})`,
        icon: '📦',
        expanded: true,
        visible: true,
        selectable: false,
        children: [],
      };

      // Define icons for common IFC element types
      const elementTypeConfig: { [key: string]: { icon: string; label: string } } = {
        IFCWALL: { icon: '🧱', label: 'Walls' },
        IFCWALLSTANDARDCASE: { icon: '🧱', label: 'Walls' },
        IFCDOOR: { icon: '🚪', label: 'Doors' },
        IFCWINDOW: { icon: '🪟', label: 'Windows' },
        IFCSLAB: { icon: '⬜', label: 'Slabs' },
        IFCBEAM: { icon: '━', label: 'Beams' },
        IFCCOLUMN: { icon: '┃', label: 'Columns' },
        IFCFURNISHINGELEMENT: { icon: '🪑', label: 'Furniture' },
        IFCSTAIR: { icon: '🪜', label: 'Stairs' },
        IFCROOF: { icon: '🏠', label: 'Roofs' },
        IFCRAILING: { icon: '🛡️', label: 'Railings' },
        IFCPLATE: { icon: '📄', label: 'Plates' },
        IFCMEMBER: { icon: '🔩', label: 'Members' },
        IFCCURTAINWALL: { icon: '🪟', label: 'Curtain Walls' },
      };

      // Get element data in batch
      const allElementIds = Object.values(elementsByType).flat();
      const elementsData = await model.getItemsData(allElementIds);

      // Create a map for quick lookup
      const elementDataMap = new Map();
      for (const data of elementsData) {
        elementDataMap.set((data as any).expressID, data);
      }

      // Sort types alphabetically for better UX
      const sortedTypes = Object.keys(elementsByType).sort();

      // Group elements by type with category nodes
      for (const ifcType of sortedTypes) {
        const elementIds = elementsByType[ifcType];
        if (elementIds.length === 0) continue;

        // Track available types for filter dropdown
        this.availableTypes.add(ifcType);

        const config = elementTypeConfig[ifcType] || { icon: '📦', label: ifcType };

        // Create a category node for this type
        const categoryNode: TreeNode = {
          id: `category-${ifcType}`,
          label: `${config.label} (${elementIds.length})`,
          icon: config.icon,
          expanded: false,
          visible: true,
          selectable: false,
          data: { type: ifcType },
          children: [],
        };

        // Add individual elements under the category
        for (const expressID of elementIds) {
          const elementData = elementDataMap.get(expressID);
          if (elementData) {
            const elementNode = this.createElementNode(elementData, config.icon);
            categoryNode.children?.push(elementNode);
          }
        }

        elementsNode.children?.push(categoryNode);
      }

      logger.info('ObjectTreePanel', `Created All Elements node with ${totalElements} elements across ${sortedTypes.length} types`);
      return elementsNode;
    } catch (error) {
      logger.error('ObjectTreePanel', 'Failed to create All Elements node', error);
      return null;
    }
  }

  private async createSpatialNode(
    spatialData: any,
    typeName: string,
    icon: string,
    model: FRAGS.FragmentsModel,
    spatialStructure?: any
  ): Promise<TreeNode> {
    const expressID = spatialData.expressID || Object.keys(spatialData)[0];
    const name = spatialData.Name?.value || spatialData.name || `${typeName}`;

    const node: TreeNode = {
      id: `${typeName.toLowerCase()}-${expressID}`,
      label: name,
      icon: icon,
      expanded: true,
      visible: true,
      selectable: true,
      data: { expressID, type: typeName },
      children: [],
    };

    // Store in element map
    this.elementMap.set(node.id, { expressID });

    // If this is a building, add storeys from the spatial structure
    if (typeName === 'Building' && spatialStructure && spatialStructure.storeys) {
      for (const storey of spatialStructure.storeys) {
        const storeyNode = await this.createStoreyNode(storey as any, model);
        node.children?.push(storeyNode);
      }
    }

    return node;
  }

  private async createStoreyNode(
    storeyData: any,
    model: FRAGS.FragmentsModel
  ): Promise<TreeNode> {
    const expressID = storeyData.expressID;
    const name = storeyData.Name?.value || storeyData.name || 'Storey';

    const node: TreeNode = {
      id: `storey-${expressID}`,
      label: name,
      icon: '📐',
      expanded: false,
      visible: true,
      selectable: true,
      data: { expressID, type: 'Storey' },
      children: [],
    };

    // Store in element map
    this.elementMap.set(node.id, { expressID });

    // Add elements in this storey
    await this.addStoreyElements(node, model);

    return node;
  }

  private async addStoreyElements(storeyNode: TreeNode, model: FRAGS.FragmentsModel): Promise<void> {
    try {
      // Get all elements grouped by type
      const elementsByType = await IFCPropertyParser.getElementsGroupedByType(model);

      if (Object.keys(elementsByType).length === 0) {
        logger.debug('ObjectTreePanel', 'No elements found in model');
        return;
      }

      // Define icons for common IFC element types
      const elementTypeConfig: { [key: string]: { icon: string; label: string } } = {
        IFCWALL: { icon: '🧱', label: 'Walls' },
        IFCWALLSTANDARDCASE: { icon: '🧱', label: 'Walls' },
        IFCDOOR: { icon: '🚪', label: 'Doors' },
        IFCWINDOW: { icon: '🪟', label: 'Windows' },
        IFCSLAB: { icon: '⬜', label: 'Slabs' },
        IFCBEAM: { icon: '━', label: 'Beams' },
        IFCCOLUMN: { icon: '┃', label: 'Columns' },
        IFCFURNISHINGELEMENT: { icon: '🪑', label: 'Furniture' },
        IFCSTAIR: { icon: '🪜', label: 'Stairs' },
        IFCROOF: { icon: '🏠', label: 'Roofs' },
        IFCRAILING: { icon: '🛡️', label: 'Railings' },
        IFCPLATE: { icon: '📄', label: 'Plates' },
        IFCMEMBER: { icon: '🔩', label: 'Members' },
        IFCCURTAINWALL: { icon: '🪟', label: 'Curtain Walls' },
      };

      // Get element data in batch
      const allElementIds = Object.values(elementsByType).flat();
      const elementsData = await model.getItemsData(allElementIds);

      // Create a map for quick lookup
      const elementDataMap = new Map();
      for (const data of elementsData) {
        elementDataMap.set((data as any).expressID, data);
      }

      // Group elements by type with category nodes
      for (const [ifcType, elementIds] of Object.entries(elementsByType)) {
        if (elementIds.length === 0) continue;

        const config = elementTypeConfig[ifcType] || { icon: '📦', label: ifcType };

        // Create a category node for this type
        const categoryNode: TreeNode = {
          id: `${storeyNode.id}-${ifcType}`,
          label: `${config.label} (${elementIds.length})`,
          icon: config.icon,
          expanded: false,
          visible: true,
          selectable: false,
          children: [],
        };

        // Add individual elements under the category
        for (const expressID of elementIds) {
          const elementData = elementDataMap.get(expressID);
          if (elementData) {
            const elementNode = this.createElementNode(elementData, config.icon);
            categoryNode.children?.push(elementNode);
          }
        }

        storeyNode.children?.push(categoryNode);
      }

      logger.info('ObjectTreePanel', `Added ${allElementIds.length} elements across ${Object.keys(elementsByType).length} types to storey`);
    } catch (error) {
      logger.error('ObjectTreePanel', 'Failed to add storey elements', error);
    }
  }

  private createElementNode(elementData: any, icon: string): TreeNode {
    const expressID = elementData.expressID || Object.keys(elementData)[0];
    const name = elementData.Name?.value || elementData.name || `Element ${expressID}`;

    const node: TreeNode = {
      id: `element-${expressID}`,
      label: name,
      icon: icon,
      visible: true,
      selectable: true,
      data: { expressID, element: elementData },
    };

    // Store in element map
    // Note: We don't store object reference here because FragmentsModel doesn't provide
    // a direct way to get Object3D by expressID. Instead, we rely on model + expressID
    // for selection, and the Highlighter uses model.raycast or fragment iteration.
    this.elementMap.set(node.id, { expressID });

    return node;
  }

  private scrollToNode(nodeId: string): void {
    // Find the node element in the DOM and scroll to it
    const treeElement = this.treeView.getElement();
    const nodeElement = treeElement.querySelector(`[data-node-id="${nodeId}"]`);

    if (nodeElement) {
      nodeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }

  private applyFilters(): void {
    if (!this.searchInput || !this.typeFilter) return;

    const searchTerm = this.searchInput.value.toLowerCase().trim();
    const selectedType = this.typeFilter.value;

    // Update search term highlighting
    this.treeView.setSearchTerm(searchTerm);

    // If no filters, show all nodes
    if (!searchTerm && !selectedType) {
      this.treeView.setNodes(this.allNodes);
      return;
    }

    // Apply filters
    const filteredNodes = this.filterNodes(this.allNodes, searchTerm, selectedType);
    this.treeView.setNodes(filteredNodes);

    logger.debug('ObjectTreePanel', `Applied filters - search: "${searchTerm}", type: "${selectedType}"`);
  }

  private filterNodes(nodes: TreeNode[], searchTerm: string, typeFilter: string): TreeNode[] {
    const filtered: TreeNode[] = [];

    for (const node of nodes) {
      const nodeCopy = { ...node };
      let includeNode = false;

      // Check if node matches search term
      const matchesSearch = !searchTerm || node.label.toLowerCase().includes(searchTerm);

      // Check if node matches type filter (for category nodes or element nodes)
      const nodeType = node.data?.type || (node.id.startsWith('category-') ? node.id.replace('category-', '') : '');
      const matchesType = !typeFilter || nodeType === typeFilter;

      // If node has children, recursively filter them
      if (node.children && node.children.length > 0) {
        const filteredChildren = this.filterNodes(node.children, searchTerm, typeFilter);

        if (filteredChildren.length > 0) {
          nodeCopy.children = filteredChildren;
          nodeCopy.expanded = true; // Auto-expand nodes with matching children
          includeNode = true;
        }
      }

      // Include node if it matches filters or has matching children
      if (matchesSearch && matchesType) {
        includeNode = true;
      }

      if (includeNode) {
        filtered.push(nodeCopy);
      }
    }

    return filtered;
  }

  private clearFilters(): void {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    if (this.typeFilter) {
      this.typeFilter.value = '';
    }
    this.applyFilters();
    logger.debug('ObjectTreePanel', 'Filters cleared');
  }

  private updateTypeFilterOptions(): void {
    if (!this.typeFilter) return;

    // Clear existing options except "All Types"
    while (this.typeFilter.options.length > 1) {
      this.typeFilter.remove(1);
    }

    // Add options for each available type
    const sortedTypes = Array.from(this.availableTypes).sort();
    for (const type of sortedTypes) {
      const option = document.createElement('option');
      option.value = type;

      // Convert IFC type to readable label
      const typeMap: { [key: string]: string } = {
        IFCWALL: 'Walls',
        IFCWALLSTANDARDCASE: 'Walls',
        IFCDOOR: 'Doors',
        IFCWINDOW: 'Windows',
        IFCSLAB: 'Slabs',
        IFCBEAM: 'Beams',
        IFCCOLUMN: 'Columns',
        IFCFURNISHINGELEMENT: 'Furniture',
        IFCSTAIR: 'Stairs',
        IFCROOF: 'Roofs',
        IFCRAILING: 'Railings',
        IFCPLATE: 'Plates',
        IFCMEMBER: 'Members',
        IFCCURTAINWALL: 'Curtain Walls',
      };

      option.textContent = typeMap[type] || type;
      this.typeFilter.appendChild(option);
    }

    logger.debug('ObjectTreePanel', `Updated type filter with ${sortedTypes.length} types`);
  }

  private clearTree(): void {
    this.treeView.clear();
    this.currentModel = null;
    this.elementMap.clear();
    this.allNodes = [];
    this.availableTypes.clear();
    logger.debug('ObjectTreePanel', 'Tree cleared');
  }
}
