import { Entity } from '../entities/Entity';

/**
 * Base command interface
 */
export interface Command {
  name: string;
  execute(): void;
  undo(): void;
  redo(): void;
  canMerge?(other: Command): boolean;
  merge?(other: Command): void;
}

/**
 * Command types
 */
export enum CommandType {
  ADD_ENTITY = 'add_entity',
  REMOVE_ENTITY = 'remove_entity',
  MODIFY_ENTITY = 'modify_entity',
  MOVE = 'move',
  ROTATE = 'rotate',
  SCALE = 'scale',
  TRANSFORM = 'transform',
  GROUP = 'group',
}

/**
 * Add entity command
 */
export class AddEntityCommand implements Command {
  name = 'Add Entity';
  private entities: Entity[];
  private entityList: Entity[];

  constructor(entities: Entity | Entity[], entityList: Entity[]) {
    this.entities = Array.isArray(entities) ? entities : [entities];
    this.entityList = entityList;
  }

  execute(): void {
    this.entityList.push(...this.entities);
  }

  undo(): void {
    for (const entity of this.entities) {
      const index = this.entityList.indexOf(entity);
      if (index > -1) {
        this.entityList.splice(index, 1);
      }
    }
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Remove entity command
 */
export class RemoveEntityCommand implements Command {
  name = 'Remove Entity';
  private entities: Entity[];
  private entityList: Entity[];
  private indices: number[] = [];

  constructor(entities: Entity | Entity[], entityList: Entity[]) {
    this.entities = Array.isArray(entities) ? entities : [entities];
    this.entityList = entityList;
  }

  execute(): void {
    this.indices = [];
    for (const entity of this.entities) {
      const index = this.entityList.indexOf(entity);
      if (index > -1) {
        this.indices.push(index);
        this.entityList.splice(index, 1);
      }
    }
  }

  undo(): void {
    for (let i = 0; i < this.entities.length; i++) {
      this.entityList.splice(this.indices[i], 0, this.entities[i]);
    }
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Modify entity command (stores before/after state)
 */
export class ModifyEntityCommand implements Command {
  name = 'Modify Entity';
  private entity: Entity;
  private beforeState: any;
  private afterState: any;

  constructor(entity: Entity, beforeState: any, afterState: any) {
    this.entity = entity;
    this.beforeState = beforeState;
    this.afterState = afterState;
  }

  execute(): void {
    this.restoreState(this.afterState);
  }

  undo(): void {
    this.restoreState(this.beforeState);
  }

  redo(): void {
    this.execute();
  }

  private restoreState(state: any): void {
    // Restore entity state from serialized data
    // This is a simplified version - real implementation would need
    // entity-specific restoration logic
    Object.assign(this.entity, state);
  }
}

/**
 * Composite command (group of commands)
 */
export class CompositeCommand implements Command {
  name: string;
  private commands: Command[] = [];

  constructor(name: string, commands: Command[] = []) {
    this.name = name;
    this.commands = commands;
  }

  addCommand(command: Command): void {
    this.commands.push(command);
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    this.execute();
  }

  getCommands(): Command[] {
    return [...this.commands];
  }
}

/**
 * Command history manager
 */
export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number = 100;
  private transactionStack: CompositeCommand[] = [];
  private historyChangedCallbacks: Array<() => void> = [];

  /**
   * Execute and add command to history
   */
  execute(command: Command): void {
    // If in transaction, add to transaction
    if (this.transactionStack.length > 0) {
      const transaction = this.transactionStack[this.transactionStack.length - 1];
      transaction.addCommand(command);
      command.execute();
      return;
    }

    // Execute command
    command.execute();

    // Add to undo stack
    this.undoStack.push(command);

    // Clear redo stack
    this.redoStack = [];

    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyHistoryChanged();
  }

  /**
   * Undo last command
   */
  undo(): boolean {
    if (!this.canUndo()) return false;

    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);

    this.notifyHistoryChanged();
    return true;
  }

  /**
   * Redo last undone command
   */
  redo(): boolean {
    if (!this.canRedo()) return false;

    const command = this.redoStack.pop()!;
    command.redo();
    this.undoStack.push(command);

    this.notifyHistoryChanged();
    return true;
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack size
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Get last command name
   */
  getLastCommandName(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].name;
  }

  /**
   * Get next redo command name
   */
  getNextRedoCommandName(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].name;
  }

  /**
   * Start transaction (group commands)
   */
  beginTransaction(name: string = 'Transaction'): void {
    const transaction = new CompositeCommand(name);
    this.transactionStack.push(transaction);
  }

  /**
   * Commit transaction
   */
  commitTransaction(): void {
    if (this.transactionStack.length === 0) {
      console.warn('No transaction to commit');
      return;
    }

    const transaction = this.transactionStack.pop()!;

    // Only add if transaction has commands
    if (transaction.getCommands().length > 0) {
      // If still in nested transaction, add to parent
      if (this.transactionStack.length > 0) {
        const parent = this.transactionStack[this.transactionStack.length - 1];
        parent.addCommand(transaction);
      } else {
        // Add transaction to history
        this.undoStack.push(transaction);
        this.redoStack = [];

        if (this.undoStack.length > this.maxStackSize) {
          this.undoStack.shift();
        }

        this.notifyHistoryChanged();
      }
    }
  }

  /**
   * Cancel transaction
   */
  cancelTransaction(): void {
    if (this.transactionStack.length === 0) {
      console.warn('No transaction to cancel');
      return;
    }

    const transaction = this.transactionStack.pop()!;
    transaction.undo();
  }

  /**
   * Check if in transaction
   */
  isInTransaction(): boolean {
    return this.transactionStack.length > 0;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.transactionStack = [];
    this.notifyHistoryChanged();
  }

  /**
   * Set max stack size
   */
  setMaxStackSize(size: number): void {
    this.maxStackSize = size;

    // Trim stacks if necessary
    while (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Get history info
   */
  getHistoryInfo(): {
    undoCount: number;
    redoCount: number;
    lastCommand: string | null;
    nextRedo: string | null;
    inTransaction: boolean;
  } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastCommand: this.getLastCommandName(),
      nextRedo: this.getNextRedoCommandName(),
      inTransaction: this.isInTransaction(),
    };
  }

  /**
   * Get command history list
   */
  getHistory(): Array<{ name: string; type: 'undo' | 'redo' }> {
    const history: Array<{ name: string; type: 'undo' | 'redo' }> = [];

    for (const command of this.undoStack) {
      history.push({ name: command.name, type: 'undo' });
    }

    for (let i = this.redoStack.length - 1; i >= 0; i--) {
      history.push({ name: this.redoStack[i].name, type: 'redo' });
    }

    return history;
  }

  /**
   * Add history changed callback
   */
  onHistoryChanged(callback: () => void): void {
    this.historyChangedCallbacks.push(callback);
  }

  /**
   * Remove history changed callback
   */
  offHistoryChanged(callback: () => void): void {
    const index = this.historyChangedCallbacks.indexOf(callback);
    if (index > -1) {
      this.historyChangedCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify history changed
   */
  private notifyHistoryChanged(): void {
    for (const callback of this.historyChangedCallbacks) {
      callback();
    }
  }
}
