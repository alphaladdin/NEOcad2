/**
 * ParametricDoor - Example Usage
 *
 * Comprehensive examples demonstrating how to use the ParametricDoor class
 * in various scenarios within the NEOcad application.
 */

import * as THREE from 'three';
import { Viewport } from '@viewport/Viewport';
import { ParameterEngine } from './ParameterEngine';
import { ParametricDoor } from './ParametricDoor';
import { ParametricWall } from './ParametricWall';
import { getGeometryEngine } from './GeometryEngineWrapper';
import { eventBus, Events } from '@core/EventBus';
import { logger } from '@utils/Logger';

/**
 * Example 1: Create a standard door
 */
export function example1_CreateStandardDoor(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): ParametricDoor {
  logger.info('DoorExample', '=== Example 1: Create Standard Door ===');

  const geometryEngine = getGeometryEngine();

  // Create a standard single door (900mm x 2100mm)
  const door = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);

  logger.info('DoorExample', `Created door: ${door.name}`);
  logger.info('DoorExample', `Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `Height: ${door.getParameterValue('Height')}mm`);
  logger.info('DoorExample', `Leaf Area: ${door.getParameterValue('LeafArea').toFixed(2)}m²`);
  logger.info('DoorExample', `Opening Area: ${door.getParameterValue('OpeningArea').toFixed(2)}m²`);

  // Add to scene
  const mesh = door.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
    logger.info('DoorExample', 'Door added to scene');
  }

  return door;
}

/**
 * Example 2: Create and customize door parameters
 */
export function example2_CustomizeDoorParameters(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): ParametricDoor {
  logger.info('DoorExample', '=== Example 2: Customize Door Parameters ===');

  const geometryEngine = getGeometryEngine();

  // Create a standard door
  const door = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);

  logger.info('DoorExample', 'Initial parameters:');
  logger.info('DoorExample', `  Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Height: ${door.getParameterValue('Height')}mm`);

  // Customize parameters
  door.setParameterValue('Width', 1000); // Make door wider
  door.setParameterValue('Height', 2400); // Make door taller
  door.setParameterValue('SwingDirection', 'left'); // Change swing direction

  logger.info('DoorExample', 'After customization:');
  logger.info('DoorExample', `  Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Height: ${door.getParameterValue('Height')}mm`);
  logger.info('DoorExample', `  Swing Direction: ${door.getParameterValue('SwingDirection')}`);
  logger.info('DoorExample', `  Opening Area: ${door.getParameterValue('OpeningArea').toFixed(2)}m² (auto-updated)`);

  // Add to scene
  const mesh = door.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
  }

  return door;
}

/**
 * Example 3: Create double door
 */
export function example3_CreateDoubleDoor(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): ParametricDoor {
  logger.info('DoorExample', '=== Example 3: Create Double Door ===');

  const geometryEngine = getGeometryEngine();

  // Create a double door
  const door = ParametricDoor.createDoubleDoor(parameterEngine, geometryEngine);

  logger.info('DoorExample', `Created double door: ${door.name}`);
  logger.info('DoorExample', `Total Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `Width per leaf: ${door.getParameterValue('Width') / 2}mm`);
  logger.info('DoorExample', `Is Double Door: ${door.getParameterValue('IsDoubleDoor')}`);
  logger.info('DoorExample', `Leaf Area (per leaf): ${door.getParameterValue('LeafArea').toFixed(2)}m²`);

  // Position door at specific location
  door.setPosition(new THREE.Vector3(3000, 0, 0));

  // Add to scene
  const mesh = door.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
    logger.info('DoorExample', 'Double door added to scene');
  }

  return door;
}

/**
 * Example 4: Place door in wall
 */
export function example4_PlaceDoorInWall(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): { wall: ParametricWall; door: ParametricDoor } {
  logger.info('DoorExample', '=== Example 4: Place Door In Wall ===');

  const geometryEngine = getGeometryEngine();

  // Create a wall
  const wall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(0, 0, 0),
    endPoint: new THREE.Vector3(10000, 0, 0),
    height: 3000,
    thickness: 200,
  });

  logger.info('DoorExample', `Created wall: ${wall.name}`);
  logger.info('DoorExample', `Wall length: ${wall.getLength()}mm`);

  // Create a door
  const door = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);

  // Place door in wall at 30% position
  const success = door.placeInWall(wall, 0.3);

  if (success) {
    logger.info('DoorExample', 'Door successfully placed in wall');
    logger.info('DoorExample', `Door position: ${door.getPosition().toArray().map(v => v.toFixed(0)).join(', ')}`);
    logger.info('DoorExample', `Door rotation: ${door.getParameterValue('Rotation').toFixed(1)}°`);
    logger.info('DoorExample', `Frame depth matches wall thickness: ${door.getParameterValue('FrameDepth')}mm`);
  } else {
    logger.error('DoorExample', 'Failed to place door in wall');
  }

  // Add to scene
  const wallMesh = wall.getMesh();
  const doorMesh = door.getMesh();

  if (viewport.world.scene) {
    if (wallMesh) viewport.world.scene.three.add(wallMesh);
    if (doorMesh) viewport.world.scene.three.add(doorMesh);
  }

  return { wall, door };
}

