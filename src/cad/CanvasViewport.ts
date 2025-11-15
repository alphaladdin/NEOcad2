import { Vector2 } from './Vector2';
import { Camera2D } from './Camera2D';

export type UnitType = 'mm' | 'cm' | 'm' | 'ft' | 'in';

export interface ViewportConfig {
  name: string;
  scale: number; // Drawing scale (e.g., 100 for 1:100, 50 for 1:50)
  units: UnitType;
  gridSize: number; // Major grid size in world units
  minorGridDivisions: number; // Number of minor grid divisions
  showGrid: boolean;
  showAxes: boolean;
  backgroundColor: string;
  gridColor: string;
  minorGridColor: string;
  axesColor: string;
  enableBuiltInZoom?: boolean; // Enable built-in wheel zoom handler (default: true)
}

export interface GridStyle {
  majorGridSize: number;
  minorGridSize: number;
  majorGridColor: string;
  minorGridColor: string;
  majorGridWidth: number;
  minorGridWidth: number;
}

/**
 * CanvasViewport - A 2D canvas viewport with camera controls
 * Handles rendering, coordinate transformation, and grid display
 */
export class CanvasViewport {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera2D;
  private config: ViewportConfig;
  private animationFrameId: number | null = null;
  private needsRedraw: boolean = true;

  // Crosshair overlay canvas for zero-lag rendering
  private crosshairCanvas: HTMLCanvasElement | null = null;
  private crosshairCtx: CanvasRenderingContext2D | null = null;

  // Mouse/touch interaction state
  private isPanning: boolean = false;
  private lastMousePos: Vector2 | null = null;
  private mouseWorldPos: Vector2 | null = null;
  private mouseScreenPos: Vector2 | null = null;
  private showCrosshairs: boolean = true;

  // Event listeners
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private boundMouseLeave: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, config?: Partial<ViewportConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    // Default configuration
    this.config = {
      name: 'Viewport',
      scale: 100,
      units: 'm',
      gridSize: 1, // 1 unit
      minorGridDivisions: 10,
      showGrid: true,
      showAxes: true,
      backgroundColor: '#2a2a2a',
      gridColor: '#3a3a3a',
      minorGridColor: '#323232',
      axesColor: '#555555',
      enableBuiltInZoom: true,
      ...config,
    };

    // Initialize camera
    this.camera = new Camera2D(new Vector2(0, 0), 100, 0);

    // Create crosshair overlay canvas for instant feedback
    this.setupCrosshairOverlay();

    // Bind event listeners
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
    this.boundMouseLeave = this.onMouseLeave.bind(this);

