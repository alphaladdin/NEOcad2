/**
 * LoadingIndicator - Shows loading progress for file operations
 */

import { logger } from '@utils/Logger';

export interface LoadingIndicatorConfig {
  message?: string;
  showProgress?: boolean;
}

export class LoadingIndicator {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private spinner: HTMLElement;
  private messageEl: HTMLElement;
  private progressBar?: HTMLElement;
  private progressFill?: HTMLElement;
  private progressText?: HTMLElement;
  private isVisible: boolean = false;

  constructor(config: LoadingIndicatorConfig = {}) {
    this.overlay = this.createOverlay();
    this.container = this.createContainer();
    this.spinner = this.createSpinner();
    this.messageEl = this.createMessage(config.message);

    this.container.appendChild(this.spinner);
    this.container.appendChild(this.messageEl);

    if (config.showProgress) {
      const { progressBar, progressFill, progressText } = this.createProgressBar();
      this.progressBar = progressBar;
      this.progressFill = progressFill;
      this.progressText = progressText;
      this.container.appendChild(progressBar);
    }

    this.overlay.appendChild(this.container);

    logger.debug('LoadingIndicator', 'LoadingIndicator created');
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    return overlay;
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'loading-container';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
      background: var(--color-surface-1);
      border: var(--border);
      border-radius: var(--radius-lg);
      min-width: 300px;
    `;
    return container;
  }

  private createSpinner(): HTMLElement {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid var(--color-surface-3);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;
    return spinner;
  }

  private createMessage(message?: string): HTMLElement {
    const messageEl = document.createElement('div');
    messageEl.className = 'loading-message';
    messageEl.textContent = message || 'Loading...';
    messageEl.style.cssText = `
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      text-align: center;
    `;
    return messageEl;
  }

  private createProgressBar(): {
    progressBar: HTMLElement;
    progressFill: HTMLElement;
    progressText: HTMLElement;
  } {
    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress-bar';
    progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: var(--color-surface-3);
      border-radius: var(--radius-full);
      overflow: hidden;
      position: relative;
    `;

    const progressFill = document.createElement('div');
    progressFill.className = 'loading-progress-fill';
    progressFill.style.cssText = `
      height: 100%;
      background: var(--color-primary);
      border-radius: var(--radius-full);
      width: 0%;
      transition: width 0.3s ease;
    `;

    const progressText = document.createElement('div');
    progressText.className = 'loading-progress-text';
    progressText.textContent = '0%';
    progressText.style.cssText = `
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      text-align: center;
      margin-top: 8px;
      font-family: var(--font-family-mono);
    `;

    progressBar.appendChild(progressFill);

    return { progressBar, progressFill, progressText };
  }

  /**
   * Show loading indicator
   */
  show(message?: string): void {
    if (this.isVisible) return;

    if (message) {
      this.setMessage(message);
    }

    document.body.appendChild(this.overlay);
    this.overlay.style.display = 'flex';
    this.isVisible = true;

    logger.debug('LoadingIndicator', 'Loading indicator shown');
  }

  /**
   * Hide loading indicator
   */
  hide(): void {
    if (!this.isVisible) return;

    this.overlay.style.display = 'none';
    if (this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.isVisible = false;

    logger.debug('LoadingIndicator', 'Loading indicator hidden');
  }

  /**
   * Set loading message
   */
  setMessage(message: string): void {
    this.messageEl.textContent = message;
  }

  /**
   * Update progress (0-100)
   */
  setProgress(percentage: number): void {
    if (!this.progressFill || !this.progressText) return;

    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    this.progressFill.style.width = `${clampedPercentage}%`;
    this.progressText.textContent = `${Math.round(clampedPercentage)}%`;
  }

  /**
   * Check if loading indicator is visible
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Dispose loading indicator
   */
  dispose(): void {
    this.hide();
    logger.debug('LoadingIndicator', 'LoadingIndicator disposed');
  }
}