/**
 * Example 5: Animate door opening and closing
 */
export async function example5_AnimateDoorOpening(door: ParametricDoor): Promise<void> {
  logger.info('DoorExample', '=== Example 5: Animate Door Opening ===');

  logger.info('DoorExample', 'Opening door...');
  await door.animateOpen(1500); // Open over 1.5 seconds
  logger.info('DoorExample', `Door is now ${(door.getOpenAmount() * 100).toFixed(0)}% open`);

  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));

  logger.info('DoorExample', 'Closing door...');
  await door.animateClose(1500); // Close over 1.5 seconds
  logger.info('DoorExample', `Door is now ${(door.getOpenAmount() * 100).toFixed(0)}% open (closed)`);
}

/**
 * Example 6: Manual door opening control
 */
export function example6_ManualDoorControl(door: ParametricDoor): void {
  logger.info('DoorExample', '=== Example 6: Manual Door Control ===');

  logger.info('DoorExample', 'Setting door to 25% open');
  door.setOpenAmount(0.25);
  logger.info('DoorExample', `Door open amount: ${door.getOpenAmount()}`);

  logger.info('DoorExample', 'Setting door to 50% open');
  door.setOpenAmount(0.5);
  logger.info('DoorExample', `Door open amount: ${door.getOpenAmount()}`);

  logger.info('DoorExample', 'Setting door to 75% open');
  door.setOpenAmount(0.75);
  logger.info('DoorExample', `Door open amount: ${door.getOpenAmount()}`);

  logger.info('DoorExample', 'Fully opening door');
  door.setOpenAmount(1.0);
  logger.info('DoorExample', `Door open amount: ${door.getOpenAmount()}`);

  logger.info('DoorExample', 'Closing door');
  door.setOpenAmount(0.0);
  logger.info('DoorExample', `Door open amount: ${door.getOpenAmount()}`);
}

/**
 * Example 7: Create different door types
 */
export function example7_DifferentDoorTypes(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): ParametricDoor[] {
  logger.info('DoorExample', '=== Example 7: Different Door Types ===');

  const geometryEngine = getGeometryEngine();
  const doors: ParametricDoor[] = [];

  // Standard door
  const standardDoor = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);
  standardDoor.setPosition(new THREE.Vector3(0, 0, 0));
  doors.push(standardDoor);
  logger.info('DoorExample', `Created standard door at (0, 0, 0)`);

  // Double door
  const doubleDoor = ParametricDoor.createDoubleDoor(parameterEngine, geometryEngine);
  doubleDoor.setPosition(new THREE.Vector3(3000, 0, 0));
  doors.push(doubleDoor);
  logger.info('DoorExample', `Created double door at (3000, 0, 0)`);

  // Wide door
  const wideDoor = ParametricDoor.createWideDoor(parameterEngine, geometryEngine);
  wideDoor.setPosition(new THREE.Vector3(6000, 0, 0));
  doors.push(wideDoor);
  logger.info('DoorExample', `Created wide door at (6000, 0, 0)`);

  // Glass door
  const glassDoor = ParametricDoor.createGlassDoor(parameterEngine, geometryEngine);
  glassDoor.setPosition(new THREE.Vector3(9000, 0, 0));
  doors.push(glassDoor);
  logger.info('DoorExample', `Created glass door at (9000, 0, 0)`);

  // Accessible door
  const accessibleDoor = ParametricDoor.createAccessibleDoor(parameterEngine, geometryEngine);
  accessibleDoor.setPosition(new THREE.Vector3(12000, 0, 0));
  doors.push(accessibleDoor);
  logger.info('DoorExample', `Created accessible door at (12000, 0, 0)`);

  // Add all to scene
  if (viewport.world.scene) {
    doors.forEach(door => {
      const mesh = door.getMesh();
      if (mesh) viewport.world.scene.three.add(mesh);
    });
  }

  return doors;
}

/**
 * Example 8: Create doors with formulas
 */
