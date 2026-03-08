import { DataPersistenceService, ExecutionQueryFilters } from '../interfaces/services';
import { JobExecution } from '../types';
import { DatabaseConnection } from '../database/connection';
export declare class DataPersistenceServiceImpl implements DataPersistenceService {
    private db;
    private logger;
    private archiveDirectory;
    private retentionCleanupInterval;
    constructor(db: DatabaseConnection, archiveDirectory?: string);
    /**
     * Save job execution record
     * Requirements: 8.1 - Store job execution records with complete information
     */
    saveJobExecution(execution: JobExecution): Promise<void>;
    /**
     * Get job execution history for a specific job
     * Requirements: 8.2, 8.3 - Retain and query historical data
     */
    getJobExecutionHistory(jobId: string, days?: number): Promise<JobExecution[]>;
    /**
     * Get specific job execution by ID
     */
    getJobExecution(executionId: string): Promise<JobExecution>;
    /**
     * Archive old job executions
     * Requirements: 8.4 - Compress and archive data older than specified days
     */
    archiveOldExecutions(olderThanDays: number): Promise<number>;
    /**
     * Query executions with filters
     * Requirements: 8.3 - Provide APIs to query historical job execution data
     */
    queryExecutions(filters: ExecutionQueryFilters): Promise<JobExecution[]>;
    /**
     * Validate job execution data
     * Requirements: 8.5 - Ensure data integrity
     */
    private validateJobExecution;
    /**
     * Parse database row into JobExecution object
     */
    private parseExecutionRow;
    /**
     * Ensure archive directory exists
     */
    private ensureArchiveDirectory;
    /**
     * Group executions by month for efficient archiving
     */
    private groupExecutionsByMonth;
    /**
     * Archive executions for a specific month
     * Requirements: 8.4 - Compress and archive historical data
     */
    private archiveExecutionsForMonth;
    /**
     * Remove archived executions from main database
     */
    private removeArchivedExecutions;
    /**
     * Retrieve archived executions (for data recovery)
     */
    retrieveArchivedExecutions(monthKey: string): Promise<JobExecution[]>;
    /**
     * Get archive statistics
     */
    getArchiveStatistics(): Promise<{
        totalArchiveFiles: number;
        totalArchivedExecutions: number;
        oldestArchive: string | null;
        newestArchive: string | null;
        totalArchiveSize: number;
    }>;
    /**
     * Start automatic retention cleanup
     * Requirements: 8.2 - Retain job execution history for at least 30 days
     */
    startRetentionCleanup(retentionDays?: number, cleanupIntervalHours?: number): Promise<void>;
    /**
     * Stop automatic retention cleanup
     */
    stopRetentionCleanup(): Promise<void>;
    /**
     * Initialize the data persistence service
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=data-persistence.d.ts.map