/**
 * Test file for parametric modeling system
 * This can be run to verify the parametric system works correctly
 */

import * as THREE from 'three';
import { Parameter, ParameterType, ParameterUnit } from './Parameter';
import { ParameterEngine } from './ParameterEngine';
import { ParametricWall } from './ParametricWall';
import { getGeometryEngine } from './GeometryEngineWrapper';
import { logger } from '@utils/Logger';

/**
 * Test 1: Parameter creation and formulas
 */
export function testParameters(): boolean {
  logger.info('ParametricTest', '=== Test 1: Parameter Creation and Formulas ===');

  try {
    const engine = new ParameterEngine();

    // Create base parameters
    const width = new Parameter({
      name: 'Width',
      value: 1000,
      type: ParameterType.LENGTH,
      unit: ParameterUnit.MM,
    });

    const height = new Parameter({
      name: 'Height',
      value: 2000,
      type: ParameterType.LENGTH,
      unit: ParameterUnit.MM,
    });

    engine.registerParameter(width);
    engine.registerParameter(height);

    // Create formula-driven parameter
    const area = new Parameter({
      name: 'Area',
      value: 0,
      type: ParameterType.AREA,
      unit: ParameterUnit.M2,
    });

    engine.registerParameter(area);
    engine.setFormula(area, '(Width * Height) / 1000000');

    logger.info('ParametricTest', `Width: ${width.value}mm`);
    logger.info('ParametricTest', `Height: ${height.value}mm`);
    logger.info('ParametricTest', `Area (computed): ${area.value}m²`);

    // Test change propagation
    engine.updateParameter(width, 2000);
    logger.info('ParametricTest', `After width change - Area: ${area.value}m²`);

    // Verify result
    const expectedArea = (2000 * 2000) / 1000000; // 4m²
    const isCorrect = Math.abs(area.value - expectedArea) < 0.001;

    logger.info('ParametricTest', `✓ Test 1 ${isCorrect ? 'PASSED' : 'FAILED'}`);
    return isCorrect;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 1 FAILED: ${error}`);
    return false;
  }
}

/**
 * Test 2: Circular dependency detection
 */
export function testCircularDependency(): boolean {
  logger.info('ParametricTest', '=== Test 2: Circular Dependency Detection ===');

  try {
    const engine = new ParameterEngine();

    const param1 = new Parameter({
      name: 'Param1',
      value: 100,
      type: ParameterType.NUMBER,
    });

    const param2 = new Parameter({
      name: 'Param2',
      value: 200,
      type: ParameterType.NUMBER,
    });

    engine.registerParameter(param1);
    engine.registerParameter(param2);

    // Try to create circular dependency: Param1 = Param2, Param2 = Param1
    engine.setFormula(param1, 'Param2');
    engine.setFormula(param2, 'Param1'); // This should fail

    // If param2 still has a formula, the circular dependency wasn't detected
    const hasCircular = param2.hasFormula === false;

    logger.info(
      'ParametricTest',
      `Param2 formula after circular dependency attempt: ${param2.formula || 'null (correctly rejected)'}`
    );
    logger.info('ParametricTest', `✓ Test 2 ${hasCircular ? 'PASSED' : 'FAILED'}`);
    return hasCircular;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 2 FAILED: ${error}`);
    return false;
  }
}

/**
 * Test 3: Complex formula with multiple dependencies
 */
export function testComplexFormula(): boolean {
  logger.info('ParametricTest', '=== Test 3: Complex Formula with Multiple Dependencies ===');

  try {
    const engine = new ParameterEngine();

    const a = new Parameter({ name: 'A', value: 10, type: ParameterType.NUMBER });
    const b = new Parameter({ name: 'B', value: 20, type: ParameterType.NUMBER });
    const c = new Parameter({ name: 'C', value: 0, type: ParameterType.NUMBER });
    const d = new Parameter({ name: 'D', value: 0, type: ParameterType.NUMBER });

    engine.registerParameter(a);
    engine.registerParameter(b);
    engine.registerParameter(c);
    engine.registerParameter(d);

    // C = A + B
    engine.setFormula(c, 'A + B');

    // D = C * 2 (depends on C, which depends on A and B)
    engine.setFormula(d, 'C * 2');

    logger.info('ParametricTest', `Initial - A: ${a.value}, B: ${b.value}, C: ${c.value}, D: ${d.value}`);

    // Change A, should propagate to C and then to D
    engine.updateParameter(a, 15);

    logger.info('ParametricTest', `After A=15 - C: ${c.value}, D: ${d.value}`);

    // Verify: C should be 35, D should be 70
    const isCorrect = c.value === 35 && d.value === 70;

    logger.info('ParametricTest', `✓ Test 3 ${isCorrect ? 'PASSED' : 'FAILED'}`);
    return isCorrect;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 3 FAILED: ${error}`);
    return false;
  }
}

/**
 * Test 4: ParametricWall creation (without GeometryEngine)
 */
export function testParametricWallParameters(): boolean {
  logger.info('ParametricTest', '=== Test 4: ParametricWall Parameters ===');

  try {
    const engine = new ParameterEngine();
    const geomEngine = getGeometryEngine();

    // Create wall (geometry engine may not be initialized, but parameters should work)
    const wall = new ParametricWall(engine, geomEngine, {
      startPoint: new THREE.Vector3(0, 0, 0),
      endPoint: new THREE.Vector3(5000, 0, 0),
      height: 3000,
      thickness: 200,
    });

    logger.info('ParametricTest', `Wall created: ${wall.name}`);
    logger.info('ParametricTest', `Start: ${wall.getStartPoint().toArray()}`);
    logger.info('ParametricTest', `End: ${wall.getEndPoint().toArray()}`);
    logger.info('ParametricTest', `Length: ${wall.getLength()}mm`);
    logger.info('ParametricTest', `Area: ${wall.getArea()}m²`);
    logger.info('ParametricTest', `Volume: ${wall.getVolume()}m³`);

    // Test parameter change
    wall.setParameterValue('Height', 4000);
    logger.info('ParametricTest', `After height change - Area: ${wall.getArea()}m²`);

    // Verify computed values
    const expectedLength = 5000;
    const expectedArea = (5000 * 4000) / 1000000; // 20m²
    const expectedVolume = (5000 * 4000 * 200) / 1000000000; // 4m³

    const isCorrect =
      Math.abs(wall.getLength() - expectedLength) < 0.1 &&
      Math.abs(wall.getArea() - expectedArea) < 0.1 &&
      Math.abs(wall.getVolume() - expectedVolume) < 0.1;

    logger.info('ParametricTest', `✓ Test 4 ${isCorrect ? 'PASSED' : 'FAILED'}`);

    // Cleanup
    wall.dispose();

    return isCorrect;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 4 FAILED: ${error}`);
    return false;
  }
}

