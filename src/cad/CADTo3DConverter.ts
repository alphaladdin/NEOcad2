import * as THREE from 'three';
import { Entity, EntityType } from './entities/Entity';
import { Line } from './entities/Line';
import { Polyline } from './entities/Polyline';
import { Arc } from './entities/Arc';
import { Circle } from './entities/Circle';
import { Room } from './entities/Room';
import { Wall } from './entities/Wall';
import { WallCornerHelper } from '../rendering/WallCornerHelper';
import { FramingEngine } from '../framing/FramingEngine';

/**
 * Conversion mode for different entity types
 */
export enum ConversionMode {
  /** Convert to vertical walls (lines/polylines become vertical extrusions) */
  WALL = 'wall',
  /** Convert to horizontal slabs (rectangles/circles become flat surfaces) */
  SLAB = 'slab',
  /** Convert to 3D lines (thin cylindrical representations) */
  LINE_3D = 'line_3d',
  /** Convert circles to vertical columns */
  COLUMN = 'column',
}

/**
 * Configuration for CAD to 3D conversion
 */
export interface CADTo3DConfig {
  /** Default height/extrusion for 2D entities */
  defaultHeight?: number;
  /** Default material for 3D geometry */
  defaultMaterial?: THREE.Material;
  /** Whether to create filled shapes or just outlines */
  filled?: boolean;
  /** Line width for 3D lines */
  lineWidth?: number;
  /** Conversion mode for lines and polylines */
  lineMode?: ConversionMode;
  /** Conversion mode for rectangles */
  rectangleMode?: ConversionMode;
  /** Conversion mode for circles */
  circleMode?: ConversionMode;
  /** Slab thickness (for SLAB mode) */
  slabThickness?: number;
}

/**
 * Converts 2D CAD entities to 3D Three.js geometry
 */
export class CADTo3DConverter {
  private config: Required<CADTo3DConfig>;
  private entityMeshMap: Map<Entity, THREE.Object3D> = new Map();
  private cornerHelper: WallCornerHelper = new WallCornerHelper();
  private framingEngine: FramingEngine = new FramingEngine();
  private wallsForFraming: Wall[] = []; // Collect walls for batch framing

