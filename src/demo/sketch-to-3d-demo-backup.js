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

// Initialize
const eventBus = EventBus.getInstance();
const wallTypeManager = WallTypeManager.getInstance();

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

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Grid
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
scene.add(gridHelper);

// Axes helper
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

// Drawing state
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

  // Draw walls
  ctx.save();
  ctx.strokeStyle = activeLayer ? activeLayer.color : '#ffffff';
  ctx.lineWidth = activeLayer ? activeLayer.lineWeight * 2 : 3;
  ctx.lineCap = 'round';

  sketchWalls.forEach(wall => {
    const startScreen = viewport.worldToScreen(wall.start);
    const endScreen = viewport.worldToScreen(wall.end);

    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();
  });

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

      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();

      // Draw start point
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
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

// Canvas mouse events - now using world coordinates
sketchCanvas.addEventListener('click', (e) => {
  // Don't interfere with viewport's pan controls (middle mouse or shift+left)
  if (e.button === 1 || e.shiftKey) return;

  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);
  const snapped = snapPoint(worldPos);

  if (!currentStart) {
    currentStart = snapped.clone();
    isDrawing = true;
  } else {
    const orthoSnapped = applyOrthoSnap(currentStart, snapped);
    const wall = {
      start: currentStart.clone(),
      end: orthoSnapped.clone(),
      wall3D: createWall3D(currentStart, orthoSnapped)
    };
    sketchWalls.push(wall);
    currentStart = orthoSnapped.clone();
    updateStats();
  }
  viewport.requestRedraw();
});

sketchCanvas.addEventListener('mousemove', (e) => {
  if (currentStart && isDrawing) {
    viewport.requestRedraw();
  }
});

window.addEventListener('keydown', (e) => {
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

// UI Controls
const wallTypeSelect = document.getElementById('wall-type');
const showGridToggle = document.getElementById('show-grid');
const snapGridToggle = document.getElementById('snap-grid');
const orthoSnapToggle = document.getElementById('ortho-snap');
const showLayersToggle = document.getElementById('show-layers');
const explodedViewToggle = document.getElementById('exploded-view');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const wallCountDisplay = document.getElementById('wall-count');
const totalLengthDisplay = document.getElementById('total-length');

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
║   NEOcad Sketch-to-3D Wall Designer      ║
║   Inspired by HomeFig's workflow         ║
╚══════════════════════════════════════════╝

Draw walls in 2D on the left, see them instantly rendered in 3D on the right!

Features:
  • Real-time 2D to 3D conversion
  • Snap to grid and orthogonal angles
  • Multiple wall types with material layers
  • Interactive 3D visualization
  • Export to full 3D model

Start drawing by clicking in the left panel!
`);
