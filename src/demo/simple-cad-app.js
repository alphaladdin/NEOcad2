import { CanvasViewport } from '../cad/CanvasViewport.ts';
import { Vector2 } from '../cad/Vector2.ts';
import { LayerManager } from '../cad/LayerManager.ts';
import { LineTool } from '../cad/tools/LineTool.ts';
import { RectangleTool } from '../cad/tools/RectangleTool.ts';
import { SnapManager } from '../cad/SnapManager.ts';
import { PolarTrackingManager } from '../cad/PolarTrackingManager.ts';
import { DynamicInput } from '../cad/DynamicInput.ts';
import { Wall } from '../cad/entities/Wall.ts';

const canvas = document.getElementById('canvas');
const viewport = new CanvasViewport(canvas);
const layerManager = new LayerManager();
const snapManager = new SnapManager(viewport);
const polarTracking = new PolarTrackingManager(viewport);
const dynamicInput = new DynamicInput(viewport);

const entities = [];
let activeTool = null;

// Create tools
const tools = {
    line: new LineTool(viewport, snapManager, polarTracking, dynamicInput),
    rectangle: new RectangleTool(viewport, snapManager, polarTracking, dynamicInput)
};

// Activate line tool by default
activeTool = tools.line;
activeTool.activate();

// Override viewport render
const originalRender = viewport.render.bind(viewport);
viewport.render = function() {
    originalRender();
    const ctx = viewport.getContext();

    // Render entities
    // Detect corners for walls before rendering
    const wallEntities = entities.filter(e => e.getType() === 'wall');
    if (wallEntities.length > 0) {
        Wall.detectCorners(wallEntities);
    }

    for (const entity of entities) {
        const layer = layerManager.getLayer(entity.getLayer());
        entity.render(ctx, (p) => viewport.worldToScreen(p), layer);
    }

    // Render active tool
    if (activeTool && typeof activeTool.render === 'function') {
        activeTool.render(ctx);
    }
};

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    if (!activeTool) return;
    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    activeTool.onMouseDown({
        screenPos,
        worldPos,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
    });

    // Check for completed entities
    const completed = activeTool.getCompletedEntities();
    if (completed.length > 0) {
        entities.push(...completed);
        document.getElementById('entity-count').textContent = entities.length;
        console.log(`Created ${completed.length} entities`);
    }

    viewport.requestRedraw();
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    // Update status
    document.getElementById('status-coords').textContent =
        `X: ${worldPos.x.toFixed(2)}, Y: ${worldPos.y.toFixed(2)}`;

    // Forward to tool
    if (activeTool) {
        activeTool.onMouseMove({
            screenPos,
            worldPos,
            button: 0,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey
        });
        viewport.requestRedraw();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!activeTool) return;
    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    activeTool.onMouseUp({
        screenPos,
        worldPos,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey
    });

    viewport.requestRedraw();
});

// Wheel event for smooth zooming
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    // Get current zoom
    const camera = viewport.getCamera();
    const currentZoom = camera.getZoom();

    // Calculate zoom factor (smooth zooming)
    const zoomSpeed = 0.1;
    const delta = -Math.sign(e.deltaY);
    const zoomFactor = 1 + (delta * zoomSpeed);
    const newZoom = currentZoom * zoomFactor;

    // Clamp zoom
    const minZoom = 0.1;
    const maxZoom = 10;
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

    // Zoom to mouse position
    camera.zoomTo(clampedZoom, worldPos);

    viewport.requestRedraw();
}, { passive: false });

// Keyboard events
document.addEventListener('keydown', (e) => {
    if (activeTool) {
        const handled = activeTool.onKeyDown({
            key: e.key,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey
        });

        if (handled) {
            e.preventDefault();

            // Check for completed entities after keyboard input
            const completed = activeTool.getCompletedEntities();
            if (completed.length > 0) {
                entities.push(...completed);
                document.getElementById('entity-count').textContent = entities.length;
                console.log(`Created ${completed.length} entities`);
            }

            viewport.requestRedraw();
        }
    }
});

// Tool buttons
document.querySelectorAll('.tool-button').forEach(button => {
    button.addEventListener('click', () => {
        const toolName = button.getAttribute('data-tool');

        // Deactivate current tool
        if (activeTool) {
            activeTool.deactivate();
        }

        // Activate new tool
        activeTool = tools[toolName];
        if (activeTool) {
            activeTool.activate();
            document.getElementById('status-tool').textContent =
                activeTool.getName();
        }

        // Update button states
        document.querySelectorAll('.tool-button').forEach(b => {
            b.classList.remove('active');
        });
        button.classList.add('active');

        viewport.requestRedraw();
    });
});

console.log('Simple CAD demo initialized!');
console.log('Click the Line tool and start drawing on the canvas');