    this.setupEventListeners();
    this.startRenderLoop();
  }

  /**
   * Setup crosshair overlay canvas
   */
  private setupCrosshairOverlay(): void {
    // Create overlay canvas
    this.crosshairCanvas = document.createElement('canvas');
    this.crosshairCanvas.width = this.canvas.width;
    this.crosshairCanvas.height = this.canvas.height;
    this.crosshairCanvas.style.position = 'absolute';
    this.crosshairCanvas.style.top = '0';
    this.crosshairCanvas.style.left = '0';
    this.crosshairCanvas.style.pointerEvents = 'none'; // Allow clicks to pass through
    this.crosshairCanvas.style.zIndex = '10'; // Above main canvas

    // Get context
    this.crosshairCtx = this.crosshairCanvas.getContext('2d');

    // Insert overlay after main canvas
    if (this.canvas.parentElement) {
      // Ensure parent has position relative for absolute positioning to work
      const parent = this.canvas.parentElement;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      this.canvas.parentElement.appendChild(this.crosshairCanvas);
    }
  }

  /**
   * Setup mouse/touch event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);

    // Only add wheel listener if enableBuiltInZoom is true
    if (this.config.enableBuiltInZoom !== false) {
      this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    }

    this.canvas.addEventListener('contextmenu', this.boundContextMenu);
    this.canvas.addEventListener('mouseleave', this.boundMouseLeave);

    // Add window listeners for mouse up (in case mouse leaves canvas)
    window.addEventListener('mouseup', this.boundMouseUp);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
    window.removeEventListener('mouseup', this.boundMouseUp);
  }

  /**
   * Mouse down event handler
   */
  private onMouseDown(e: MouseEvent): void {
    // Middle mouse button or Shift + Left mouse button for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true;
      this.lastMousePos = new Vector2(e.clientX, e.clientY);
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }

  /**
   * Mouse move event handler
   */
  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);

    // Update mouse positions
    this.mouseScreenPos = screenPos;
    this.mouseWorldPos = this.screenToWorld(screenPos);

    // Render crosshairs immediately on overlay (zero lag)
    this.renderCrosshairsOverlay();

    if (this.isPanning && this.lastMousePos) {
      const delta = new Vector2(
        e.clientX - this.lastMousePos.x,
        e.clientY - this.lastMousePos.y
      );
      this.camera.pan(delta);
      this.lastMousePos.set(e.clientX, e.clientY);
      this.needsRedraw = true;
    } else {
      // Request redraw for other updates
      this.needsRedraw = true;
    }
  }

  /**
   * Mouse up event handler
   */
  private onMouseUp(e: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.lastMousePos = null;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Mouse leave event handler
   */
  private onMouseLeave(): void {
    // Clear mouse position when mouse leaves canvas
    this.mouseScreenPos = null;
    this.mouseWorldPos = null;
    this.clearCrosshairsOverlay();
    this.needsRedraw = true;
  }

  /**
   * Mouse wheel event handler (zoom)
   */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mousePos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);

    // Zoom factor
    const zoomSpeed = 0.1;
    const factor = e.deltaY < 0 ? 1 + zoomSpeed : 1 - zoomSpeed;

    this.camera.zoom(factor, mousePos);
    this.needsRedraw = true;
  }

  /**
   * Context menu event handler (prevent default)
   */
  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  /**
   * Transform a point from world space to screen space
   */
  worldToScreen(worldPoint: Vector2): Vector2 {
    const result = this.camera.worldToScreen(worldPoint, this.canvas.width, this.canvas.height);
    // Attach zoom level for use by entity rendering (e.g., Wall needs it for proper thickness scaling)
    (this.worldToScreen as any).zoom = this.camera.getZoom();
    return result;
  }

  /**
   * Transform a point from screen space to world space
   */
  screenToWorld(screenPoint: Vector2): Vector2 {
    return this.camera.screenToWorld(screenPoint, this.canvas.width, this.canvas.height);
  }

  /**
   * Get current mouse position in world coordinates
   */
  getMouseWorldPos(): Vector2 | null {
    return this.mouseWorldPos ? this.mouseWorldPos.clone() : null;
  }

  /**
   * Get camera
   */
  getCamera(): Camera2D {
    return this.camera;
  }

  /**
   * Get configuration
   */
  getConfig(): ViewportConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ViewportConfig>): void {
    this.config = { ...this.config, ...config };
    this.needsRedraw = true;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render grid
   */
  private renderGrid(): void {
    if (!this.config.showGrid) return;

    const bounds = this.camera.getViewBounds(this.canvas.width, this.canvas.height);
    const zoom = this.camera.getZoom();

    // Adaptive grid: adjust grid size based on zoom level
    // Start with base grid size
    let majorGridSize = this.config.gridSize;

    // If grid is too dense (lines too close), increase spacing
    while (majorGridSize * zoom < 20 && majorGridSize < 1000) {
      majorGridSize *= 10;
    }

    // If grid is too sparse (lines too far apart), decrease spacing
    while (majorGridSize * zoom > 200 && majorGridSize > 0.01) {
      majorGridSize /= 10;
    }

    const minorGridSize = majorGridSize / this.config.minorGridDivisions;

    // Determine which grid to show based on zoom level
    const minorGridScreenSize = minorGridSize * zoom;

    // Don't render minor grid if it's too dense
    const showMinorGrid = minorGridScreenSize > 5;

    // Calculate grid bounds
    const startX = Math.floor(bounds.min.x / majorGridSize) * majorGridSize;
    const endX = Math.ceil(bounds.max.x / majorGridSize) * majorGridSize;
    const startY = Math.floor(bounds.min.y / majorGridSize) * majorGridSize;
    const endY = Math.ceil(bounds.max.y / majorGridSize) * majorGridSize;

    this.ctx.save();

    // Render minor grid
    if (showMinorGrid) {
      this.ctx.strokeStyle = this.config.minorGridColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      // Vertical lines
      for (let x = startX; x <= endX; x += minorGridSize) {
        // Skip major grid lines
        if (Math.abs(x % majorGridSize) < 0.001) continue;

        const screenStart = this.worldToScreen(new Vector2(x, bounds.min.y));
        const screenEnd = this.worldToScreen(new Vector2(x, bounds.max.y));
        this.ctx.moveTo(screenStart.x, screenStart.y);
        this.ctx.lineTo(screenEnd.x, screenEnd.y);
      }

      // Horizontal lines
      for (let y = startY; y <= endY; y += minorGridSize) {
        // Skip major grid lines
        if (Math.abs(y % majorGridSize) < 0.001) continue;

        const screenStart = this.worldToScreen(new Vector2(bounds.min.x, y));
        const screenEnd = this.worldToScreen(new Vector2(bounds.max.x, y));
        this.ctx.moveTo(screenStart.x, screenStart.y);
        this.ctx.lineTo(screenEnd.x, screenEnd.y);
      }

      this.ctx.stroke();
    }

    // Render major grid
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x += majorGridSize) {
      const screenStart = this.worldToScreen(new Vector2(x, bounds.min.y));
      const screenEnd = this.worldToScreen(new Vector2(x, bounds.max.y));
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += majorGridSize) {
      const screenStart = this.worldToScreen(new Vector2(bounds.min.x, y));
      const screenEnd = this.worldToScreen(new Vector2(bounds.max.x, y));
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Render coordinate axes
   */
  private renderAxes(): void {
    if (!this.config.showAxes) return;

    const origin = this.worldToScreen(new Vector2(0, 0));
    const bounds = this.camera.getViewBounds(this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.lineWidth = 2;

    // X axis (horizontal) - Red
    if (bounds.min.y <= 0 && bounds.max.y >= 0) {
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.beginPath();
      this.ctx.moveTo(0, origin.y);
      this.ctx.lineTo(this.canvas.width, origin.y);
      this.ctx.stroke();
    }

    // Y axis (vertical) - Green
    if (bounds.min.x <= 0 && bounds.max.x >= 0) {
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.beginPath();
      this.ctx.moveTo(origin.x, 0);
      this.ctx.lineTo(origin.x, this.canvas.height);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Render crosshairs at mouse position (legacy - now uses overlay)
   */
  private renderCrosshairs(): void {
    // Crosshairs are now rendered on the overlay canvas for zero lag
    // This method is kept for compatibility but does nothing
  }

  /**
   * Render crosshairs immediately on overlay canvas (zero lag)
   */
  private renderCrosshairsOverlay(): void {
    if (!this.showCrosshairs || !this.crosshairCtx || !this.crosshairCanvas) return;

    // Clear the overlay
    this.crosshairCtx.clearRect(0, 0, this.crosshairCanvas.width, this.crosshairCanvas.height);

    if (!this.mouseScreenPos) return;

    const x = this.mouseScreenPos.x;
    const y = this.mouseScreenPos.y;

    // Don't render if mouse is outside canvas
    if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) {
      return;
    }

    this.crosshairCtx.save();
    this.crosshairCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.crosshairCtx.lineWidth = 1;
    this.crosshairCtx.setLineDash([5, 5]);

    // Vertical line
    this.crosshairCtx.beginPath();
    this.crosshairCtx.moveTo(x, 0);
    this.crosshairCtx.lineTo(x, this.crosshairCanvas.height);
    this.crosshairCtx.stroke();

    // Horizontal line
    this.crosshairCtx.beginPath();
    this.crosshairCtx.moveTo(0, y);
    this.crosshairCtx.lineTo(this.crosshairCanvas.width, y);
    this.crosshairCtx.stroke();

    this.crosshairCtx.restore();
  }

  /**
   * Clear crosshairs overlay
   */
  private clearCrosshairsOverlay(): void {
    if (!this.crosshairCtx || !this.crosshairCanvas) return;
    this.crosshairCtx.clearRect(0, 0, this.crosshairCanvas.width, this.crosshairCanvas.height);
  }

  /**
   * Render the viewport
   */
  render(): void {
    this.clear();
    this.renderGrid();
    this.renderAxes();
    // Crosshairs are now rendered on overlay canvas for zero lag

    // Additional rendering will be added by extending classes or external renderers
  }

  /**
   * Request a redraw on the next frame
   */
  requestRedraw(): void {
    this.needsRedraw = true;
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    const loop = () => {
      // Update camera animation
      const cameraAnimated = this.camera.update();

      if (this.needsRedraw || cameraAnimated) {
        this.render();
        this.needsRedraw = false;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  /**
   * Stop the render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    // Also resize crosshair overlay
    if (this.crosshairCanvas) {
      this.crosshairCanvas.width = width;
      this.crosshairCanvas.height = height;
    }

    this.needsRedraw = true;
  }

  /**
   * Fit view to bounds
   */
  fitBounds(min: Vector2, max: Vector2, padding: number = 0.1): void {
    this.camera.fitBounds(min, max, padding);
    this.needsRedraw = true;
  }

  /**
   * Reset view to origin
   */
  resetView(): void {
    this.camera.setPosition(new Vector2(0, 0));
    this.camera.setZoom(100);
    this.camera.setRotation(0);
    this.needsRedraw = true;
  }

  /**
   * Dispose of the viewport
   */
  dispose(): void {
    this.stopRenderLoop();
    this.removeEventListeners();

    // Remove crosshair overlay
    if (this.crosshairCanvas && this.crosshairCanvas.parentElement) {
      this.crosshairCanvas.parentElement.removeChild(this.crosshairCanvas);
    }
    this.crosshairCanvas = null;
    this.crosshairCtx = null;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the 2D context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Set whether to show crosshairs
   */
  setShowCrosshairs(show: boolean): void {
    this.showCrosshairs = show;
    this.needsRedraw = true;
  }

  /**
   * Get whether crosshairs are shown
   */
  getShowCrosshairs(): boolean {
    return this.showCrosshairs;
  }
}
