import { Vector2 } from '../cad/Vector2';
import { Line } from '../cad/entities/Line';
import { Rectangle } from '../cad/entities/Rectangle';
import { Room, RoomType } from '../cad/entities/Room';
import { RoomDetector } from '../cad/RoomDetector';
import { CADViewport } from '../cad/CADViewport';
import { Camera2D } from '../cad/Camera2D';

// Initialize canvas and viewport
const canvas = document.getElementById('canvas');
const viewport = new CADViewport(canvas);
const camera = new Camera2D();
const roomDetector = new RoomDetector();

// State
let walls = []; // Lines and rectangles that form walls
let rooms = []; // Detected rooms
let selectedRoom = null;
let selectedEntity = null;
let mode = 'rectangle'; // 'rectangle' or 'split'
let isDrawing = false;
let firstCorner = null;
let currentMouse = null;

// UI Elements
const promptEl = document.getElementById('prompt');
const roomTypeSelect = document.getElementById('room-type-select');
const modeToggle = document.getElementById('mode-toggle');
const detectRoomsBtn = document.getElementById('detect-rooms-btn');
const clearBtn = document.getElementById('clear-btn');
const roomsListEl = document.getElementById('rooms-list');

// Resize canvas
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  render();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// World to screen transformation
function worldToScreen(worldPos) {
  const viewBounds = camera.getViewBounds(canvas.width, canvas.height);
  const x = ((worldPos.x - viewBounds.minX) / (viewBounds.maxX - viewBounds.minX)) * canvas.width;
  const y = ((viewBounds.maxY - worldPos.y) / (viewBounds.maxY - viewBounds.minY)) * canvas.height;
  return new Vector2(x, y);
}

// Screen to world transformation
function screenToWorld(screenPos) {
  const viewBounds = camera.getViewBounds(canvas.width, canvas.height);
  const x = viewBounds.minX + (screenPos.x / canvas.width) * (viewBounds.maxX - viewBounds.minX);
  const y = viewBounds.maxY - (screenPos.y / canvas.height) * (viewBounds.maxY - viewBounds.minY);
  return new Vector2(x, y);
}

// Update prompt text
function updatePrompt() {
  if (mode === 'rectangle') {
    if (!isDrawing) {
      promptEl.textContent = 'Click two corners to draw a rectangle (outer walls)';
    } else {
      promptEl.textContent = 'Click the opposite corner';
    }
  } else {
    if (!isDrawing) {
      promptEl.textContent = 'Click first point of dividing wall';
    } else {
      promptEl.textContent = 'Click second point to complete wall';
    }
  }
}

// Mouse handlers
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = screenToWorld(screenPos);

  // Check if clicking on existing room
  let clickedRoom = null;
  for (const room of rooms) {
    if (room.containsPoint(worldPos)) {
      clickedRoom = room;
      break;
    }
  }

  if (clickedRoom) {
    selectedRoom = clickedRoom;
    selectedEntity = null;
    updateUI();
    render();
    return;
  }

  // Check if clicking on existing wall
  let clickedWall = null;
  for (const wall of walls) {
    if (wall.containsPoint && wall.containsPoint(worldPos, 0.2)) {
      clickedWall = wall;
      break;
    }
  }

  if (clickedWall) {
    selectedEntity = clickedWall;
    selectedRoom = null;
    updateUI();
    render();
    return;
  }

  // Start drawing
  if (!isDrawing) {
    isDrawing = true;
    firstCorner = worldPos;
    currentMouse = worldPos;
    updatePrompt();
  } else {
    // Complete drawing
    if (mode === 'rectangle') {
      // Create rectangle
      const rect = new Rectangle(firstCorner, worldPos, 'A-WALL');
      walls.push(rect);
    } else {
      // Create dividing line
      const line = new Line(firstCorner, worldPos, 'A-WALL');
      walls.push(line);
    }

    // Reset drawing state
    isDrawing = false;
    firstCorner = null;
    currentMouse = null;

    // Auto-detect rooms
    detectRooms();
    updatePrompt();
    render();
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
  const worldPos = screenToWorld(screenPos);

  if (isDrawing) {
    currentMouse = worldPos;
    render();
  }
});

// Mode toggle
modeToggle.addEventListener('change', (e) => {
  mode = e.target.value;
  isDrawing = false;
  firstCorner = null;
  currentMouse = null;
  updatePrompt();
  render();
});

// Detect rooms button
detectRoomsBtn.addEventListener('click', () => {
  detectRooms();
});

// Detect rooms function
function detectRooms() {
  // Update existing rooms or detect new ones
  rooms = roomDetector.updateRooms(walls, rooms);

  // If no rooms have types assigned, use heuristics
  const hasTypedRooms = rooms.some(r => r.getRoomType() !== RoomType.UNDEFINED);
  if (!hasTypedRooms && rooms.length > 0) {
    rooms = roomDetector.detectRoomsWithTypes(walls);
  }

  updateUI();
  render();
}