export function example8_DoorsWithFormulas(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): ParametricDoor {
  logger.info('DoorExample', '=== Example 8: Doors With Formulas ===');

  const geometryEngine = getGeometryEngine();

  // Create door
  const door = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);

  // Set up formulas
  // Make handle height proportional to door height (45% of height)
  door.setParameterFormula('HandleHeight', 'Height * 0.45');

  // Make frame width proportional to door width (10% of width)
  door.setParameterFormula('FrameWidth', 'Width * 0.1');

  logger.info('DoorExample', 'Initial state:');
  logger.info('DoorExample', `  Height: ${door.getParameterValue('Height')}mm`);
  logger.info('DoorExample', `  Handle Height: ${door.getParameterValue('HandleHeight')}mm (formula-driven)`);
  logger.info('DoorExample', `  Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Frame Width: ${door.getParameterValue('FrameWidth')}mm (formula-driven)`);

  // Change height - handle height will update automatically
  door.setParameterValue('Height', 2400);

  logger.info('DoorExample', 'After height change:');
  logger.info('DoorExample', `  Height: ${door.getParameterValue('Height')}mm`);
  logger.info('DoorExample', `  Handle Height: ${door.getParameterValue('HandleHeight')}mm (auto-updated)`);

  // Change width - frame width will update automatically
  door.setParameterValue('Width', 1000);

  logger.info('DoorExample', 'After width change:');
  logger.info('DoorExample', `  Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Frame Width: ${door.getParameterValue('FrameWidth')}mm (auto-updated)`);

  // Add to scene
  const mesh = door.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
  }

  return door;
}

/**
 * Example 9: Listen to door events
 */
export function example9_DoorEvents(): void {
  logger.info('DoorExample', '=== Example 9: Door Events ===');

  // Listen for door creation
  eventBus.on(Events.PARAMETRIC_ELEMENT_CREATED, (data: any) => {
    if (data.type === 'Door') {
      logger.info('DoorExample', `Door created: ${data.element.name}`);
    }
  });

  // Listen for door updates
  eventBus.on(Events.PARAMETRIC_ELEMENT_UPDATED, (data: any) => {
    if (data.element.type === 'Door') {
      logger.info('DoorExample', `Door updated: ${data.element.name}`);
    }
  });

  // Listen for door removal
  eventBus.on(Events.PARAMETRIC_ELEMENT_REMOVED, (data: any) => {
    if (data.element.type === 'Door') {
      logger.info('DoorExample', `Door removed: ${data.element.name}`);
    }
  });

  logger.info('DoorExample', 'Door event listeners registered');
}

/**
 * Example 10: Clone and modify doors
 */
export function example10_CloneDoor(door: ParametricDoor): ParametricDoor {
  logger.info('DoorExample', '=== Example 10: Clone Door ===');

  logger.info('DoorExample', `Original door: ${door.name}`);
  logger.info('DoorExample', `  Width: ${door.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Height: ${door.getParameterValue('Height')}mm`);

  // Clone the door
  const clonedDoor = door.clone();

  logger.info('DoorExample', `Cloned door: ${clonedDoor.name}`);
  logger.info('DoorExample', `  Width: ${clonedDoor.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Height: ${clonedDoor.getParameterValue('Height')}mm`);

  // Modify clone
  clonedDoor.setParameterValue('Width', 1200);
  clonedDoor.setPosition(new THREE.Vector3(5000, 0, 0));

  logger.info('DoorExample', 'After modifying clone:');
  logger.info('DoorExample', `  Original Width: ${door.getParameterValue('Width')}mm (unchanged)`);
  logger.info('DoorExample', `  Clone Width: ${clonedDoor.getParameterValue('Width')}mm (modified)`);

  return clonedDoor;
}

/**
 * Example 11: Export and import doors
 */
export function example11_ExportImportDoor(
  door: ParametricDoor,
  parameterEngine: ParameterEngine
): ParametricDoor {
  logger.info('DoorExample', '=== Example 11: Export and Import Door ===');

  // Export door to JSON
  const exportData = door.toJSON();
  logger.info('DoorExample', 'Exported door data:');
  logger.info('DoorExample', JSON.stringify(exportData, null, 2).substring(0, 500) + '...');

  // Convert to JSON string (simulate saving to file/database)
  const jsonString = JSON.stringify(exportData);
  logger.info('DoorExample', `JSON size: ${jsonString.length} bytes`);

  // Import door from JSON
  const geometryEngine = getGeometryEngine();
  const importedDoor = ParametricDoor.fromJSON(
    JSON.parse(jsonString),
    parameterEngine,
    geometryEngine
  );

  logger.info('DoorExample', `Imported door: ${importedDoor.name}`);
  logger.info('DoorExample', `  Width: ${importedDoor.getParameterValue('Width')}mm`);
  logger.info('DoorExample', `  Height: ${importedDoor.getParameterValue('Height')}mm`);

  return importedDoor;
}

/**
 * Example 12: Multiple doors in a room layout
 */
