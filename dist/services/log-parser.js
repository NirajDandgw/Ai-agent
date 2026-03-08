"use strict";
// Log Parser Service - Analyzes log files for failure detection and root cause analysis
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogParserServiceImpl = void 0;
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs/promises"));
const crypto = __importStar(require("crypto"));
class LogParserServiceImpl {
    constructor(db) {
        this.failurePatterns = new Map();
        this.failureCategories = new Map();
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
    }
    /**
     * Parse job logs and extract failure information
     * Requirements: 4.1, 4.2 - Analyze log files within 2 minutes and extract error information
     */
    async parseJobLogs(jobId, logPaths) {
        this.logger.info('LogParser', `Starting log analysis for job: ${jobId}`, { logPaths });
        const startTime = Date.now();
        try {
            // Validate inputs
            if (!jobId || !logPaths || logPaths.length === 0) {
                throw new Error('Job ID and log paths are required');
            }
            const analysisResult = {
                jobId,
                rootCause: '',
                errorMessages: [],
                stackTrace: undefined,
                failureCategory: 'Unknown',
                confidence: 0,
                analysisTimestamp: new Date()
            };
            let totalLogContent = '';
            const accessibleLogs = [];
            const inaccessibleLogs = [];
            // Read all accessible log files
            for (const logPath of logPaths) {
                try {
                    const content = await this.readLogFile(logPath);
                    totalLogContent += content + '\n';
                    accessibleLogs.push(logPath);
                    this.logger.debug('LogParser', `Successfully read log file: ${logPath}`, {
                        jobId,
                        contentLength: content.length
                    });
                }
                catch (error) {
                    inaccessibleLogs.push(logPath);
                    this.logger.warn('LogParser', `Could not read log file: ${logPath}`, {
                        jobId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
            // Handle case where no logs are accessible (Requirement 4.5)
            if (accessibleLogs.length === 0) {
                analysisResult.rootCause = 'Log analysis unavailable';
                analysisResult.failureCategory = 'LogAccessError';
                analysisResult.confidence = 0;
                this.logger.warn('LogParser', `No accessible log files for job: ${jobId}`, {
                    inaccessibleLogs
                });
                return analysisResult;
            }
            // Analyze log content
            const analysis = await this.analyzeLogContent(totalLogContent);
            // Merge results
            analysisResult.rootCause = analysis.rootCause;
            analysisResult.errorMessages = analysis.errorMessages;
            analysisResult.stackTrace = analysis.stackTrace;
            analysisResult.failureCategory = analysis.failureCategory;
            analysisResult.confidence = analysis.confidence;
            // Store analysis in database
            await this.storeLogAnalysis(analysisResult);
            const analysisTime = Date.now() - startTime;
            this.logger.info('LogParser', `Completed log analysis for job: ${jobId}`, {
                analysisTimeMs: analysisTime,
                accessibleLogs: accessibleLogs.length,
                inaccessibleLogs: inaccessibleLogs.length,
                rootCause: analysisResult.rootCause,
                confidence: analysisResult.confidence
            });
            // Check if analysis completed within 2 minutes (Requirement 4.1)
            if (analysisTime > 120000) { // 2 minutes in milliseconds
                this.logger.warn('LogParser', `Log analysis took longer than 2 minutes: ${analysisTime}ms`, {
                    jobId
                });
            }
            return analysisResult;
        }
        catch (error) {
            const errorMessage = `Failed to parse logs for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('LogParser', errorMessage, { jobId, error });
            // Return error analysis result
            return {
                jobId,
                rootCause: 'Log analysis failed',
                errorMessages: [errorMessage],
                stackTrace: undefined,
                failureCategory: 'AnalysisError',
                confidence: 0,
                analysisTimestamp: new Date()
            };
        }
    }
    /**
     * Analyze log content and extract failure information
     * Requirements: 4.2, 4.3, 4.4 - Extract errors, identify patterns, highlight root cause
     */
    async analyzeLogContent(content) {
        this.logger.debug('LogParser', 'Analyzing log content', { contentLength: content.length });
        try {
            const analysisResult = {
                jobId: '', // Will be set by caller
                rootCause: '',
                errorMessages: [],
                stackTrace: undefined,
                failureCategory: 'Unknown',
                confidence: 0,
                analysisTimestamp: new Date()
            };
            // Extract error messages (Requirement 4.2)
            const errorMessages = this.extractErrorMessages(content);
            analysisResult.errorMessages = errorMessages;
            // Extract stack trace (Requirement 4.2)
            const stackTrace = this.extractStackTrace(content);
            analysisResult.stackTrace = stackTrace;
            // Apply failure pattern recognition (Requirement 4.3)
            const patternMatch = await this.identifyFailurePattern(content);
            if (patternMatch) {
                analysisResult.failureCategory = patternMatch.category;
                analysisResult.confidence = Math.max(analysisResult.confidence, 0.8);
            }
            // Determine root cause (Requirement 4.4)
            const rootCause = this.determineRootCause(content, errorMessages, stackTrace, patternMatch);
            analysisResult.rootCause = rootCause.cause;
            analysisResult.confidence = Math.max(analysisResult.confidence, rootCause.confidence);
            // If no specific pattern matched, categorize based on error content
            if (analysisResult.failureCategory === 'Unknown') {
                analysisResult.failureCategory = this.categorizeByContent(content, errorMessages);
            }
            this.logger.debug('LogParser', 'Log content analysis completed', {
                errorCount: errorMessages.length,
                hasStackTrace: !!stackTrace,
                category: analysisResult.failureCategory,
                confidence: analysisResult.confidence
            });
            return analysisResult;
        }
        catch (error) {
            this.logger.error('LogParser', 'Failed to analyze log content:', error);
            return {
                jobId: '',
                rootCause: 'Content analysis failed',
                errorMessages: [`Analysis error: ${error instanceof Error ? error.message : String(error)}`],
                stackTrace: undefined,
                failureCategory: 'AnalysisError',
                confidence: 0,
                analysisTimestamp: new Date()
            };
        }
    }
    /**
     * Register a new failure pattern for recognition
     * Requirements: 4.3 - Support pattern recognition and categorization
     */
    async registerFailurePattern(pattern) {
        this.logger.info('LogParser', `Registering failure pattern: ${pattern.name}`, {
            patternId: pattern.patternId,
            category: pattern.category
        });
        try {
            // Validate pattern
            if (!pattern.patternId || !pattern.name || !pattern.regex || !pattern.category) {
                throw new Error('Pattern must have patternId, name, regex, and category');
            }
            // Test regex validity
            try {
                new RegExp(pattern.regex);
            }
            catch (regexError) {
                throw new Error(`Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`);
            }
            // Store in database
            const sql = `
        INSERT OR REPLACE INTO failure_patterns (
          pattern_id, name, regex, category, severity, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
            await this.db.run(sql, [
                pattern.patternId,
                pattern.name,
                pattern.regex,
                pattern.category,
                pattern.severity,
                pattern.description || ''
            ]);
            // Update in-memory cache
            this.failurePatterns.set(pattern.patternId, pattern);
            // Update category cache
            await this.updateFailureCategories();
            this.logger.info('LogParser', `Successfully registered failure pattern: ${pattern.name}`);
        }
        catch (error) {
            const errorMessage = `Failed to register failure pattern ${pattern.name}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('LogParser', errorMessage, { pattern, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get all failure categories with their patterns
     */
    async getFailureCategories() {
        this.logger.debug('LogParser', 'Retrieving failure categories');
        try {
            await this.loadFailurePatternsFromDatabase();
            return Array.from(this.failureCategories.values());
        }
        catch (error) {
            const errorMessage = `Failed to get failure categories: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('LogParser', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Read log file content with error handling
     */
    async readLogFile(logPath) {
        try {
            // Check if file exists and is readable
            await fs.access(logPath, fs.constants.R_OK);
            // Read file content
            const content = await fs.readFile(logPath, 'utf8');
            // Limit content size to prevent memory issues (max 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (content.length > maxSize) {
                this.logger.warn('LogParser', `Log file is large, truncating: ${logPath}`, {
                    originalSize: content.length,
                    truncatedSize: maxSize
                });
                return content.substring(content.length - maxSize); // Keep the end of the file
            }
            return content;
        }
        catch (error) {
            throw new Error(`Cannot read log file ${logPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Extract error messages from log content
     * Requirements: 4.2 - Extract error messages and relevant context
     */
    extractErrorMessages(content) {
        const errorMessages = [];
        const lines = content.split('\n');
        // Common error patterns
        const errorPatterns = [
            /ERROR\s*[:\-\s]?\s*(.+)/i,
            /FATAL\s*[:\-\s]?\s*(.+)/i,
            /EXCEPTION\s*[:\-\s]?\s*(.+)/i,
            /FAILED\s*[:\-\s]?\s*(.+)/i,
            /\[ERROR\]\s*(.+)/i,
            /\[FATAL\]\s*(.+)/i,
            /Exception:\s*(.+)/i,
            /Error:\s*(.+)/i
        ];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            for (const pattern of errorPatterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    let errorMessage = match[1].trim();
                    // Include context from next few lines if they seem related
                    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine && !nextLine.match(/^\d{4}-\d{2}-\d{2}/) && nextLine.length < 200) {
                            errorMessage += ' ' + nextLine;
                        }
                        else {
                            break;
                        }
                    }
                    if (errorMessage.length > 10 && !errorMessages.includes(errorMessage)) {
                        errorMessages.push(errorMessage);
                    }
                    break;
                }
            }
        }
        return errorMessages.slice(0, 10); // Limit to 10 most relevant errors
    }
    /**
     * Extract stack trace from log content
     * Requirements: 4.2 - Extract stack traces and relevant context
     */
    extractStackTrace(content) {
        const lines = content.split('\n');
        let stackTrace = '';
        let inStackTrace = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Start of stack trace
            if (line.match(/(Exception|Error|Traceback|Stack trace)/i)) {
                inStackTrace = true;
                stackTrace = line + '\n';
                continue;
            }
            // Continue stack trace
            if (inStackTrace) {
                // Common stack trace line patterns
                if (line.match(/^\s*at\s+/) || // Java/JavaScript
                    line.match(/^\s*File\s+"/) || // Python
                    line.match(/^\s*#\d+\s+/) || // C/C++
                    line.match(/^\s+\w+\.\w+/) || // General method calls
                    line.match(/^\s*\w+:\d+/)) { // File:line references
                    stackTrace += line + '\n';
                }
                else if (line.trim() === '' && stackTrace.length > 0) {
                    // Empty line might continue stack trace
                    stackTrace += line + '\n';
                }
                else if (stackTrace.length > 0) {
                    // End of stack trace
                    break;
                }
            }
        }
        // Return stack trace if it's substantial enough
        return stackTrace.trim().length > 50 ? stackTrace.trim() : undefined;
    }
    /**
     * Identify failure pattern in log content
     * Requirements: 4.3 - Apply pattern recognition to identify common failure types
     */
    async identifyFailurePattern(content) {
        await this.loadFailurePatternsFromDatabase();
        for (const pattern of this.failurePatterns.values()) {
            try {
                const regex = new RegExp(pattern.regex, 'i');
                if (regex.test(content)) {
                    this.logger.debug('LogParser', `Matched failure pattern: ${pattern.name}`, {
                        patternId: pattern.patternId,
                        category: pattern.category
                    });
                    return pattern;
                }
            }
            catch (error) {
                this.logger.warn('LogParser', `Invalid regex in pattern ${pattern.name}:`, error);
            }
        }
        return undefined;
    }
    /**
     * Determine the most likely root cause
     * Requirements: 4.4 - Highlight the most likely root cause of failure
     */
    determineRootCause(content, errorMessages, stackTrace, patternMatch) {
        // If we have a pattern match, use it as primary indicator
        if (patternMatch) {
            return {
                cause: `${patternMatch.name}: ${patternMatch.description || 'Pattern-based failure detection'}`,
                confidence: 0.8
            };
        }
        // If we have error messages, analyze them
        if (errorMessages.length > 0) {
            const primaryError = errorMessages[0];
            // Look for specific error types
            if (primaryError.match(/(out of memory|memory|heap)/i)) {
                return {
                    cause: `Memory exhaustion: ${primaryError}`,
                    confidence: 0.7
                };
            }
            if (primaryError.match(/(connection|network|timeout|unreachable)/i)) {
                return {
                    cause: `Network/connectivity issue: ${primaryError}`,
                    confidence: 0.7
                };
            }
            if (primaryError.match(/(permission|access|denied|unauthorized)/i)) {
                return {
                    cause: `Permission/access issue: ${primaryError}`,
                    confidence: 0.7
                };
            }
            if (primaryError.match(/(file not found|no such file|path)/i)) {
                return {
                    cause: `File system issue: ${primaryError}`,
                    confidence: 0.7
                };
            }
            if (primaryError.match(/(sql|database|query|table)/i)) {
                return {
                    cause: `Database issue: ${primaryError}`,
                    confidence: 0.7
                };
            }
            // Generic error message
            return {
                cause: `Application error: ${primaryError}`,
                confidence: 0.5
            };
        }
        // If we have a stack trace but no clear error messages
        if (stackTrace) {
            return {
                cause: 'Exception occurred (see stack trace for details)',
                confidence: 0.4
            };
        }
        // Fallback analysis based on content keywords
        if (content.match(/(killed|terminated|sigterm|sigkill)/i)) {
            return {
                cause: 'Process was terminated externally',
                confidence: 0.6
            };
        }
        if (content.match(/(disk.*full|no space|quota exceeded)/i)) {
            return {
                cause: 'Disk space exhaustion',
                confidence: 0.7
            };
        }
        // No clear root cause identified
        return {
            cause: 'Unable to determine root cause from available logs',
            confidence: 0.1
        };
    }
    /**
     * Categorize failure based on content analysis
     */
    categorizeByContent(content, errorMessages) {
        const allText = (content + ' ' + errorMessages.join(' ')).toLowerCase();
        if (allText.match(/(memory|heap|oom)/))
            return 'MemoryIssue';
        if (allText.match(/(network|connection|timeout)/))
            return 'NetworkIssue';
        if (allText.match(/(permission|access|denied)/))
            return 'PermissionIssue';
        if (allText.match(/(file|path|directory)/))
            return 'FileSystemIssue';
        if (allText.match(/(sql|database|query)/))
            return 'DatabaseIssue';
        if (allText.match(/(config|configuration|setting)/))
            return 'ConfigurationIssue';
        if (allText.match(/(dependency|library|module)/))
            return 'DependencyIssue';
        return 'ApplicationError';
    }
    /**
     * Store log analysis result in database
     */
    async storeLogAnalysis(analysis) {
        try {
            const analysisId = crypto.randomUUID();
            const sql = `
        INSERT INTO log_analyses (
          analysis_id, job_id, root_cause, error_messages, stack_trace,
          failure_category, confidence, analysis_timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
            await this.db.run(sql, [
                analysisId,
                analysis.jobId,
                analysis.rootCause,
                JSON.stringify(analysis.errorMessages),
                analysis.stackTrace,
                analysis.failureCategory,
                analysis.confidence,
                analysis.analysisTimestamp.toISOString()
            ]);
            this.logger.debug('LogParser', `Stored log analysis: ${analysisId}`, {
                jobId: analysis.jobId
            });
        }
        catch (error) {
            this.logger.error('LogParser', 'Failed to store log analysis:', error);
            // Don't throw here as analysis can still be returned
        }
    }
    /**
     * Load failure patterns from database
     */
    async loadFailurePatternsFromDatabase() {
        try {
            const sql = 'SELECT * FROM failure_patterns ORDER BY name';
            const rows = await this.db.all(sql);
            this.failurePatterns.clear();
            for (const row of rows) {
                const pattern = {
                    patternId: row.pattern_id,
                    name: row.name,
                    regex: row.regex,
                    category: row.category,
                    severity: row.severity,
                    description: row.description
                };
                this.failurePatterns.set(pattern.patternId, pattern);
            }
            await this.updateFailureCategories();
            this.logger.debug('LogParser', `Loaded ${this.failurePatterns.size} failure patterns from database`);
        }
        catch (error) {
            this.logger.error('LogParser', 'Failed to load failure patterns from database:', error);
            // Initialize with default patterns if database load fails
            await this.initializeDefaultPatterns();
        }
    }
    /**
     * Update failure categories based on loaded patterns
     */
    async updateFailureCategories() {
        this.failureCategories.clear();
        const categoryMap = new Map();
        // Group patterns by category
        for (const pattern of this.failurePatterns.values()) {
            if (!categoryMap.has(pattern.category)) {
                categoryMap.set(pattern.category, []);
            }
            categoryMap.get(pattern.category).push(pattern);
        }
        // Create failure categories
        for (const [categoryName, patterns] of categoryMap) {
            const category = {
                categoryId: categoryName.toLowerCase().replace(/\s+/g, '-'),
                name: categoryName,
                description: `Failures related to ${categoryName.toLowerCase()}`,
                patterns
            };
            this.failureCategories.set(category.categoryId, category);
        }
    }
    /**
     * Initialize default failure patterns
     */
    async initializeDefaultPatterns() {
        const defaultPatterns = [
            {
                patternId: 'out-of-memory',
                name: 'Out of Memory',
                regex: '(out of memory|oom|heap.*space|memory.*exhausted)',
                category: 'MemoryIssue',
                severity: 'High',
                description: 'Application ran out of available memory'
            },
            {
                patternId: 'connection-timeout',
                name: 'Connection Timeout',
                regex: '(connection.*timeout|connect.*timed.*out|network.*timeout)',
                category: 'NetworkIssue',
                severity: 'Medium',
                description: 'Network connection timed out'
            },
            {
                patternId: 'file-not-found',
                name: 'File Not Found',
                regex: '(file not found|no such file|path.*not.*exist)',
                category: 'FileSystemIssue',
                severity: 'Medium',
                description: 'Required file or path does not exist'
            },
            {
                patternId: 'permission-denied',
                name: 'Permission Denied',
                regex: '(permission denied|access.*denied|unauthorized)',
                category: 'PermissionIssue',
                severity: 'Medium',
                description: 'Insufficient permissions to access resource'
            },
            {
                patternId: 'database-error',
                name: 'Database Error',
                regex: '(sql.*error|database.*error|connection.*refused.*database)',
                category: 'DatabaseIssue',
                severity: 'High',
                description: 'Database operation failed'
            }
        ];
        for (const pattern of defaultPatterns) {
            try {
                await this.registerFailurePattern(pattern);
            }
            catch (error) {
                this.logger.warn('LogParser', `Failed to register default pattern ${pattern.name}:`, error);
            }
        }
    }
    /**
     * Initialize the log parser service
     */
    async initialize() {
        this.logger.info('LogParser', 'Initializing Log Parser Service');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            // Load existing patterns from database
            await this.loadFailurePatternsFromDatabase();
            this.logger.info('LogParser', 'Log Parser Service initialized successfully', {
                patternsLoaded: this.failurePatterns.size,
                categoriesLoaded: this.failureCategories.size
            });
        }
        catch (error) {
            const errorMessage = `Failed to initialize Log Parser Service: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('LogParser', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('LogParser', 'Cleaning up Log Parser Service');
        try {
            this.failurePatterns.clear();
            this.failureCategories.clear();
            this.logger.info('LogParser', 'Log Parser Service cleanup completed');
        }
        catch (error) {
            this.logger.error('LogParser', 'Error during Log Parser Service cleanup:', error);
            throw error;
        }
    }
}
exports.LogParserServiceImpl = LogParserServiceImpl;
//# sourceMappingURL=log-parser.js.map