  constructor(config: CADTo3DConfig = {}) {
    this.config = {
      defaultHeight: config.defaultHeight ?? 3.0, // Default 3m height for walls
      defaultMaterial:
        config.defaultMaterial ??
        new THREE.MeshStandardMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
        }),
      filled: config.filled ?? true,
      lineWidth: config.lineWidth ?? 0.1, // 10cm thick lines
      lineMode: config.lineMode ?? ConversionMode.WALL,
      rectangleMode: config.rectangleMode ?? ConversionMode.SLAB,
      circleMode: config.circleMode ?? ConversionMode.SLAB,
      slabThickness: config.slabThickness ?? 0.2, // 20cm slab thickness
    };
  }

  /**
   * Convert a CAD entity to a 3D mesh
   */
  convert(entity: Entity): THREE.Object3D | null {
    let mesh: THREE.Object3D | null = null;

    switch (entity.getType()) {
      case EntityType.LINE:
        mesh = this.convertLine(entity as Line);
        break;
      case EntityType.WALL:
        mesh = this.convertWall(entity as Wall);
        break;
      case EntityType.POLYLINE:
        mesh = this.convertPolyline(entity as Polyline);
        break;
      case EntityType.ARC:
        mesh = this.convertArc(entity as Arc);
        break;
      case EntityType.CIRCLE:
        mesh = this.convertCircle(entity as Circle);
        break;
      case EntityType.ROOM:
        mesh = this.convertRoom(entity as Room);
        break;
      default:
        console.warn(`Unsupported entity type: ${entity.getType()}`);
        return null;
    }

    if (mesh) {
      this.entityMeshMap.set(entity, mesh);
      // Store entity reference on mesh for reverse lookup
      mesh.userData.cadEntity = entity;
    }

    return mesh;
  }

  /**
   * Convert a wall entity to 3D (with proper assembly layers)
   */
  private convertWall(wall: Wall): THREE.Object3D {
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const wallType = wall.getWallType();

    // Create a group to hold all wall layers
    const wallGroup = new THREE.Group();

    // Get wall dimensions
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const height = wallType.getHeightMeters(); // Default wall height in meters
    const totalThickness = wallType.getThicknessMeters(); // Total thickness in meters

    // Extend wall length slightly at both ends to create proper corner overlaps
    // This prevents gaps at corners
    const cornerExtension = totalThickness / 2; // Extend by half wall thickness on each side
    const extendedLength = length + cornerExtension * 2;

    // Position at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Get wall layers
    const layers = wallType.layers;

    // Calculate layer positions (from interior to exterior)
    let currentOffset = -totalThickness / 2; // Start from interior side

    layers.forEach((layerDef) => {
      const layerThickness = layerDef.thickness * 0.0254; // Convert inches to meters

      // Skip air cavities (they're just gaps)
      if (layerDef.material === 'Air') {
        currentOffset += layerThickness;
        return;
      }

      // Determine layer color
      let layerColor = 0x888888; // Default gray
      if (layerDef.material === 'Gypsum') {
        layerColor = 0xEEEEEE; // Light gray for drywall
      } else if (layerDef.material === 'OSB') {
        layerColor = 0xD4A574; // Tan for OSB
      } else if (layerDef.material === 'Wood Framing') {
        layerColor = 0xDEB887; // Burlywood for studs
      } else if (layerDef.material === 'Lap Siding') {
        layerColor = 0xFFFFFF; // White for lap siding
      }

      // Create material for this layer
      const material = new THREE.MeshStandardMaterial({
        color: layerColor,
        side: THREE.DoubleSide,
      });

      // Position for layer center
      const layerCenterOffset = currentOffset + layerThickness / 2;

      // Special handling for lap siding - create horizontal boards
      if (layerDef.material === 'Lap Siding') {
        const boardExposure = 8 * 0.0254; // 8 inches in meters (0.2032m)
        const boardActualHeight = 8.5 * 0.0254; // 8.5" boards with 0.5" overlap
        const boardCount = Math.ceil(height / boardExposure);

        // Create individual horizontal boards
        for (let i = 0; i < boardCount; i++) {
          const boardY = i * boardExposure + boardActualHeight / 2;

          // Create board geometry (extended for corner overlap)
          const boardGeometry = new THREE.BoxGeometry(extendedLength, boardActualHeight, layerThickness);
          const boardMesh = new THREE.Mesh(boardGeometry, material);

          // Position board
          boardMesh.position.set(0, boardY, layerCenterOffset);
          boardMesh.castShadow = true;
          boardMesh.receiveShadow = true;
          wallGroup.add(boardMesh);

          // Add a thin dark line at the bottom of each board for definition
          if (i > 0) {
            const lineGeometry = new THREE.BoxGeometry(extendedLength, 0.005, layerThickness + 0.001);
            const lineMaterial = new THREE.MeshStandardMaterial({
              color: 0x333333,
              side: THREE.DoubleSide,
            });
            const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
            lineMesh.position.set(0, boardY - boardActualHeight / 2, layerCenterOffset);
            lineMesh.castShadow = true;
            lineMesh.receiveShadow = true;
            wallGroup.add(lineMesh);
          }
        }
      } else {
        // Standard layer rendering for non-siding materials (extended for corner overlap)
        const geometry = new THREE.BoxGeometry(extendedLength, height, layerThickness);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, height / 2, layerCenterOffset);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        wallGroup.add(mesh);
      }

      currentOffset += layerThickness;
    });

    // Position and rotate the entire wall group
    wallGroup.position.set(midX, 0, midY);
    wallGroup.rotation.y = -angle; // Rotate around Y axis

    return wallGroup;
  }

  /**
   * Convert a line entity to 3D
   */
  private convertLine(line: Line): THREE.Object3D {
    const start = line.getStart();
    const end = line.getEnd();

    // Create a rectangular wall from the line
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    const geometry = new THREE.BoxGeometry(length, this.config.defaultHeight, this.config.lineWidth);

    const material = this.getMaterialForEntity(line);
    const mesh = new THREE.Mesh(geometry, material);

    // Position at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    mesh.position.set(midX, this.config.defaultHeight / 2, midY);
    mesh.rotation.y = -angle; // Rotate around Y axis

    return mesh;
  }

  /**
   * Convert a polyline entity to 3D
   */
  private convertPolyline(polyline: Polyline): THREE.Object3D {
    const vertices = polyline.getVertices();

    if (vertices.length < 2) return new THREE.Group();

    // Check if this is a rectangle (4 vertices in a closed shape)
    const isRectangle = vertices.length === 4 && this.isClosedPolyline(polyline);

    if (isRectangle && this.config.rectangleMode === ConversionMode.SLAB) {
      return this.convertRectangleToSlab(polyline);
    }

    // Default: Create walls from polyline segments
    const group = new THREE.Group();
    const segmentCount = polyline.getSegmentCount();

    for (let i = 0; i < segmentCount; i++) {
      const [start, end] = polyline.getSegment(i);

      const length = start.distanceTo(end);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      const geometry = new THREE.BoxGeometry(
        length,
        this.config.defaultHeight,
        this.config.lineWidth
      );

      const material = this.getMaterialForEntity(polyline);
      const mesh = new THREE.Mesh(geometry, material);

      // Position at midpoint
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      mesh.position.set(midX, this.config.defaultHeight / 2, midY);
      mesh.rotation.y = -angle;

      group.add(mesh);
    }

    return group;
  }

  /**
   * Check if a polyline is closed
   */
  private isClosedPolyline(polyline: Polyline): boolean {
    const vertices = polyline.getVertices();
    if (vertices.length < 2) return false;

    const first = vertices[0];
    const last = vertices[vertices.length - 1];

    // Check if first and last points are very close (within 0.001 units)
    return first.distanceTo(last) < 0.001;
  }

  /**
   * Convert a rectangle polyline to a horizontal slab
   */
  private convertRectangleToSlab(polyline: Polyline): THREE.Object3D {
    const vertices = polyline.getVertices();

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    vertices.forEach(v => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    });

    const width = maxX - minX;
    const depth = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Create horizontal slab
    const geometry = new THREE.BoxGeometry(width, this.config.slabThickness, depth);
    const material = this.getMaterialForEntity(polyline);
    const mesh = new THREE.Mesh(geometry, material);

    // Position at ground level
    mesh.position.set(centerX, this.config.slabThickness / 2, centerY);

    return mesh;
  }

  /**
   * Convert an arc entity to 3D
   */
  private convertArc(arc: Arc): THREE.Object3D {
    const center = arc.getCenter();
    const radius = arc.getRadius();
    const startAngle = arc.getStartAngle();
    const endAngle = arc.getEndAngle();
    const counterClockwise = arc.isCounterClockwise();

    // Create a curved wall using a tube geometry
    const curve = new THREE.EllipseCurve(
      center.x, // center x
      center.y, // center y (in 3D this is Z)
      radius, // x radius
      radius, // y radius
      startAngle,
      endAngle,
      !counterClockwise, // THREE.js uses opposite convention
      0 // rotation
    );

    const points = curve.getPoints(32);
    const path = new THREE.CurvePath<THREE.Vector3>();

    // Convert 2D points to 3D path
    const points3D = points.map(p => new THREE.Vector3(p.x, 0, p.y));
    path.add(new THREE.CatmullRomCurve3(points3D));

    // Create tube geometry for the wall
    const tubeGeometry = new THREE.TubeGeometry(
      path.curves[0],
      32, // tubular segments
      this.config.lineWidth / 2, // radius
      8, // radial segments
      false // closed
    );

    const material = this.getMaterialForEntity(arc);
    const mesh = new THREE.Mesh(tubeGeometry, material);

    // Scale in Y to create wall height
    mesh.scale.y = this.config.defaultHeight / this.config.lineWidth;
    mesh.position.y = this.config.defaultHeight / 2;

    return mesh;
  }

  /**
   * Convert a circle entity to 3D
   */
  private convertCircle(circle: Circle): THREE.Object3D {
    const center = circle.getCenter();
    const radius = circle.getRadius();

    // Choose conversion mode
    if (this.config.circleMode === ConversionMode.SLAB) {
      // Create a flat circular disc (slab)
      const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        this.config.slabThickness,
        32
      );

      const material = this.getMaterialForEntity(circle);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(center.x, this.config.slabThickness / 2, center.y);

      return mesh;
    } else {
      // Default: Create a column (vertical cylinder)
      if (this.config.filled) {
        // Filled column
        const geometry = new THREE.CylinderGeometry(
          radius,
          radius,
          this.config.defaultHeight,
          32
        );

        const material = this.getMaterialForEntity(circle);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(center.x, this.config.defaultHeight / 2, center.y);

        return mesh;
      } else {
        // Hollow tube (torus)
        const geometry = new THREE.TorusGeometry(
          radius,
          this.config.lineWidth / 2,
          16,
          32
        );

        const material = this.getMaterialForEntity(circle);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(center.x, this.config.defaultHeight / 2, center.y);
        mesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
        mesh.scale.y = this.config.defaultHeight / this.config.lineWidth;

        return mesh;
      }
    }
  }

  /**
   * Convert a room entity to 3D (floor slab)
   */
  private convertRoom(room: Room): THREE.Object3D {
    const boundary = room.getBoundary();

    if (boundary.length < 3) {
      console.warn('Room has insufficient boundary points');
      return new THREE.Group();
    }

    // Create a shape from the room boundary
    const shape = new THREE.Shape();

    // Move to first point
    shape.moveTo(boundary[0].x, boundary[0].y);

    // Draw lines to remaining points
    for (let i = 1; i < boundary.length; i++) {
      shape.lineTo(boundary[i].x, boundary[i].y);
    }

    // Close the shape
    shape.closePath();

    // Extrude the shape to create a thin floor slab
    const extrudeSettings = {
      depth: this.config.slabThickness,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Get room type color
    const roomColor = this.getRoomColor(room);
    const material = new THREE.MeshStandardMaterial({
      color: roomColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position at ground level (rotate to horizontal and position)
    mesh.rotation.x = -Math.PI / 2; // Rotate from XY plane to XZ plane
    mesh.position.y = 0; // At ground level

    return mesh;
  }

  /**
   * Get color for a room based on its type
   */
  private getRoomColor(room: Room): THREE.Color {
    const roomType = room.getRoomType();

    // Color mapping for different room types
    const colorMap: Record<string, number> = {
      'bedroom': 0x87CEEB, // Sky blue
      'master_bedroom': 0x4682B4, // Steel blue
      'bathroom': 0xADD8E6, // Light blue
      'master_bathroom': 0x5F9EA0, // Cadet blue
      'kitchen': 0xFFDAB9, // Peach
      'living_room': 0x90EE90, // Light green
      'dining_room': 0x98FB98, // Pale green
      'family_room': 0x9ACD32, // Yellow green
      'office': 0xF0E68C, // Khaki
      'laundry': 0xE0E0E0, // Light gray
      'garage': 0xA9A9A9, // Dark gray
      'hallway': 0xD3D3D3, // Light gray
      'closet': 0xC0C0C0, // Silver
      'pantry': 0xF5DEB3, // Wheat
      'mudroom': 0xCD853F, // Peru
      'foyer': 0xDDA0DD, // Plum
      'utility': 0xB0C4DE, // Light steel blue
      'undefined': 0xCCCCCC, // Gray
    };

    const colorValue = colorMap[roomType] || 0xCCCCCC;
    return new THREE.Color(colorValue);
  }

  /**
   * Get material for an entity based on its layer/color
   */
  private getMaterialForEntity(entity: Entity): THREE.Material {
    const color = entity.getColor();

    if (color) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        side: THREE.DoubleSide,
      });
    }

    return this.config.defaultMaterial;
  }

  /**
   * Remove a 3D mesh for an entity
   */
  remove(entity: Entity): THREE.Object3D | null {
    const mesh = this.entityMeshMap.get(entity);
    if (mesh) {
      this.entityMeshMap.delete(entity);

      // Dispose geometry and materials
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    }
    return mesh ?? null;
  }

  /**
   * Get the 3D mesh for an entity
   */
  getMesh(entity: Entity): THREE.Object3D | null {
    return this.entityMeshMap.get(entity) ?? null;
  }

  /**
   * Update the 3D representation of an entity
   */
  update(entity: Entity, scene: THREE.Scene): void {
    // Remove old mesh
    const oldMesh = this.remove(entity);
    if (oldMesh) {
      scene.remove(oldMesh);
    }

    // Create new mesh
    const newMesh = this.convert(entity);
    if (newMesh) {
      scene.add(newMesh);
    }
  }

  /**
   * Convert multiple walls together with proper corner connections
   * This creates a group with all walls and their corner geometry
   */
  convertWallsWithCorners(walls: Wall[]): THREE.Group {
    const group = new THREE.Group();

    // Find all wall connections
    const connections = this.cornerHelper.findWallConnections(walls);

    // Convert each wall
    walls.forEach(wall => {
      const wallMesh = this.convertWall(wall);
      if (wallMesh) {
        group.add(wallMesh);
      }
    });

    // Create corner geometry for each connection
    connections.forEach((conn, wall) => {
      const wallType = wall.getWallType();
      const height = wallType.getHeightMeters();
      const layers = wallType.layers;

      let currentOffset = -wallType.getThicknessMeters() / 2;

      // Create corner pieces for each layer
      layers.forEach((layerDef) => {
        const layerThickness = layerDef.thickness; // In inches

        // Skip air cavities
        if (layerDef.material === 'Air') {
          currentOffset += layerDef.thickness * 0.0254;
          return;
        }

        // Create corner at start if connected
        if (conn.start.length > 0) {
          const cornerMesh = this.cornerHelper.createCornerGeometry(
            wall,
            true,
            conn.start,
            height,
            layerDef,
            layerThickness,
            currentOffset
          );
          if (cornerMesh) {
            group.add(cornerMesh);
          }
        }

        // Create corner at end if connected
        if (conn.end.length > 0) {
          const cornerMesh = this.cornerHelper.createCornerGeometry(
            wall,
            false,
            conn.end,
            height,
            layerDef,
            layerThickness,
            currentOffset
          );
          if (cornerMesh) {
            group.add(cornerMesh);
          }
        }

        currentOffset += layerDef.thickness * 0.0254;
      });
    });

    return group;
  }

  /**
   * Convert walls with full structural framing (studs, plates, corner posts)
   * This uses the FramingEngine for accurate construction
   */
  convertWallsWithFraming(walls: Wall[]): THREE.Group {
    const group = new THREE.Group();

    // Generate structural framing
    const framing = this.framingEngine.generateFraming(walls);
    group.add(framing);

    // Add sheathing and finish layers to each wall
    walls.forEach(wall => {
      const wallType = wall.getWallType();
      const layers = wallType.layers;
      const totalThickness = wallType.getThicknessMeters();

      let currentOffset = -totalThickness / 2;

      layers.forEach(layerDef => {
        const layerThickness = layerDef.thickness * 0.0254;

        // Skip framing (already handled) and air
        if (layerDef.material === 'Wood Framing' || layerDef.material === 'Air') {
          currentOffset += layerThickness;
          return;
        }

        // Add sheathing layers (OSB, drywall)
        if (layerDef.material === 'OSB' || layerDef.material === 'Gypsum') {
          const wallGroup = this.createWallSheathing(wall, layerDef, currentOffset);
          group.add(wallGroup);
        }

        // Add finish layers (lap siding)
        if (layerDef.material === 'Lap Siding') {
          const sidingGroup = this.createLapSiding(wall, layerDef, currentOffset);
          group.add(sidingGroup);
        }

        currentOffset += layerThickness;
      });
    });

    return group;
  }

  /**
   * Create sheathing layer for a wall
   */
  private createWallSheathing(wall: Wall, layerDef: any, offset: number): THREE.Group {
    const group = new THREE.Group();
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const wallType = wall.getWallType();
    const height = wallType.getHeightMeters();
    const layerThickness = layerDef.thickness * 0.0254;

    // Extend for corner overlap
    const totalThickness = wallType.getThicknessMeters();
    const cornerExtension = totalThickness / 2;
    const extendedLength = length + cornerExtension * 2;

    let color = 0x888888;
    if (layerDef.material === 'OSB') {
      color = 0xD4A574;
    } else if (layerDef.material === 'Gypsum') {
      color = 0xEEEEEE;
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });

    const geometry = new THREE.BoxGeometry(extendedLength, height, layerThickness);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, height / 2, offset);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Position and rotate
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    group.position.set(midX, 0, midY);
    group.rotation.y = -angle;

    return group;
  }

  /**
   * Create lap siding for a wall
   */
  private createLapSiding(wall: Wall, layerDef: any, offset: number): THREE.Group {
    const group = new THREE.Group();
    const start = wall.getStartPoint();
    const end = wall.getEndPoint();
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const wallType = wall.getWallType();
    const height = wallType.getHeightMeters();
    const layerThickness = layerDef.thickness * 0.0254;

    // Extend for corner overlap
    const totalThickness = wallType.getThicknessMeters();
    const cornerExtension = totalThickness / 2;
    const extendedLength = length + cornerExtension * 2;

    const boardExposure = 8 * 0.0254; // 8"
    const boardActualHeight = 8.5 * 0.0254; // 8.5"
    const boardCount = Math.ceil(height / boardExposure);

    const material = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });

    for (let i = 0; i < boardCount; i++) {
      const boardY = i * boardExposure + boardActualHeight / 2;

      const boardGeometry = new THREE.BoxGeometry(extendedLength, boardActualHeight, layerThickness);
      const boardMesh = new THREE.Mesh(boardGeometry, material);
      boardMesh.position.set(0, boardY, offset);
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      group.add(boardMesh);

      if (i > 0) {
        const lineGeometry = new THREE.BoxGeometry(extendedLength, 0.005, layerThickness + 0.001);
        const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
        lineMesh.position.set(0, boardY - boardActualHeight / 2, offset);
        lineMesh.castShadow = true;
        lineMesh.receiveShadow = true;
        group.add(lineMesh);
      }
    }

    // Position and rotate
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    group.position.set(midX, 0, midY);
    group.rotation.y = -angle;

    return group;
  }

  /**
   * Clear all tracked meshes
   */
  clear(): void {
    this.entityMeshMap.forEach((mesh) => {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    });
    this.entityMeshMap.clear();
  }

  /**
   * Set default height for extrusions
   */
  setDefaultHeight(height: number): void {
    this.config.defaultHeight = height;
  }

  /**
   * Set line width
   */
  setLineWidth(width: number): void {
    this.config.lineWidth = width;
  }
}
