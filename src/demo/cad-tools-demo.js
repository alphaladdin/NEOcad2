import { CanvasViewport } from '../cad/CanvasViewport.js';
import { Vector2 } from '../cad/Vector2.js';
import { LayerManager } from '../cad/LayerManager.js';
import { SnapManager, SnapType } from '../cad/SnapManager.js';
import { PolarTrackingManager } from '../cad/PolarTrackingManager.js';
import { DynamicInput, InputMode } from '../cad/DynamicInput.js';
import { ToolManager } from '../cad/tools/ToolManager.js';
import { LineTool } from '../cad/tools/LineTool.js';
import { RectangleTool } from '../cad/tools/RectangleTool.js';
import { Wall } from '../cad/entities/Wall.js';

// Setup canvas
const sketchCanvas = document.getElementById('sketch-canvas');
sketchCanvas.width = sketchCanvas.clientWidth;
sketchCanvas.height = sketchCanvas.clientHeight;

// Initialize Layer Manager
const layerManager = new LayerManager();
layerManager.setActiveLayer('A-WALL'); // Set walls as active layer

// Setup CAD viewport
const viewport = new CanvasViewport(sketchCanvas, {
  name: 'CAD Drawing',
  showGrid: true,
  showAxes: true,
  gridSpacing: 1.0,
  pixelsPerUnit: 50, // 50 pixels = 1 unit
});

// Initialize CAD systems
const snapManager = new SnapManager({
  enabled: true,
  snapDistance: 15,
  enabledTypes: [
    SnapType.ENDPOINT,
    SnapType.MIDPOINT,
    SnapType.CENTER,
    SnapType.NEAREST,
  ],
  showIndicators: true,
});

const polarTracking = new PolarTrackingManager({
  enabled: true,
  increment: 45,
  snapDistance: 0.1,
  showGuides: true,
});

const dynamicInput = new DynamicInput({
  mode: InputMode.CARTESIAN,
  enabled: true,
});

// Initialize tool manager
const toolManager = new ToolManager(viewport, snapManager, polarTracking, dynamicInput);

// Register tools
console.log('Registering LineTool...');
toolManager.registerTool('line', new LineTool(viewport, snapManager, polarTracking, dynamicInput));
console.log('Registering RectangleTool...');
toolManager.registerTool('rectangle', new RectangleTool(viewport, snapManager, polarTracking, dynamicInput));

// Set initial tool
console.log('Setting active tool to line...');
toolManager.setActiveTool('line');
console.log('Active tool is:', toolManager.getActiveTool()?.getName());

// Track entities
let entities = [];

// Render function
function render() {
  viewport.clear();

  if (document.getElementById('show-grid').checked) {
    viewport.renderGrid();
  }
  viewport.renderAxes();

  const ctx = viewport.getContext();
  const worldToScreen = (p) => viewport.worldToScreen(p);

  // Render all entities
  // Detect corners for walls before rendering
  const wallEntities = entities.filter(e => e.getType() === 'wall');
  if (wallEntities.length > 0) {
    Wall.detectCorners(wallEntities);
  }

  entities.forEach((entity) => {
    const layer = layerManager.getLayer(entity.getLayer());
    entity.render(ctx, worldToScreen, layer);
  });

  // Render active tool
  const tool = toolManager.getActiveTool();
  if (tool && typeof tool.render === 'function') {
    tool.render(ctx);
  }

  // Render snap visualization
  if (snapManager && typeof snapManager.render === 'function') {
    snapManager.render(ctx);
  }

  // Render polar tracking
  if (polarTracking && typeof polarTracking.render === 'function') {
    polarTracking.render(ctx);
  }

  // Render dynamic input
  if (dynamicInput && typeof dynamicInput.render === 'function') {
    dynamicInput.render(ctx);
  }

  updateUI();
}

// Update UI stats
function updateUI() {
  document.getElementById('entity-count').textContent = entities.length;
  document.getElementById('zoom-level').textContent =
    Math.round(viewport.getCamera().getZoom() * 100) + '%';
}

// Mouse event handling
let isPanning = false;
let lastMousePos = null;

