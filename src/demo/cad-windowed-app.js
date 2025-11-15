import { WindowManager } from '../ui/WindowManager.ts';
import { Vector2 } from '../cad/Vector2.ts';
import { CanvasViewport } from '../cad/CanvasViewport.ts';
import { LayerManager } from '../cad/LayerManager.ts';
import { SnapManager } from '../cad/SnapManager.ts';
import { PolarTrackingManager } from '../cad/PolarTrackingManager.ts';
import { DynamicInput } from '../cad/DynamicInput.ts';
import { ToolManager } from '../cad/tools/ToolManager.ts';
import { SelectionManager } from '../cad/selection/SelectionManager.ts';
import { GripManager } from '../cad/editing/GripManager.ts';
import { CommandHistory } from '../cad/history/CommandHistory.ts';
import { Drawing } from '../cad/document/Drawing.ts';

import { LineTool } from '../cad/tools/LineTool.ts';
import { RectangleTool } from '../cad/tools/RectangleTool.ts';
import { SelectionTool } from '../cad/tools/SelectionTool.ts';
import { Wall } from '../cad/entities/Wall.ts';

// Initialize Window Manager
const mainContent = document.getElementById('main-content');
const windowManager = new WindowManager(mainContent);

// Create default layout
const { leftPanel, centerPanel, rightPanel, bottomPanel } = windowManager.createDefaultLayout();

// Create canvas
const canvasContent = document.createElement('div');
canvasContent.id = 'canvas-panel';
canvasContent.style.width = '100%';
canvasContent.style.height = '100%';
canvasContent.style.background = '#1e1e1e';
canvasContent.style.position = 'relative';

const canvas = document.createElement('canvas');
canvas.id = 'canvas';
canvas.style.display = 'block';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.cursor = 'crosshair';
canvasContent.appendChild(canvas);

centerPanel.addPanel({
    id: 'canvas',
    title: 'Drawing',
    icon: '🎨',
    closeable: false,
    element: canvasContent
});

// Initialize CAD Systems
const viewport = new CanvasViewport(canvas);
const drawing = new Drawing('Untitled', 'User');
const layerManager = drawing.getLayerManager();
const snapManager = new SnapManager(viewport);
const polarTracking = new PolarTrackingManager(viewport);
const dynamicInput = new DynamicInput(viewport);
const selectionManager = new SelectionManager();
const gripManager = new GripManager(viewport);
const commandHistory = new CommandHistory(drawing);
const toolManager = new ToolManager(viewport, snapManager, polarTracking, dynamicInput);

// Register tools
toolManager.registerTool('select', new SelectionTool(viewport, snapManager, polarTracking, dynamicInput, selectionManager, gripManager));
toolManager.registerTool('line', new LineTool(viewport, snapManager, polarTracking, dynamicInput));
toolManager.registerTool('rectangle', new RectangleTool(viewport, snapManager, polarTracking, dynamicInput));

// Set default tool
toolManager.setActiveTool('select');

// Override viewport render to include our entities
const originalRender = viewport.render.bind(viewport);
viewport.render = function() {
    originalRender();
    const ctx = viewport.getContext();

    // Render all entities
    const entities = drawing.getEntities();

    // Detect corners for walls before rendering
    const wallEntities = entities.filter(e => e.getType() === 'wall');
    if (wallEntities.length > 0) {
        Wall.detectCorners(wallEntities);
    }

    for (const entity of entities) {
        const layer = layerManager.getLayer(entity.getLayer());
        entity.render(ctx, (p) => viewport.worldToScreen(p), layer);
    }

    // Render selection (entities are marked as selected internally, no separate render needed)
    // The entities themselves render their selection state

    // Render grips if available
    if (gripManager && typeof gripManager.render === 'function') {
        gripManager.render(ctx);
    }

    // Render active tool
    const activeTool = toolManager.getActiveTool();
    if (activeTool && typeof activeTool.render === 'function') {
        activeTool.render(ctx);
    }

    // Render snap manager if available
    if (snapManager && typeof snapManager.render === 'function') {
        snapManager.render(ctx);
    }

    // Render polar tracking if available
    if (polarTracking && typeof polarTracking.render === 'function') {
        polarTracking.render(ctx);
    }

    // Render dynamic input if available
    if (dynamicInput && typeof dynamicInput.render === 'function') {
        dynamicInput.render(ctx);
    }
};

