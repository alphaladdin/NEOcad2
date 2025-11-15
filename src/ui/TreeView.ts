/**
 * TreeView - Hierarchical tree view component
 */

import { logger } from '@utils/Logger';

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  data?: any;
  children?: TreeNode[];
  expanded?: boolean;
  visible?: boolean;
  selectable?: boolean;
}

export interface TreeViewConfig {
  showCheckboxes?: boolean;
  showIcons?: boolean;
  multiSelect?: boolean;
  draggable?: boolean;
  searchTerm?: string;
}

export type TreeNodeCallback = (node: TreeNode, event: MouseEvent) => void;

export class TreeView {
  private container: HTMLElement;
  private config: TreeViewConfig;
  private nodes: TreeNode[] = [];
  private selectedNodes: Set<string> = new Set();
  private lastSelectedNode: string | null = null;

  // Callbacks
  private onNodeClick?: TreeNodeCallback;
  private onNodeDoubleClick?: TreeNodeCallback;
  private onNodeVisibilityToggle?: TreeNodeCallback;
  private onNodeContextMenu?: TreeNodeCallback;

  constructor(config: TreeViewConfig = {}) {
    this.config = {
      showCheckboxes: true,
      showIcons: true,
      multiSelect: false,
      draggable: false,
      ...config,
    };

    this.container = this.createContainer();
    logger.debug('TreeView', 'TreeView created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tree-view';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      font-size: var(--font-size-sm);
    `;
    return container;
  }

  /**
   * Set tree data
   */
  setNodes(nodes: TreeNode[]): void {
    this.nodes = nodes;
    this.render();
  }

  /**
   * Get tree data
   */
  getNodes(): TreeNode[] {
    return this.nodes;
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes = [];
    this.selectedNodes.clear();
    this.render();
  }

  /**
   * Set node click callback
   */
  setOnNodeClick(callback: TreeNodeCallback): void {
    this.onNodeClick = callback;
  }

  /**
   * Set node double click callback
   */
  setOnNodeDoubleClick(callback: TreeNodeCallback): void {
    this.onNodeDoubleClick = callback;
  }

  /**
   * Set node visibility toggle callback
   */
  setOnNodeVisibilityToggle(callback: TreeNodeCallback): void {
    this.onNodeVisibilityToggle = callback;
  }

  /**
   * Set node context menu callback
   */
  setOnNodeContextMenu(callback: TreeNodeCallback): void {
    this.onNodeContextMenu = callback;
  }

  /**
   * Get selected node IDs
   */
  getSelectedNodes(): string[] {
    return Array.from(this.selectedNodes);
  }

  /**
   * Select a node
   */
  selectNode(nodeId: string, multiSelect: boolean = false): boolean {
    // Check if node exists
    const nodeExists = this.findNodeById(this.nodes, nodeId) !== null;

    if (!nodeExists) {
      return false;
    }

    if (!multiSelect) {
      this.selectedNodes.clear();
    }
    this.selectedNodes.add(nodeId);

    // Expand parent nodes to make selection visible
    this.expandParentsOfNode(nodeId);

    this.render();
    return true;
  }

  /**
   * Deselect a node
   */
  deselectNode(nodeId: string): void {
    this.selectedNodes.delete(nodeId);
    this.render();
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedNodes.clear();
    this.render();
  }

  /**
   * Set search term for highlighting
   */
  setSearchTerm(searchTerm: string): void {
    this.config.searchTerm = searchTerm;
    this.render();
  }

  /**
   * Expand a node
   */
  expandNode(nodeId: string): void {
    const node = this.findNode(nodeId, this.nodes);
    if (node) {
      node.expanded = true;
      this.render();
    }
  }

  /**
   * Collapse a node
   */
  collapseNode(nodeId: string): void {
    const node = this.findNode(nodeId, this.nodes);
    if (node) {
      node.expanded = false;
      this.render();
    }
  }

  /**
   * Toggle node expansion
   */
  toggleNode(nodeId: string): void {
    const node = this.findNode(nodeId, this.nodes);
    if (node) {
      node.expanded = !node.expanded;
      this.render();
    }
  }

  /**
   * Expand all nodes recursively
   */
  expandAll(): void {
    this.setAllNodesExpanded(this.nodes, true);
    this.render();
  }

  /**
   * Collapse all nodes recursively
   */
  collapseAll(): void {
    this.setAllNodesExpanded(this.nodes, false);
    this.render();
  }

  /**
   * Recursively set expanded state for all nodes
   */
  private setAllNodesExpanded(nodes: TreeNode[], expanded: boolean): void {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        node.expanded = expanded;
        this.setAllNodesExpanded(node.children, expanded);
      }
    }
  }

  /**
   * Find a node by ID
   */
  private findNode(nodeId: string, nodes: TreeNode[]): TreeNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.children) {
        const found = this.findNode(nodeId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get all selectable node IDs in tree order (for range selection)
   */
  private getAllSelectableNodeIds(nodes: TreeNode[] = this.nodes): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      if (node.selectable !== false) {
        ids.push(node.id);
      }
      if (node.children && node.expanded) {
        ids.push(...this.getAllSelectableNodeIds(node.children));
      }
    }
    return ids;
  }

  /**
   * Select a range of nodes between two node IDs
   */
  private selectRange(startId: string, endId: string): void {
    const allIds = this.getAllSelectableNodeIds();
    const startIndex = allIds.indexOf(startId);
    const endIndex = allIds.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;

    const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    for (let i = start; i <= end; i++) {
      this.selectedNodes.add(allIds[i]);
    }
  }

  /**
   * Render tree
   */
  private render(): void {
    this.container.innerHTML = '';

    if (this.nodes.length === 0) {
      this.showEmptyState();
      return;
    }

    const tree = document.createElement('div');
    tree.className = 'tree-nodes';

    this.nodes.forEach((node) => {
      const nodeEl = this.createNodeElement(node, 0);
      tree.appendChild(nodeEl);
    });

    this.container.appendChild(tree);
  }

  /**
   * Create node element
   */
  private createNodeElement(node: TreeNode, depth: number): HTMLElement {
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = 'tree-node-wrapper';
    nodeWrapper.setAttribute('data-node-id', node.id);

    // Node row
    const nodeRow = document.createElement('div');
    nodeRow.className = 'tree-node-row';
    nodeRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      padding-left: ${8 + depth * 16}px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease;
      ${this.selectedNodes.has(node.id) ? 'background: var(--color-primary); color: var(--color-bg);' : ''}
    `;

    // Expand/collapse button
    if (node.children && node.children.length > 0) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'tree-node-expand';
      expandBtn.style.cssText = `
        width: 16px;
        height: 16px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: currentColor;
        transition: transform 0.2s ease;
        ${node.expanded ? 'transform: rotate(90deg);' : ''}
      `;
      expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;

      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNode(node.id);
      });

