/**
 * Logger utility for NEOcad
 * Provides structured logging with different log levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: Array<(entry: LogEntry) => void> = [];

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  addListener(callback: (entry: LogEntry) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
    };

    // Add to logs array
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(entry));

    // Console output
    const prefix = `[${this.getLevelName(level)}] [${category}]`;
    const timestamp = entry.timestamp.toLocaleTimeString();

    switch (level) {
      case LogLevel.DEBUG:
        console.log(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.INFO:
        console.log(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} ${prefix}`, message, data || '');
        break;
      case LogLevel.ERROR:
        console.error(`${timestamp} ${prefix}`, message, data || '');
        break;
    }
  }

  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }
}

// Export a singleton instance
export const logger = Logger.getInstance();
