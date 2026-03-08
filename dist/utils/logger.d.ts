export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    component: string;
    message: string;
    metadata?: any;
}
export declare class Logger {
    private static instance;
    private logLevel;
    private logEntries;
    private constructor();
    static getInstance(): Logger;
    setLogLevel(level: LogLevel): void;
    debug(component: string, message: string, metadata?: any): void;
    info(component: string, message: string, metadata?: any): void;
    warn(component: string, message: string, metadata?: any): void;
    error(component: string, message: string, metadata?: any): void;
    private log;
    getRecentLogs(count?: number): LogEntry[];
    getLogsByComponent(component: string, count?: number): LogEntry[];
}
//# sourceMappingURL=logger.d.ts.map