// Setup mouse event tracking and forward to active tool
canvas.addEventListener('mousedown', (e) => {
    const activeTool = toolManager.getActiveTool();
    if (activeTool) {
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

        viewport.requestRedraw();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPos = viewport.screenToWorld(screenPos);

    // Update coordinates display
    const elem = document.getElementById('status-coords');
    if (elem) elem.textContent = `${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}`;

    // Forward to active tool
    const activeTool = toolManager.getActiveTool();
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
    const activeTool = toolManager.getActiveTool();
    if (activeTool) {
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
    }
});

// Keyboard events for tools
document.addEventListener('keydown', (e) => {
    const activeTool = toolManager.getActiveTool();
    if (activeTool) {
        const handled = activeTool.onKeyDown({
            key: e.key,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey
        });

        if (handled) {
            e.preventDefault();
            viewport.requestRedraw();
        }
    }
});

// Track zoom changes
let lastZoom = viewport.getCamera().getZoom();
setInterval(() => {
    const currentZoom = viewport.getCamera().getZoom();
    if (Math.abs(currentZoom - lastZoom) > 0.01) {
        lastZoom = currentZoom;
        const elem = document.getElementById('status-zoom');
        if (elem) elem.textContent = `${(currentZoom * 100).toFixed(0)}%`;
    }
}, 100);

// Console logging
function logToConsole(message, type = 'info') {
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = message;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
}

// Update entity count
function updateEntityCount() {
    const count = drawing.getEntities().length;
    const elem = document.getElementById('status-entities');
    if (elem) elem.textContent = `${count} entities`;
}

// Update tool buttons
function updateToolButtons() {
    const toolsContent = document.getElementById('tools-content');
    if (!toolsContent) return;

    toolsContent.querySelectorAll('.tool-button').forEach(button => {
        const toolName = button.getAttribute('data-tool');
        if (toolName && toolManager.hasActiveTool(toolName)) {
            const activeTool = toolManager.getActiveTool();
            if (activeTool && activeTool.getName().toLowerCase().includes(toolName)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        } else {
            button.classList.remove('active');
        }
    });
}

// Check if ToolManager has event system
if (toolManager.on) {
    // Tool change handler
    toolManager.on('toolChanged', (event) => {
        if (event.currentTool) {
            const elem = document.getElementById('status-tool');
            if (elem) elem.textContent = event.currentTool.getName();
            updateToolButtons();
            logToConsole(`Tool changed to: ${event.currentTool.getName()}`, 'info');
        }
    });

    // Entity creation handler
    toolManager.on('entitiesCreated', (event) => {
        for (const entity of event.entities) {
            drawing.addEntity(entity);
            selectionManager.addEntity(entity);
            logToConsole(`Created ${entity.getType()}`, 'success');
        }
        updateEntityCount();
        viewport.requestRedraw();
    });

    // Individual entity added handler
    toolManager.on('entityAdded', (entity) => {
        drawing.addEntity(entity);
        selectionManager.addEntity(entity);
        updateEntityCount();
        logToConsole(`Added ${entity.getType()}`, 'success');
        viewport.requestRedraw();
    });
}

// === LEFT PANEL: Tools ===
const toolsContent = document.createElement('div');
toolsContent.id = 'tools-content';
toolsContent.className = 'panel-content';
toolsContent.innerHTML = `
    <div class="tool-section">
        <h3>Draw Tools</h3>
        <button class="tool-button" data-tool="select">🔍 Select</button>
        <button class="tool-button" data-tool="line">📏 Line</button>
        <button class="tool-button" data-tool="rectangle">⬜ Rectangle</button>
        <button class="tool-button disabled" data-tool="circle">⭕ Circle</button>
        <button class="tool-button disabled" data-tool="polyline">🔲 Polyline</button>
        <button class="tool-button disabled" data-tool="arc">📐 Arc</button>
    </div>
    <div class="tool-section">
        <h3>Modify Tools</h3>
        <button class="tool-button disabled" data-tool="trim">✂️ Trim</button>
        <button class="tool-button disabled" data-tool="extend">↔️ Extend</button>
        <button class="tool-button disabled" data-tool="offset">🔄 Offset</button>
        <button class="tool-button disabled" data-tool="mirror">🔀 Mirror</button>
        <button class="tool-button disabled" data-tool="rotate">🔃 Rotate</button>
        <button class="tool-button disabled" data-tool="scale">📏 Scale</button>
    </div>
    <div class="tool-section">
        <h3>Annotation</h3>
        <button class="tool-button disabled" data-tool="dimension">📏 Dimension</button>
        <button class="tool-button disabled" data-tool="text">📝 Text</button>
        <button class="tool-button disabled" data-tool="leader">💬 Leader</button>
    </div>
`;

// Tool button click handlers
toolsContent.querySelectorAll('.tool-button').forEach(button => {
    button.addEventListener('click', (e) => {
        console.log('Button clicked!', button.getAttribute('data-tool'));
        if (button.classList.contains('disabled')) {
            logToConsole('This tool is not yet implemented', 'warning');
            return;
        }
        const toolName = button.getAttribute('data-tool');
        try {
            toolManager.setActiveTool(toolName);
            logToConsole(`Activated ${toolName} tool`, 'info');
        } catch (error) {
            logToConsole(`Tool '${toolName}' not available: ${error.message}`, 'error');
        }
    });
});

leftPanel.addPanel({
    id: 'tools',
    title: 'Tools',
    icon: '🔧',
    closeable: false,
    element: toolsContent
});

// === RIGHT PANEL: Properties & Layers ===
const propertiesContent = document.createElement('div');
propertiesContent.className = 'panel-content';
propertiesContent.innerHTML = `
    <div class="tool-section">
        <h3>Properties</h3>
        <div class="prop-group">
            <label class="prop-label">Layer</label>
            <select class="prop-input" id="layer-select">
                <option>0</option>
            </select>
        </div>
        <div class="prop-group">
            <label class="prop-label">Color</label>
            <input type="color" class="prop-input" value="#ffffff" id="color-input">
        </div>
        <div class="prop-group">
            <label class="prop-label">Line Weight</label>
            <input type="number" class="prop-input" value="1" min="0.1" step="0.1" id="lineweight-input">
        </div>
    </div>
`;

// Update layer select
function updateLayerSelect() {
    const layerSelect = document.getElementById('layer-select');
    if (layerSelect) {
        layerSelect.innerHTML = '';
        for (const layer of layerManager.getLayers()) {
            const option = document.createElement('option');
            option.value = layer.name;
            option.textContent = layer.name;
            layerSelect.appendChild(option);
        }
    }
}
updateLayerSelect();

const layersContent = document.createElement('div');
layersContent.className = 'panel-content';
layersContent.innerHTML = `
    <div class="tool-section">
        <h3>Layers</h3>
        <div id="layers-list"></div>
    </div>
    <div class="tool-section">
        <button class="prop-button" id="btn-add-layer">➕ New Layer</button>
        <button class="prop-button" id="btn-delete-layer">🗑️ Delete Layer</button>
    </div>
`;

function updateLayersList() {
    const layersList = document.getElementById('layers-list');
    if (layersList) {
        layersList.innerHTML = '';
        for (const layer of layerManager.getLayers()) {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            if (layer.name === layerManager.getCurrentLayer().name) {
                layerItem.classList.add('active');
            }
            layerItem.innerHTML = `
                <div class="layer-color" style="background: ${layer.color};"></div>
                <div class="layer-name">${layer.name}</div>
                <span class="layer-icon">${layer.visible ? '👁️' : '🚫'}</span>
                <span class="layer-icon">${layer.locked ? '🔒' : '🔓'}</span>
            `;
            layerItem.addEventListener('click', () => {
                layerManager.setCurrentLayer(layer.name);
                updateLayersList();
            });
            layersList.appendChild(layerItem);
        }
    }
}
updateLayersList();

// Layer button handlers
document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-add-layer') {
        const name = prompt('Enter layer name:');
        if (name) {
            layerManager.createLayer(name);
            updateLayerSelect();
            updateLayersList();
            logToConsole(`Layer '${name}' created`, 'success');
        }
    } else if (e.target.id === 'btn-delete-layer') {
        const name = prompt('Enter layer name to delete:');
        if (name && layerManager.deleteLayer(name)) {
            updateLayerSelect();
            updateLayersList();
            logToConsole(`Layer '${name}' deleted`, 'success');
        } else {
            logToConsole(`Cannot delete layer '${name}'`, 'error');
        }
    }
});

