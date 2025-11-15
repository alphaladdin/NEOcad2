/**
 * Example usage of the parametric modeling system
 * Shows how to integrate with NEOcad viewport and UI
 */

import * as THREE from 'three';
import { Viewport } from '@viewport/Viewport';
import { ParameterEngine } from './ParameterEngine';
import { ParametricWall } from './ParametricWall';
import { getGeometryEngine } from './GeometryEngineWrapper';
import { WallCreationTool } from '@tools/WallCreationTool';
import { eventBus, Events } from '@core/EventBus';
import { logger } from '@utils/Logger';

/**
 * Initialize the parametric system
 * This should be called during application initialization
 */
export async function initializeParametricSystem(): Promise<{
  parameterEngine: ParameterEngine;
  ready: boolean;
}> {
  logger.info('ParametricExample', 'Initializing parametric system...');

  // Create parameter engine
  const parameterEngine = new ParameterEngine();

  // Get geometry engine singleton
  const geometryEngine = getGeometryEngine();

  // Initialize geometry engine (loads web-ifc WASM)
  try {
    await geometryEngine.initialize({
      wasmPath: '/wasm/',
    });

    logger.info('ParametricExample', 'Parametric system initialized successfully');
    return { parameterEngine, ready: true };
  } catch (error) {
    logger.error('ParametricExample', 'Failed to initialize parametric system:', error);
    return { parameterEngine, ready: false };
  }
}

/**
 * Example 1: Create a simple wall programmatically
 */
export function example1_CreateSimpleWall(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): void {
  logger.info('ParametricExample', '=== Example 1: Create Simple Wall ===');

  const geometryEngine = getGeometryEngine();

  // Create wall
  const wall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(0, 0, 0),
    endPoint: new THREE.Vector3(5000, 0, 0),
    height: 3000,
    thickness: 200,
  });

  logger.info('ParametricExample', `Created wall: ${wall.name}`);
  logger.info('ParametricExample', `Length: ${wall.getLength()}mm`);
  logger.info('ParametricExample', `Area: ${wall.getArea()}m²`);
  logger.info('ParametricExample', `Volume: ${wall.getVolume()}m³`);

  // Add to scene
  const mesh = wall.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
    logger.info('ParametricExample', 'Wall added to scene');
  }
}

/**
 * Example 2: Create wall with formulas
 */
export function example2_CreateWallWithFormulas(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): void {
  logger.info('ParametricExample', '=== Example 2: Create Wall with Formulas ===');

  const geometryEngine = getGeometryEngine();

  // Create wall
  const wall = new ParametricWall(parameterEngine, geometryEngine, {
    startPoint: new THREE.Vector3(0, 0, 0),
    endPoint: new THREE.Vector3(10000, 0, 0),
    height: 3000,
    thickness: 200,
  });

  // You can set formulas on existing parameters
  // For example, make thickness depend on height
  wall.setParameterFormula('Thickness', 'Height / 15');

  logger.info('ParametricExample', `Initial - Height: ${wall.getParameterValue('Height')}mm, Thickness: ${wall.getParameterValue('Thickness')}mm`);

  // Change height - thickness will update automatically
  wall.setParameterValue('Height', 4500);

  logger.info('ParametricExample', `After height change - Thickness: ${wall.getParameterValue('Thickness')}mm`);

  // Add to scene
  const mesh = wall.getMesh();
  if (mesh && viewport.world.scene) {
    viewport.world.scene.three.add(mesh);
  }
}

/**
 * Example 3: Interactive wall creation with WallCreationTool
 */
export function example3_InteractiveWallCreation(
  viewport: Viewport,
  parameterEngine: ParameterEngine
): WallCreationTool {
  logger.info('ParametricExample', '=== Example 3: Interactive Wall Creation ===');

  const geometryEngine = getGeometryEngine();

  // Create wall creation tool
  const wallTool = new WallCreationTool(
    viewport.world.scene.three,
    viewport.world.camera.three,
    parameterEngine,
    geometryEngine,
    {
      defaultHeight: 3000,
      defaultThickness: 200,
      snapToGrid: true,
      gridSize: 100,
    }
  );

  // Activate the tool
  wallTool.activate();

  // Setup viewport interaction
  // You would typically do this in your viewport's mouse event handlers
  const handleClick = (event: MouseEvent) => {
    if (!wallTool.isToolActive()) return;

    // Get 3D point from mouse click using raycaster
    // This is a simplified example - actual implementation would use viewport's raycaster
    const rect = viewport.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), viewport.world.camera.three);

    // Intersect with ground plane (y = 0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);

    if (intersectionPoint) {
      wallTool.onClick(intersectionPoint);
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!wallTool.isToolActive()) return;

    // Similar to handleClick, get 3D point for preview
    const rect = viewport.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), viewport.world.camera.three);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);

    if (intersectionPoint) {
      wallTool.onMouseMove(intersectionPoint);
    }
  };

  // Add event listeners
  viewport.container.addEventListener('click', handleClick);
  viewport.container.addEventListener('mousemove', handleMouseMove);

  logger.info('ParametricExample', 'Wall creation tool activated');
  logger.info('ParametricExample', 'Click two points to create a wall. Press ESC to cancel.');

  return wallTool;
}

