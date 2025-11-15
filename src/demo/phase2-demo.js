import { Vector2 } from '../cad/Vector2';
import { Camera2D } from '../cad/Camera2D';
import { CanvasViewport } from '../cad/CanvasViewport';
import { LayerManager } from '../cad/LayerManager';
import { SnapManager, SnapType } from '../cad/SnapManager';
import { PolarTrackingManager } from '../cad/PolarTrackingManager';
import { DynamicInput, InputMode } from '../cad/DynamicInput';
import { ToolManager } from '../cad/tools/ToolManager';
import { LineTool } from '../cad/tools/LineTool';
import { RectangleTool } from '../cad/tools/RectangleTool';
import { DimensionStyleManager } from '../cad/dimensions/DimensionStyle';
import { OffsetCommand } from '../cad/commands/OffsetCommand';

// Initialize CAD system
const canvas = document.getElementById('canvas');
const camera = new Camera2D();
const layerManager = new LayerManager();
const viewport = new CanvasViewport(canvas, camera, layerManager);

// Initialize snap and tracking systems
const snapManager = new SnapManager();
const polarTracking = new PolarTrackingManager();
const dynamicInput = new DynamicInput();
const dimensionStyleManager = new DimensionStyleManager();

// Configure snap types
snapManager.setActiveSnapTypes([
  SnapType.ENDPOINT,
  SnapType.MIDPOINT,
  SnapType.CENTER,
  SnapType.NEAREST,
]);

// Configure polar tracking
polarTracking.setEnabled(true);
polarTracking.setIncrementAngle(45);

// Configure dynamic input
dynamicInput.setMode(InputMode.CARTESIAN);

// Initialize tool manager
const toolManager = new ToolManager(viewport, snapManager, polarTracking, dynamicInput);

// Register tools
toolManager.registerTool('line', new LineTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('rectangle', new RectangleTool(viewport, snapManager, polarTracking, dynamicInput));

// Set initial tool
toolManager.setActiveTool('line');

// Track state
let selectedEntity = null;
let entities = [];

// Update status
function updateStatus() {
  document.getElementById('status-tool').textContent = toolManager.getActiveTool()?.getName() || 'None';
  document.getElementById('status-entities').textContent = entities.length;
  document.getElementById('status-zoom').textContent = Math.round(camera.getZoom() * 100) + '%';
}

// Update prompt
function updatePrompt() {
  const tool = toolManager.getActiveTool();
  if (tool) {
    document.getElementById('prompt').textContent = tool.getPrompt();
  }
}

// Render loop
function render() {
  viewport.clear();
  viewport.renderGrid();
  viewport.renderAxes();

  const worldToScreen = (p) => viewport.worldToScreen(p);

  // Render all entities
  entities.forEach((entity) => {
    const layer = layerManager.getLayer(entity.getLayer());
    entity.render(viewport.getContext(), worldToScreen, layer);
  });

  // Render active tool
  const tool = toolManager.getActiveTool();
  if (tool) {
    tool.render(viewport.getContext());
  }

  updateStatus();
  updatePrompt();
}

// Handle mouse events
let mouseDown = false;
let lastMousePos = null;

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    // Middle mouse or shift+left: pan
    mouseDown = true;
    lastMousePos = screenPos;
    canvas.style.cursor = 'move';
  } else if (e.button === 0) {
    // Left mouse: tool interaction
    toolManager.handleMouseDown({
      screenPos,
      worldPos,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });
  }

  render();
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  if (mouseDown && lastMousePos) {
    // Pan camera
    const dx = screenPos.x - lastMousePos.x;
    const dy = screenPos.y - lastMousePos.y;
    camera.pan(dx / camera.getZoom(), dy / camera.getZoom());
    lastMousePos = screenPos;
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
  }

  render();
});

canvas.addEventListener('mouseup', (e) => {
  if (mouseDown) {
    mouseDown = false;
    lastMousePos = null;
    canvas.style.cursor = 'crosshair';
  }

  const rect = canvas.getBoundingClientRect();
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

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = viewport.screenToWorld(screenPos);

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  camera.zoomAt(worldPos, zoomFactor);

  render();
});

// Handle keyboard events
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
});

// Handle tool manager events
toolManager.on('entitiesCreated', (event) => {
  entities.push(...event.entities);
  render();
});

toolManager.on('toolChanged', (event) => {
  updateStatus();
  render();
});

// Tool buttons
document.querySelectorAll('.tool-button').forEach((button) => {
  button.addEventListener('click', () => {
    const toolName = button.dataset.tool;

    if (toolName === 'polyline') {
      alert('Polyline tool coming soon!');
      return;
    }

    if (toolName === 'linear-dim' || toolName === 'aligned-dim') {
      alert('Dimension tools coming soon!');
      return;
    }

    if (toolManager.setActiveTool(toolName)) {
      document.querySelectorAll('.tool-button').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      render();
    }
  });
});

// Offset button
document.getElementById('offset-btn').addEventListener('click', () => {
  if (!selectedEntity) {
    alert('Please select an entity first (Ctrl+Click)');
    return;
  }

  const distance = parseFloat(document.getElementById('offset-distance').value);
  if (isNaN(distance) || distance <= 0) {
    alert('Please enter a valid offset distance');
    return;
  }

  // Get mouse position to determine offset side
  const rect = canvas.getBoundingClientRect();
  const centerScreen = new Vector2(rect.width / 2, rect.height / 2);
  const centerWorld = viewport.screenToWorld(centerScreen);

  const offsetEntity = OffsetCommand.offset(selectedEntity, distance, centerWorld);

  if (offsetEntity) {
    entities.push(offsetEntity);
    snapManager.addEntity(offsetEntity);
    render();
  } else {
    alert('Unable to offset this entity');
  }
});

// Clear button
document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Clear all entities?')) {
    entities = [];
    selectedEntity = null;
    snapManager.clear();
    render();
  }
});

// Snap checkboxes
document.getElementById('snap-endpoint').addEventListener('change', (e) => {
  const types = snapManager.getActiveSnapTypes();
  if (e.target.checked) {
    types.push(SnapType.ENDPOINT);
  } else {
    const index = types.indexOf(SnapType.ENDPOINT);
    if (index > -1) types.splice(index, 1);
  }
  snapManager.setActiveSnapTypes(types);
});

document.getElementById('snap-midpoint').addEventListener('change', (e) => {
  const types = snapManager.getActiveSnapTypes();
  if (e.target.checked) {
    types.push(SnapType.MIDPOINT);
  } else {
    const index = types.indexOf(SnapType.MIDPOINT);
    if (index > -1) types.splice(index, 1);
  }
  snapManager.setActiveSnapTypes(types);
});

document.getElementById('snap-center').addEventListener('change', (e) => {
  const types = snapManager.getActiveSnapTypes();
  if (e.target.checked) {
    types.push(SnapType.CENTER);
  } else {
    const index = types.indexOf(SnapType.CENTER);
    if (index > -1) types.splice(index, 1);
  }
  snapManager.setActiveSnapTypes(types);
});

document.getElementById('polar-tracking').addEventListener('change', (e) => {
  polarTracking.setEnabled(e.target.checked);
});

// Handle window resize
function handleResize() {
  viewport.handleResize();
  render();
}

window.addEventListener('resize', handleResize);
handleResize();

// Initial render
render();

console.log('Phase 2 Demo initialized');
console.log('Tools:', ['Line', 'Rectangle']);
console.log('Features:', ['Dimensions', 'Offset', 'Enhanced Snapping']);
