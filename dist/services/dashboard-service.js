"use strict";
// Dashboard Service - Provides data APIs for the web dashboard
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardServiceImpl = void 0;
const logger_1 = require("../utils/logger");
class DashboardServiceImpl {
    constructor(db, jobMonitor, systemHealth, dataPersistence) {
        this.jobMonitor = null;
        this.systemHealth = null;
        this.dataPersistence = null;
        this.cacheTimeout = 30000; // 30 seconds cache timeout
        this.cachedData = new Map();
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
        this.jobMonitor = jobMonitor || null;
        this.systemHealth = systemHealth || null;
        this.dataPersistence = dataPersistence || null;
    }
    /**
     * Get job status summary for dashboard overview
     * Requirements: 5.1, 5.2 - Display job status and information
     */
    async getJobStatusSummary() {
        this.logger.debug('Dashboard', 'Getting job status summary');
        try {
            // Check cache first
            const cacheKey = 'job-status-summary';
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            let summary;
            if (this.jobMonitor) {
                // Get real-time data from job monitor
                const jobStatuses = await this.jobMonitor.getAllJobStatuses();
                summary = this.calculateSummaryFromStatuses(jobStatuses);
            }
            else {
                // Fallback to database query
                summary = await this.calculateSummaryFromDatabase();
            }
            // Cache the result
            this.setCachedData(cacheKey, summary);
            this.logger.debug('Dashboard', 'Job status summary retrieved', summary);
            return summary;
        }
        catch (error) {
            const errorMessage = `Failed to get job status summary: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get job execution history for dashboard
     * Requirements: 5.5 - Display job execution history for the last 7 days
     */
    async getJobExecutionHistory(jobId, days = 7) {
        this.logger.debug('Dashboard', 'Getting job execution history', { jobId, days });
        try {
            if (days <= 0 || days > 365) {
                throw new Error('Days must be between 1 and 365');
            }
            // Check cache for this specific query
            const cacheKey = `execution-history-${jobId || 'all'}-${days}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            let executions;
            if (this.dataPersistence) {
                // Use data persistence service if available
                if (jobId) {
                    executions = await this.dataPersistence.getJobExecutionHistory(jobId, days);
                }
                else {
                    // Get all executions for the specified period
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    executions = await this.dataPersistence.queryExecutions({
                        startDate,
                        endDate,
                        limit: 1000 // Reasonable limit for dashboard
                    });
                }
            }
            else {
                // Fallback to direct database query
                executions = await this.getExecutionHistoryFromDatabase(jobId, days);
            }
            // Cache the result
            this.setCachedData(cacheKey, executions);
            this.logger.debug('Dashboard', `Retrieved ${executions.length} execution history records`);
            return executions;
        }
        catch (error) {
            const errorMessage = `Failed to get job execution history: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { jobId, days, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get filtered jobs by status
     * Requirements: 5.4 - Provide filtering capabilities by job status
     */
    async getFilteredJobs(status) {
        this.logger.debug('Dashboard', 'Getting filtered jobs', { status });
        try {
            // Validate status filter
            if (status && !['Running', 'Success', 'Failed', 'Delayed'].includes(status)) {
                throw new Error('Invalid status filter. Must be one of: Running, Success, Failed, Delayed');
            }
            // Check cache
            const cacheKey = `filtered-jobs-${status || 'all'}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            let jobs;
            if (this.jobMonitor) {
                // Get real-time data from job monitor
                const allJobs = await this.jobMonitor.getAllJobStatuses();
                jobs = status ? allJobs.filter(job => job.status === status) : allJobs;
            }
            else {
                // Fallback to database query
                jobs = await this.getFilteredJobsFromDatabase(status);
            }
            // Cache the result
            this.setCachedData(cacheKey, jobs);
            this.logger.debug('Dashboard', `Retrieved ${jobs.length} filtered jobs`);
            return jobs;
        }
        catch (error) {
            const errorMessage = `Failed to get filtered jobs: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { status, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get system metrics for dashboard
     */
    async getSystemMetrics() {
        this.logger.debug('Dashboard', 'Getting system metrics');
        try {
            // Check cache
            const cacheKey = 'system-metrics';
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            const metrics = {
                uptime: process.uptime(),
                totalExecutions: 0,
                alertsSent: 0,
                averageExecutionTime: 0,
                systemHealth: []
            };
            // Get total executions count
            try {
                const executionCountSql = 'SELECT COUNT(*) as count FROM job_executions';
                const executionResult = await this.db.get(executionCountSql);
                metrics.totalExecutions = executionResult?.count || 0;
            }
            catch (error) {
                this.logger.warn('Dashboard', 'Failed to get execution count:', error);
            }
            // Get alerts sent count
            try {
                const alertCountSql = 'SELECT COUNT(*) as count FROM alert_history';
                const alertResult = await this.db.get(alertCountSql);
                metrics.alertsSent = alertResult?.count || 0;
            }
            catch (error) {
                this.logger.warn('Dashboard', 'Failed to get alert count:', error);
            }
            // Calculate average execution time
            try {
                const avgTimeSql = `
          SELECT AVG(
            CASE 
              WHEN end_time IS NOT NULL AND start_time IS NOT NULL 
              THEN (julianday(end_time) - julianday(start_time)) * 24 * 60 
              ELSE NULL 
            END
          ) as avg_minutes
          FROM job_executions 
          WHERE status IN ('Success', 'Failed') 
          AND start_time IS NOT NULL 
          AND end_time IS NOT NULL
        `;
                const avgResult = await this.db.get(avgTimeSql);
                metrics.averageExecutionTime = avgResult?.avg_minutes || 0;
            }
            catch (error) {
                this.logger.warn('Dashboard', 'Failed to calculate average execution time:', error);
            }
            // Get system health status
            if (this.systemHealth) {
                try {
                    metrics.systemHealth = await this.systemHealth.getSystemHealth();
                }
                catch (error) {
                    this.logger.warn('Dashboard', 'Failed to get system health:', error);
                }
            }
            else {
                // Fallback to database query
                try {
                    const healthSql = 'SELECT component, status, last_check, details FROM system_health';
                    const healthRows = await this.db.all(healthSql);
                    metrics.systemHealth = healthRows.map(row => ({
                        component: row.component,
                        status: row.status,
                        lastCheck: new Date(row.last_check),
                        details: row.details
                    }));
                }
                catch (error) {
                    this.logger.warn('Dashboard', 'Failed to get system health from database:', error);
                    metrics.systemHealth = [];
                }
            }
            // Cache the result
            this.setCachedData(cacheKey, metrics);
            this.logger.debug('Dashboard', 'System metrics retrieved', {
                uptime: metrics.uptime,
                totalExecutions: metrics.totalExecutions,
                alertsSent: metrics.alertsSent,
                healthComponents: metrics.systemHealth.length
            });
            return metrics;
        }
        catch (error) {
            const errorMessage = `Failed to get system metrics: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get dashboard data for real-time updates
     * Requirements: 5.3 - Refresh job information automatically every 30 seconds
     */
    async getDashboardData() {
        this.logger.debug('Dashboard', 'Getting complete dashboard data');
        try {
            // Get all dashboard data in parallel for better performance
            const [summary, recentExecutions, systemMetrics, failedJobs, delayedJobs] = await Promise.all([
                this.getJobStatusSummary(),
                this.getJobExecutionHistory(undefined, 1), // Last 24 hours
                this.getSystemMetrics(),
                this.getFilteredJobs('Failed'),
                this.getFilteredJobs('Delayed')
            ]);
            const dashboardData = {
                summary,
                recentExecutions,
                systemMetrics,
                failedJobs,
                delayedJobs
            };
            this.logger.debug('Dashboard', 'Complete dashboard data retrieved', {
                summaryJobs: summary.totalJobs,
                recentExecutions: recentExecutions.length,
                failedJobs: failedJobs.length,
                delayedJobs: delayedJobs.length
            });
            return dashboardData;
        }
        catch (error) {
            const errorMessage = `Failed to get dashboard data: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Calculate job status summary from job statuses
     */
    calculateSummaryFromStatuses(jobStatuses) {
        const summary = {
            totalJobs: jobStatuses.length,
            runningJobs: 0,
            successfulJobs: 0,
            failedJobs: 0,
            delayedJobs: 0,
            lastUpdated: new Date()
        };
        for (const job of jobStatuses) {
            switch (job.status) {
                case 'Running':
                    summary.runningJobs++;
                    break;
                case 'Success':
                    summary.successfulJobs++;
                    break;
                case 'Failed':
                    summary.failedJobs++;
                    break;
                case 'Delayed':
                    summary.delayedJobs++;
                    break;
            }
        }
        return summary;
    }
    /**
     * Calculate job status summary from database
     */
    async calculateSummaryFromDatabase() {
        try {
            // Get latest execution for each job
            const sql = `
        SELECT 
          COUNT(DISTINCT je.job_id) as total_jobs,
          SUM(CASE WHEN je.status = 'Running' THEN 1 ELSE 0 END) as running_jobs,
          SUM(CASE WHEN je.status = 'Success' THEN 1 ELSE 0 END) as successful_jobs,
          SUM(CASE WHEN je.status = 'Failed' THEN 1 ELSE 0 END) as failed_jobs,
          SUM(CASE WHEN je.status = 'Delayed' THEN 1 ELSE 0 END) as delayed_jobs
        FROM job_executions je
        INNER JOIN (
          SELECT job_id, MAX(created_at) as latest_created_at
          FROM job_executions
          GROUP BY job_id
        ) latest ON je.job_id = latest.job_id AND je.created_at = latest.latest_created_at
      `;
            const result = await this.db.get(sql);
            return {
                totalJobs: result?.total_jobs || 0,
                runningJobs: result?.running_jobs || 0,
                successfulJobs: result?.successful_jobs || 0,
                failedJobs: result?.failed_jobs || 0,
                delayedJobs: result?.delayed_jobs || 0,
                lastUpdated: new Date()
            };
        }
        catch (error) {
            this.logger.error('Dashboard', 'Failed to calculate summary from database:', error);
            return {
                totalJobs: 0,
                runningJobs: 0,
                successfulJobs: 0,
                failedJobs: 0,
                delayedJobs: 0,
                lastUpdated: new Date()
            };
        }
    }
    /**
     * Get execution history from database
     */
    async getExecutionHistoryFromDatabase(jobId, days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            let sql = `
        SELECT execution_id, job_id, start_time, end_time, status, exit_code,
               failure_reason, log_analysis, created_at, updated_at
        FROM job_executions
        WHERE created_at >= ?
      `;
            const params = [cutoffDate.toISOString()];
            if (jobId) {
                sql += ' AND job_id = ?';
                params.push(jobId);
            }
            sql += ' ORDER BY start_time DESC LIMIT 1000';
            const rows = await this.db.all(sql, params);
            return rows.map(row => this.parseExecutionRow(row));
        }
        catch (error) {
            this.logger.error('Dashboard', 'Failed to get execution history from database:', error);
            return [];
        }
    }
    /**
     * Get filtered jobs from database
     */
    async getFilteredJobsFromDatabase(status) {
        try {
            // Get latest execution for each job
            let sql = `
        SELECT 
          je.job_id,
          jc.name,
          je.status,
          je.start_time,
          je.end_time,
          je.failure_reason,
          je.updated_at as last_heartbeat
        FROM job_executions je
        INNER JOIN job_configurations jc ON je.job_id = jc.job_id
        INNER JOIN (
          SELECT job_id, MAX(created_at) as latest_created_at
          FROM job_executions
          GROUP BY job_id
        ) latest ON je.job_id = latest.job_id AND je.created_at = latest.latest_created_at
      `;
            const params = [];
            if (status) {
                sql += ' WHERE je.status = ?';
                params.push(status);
            }
            sql += ' ORDER BY jc.name';
            const rows = await this.db.all(sql, params);
            return rows.map(row => ({
                jobId: row.job_id,
                name: row.name,
                status: row.status,
                startTime: row.start_time ? new Date(row.start_time) : undefined,
                endTime: row.end_time ? new Date(row.end_time) : undefined,
                lastHeartbeat: new Date(row.last_heartbeat),
                failureReason: row.failure_reason
            }));
        }
        catch (error) {
            this.logger.error('Dashboard', 'Failed to get filtered jobs from database:', error);
            return [];
        }
    }
    /**
     * Parse execution row from database
     */
    parseExecutionRow(row) {
        return {
            executionId: row.execution_id,
            jobId: row.job_id,
            startTime: new Date(row.start_time),
            endTime: row.end_time ? new Date(row.end_time) : undefined,
            status: row.status,
            exitCode: row.exit_code,
            failureReason: row.failure_reason,
            logAnalysis: row.log_analysis ? JSON.parse(row.log_analysis) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
    /**
     * Get cached data if still valid
     */
    getCachedData(key) {
        const cached = this.cachedData.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }
    /**
     * Set cached data with timestamp
     */
    setCachedData(key, data) {
        this.cachedData.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cachedData.clear();
        this.logger.debug('Dashboard', 'Cache cleared');
    }
    /**
     * Set cache timeout
     */
    setCacheTimeout(timeoutMs) {
        this.cacheTimeout = timeoutMs;
        this.logger.debug('Dashboard', `Cache timeout set to ${timeoutMs}ms`);
    }
    /**
     * Get job details for dashboard
     */
    async getJobDetails(jobId) {
        this.logger.debug('Dashboard', `Getting job details for: ${jobId}`);
        try {
            if (!jobId || typeof jobId !== 'string') {
                throw new Error('Job ID is required and must be a string');
            }
            // Get job status
            let job;
            if (this.jobMonitor) {
                job = await this.jobMonitor.getJobStatus(jobId);
            }
            else {
                const jobs = await this.getFilteredJobsFromDatabase();
                const foundJob = jobs.find(j => j.jobId === jobId);
                if (!foundJob) {
                    throw new Error(`Job not found: ${jobId}`);
                }
                job = foundJob;
            }
            // Get recent executions
            const recentExecutions = await this.getJobExecutionHistory(jobId, 7);
            // Get job configuration
            const configSql = 'SELECT * FROM job_configurations WHERE job_id = ?';
            const configRow = await this.db.get(configSql, [jobId]);
            const configuration = configRow ? {
                jobId: configRow.job_id,
                name: configRow.name,
                schedule: configRow.schedule,
                expectedDuration: configRow.expected_duration,
                logPaths: JSON.parse(configRow.log_paths),
                dataSource: JSON.parse(configRow.data_source),
                alertChannels: JSON.parse(configRow.alert_channels),
                slaThresholds: JSON.parse(configRow.sla_thresholds)
            } : null;
            return {
                job,
                recentExecutions,
                configuration
            };
        }
        catch (error) {
            const errorMessage = `Failed to get job details for ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Initialize the dashboard service
     */
    async initialize() {
        this.logger.info('Dashboard', 'Initializing Dashboard Service');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            // Set up cache cleanup interval
            setInterval(() => {
                this.cleanupExpiredCache();
            }, 5 * 60 * 1000); // Every 5 minutes
            this.logger.info('Dashboard', 'Dashboard Service initialized successfully');
        }
        catch (error) {
            const errorMessage = `Failed to initialize Dashboard Service: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('Dashboard', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        for (const [key, cached] of this.cachedData) {
            if ((now - cached.timestamp) >= this.cacheTimeout) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.cachedData.delete(key);
        }
        if (expiredKeys.length > 0) {
            this.logger.debug('Dashboard', `Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Dashboard', 'Cleaning up Dashboard Service');
        try {
            this.clearCache();
            this.logger.info('Dashboard', 'Dashboard Service cleanup completed');
        }
        catch (error) {
            this.logger.error('Dashboard', 'Error during Dashboard Service cleanup:', error);
            throw error;
        }
    }
}
exports.DashboardServiceImpl = DashboardServiceImpl;
//# sourceMappingURL=dashboard-service.js.map