/**
 * Example 4: Listen to parametric events
 */
export function example4_ParametricEvents(): void {
  logger.info('ParametricExample', '=== Example 4: Parametric Events ===');

  // Listen for wall creation
  eventBus.on(Events.PARAMETRIC_ELEMENT_CREATED, (data: any) => {
    logger.info('ParametricExample', `Element created: ${data.element.name} (${data.type})`);
  });

  // Listen for wall updates
  eventBus.on(Events.PARAMETRIC_ELEMENT_UPDATED, (data: any) => {
    logger.info('ParametricExample', `Element updated: ${data.element.name}`);
  });

  // Listen for wall removal
  eventBus.on(Events.PARAMETRIC_ELEMENT_REMOVED, (data: any) => {
    logger.info('ParametricExample', `Element removed: ${data.element.name}`);
  });

  logger.info('ParametricExample', 'Event listeners registered');
}

/**
 * Example 5: Modify wall parameters dynamically
 */
export function example5_ModifyParameters(wall: ParametricWall): void {
  logger.info('ParametricExample', '=== Example 5: Modify Parameters Dynamically ===');

  logger.info('ParametricExample', 'Initial state:');
  logger.info('ParametricExample', `  Height: ${wall.getParameterValue('Height')}mm`);
  logger.info('ParametricExample', `  Thickness: ${wall.getParameterValue('Thickness')}mm`);
  logger.info('ParametricExample', `  Area: ${wall.getArea()}m²`);

  // Modify height - area will automatically recalculate
  wall.setParameterValue('Height', 4000);

  logger.info('ParametricExample', 'After height change:');
  logger.info('ParametricExample', `  Height: ${wall.getParameterValue('Height')}mm`);
  logger.info('ParametricExample', `  Area: ${wall.getArea()}m² (automatically updated)`);

  // Modify end point - length, area, and volume will automatically recalculate
  wall.setEndPoint(new THREE.Vector3(8000, 0, 0));

  logger.info('ParametricExample', 'After endpoint change:');
  logger.info('ParametricExample', `  Length: ${wall.getLength()}mm (automatically updated)`);
  logger.info('ParametricExample', `  Area: ${wall.getArea()}m² (automatically updated)`);
  logger.info('ParametricExample', `  Volume: ${wall.getVolume()}m³ (automatically updated)`);
}

/**
 * Example 6: Export and import walls
 */
export function example6_ExportImport(
  wallTool: WallCreationTool,
  parameterEngine: ParameterEngine
): void {
  logger.info('ParametricExample', '=== Example 6: Export and Import ===');

  // Export walls
  const exportData = wallTool.exportWalls();
  logger.info('ParametricExample', `Exported ${exportData.walls.length} walls`);
  logger.info('ParametricExample', JSON.stringify(exportData, null, 2).substring(0, 500) + '...');

  // You could save this to a file or database
  const jsonString = JSON.stringify(exportData);
  logger.info('ParametricExample', `JSON size: ${jsonString.length} bytes`);

  // Import walls (in a new session)
  wallTool.importWalls(exportData);
  logger.info('ParametricExample', `Imported ${exportData.walls.length} walls`);
}

/**
 * Complete example: Setup parametric modeling in NEOcad
 */
export async function setupParametricModeling(viewport: Viewport): Promise<void> {
  logger.info('ParametricExample', '');
  logger.info('ParametricExample', '╔═══════════════════════════════════════════════════╗');
  logger.info('ParametricExample', '║   PARAMETRIC MODELING - USAGE EXAMPLES            ║');
  logger.info('ParametricExample', '╚═══════════════════════════════════════════════════╝');
  logger.info('ParametricExample', '');

  // Initialize parametric system
  const { parameterEngine, ready } = await initializeParametricSystem();

  if (!ready) {
    logger.error('ParametricExample', 'Cannot run examples: Parametric system not ready');
    return;
  }

  // Setup event listeners
  example4_ParametricEvents();

  // Run examples
  example1_CreateSimpleWall(viewport, parameterEngine);

  logger.info('ParametricExample', '');
  logger.info('ParametricExample', 'Examples complete! Check the viewport for created walls.');
  logger.info('ParametricExample', '');
}