// Clear button
clearBtn.addEventListener('click', () => {
  walls = [];
  rooms = [];
  selectedRoom = null;
  selectedEntity = null;
  isDrawing = false;
  firstCorner = null;
  currentMouse = null;
  updateUI();
  updatePrompt();
  render();
});

// Room type select change
roomTypeSelect.addEventListener('change', () => {
  if (selectedRoom) {
    const roomType = roomTypeSelect.value;
    selectedRoom.setRoomType(RoomType[roomType.toUpperCase()] || RoomType.UNDEFINED);
    updateUI();
    render();
  }
});

// Update UI
function updateUI() {
  // Update rooms list
  roomsListEl.innerHTML = '';

  if (rooms.length === 0) {
    roomsListEl.innerHTML = '<div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">No rooms detected<br><small>Draw rectangles and walls, then click "Detect Rooms"</small></div>';
    return;
  }

  rooms.forEach((room, index) => {
    const card = document.createElement('div');
    card.className = 'room-card';
    if (room === selectedRoom) {
      card.classList.add('selected');
    }

    const props = room.getProperties();
    const components = room.getComponents();
    const materials = room.getMaterials();

    card.innerHTML = `
      <div class="room-title">${props.name}</div>
      <div class="room-type">${props.type}</div>
      <div class="room-stat">
        <span class="room-stat-label">Area:</span>
        <span>${props.area?.toFixed(2) || 0} sq ft</span>
      </div>
      <div class="room-stat">
        <span class="room-stat-label">Perimeter:</span>
        <span>${props.perimeter?.toFixed(2) || 0} ft</span>
      </div>

      ${components.length > 0 ? `
        <div class="component-list">
          <div style="font-size: 12px; color: #999; margin-bottom: 5px;">Components:</div>
          ${components.slice(0, 5).map(c => `
            <div class="component-item">
              <span class="component-name">${c.name}</span>
              <span class="component-qty">×${c.quantity}</span>
            </div>
          `).join('')}
          ${components.length > 5 ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">+${components.length - 5} more</div>` : ''}
        </div>
      ` : ''}

      ${materials.length > 0 ? `
        <div class="material-list">
          <div style="font-size: 12px; color: #999; margin-bottom: 5px; margin-top: 10px;">Materials:</div>
          ${materials.map(m => `
            <div class="material-item">
              <span class="material-surface">${m.surface}:</span>
              <span class="material-name">${m.materialName}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    card.addEventListener('click', () => {
      selectedRoom = room;
      selectedEntity = null;
      roomTypeSelect.value = room.getRoomType();
      updateUI();
      render();
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

// Render
function render() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  drawGrid(ctx);

  // Draw walls
  walls.forEach(wall => {
    const isSelected = wall === selectedEntity;
    if (isSelected) {
      wall.setColor('#ff9500');
    } else {
      wall.setColor('#ffffff');
    }
    wall.render(ctx, worldToScreen);
  });

  // Draw rooms
  rooms.forEach(room => {
    const isSelected = room === selectedRoom;
    room.render(ctx, worldToScreen);
  });

  // Draw preview shape
  if (isDrawing && firstCorner && currentMouse) {
    ctx.save();
    ctx.strokeStyle = mode === 'rectangle' ? '#4a9eff' : '#ff9500';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (mode === 'rectangle') {
      const p1 = worldToScreen(firstCorner);
      const p2 = worldToScreen(currentMouse);

      ctx.strokeRect(
        Math.min(p1.x, p2.x),
        Math.min(p1.y, p2.y),
        Math.abs(p2.x - p1.x),
        Math.abs(p2.y - p1.y)
      );
    } else {
      const p1 = worldToScreen(firstCorner);
      const p2 = worldToScreen(currentMouse);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Draw grid
function drawGrid(ctx) {
  const viewBounds = camera.getViewBounds(canvas.width, canvas.height);
  const gridSize = 1; // 1 foot grid

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = Math.floor(viewBounds.minX / gridSize) * gridSize; x <= viewBounds.maxX; x += gridSize) {
    const screenPos = worldToScreen(new Vector2(x, 0));
    ctx.beginPath();
    ctx.moveTo(screenPos.x, 0);
    ctx.lineTo(screenPos.x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = Math.floor(viewBounds.minY / gridSize) * gridSize; y <= viewBounds.maxY; y += gridSize) {
    const screenPos = worldToScreen(new Vector2(0, y));
    ctx.beginPath();
    ctx.moveTo(0, screenPos.y);
    ctx.lineTo(canvas.width, screenPos.y);
    ctx.stroke();
  }

  // Draw axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;

  const origin = worldToScreen(new Vector2(0, 0));

  // X axis
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(canvas.width, origin.y);
  ctx.stroke();

  // Y axis
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, canvas.height);
  ctx.stroke();

  ctx.restore();
}

// Initial state
updateUI();
updatePrompt();
render();

console.log('Advanced Room Demo initialized!');
console.log('Draw rectangles and walls to create floor plans');
console.log('Rooms will be automatically detected');
