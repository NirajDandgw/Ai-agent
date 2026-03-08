"use strict";
// Job Monitor Service - Core monitoring functionality for batch jobs
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobMonitorServiceImpl = void 0;
const logger_1 = require("../utils/logger");
// Simple UUID generator for testing
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
class JobMonitorServiceImpl {
    constructor(db) {
        this.monitoringJobs = new Map();
        this.jobStatuses = new Map();
        this.isHealthy = true;
        this.lastHealthCheck = new Date();
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
    }
    /**
     * Start monitoring a job based on its configuration
     * Requirements: 1.5, 2.4 - Support configurable data source connections
     */
    async startMonitoring(jobConfig) {
        this.logger.info('JobMonitor', `Starting monitoring for job: ${jobConfig.jobId}`);
        try {
            // Stop existing monitoring if any
            if (this.monitoringJobs.has(jobConfig.jobId)) {
                await this.stopMonitoring(jobConfig.jobId);
            }
            // Initialize job status
            const initialStatus = {
                jobId: jobConfig.jobId,
                name: jobConfig.name,
                status: 'Running', // Assume running initially
                lastHeartbeat: new Date()
            };
            this.jobStatuses.set(jobConfig.jobId, initialStatus);
            // Set up polling interval
            const pollInterval = jobConfig.dataSource.pollInterval * 1000; // Convert to milliseconds
            const intervalId = setInterval(async () => {
                await this.pollJobStatus(jobConfig);
            }, pollInterval);
            this.monitoringJobs.set(jobConfig.jobId, intervalId);
            // Perform initial poll
            await this.pollJobStatus(jobConfig);
            this.logger.info('JobMonitor', `Successfully started monitoring job: ${jobConfig.jobId}`, {
                pollInterval: jobConfig.dataSource.pollInterval
            });
        }
        catch (error) {
            const errorMessage = `Failed to start monitoring job ${jobConfig.jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId: jobConfig.jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Stop monitoring a specific job
     */
    async stopMonitoring(jobId) {
        this.logger.info('JobMonitor', `Stopping monitoring for job: ${jobId}`);
        try {
            const intervalId = this.monitoringJobs.get(jobId);
            if (intervalId) {
                clearInterval(intervalId);
                this.monitoringJobs.delete(jobId);
            }
            // Keep the last known status but mark as no longer monitored
            const currentStatus = this.jobStatuses.get(jobId);
            if (currentStatus) {
                currentStatus.lastHeartbeat = new Date();
                this.jobStatuses.set(jobId, currentStatus);
            }
            this.logger.info('JobMonitor', `Successfully stopped monitoring job: ${jobId}`);
        }
        catch (error) {
            const errorMessage = `Failed to stop monitoring job ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get current status of a specific job
     */
    async getJobStatus(jobId) {
        this.logger.debug('JobMonitor', `Retrieving status for job: ${jobId}`);
        try {
            const status = this.jobStatuses.get(jobId);
            if (!status) {
                // Try to get from database
                const dbStatus = await this.getJobStatusFromDatabase(jobId);
                if (dbStatus) {
                    this.jobStatuses.set(jobId, dbStatus);
                    return dbStatus;
                }
                const errorMessage = `Job status not found for job ID: ${jobId}`;
                this.logger.error('JobMonitor', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            return { ...status }; // Return a copy
        }
        catch (error) {
            const errorMessage = `Failed to get job status for ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get all job statuses
     */
    async getAllJobStatuses() {
        this.logger.debug('JobMonitor', 'Retrieving all job statuses');
        try {
            const statuses = Array.from(this.jobStatuses.values());
            return statuses.map(status => ({ ...status })); // Return copies
        }
        catch (error) {
            const errorMessage = `Failed to get all job statuses: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Update job configuration for an already monitored job
     * Requirements: 6.4 - Support modifying existing job configurations
     */
    async updateJobConfiguration(jobConfig) {
        this.logger.info('JobMonitor', `Updating configuration for job: ${jobConfig.jobId}`);
        try {
            // Stop current monitoring
            await this.stopMonitoring(jobConfig.jobId);
            // Start with new configuration
            await this.startMonitoring(jobConfig);
            this.logger.info('JobMonitor', `Successfully updated configuration for job: ${jobConfig.jobId}`);
        }
        catch (error) {
            const errorMessage = `Failed to update job configuration for ${jobConfig.jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId: jobConfig.jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Validate system health
     * Requirements: 7.1 - Validate system health every 5 minutes
     */
    async validateHealth() {
        this.logger.debug('JobMonitor', 'Validating system health');
        try {
            const healthStatus = {
                component: 'JobMonitorService',
                status: 'Healthy',
                lastCheck: new Date(),
                details: undefined
            };
            // Check database connection
            if (!this.db.isConnected()) {
                healthStatus.status = 'Unhealthy';
                healthStatus.details = 'Database connection is not available';
                this.isHealthy = false;
            }
            else {
                // Test database with a simple query
                try {
                    await this.db.get('SELECT 1 as test');
                }
                catch (dbError) {
                    healthStatus.status = 'Degraded';
                    healthStatus.details = `Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
                    this.isHealthy = false;
                }
            }
            // Check monitoring jobs
            const monitoringCount = this.monitoringJobs.size;
            if (monitoringCount === 0) {
                healthStatus.status = healthStatus.status === 'Healthy' ? 'Degraded' : healthStatus.status;
                healthStatus.details = (healthStatus.details || '') + ' No jobs are currently being monitored';
            }
            // Update health status
            this.lastHealthCheck = healthStatus.lastCheck;
            this.isHealthy = healthStatus.status === 'Healthy';
            this.logger.debug('JobMonitor', `Health check completed: ${healthStatus.status}`, {
                monitoringJobs: monitoringCount,
                details: healthStatus.details
            });
            return healthStatus;
        }
        catch (error) {
            const errorMessage = `Health validation failed: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { error });
            this.isHealthy = false;
            this.lastHealthCheck = new Date();
            return {
                component: 'JobMonitorService',
                status: 'Unhealthy',
                lastCheck: this.lastHealthCheck,
                details: errorMessage
            };
        }
    }
    /**
     * Poll job status from configured data source
     * Requirements: 1.5, 2.1, 2.2, 2.3 - Fetch execution details from multiple data sources
     */
    async pollJobStatus(jobConfig) {
        this.logger.debug('JobMonitor', `Polling status for job: ${jobConfig.jobId}`);
        try {
            const currentStatus = this.jobStatuses.get(jobConfig.jobId);
            if (!currentStatus) {
                this.logger.warn('JobMonitor', `No current status found for job: ${jobConfig.jobId}`);
                return;
            }
            // Simulate data source polling based on type
            const executionDetails = await this.fetchExecutionDetails(jobConfig);
            // Update job status based on execution details
            const updatedStatus = await this.updateJobStatusFromExecution(currentStatus, executionDetails, jobConfig);
            // Check for delays (Requirement 1.4)
            this.checkForDelays(updatedStatus, jobConfig);
            // Store updated status
            this.jobStatuses.set(jobConfig.jobId, updatedStatus);
            // Persist to database (Requirement 8.1)
            await this.persistJobExecution(updatedStatus, jobConfig);
            this.logger.debug('JobMonitor', `Successfully polled job: ${jobConfig.jobId}`, {
                status: updatedStatus.status,
                lastHeartbeat: updatedStatus.lastHeartbeat
            });
        }
        catch (error) {
            this.logger.error('JobMonitor', `Failed to poll job status for ${jobConfig.jobId}:`, error);
            // Update status to indicate polling failure
            const currentStatus = this.jobStatuses.get(jobConfig.jobId);
            if (currentStatus) {
                currentStatus.lastHeartbeat = new Date();
                currentStatus.failureReason = `Polling failed: ${error instanceof Error ? error.message : String(error)}`;
                this.jobStatuses.set(jobConfig.jobId, currentStatus);
            }
        }
    }
    /**
     * Fetch execution details from data source
     * Requirements: 2.1, 2.2, 2.3 - Support different data source types
     */
    async fetchExecutionDetails(jobConfig) {
        const { dataSource } = jobConfig;
        switch (dataSource.type) {
            case 'SchedulerLogs':
                return this.fetchFromSchedulerLogs(jobConfig);
            case 'ETLLogs':
                return this.fetchFromETLLogs(jobConfig);
            case 'Database':
                return this.fetchFromDatabase(jobConfig);
            default:
                throw new Error(`Unsupported data source type: ${dataSource.type}`);
        }
    }
    /**
     * Fetch execution details from scheduler logs
     * Requirements: 2.1 - Parse scheduler logs to extract job status
     */
    async fetchFromSchedulerLogs(jobConfig) {
        this.logger.debug('JobMonitor', `Fetching from scheduler logs for job: ${jobConfig.jobId}`);
        // Simulate scheduler log parsing
        // In a real implementation, this would parse actual log files
        const now = new Date();
        const executionDetails = {
            jobId: jobConfig.jobId,
            startTime: new Date(now.getTime() - (Math.random() * 3600000)), // Random start time within last hour
            status: this.simulateJobStatus()
        };
        // If job is completed, set end time
        if (executionDetails.status === 'Success' || executionDetails.status === 'Failed') {
            executionDetails.endTime = now;
            if (executionDetails.status === 'Failed') {
                executionDetails.failureReason = 'Simulated failure from scheduler logs';
                executionDetails.exitCode = 1;
            }
            else {
                executionDetails.exitCode = 0;
            }
        }
        return executionDetails;
    }
    /**
     * Fetch execution details from ETL logs
     * Requirements: 2.2 - Parse ETL logs to extract execution details
     */
    async fetchFromETLLogs(jobConfig) {
        this.logger.debug('JobMonitor', `Fetching from ETL logs for job: ${jobConfig.jobId}`);
        // Simulate ETL log parsing
        const now = new Date();
        const executionDetails = {
            jobId: jobConfig.jobId,
            startTime: new Date(now.getTime() - (Math.random() * 7200000)), // Random start time within last 2 hours
            status: this.simulateJobStatus()
        };
        // ETL logs might have more detailed error information
        if (executionDetails.status === 'Failed') {
            executionDetails.endTime = now;
            executionDetails.failureReason = 'ETL process failed: Data transformation error';
            executionDetails.exitCode = 2;
        }
        else if (executionDetails.status === 'Success') {
            executionDetails.endTime = now;
            executionDetails.exitCode = 0;
        }
        return executionDetails;
    }
    /**
     * Fetch execution details from database
     * Requirements: 2.3 - Query database tables to retrieve current job status
     */
    async fetchFromDatabase(jobConfig) {
        this.logger.debug('JobMonitor', `Fetching from database for job: ${jobConfig.jobId}`);
        try {
            // In a real implementation, this would execute the configured query pattern
            // For now, we'll simulate database query results
            const now = new Date();
            const executionDetails = {
                jobId: jobConfig.jobId,
                startTime: new Date(now.getTime() - (Math.random() * 1800000)), // Random start time within last 30 minutes
                status: this.simulateJobStatus()
            };
            // Database queries might provide more precise timing
            if (executionDetails.status === 'Success' || executionDetails.status === 'Failed') {
                executionDetails.endTime = now;
                executionDetails.exitCode = executionDetails.status === 'Success' ? 0 : 1;
                if (executionDetails.status === 'Failed') {
                    executionDetails.failureReason = 'Database job execution failed';
                }
            }
            return executionDetails;
        }
        catch (error) {
            this.logger.error('JobMonitor', `Database query failed for job ${jobConfig.jobId}:`, error);
            throw new Error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Simulate job status for demonstration purposes
     */
    simulateJobStatus() {
        const statuses = ['Running', 'Success', 'Failed', 'Delayed'];
        const weights = [0.4, 0.4, 0.1, 0.1]; // 40% running, 40% success, 10% failed, 10% delayed
        const random = Math.random();
        let cumulative = 0;
        for (let i = 0; i < statuses.length; i++) {
            cumulative += weights[i];
            if (random <= cumulative) {
                return statuses[i];
            }
        }
        return 'Running'; // Fallback
    }
    /**
     * Update job status based on execution details
     * Requirements: 1.1, 1.2, 1.3 - Record start time, completion time, and failure time
     */
    async updateJobStatusFromExecution(currentStatus, executionDetails, jobConfig) {
        const updatedStatus = { ...currentStatus };
        // Update status from execution details
        if (executionDetails.status) {
            updatedStatus.status = executionDetails.status;
        }
        // Update timing information
        if (executionDetails.startTime) {
            updatedStatus.startTime = executionDetails.startTime;
        }
        if (executionDetails.endTime) {
            updatedStatus.endTime = executionDetails.endTime;
        }
        // Update failure reason
        if (executionDetails.failureReason) {
            updatedStatus.failureReason = executionDetails.failureReason;
        }
        // Always update heartbeat
        updatedStatus.lastHeartbeat = new Date();
        return updatedStatus;
    }
    /**
     * Check for job delays and update status accordingly with SLA monitoring
     * Requirements: 1.4 - Detect when jobs exceed expected duration
     */
    checkForDelays(status, jobConfig) {
        if (!status.startTime || status.status !== 'Running') {
            return; // Can't check delays for jobs that haven't started or are already completed
        }
        const now = new Date();
        const executionTime = (now.getTime() - status.startTime.getTime()) / (1000 * 60); // Convert to minutes
        const slaThresholds = jobConfig.slaThresholds;
        // Check against SLA thresholds for more granular delay detection
        const maxExecutionTime = slaThresholds.maxExecutionTime;
        const alertDelayMinutes = slaThresholds.alertDelayMinutes;
        const criticalDelayMinutes = slaThresholds.criticalDelayMinutes;
        // Determine delay severity based on SLA thresholds
        if (executionTime > criticalDelayMinutes) {
            status.status = 'Delayed';
            status.failureReason = `CRITICAL DELAY: Job exceeded critical threshold of ${criticalDelayMinutes} minutes (running for ${Math.round(executionTime)} minutes)`;
            this.logger.error('JobMonitor', `Job ${jobConfig.jobId} has critical delay`, {
                maxExecutionTime,
                criticalDelayMinutes,
                actualDuration: Math.round(executionTime),
                jobId: jobConfig.jobId,
                severity: 'Critical'
            });
        }
        else if (executionTime > alertDelayMinutes) {
            status.status = 'Delayed';
            status.failureReason = `MODERATE DELAY: Job exceeded alert threshold of ${alertDelayMinutes} minutes (running for ${Math.round(executionTime)} minutes)`;
            this.logger.warn('JobMonitor', `Job ${jobConfig.jobId} has moderate delay`, {
                maxExecutionTime,
                alertDelayMinutes,
                actualDuration: Math.round(executionTime),
                jobId: jobConfig.jobId,
                severity: 'Medium'
            });
        }
        else if (executionTime > maxExecutionTime) {
            status.status = 'Delayed';
            status.failureReason = `MINOR DELAY: Job exceeded expected duration of ${maxExecutionTime} minutes (running for ${Math.round(executionTime)} minutes)`;
            this.logger.warn('JobMonitor', `Job ${jobConfig.jobId} is delayed`, {
                maxExecutionTime,
                actualDuration: Math.round(executionTime),
                jobId: jobConfig.jobId,
                severity: 'Low'
            });
        }
    }
    /**
     * Persist job execution to database
     * Requirements: 8.1 - Store job execution records
     */
    async persistJobExecution(status, jobConfig) {
        try {
            const executionId = generateId();
            const sql = `
        INSERT OR REPLACE INTO job_executions (
          execution_id, job_id, start_time, end_time, status, 
          exit_code, failure_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
            const params = [
                executionId,
                status.jobId,
                status.startTime?.toISOString(),
                status.endTime?.toISOString(),
                status.status,
                status.status === 'Success' ? 0 : (status.status === 'Failed' ? 1 : null),
                status.failureReason,
            ];
            await this.db.run(sql, params);
            this.logger.debug('JobMonitor', `Persisted execution for job: ${status.jobId}`, {
                executionId,
                status: status.status
            });
        }
        catch (error) {
            this.logger.error('JobMonitor', `Failed to persist job execution for ${status.jobId}:`, error);
            // Don't throw here as this shouldn't stop monitoring
        }
    }
    /**
     * Get SLA compliance metrics for a job
     * Requirements: 1.4 - Monitor SLA compliance and delay detection
     */
    async getSLAMetrics(jobId) {
        this.logger.debug('JobMonitor', `Getting SLA metrics for job: ${jobId}`);
        try {
            // Get recent executions for SLA analysis
            const sql = `
        SELECT 
          execution_id,
          start_time,
          end_time,
          status,
          failure_reason
        FROM job_executions 
        WHERE job_id = ? 
        AND start_time >= datetime('now', '-30 days')
        ORDER BY start_time DESC
      `;
            const executions = await this.db.all(sql, [jobId]);
            if (executions.length === 0) {
                return {
                    jobId,
                    totalExecutions: 0,
                    successfulExecutions: 0,
                    failedExecutions: 0,
                    delayedExecutions: 0,
                    averageExecutionTime: 0,
                    slaComplianceRate: 0,
                    lastCalculated: new Date()
                };
            }
            let successfulExecutions = 0;
            let failedExecutions = 0;
            let delayedExecutions = 0;
            let totalExecutionTime = 0;
            let completedExecutions = 0;
            for (const execution of executions) {
                switch (execution.status) {
                    case 'Success':
                        successfulExecutions++;
                        break;
                    case 'Failed':
                        failedExecutions++;
                        break;
                    case 'Delayed':
                        delayedExecutions++;
                        break;
                }
                // Calculate execution time for completed jobs
                if (execution.start_time && execution.end_time) {
                    const startTime = new Date(execution.start_time);
                    const endTime = new Date(execution.end_time);
                    const executionTime = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
                    totalExecutionTime += executionTime;
                    completedExecutions++;
                }
            }
            const averageExecutionTime = completedExecutions > 0 ? totalExecutionTime / completedExecutions : 0;
            const slaComplianceRate = executions.length > 0 ?
                ((successfulExecutions) / executions.length) * 100 : 0;
            return {
                jobId,
                totalExecutions: executions.length,
                successfulExecutions,
                failedExecutions,
                delayedExecutions,
                averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
                slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
                lastCalculated: new Date()
            };
        }
        catch (error) {
            const errorMessage = `Failed to get SLA metrics for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Check if a job is currently in SLA compliance
     * Requirements: 1.4 - Monitor SLA thresholds
     */
    async checkSLACompliance(jobId) {
        this.logger.debug('JobMonitor', `Checking SLA compliance for job: ${jobId}`);
        try {
            const status = await this.getJobStatus(jobId);
            const jobConfig = await this.getJobConfigurationFromDatabase(jobId);
            if (!jobConfig) {
                throw new Error(`Job configuration not found for job: ${jobId}`);
            }
            const compliance = {
                jobId,
                isCompliant: true,
                currentStatus: status.status,
                complianceLevel: 'Green',
                message: 'Job is within SLA thresholds',
                checkedAt: new Date()
            };
            // Check if job is running and within thresholds
            if (status.status === 'Running' && status.startTime) {
                const now = new Date();
                const executionTime = (now.getTime() - status.startTime.getTime()) / (1000 * 60);
                const slaThresholds = jobConfig.slaThresholds;
                if (executionTime > slaThresholds.criticalDelayMinutes) {
                    compliance.isCompliant = false;
                    compliance.complianceLevel = 'Red';
                    compliance.message = `Job has exceeded critical delay threshold (${Math.round(executionTime)} > ${slaThresholds.criticalDelayMinutes} minutes)`;
                }
                else if (executionTime > slaThresholds.alertDelayMinutes) {
                    compliance.isCompliant = false;
                    compliance.complianceLevel = 'Yellow';
                    compliance.message = `Job has exceeded alert delay threshold (${Math.round(executionTime)} > ${slaThresholds.alertDelayMinutes} minutes)`;
                }
                else if (executionTime > slaThresholds.maxExecutionTime) {
                    compliance.complianceLevel = 'Yellow';
                    compliance.message = `Job has exceeded expected duration (${Math.round(executionTime)} > ${slaThresholds.maxExecutionTime} minutes)`;
                }
            }
            else if (status.status === 'Failed') {
                compliance.isCompliant = false;
                compliance.complianceLevel = 'Red';
                compliance.message = `Job has failed: ${status.failureReason || 'Unknown reason'}`;
            }
            else if (status.status === 'Delayed') {
                compliance.isCompliant = false;
                compliance.complianceLevel = 'Red';
                compliance.message = `Job is delayed: ${status.failureReason || 'Exceeded expected duration'}`;
            }
            return compliance;
        }
        catch (error) {
            const errorMessage = `Failed to check SLA compliance for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { jobId, error });
            throw new Error(errorMessage);
        }
    }
    async getJobStatusFromDatabase(jobId) {
        try {
            const sql = `
        SELECT je.*, jc.name 
        FROM job_executions je
        JOIN job_configurations jc ON je.job_id = jc.job_id
        WHERE je.job_id = ? 
        ORDER BY je.created_at DESC 
        LIMIT 1
      `;
            const row = await this.db.get(sql, [jobId]);
            if (!row) {
                return undefined;
            }
            return {
                jobId: row.job_id,
                name: row.name,
                status: row.status,
                startTime: row.start_time ? new Date(row.start_time) : undefined,
                endTime: row.end_time ? new Date(row.end_time) : undefined,
                lastHeartbeat: new Date(row.updated_at),
                failureReason: row.failure_reason
            };
        }
        catch (error) {
            this.logger.error('JobMonitor', `Failed to get job status from database for ${jobId}:`, error);
            return undefined;
        }
    }
    /**
     * Get job configuration from database
     */
    async getJobConfigurationFromDatabase(jobId) {
        try {
            const sql = `
        SELECT * FROM job_configurations WHERE job_id = ?
      `;
            const row = await this.db.get(sql, [jobId]);
            if (!row) {
                return undefined;
            }
            return {
                jobId: row.job_id,
                name: row.name,
                schedule: row.schedule,
                expectedDuration: row.expected_duration,
                logPaths: JSON.parse(row.log_paths),
                dataSource: JSON.parse(row.data_source),
                alertChannels: JSON.parse(row.alert_channels),
                slaThresholds: JSON.parse(row.sla_thresholds)
            };
        }
        catch (error) {
            this.logger.error('JobMonitor', `Failed to get job configuration from database for ${jobId}:`, error);
            return undefined;
        }
    }
    /**
     * Initialize the job monitor service
     */
    async initialize() {
        this.logger.info('JobMonitor', 'Initializing Job Monitor Service');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            // Set up periodic health checks (every 5 minutes)
            setInterval(async () => {
                await this.validateHealth();
            }, 5 * 60 * 1000);
            this.logger.info('JobMonitor', 'Job Monitor Service initialized successfully');
        }
        catch (error) {
            const errorMessage = `Failed to initialize Job Monitor Service: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('JobMonitor', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('JobMonitor', 'Cleaning up Job Monitor Service');
        try {
            // Stop all monitoring jobs
            for (const jobId of this.monitoringJobs.keys()) {
                await this.stopMonitoring(jobId);
            }
            // Clear status cache
            this.jobStatuses.clear();
            this.logger.info('JobMonitor', 'Job Monitor Service cleanup completed');
        }
        catch (error) {
            this.logger.error('JobMonitor', 'Error during Job Monitor Service cleanup:', error);
            throw error;
        }
    }
}
exports.JobMonitorServiceImpl = JobMonitorServiceImpl;
//# sourceMappingURL=job-monitor.js.map