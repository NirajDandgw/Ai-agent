import { JobMonitorService } from '../interfaces/services';
import { JobConfiguration, JobStatus, SystemHealthStatus, SLAMetrics, SLAComplianceStatus } from '../types';
import { DatabaseConnection } from '../database/connection';
export declare class JobMonitorServiceImpl implements JobMonitorService {
    private db;
    private logger;
    private monitoringJobs;
    private jobStatuses;
    private isHealthy;
    private lastHealthCheck;
    constructor(db: DatabaseConnection);
    /**
     * Start monitoring a job based on its configuration
     * Requirements: 1.5, 2.4 - Support configurable data source connections
     */
    startMonitoring(jobConfig: JobConfiguration): Promise<void>;
    /**
     * Stop monitoring a specific job
     */
    stopMonitoring(jobId: string): Promise<void>;
    /**
     * Get current status of a specific job
     */
    getJobStatus(jobId: string): Promise<JobStatus>;
    /**
     * Get all job statuses
     */
    getAllJobStatuses(): Promise<JobStatus[]>;
    /**
     * Update job configuration for an already monitored job
     * Requirements: 6.4 - Support modifying existing job configurations
     */
    updateJobConfiguration(jobConfig: JobConfiguration): Promise<void>;
    /**
     * Validate system health
     * Requirements: 7.1 - Validate system health every 5 minutes
     */
    validateHealth(): Promise<SystemHealthStatus>;
    /**
     * Poll job status from configured data source
     * Requirements: 1.5, 2.1, 2.2, 2.3 - Fetch execution details from multiple data sources
     */
    private pollJobStatus;
    /**
     * Fetch execution details from data source
     * Requirements: 2.1, 2.2, 2.3 - Support different data source types
     */
    private fetchExecutionDetails;
    /**
     * Fetch execution details from scheduler logs
     * Requirements: 2.1 - Parse scheduler logs to extract job status
     */
    private fetchFromSchedulerLogs;
    /**
     * Fetch execution details from ETL logs
     * Requirements: 2.2 - Parse ETL logs to extract execution details
     */
    private fetchFromETLLogs;
    /**
     * Fetch execution details from database
     * Requirements: 2.3 - Query database tables to retrieve current job status
     */
    private fetchFromDatabase;
    /**
     * Simulate job status for demonstration purposes
     */
    private simulateJobStatus;
    /**
     * Update job status based on execution details
     * Requirements: 1.1, 1.2, 1.3 - Record start time, completion time, and failure time
     */
    private updateJobStatusFromExecution;
    /**
     * Check for job delays and update status accordingly with SLA monitoring
     * Requirements: 1.4 - Detect when jobs exceed expected duration
     */
    private checkForDelays;
    /**
     * Persist job execution to database
     * Requirements: 8.1 - Store job execution records
     */
    private persistJobExecution;
    /**
     * Get SLA compliance metrics for a job
     * Requirements: 1.4 - Monitor SLA compliance and delay detection
     */
    getSLAMetrics(jobId: string): Promise<SLAMetrics>;
    /**
     * Check if a job is currently in SLA compliance
     * Requirements: 1.4 - Monitor SLA thresholds
     */
    checkSLACompliance(jobId: string): Promise<SLAComplianceStatus>;
    private getJobStatusFromDatabase;
    /**
     * Get job configuration from database
     */
    private getJobConfigurationFromDatabase;
    /**
     * Initialize the job monitor service
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=job-monitor.d.ts.map