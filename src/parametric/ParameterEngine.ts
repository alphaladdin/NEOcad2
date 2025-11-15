/**
 * ParameterEngine - Manages parameters, formulas, and dependency propagation
 */

import { create, all } from 'mathjs';
import { logger } from '@utils/Logger';
import { Parameter } from './Parameter';

const math = create(all);

export class ParameterEngine {
  private parameters: Map<string, Parameter>;
  private parametersByName: Map<string, Parameter>;

  constructor() {
    this.parameters = new Map();
    this.parametersByName = new Map();
    logger.info('ParameterEngine', 'ParameterEngine created');
  }

  /**
   * Register a parameter
   */
  registerParameter(parameter: Parameter): void {
    this.parameters.set(parameter.id, parameter);
    this.parametersByName.set(parameter.name, parameter);
    logger.debug('ParameterEngine', `Registered parameter: ${parameter.name}`);
  }

  /**
   * Unregister a parameter
   */
  unregisterParameter(parameter: Parameter): void {
    this.parameters.delete(parameter.id);
    this.parametersByName.delete(parameter.name);
    parameter.clearDependencies();
    logger.debug('ParameterEngine', `Unregistered parameter: ${parameter.name}`);
  }

  /**
   * Get parameter by ID
   */
  getParameter(id: string): Parameter | undefined {
    return this.parameters.get(id);
  }

  /**
   * Get parameter by name
   */
  getParameterByName(name: string): Parameter | undefined {
    return this.parametersByName.get(name);
  }

