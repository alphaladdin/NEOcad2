import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WallTypeManager } from '../framing/WallTypeManager.js';
import { SketchMode } from '../tools/SketchMode.js';
import { WallLayerRenderer } from '../framing/WallLayerRenderer.js';
import { EventBus, Events } from '../core/EventBus.js';
import { ParameterEngine } from '../parametric/ParameterEngine.js';
import { getGeometryEngine } from '../parametric/GeometryEngineWrapper.js';
import { ParametricWall } from '../parametric/ParametricWall.js';
import { CanvasViewport } from '../cad/CanvasViewport.js';
import { Vector2 } from '../cad/Vector2.js';
import { LayerManager } from '../cad/LayerManager.js';
import { SnapManager, SnapType, LineEntity } from '../cad/SnapManager.js';
import { PolarTrackingManager } from '../cad/PolarTrackingManager.js';
import { DynamicInput, InputMode } from '../cad/DynamicInput.js';
import { ToolManager } from '../cad/tools/ToolManager.js';
import { LineTool } from '../cad/tools/LineTool.js';
import { RectangleTool } from '../cad/tools/RectangleTool.js';
import { CircleTool } from '../cad/tools/CircleTool.js';
import { ArcTool } from '../cad/tools/ArcTool.js';
import { PolylineTool } from '../cad/tools/PolylineTool.js';
import { SelectTool } from '../cad/tools/SelectTool.js';
import { DimensionTool } from '../cad/tools/DimensionTool.js';
import { WallSplitTool } from '../cad/tools/WallSplitTool.js';
import { CADTo3DConverter } from '../cad/CADTo3DConverter.js';
import { AutoDimensionManager } from '../cad/AutoDimensionManager.js';
import { Room, RoomType } from '../cad/entities/Room.js';
import { RoomDetector } from '../cad/RoomDetector.js';
import { EnvironmentManager } from '../rendering/EnvironmentPresets.js';
import { Wall } from '../cad/entities/Wall.js';
import { StructuralOptionsPanel } from '../ui/StructuralOptionsPanel.js';

// Initialize
const eventBus = EventBus.getInstance();
const wallTypeManager = WallTypeManager.getInstance();

// Initialize Structural Options Panel
const structuralOptionsPanel = new StructuralOptionsPanel('structural-options-panel');

// Register callback for wall type changes - update 3D view when wall type changes
structuralOptionsPanel.onWallTypeChanged((wall, newTypeId) => {
  console.log('Wall type changed:', newTypeId);

  // Rebuild framing for all walls
  wallsNeedingFraming.push(wall);
  updateWallFraming();

  // Redraw 2D canvas to show updated wall thickness
  viewport.requestRedraw();
});

// Initialize parametric engines
const parameterEngine = new ParameterEngine();
const geometryEngine = getGeometryEngine();

// Initialize geometry engine
await geometryEngine.initialize({
  wasmPath: '/wasm/',
});

// Setup 3D scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
  60,
  (window.innerWidth / 2) / window.innerHeight,
  0.1,
  1000
);
// Position camera to look at the walls from an isometric-ish angle
camera.position.set(5, 4, 5);
camera.lookAt(0, 1.5, 0); // Look at middle height of walls (about 1.5m up)

const renderer = new THREE.WebGLRenderer({ antialias: true });
const threeContainer = document.getElementById('three-canvas');
renderer.setSize(window.innerWidth / 2, window.innerHeight);
threeContainer.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Initialize Environment Manager
const environmentManager = new EnvironmentManager(scene, renderer);
environmentManager.applyPreset('default'); // Start with default preset

// Axes helper (keep for reference)
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Initialize Sketch Mode
const sketchMode = new SketchMode(scene, wallTypeManager, eventBus, {
  pixelsPerMeter: 100,
  gridSize: 50,
  snapToGrid: true,
  orthoSnap: true,
  showGrid: true,
  parameterEngine: parameterEngine,
  geometryEngine: geometryEngine,
});

// Layer renderer for exploded view
const layerRenderer = new WallLayerRenderer({
  exploded: false,
  explosionDistance: 0.05,
  renderMode: 'solid',
  opacity: 0.8,
  showLabels: true,
});

// Initialize Layer Manager
const layerManager = new LayerManager();
layerManager.setActiveLayer('A-WALL'); // Set walls as active layer

// Setup CAD viewport in the left panel
const sketchCanvas = document.getElementById('sketch-canvas');
sketchCanvas.width = window.innerWidth / 2;
sketchCanvas.height = window.innerHeight;

