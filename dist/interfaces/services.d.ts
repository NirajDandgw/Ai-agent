import { JobConfiguration, JobStatus, JobExecution, AlertMessage, AlertResult, AlertChannel, LogAnalysisResult, FailurePattern, FailureCategory, SystemHealthStatus } from '../types';
export interface JobMonitorService {
    startMonitoring(jobConfig: JobConfiguration): Promise<void>;
    stopMonitoring(jobId: string): Promise<void>;
    getJobStatus(jobId: string): Promise<JobStatus>;
    updateJobConfiguration(jobConfig: JobConfiguration): Promise<void>;
    getAllJobStatuses(): Promise<JobStatus[]>;
    validateHealth(): Promise<SystemHealthStatus>;
}
export interface LogParserService {
    parseJobLogs(jobId: string, logPaths: string[]): Promise<LogAnalysisResult>;
    registerFailurePattern(pattern: FailurePattern): Promise<void>;
    getFailureCategories(): Promise<FailureCategory[]>;
    analyzeLogContent(content: string): Promise<LogAnalysisResult>;
}
export interface AlertService {
    sendAlert(alert: AlertMessage): Promise<AlertResult[]>;
    configureAlertChannel(channel: AlertChannel): Promise<void>;
    suppressAlerts(jobId: string, duration: number): Promise<void>;
    getAlertHistory(jobId?: string, limit?: number): Promise<AlertMessage[]>;
}
export interface ConfigurationManager {
    addJobConfiguration(config: JobConfiguration): Promise<void>;
    updateJobConfiguration(jobId: string, config: Partial<JobConfiguration>): Promise<void>;
    removeJobConfiguration(jobId: string): Promise<void>;
    getJobConfiguration(jobId: string): Promise<JobConfiguration>;
    getAllJobConfigurations(): Promise<JobConfiguration[]>;
    validateConfiguration(config: JobConfiguration): Promise<boolean>;
}
export interface DataPersistenceService {
    saveJobExecution(execution: JobExecution): Promise<void>;
    getJobExecutionHistory(jobId: string, days?: number): Promise<JobExecution[]>;
    getJobExecution(executionId: string): Promise<JobExecution>;
    archiveOldExecutions(olderThanDays: number): Promise<number>;
    queryExecutions(filters: ExecutionQueryFilters): Promise<JobExecution[]>;
}
export interface ExecutionQueryFilters {
    jobId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}
export interface DashboardService {
    getJobStatusSummary(): Promise<JobStatusSummary>;
    getJobExecutionHistory(jobId?: string, days?: number): Promise<JobExecution[]>;
    getFilteredJobs(status?: string): Promise<JobStatus[]>;
    getSystemMetrics(): Promise<SystemMetrics>;
}
export interface JobStatusSummary {
    totalJobs: number;
    runningJobs: number;
    successfulJobs: number;
    failedJobs: number;
    delayedJobs: number;
    lastUpdated: Date;
}
export interface SystemMetrics {
    uptime: number;
    totalExecutions: number;
    alertsSent: number;
    averageExecutionTime: number;
    systemHealth: SystemHealthStatus[];
}
//# sourceMappingURL=services.d.ts.map