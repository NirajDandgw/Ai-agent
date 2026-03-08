import { LogParserService } from '../interfaces/services';
import { LogAnalysisResult, FailurePattern, FailureCategory } from '../types';
import { DatabaseConnection } from '../database/connection';
export declare class LogParserServiceImpl implements LogParserService {
    private db;
    private logger;
    private failurePatterns;
    private failureCategories;
    constructor(db: DatabaseConnection);
    /**
     * Parse job logs and extract failure information
     * Requirements: 4.1, 4.2 - Analyze log files within 2 minutes and extract error information
     */
    parseJobLogs(jobId: string, logPaths: string[]): Promise<LogAnalysisResult>;
    /**
     * Analyze log content and extract failure information
     * Requirements: 4.2, 4.3, 4.4 - Extract errors, identify patterns, highlight root cause
     */
    analyzeLogContent(content: string): Promise<LogAnalysisResult>;
    /**
     * Register a new failure pattern for recognition
     * Requirements: 4.3 - Support pattern recognition and categorization
     */
    registerFailurePattern(pattern: FailurePattern): Promise<void>;
    /**
     * Get all failure categories with their patterns
     */
    getFailureCategories(): Promise<FailureCategory[]>;
    /**
     * Read log file content with error handling
     */
    private readLogFile;
    /**
     * Extract error messages from log content
     * Requirements: 4.2 - Extract error messages and relevant context
     */
    private extractErrorMessages;
    /**
     * Extract stack trace from log content
     * Requirements: 4.2 - Extract stack traces and relevant context
     */
    private extractStackTrace;
    /**
     * Identify failure pattern in log content
     * Requirements: 4.3 - Apply pattern recognition to identify common failure types
     */
    private identifyFailurePattern;
    /**
     * Determine the most likely root cause
     * Requirements: 4.4 - Highlight the most likely root cause of failure
     */
    private determineRootCause;
    /**
     * Categorize failure based on content analysis
     */
    private categorizeByContent;
    /**
     * Store log analysis result in database
     */
    private storeLogAnalysis;
    /**
     * Load failure patterns from database
     */
    private loadFailurePatternsFromDatabase;
    /**
     * Update failure categories based on loaded patterns
     */
    private updateFailureCategories;
    /**
     * Initialize default failure patterns
     */
    private initializeDefaultPatterns;
    /**
     * Initialize the log parser service
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=log-parser.d.ts.map