sketchCanvas.addEventListener('mousedown', (e) => {
  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  console.log('Mouse down:', { screenPos, worldPos, button: e.button });

  if (e.shiftKey || e.button === 1) {
    // Pan mode
    isPanning = true;
    lastMousePos = screenPos.clone();
    sketchCanvas.style.cursor = 'move';
    e.preventDefault();
  } else if (e.button === 0) {
    // Tool interaction
    console.log('Calling toolManager.handleMouseDown, active tool:', toolManager.getActiveTool()?.getName());

    const tool = toolManager.getActiveTool();
    if (tool) {
      console.log('Before onMouseDown - tool state:', tool.getState());
      console.log('Tool startPoint:', tool['startPoint']);

      tool.onMouseDown({
        screenPos,
        worldPos,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
      });

      console.log('After onMouseDown - tool state:', tool.getState());
      console.log('Tool startPoint:', tool['startPoint']);
      console.log('Tool currentPoint:', tool['currentPoint']);
      console.log('Tool completedEntities array:', tool['completedEntities']);

      // Check for completed entities immediately after mouse down
      const completed = tool.getCompletedEntities();
      console.log('Completed entities:', completed.length, completed);
      if (completed.length > 0) {
        entities.push(...completed);

        // Add to snap manager
        completed.forEach(entity => {
          snapManager.addEntity(entity);
        });

        // Clear the tool's completed entities since we've collected them
        tool['completedEntities'] = [];

        console.log(`Created ${completed.length} entities, total: ${entities.length}`);
      }
    }

    console.log('After handleMouseDown, entities count:', entities.length);
    render();
  }
});

sketchCanvas.addEventListener('mousemove', (e) => {
  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  if (isPanning && lastMousePos) {
    // Pan the camera
    const camera = viewport.getCamera();
    const delta = screenPos.subtract(lastMousePos);
    const worldDelta = delta.scale(1 / camera.getZoom());
    camera.pan(-worldDelta.x, worldDelta.y);
    lastMousePos = screenPos.clone();
    render();
  } else {
    // Tool interaction
    toolManager.handleMouseMove({
      screenPos,
      worldPos,
      button: 0,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });
    render();
  }
});

sketchCanvas.addEventListener('mouseup', (e) => {
  if (isPanning) {
    isPanning = false;
    lastMousePos = null;
    sketchCanvas.style.cursor = 'crosshair';
  }

  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  toolManager.handleMouseUp({
    screenPos,
    worldPos,
    button: e.button,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  });

  render();
});

// Wheel zoom
sketchCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const rect = sketchCanvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  const camera = viewport.getCamera();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  camera.zoomAt(worldPos, zoomFactor);

  render();
}, { passive: false });

// Keyboard events
document.addEventListener('keydown', (e) => {
  const handled = toolManager.handleKeyDown({
    key: e.key,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  });

  if (handled) {
    e.preventDefault();
    render();
  }

  // Clear all with 'C' key
  if (e.key === 'c' || e.key === 'C') {
    if (confirm('Clear all entities?')) {
      entities = [];
      snapManager.clear();
      render();
    }
  }
});

// Tool manager events
toolManager.on('entitiesCreated', (event) => {
  console.log('entitiesCreated event fired!', event.entities);
  entities.push(...event.entities);

  // Add to snap manager
  event.entities.forEach(entity => {
    snapManager.addEntity(entity);
  });

  render();
  console.log(`Created ${event.entities.length} entities, total: ${entities.length}`);
});

toolManager.on('toolChanged', (event) => {
  console.log('Tool changed to:', event.currentTool?.getName());
  render();
});

// Tool buttons
document.querySelectorAll('.tool-button').forEach((button) => {
  button.addEventListener('click', () => {
    const toolName = button.getAttribute('data-tool');

    if (toolName && toolManager.setActiveTool(toolName)) {
      // Update button states
      document.querySelectorAll('.tool-button').forEach((b) => {
        b.classList.remove('active');
      });
      button.classList.add('active');

      console.log('Activated tool:', toolName);
      render();
    }
  });
});

// Options checkboxes
document.getElementById('show-grid').addEventListener('change', render);
document.getElementById('snap-grid').addEventListener('change', (e) => {
  // Toggle grid snapping
  console.log('Grid snap:', e.target.checked);
  render();
});
document.getElementById('polar-tracking').addEventListener('change', (e) => {
  polarTracking.setEnabled(e.target.checked);
  console.log('Polar tracking:', e.target.checked);
  render();
});

// Clear button
document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Clear all entities?')) {
    entities = [];
    snapManager.clear();
    render();
  }
});

// Window resize
window.addEventListener('resize', () => {
  sketchCanvas.width = sketchCanvas.clientWidth;
  sketchCanvas.height = sketchCanvas.clientHeight;
  render();
});

// Initial render
render();

console.log('CAD Tools Demo initialized!');
console.log('Available tools:', ['Line', 'Rectangle']);
console.log('Controls: Click to draw, Shift+Drag to pan, Wheel to zoom, ESC to finish');
