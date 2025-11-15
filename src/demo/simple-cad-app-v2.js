import { Vector2 } from '../cad/Vector2';
import { Camera2D } from '../cad/Camera2D';
import { CanvasViewport } from '../cad/CanvasViewport';
import { LayerManager } from '../cad/LayerManager';
import { SnapManager } from '../cad/SnapManager';
import { PolarTrackingManager } from '../cad/PolarTrackingManager';
import { DynamicInput } from '../cad/DynamicInput';
import { ToolManager } from '../cad/tools/ToolManager';
import { LineTool } from '../cad/tools/LineTool';
import { RectangleTool } from '../cad/tools/RectangleTool';

// Initialize CAD system
const canvas = document.getElementById('canvas');
const camera = new Camera2D();
const layerManager = new LayerManager();
const viewport = new CanvasViewport(canvas, camera, layerManager);

// Initialize snap and tracking systems
const snapManager = new SnapManager();
const polarTracking = new PolarTrackingManager();
const dynamicInput = new DynamicInput();

// Configure snap and tracking
polarTracking.setEnabled(true);
polarTracking.setIncrementAngle(45);

// Initialize tool manager
const toolManager = new ToolManager(viewport, snapManager, polarTracking, dynamicInput);

// Register tools
toolManager.registerTool('line', new LineTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('rectangle', new RectangleTool(viewport, snapManager, polarTracking, dynamicInput));

// Set initial tool
toolManager.setActiveTool('line');

// Track entities
let entities = [];

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

    // Update status
    updateStatus();
}

// Update status display
function updateStatus() {
    const tool = toolManager.getActiveTool();
    if (tool) {
        document.getElementById('status-tool').textContent = tool.getName();
    }
    document.getElementById('entity-count').textContent = entities.length;
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

    // Update coordinates display
    document.getElementById('status-coords').textContent =
        `X: ${worldPos.x.toFixed(2)}, Y: ${worldPos.y.toFixed(2)}`;

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

// Wheel event for smooth zooming
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    camera.zoomAt(worldPos, zoomFactor);

    render();
}, { passive: false });

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
        const toolName = button.getAttribute('data-tool');

        if (toolManager.setActiveTool(toolName)) {
            document.querySelectorAll('.tool-button').forEach((b) => b.classList.remove('active'));
            button.classList.add('active');
            render();
        }
    });
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

console.log('Simple CAD demo initialized!');
console.log('Click to draw lines or switch to Rectangle tool');