/**
 * Test 5: Unit conversion
 */
export function testUnitConversion(): boolean {
  logger.info('ParametricTest', '=== Test 5: Unit Conversion ===');

  try {
    // Test length conversion: 1000mm to meters
    const result1 = Parameter.convertUnit(1000, ParameterUnit.MM, ParameterUnit.M);
    const expected1 = 1;
    const test1 = Math.abs(result1 - expected1) < 0.001;

    logger.info('ParametricTest', `1000mm = ${result1}m (expected ${expected1}m)`);

    // Test length conversion: 1 inch to mm
    const result2 = Parameter.convertUnit(1, ParameterUnit.IN, ParameterUnit.MM);
    const expected2 = 25.4;
    const test2 = Math.abs(result2 - expected2) < 0.001;

    logger.info('ParametricTest', `1in = ${result2}mm (expected ${expected2}mm)`);

    // Test angle conversion: 180 degrees to radians
    const result3 = Parameter.convertUnit(180, ParameterUnit.DEGREES, ParameterUnit.RADIANS);
    const expected3 = Math.PI;
    const test3 = Math.abs(result3 - expected3) < 0.001;

    logger.info('ParametricTest', `180° = ${result3}rad (expected ${expected3}rad)`);

    const isCorrect = test1 && test2 && test3;
    logger.info('ParametricTest', `✓ Test 5 ${isCorrect ? 'PASSED' : 'FAILED'}`);
    return isCorrect;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 5 FAILED: ${error}`);
    return false;
  }
}

/**
 * Test 6: JSON serialization
 */
export function testSerialization(): boolean {
  logger.info('ParametricTest', '=== Test 6: JSON Serialization ===');

  try {
    const engine = new ParameterEngine();
    const geomEngine = getGeometryEngine();

    // Create wall
    const wall = new ParametricWall(engine, geomEngine, {
      startPoint: new THREE.Vector3(100, 200, 0),
      endPoint: new THREE.Vector3(5100, 200, 0),
      height: 3000,
      thickness: 250,
    });

    wall.name = 'TestWall';

    // Export to JSON
    const json = wall.toJSON();
    logger.info('ParametricTest', `Exported wall: ${JSON.stringify(json, null, 2).substring(0, 200)}...`);

    // Import from JSON
    const wall2 = ParametricWall.fromJSON(json, engine, geomEngine);
    logger.info('ParametricTest', `Imported wall: ${wall2.name}`);

    // Verify
    const isCorrect =
      wall2.name === 'TestWall' &&
      Math.abs(wall2.getLength() - wall.getLength()) < 0.1 &&
      Math.abs(wall2.getParameterValue('Height') - 3000) < 0.1 &&
      Math.abs(wall2.getParameterValue('Thickness') - 250) < 0.1;

    logger.info('ParametricTest', `✓ Test 6 ${isCorrect ? 'PASSED' : 'FAILED'}`);

    // Cleanup
    wall.dispose();
    wall2.dispose();

    return isCorrect;
  } catch (error) {
    logger.error('ParametricTest', `✗ Test 6 FAILED: ${error}`);
    return false;
  }
}

/**
 * Run all tests
 */
export function runAllParametricTests(): void {
  logger.info('ParametricTest', '');
  logger.info('ParametricTest', '╔═══════════════════════════════════════════════════╗');
  logger.info('ParametricTest', '║   PARAMETRIC MODELING SYSTEM - TEST SUITE        ║');
  logger.info('ParametricTest', '╚═══════════════════════════════════════════════════╝');
  logger.info('ParametricTest', '');

  const results = {
    test1: testParameters(),
    test2: testCircularDependency(),
    test3: testComplexFormula(),
    test4: testParametricWallParameters(),
    test5: testUnitConversion(),
    test6: testSerialization(),
  };

  const passed = Object.values(results).filter((r) => r).length;
  const total = Object.values(results).length;

  logger.info('ParametricTest', '');
  logger.info('ParametricTest', '╔═══════════════════════════════════════════════════╗');
  logger.info('ParametricTest', `║   RESULTS: ${passed}/${total} tests passed${' '.repeat(25 - passed.toString().length - total.toString().length)}║`);
  logger.info('ParametricTest', '╚═══════════════════════════════════════════════════╝');
  logger.info('ParametricTest', '');

  if (passed === total) {
    logger.info('ParametricTest', '✓ All tests PASSED! 🎉');
  } else {
    logger.warn('ParametricTest', `⚠ ${total - passed} test(s) FAILED`);
  }
}
