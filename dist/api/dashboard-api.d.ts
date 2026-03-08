import express from 'express';
import { DashboardServiceImpl } from '../services/dashboard-service';
import { ConfigurationManagerService } from '../services/configuration-manager';
import { JobMonitorServiceImpl } from '../services/job-monitor';
import { AlertServiceImpl } from '../services/alert-service';
export declare class DashboardAPI {
    private app;
    private logger;
    private dashboardService;
    private configManager;
    private jobMonitor;
    private alertService;
    private server;
    constructor(dashboardService: DashboardServiceImpl, configManager: ConfigurationManagerService, jobMonitor?: JobMonitorServiceImpl, alertService?: AlertServiceImpl);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup API routes
     */
    private setupRoutes;
    /**
     * Setup error handling middleware
     */
    private setupErrorHandling;
    /**
     * Health check endpoint
     */
    private handleHealthCheck;
    /**
     * Get complete dashboard data
     */
    private handleGetDashboardData;
    /**
     * Get job status summary
     */
    private handleGetJobSummary;
    /**
     * Get system metrics
     */
    private handleGetSystemMetrics;
    /**
     * Get jobs with optional status filter
     */
    private handleGetJobs;
    /**
     * Get job details
     */
    private handleGetJobDetails;
    /**
     * Get job execution history
     */
    private handleGetJobHistory;
    /**
     * Get job status
     */
    private handleGetJobStatus;
    /**
     * Get job configurations
     */
    private handleGetJobConfigurations;
    /**
     * Get specific job configuration
     */
    private handleGetJobConfiguration;
    /**
     * Create job configuration
     */
    private handleCreateJobConfiguration;
    /**
     * Update job configuration
     */
    private handleUpdateJobConfiguration;
    /**
     * Delete job configuration
     */
    private handleDeleteJobConfiguration;
    /**
     * Get executions with filters
     */
    private handleGetExecutions;
    /**
     * Get specific execution
     */
    private handleGetExecution;
    /**
     * Get recent alerts (last 24 hours)
     */
    private handleGetRecentAlerts;
    /**
     * Get system health status
     */
    private handleSystemHealth;
    /**
     * Get alert history
     */
    private handleGetAlerts;
    /**
     * Suppress alerts for a job
     */
    private handleSuppressAlerts;
    /**
     * Start monitoring for a job
     */
    private handleStartMonitoring;
    /**
     * Stop monitoring for a job
     */
    private handleStopMonitoring;
    /**
     * Start the API server
     */
    start(port?: number): Promise<void>;
    /**
     * Stop the API server
     */
    stop(): Promise<void>;
    /**
     * Get Express app instance
     */
    getApp(): express.Application;
}
//# sourceMappingURL=dashboard-api.d.ts.map