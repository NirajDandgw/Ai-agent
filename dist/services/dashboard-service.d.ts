import { DashboardService, JobStatusSummary, SystemMetrics } from '../interfaces/services';
import { JobExecution, JobStatus } from '../types';
import { DatabaseConnection } from '../database/connection';
import { JobMonitorServiceImpl } from './job-monitor';
import { SystemHealthMonitor } from './system-health';
import { DataPersistenceServiceImpl } from './data-persistence';
export declare class DashboardServiceImpl implements DashboardService {
    private db;
    private logger;
    private jobMonitor;
    private systemHealth;
    private dataPersistence;
    private cacheTimeout;
    private cachedData;
    constructor(db: DatabaseConnection, jobMonitor?: JobMonitorServiceImpl, systemHealth?: SystemHealthMonitor, dataPersistence?: DataPersistenceServiceImpl);
    /**
     * Get job status summary for dashboard overview
     * Requirements: 5.1, 5.2 - Display job status and information
     */
    getJobStatusSummary(): Promise<JobStatusSummary>;
    /**
     * Get job execution history for dashboard
     * Requirements: 5.5 - Display job execution history for the last 7 days
     */
    getJobExecutionHistory(jobId?: string, days?: number): Promise<JobExecution[]>;
    /**
     * Get filtered jobs by status
     * Requirements: 5.4 - Provide filtering capabilities by job status
     */
    getFilteredJobs(status?: string): Promise<JobStatus[]>;
    /**
     * Get system metrics for dashboard
     */
    getSystemMetrics(): Promise<SystemMetrics>;
    /**
     * Get dashboard data for real-time updates
     * Requirements: 5.3 - Refresh job information automatically every 30 seconds
     */
    getDashboardData(): Promise<{
        summary: JobStatusSummary;
        recentExecutions: JobExecution[];
        systemMetrics: SystemMetrics;
        failedJobs: JobStatus[];
        delayedJobs: JobStatus[];
    }>;
    /**
     * Calculate job status summary from job statuses
     */
    private calculateSummaryFromStatuses;
    /**
     * Calculate job status summary from database
     */
    private calculateSummaryFromDatabase;
    /**
     * Get execution history from database
     */
    private getExecutionHistoryFromDatabase;
    /**
     * Get filtered jobs from database
     */
    private getFilteredJobsFromDatabase;
    /**
     * Parse execution row from database
     */
    private parseExecutionRow;
    /**
     * Get cached data if still valid
     */
    private getCachedData;
    /**
     * Set cached data with timestamp
     */
    private setCachedData;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Set cache timeout
     */
    setCacheTimeout(timeoutMs: number): void;
    /**
     * Get job details for dashboard
     */
    getJobDetails(jobId: string): Promise<{
        job: JobStatus;
        recentExecutions: JobExecution[];
        configuration: any;
    }>;
    /**
     * Initialize the dashboard service
     */
    initialize(): Promise<void>;
    /**
     * Cleanup expired cache entries
     */
    private cleanupExpiredCache;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=dashboard-service.d.ts.map