      nodeRow.appendChild(expandBtn);
    } else {
      // Spacer for nodes without children
      const spacer = document.createElement('div');
      spacer.style.cssText = 'width: 16px; height: 16px;';
      nodeRow.appendChild(spacer);
    }

    // Visibility checkbox
    if (this.config.showCheckboxes) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = node.visible !== false;
      checkbox.style.cssText = `
        width: 14px;
        height: 14px;
        cursor: pointer;
      `;

      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      checkbox.addEventListener('change', (e) => {
        node.visible = checkbox.checked;
        if (this.onNodeVisibilityToggle) {
          this.onNodeVisibilityToggle(node, e as any);
        }
      });

      nodeRow.appendChild(checkbox);
    }

    // Icon
    if (this.config.showIcons && node.icon) {
      const icon = document.createElement('span');
      icon.textContent = node.icon;
      icon.style.cssText = `
        font-size: 14px;
        line-height: 1;
      `;
      nodeRow.appendChild(icon);
    }

    // Label (with search highlighting)
    const label = document.createElement('span');
    label.className = 'tree-node-label';
    label.style.cssText = `
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--font-size-sm);
    `;

    // Apply search highlighting if search term exists
    if (this.config.searchTerm && this.config.searchTerm.length > 0) {
      const searchTerm = this.config.searchTerm.toLowerCase();
      const labelText = node.label;
      const lowerLabel = labelText.toLowerCase();
      const index = lowerLabel.indexOf(searchTerm);

      if (index !== -1) {
        // Create highlighted label
        const before = labelText.substring(0, index);
        const match = labelText.substring(index, index + searchTerm.length);
        const after = labelText.substring(index + searchTerm.length);

        label.innerHTML = `${this.escapeHtml(before)}<mark style="background: #ffd700; color: #000; padding: 1px 2px; border-radius: 2px;">${this.escapeHtml(match)}</mark>${this.escapeHtml(after)}`;
      } else {
        label.textContent = labelText;
      }
    } else {
      label.textContent = node.label;
    }

    nodeRow.appendChild(label);

    // Click handlers
    nodeRow.addEventListener('click', (e) => {
      if (node.selectable !== false) {
        const isCtrlKey = e.ctrlKey || e.metaKey;
        const isShiftKey = e.shiftKey;

        if (this.config.multiSelect && isShiftKey && this.lastSelectedNode) {
          // Shift+Click: Select range
          this.selectRange(this.lastSelectedNode, node.id);
        } else if (this.config.multiSelect && isCtrlKey) {
          // Ctrl+Click: Toggle individual selection
          if (this.selectedNodes.has(node.id)) {
            this.selectedNodes.delete(node.id);
          } else {
            this.selectedNodes.add(node.id);
          }
        } else {
          // Regular click: Select only this node
          this.selectedNodes.clear();
          this.selectedNodes.add(node.id);
        }

        this.lastSelectedNode = node.id;
        this.render();

        if (this.onNodeClick) {
          this.onNodeClick(node, e);
        }
      }
    });

    nodeRow.addEventListener('dblclick', (e) => {
      if (this.onNodeDoubleClick) {
        this.onNodeDoubleClick(node, e);
      }
    });

    nodeRow.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.onNodeContextMenu) {
        this.onNodeContextMenu(node, e);
      }
    });

    // Hover effect
    nodeRow.addEventListener('mouseenter', () => {
      if (!this.selectedNodes.has(node.id)) {
        nodeRow.style.background = 'var(--color-surface-3)';
      }
    });

    nodeRow.addEventListener('mouseleave', () => {
      if (!this.selectedNodes.has(node.id)) {
        nodeRow.style.background = 'transparent';
      }
    });

    nodeWrapper.appendChild(nodeRow);

    // Children
    if (node.children && node.expanded) {
      node.children.forEach((child) => {
        const childEl = this.createNodeElement(child, depth + 1);
        nodeWrapper.appendChild(childEl);
      });
    }

    return nodeWrapper;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Find a node by ID in the tree
   */
  private findNodeById(nodes: TreeNode[], nodeId: string): TreeNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeById(node.children, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Expand all parent nodes of a given node
   */
  private expandParentsOfNode(nodeId: string): void {
    this.expandParentsRecursive(this.nodes, nodeId);
  }

  /**
   * Recursively expand parents of a node
   */
  private expandParentsRecursive(nodes: TreeNode[], targetId: string): boolean {
    for (const node of nodes) {
      if (node.id === targetId) {
        return true;
      }
      if (node.children) {
        const found = this.expandParentsRecursive(node.children, targetId);
        if (found) {
          node.expanded = true;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Show empty state
   */
  private showEmptyState(): void {
    this.container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        text-align: center;
        color: var(--color-text-secondary);
      ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p style="margin: 0 0 4px 0; font-weight: 500; color: var(--color-text-primary);">No Data</p>
        <span style="font-size: var(--font-size-sm);">Tree is empty</span>
      </div>
    `;
  }

  /**
   * Get container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Dispose tree view
   */
  dispose(): void {
    this.container.innerHTML = '';
    this.nodes = [];
    this.selectedNodes.clear();
    logger.debug('TreeView', 'TreeView disposed');
  }
}
