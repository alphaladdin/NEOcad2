import { Vector2 } from '../Vector2';
import { Polyline } from '../entities/Polyline';
import { DrawingTool, ToolState, MouseEventData, KeyEventData } from './DrawingTool';

/**
 * PolylineTool - Draw connected polylines by clicking multiple points
 */
export class PolylineTool extends DrawingTool {
  private vertices: Vector2[] = [];
  private currentPoint: Vector2 | null = null;
  private closed: boolean = false;

  getName(): string {
    return 'Polyline';
  }

  getDescription(): string {
    return 'Draw connected line segments';
  }

  getPrompt(): string {
    if (this.vertices.length === 0) {
      return 'Specify first point';
    }
    return `Specify next point or press Enter to finish (${this.vertices.length} points)`;
  }

  onMouseDown(event: MouseEventData): void {
    if (event.button !== 0) return; // Only left mouse button

    const snappedPoint = this.applySnap(event.worldPos);

    if (this.vertices.length === 0) {
      // First click - start polyline
      this.vertices.push(snappedPoint);
      this.polarTracking.setBasePoint(snappedPoint);
      this.dynamicInput.setBasePoint(snappedPoint);
      this.state = ToolState.PREVIEW;
    } else {
      // Check if clicking near the first point to close the polyline
      const firstPoint = this.vertices[0];
      const distToFirst = snappedPoint.distanceTo(firstPoint);

      if (distToFirst < 0.5 && this.vertices.length >= 3) {
        // Close the polyline
        this.closed = true;
        this.completePolyline();
        this.reset();
      } else {
        // Add new vertex
        this.vertices.push(snappedPoint);
        this.polarTracking.setBasePoint(snappedPoint);
        this.dynamicInput.setBasePoint(snappedPoint);
        this.currentPoint = null;
      }
    }

    this.viewport.requestRedraw();
  }

  onMouseMove(event: MouseEventData): void {
    if (this.vertices.length === 0) return;

    this.currentPoint = this.applySnap(event.worldPos);

    // Update preview
    this.updatePreview();
    this.viewport.requestRedraw();
  }

  onMouseUp(event: MouseEventData): void {
    // Not used for polyline tool
  }

  onKeyDown(event: KeyEventData): boolean {
    // Handle Enter to finish polyline
    if (event.key === 'Enter' && this.vertices.length >= 2) {
      this.completePolyline();
      this.reset();
      return true;
    }

    // Handle 'C' to close polyline
    if ((event.key === 'c' || event.key === 'C') && this.vertices.length >= 3) {
      this.closed = true;
      this.completePolyline();
      this.reset();
      return true;
    }

    // Handle Backspace to undo last vertex
    if (event.key === 'Backspace' && this.vertices.length > 0) {
      this.vertices.pop();
      if (this.vertices.length > 0) {
        const lastVertex = this.vertices[this.vertices.length - 1];
        this.polarTracking.setBasePoint(lastVertex);
        this.dynamicInput.setBasePoint(lastVertex);
      } else {
        this.polarTracking.setBasePoint(null);
        this.dynamicInput.setBasePoint(null);
        this.state = ToolState.ACTIVE;
      }
      this.viewport.requestRedraw();
      return true;
    }

    return super.onKeyDown(event);
  }

  private updatePreview(): void {
    if (this.vertices.length === 0 || !this.currentPoint) {
      this.previewEntity = null;
      return;
    }

    // Create preview polyline with all vertices plus current point
    const previewVertices = [...this.vertices, this.currentPoint];
    this.previewEntity = new Polyline(previewVertices, false);
  }

  private completePolyline(): void {
    if (this.vertices.length < 2) return;

    // Create final polyline entity
    const polyline = new Polyline(this.vertices, this.closed, 'A-WALL');
    this.completedEntities.push(polyline);

    // Add to snap manager
    this.snapManager.addEntity(polyline as any);
  }

  protected onReset(): void {
    this.vertices = [];
    this.currentPoint = null;
    this.closed = false;
    this.previewEntity = null;
    this.polarTracking.setBasePoint(null);
    this.dynamicInput.setBasePoint(null);
  }

  protected onComplete(): void {
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render existing vertices
    if (this.vertices.length > 0) {
      const verticesScreen = this.vertices.map(v => this.viewport.worldToScreen(v));

      ctx.save();

      // Draw polyline segments
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(verticesScreen[0].x, verticesScreen[0].y);
      for (let i = 1; i < verticesScreen.length; i++) {
        ctx.lineTo(verticesScreen[i].x, verticesScreen[i].y);
      }
      ctx.stroke();

      // Draw preview segment to current point
      if (this.currentPoint) {
        const currentScreen = this.viewport.worldToScreen(this.currentPoint);
        const lastScreen = verticesScreen[verticesScreen.length - 1];

        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lastScreen.x, lastScreen.y);
        ctx.lineTo(currentScreen.x, currentScreen.y);
        ctx.stroke();

        // Check if close to first point
        const firstScreen = verticesScreen[0];
        const distToFirst = Math.sqrt(
          Math.pow(currentScreen.x - firstScreen.x, 2) +
          Math.pow(currentScreen.y - firstScreen.y, 2)
        );

        if (distToFirst < 20 && this.vertices.length >= 3) {
          // Draw closing segment
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(currentScreen.x, currentScreen.y);
          ctx.lineTo(firstScreen.x, firstScreen.y);
          ctx.stroke();

          // Highlight first point
          ctx.fillStyle = '#00ff00';
          ctx.beginPath();
          ctx.arc(firstScreen.x, firstScreen.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw vertices
      ctx.setLineDash([]);
      ctx.fillStyle = '#4a9eff';
      verticesScreen.forEach((vertex, index) => {
        const size = index === 0 ? 6 : 5;
        ctx.beginPath();
        ctx.arc(vertex.x, vertex.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Draw white outline on first point
        if (index === 0 && this.vertices.length > 1) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      ctx.restore();
    }

    // Render polar tracking if enabled
    if (this.vertices.length > 0 && this.currentPoint && this.polarTracking.isEnabled()) {
      const basePoint = this.vertices[this.vertices.length - 1];
      const trackResult = this.polarTracking.track(this.currentPoint, basePoint);
      if (trackResult) {
        const bounds = this.viewport.getCamera().getViewBounds(
          this.viewport.getCanvas().width,
          this.viewport.getCanvas().height
        );
        this.polarTracking.renderGuides(
          ctx,
          trackResult,
          (p) => this.viewport.worldToScreen(p),
          bounds
        );
      }
    }

    // Render snap indicator
    if (this.currentPoint) {
      const objectSnap = this.snapManager.findSnap(this.currentPoint, (p) =>
        this.viewport.worldToScreen(p)
      );
      if (objectSnap) {
        this.snapManager.renderSnapIndicator(ctx, objectSnap, (p) =>
          this.viewport.worldToScreen(p)
        );
      }
    }

    // Render dynamic input
    if (this.currentPoint) {
      const cursorScreen = this.viewport.worldToScreen(this.currentPoint);
      const basePoint = this.vertices.length > 0 ? this.vertices[this.vertices.length - 1] : undefined;
      this.dynamicInput.updateFromCursor(this.currentPoint, basePoint);
      this.dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  }

  /**
   * Get the current polyline vertices
   */
  getVertices(): Vector2[] {
    return [...this.vertices];
  }

  /**
   * Get vertex count
   */
  getVertexCount(): number {
    return this.vertices.length;
  }

  /**
   * Check if polyline will be closed
   */
  willBeClosed(): boolean {
    return this.closed;
  }
}
