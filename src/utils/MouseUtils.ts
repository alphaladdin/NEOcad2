/**
 * Mouse Utilities
 * Helpers for mouse position tracking and coordinate conversion
 */

import * as THREE from 'three';

export interface MousePosition {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

/**
 * Get mouse position relative to an element
 */
export function getMousePosition(event: MouseEvent, element: HTMLElement): MousePosition {
  const rect = element.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

/**
 * Convert mouse position to Normalized Device Coordinates (NDC)
 * NDC range: x and y are between -1 and 1
 * Used for raycasting in Three.js
 */
export function mouseToNDC(event: MouseEvent, element: HTMLElement): THREE.Vector2 {
  const rect = element.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  return new THREE.Vector2(x, y);
}

/**
 * Check if mouse is inside an element
 */
export function isMouseInElement(event: MouseEvent, element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();

  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

/**
 * Debounce function for mouse events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for mouse events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Mouse tracker class for continuous position tracking
 */
export class MouseTracker {
  private element: HTMLElement;
  private _position: THREE.Vector2;
  private _ndc: THREE.Vector2;
  private _isInside: boolean;

  private mouseMoveHandler: (event: MouseEvent) => void;
  private mouseEnterHandler: () => void;
  private mouseLeaveHandler: () => void;

  constructor(element: HTMLElement) {
    this.element = element;
    this._position = new THREE.Vector2();
    this._ndc = new THREE.Vector2();
    this._isInside = false;

    // Bind event handlers
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseEnterHandler = this.onMouseEnter.bind(this);
    this.mouseLeaveHandler = this.onMouseLeave.bind(this);

    // Add event listeners
    this.element.addEventListener('mousemove', this.mouseMoveHandler);
    this.element.addEventListener('mouseenter', this.mouseEnterHandler);
    this.element.addEventListener('mouseleave', this.mouseLeaveHandler);
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.element.getBoundingClientRect();

    // Update pixel position
    this._position.x = event.clientX - rect.left;
    this._position.y = event.clientY - rect.top;

    // Update NDC position
    this._ndc.x = (this._position.x / rect.width) * 2 - 1;
    this._ndc.y = -(this._position.y / rect.height) * 2 + 1;
  }

  private onMouseEnter(): void {
    this._isInside = true;
  }

  private onMouseLeave(): void {
    this._isInside = false;
  }

  /**
   * Get current mouse position in pixels
   */
  get position(): THREE.Vector2 {
    return this._position.clone();
  }

  /**
   * Get current mouse position in NDC
   */
  get ndc(): THREE.Vector2 {
    return this._ndc.clone();
  }

  /**
   * Check if mouse is currently inside the element
   */
  get isInside(): boolean {
    return this._isInside;
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    this.element.removeEventListener('mousemove', this.mouseMoveHandler);
    this.element.removeEventListener('mouseenter', this.mouseEnterHandler);
    this.element.removeEventListener('mouseleave', this.mouseLeaveHandler);
  }
}
