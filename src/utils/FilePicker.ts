/**
 * FilePicker - Utility for opening file dialogs
 */

import { logger } from './Logger';

export interface FilePickerOptions {
  accept?: string;
  multiple?: boolean;
}

export class FilePicker {
  /**
   * Open file picker dialog
   */
  static async pickFile(options: FilePickerOptions = {}): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '*/*';
      input.multiple = options.multiple || false;

      input.addEventListener('change', () => {
        const files = input.files;
        if (files && files.length > 0) {
          logger.debug('FilePicker', `File selected: ${files[0].name}`);
          resolve(files[0]);
        } else {
          resolve(null);
        }
      });

      input.addEventListener('cancel', () => {
        logger.debug('FilePicker', 'File picker cancelled');
        resolve(null);
      });

      input.click();
    });
  }

  /**
   * Open file picker for multiple files
   */
  static async pickFiles(options: FilePickerOptions = {}): Promise<FileList | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '*/*';
      input.multiple = true;

      input.addEventListener('change', () => {
        const files = input.files;
        if (files && files.length > 0) {
          logger.debug('FilePicker', `${files.length} files selected`);
          resolve(files);
        } else {
          resolve(null);
        }
      });

      input.addEventListener('cancel', () => {
        logger.debug('FilePicker', 'File picker cancelled');
        resolve(null);
      });

      input.click();
    });
  }

  /**
   * Open file picker specifically for IFC files
   */
  static async pickIFCFile(): Promise<File | null> {
    return FilePicker.pickFile({
      accept: '.ifc',
      multiple: false,
    });
  }

  /**
   * Read file as text
   */
  static async readAsText(file: File): Promise<string> {
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
  static async readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
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
  static async readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
