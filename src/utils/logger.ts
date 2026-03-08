// Logging utility for the batch job monitoring system

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logEntries: LogEntry[] = [];

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(component: string, message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, component, message, metadata);
  }

  info(component: string, message: string, metadata?: any): void {
    this.log(LogLevel.INFO, component, message, metadata);
  }

  warn(component: string, message: string, metadata?: any): void {
    this.log(LogLevel.WARN, component, message, metadata);
  }

  error(component: string, message: string, metadata?: any): void {
    this.log(LogLevel.ERROR, component, message, metadata);
  }

  private log(level: LogLevel, component: string, message: string, metadata?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      metadata,
    };

    this.logEntries.push(entry);
    
    // Keep only last 1000 entries in memory
    if (this.logEntries.length > 1000) {
      this.logEntries = this.logEntries.slice(-1000);
    }

    // Console output
    const levelName = LogLevel[level];
    const timestamp = entry.timestamp.toISOString();
    const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    
    console.log(`[${timestamp}] ${levelName} [${component}] ${message}${metadataStr}`);
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logEntries.slice(-count);
  }

  getLogsByComponent(component: string, count: number = 100): LogEntry[] {
    return this.logEntries
      .filter(entry => entry.component === component)
      .slice(-count);
  }
}