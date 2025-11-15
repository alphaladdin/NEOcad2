/**
 * KeyboardManager - Manages global keyboard shortcuts
 */

import { logger } from '@utils/Logger';
import { eventBus, Events } from '@core/EventBus';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

export class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.setupEventListeners();
    logger.info('KeyboardManager', 'KeyboardManager initialized');
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    logger.debug('KeyboardManager', `Registered shortcut: ${key} - ${shortcut.description}`);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): void {
    const shortcutKey = this.getShortcutKey({ key, ctrl, shift, alt } as KeyboardShortcut);
    this.shortcuts.delete(shortcutKey);
    logger.debug('KeyboardManager', `Unregistered shortcut: ${shortcutKey}`);
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.enabled = true;
    logger.debug('KeyboardManager', 'Keyboard shortcuts enabled');
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    this.enabled = false;
    logger.debug('KeyboardManager', 'Keyboard shortcuts disabled');
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't trigger shortcuts if user is typing in an input field
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    const shortcutKey = this.getShortcutKey({
      key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    } as KeyboardShortcut);

    const shortcut = this.shortcuts.get(shortcutKey);
    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        e.preventDefault();
      }

      logger.debug('KeyboardManager', `Executing shortcut: ${shortcutKey}`);

      try {
        shortcut.action();
      } catch (error) {
        logger.error('KeyboardManager', `Error executing shortcut ${shortcutKey}`, error);
      }
    }
  }

  /**
   * Generate a unique key for a shortcut
   */
  private getShortcutKey(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Get human-readable shortcut label
   */
  static getShortcutLabel(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];

    // Use platform-specific modifier key labels
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
    if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
    if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');

    // Capitalize first letter of key
    const keyLabel = shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1);
    parts.push(keyLabel);

    return parts.join('+');
  }

  /**
   * Dispose keyboard manager
   */
  dispose(): void {
    this.shortcuts.clear();
    logger.info('KeyboardManager', 'KeyboardManager disposed');
  }
}
