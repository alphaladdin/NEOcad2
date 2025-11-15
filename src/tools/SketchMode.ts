import * as THREE from 'three';
import { WallTypeManager } from '../framing/WallTypeManager';
import { WallType } from '../framing/WallType';
import { ParametricWall } from '../parametric/ParametricWall';
import { EventBus, Events } from '../core/EventBus';
import { ParameterEngine } from '../parametric/ParameterEngine';
import { GeometryEngineWrapper } from '../parametric/GeometryEngineWrapper';

/**
 * Point in 2D sketch space
 */
interface SketchPoint {
  x: number;
  y: number;
}

/**
 * A wall segment in the sketch
 */
interface SketchWall {
  start: SketchPoint;
  end: SketchPoint;
  wallTypeId: string;
}

/**
 * Configuration options for SketchMode
 */
export interface SketchModeOptions {
  gridSize?: number; // Grid spacing in pixels
  snapToGrid?: boolean;
  orthoSnap?: boolean;
  showGrid?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  wallColor?: string;
  activeWallColor?: string;
  pixelsPerMeter?: number; // Scale: how many pixels = 1 meter
  parameterEngine?: ParameterEngine; // Optional parameter engine
  geometryEngine?: GeometryEngineWrapper; // Optional geometry engine
}

/**
 * SketchMode provides a 2D top-down drawing interface for quick wall sketching.
 * Users draw walls on a 2D canvas and see them instantly converted to 3D parametric walls.
 *
 * Inspired by HomeFig's sketch-to-3D workflow, this provides an intuitive way to
 * quickly design floor plans without needing to work directly in 3D space.
 */
export class SketchMode {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private isActive: boolean = false;
  private isDrawing: boolean = false;

  // Drawing state
  private walls: SketchWall[] = [];
  private currentStart: SketchPoint | null = null;
  private currentEnd: SketchPoint | null = null;
  private activeWallTypeId: string;

  // Options
  private options: Required<SketchModeOptions>;

  // References
  private wallTypeManager: WallTypeManager;
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private parameterEngine: ParameterEngine | null = null;
  private geometryEngine: GeometryEngineWrapper | null = null;

  // 3D wall mapping (sketch wall index -> ParametricWall)
  private wall3DMap: Map<number, ParametricWall> = new Map();

  // Mouse state
  private mousePos: SketchPoint = { x: 0, y: 0 };
  private isDragging: boolean = false;
  private panOffset: SketchPoint = { x: 0, y: 0 };
  private panStart: SketchPoint | null = null;

