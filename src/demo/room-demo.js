import { Vector2 } from '../cad/Vector2';
import { Room, RoomType } from '../cad/entities/Room';
import { CADViewport } from '../cad/CADViewport';
import { Camera2D } from '../cad/Camera2D';

// Initialize canvas and viewport
const canvas = document.getElementById('canvas');
const viewport = new CADViewport(canvas);
const camera = new Camera2D();

// State
let rooms = [];
let selectedRoom = null;
let isDrawing = false;
let firstCorner = null;
let currentMouse = null;

// UI Elements
const promptEl = document.getElementById('prompt');
const roomTypeSelect = document.getElementById('room-type-select');
const createRoomBtn = document.getElementById('create-room-btn');
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
    updateUI();
    render();
    return;
  }

  // Start drawing new room
  if (!isDrawing) {
    isDrawing = true;
    firstCorner = worldPos;
    currentMouse = worldPos;
    promptEl.textContent = 'Click the opposite corner';
  } else {
    // Complete the rectangle
    const boundary = [
      new Vector2(firstCorner.x, firstCorner.y),
      new Vector2(worldPos.x, firstCorner.y),
      new Vector2(worldPos.x, worldPos.y),
      new Vector2(firstCorner.x, worldPos.y),
    ];

    // Create room
    const roomType = roomTypeSelect.value;
    const room = new Room(boundary, RoomType[roomType.toUpperCase()] || RoomType.UNDEFINED);
    rooms.push(room);
    selectedRoom = room;

    // Reset drawing state
    isDrawing = false;
    firstCorner = null;
    currentMouse = null;
    promptEl.textContent = 'Click to draw another room';

    updateUI();
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

// Create sample room button
createRoomBtn.addEventListener('click', () => {
  const boundary = [
    new Vector2(-5, -5),
    new Vector2(5, -5),
    new Vector2(5, 5),
    new Vector2(-5, 5),
  ];

  const roomType = roomTypeSelect.value;
  const room = new Room(boundary, RoomType[roomType.toUpperCase()] || RoomType.UNDEFINED);
  rooms.push(room);
  selectedRoom = room;

  updateUI();
  render();
});

// Clear button
clearBtn.addEventListener('click', () => {
  rooms = [];
  selectedRoom = null;
  isDrawing = false;
  firstCorner = null;
  currentMouse = null;
  updateUI();
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
    roomsListEl.innerHTML = '<div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">No rooms yet</div>';
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
          ${components.map(c => `
            <div class="component-item">
              <span class="component-name">${c.name}</span>
              <span class="component-qty">×${c.quantity}</span>
            </div>
          `).join('')}
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
      updateUI();
      render();
    });

    roomsListEl.appendChild(card);
  });
}

// Render
function render() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  drawGrid(ctx);

  // Draw rooms
  rooms.forEach(room => {
    const isSelected = room === selectedRoom;
    if (isSelected) {
      room.setColor('#4a9eff');
    } else {
      room.setColor('#00ff00');
    }
    room.render(ctx, worldToScreen);
  });

  // Draw preview rectangle
  if (isDrawing && firstCorner && currentMouse) {
    ctx.save();
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const p1 = worldToScreen(firstCorner);
    const p2 = worldToScreen(currentMouse);

    ctx.strokeRect(
      Math.min(p1.x, p2.x),
      Math.min(p1.y, p2.y),
      Math.abs(p2.x - p1.x),
      Math.abs(p2.y - p1.y)
    );

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

// Initial render
updateUI();
render();

console.log('Room Demo initialized!');
console.log('Draw a rectangle on the canvas to create a room');
