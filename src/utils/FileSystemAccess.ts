/**
 * FileSystemAccess - Modern file system access utilities
 *
 * Uses the File System Access API when available, with fallback to traditional methods
 */

import { logger } from './Logger';

/**
 * File type definition for file picker
 */
export interface FileTypeDefinition {
  description: string;
  accept: Record<string, string[]>;
}

/**
 * Options for saving a file
 */
export interface SaveFileOptions {
  suggestedName: string;
  types?: FileTypeDefinition[];
  excludeAcceptAllOption?: boolean;
}

/**
 * Options for opening a file
 */
export interface OpenFileOptions {
  types?: FileTypeDefinition[];
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
}

/**
 * File System Access API with fallback support
 */
export class FileSystemAccess {
  /**
   * Check if File System Access API is supported
   */
  static isSupported(): boolean {
    return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  }

  /**
   * Save file using File System Access API or fallback
   */
  static async saveFile(
    content: string | Blob,
    options: SaveFileOptions
  ): Promise<void> {
    try {
      if (this.isSupported()) {
        await this.saveFileModern(content, options);
      } else {
        this.saveFileFallback(content, options.suggestedName);
      }
      logger.info('FileSystemAccess', `File saved: ${options.suggestedName}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('FileSystemAccess', 'File save cancelled by user');
        throw error;
      }
      logger.error('FileSystemAccess', 'Failed to save file:', error);
      throw error;
    }
  }

  /**
   * Save file using modern File System Access API
   */
  private static async saveFileModern(
    content: string | Blob,
    options: SaveFileOptions
  ): Promise<void> {
    // @ts-ignore - File System Access API types
    const handle = await window.showSaveFilePicker({
      suggestedName: options.suggestedName,
      types: options.types || [],
      excludeAcceptAllOption: options.excludeAcceptAllOption || false,
    });

    const writable = await handle.createWritable();

    if (typeof content === 'string') {
      await writable.write(content);
    } else {
      await writable.write(content);
    }

    await writable.close();
  }

  /**
   * Save file using fallback download method
   */
  private static saveFileFallback(
    content: string | Blob,
    filename: string
  ): void {
    const blob = typeof content === 'string'
      ? new Blob([content], { type: 'application/json' })
      : content;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Open file(s) using File System Access API or fallback
   */
  static async openFile(options?: OpenFileOptions): Promise<File[]> {
    try {
      if (this.isSupported()) {
        return await this.openFileModern(options);
      } else {
        return await this.openFileFallback(options);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('FileSystemAccess', 'File open cancelled by user');
        throw error;
      }
      logger.error('FileSystemAccess', 'Failed to open file:', error);
      throw error;
    }
  }

  /**
   * Open file using modern File System Access API
   */
  private static async openFileModern(
    options?: OpenFileOptions
  ): Promise<File[]> {
    // @ts-ignore - File System Access API types
    const handles = await window.showOpenFilePicker({
      types: options?.types || [],
      multiple: options?.multiple || false,
      excludeAcceptAllOption: options?.excludeAcceptAllOption || false,
    });

    const files: File[] = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      files.push(file);
    }

    return files;
  }

  /**
   * Open file using fallback file input method
   */
  private static async openFileFallback(
    options?: OpenFileOptions
  ): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple || false;

      // Build accept attribute from types
      if (options?.types && options.types.length > 0) {
        const acceptValues: string[] = [];
        options.types.forEach(type => {
          Object.values(type.accept).forEach(extensions => {
            acceptValues.push(...extensions);
          });
        });
        input.accept = acceptValues.join(',');
      }

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(Array.from(input.files));
        } else {
          reject(new Error('No files selected'));
        }
        input.remove();
      };

      input.oncancel = () => {
        const error = new Error('File selection cancelled');
        error.name = 'AbortError';
        reject(error);
        input.remove();
      };

      input.click();
    });
  }

  /**
   * Save NEOcad project file
   */
  static async saveProjectFile(
    content: string,
    suggestedName: string = 'project.neocad'
  ): Promise<void> {
    return this.saveFile(content, {
      suggestedName,
      types: [
        {
          description: 'NEOcad Project',
          accept: { 'application/json': ['.neocad'] },
        },
      ],
    });
  }

  /**
   * Open NEOcad project file
   */
  static async openProjectFile(): Promise<File> {
    const files = await this.openFile({
      types: [
        {
          description: 'NEOcad Project',
          accept: { 'application/json': ['.neocad'] },
        },
      ],
      multiple: false,
    });

    if (files.length === 0) {
      throw new Error('No file selected');
    }

    return files[0];
  }

  /**
   * Read file as text
   */
  static async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Read file as array buffer
   */
  static async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read file as data URL
   */
  static async readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calculate SHA-256 hash of a file
   */
  static async calculateFileHash(file: File): Promise<string> {
    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      logger.error('FileSystemAccess', 'Failed to calculate file hash:', error);
      throw error;
    }
  }

  /**
   * Export data as CSV file
   */
  static async exportCSV(
    data: string,
    filename: string = 'export.csv'
  ): Promise<void> {
    return this.saveFile(data, {
      suggestedName: filename,
      types: [
        {
          description: 'CSV File',
          accept: { 'text/csv': ['.csv'] },
        },
      ],
    });
  }

  /**
   * Export data as JSON file
   */
  static async exportJSON(
    data: any,
    filename: string = 'export.json'
  ): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    return this.saveFile(json, {
      suggestedName: filename,
      types: [
        {
          description: 'JSON File',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
  }

  /**
   * Check if a filename has a specific extension
   */
  static hasExtension(filename: string, extension: string): boolean {
    return filename.toLowerCase().endsWith(extension.toLowerCase());
  }

  /**
   * Add extension to filename if missing
   */
  static ensureExtension(filename: string, extension: string): string {
    if (!this.hasExtension(filename, extension)) {
      return `${filename}${extension}`;
    }
    return filename;
  }

  /**
   * Get file extension
   */
  static getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  /**
   * Get filename without extension
   */
  static getFilenameWithoutExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      parts.pop();
    }
    return parts.join('.');
  }

  /**
   * Format file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