  constructor(
    scene: THREE.Scene,
    wallTypeManager: WallTypeManager,
    eventBus: EventBus,
    options: SketchModeOptions = {}
  ) {
    this.scene = scene;
    this.wallTypeManager = wallTypeManager;
    this.eventBus = eventBus;

    // Default options
    this.options = {
      gridSize: options.gridSize ?? 50,
      snapToGrid: options.snapToGrid ?? true,
      orthoSnap: options.orthoSnap ?? true,
      showGrid: options.showGrid ?? true,
      backgroundColor: options.backgroundColor ?? '#2a2a2a',
      gridColor: options.gridColor ?? '#3a3a3a',
      wallColor: options.wallColor ?? '#ffffff',
      activeWallColor: options.activeWallColor ?? '#4a9eff',
      pixelsPerMeter: options.pixelsPerMeter ?? 100, // 100px = 1m default
      parameterEngine: options.parameterEngine ?? null,
      geometryEngine: options.geometryEngine ?? null,
    };

    // Store engine references
    this.parameterEngine = this.options.parameterEngine ?? null;
    this.geometryEngine = this.options.geometryEngine ?? null;

    // Get default wall type
    const defaultWallType = wallTypeManager.getDefaultWallType();
    this.activeWallTypeId = defaultWallType.id;

    // Create canvas
    this.container = document.createElement('div');
    this.container.id = 'sketch-mode-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      display: none;
      background: ${this.options.backgroundColor};
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      display: block;
      cursor: crosshair;
    `;
    this.container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    // Setup event listeners
    this.setupEventListeners();

    // Add to DOM
    document.body.appendChild(this.container);
  }

  /**
   * Activate sketch mode
   */
  public activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.container.style.display = 'block';
    this.resizeCanvas();
    this.render();

    this.eventBus.emit(Events.SKETCH_MODE_ACTIVATED);
  }

  /**
   * Deactivate sketch mode
   */
  public deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.container.style.display = 'none';
    this.currentStart = null;
    this.currentEnd = null;

    this.eventBus.emit(Events.SKETCH_MODE_DEACTIVATED);
  }

  /**
   * Check if sketch mode is active
   */
  public isSketchModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Set the active wall type for new walls
   */
  public setWallType(wallTypeId: string): void {
    const wallType = this.wallTypeManager.getWallType(wallTypeId);
    if (wallType) {
      this.activeWallTypeId = wallTypeId;
      this.render();
    }
  }

  /**
   * Get the active wall type
   */
  public getActiveWallType(): WallType {
    return this.wallTypeManager.getWallType(this.activeWallTypeId)!;
  }

  /**
   * Clear all walls
   */
  public clearWalls(): void {
    // Remove 3D walls from scene
    this.wall3DMap.forEach((wall3D) => {
      wall3D.dispose();
    });
    this.wall3DMap.clear();

    // Clear sketch walls
    this.walls = [];
    this.currentStart = null;
    this.currentEnd = null;

    this.render();
  }

  /**
   * Export walls to 3D (already done in real-time, but can be used to regenerate)
   */
  public exportTo3D(): ParametricWall[] {
    return Array.from(this.wall3DMap.values());
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));

    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));

    // Window resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  /**
   * Handle mouse down
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.isActive) return;

    const pos = this.getMousePos(event);

    // Middle mouse or space+left mouse for panning
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      this.isDragging = true;
      this.panStart = { ...pos };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Left click for drawing
    if (event.button === 0) {
      if (!this.currentStart) {
        // Start new wall
        this.currentStart = this.snapPoint(pos);
        this.isDrawing = true;
      } else {
        // Finish wall
        this.currentEnd = this.snapPoint(pos);
        this.finishWall();
      }
    }
  }

  /**
   * Handle mouse move
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isActive) return;

    const pos = this.getMousePos(event);
    this.mousePos = pos;

    // Handle panning
    if (this.isDragging && this.panStart) {
      this.panOffset.x += pos.x - this.panStart.x;
      this.panOffset.y += pos.y - this.panStart.y;
      this.panStart = { ...pos };
      this.render();
      return;
    }

    // Update preview while drawing
    if (this.isDrawing && this.currentStart) {
      this.currentEnd = this.snapPoint(pos);
      this.render();
    }
  }

  /**
   * Handle mouse up
   */
  private onMouseUp(event: MouseEvent): void {
    if (!this.isActive) return;

    if (this.isDragging) {
      this.isDragging = false;
      this.panStart = null;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Handle mouse leave
   */
  private onMouseLeave(event: MouseEvent): void {
    if (!this.isActive) return;

    if (this.isDragging) {
      this.isDragging = false;
      this.panStart = null;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Handle keyboard events
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isActive) return;

    // Escape: cancel current drawing or exit sketch mode
    if (event.key === 'Escape') {
      if (this.currentStart) {
        this.currentStart = null;
        this.currentEnd = null;
        this.isDrawing = false;
        this.render();
      } else {
        this.deactivate();
      }
      event.preventDefault();
    }

    // Backspace/Delete: remove last wall
    if (event.key === 'Backspace' || event.key === 'Delete') {
      this.removeLastWall();
      event.preventDefault();
    }

    // C: clear all walls
    if (event.key === 'c' || event.key === 'C') {
      if (confirm('Clear all walls?')) {
        this.clearWalls();
      }
      event.preventDefault();
    }
  }

  /**
   * Handle window resize
   */
  private onResize(): void {
    if (this.isActive) {
      this.resizeCanvas();
      this.render();
    }
  }

  /**
   * Resize canvas to match window
   */
  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Get mouse position in canvas coordinates
   */
  private getMousePos(event: MouseEvent): SketchPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  /**
   * Apply snapping to a point
   */
  private snapPoint(point: SketchPoint): SketchPoint {
    let snapped = { ...point };

    // Apply grid snapping
    if (this.options.snapToGrid) {
      snapped.x = Math.round(snapped.x / this.options.gridSize) * this.options.gridSize;
      snapped.y = Math.round(snapped.y / this.options.gridSize) * this.options.gridSize;
    }

    return snapped;
  }

  /**
   * Apply orthogonal snapping to current wall
   */
  private applyOrthoSnap(start: SketchPoint, end: SketchPoint): SketchPoint {
    if (!this.options.orthoSnap) return end;

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // If more horizontal than vertical, snap to horizontal
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: end.x, y: start.y };
    } else {
      return { x: start.x, y: end.y };
    }
  }

  /**
   * Finish current wall and create 3D version
   */
  private finishWall(): void {
    if (!this.currentStart || !this.currentEnd) return;

    // Apply orthogonal snapping
    const snappedEnd = this.applyOrthoSnap(this.currentStart, this.currentEnd);

    // Don't create zero-length walls
    const dx = snappedEnd.x - this.currentStart.x;
    const dy = snappedEnd.y - this.currentStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) {
      this.currentStart = null;
      this.currentEnd = null;
      this.isDrawing = false;
      return;
    }

    // Create sketch wall
    const wall: SketchWall = {
      start: { ...this.currentStart },
      end: { ...snappedEnd },
      wallTypeId: this.activeWallTypeId,
    };

    this.walls.push(wall);

    // Create 3D wall
    this.createWall3D(wall, this.walls.length - 1);

    // Continue from end point
    this.currentStart = { ...snappedEnd };
    this.currentEnd = null;

    this.render();
  }

  /**
   * Remove the last wall
   */
  private removeLastWall(): void {
    if (this.walls.length === 0) return;

    // Remove 3D wall
    const lastIndex = this.walls.length - 1;
    const wall3D = this.wall3DMap.get(lastIndex);
    if (wall3D) {
      wall3D.dispose();
      this.wall3DMap.delete(lastIndex);
    }

    // Remove sketch wall
    this.walls.pop();

    this.render();
  }

  /**
   * Create a 3D parametric wall from a sketch wall
   */
  private createWall3D(sketchWall: SketchWall, index: number): void {
    const wallType = this.wallTypeManager.getWallType(sketchWall.wallTypeId);
    if (!wallType) return;

    // Check if engines are available
    if (!this.parameterEngine || !this.geometryEngine) {
      console.warn('SketchMode: ParameterEngine or GeometryEngine not provided. Cannot create parametric walls.');
      return;
    }

    // Convert sketch coordinates to 3D world coordinates
    const start3D = this.sketchToWorld(sketchWall.start);
    const end3D = this.sketchToWorld(sketchWall.end);

    // Calculate wall length in millimeters
    const dx = end3D.x - start3D.x;
    const dz = end3D.z - start3D.z;
    const lengthMeters = Math.sqrt(dx * dx + dz * dz);
    const lengthMM = lengthMeters * 1000;

    // Get wall height in millimeters
    const heightMM = wallType.defaultHeight * 1000; // feet to meters to mm

    // Create parametric wall with proper constructor
    const wall3D = new ParametricWall(
      this.parameterEngine,
      this.geometryEngine,
      {
        startPoint: start3D,
        endPoint: end3D,
        height: heightMM,
        thickness: wallType.actualThickness * 25.4, // inches to mm
        wallType: wallType,
      }
    );

    // Position is handled by startPoint/endPoint in constructor
    // No need to manually set position and rotation

    // Add to scene
    const mesh = wall3D.getMesh();
    if (mesh) {
      this.scene.add(mesh);
    }

    // Store in map
    this.wall3DMap.set(index, wall3D);

    // Emit event
    this.eventBus.emit(Events.WALL_ADDED, wall3D);
  }

  /**
   * Convert sketch coordinates to 3D world coordinates
   */
  private sketchToWorld(point: SketchPoint): THREE.Vector3 {
    // Apply pan offset
    const offsetX = point.x - this.panOffset.x;
    const offsetY = point.y - this.panOffset.y;

    // Center at canvas center
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const relX = offsetX - centerX;
    const relY = offsetY - centerY;

    // Convert pixels to meters
    const worldX = relX / this.options.pixelsPerMeter;
    const worldZ = relY / this.options.pixelsPerMeter;

    return new THREE.Vector3(worldX, 0, worldZ);
  }

  /**
   * Convert 3D world coordinates to sketch coordinates
   */
  private worldToSketch(point: THREE.Vector3): SketchPoint {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Convert meters to pixels
    const pixelX = point.x * this.options.pixelsPerMeter;
    const pixelY = point.z * this.options.pixelsPerMeter;

    return {
      x: centerX + pixelX + this.panOffset.x,
      y: centerY + pixelY + this.panOffset.y,
    };
  }

  /**
   * Render the sketch canvas
   */
  private render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (this.options.showGrid) {
      this.drawGrid();
    }

    // Draw existing walls
    ctx.strokeStyle = this.options.wallColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const wall of this.walls) {
      this.drawWall(wall);
    }

    // Draw current wall being drawn
    if (this.currentStart && this.currentEnd) {
      ctx.strokeStyle = this.options.activeWallColor;
      ctx.lineWidth = 3;

      const snappedEnd = this.applyOrthoSnap(this.currentStart, this.currentEnd);

      ctx.beginPath();
      ctx.moveTo(this.currentStart.x, this.currentStart.y);
      ctx.lineTo(snappedEnd.x, snappedEnd.y);
      ctx.stroke();

      // Draw start point
      ctx.fillStyle = this.options.activeWallColor;
      ctx.beginPath();
      ctx.arc(this.currentStart.x, this.currentStart.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw dimension
      this.drawDimension(this.currentStart, snappedEnd);
    } else if (this.currentStart) {
      // Just show start point
      ctx.fillStyle = this.options.activeWallColor;
      ctx.beginPath();
      ctx.arc(this.currentStart.x, this.currentStart.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw instructions
    this.drawInstructions();
  }

  /**
   * Draw grid
   */
  private drawGrid(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const gridSize = this.options.gridSize;

    ctx.strokeStyle = this.options.gridColor;
    ctx.lineWidth = 1;

    // Calculate grid offset based on pan
    const offsetX = this.panOffset.x % gridSize;
    const offsetY = this.panOffset.y % gridSize;

    // Vertical lines
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /**
   * Draw a wall on the canvas
   */
  private drawWall(wall: SketchWall): void {
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.moveTo(wall.start.x, wall.start.y);
    ctx.lineTo(wall.end.x, wall.end.y);
    ctx.stroke();

    // Draw endpoints
    ctx.fillStyle = this.options.wallColor;
    ctx.beginPath();
    ctx.arc(wall.start.x, wall.start.y, 3, 0, Math.PI * 2);
    ctx.arc(wall.end.x, wall.end.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw dimension text between two points
   */
  private drawDimension(start: SketchPoint, end: SketchPoint): void {
    const ctx = this.ctx;

    // Calculate length in pixels
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthPixels = Math.sqrt(dx * dx + dy * dy);

    // Convert to meters
    const lengthMeters = lengthPixels / this.options.pixelsPerMeter;

    // Format as feet and inches
    const lengthFeet = lengthMeters * 3.28084;
    const feet = Math.floor(lengthFeet);
    const inches = Math.round((lengthFeet - feet) * 12);

    const dimensionText = `${feet}'-${inches}"`;

    // Draw text at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    ctx.fillStyle = this.options.activeWallColor;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(dimensionText, midX, midY - 10);
  }

  /**
   * Draw instructions on screen
   */
  private drawInstructions(): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const instructions = [
      'SKETCH MODE',
      '',
      'Click to place wall points',
      'Shift + Drag to pan view',
      'Backspace to remove last wall',
      'C to clear all walls',
      'ESC to exit sketch mode',
    ];

    let y = 20;
    for (const line of instructions) {
      ctx.fillText(line, 20, y);
      y += 20;
    }

    // Draw wall count
    ctx.fillText(`Walls: ${this.walls.length}`, 20, y + 10);
  }

  /**
   * Dispose of sketch mode resources
   */
  public dispose(): void {
    this.deactivate();

    // Remove event listeners
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('resize', this.onResize.bind(this));

    // Remove from DOM
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    // Clean up 3D walls
    this.clearWalls();
  }
}