const viewport = new CanvasViewport(sketchCanvas, {
  name: 'Floor Plan',
  scale: 100,
  units: 'm',
  gridSize: 1, // 1 meter major grid
  minorGridDivisions: 10, // 0.1 meter minor grid
  showGrid: true,
  showAxes: true,
  backgroundColor: '#2a2a2a',
  gridColor: '#3a3a3a',
  minorGridColor: '#323232',
  axesColor: '#555555',
  enableBuiltInZoom: false, // Disable built-in zoom, we'll handle it ourselves
});

// Initialize snap and tracking systems
const snapManager = new SnapManager({
  enabled: true,
  enabledTypes: [SnapType.ENDPOINT, SnapType.MIDPOINT, SnapType.NEAREST],
  snapDistance: 15,
  showIndicators: true,
});

const polarTracking = new PolarTrackingManager({
  enabled: true,
  increment: 45, // 45-degree increments
  showGuides: true,
});

const dynamicInput = new DynamicInput({
  enabled: true,
  mode: InputMode.CARTESIAN,
  showTooltip: true,
});

// Initialize tool manager with CAD tools
const toolManager = new ToolManager(viewport, snapManager, polarTracking, dynamicInput);

// Register CAD tools
toolManager.registerTool('line', new LineTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('rectangle', new RectangleTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('circle', new CircleTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('arc', new ArcTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('polyline', new PolylineTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('dimension', new DimensionTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('wall-split', new WallSplitTool(viewport, snapManager, polarTracking, dynamicInput));

// Track entities drawn with CAD tools
let cadEntities = [];

// Room detection
const roomDetector = new RoomDetector();
let rooms = [];
let selectedRoom = null;

// Create and register select tool
const selectTool = new SelectTool(viewport, snapManager, polarTracking, dynamicInput);
toolManager.registerTool('select', selectTool);

// Listen for entity selection to show structural options panel
sketchCanvas.addEventListener('selectionChanged', (event) => {
  const selected = event.detail.selectedEntities;

  // Show structural options panel if a wall is selected
  if (selected.length === 1 && selected[0].getType() === 'wall') {
    structuralOptionsPanel.showWallOptions(selected[0]);
  } else {
    // Hide panel if no wall is selected or multiple entities are selected
    structuralOptionsPanel.hide();
  }
});

// Update select tool with entities whenever they change
const updateSelectTool = () => {
  selectTool.setEntities(cadEntities);
};
updateSelectTool();

// Initialize CAD to 3D converter
const cadTo3DConverter = new CADTo3DConverter({
  defaultHeight: 3.0, // 3 meter walls
  lineWidth: 0.2, // 20cm thick walls
  filled: false,
});

// Initialize Auto Dimension Manager
const autoDimensionManager = new AutoDimensionManager({
  enabled: true, // Enable by default
  offset: 0.5, // 0.5 units offset from entity
  dimensionLines: true,
  dimensionPolylines: true,
  dimensionCircles: false,
});

// Room detection function
function detectRooms() {
  // Get all wall entities (lines, rectangles, polylines)
  const wallEntities = cadEntities.filter(entity => {
    const type = entity.getType();
    return type === 'line' || type === 'rectangle' || type === 'polyline';
  });

  // Update rooms
  rooms = roomDetector.updateRooms(wallEntities, rooms);

  // If no rooms have types assigned, use heuristics
  const hasTypedRooms = rooms.some(r => r.getRoomType() !== RoomType.UNDEFINED);
  if (!hasTypedRooms && rooms.length > 0) {
    rooms = roomDetector.detectRoomsWithTypes(wallEntities);
  }

  // Add rooms to cadEntities if not already present
  rooms.forEach(room => {
    if (!cadEntities.includes(room)) {
      cadEntities.push(room);

      // Convert room to 3D (floor slab)
      const mesh3D = cadTo3DConverter.convert(room);
      if (mesh3D) {
        scene.add(mesh3D);
        console.log('Added 3D mesh for room:', room.getName());
      }
    }
  });

  updateRoomUI();
  viewport.requestRedraw();
  console.log('Detected', rooms.length, 'rooms');
}

// Update room UI
function updateRoomUI() {
  const roomCountEl = document.getElementById('room-count');
  const roomsListEl = document.getElementById('rooms-list');
  const roomsContainer = document.getElementById('rooms-container');
  const roomTypeSelect = document.getElementById('room-type-select');

  roomCountEl.textContent = rooms.length;

  if (rooms.length === 0) {
    roomsContainer.style.display = 'none';
    roomsListEl.innerHTML = '';
    roomTypeSelect.disabled = true;
    return;
  }

  roomsContainer.style.display = 'block';
  roomsListEl.innerHTML = '';

  rooms.forEach((room, index) => {
    const card = document.createElement('div');
    card.className = 'room-card';
    if (room === selectedRoom) {
      card.classList.add('selected');
    }

    const props = room.getProperties();

    card.innerHTML = `
      <div class="room-card-title">${props.name}</div>
      <div class="room-card-type">${props.type}</div>
      <div class="room-card-stat">
        <span class="room-card-stat-label">Area:</span>
        <span>${props.area?.toFixed(2) || 0} sq ft</span>
      </div>
      <div class="room-card-stat">
        <span class="room-card-stat-label">Perimeter:</span>
        <span>${props.perimeter?.toFixed(2) || 0} ft</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedRoom = room;
      roomTypeSelect.value = room.getRoomType();
      roomTypeSelect.disabled = false;
      updateRoomUI();
      viewport.requestRedraw();
    });

    roomsListEl.appendChild(card);
  });

  // Update room type select
  if (selectedRoom) {
    roomTypeSelect.value = selectedRoom.getRoomType();
    roomTypeSelect.disabled = false;
  } else {
    roomTypeSelect.disabled = true;
  }
}

// Track walls for batch framing
let wallsNeedingFraming = [];
let framingUpdateTimer = null;

// Listen for entities created by CAD tools
toolManager.on('entitiesCreated', (event) => {
  console.log('Entities created:', event.entities.length);

  const newWalls = [];

  event.entities.forEach(entity => {
    // Add to CAD entities array
    cadEntities.push(entity);

    // Generate automatic dimensions
    const autoDimensions = autoDimensionManager.generateDimensions(entity);
    if (autoDimensions.length > 0) {
      console.log('Generated', autoDimensions.length, 'automatic dimensions for', entity.getType());
      // Add dimensions to CAD entities
      cadEntities.push(...autoDimensions);
      // Add to snap manager
      autoDimensions.forEach(dim => snapManager.addEntity(dim));
    }

    // Collect walls for batch framing, convert other entities immediately
    if (entity.getType() === 'wall') {
      newWalls.push(entity);
    } else {
      // Convert non-wall entities immediately
      const mesh3D = cadTo3DConverter.convert(entity);
      if (mesh3D) {
        scene.add(mesh3D);
        console.log('Added 3D mesh for entity:', entity.getType());
      }
    }

    // Update camera to look at the first entity if this is the first one
    if (cadEntities.length === 1 && entity.getType() !== 'wall') {
      const mesh3D = cadTo3DConverter.getMesh(entity);
      if (mesh3D) {
        controls.target.copy(mesh3D.position);
        controls.update();
        console.log('Updated camera target to:', mesh3D.position);
      }
    }
  });

  // If we have new walls, schedule a framing update
  if (newWalls.length > 0) {
    wallsNeedingFraming.push(...newWalls);

    // Clear existing timer
    if (framingUpdateTimer) {
      clearTimeout(framingUpdateTimer);
    }

    // Update framing after a short delay (allows multiple walls to be created)
    framingUpdateTimer = setTimeout(() => {
      updateWallFraming();
      framingUpdateTimer = null;
    }, 100);
  }

  // Auto-detect rooms after creating walls
  detectRooms();

  updateSelectTool();
  viewport.requestRedraw();
});

// Update wall framing with the FramingEngine
function updateWallFraming() {
  if (wallsNeedingFraming.length === 0) return;

  console.log('Updating framing for', wallsNeedingFraming.length, 'walls');

  // Remove old framing from scene
  const existingFraming = scene.children.filter(child => child.userData.isWallFraming);
  existingFraming.forEach(framing => scene.remove(framing));

  // Get all walls in the scene
  const allWalls = cadEntities.filter(e => e.getType() === 'wall');

  // Generate new framing for all walls
  const framingGroup = cadTo3DConverter.convertWallsWithFraming(allWalls);
  framingGroup.userData.isWallFraming = true;
  scene.add(framingGroup);

  console.log('Added framing group to scene');

  // Clear the pending list
  wallsNeedingFraming = [];

  // Update camera if this is the first time
  if (allWalls.length > 0 && scene.children.length === 1) {
    controls.target.set(0, 1.5, 0);
    controls.update();
  }
}

// Listen for entity deletions from select tool
viewport.getCanvas().addEventListener('entitiesDeleted', (event) => {
  console.log('Entities deleted:', event.detail.length);
  event.detail.forEach(entity => {
    // Remove associated auto-dimensions
    const associatedDimensions = autoDimensionManager.removeDimensionsForEntity(entity);
    associatedDimensions.forEach(dim => {
      const dimIndex = cadEntities.indexOf(dim);
      if (dimIndex !== -1) {
        cadEntities.splice(dimIndex, 1);
      }
      snapManager.removeEntity(dim);
    });

    // Remove from CAD entities array
    const index = cadEntities.indexOf(entity);
    if (index !== -1) {
      cadEntities.splice(index, 1);
    }

    // If this is a room being deleted
    const roomIndex = rooms.indexOf(entity);
    if (roomIndex !== -1) {
      rooms.splice(roomIndex, 1);
      if (selectedRoom === entity) {
        selectedRoom = null;
      }
    }

    // Remove 3D mesh from scene
    const mesh3D = cadTo3DConverter.remove(entity);
    if (mesh3D) {
      scene.remove(mesh3D);
      console.log('Removed 3D mesh for entity:', entity.getType());
    }

    // Remove from snap manager
    snapManager.removeEntity(entity);
  });

  // Re-detect rooms after deletion
  detectRooms();

  updateSelectTool();
  viewport.requestRedraw();
});

// Set default tool to select (standard CAD behavior)
toolManager.setActiveTool('select');

// Drawing state (for wall sketching)
let sketchWalls = [];
let currentStart = null;
let isDrawing = false;

// Drawing functions
function snapPoint(worldPoint) {
  // Try object snap first
  const objectSnap = snapManager.findSnap(
    worldPoint,
    (p) => viewport.worldToScreen(p)
  );

  if (objectSnap) {
    return objectSnap.point;
  }

  // Apply polar tracking if we have a base point
  if (currentStart && polarTracking.isEnabled()) {
    const trackResult = polarTracking.track(worldPoint, currentStart);
    if (trackResult && trackResult.snapped) {
      return trackResult.point;
    }
  }

  // Fall back to grid snap
  const snapSize = 0.5;
  return new Vector2(
    Math.round(worldPoint.x / snapSize) * snapSize,
    Math.round(worldPoint.y / snapSize) * snapSize
  );
}

function applyOrthoSnap(start, end) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx > dy) {
    return new Vector2(end.x, start.y);
  } else {
    return new Vector2(start.x, end.y);
  }
}

function cadToThree(cadPoint) {
  // Convert 2D CAD coordinates to 3D Three.js coordinates
  // CAD: X is horizontal, Y is vertical (up)
  // Three.js: X is horizontal, Y is vertical (up), Z is depth
  return new THREE.Vector3(cadPoint.x, 0, cadPoint.y);
}

function createWall3D(start, end) {
  const wallType = wallTypeManager.getWallType('2x4-exterior-basic');
  const start3D = cadToThree(start);
  const end3D = cadToThree(end);

  console.log('Creating wall from', start3D, 'to', end3D);

  // TEMP: Create simple box geometry instead of using GeometryEngine
  // GeometryEngine.getWall() is creating geometry at origin, not at the actual wall position
  const dx = end3D.x - start3D.x;
  const dz = end3D.z - start3D.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallHeight = wallType.defaultHeight * 0.3048; // feet to meters
  const wallThickness = wallType.actualThickness * 0.0254; // inches to meters

  console.log(`Creating simple box wall: L=${wallLength.toFixed(3)}m, H=${wallHeight.toFixed(3)}m, T=${wallThickness.toFixed(3)}m`);

  const geometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);

  // Position at center
  const centerX = (start3D.x + end3D.x) / 2;
  const centerZ = (start3D.z + end3D.z) / 2;
  const centerY = wallHeight / 2;
  mesh.position.set(centerX, centerY, centerZ);

  // Rotate to align with wall direction
  const angle = Math.atan2(dz, dx);
  mesh.rotation.y = angle;

  scene.add(mesh);
  console.log(`Simple wall added at (${centerX.toFixed(3)}, ${centerY.toFixed(3)}, ${centerZ.toFixed(3)}), rotation: ${(angle * 180 / Math.PI).toFixed(1)}°`);

  // Add wall line entity to snap manager
  const lineEntity = new LineEntity(start, end);
  snapManager.addEntity(lineEntity);

  return {
    getMesh: () => mesh,
    getLength: () => wallLength * 1000,
    snapEntity: lineEntity
  };

  /* OLD PARAMETRIC WALL CODE - commented out for now
  const wall3D = new ParametricWall(
    parameterEngine,
    geometryEngine,
    {
      startPoint: start3D,
      endPoint: end3D,
      height: wallType.defaultHeight * 1000,
      thickness: wallType.actualThickness * 25.4,
      wallType: wallType,
    }
  );

  // Wait a tick for the geometry to be generated
  setTimeout(() => {
    const mesh = wall3D.getMesh();
    console.log('Wall mesh (after timeout):', mesh);

    if (mesh) {
      // TEMP FIX: Position and rotate the mesh manually
      // Calculate wall center point
      const centerX = (start3D.x + end3D.x) / 2;
      const centerZ = (start3D.z + end3D.z) / 2;
      // Wall geometry height in meters (from bounding box it's 2.743m)
      // defaultHeight is in feet, so convert: feet * 0.3048 = meters
      const wallHeightMeters = wallType.defaultHeight * 0.3048;
      const centerY = wallHeightMeters / 2; // Half the wall height

      mesh.position.set(centerX, centerY, centerZ);

      // Calculate rotation angle around Y axis
      const dx = end3D.x - start3D.x;
      const dz = end3D.z - start3D.z;
      const angle = Math.atan2(dz, dx);

      // The geometry from GeometryEngine appears to be oriented incorrectly
      // It's creating walls that stand upright as columns instead of horizontal walls
      // We need to understand the actual geometry orientation first
      mesh.rotation.y = angle;

      console.log('Wall rotation:', {
        angleY: (angle * 180 / Math.PI).toFixed(1) + '°',
        dx: dx.toFixed(3),
        dz: dz.toFixed(3)
      });

      console.log(`Positioned wall at (${centerX.toFixed(3)}, ${centerY.toFixed(3)}, ${centerZ.toFixed(3)}), rotation: ${(angle * 180 / Math.PI).toFixed(1)}°`);

      scene.add(mesh);
      console.log('Added wall mesh to scene. Scene children:', scene.children.length);
      console.log('Mesh position:', mesh.position, 'Mesh visible:', mesh.visible);

      // Debug: Check geometry and bounding box
      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        console.log('Geometry bounding box:', bbox);
        if (bbox) {
          console.log(`  Min: (${bbox.min.x.toFixed(3)}, ${bbox.min.y.toFixed(3)}, ${bbox.min.z.toFixed(3)})`);
          console.log(`  Max: (${bbox.max.x.toFixed(3)}, ${bbox.max.y.toFixed(3)}, ${bbox.max.z.toFixed(3)})`);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          console.log(`  Size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
        }
        console.log('Geometry vertex count:', mesh.geometry.attributes.position?.count || 0);
      }

      // Debug: Add a visible marker at the wall location
      const markerGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(start3D);
      marker.position.y = 0.25; // Raise it slightly
      scene.add(marker);
      console.log('Added red marker at wall start position:', start3D);
    } else {
      console.warn('No mesh returned from wall3D.getMesh() after timeout');
    }
  }, 100);

  return wall3D;
  */
}

// Custom render function that extends viewport rendering
function renderSketch() {
  // Viewport automatically renders grid and axes
  // We just need to render our custom content on top

  const ctx = viewport.getContext();
  const activeLayer = layerManager.getActiveLayer();

  // Render CAD entities (including rooms)
  ctx.save();

  // Detect corners for all walls before rendering
  const wallEntities = cadEntities.filter(e => e.getType() === 'wall');
  if (wallEntities.length > 0) {
    Wall.detectCorners(wallEntities);
  }

  cadEntities.forEach((entity) => {
    const layer = layerManager.getLayer(entity.getLayer());
    const isSelected = entity === selectedRoom;
    entity.render(ctx, (p) => viewport.worldToScreen(p), layer);
  });
  ctx.restore();

  // Draw walls
  ctx.save();
  ctx.strokeStyle = activeLayer ? activeLayer.color : '#CCCCCC';
  ctx.lineWidth = activeLayer ? activeLayer.lineWeight * 2 : 2;
  ctx.lineCap = 'round';

  sketchWalls.forEach(wall => {
    const startScreen = viewport.worldToScreen(wall.start);
    const endScreen = viewport.worldToScreen(wall.end);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();
  });

  // Render active CAD tool
  const tool = toolManager.getActiveTool();
  if (tool && typeof tool.render === 'function') {
    tool.render(ctx);
  }

  // Draw current wall being drawn
  if (currentStart && isDrawing) {
    const mouseWorld = viewport.getMouseWorldPos();
    if (mouseWorld) {
      // Check for polar tracking
      if (polarTracking.isEnabled()) {
        const trackResult = polarTracking.track(mouseWorld, currentStart);
        if (trackResult) {
          // Render polar tracking guides
          const bounds = viewport.getCamera().getViewBounds(
            viewport.getCanvas().width,
            viewport.getCanvas().height
          );
          polarTracking.renderGuides(
            ctx,
            trackResult,
            (p) => viewport.worldToScreen(p),
            bounds
          );
        }
      }

      const snapped = snapPoint(mouseWorld);
      const orthoSnapped = applyOrthoSnap(currentStart, snapped);

      const startScreen = viewport.worldToScreen(currentStart);
      const endScreen = viewport.worldToScreen(orthoSnapped);

      ctx.strokeStyle = '#3a7acc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();

      // Draw start point
      ctx.fillStyle = '#3a7acc';
      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw snap indicator if snapping to an object
      const objectSnap = snapManager.findSnap(
        mouseWorld,
        (p) => viewport.worldToScreen(p)
      );
      if (objectSnap) {
        snapManager.renderSnapIndicator(
          ctx,
          objectSnap,
          (p) => viewport.worldToScreen(p)
        );
      }

      // Render dynamic input tooltip
      const cursorScreen = viewport.worldToScreen(mouseWorld);
      dynamicInput.updateFromCursor(mouseWorld, currentStart);
      dynamicInput.renderTooltip(ctx, cursorScreen);
    }
  } else if (currentStart) {
    // Just show start point
    const startScreen = viewport.worldToScreen(currentStart);
    ctx.fillStyle = '#4a9eff';
    ctx.beginPath();
    ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Override viewport render to include our custom drawing
const originalRender = viewport.render.bind(viewport);
viewport.render = function() {
  originalRender();
  renderSketch();
};

// Canvas mouse events - forward to tool manager
let isPanning = false;
let lastPanMousePos = null;

sketchCanvas.addEventListener('mousedown', (e) => {
  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  // Handle panning with shift+left or middle button
  if (e.shiftKey || e.button === 1) {
    isPanning = true;
    lastPanMousePos = screenPos.clone();
    sketchCanvas.style.cursor = 'move';
    e.preventDefault();
    return;
  }

  // Forward to tool manager
  if (e.button === 0) {
    toolManager.handleMouseDown({
      screenPos,
      worldPos,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });
    viewport.requestRedraw();
  }
});

sketchCanvas.addEventListener('mousemove', (e) => {
  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  // Handle panning
  if (isPanning && lastPanMousePos) {
    const camera = viewport.getCamera();
    const delta = Vector2.fromPoints(lastPanMousePos, screenPos);
    const worldDelta = delta.clone().multiplyScalar(1 / camera.getZoom());
    camera.setPosition(camera.getPosition().clone().sub(worldDelta));
    lastPanMousePos = screenPos.clone();
    viewport.requestRedraw();
    return;
  }

  // Forward to tool manager
  toolManager.handleMouseMove({
    screenPos,
    worldPos,
    button: 0,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  });

  if (currentStart && isDrawing) {
    viewport.requestRedraw();
  }
});

sketchCanvas.addEventListener('mouseup', (e) => {
  if (isPanning) {
    isPanning = false;
    lastPanMousePos = null;
    sketchCanvas.style.cursor = 'crosshair';
    return;
  }

  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  // Forward to tool manager
  toolManager.handleMouseUp({
    screenPos,
    worldPos,
    button: e.button,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  });
  viewport.requestRedraw();
});

// Wheel zoom for 2D canvas - zoom to cursor position
sketchCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPosBefore = viewport.screenToWorld(screenPos);

  const camera = viewport.getCamera();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

  // Apply zoom
  camera.setZoom(camera.getZoom() * zoomFactor);

  // Get world position after zoom and adjust camera to keep cursor point fixed
  const worldPosAfter = viewport.screenToWorld(screenPos);
  const offset = Vector2.fromPoints(worldPosAfter, worldPosBefore);
  camera.setPosition(camera.getPosition().clone().add(offset));

  viewport.requestRedraw();
}, { passive: false });

// Tool manager events - collect entities created by CAD tools
toolManager.on('entitiesCreated', (event) => {
  console.log('CAD entities created:', event.entities);
  cadEntities.push(...event.entities);

  // Add to snap manager
  event.entities.forEach(entity => {
    snapManager.addEntity(entity);
  });

  // Update select tool's entity reference
  selectTool.setEntities(cadEntities);

  viewport.requestRedraw();
  console.log(`Created ${event.entities.length} CAD entities, total: ${cadEntities.length}`);
});

toolManager.on('toolChanged', (event) => {
  console.log('Tool changed to:', event.currentTool?.getName());
  viewport.requestRedraw();
});

// Listen for entity deletion from SelectTool
sketchCanvas.addEventListener('entitiesDeleted', (e) => {
  const entitiesToDelete = e.detail;

  // Remove from cadEntities array
  entitiesToDelete.forEach(entity => {
    const index = cadEntities.indexOf(entity);
    if (index > -1) {
      cadEntities.splice(index, 1);
    }
    // Remove from snap manager
    snapManager.removeEntity(entity);
  });

  // Update select tool's reference
  selectTool.setEntities(cadEntities);

  console.log(`Deleted ${entitiesToDelete.length} entities, ${cadEntities.length} remaining`);
  viewport.requestRedraw();
});

// Keyboard handlers
window.addEventListener('keydown', (e) => {
  // Forward to tool manager first
  const handled = toolManager.handleKeyDown({
    key: e.key,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  });

  if (handled) {
    e.preventDefault();
    viewport.requestRedraw();
    return;
  }

  // Handle other keys
  if (e.key === 'Escape') {
    currentStart = null;
    isDrawing = false;
    viewport.requestRedraw();
  } else if (e.key === 'Backspace') {
    if (sketchWalls.length > 0) {
      const lastWall = sketchWalls.pop();
      if (lastWall.wall3D) {
        const mesh = lastWall.wall3D.getMesh();
        if (mesh) {
          scene.remove(mesh);
        }
        // Remove from snap manager
        if (lastWall.wall3D.snapEntity) {
          snapManager.removeEntity(lastWall.wall3D.snapEntity);
        }
      }
      updateStats();
      viewport.requestRedraw();
    }
  }
});

// Initial render is handled automatically by viewport's render loop

// Hide loading
document.getElementById('loading').style.display = 'none';

// Toolbar button handlers
const toolButtons = document.querySelectorAll('.tool-button');
toolButtons.forEach(button => {
  button.addEventListener('click', () => {
    const toolName = button.getAttribute('data-tool');

    // Update active state
    toolButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Switch tool
    if (toolName === 'line') {
      toolManager.setActiveTool('line');
      console.log('Switched to Line Tool');
    } else if (toolName === 'rectangle') {
      toolManager.setActiveTool('rectangle');
      console.log('Switched to Rectangle Tool');
    } else if (toolName === 'circle') {
      toolManager.setActiveTool('circle');
      console.log('Switched to Circle Tool');
    } else if (toolName === 'arc') {
      toolManager.setActiveTool('arc');
      console.log('Switched to Arc Tool');
    } else if (toolName === 'polyline') {
      toolManager.setActiveTool('polyline');
      console.log('Switched to Polyline Tool');
    } else if (toolName === 'dimension') {
      toolManager.setActiveTool('dimension');
      console.log('Switched to Dimension Tool');
    } else if (toolName === 'select') {
      toolManager.setActiveTool('select');
      console.log('Switched to Select Tool');
    } else if (toolName === 'wall-split') {
      toolManager.setActiveTool('wall-split');
      console.log('Switched to Wall Split Tool');
    } else if (toolName === 'pan') {
      // TODO: Implement pan tool
      console.log('Pan tool not yet implemented - use Shift+Drag for now');
    }

    viewport.requestRedraw();
  });
});

// Room UI event handlers
const detectRoomsBtn = document.getElementById('detect-rooms-btn');
const roomTypeSelect = document.getElementById('room-type-select');

detectRoomsBtn.addEventListener('click', () => {
  detectRooms();
});

roomTypeSelect.addEventListener('change', () => {
  if (selectedRoom) {
    const roomType = roomTypeSelect.value;
    selectedRoom.setRoomType(RoomType[roomType.toUpperCase()] || RoomType.UNDEFINED);
    updateRoomUI();
    viewport.requestRedraw();
  }
});

// Environment preset selector
const environmentPresetSelect = document.getElementById('environment-preset');
environmentPresetSelect.addEventListener('change', () => {
  const preset = environmentPresetSelect.value;
  environmentManager.applyPreset(preset);
  console.log('Applied environment preset:', preset);
});

// Keyboard shortcuts for tools
window.addEventListener('keydown', (e) => {
  // Don't handle if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  let toolName = null;

  switch(e.key.toLowerCase()) {
    case 'l':
      toolName = 'line';
      break;
    case 'r':
      toolName = 'rectangle';
      break;
    case 'c':
      toolName = 'circle';
      break;
    case 'a':
      toolName = 'arc';
      break;
    case 'y':
      toolName = 'polyline';
      break;
    case 'w':
      toolName = 'wall-split';
      break;
    case 'd':
      toolName = 'dimension';
      break;
    case 's':
      toolName = 'select';
      break;
  }

  if (toolName) {
    const button = document.querySelector(`[data-tool="${toolName}"]`);
    if (button) {
      button.click();
      e.preventDefault();
    }
  }
});

// UI Controls
const wallTypeSelect = document.getElementById('wall-type');
const showGridToggle = document.getElementById('show-grid');
const snapGridToggle = document.getElementById('snap-grid');
const orthoSnapToggle = document.getElementById('ortho-snap');
const autoDimensionsToggle = document.getElementById('auto-dimensions');
const showLayersToggle = document.getElementById('show-layers');
const explodedViewToggle = document.getElementById('exploded-view');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const wallCountDisplay = document.getElementById('wall-count');
const totalLengthDisplay = document.getElementById('total-length');

// Panel toggle elements
const controlPanel = document.getElementById('control-panel');
const closePanelBtn = document.getElementById('close-panel-btn');
const togglePanelBtn = document.getElementById('toggle-panel-btn');

// Update stats function
function updateStats() {
  wallCountDisplay.textContent = sketchWalls.length;

  // Calculate total length
  let totalLength = 0;
  sketchWalls.forEach(wall => {
    if (wall.wall3D) {
      totalLength += wall.wall3D.getLength() / 1000; // mm to meters
    }
  });

  const lengthFeet = totalLength * 3.28084;
  const feet = Math.floor(lengthFeet);
  const inches = Math.round((lengthFeet - feet) * 12);
  totalLengthDisplay.textContent = `${feet}'-${inches}"`;
}

// Event handlers
wallTypeSelect.addEventListener('change', (e) => {
  // Wall type change - would need to recreate walls with new type
  console.log('Wall type changed to:', e.target.value);
});

// Auto dimensions toggle
if (autoDimensionsToggle) {
  autoDimensionsToggle.addEventListener('change', (e) => {
    autoDimensionManager.setEnabled(e.target.checked);
    console.log('Auto dimensions:', e.target.checked ? 'enabled' : 'disabled');
  });
}

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all walls? This cannot be undone.')) {
    sketchWalls.forEach(wall => {
      if (wall.wall3D) {
        const mesh = wall.wall3D.getMesh();
        if (mesh) {
          scene.remove(mesh);
        }
      }
    });
    sketchWalls = [];
    currentStart = null;
    isDrawing = false;
    // Clear snap manager entities
    snapManager.clearEntities();
    updateStats();
    viewport.requestRedraw();
  }
});

