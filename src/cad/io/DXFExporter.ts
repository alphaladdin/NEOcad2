import { Drawing } from '../document/Drawing';
import { Entity } from '../entities/Entity';
import { Line } from '../entities/Line';
import { Circle } from '../entities/Circle';
import { Arc } from '../entities/Arc';
import { Polyline } from '../entities/Polyline';

/**
 * DXFExporter - Export drawings to DXF format (ASCII)
 */
export class DXFExporter {
  private output: string[] = [];

  /**
   * Export drawing to DXF string
   */
  export(drawing: Drawing): string {
    this.output = [];

    this.writeHeader(drawing);
    this.writeTables(drawing);
    this.writeEntities(drawing);
    this.writeEOF();

    return this.output.join('\n');
  }

  /**
   * Write DXF header section
   */
  private writeHeader(drawing: Drawing): void {
    this.writeSection('HEADER');

    // Drawing units
    this.writeVariable('$INSUNITS', 4); // Millimeters

    // Drawing limits
    const bounds = drawing.getBounds();
    if (bounds) {
      this.writeVariable('$EXTMIN', `${bounds.min.x}\n${bounds.min.y}\n0.0`);
      this.writeVariable('$EXTMAX', `${bounds.max.x}\n${bounds.max.y}\n0.0`);
    }

    this.writeEndSection();
  }

  /**
   * Write DXF tables section
   */
  private writeTables(drawing: Drawing): void {
    this.writeSection('TABLES');

    // Layer table
    this.writeTable('LAYER');
    const layers = drawing.getLayerManager().getLayers();
    for (const layer of layers) {
      this.output.push('0', 'LAYER');
      this.output.push('2', layer.name);
      this.output.push('70', '0'); // Standard flags
      this.output.push('62', this.colorToACI(layer.color)); // Color
      this.output.push('6', 'CONTINUOUS'); // Line type
    }
    this.writeEndTable();

    this.writeEndSection();
  }

  /**
   * Write DXF entities section
   */
  private writeEntities(drawing: Drawing): void {
    this.writeSection('ENTITIES');

    for (const entity of drawing.getEntities()) {
      if (!entity.isVisible()) continue;

      this.writeEntity(entity);
    }

    this.writeEndSection();
  }

  /**
   * Write a single entity
   */
  private writeEntity(entity: Entity): void {
    if (entity instanceof Line) {
      this.writeLine(entity);
    } else if (entity instanceof Circle) {
      this.writeCircle(entity);
    } else if (entity instanceof Arc) {
      this.writeArc(entity);
    } else if (entity instanceof Polyline) {
      this.writePolyline(entity);
    }
  }

  /**
   * Write LINE entity
   */
  private writeLine(line: Line): void {
    const start = line.getStart();
    const end = line.getEnd();

    this.output.push('0', 'LINE');
    this.output.push('8', line.getLayer()); // Layer
    if (line.getColor()) {
      this.output.push('62', this.colorToACI(line.getColor()!));
    }
    this.output.push('10', start.x.toString()); // Start X
    this.output.push('20', start.y.toString()); // Start Y
    this.output.push('30', '0.0'); // Start Z
    this.output.push('11', end.x.toString()); // End X
    this.output.push('21', end.y.toString()); // End Y
    this.output.push('31', '0.0'); // End Z
  }

  /**
   * Write CIRCLE entity
   */
  private writeCircle(circle: Circle): void {
    const center = circle.getCenter();
    const radius = circle.getRadius();

    this.output.push('0', 'CIRCLE');
    this.output.push('8', circle.getLayer());
    if (circle.getColor()) {
      this.output.push('62', this.colorToACI(circle.getColor()!));
    }
    this.output.push('10', center.x.toString()); // Center X
    this.output.push('20', center.y.toString()); // Center Y
    this.output.push('30', '0.0'); // Center Z
    this.output.push('40', radius.toString()); // Radius
  }

  /**
   * Write ARC entity
   */
  private writeArc(arc: Arc): void {
    const center = arc.getCenter();
    const radius = arc.getRadius();
    const startAngle = (arc.getStartAngle() * 180) / Math.PI;
    const endAngle = (arc.getEndAngle() * 180) / Math.PI;

    this.output.push('0', 'ARC');
    this.output.push('8', arc.getLayer());
    if (arc.getColor()) {
      this.output.push('62', this.colorToACI(arc.getColor()!));
    }
    this.output.push('10', center.x.toString()); // Center X
    this.output.push('20', center.y.toString()); // Center Y
    this.output.push('30', '0.0'); // Center Z
    this.output.push('40', radius.toString()); // Radius
    this.output.push('50', startAngle.toString()); // Start angle
    this.output.push('51', endAngle.toString()); // End angle
  }

  /**
   * Write POLYLINE/LWPOLYLINE entity
   */
  private writePolyline(polyline: Polyline): void {
    const vertices = polyline.getVertices();
    const closed = polyline.isClosed();

    // Use LWPOLYLINE for 2D polylines
    this.output.push('0', 'LWPOLYLINE');
    this.output.push('8', polyline.getLayer());
    if (polyline.getColor()) {
      this.output.push('62', this.colorToACI(polyline.getColor()!));
    }
    this.output.push('90', vertices.length.toString()); // Vertex count
    this.output.push('70', closed ? '1' : '0'); // Closed flag

    for (const vertex of vertices) {
      this.output.push('10', vertex.x.toString());
      this.output.push('20', vertex.y.toString());
    }
  }

  /**
   * Write section header
   */
  private writeSection(name: string): void {
    this.output.push('0', 'SECTION');
    this.output.push('2', name);
  }

  /**
   * Write section end
   */
  private writeEndSection(): void {
    this.output.push('0', 'ENDSEC');
  }

  /**
   * Write table header
   */
  private writeTable(name: string): void {
    this.output.push('0', 'TABLE');
    this.output.push('2', name);
  }

  /**
   * Write table end
   */
  private writeEndTable(): void {
    this.output.push('0', 'ENDTAB');
  }

  /**
   * Write header variable
   */
  private writeVariable(name: string, value: string | number): void {
    this.output.push('9', name);
    if (typeof value === 'string' && value.includes('\n')) {
      const parts = value.split('\n');
      for (let i = 0; i < parts.length; i++) {
        this.output.push((10 + i * 10).toString(), parts[i]);
      }
    } else {
      this.output.push('40', value.toString());
    }
  }

  /**
   * Write EOF
   */
  private writeEOF(): void {
    this.output.push('0', 'EOF');
  }

  /**
   * Convert hex color to AutoCAD Color Index (ACI)
   * Simplified conversion - maps to basic colors
   */
  private colorToACI(hexColor: string): string {
    const colorMap: Record<string, string> = {
      '#ff0000': '1', // Red
      '#ffff00': '2', // Yellow
      '#00ff00': '3', // Green
      '#00ffff': '4', // Cyan
      '#0000ff': '5', // Blue
      '#ff00ff': '6', // Magenta
      '#ffffff': '7', // White
      '#808080': '8', // Gray
    };

    return colorMap[hexColor.toLowerCase()] || '7'; // Default to white
  }

  /**
   * Static export method
   */
  static export(drawing: Drawing): string {
    const exporter = new DXFExporter();
    return exporter.export(drawing);
  }

  /**
   * Save to file
   */
  static async saveToFile(drawing: Drawing, filename: string): Promise<void> {
    const dxf = this.export(drawing);

    // Ensure .dxf extension
    if (!filename.endsWith('.dxf')) {
      filename += '.dxf';
    }

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
