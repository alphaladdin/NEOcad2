/**
 * Test Geometry Utilities
 * Helpers for creating test/demo 3D objects
 */

import * as THREE from 'three';
import * as OBC from '@thatopen/components';

/**
 * Create a colored cube mesh
 */
export function createTestCube(
  size = 2,
  color = 0x6366f1,
  position = new THREE.Vector3(0, size / 2, 0)
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.6,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create a ground plane
 */
export function createGroundPlane(size = 50, color = 0x2a2a2a): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.9,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create a simple building structure
 */
export function createTestBuilding(): THREE.Group {
  const building = new THREE.Group();

  // Foundation
  const foundation = createTestCube(8, 0x4b5563, new THREE.Vector3(0, 0.5, 0));
  foundation.scale.y = 0.5;
  building.add(foundation);

  // Floor 1
  const floor1 = createTestCube(7, 0x6366f1, new THREE.Vector3(0, 3, 0));
  floor1.scale.y = 1.5;
  building.add(floor1);

  // Floor 2
  const floor2 = createTestCube(7, 0x8b5cf6, new THREE.Vector3(0, 6, 0));
  floor2.scale.y = 1.5;
  building.add(floor2);

  // Floor 3
  const floor3 = createTestCube(7, 0xa78bfa, new THREE.Vector3(0, 9, 0));
  floor3.scale.y = 1.5;
  building.add(floor3);

  // Roof
  const roof = createTestCube(8, 0x1f2937, new THREE.Vector3(0, 11.5, 0));
  roof.scale.y = 0.3;
  building.add(roof);

  return building;
}

/**
 * Add test geometry to a world
 */
export function addTestScene(world: OBC.SimpleWorld): void {
  // Add ground plane
  const ground = createGroundPlane();
  world.scene.three.add(ground);

  // Add test building
  const building = createTestBuilding();
  world.scene.three.add(building);
  world.meshes.add(building as any);

  // Add some additional cubes
  const cube1 = createTestCube(1.5, 0x10b981, new THREE.Vector3(-8, 0.75, -5));
  world.scene.three.add(cube1);
  world.meshes.add(cube1);

  const cube2 = createTestCube(1.5, 0xf59e0b, new THREE.Vector3(8, 0.75, -5));
  world.scene.three.add(cube2);
  world.meshes.add(cube2);

  const cube3 = createTestCube(1.5, 0xef4444, new THREE.Vector3(-8, 0.75, 5));
  world.scene.three.add(cube3);
  world.meshes.add(cube3);

  const cube4 = createTestCube(1.5, 0x06b6d4, new THREE.Vector3(8, 0.75, 5));
  world.scene.three.add(cube4);
  world.meshes.add(cube4);
}
