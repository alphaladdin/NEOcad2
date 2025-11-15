/**
 * StructuralOptionsPanel - Interactive panel for selecting structural options
 * Similar to interactive floor plan functionality for material/structural choices
 */

import { Wall } from '../cad/entities/Wall';
import { WallTypeManager } from '../framing/WallTypeManager';

export interface StructuralOption {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  available: boolean;
}

export interface OptionCategory {
  name: string;
  options: StructuralOption[];
}

export class StructuralOptionsPanel {
  private container: HTMLElement;
  private selectedWall: Wall | null = null;
  private onWallTypeChange?: (wall: Wall, newTypeId: string) => void;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = container;
    this.setupPanel();
  }

  private setupPanel(): void {
    this.container.className = 'structural-options-panel';
    this.container.innerHTML = `
      <div class="panel-header">
        <h3>Structural Options</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="panel-content">
        <p class="panel-hint">Select a wall to view structural options</p>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Wire up close button
    const closeBtn = this.container.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  private addStyles(): void {
    if (document.getElementById('structural-options-styles')) return;

    const style = document.createElement('style');
    style.id = 'structural-options-styles';
    style.textContent = `
      .structural-options-panel {
        position: fixed;
        right: 20px;
        top: 20px;
        width: 350px;
        max-height: 80vh;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: none;
        flex-direction: column;
        z-index: 1000;
      }

      .structural-options-panel.visible {
        display: flex;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .panel-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .panel-content {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .panel-hint {
        color: #666;
        font-size: 14px;
        text-align: center;
        margin: 40px 0;
      }

      .option-category {
        margin-bottom: 24px;
      }

      .category-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .option-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .option-item {
        border: 2px solid #e0e0e0;
        border-radius: 6px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: #fff;
      }

      .option-item:hover {
        border-color: #667eea;
        background: #f8f9ff;
      }

      .option-item.selected {
        border-color: #667eea;
        background: #f0f3ff;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
      }

      .option-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .option-name {
        font-weight: 600;
        color: #333;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .option-description {
        font-size: 12px;
        color: #666;
        line-height: 1.4;
      }

      .option-thumbnail {
        width: 100%;
        height: 80px;
        background: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #999;
      }

      .selected-wall-info {
        background: #f8f9ff;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 20px;
      }

      .selected-wall-info h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #667eea;
      }

      .selected-wall-info p {
        margin: 4px 0;
        font-size: 13px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show options for a selected wall
   */
  showWallOptions(wall: Wall): void {
    this.selectedWall = wall;
    this.show();

    const wallType = wall.getWallType();
    const wallTypeManager = WallTypeManager.getInstance();
    const allWallTypes = wallTypeManager.getAllWallTypes();

    // Build wall info
    const wallInfo = `
      <div class="selected-wall-info">
        <h4>Selected Wall</h4>
        <p><strong>Current Type:</strong> ${wallType.name}</p>
        <p><strong>Length:</strong> ${wall.getLength().toFixed(2)} ft</p>
        <p><strong>Thickness:</strong> ${wallType.actualThickness}" (${wallType.nominalThickness})</p>
      </div>
    `;

    // Build wall type options
    const wallTypeOptions = allWallTypes.map(wt => {
      const isSelected = wt.id === wallType.id;
      return `
        <div class="option-item ${isSelected ? 'selected' : ''}" data-wall-type-id="${wt.id}">
          <div class="option-name">${wt.name}</div>
          <div class="option-description">
            ${wt.nominalThickness} (${wt.actualThickness}" actual)<br>
            Height: ${wt.height}' - ${wt.stud.spacing}" OC
          </div>
        </div>
      `;
    }).join('');

    const content = `
      ${wallInfo}
      <div class="option-category">
        <div class="category-title">Wall Type</div>
        <div class="option-grid">
          ${wallTypeOptions}
        </div>
      </div>
    `;

    const panelContent = this.container.querySelector('.panel-content');
    if (panelContent) {
      panelContent.innerHTML = content;

      // Wire up click handlers
      const optionItems = panelContent.querySelectorAll('.option-item');
      optionItems.forEach(item => {
        item.addEventListener('click', () => {
          const wallTypeId = (item as HTMLElement).dataset.wallTypeId;
          if (wallTypeId && this.selectedWall) {
            this.selectWallType(wallTypeId);
          }
        });
      });
    }
  }

  private selectWallType(wallTypeId: string): void {
    if (!this.selectedWall) return;

    // Update the wall type
    this.selectedWall.setWallType(wallTypeId);

    // Notify callback
    if (this.onWallTypeChange) {
      this.onWallTypeChange(this.selectedWall, wallTypeId);
    }

    // Refresh the panel to show updated selection
    this.showWallOptions(this.selectedWall);
  }

  /**
   * Set callback for when wall type changes
   */
  onWallTypeChanged(callback: (wall: Wall, newTypeId: string) => void): void {
    this.onWallTypeChange = callback;
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.classList.add('visible');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.classList.remove('visible');
    this.selectedWall = null;
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.container.classList.contains('visible');
  }
}