exportBtn.addEventListener('click', () => {
  const walls = sketchWalls.map(w => w.wall3D).filter(w => w);
  console.log('Exported walls:', walls);
  alert(`Exported ${walls.length} walls to 3D scene!`);
});

// Panel toggle handlers
if (closePanelBtn && togglePanelBtn && controlPanel) {
  closePanelBtn.addEventListener('click', () => {
    controlPanel.classList.add('collapsed');
    togglePanelBtn.classList.add('visible');
  });

  togglePanelBtn.addEventListener('click', () => {
    controlPanel.classList.remove('collapsed');
    togglePanelBtn.classList.remove('visible');
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  const width = window.innerWidth / 2;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

// Welcome message
console.log(`
╔══════════════════════════════════════════╗
║   NEOcad - Professional CAD Drawing      ║
║   With 3D Visualization                  ║
╚══════════════════════════════════════════╝

Draw with CAD tools in 2D (left), see walls rendered in 3D (right)!

Available Tools:
  • Line Tool (active) - Draw lines and walls
  • Rectangle Tool - Draw rectangular shapes
  • Circle Tool - Draw circles by center and radius
  • Select Tool - Select, move, and delete entities

Features:
  • Snap to grid, endpoints, and midpoints
  • Polar tracking (45° increments)
  • Dynamic input display
  • Zoom-to-cursor (mouse wheel)
  • Pan (Shift + drag or middle mouse)
  • ESC to cancel current operation

Start drawing by clicking in the left panel!
`);
