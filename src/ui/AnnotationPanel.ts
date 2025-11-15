/**
 * AnnotationPanel - UI for managing annotations
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';
import { AnnotationManager } from '@managers/AnnotationManager';
import { Annotation, AnnotationType, AnnotationStatus, AnnotationPriority } from '@tools/Annotation';

export class AnnotationPanel {
  private container: HTMLElement;
  private annotationManager: AnnotationManager | null = null;
  private annotationsList: HTMLElement;
  private statsContainer: HTMLElement;
  private createButton: HTMLButtonElement;

  constructor() {
    // Create DOM elements BEFORE calling createContainer()
    this.annotationsList = document.createElement('div');
    this.statsContainer = document.createElement('div');
    this.createButton = document.createElement('button');

    // Now create the container which uses the above elements
    this.container = this.createContainer();

    this.setupEventListeners();
    logger.debug('AnnotationPanel', 'AnnotationPanel created');
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel annotation-panel';
    container.style.cssText = `
      position: absolute;
      top: 80px;
      right: 20px;
      width: 360px;
      max-height: calc(100vh - 120px);
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Annotations';
    title.style.cssText = `
      margin: 0;
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = this.createContent();

    container.appendChild(header);
    container.appendChild(content);

    document.body.appendChild(container);
    return container;
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Create Button
    this.createButton.textContent = '+ New Annotation';
    this.createButton.style.cssText = `
      padding: 10px;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    `;
    this.createButton.onclick = () => this.onCreateAnnotation();

    // Stats Section
    this.statsContainer.style.cssText = `
      padding: 12px;
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      border: var(--border);
    `;

    // Annotations List
    const listSection = document.createElement('div');

    const listHeader = document.createElement('div');
    listHeader.textContent = 'All Annotations';
    listHeader.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    this.annotationsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    listSection.appendChild(listHeader);
    listSection.appendChild(this.annotationsList);

    content.appendChild(this.createButton);
    content.appendChild(this.statsContainer);
    content.appendChild(listSection);

    return content;
  }

  private setupEventListeners(): void {
    eventBus.on(Events.ANNOTATION_CREATED, () => {
      this.refreshAnnotations();
    });

    eventBus.on(Events.ANNOTATION_UPDATED, () => {
      this.refreshAnnotations();
    });

    eventBus.on(Events.ANNOTATION_REMOVED, () => {
      this.refreshAnnotations();
    });
  }

  private onCreateAnnotation(): void {
    if (!this.annotationManager) return;

    // Simple prompt-based annotation creation
    const title = prompt('Annotation title:');
    if (!title) return;

    const description = prompt('Annotation description:');
    if (!description) return;

    const typeInput = prompt('Type (note/issue/question/markup):', 'note');
    const type = (typeInput || 'note') as AnnotationType;

    // Create annotation at origin (in real app, would use clicked position)
    const position = new THREE.Vector3(0, 0, 0);
    this.annotationManager.createAnnotation(title, description, position, type);
  }

  private refreshAnnotations(): void {
    if (!this.annotationManager) return;

    // Update stats
    this.updateStats();

    // Refresh list
    this.annotationsList.innerHTML = '';
    const annotations = this.annotationManager.getAllAnnotations();

    if (annotations.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No annotations yet';
      empty.style.cssText = `
        padding: 16px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      `;
      this.annotationsList.appendChild(empty);
      return;
    }

    annotations.forEach((annotation) => {
      this.addAnnotationItem(annotation);
    });
  }

  private addAnnotationItem(annotation: Annotation): void {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px;
      background: var(--color-surface-2);
      border: var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--color-surface-3)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'var(--color-surface-2)';
    });

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 6px;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    const icon = document.createElement('span');
    icon.textContent = Annotation.getTypeIcon(annotation.type);
    icon.style.fontSize = '16px';

    const title = document.createElement('div');
    title.textContent = annotation.title;
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    `;

    titleRow.appendChild(icon);
    titleRow.appendChild(title);

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const focusBtn = document.createElement('button');
    focusBtn.textContent = '👁';
    focusBtn.title = 'Focus';
    focusBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
    `;
    focusBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.annotationManager) {
        this.annotationManager.focusAnnotation(annotation.id);
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--color-danger);
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete annotation "${annotation.title}"?`) && this.annotationManager) {
        this.annotationManager.removeAnnotation(annotation.id);
      }
    };

    actions.appendChild(focusBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(titleRow);
    header.appendChild(actions);

    // Description
    const desc = document.createElement('div');
    desc.textContent = annotation.description;
    desc.style.cssText = `
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // Metadata
    const metadata = document.createElement('div');
    metadata.style.cssText = `
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--font-size-xs);
    `;

    const statusBadge = this.createBadge(
      Annotation.getStatusLabel(annotation.status),
      Annotation.getStatusColor(annotation.status)
    );

    const priorityBadge = this.createBadge(
      Annotation.getPriorityLabel(annotation.priority),
      Annotation.getPriorityColor(annotation.priority)
    );

    const typeBadge = this.createBadge(
      Annotation.getTypeLabel(annotation.type),
      Annotation.getTypeColor(annotation.type)
    );

    metadata.appendChild(typeBadge);
    metadata.appendChild(statusBadge);
    metadata.appendChild(priorityBadge);

    item.appendChild(header);
    item.appendChild(desc);
    item.appendChild(metadata);

    // Click to edit
    item.onclick = () => this.editAnnotation(annotation);

    this.annotationsList.appendChild(item);
  }

  private createBadge(label: string, color: THREE.Color): HTMLElement {
    const badge = document.createElement('span');
    badge.textContent = label;
    badge.style.cssText = `
      padding: 2px 6px;
      background: rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.2);
      color: rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255});
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
    `;
    return badge;
  }

  private editAnnotation(annotation: Annotation): void {
    const newTitle = prompt('Title:', annotation.title);
    if (newTitle && newTitle !== annotation.title) {
      annotation.title = newTitle;
    }

    const newDesc = prompt('Description:', annotation.description);
    if (newDesc && newDesc !== annotation.description) {
      annotation.description = newDesc;
    }

    const statusInput = prompt(
      'Status (open/in-progress/resolved/closed):',
      annotation.status
    );
    if (statusInput) {
      annotation.status = statusInput as AnnotationStatus;
    }

    const priorityInput = prompt(
      'Priority (low/medium/high/critical):',
      annotation.priority
    );
    if (priorityInput) {
      annotation.priority = priorityInput as AnnotationPriority;
    }

    annotation.updatedAt = Date.now();

    if (this.annotationManager) {
      eventBus.emit(Events.ANNOTATION_UPDATED, { annotation });
    }
  }

  private updateStats(): void {
    if (!this.annotationManager) return;

    const stats = this.annotationManager.getStatistics();

    this.statsContainer.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Statistics';
    title.style.cssText = `
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: var(--font-size-xs);
    `;

    // Total
    const total = document.createElement('div');
    total.innerHTML = `<strong>Total:</strong> ${stats.total}`;
    grid.appendChild(total);

    // By type
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > 0) {
        const item = document.createElement('div');
        item.innerHTML = `<strong>${Annotation.getTypeLabel(type as AnnotationType)}:</strong> ${count}`;
        grid.appendChild(item);
      }
    });

    this.statsContainer.appendChild(title);
    this.statsContainer.appendChild(grid);
  }

  /**
   * Set the annotation manager
   */
  setAnnotationManager(manager: AnnotationManager): void {
    this.annotationManager = manager;
    this.refreshAnnotations();
    logger.debug('AnnotationPanel', 'AnnotationManager set');
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'flex';
    this.refreshAnnotations();
    logger.debug('AnnotationPanel', 'Panel shown');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
    logger.debug('AnnotationPanel', 'Panel hidden');
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  /**
   * Dispose the panel
   */
  dispose(): void {
    this.hide();
    document.body.removeChild(this.container);
    logger.debug('AnnotationPanel', 'Panel disposed');
  }
}