rightPanel.addPanel({
    id: 'properties',
    title: 'Properties',
    icon: '⚙️',
    element: propertiesContent
});

rightPanel.addPanel({
    id: 'layers',
    title: 'Layers',
    icon: '📚',
    element: layersContent
});

// === BOTTOM PANEL: Console ===
const consoleContainer = document.createElement('div');
consoleContainer.style.height = '100%';
consoleContainer.style.display = 'flex';
consoleContainer.style.flexDirection = 'column';

const consoleOutput = document.createElement('div');
consoleOutput.id = 'console-output';
consoleOutput.style.width = '100%';
consoleOutput.style.height = 'calc(100% - 40px)';
consoleOutput.style.background = '#1e1e1e';
consoleOutput.style.color = '#cccccc';
consoleOutput.style.fontFamily = "'Consolas', 'Monaco', monospace";
consoleOutput.style.fontSize = '12px';
consoleOutput.style.padding = '12px';
consoleOutput.style.overflowY = 'auto';

consoleOutput.innerHTML = `
    <div class="console-line info">NEOcad Professional v1.0.0 initialized</div>
    <div class="console-line success">✓ Canvas viewport ready</div>
    <div class="console-line success">✓ Layer system loaded</div>
    <div class="console-line success">✓ Snap system active</div>
    <div class="console-line success">✓ All drawing tools loaded</div>
    <div class="console-line info">Click a tool button on the left to start drawing</div>
    <div class="console-line info">Available tools: Select, Line, Rectangle</div>
`;