export function example12_RoomWithDoors(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): { walls: ParametricWall[]; doors: ParametricDoor[] } {
  logger.info('DoorExample', '=== Example 12: Room With Doors ===');

  const geometryEngine = getGeometryEngine();

  // Create a rectangular room (4 walls)
  const roomWidth = 8000; // 8 meters
  const roomDepth = 6000; // 6 meters
  const wallHeight = 3000; // 3 meters
  const wallThickness = 200;

  const walls: ParametricWall[] = [];
  const doors: ParametricDoor[] = [];

  // North wall
  const northWall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(0, 0, 0),
    endPoint: new THREE.Vector3(roomWidth, 0, 0),
    height: wallHeight,
    thickness: wallThickness,
  });
  walls.push(northWall);

  // East wall
  const eastWall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(roomWidth, 0, 0),
    endPoint: new THREE.Vector3(roomWidth, 0, roomDepth),
    height: wallHeight,
    thickness: wallThickness,
  });
  walls.push(eastWall);

  // South wall
  const southWall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(roomWidth, 0, roomDepth),
    endPoint: new THREE.Vector3(0, 0, roomDepth),
    height: wallHeight,
    thickness: wallThickness,
  });
  walls.push(southWall);

  // West wall
  const westWall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(0, 0, roomDepth),
    endPoint: new THREE.Vector3(0, 0, 0),
    height: wallHeight,
    thickness: wallThickness,
  });
  walls.push(westWall);

  logger.info('DoorExample', 'Created rectangular room:');
  logger.info('DoorExample', `  Size: ${roomWidth}mm x ${roomDepth}mm`);
  logger.info('DoorExample', `  Height: ${wallHeight}mm`);

  // Add entrance door in north wall
  const entranceDoor = ParametricDoor.createStandardDoor(parameterEngine, geometryEngine);
  entranceDoor.placeInWall(northWall, 0.3);
  doors.push(entranceDoor);
  logger.info('DoorExample', 'Added entrance door in north wall');

  // Add double door in south wall
  const doubleDoor = ParametricDoor.createDoubleDoor(parameterEngine, geometryEngine);
  doubleDoor.placeInWall(southWall, 0.5);
  doors.push(doubleDoor);
  logger.info('DoorExample', 'Added double door in south wall');

  // Add to scene
  if (viewport.world.scene) {
    walls.forEach(wall => {
      const mesh = wall.getMesh();
      if (mesh) viewport.world.scene.three.add(mesh);
    });

    doors.forEach(door => {
      const mesh = door.getMesh();
      if (mesh) viewport.world.scene.three.add(mesh);
    });
  }

  return { walls, doors };
}

/**
 * Complete demonstration: Run all door examples
 */
export async function runAllDoorExamples(viewport: Viewport): Promise<void> {
  logger.info('DoorExample', '');
  logger.info('DoorExample', '╔═══════════════════════════════════════════════════╗');
  logger.info('DoorExample', '║     PARAMETRIC DOOR - USAGE EXAMPLES              ║');
  logger.info('DoorExample', '╚═══════════════════════════════════════════════════╝');
  logger.info('DoorExample', '');

  // Initialize parametric system
  const geometryEngine = getGeometryEngine();
  if (!geometryEngine.isReady()) {
    await geometryEngine.initialize({
      wasmPath: '/wasm/',
    });
  }

  const parameterEngine = new ParameterEngine();

  // Setup event listeners
  example9_DoorEvents();

  // Run examples
  const standardDoor = example1_CreateStandardDoor(viewport, parameterEngine);
  logger.info('DoorExample', '');

  example2_CustomizeDoorParameters(viewport, parameterEngine);
  logger.info('DoorExample', '');

  const doubleDoor = example3_CreateDoubleDoor(viewport, parameterEngine);
  logger.info('DoorExample', '');

  const { wall, door } = example4_PlaceDoorInWall(viewport, parameterEngine);
  logger.info('DoorExample', '');

  // Animate door (async)
  await example5_AnimateDoorOpening(door);
  logger.info('DoorExample', '');

  example6_ManualDoorControl(door);
  logger.info('DoorExample', '');

  example7_DifferentDoorTypes(viewport, parameterEngine);
  logger.info('DoorExample', '');

  example8_DoorsWithFormulas(viewport, parameterEngine);
  logger.info('DoorExample', '');

  const clonedDoor = example10_CloneDoor(standardDoor);
  logger.info('DoorExample', '');

  example11_ExportImportDoor(standardDoor, parameterEngine);
  logger.info('DoorExample', '');

  example12_RoomWithDoors(viewport, parameterEngine);
  logger.info('DoorExample', '');

  logger.info('DoorExample', '╔═══════════════════════════════════════════════════╗');
  logger.info('DoorExample', '║     ALL EXAMPLES COMPLETED!                       ║');
  logger.info('DoorExample', '╚═══════════════════════════════════════════════════╝');
  logger.info('DoorExample', '');
}
