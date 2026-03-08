"use strict";
// Logging utility for the batch job monitoring system
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.logLevel = LogLevel.INFO;
        this.logEntries = [];
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    debug(component, message, metadata) {
        this.log(LogLevel.DEBUG, component, message, metadata);
    }
    info(component, message, metadata) {
        this.log(LogLevel.INFO, component, message, metadata);
    }
    warn(component, message, metadata) {
        this.log(LogLevel.WARN, component, message, metadata);
    }
    error(component, message, metadata) {
        this.log(LogLevel.ERROR, component, message, metadata);
    }
    log(level, component, message, metadata) {
        if (level < this.logLevel) {
            return;
        }
        const entry = {
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
    getRecentLogs(count = 100) {
        return this.logEntries.slice(-count);
    }
    getLogsByComponent(component, count = 100) {
        return this.logEntries
            .filter(entry => entry.component === component)
            .slice(-count);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map