const commandInputContainer = document.createElement('div');
commandInputContainer.style.display = 'flex';
commandInputContainer.style.padding = '8px';
commandInputContainer.style.background = '#2d2d30';
commandInputContainer.style.borderTop = '1px solid #3e3e42';

commandInputContainer.innerHTML = `
    <span id="command-prompt" style="color: #4a9eff; margin-right: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px;">Command:</span>
    <input type="text" id="command-input" placeholder="Type a command..." style="flex: 1; background: #1e1e1e; border: 1px solid #505050; color: #e0e0e0; padding: 4px 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; border-radius: 3px;">
`;

consoleContainer.appendChild(consoleOutput);
consoleContainer.appendChild(commandInputContainer);

// Command input handler
const commandInput = commandInputContainer.querySelector('#command-input');
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = commandInput.value.trim().toLowerCase();
        if (command) {
            logToConsole(`> ${command}`, 'info');
            handleCommand(command);
            commandInput.value = '';
        }
    }
});

function handleCommand(command) {
    switch (command) {
        case 'line':
        case 'l':
            toolManager.setActiveTool('line');
            break;
        case 'rectangle':
        case 'rec':
            toolManager.setActiveTool('rectangle');
            break;
        case 'select':
        case 's':
            toolManager.setActiveTool('select');
            break;
        case 'zoom':
        case 'z':
            viewport.getCamera().zoomExtents(drawing.getBounds());
            break;
        case 'clear':
            drawing.clearEntities();
            selectionManager.clearSelection();
            updateEntityCount();
            logToConsole('Drawing cleared', 'success');
            break;
        case 'help':
            logToConsole('Available commands: line (l), rectangle (rec), select (s), zoom (z), clear, help', 'info');
            break;
        default:
            logToConsole(`Unknown command: ${command}`, 'error');
    }
}

bottomPanel.addPanel({
    id: 'console',
    title: 'Console',
    icon: '💻',
    element: consoleContainer
});

// Expose API for menu items
window.cadApp = {
    drawing,
    viewport,
    toolManager,
    layerManager,
    commandHistory,
    selectionManager,
    saveDrawing: () => {
        logToConsole('Save functionality coming soon...', 'warning');
    },
    undo: () => {
        if (commandHistory.canUndo()) {
            commandHistory.undo();
            logToConsole('Undo', 'success');
            viewport.requestRedraw();
        } else {
            logToConsole('Nothing to undo', 'warning');
        }
    }
};

// Initial setup
updateToolButtons();
updateEntityCount();

console.log('NEOcad Professional initialized and ready to draw!');
console.log('Click the Line tool on the left panel to start drawing');
