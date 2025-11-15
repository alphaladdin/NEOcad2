import { Drawing } from '../document/Drawing';

/**
 * File format types
 */
export enum FileFormat {
  NEOCAD = 'neocad',
  DXF = 'dxf',
  SVG = 'svg',
  PDF = 'pdf',
  JSON = 'json',
}

/**
 * File operation result
 */
export interface FileResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * FileManager - Handle file I/O operations
 */
export class FileManager {
  /**
   * Save drawing to JSON string
   */
  static saveToJSON(drawing: Drawing): string {
    return JSON.stringify(drawing.toJSON(), null, 2);
  }

  /**
   * Load drawing from JSON string
   */
  static loadFromJSON(jsonString: string): Drawing {
    const data = JSON.parse(jsonString);
    return Drawing.fromJSON(data);
  }

  /**
   * Save drawing to file (browser environment)
   */
  static async saveToFile(
    drawing: Drawing,
    filename: string,
    format: FileFormat = FileFormat.NEOCAD
  ): Promise<FileResult> {
    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case FileFormat.NEOCAD:
        case FileFormat.JSON:
          content = this.saveToJSON(drawing);
          mimeType = 'application/json';
          extension = '.neocad';
          break;

        case FileFormat.DXF:
          // Will be implemented in DXF exporter
          return { success: false, error: 'DXF export not yet implemented' };

        case FileFormat.SVG:
          // Will be implemented in SVG exporter
          return { success: false, error: 'SVG export not yet implemented' };

        case FileFormat.PDF:
          // Will be implemented in PDF exporter
          return { success: false, error: 'PDF export not yet implemented' };

        default:
          return { success: false, error: `Unsupported format: ${format}` };
      }

      // Ensure filename has correct extension
      if (!filename.endsWith(extension)) {
        filename += extension;
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      drawing.clearModified();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Load drawing from file (browser environment)
   */
  static async loadFromFile(file: File): Promise<FileResult> {
    try {
      const text = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();

      let drawing: Drawing;

      switch (extension) {
        case 'neocad':
        case 'json':
          drawing = this.loadFromJSON(text);
          break;

        case 'dxf':
          // Will be implemented in DXF importer
          return { success: false, error: 'DXF import not yet implemented' };

        default:
          return { success: false, error: `Unsupported file format: ${extension}` };
      }

      return { success: true, data: drawing };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export drawing as data URL
   */
  static exportAsDataURL(drawing: Drawing, format: FileFormat = FileFormat.NEOCAD): string {
    const json = this.saveToJSON(drawing);
    return `data:application/json;base64,${btoa(json)}`;
  }

  /**
   * Import drawing from data URL
   */
  static importFromDataURL(dataURL: string): Drawing {
    const base64 = dataURL.split(',')[1];
    const json = atob(base64);
    return this.loadFromJSON(json);
  }

  /**
   * Save to local storage
   */
  static saveToLocalStorage(drawing: Drawing, key: string): FileResult {
    try {
      const json = this.saveToJSON(drawing);
      localStorage.setItem(key, json);
      drawing.clearModified();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Load from local storage
   */
  static loadFromLocalStorage(key: string): FileResult {
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        return { success: false, error: 'No drawing found with that key' };
      }

      const drawing = this.loadFromJSON(json);
      return { success: true, data: drawing };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all drawings in local storage
   */
  static listLocalStorageDrawings(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('neocad_drawing_')) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Delete drawing from local storage
   */
  static deleteFromLocalStorage(key: string): FileResult {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-save drawing
   */
  static autoSave(drawing: Drawing): FileResult {
    const key = `neocad_autosave_${drawing.getName()}`;
    return this.saveToLocalStorage(drawing, key);
  }

  /**
   * Restore from auto-save
   */
  static restoreAutoSave(drawingName: string): FileResult {
    const key = `neocad_autosave_${drawingName}`;
    return this.loadFromLocalStorage(key);
  }

  /**
   * Export drawing to clipboard
   */
  static async exportToClipboard(drawing: Drawing): Promise<FileResult> {
    try {
      const json = this.saveToJSON(drawing);
      await navigator.clipboard.writeText(json);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import drawing from clipboard
   */
  static async importFromClipboard(): Promise<FileResult> {
    try {
      const json = await navigator.clipboard.readText();
      const drawing = this.loadFromJSON(json);
      return { success: true, data: drawing };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate drawing file
   */
  static validateDrawing(jsonString: string): FileResult {
    try {
      const data = JSON.parse(jsonString);

      // Check required fields
      if (!data.properties) {
        return { success: false, error: 'Missing properties' };
      }

      if (!data.entities) {
        return { success: false, error: 'Missing entities' };
      }

      if (!data.version) {
        return { success: false, error: 'Missing version' };
      }

      // Check version compatibility
      const version = data.version.split('.')[0];
      if (version !== '1') {
        return {
          success: false,
          error: `Unsupported version: ${data.version}. Expected 1.x.x`,
        };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: `Invalid JSON: ${error.message}` };
    }
  }

  /**
   * Get file info without loading entire drawing
   */
  static getFileInfo(jsonString: string): any {
    try {
      const data = JSON.parse(jsonString);
      return {
        name: data.properties?.name || 'Unknown',
        author: data.properties?.author || 'Unknown',
        created: data.properties?.created || null,
        modified: data.properties?.modified || null,
        version: data.version || '1.0.0',
        entityCount: data.entities?.length || 0,
        layerCount: data.layers?.length || 0,
      };
    } catch (error) {
      return null;
    }
  }
}