  /**
   * Get all parameters
   */
  getAllParameters(): Parameter[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Update a parameter value and propagate changes
   */
  updateParameter(parameter: Parameter, newValue: any): void {
    if (parameter.hasFormula) {
      logger.warn('ParameterEngine', `Cannot set value for formula-driven parameter: ${parameter.name}`);
      return;
    }

    parameter.value = newValue;
    this.propagateChanges(parameter);
  }

  /**
   * Set formula for a parameter
   */
  setFormula(parameter: Parameter, formula: string): void {
    // Clear old dependencies
    parameter.clearDependencies();

    // Set new formula
    parameter.formula = formula;

    // Parse and establish dependencies
    const dependencies = this.parseFormulaDependencies(formula);
    dependencies.forEach((depName) => {
      const depParam = this.getParameterByName(depName);
      if (depParam) {
        parameter.addDependency(depParam);
      } else {
        logger.warn('ParameterEngine', `Dependency not found: ${depName} in formula: ${formula}`);
      }
    });

    // Validate for circular dependencies
    if (this.hasCircularDependency(parameter)) {
      logger.error('ParameterEngine', `Circular dependency detected for parameter: ${parameter.name}`);
      parameter.formula = null;
      parameter.clearDependencies();
      return;
    }

    // Evaluate the formula
    this.evaluateParameter(parameter);
  }

  /**
   * Parse formula to extract parameter names
   */
  private parseFormulaDependencies(formula: string): string[] {
    // Remove the "=" prefix if present
    const cleanFormula = formula.trim().startsWith('=') ? formula.slice(1) : formula;

    // Extract identifiers (parameter names)
    // Match words that are not math functions
    const mathFunctions = new Set([
      'abs',
      'sqrt',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'log',
      'ln',
      'exp',
      'pow',
      'min',
      'max',
      'round',
      'floor',
      'ceil',
      'pi',
      'e',
    ]);

    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const matches = cleanFormula.match(identifierRegex) || [];

    const dependencies = matches.filter((match) => !mathFunctions.has(match.toLowerCase()));

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Evaluate a parameter's formula
   */
  evaluateParameter(parameter: Parameter): void {
    if (!parameter.hasFormula) {
      return;
    }

    if (parameter.isEvaluating) {
      logger.error('ParameterEngine', `Circular dependency during evaluation: ${parameter.name}`);
      return;
    }

    parameter.setEvaluating(true);

    try {
      // Build scope with dependency values
      const scope: Record<string, any> = {};
      parameter.getDependencies().forEach((dep) => {
        scope[dep.name] = dep.value;
      });

      // Remove "=" prefix if present
      const formula = parameter.formula!;
      const cleanFormula = formula.trim().startsWith('=') ? formula.slice(1) : formula;

      // Evaluate the formula
      const result = math.evaluate(cleanFormula, scope);

      // Update the parameter value
      parameter.updateValue(result);

      logger.debug('ParameterEngine', `Evaluated ${parameter.name}: ${cleanFormula} = ${result}`);
    } catch (error) {
      logger.error('ParameterEngine', `Error evaluating formula for ${parameter.name}: ${error}`);
    } finally {
      parameter.setEvaluating(false);
    }
  }

  /**
   * Propagate changes to all dependent parameters
   */
  propagateChanges(parameter: Parameter): void {
    const dependents = parameter.getDependents();

    logger.debug(
      'ParameterEngine',
      `Propagating changes from ${parameter.name} to ${dependents.length} dependents`
    );

    dependents.forEach((dependent) => {
      this.evaluateParameter(dependent);
      // Recursively propagate to dependents of dependents
      this.propagateChanges(dependent);
    });
  }

  /**
   * Check for circular dependencies using depth-first search
   */
  hasCircularDependency(parameter: Parameter): boolean {
    const visited = new Set<Parameter>();
    const recursionStack = new Set<Parameter>();

    const dfs = (current: Parameter): boolean => {
      visited.add(current);
      recursionStack.add(current);

      for (const dep of current.getDependencies()) {
        if (!visited.has(dep)) {
          if (dfs(dep)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          return true;
        }
      }

      recursionStack.delete(current);
      return false;
    };

    return dfs(parameter);
  }

  /**
   * Evaluate all formula-driven parameters
   */
  evaluateAll(): void {
    // Topological sort to evaluate in correct order
    const sorted = this.topologicalSort();

    sorted.forEach((parameter) => {
      if (parameter.hasFormula) {
        this.evaluateParameter(parameter);
      }
    });
  }

  /**
   * Topological sort of parameters based on dependencies
   */
  private topologicalSort(): Parameter[] {
    const visited = new Set<Parameter>();
    const result: Parameter[] = [];

    const visit = (parameter: Parameter) => {
      if (visited.has(parameter)) {
        return;
      }

      visited.add(parameter);

      // Visit dependencies first
      parameter.getDependencies().forEach((dep) => {
        visit(dep);
      });

      result.push(parameter);
    };

    this.parameters.forEach((parameter) => {
      visit(parameter);
    });

    return result;
  }

  /**
   * Get dependency graph (for visualization)
   */
  getDependencyGraph(): { nodes: any[]; edges: any[] } {
    const nodes = this.getAllParameters().map((param) => ({
      id: param.id,
      name: param.name,
      value: param.value,
      hasFormula: param.hasFormula,
    }));

    const edges: any[] = [];
    this.parameters.forEach((param) => {
      param.getDependencies().forEach((dep) => {
        edges.push({
          from: dep.id,
          to: param.id,
        });
      });
    });

    return { nodes, edges };
  }

  /**
   * Clear all parameters
   */
  clear(): void {
    this.parameters.forEach((param) => {
      param.clearDependencies();
    });
    this.parameters.clear();
    this.parametersByName.clear();
    logger.info('ParameterEngine', 'Cleared all parameters');
  }

  /**
   * Export all parameters to JSON
   */
  exportParameters(): any {
    return {
      parameters: Array.from(this.parameters.values()).map((p) => p.toJSON()),
    };
  }

  /**
   * Import parameters from JSON
   */
  importParameters(data: any): void {
    this.clear();

    // First pass: Create all parameters
    data.parameters.forEach((paramData: any) => {
      const parameter = Parameter.fromJSON(paramData);
      this.registerParameter(parameter);
    });

    // Second pass: Set formulas and establish dependencies
    data.parameters.forEach((paramData: any) => {
      if (paramData.formula) {
        const parameter = this.getParameterByName(paramData.name);
        if (parameter) {
          this.setFormula(parameter, paramData.formula);
        }
      }
    });

    logger.info('ParameterEngine', `Imported ${data.parameters.length} parameters`);
  }
}
