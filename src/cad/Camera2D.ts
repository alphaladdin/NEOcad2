import { Vector2 } from './Vector2';

/**
 * Camera2D - Handles 2D view transformation (pan, zoom, rotation)
 * Inspired by CAD software camera controls
 */
export class Camera2D {
  // Camera position in world coordinates
  private position: Vector2;

  // Zoom level (pixels per unit)
  // Higher values = more zoomed in
  private zoomLevel: number;

  // Camera rotation in radians
  private rotation: number;

  // Zoom constraints
  private minZoom: number;
  private maxZoom: number;

  // Animation state
  private targetPosition: Vector2 | null = null;
  private targetZoom: number | null = null;
  private animationSpeed: number = 0.15;

  constructor(
    position: Vector2 = new Vector2(0, 0),
    zoom: number = 100,
    rotation: number = 0
  ) {
    this.position = position.clone();
    this.zoomLevel = zoom;
    this.rotation = rotation;
    this.minZoom = 0.1;
    this.maxZoom = 100000;
  }

  /**
   * Get camera position
   */
  getPosition(): Vector2 {
    return this.position.clone();
  }

  /**
   * Set camera position
   */
  setPosition(position: Vector2): void {
    this.position.copy(position);
    this.targetPosition = null;
  }

  /**
   * Get zoom level
   */
  getZoom(): number {
    return this.zoomLevel;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.targetZoom = null;
  }

  /**
   * Get rotation in radians
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set rotation in radians
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
  }

  /**
   * Pan the camera by a delta in screen space
   */
  pan(delta: Vector2): void {
    // Convert screen-space delta to world-space delta
    const worldDelta = new Vector2(
      delta.x / this.zoomLevel,
      delta.y / this.zoomLevel
    );

    // Apply rotation if camera is rotated
    if (this.rotation !== 0) {
      worldDelta.rotate(-this.rotation);
    }

    this.position.sub(worldDelta);
    this.targetPosition = null;
  }

  /**
   * Zoom in/out by a factor
   * NOTE: This method does NOT support zoom-to-cursor.
   * For zoom-to-cursor, manually calculate the offset using screenToWorld/worldToScreen
   * with viewport dimensions, then adjust camera position.
   */
  zoom(factor: number, center?: Vector2): void {
    const oldZoom = this.zoomLevel;
    const newZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, oldZoom * factor)
    );

    // Just apply zoom at camera center (no zoom-to-cursor support)
    this.zoomLevel = newZoom;
    this.targetZoom = null;
  }

  /**
   * Zoom to a specific level
   */
  zoomTo(zoom: number, center?: Vector2): void {
    const factor = zoom / this.zoomLevel;
    this.zoom(factor, center);
  }

  /**
   * Fit a bounding box into the view
   */
  fitBounds(min: Vector2, max: Vector2, padding: number = 0.1): void {
    const width = max.x - min.x;
    const height = max.y - min.y;
    const centerX = (min.x + max.x) / 2;
    const centerY = (min.y + max.y) / 2;

    this.position.set(centerX, centerY);

    // Calculate zoom to fit (with padding)
    const paddingFactor = 1 + padding;
    // Note: This assumes a viewport size - should be passed in or calculated
    // For now, use a reasonable default
    const viewportWidth = 800;
    const viewportHeight = 600;
    const zoomX = viewportWidth / (width * paddingFactor);
    const zoomY = viewportHeight / (height * paddingFactor);
    this.zoomLevel = Math.min(zoomX, zoomY);
  }

  /**
   * Transform a point from world space to screen space
   */
  worldToScreen(worldPoint: Vector2, viewportWidth: number, viewportHeight: number): Vector2 {
    // Translate relative to camera position
    let x = worldPoint.x - this.position.x;
    let y = worldPoint.y - this.position.y;

    // Apply rotation
    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;
      x = rotatedX;
      y = rotatedY;
    }

    // Apply zoom
    x *= this.zoomLevel;
    y *= this.zoomLevel;

    // Translate to screen center
    x += viewportWidth / 2;
    y = viewportHeight / 2 - y; // Flip Y axis (screen Y is down, world Y is up)

    return new Vector2(x, y);
  }

  /**
   * Transform a point from screen space to world space
   */
  screenToWorld(screenPoint: Vector2, viewportWidth: number, viewportHeight: number): Vector2 {
    // Translate from screen center
    let x = screenPoint.x - viewportWidth / 2;
    let y = viewportHeight / 2 - screenPoint.y; // Flip Y axis

    // Remove zoom
    x /= this.zoomLevel;
    y /= this.zoomLevel;

    // Remove rotation
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;
      x = rotatedX;
      y = rotatedY;
    }

    // Translate relative to camera position
    x += this.position.x;
    y += this.position.y;

    return new Vector2(x, y);
  }

  /**
   * Animate camera to a target position (smooth pan)
   */
  animateTo(targetPosition: Vector2, targetZoom?: number): void {
    this.targetPosition = targetPosition.clone();
    if (targetZoom !== undefined) {
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    }
  }

  /**
   * Update animation (call this every frame)
   */
  update(): boolean {
    let animated = false;

    // Animate position
    if (this.targetPosition) {
      const distance = this.position.distanceTo(this.targetPosition);
      if (distance < 0.01) {
        this.position.copy(this.targetPosition);
        this.targetPosition = null;
      } else {
        this.position.lerp(this.targetPosition, this.animationSpeed);
        animated = true;
      }
    }

    // Animate zoom
    if (this.targetZoom !== null) {
      const diff = Math.abs(this.zoomLevel - this.targetZoom);
      if (diff < 0.1) {
        this.zoomLevel = this.targetZoom;
        this.targetZoom = null;
      } else {
        this.zoomLevel += (this.targetZoom - this.zoomLevel) * this.animationSpeed;
        animated = true;
      }
    }

    return animated;
  }

  /**
   * Set zoom constraints
   */
  setZoomConstraints(min: number, max: number): void {
    this.minZoom = min;
    this.maxZoom = max;
    this.zoomLevel = Math.max(min, Math.min(max, this.zoomLevel));
  }

  /**
   * Get current view bounds in world space
   */
  getViewBounds(viewportWidth: number, viewportHeight: number): {
    min: Vector2;
    max: Vector2;
  } {
    const topLeft = this.screenToWorld(new Vector2(0, 0), viewportWidth, viewportHeight);
    const bottomRight = this.screenToWorld(
      new Vector2(viewportWidth, viewportHeight),
      viewportWidth,
      viewportHeight
    );

    return {
      min: new Vector2(
        Math.min(topLeft.x, bottomRight.x),
        Math.min(topLeft.y, bottomRight.y)
      ),
      max: new Vector2(
        Math.max(topLeft.x, bottomRight.x),
        Math.max(topLeft.y, bottomRight.y)
      ),
    };
  }

  /**
   * Serialize camera state
   */
  serialize(): {
    position: [number, number];
    zoom: number;
    rotation: number;
  } {
    return {
      position: this.position.toArray(),
      zoom: this.zoomLevel,
      rotation: this.rotation,
    };
  }

  /**
   * Deserialize camera state
   */
  static deserialize(data: {
    position: [number, number];
    zoom: number;
    rotation: number;
  }): Camera2D {
    return new Camera2D(
      Vector2.fromArray(data.position),
      data.zoom,
      data.rotation
    );
  }
}
