"use strict";
// Dashboard REST API - Provides HTTP endpoints for the web dashboard
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardAPI = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("../utils/logger");
class DashboardAPI {
    constructor(dashboardService, configManager, jobMonitor, alertService) {
        this.jobMonitor = null;
        this.alertService = null;
        this.server = null;
        this.app = (0, express_1.default)();
        this.logger = logger_1.Logger.getInstance();
        this.dashboardService = dashboardService;
        this.configManager = configManager;
        this.jobMonitor = jobMonitor || null;
        this.alertService = alertService || null;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Enable CORS for all routes
        this.app.use((0, cors_1.default)({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        // Parse JSON bodies
        this.app.use(express_1.default.json({ limit: '10mb' }));
        // Parse URL-encoded bodies
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.debug('API', `${req.method} ${req.path}`, {
                query: req.query,
                userAgent: req.get('User-Agent')
            });
            next();
        });
        // Add request timestamp
        this.app.use((req, res, next) => {
            req.startTime = Date.now();
            next();
        });
    }
    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/api/health', this.handleHealthCheck.bind(this));
        // Dashboard data endpoints
        this.app.get('/api/dashboard', this.handleGetDashboardData.bind(this));
        this.app.get('/api/dashboard/summary', this.handleGetJobSummary.bind(this));
        this.app.get('/api/dashboard/metrics', this.handleGetSystemMetrics.bind(this));
        // Job endpoints
        this.app.get('/api/jobs', this.handleGetJobs.bind(this));
        this.app.get('/api/jobs/:jobId', this.handleGetJobDetails.bind(this));
        this.app.get('/api/jobs/:jobId/history', this.handleGetJobHistory.bind(this));
        this.app.get('/api/jobs/:jobId/status', this.handleGetJobStatus.bind(this));
        // Job configuration endpoints
        this.app.get('/api/config/jobs', this.handleGetJobConfigurations.bind(this));
        this.app.get('/api/config/jobs/:jobId', this.handleGetJobConfiguration.bind(this));
        this.app.post('/api/config/jobs', this.handleCreateJobConfiguration.bind(this));
        this.app.put('/api/config/jobs/:jobId', this.handleUpdateJobConfiguration.bind(this));
        this.app.delete('/api/config/jobs/:jobId', this.handleDeleteJobConfiguration.bind(this));
        // Execution history endpoints
        this.app.get('/api/executions', this.handleGetExecutions.bind(this));
        this.app.get('/api/executions/:executionId', this.handleGetExecution.bind(this));
        // Alert endpoints
        this.app.get('/api/alerts', this.handleGetAlerts.bind(this));
        this.app.get('/api/alerts/recent', this.handleGetRecentAlerts.bind(this));
        this.app.post('/api/alerts/suppress/:jobId', this.handleSuppressAlerts.bind(this));
        // System health endpoint
        this.app.get('/api/system/health', this.handleSystemHealth.bind(this));
        // Monitoring control endpoints
        this.app.post('/api/monitoring/start/:jobId', this.handleStartMonitoring.bind(this));
        this.app.post('/api/monitoring/stop/:jobId', this.handleStopMonitoring.bind(this));
        // Static file serving for dashboard UI
        this.app.use('/dashboard', express_1.default.static('public/dashboard'));
        this.app.get('/dashboard/*', (req, res) => {
            res.sendFile('index.html', { root: 'public/dashboard' });
        });
        // Root redirect
        this.app.get('/', (req, res) => {
            res.redirect('/dashboard');
        });
    }
    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString()
            });
        });
        // Global error handler
        this.app.use((error, req, res, next) => {
            const duration = req.startTime ? Date.now() - req.startTime : 0;
            this.logger.error('API', `Error in ${req.method} ${req.path}:`, {
                error: error.message,
                stack: error.stack,
                duration
            });
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
                timestamp: new Date().toISOString()
            });
        });
    }
    /**
     * Health check endpoint
     */
    async handleHealthCheck(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                services: {
                    dashboard: 'healthy',
                    database: 'unknown',
                    jobMonitor: this.jobMonitor ? 'healthy' : 'not_configured',
                    alertService: this.alertService ? 'healthy' : 'not_configured'
                }
            };
            // Test database connection
            try {
                const metrics = await this.dashboardService.getSystemMetrics();
                health.services.database = 'healthy';
            }
            catch (error) {
                health.services.database = 'unhealthy';
                health.status = 'degraded';
            }
            res.json(health);
        }
        catch (error) {
            res.status(500).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Get complete dashboard data
     */
    async handleGetDashboardData(req, res) {
        try {
            const data = await this.dashboardService.getDashboardData();
            res.json({
                success: true,
                data,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get job status summary
     */
    async handleGetJobSummary(req, res) {
        try {
            const summary = await this.dashboardService.getJobStatusSummary();
            res.json({
                success: true,
                data: summary,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get system metrics
     */
    async handleGetSystemMetrics(req, res) {
        try {
            const metrics = await this.dashboardService.getSystemMetrics();
            res.json({
                success: true,
                data: metrics,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get jobs with optional status filter
     */
    async handleGetJobs(req, res) {
        try {
            const status = req.query.status;
            const jobs = await this.dashboardService.getFilteredJobs(status);
            res.json({
                success: true,
                data: jobs,
                count: jobs.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get job details
     */
    async handleGetJobDetails(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const details = await this.dashboardService.getJobDetails(jobId);
            res.json({
                success: true,
                data: details,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get job execution history
     */
    async handleGetJobHistory(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const days = parseInt(req.query.days) || 7;
            const history = await this.dashboardService.getJobExecutionHistory(jobId, days);
            res.json({
                success: true,
                data: history,
                count: history.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get job status
     */
    async handleGetJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            if (!this.jobMonitor) {
                res.status(503).json({
                    success: false,
                    error: 'Job monitor service not available',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const status = await this.jobMonitor.getJobStatus(jobId);
            res.json({
                success: true,
                data: status,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get job configurations
     */
    async handleGetJobConfigurations(req, res) {
        try {
            const configurations = await this.configManager.getAllJobConfigurations();
            res.json({
                success: true,
                data: configurations,
                count: configurations.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get specific job configuration
     */
    async handleGetJobConfiguration(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const configuration = await this.configManager.getJobConfiguration(jobId);
            res.json({
                success: true,
                data: configuration,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Create job configuration
     */
    async handleCreateJobConfiguration(req, res) {
        try {
            const configuration = req.body;
            // Validate configuration
            const isValid = await this.configManager.validateConfiguration(configuration);
            if (!isValid) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid job configuration',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            await this.configManager.addJobConfiguration(configuration);
            // Start monitoring if job monitor is available
            if (this.jobMonitor) {
                try {
                    await this.jobMonitor.startMonitoring(configuration);
                }
                catch (monitorError) {
                    this.logger.warn('API', `Failed to start monitoring for new job ${configuration.jobId}:`, monitorError);
                }
            }
            res.status(201).json({
                success: true,
                message: 'Job configuration created successfully',
                data: { jobId: configuration.jobId },
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Update job configuration
     */
    async handleUpdateJobConfiguration(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const updates = req.body;
            await this.configManager.updateJobConfiguration(jobId, updates);
            // Update monitoring if job monitor is available
            if (this.jobMonitor) {
                try {
                    const updatedConfig = await this.configManager.getJobConfiguration(jobId);
                    await this.jobMonitor.updateJobConfiguration(updatedConfig);
                }
                catch (monitorError) {
                    this.logger.warn('API', `Failed to update monitoring for job ${jobId}:`, monitorError);
                }
            }
            res.json({
                success: true,
                message: 'Job configuration updated successfully',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Delete job configuration
     */
    async handleDeleteJobConfiguration(req, res) {
        try {
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            // Stop monitoring if job monitor is available
            if (this.jobMonitor) {
                try {
                    await this.jobMonitor.stopMonitoring(jobId);
                }
                catch (monitorError) {
                    this.logger.warn('API', `Failed to stop monitoring for job ${jobId}:`, monitorError);
                }
            }
            await this.configManager.removeJobConfiguration(jobId);
            res.json({
                success: true,
                message: 'Job configuration deleted successfully',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get executions with filters
     */
    async handleGetExecutions(req, res) {
        try {
            const filters = {
                jobId: req.query.jobId,
                status: req.query.status,
                startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit) : 100,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };
            const days = parseInt(req.query.days) || 7;
            const executions = await this.dashboardService.getJobExecutionHistory(filters.jobId, days);
            res.json({
                success: true,
                data: executions,
                count: executions.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get specific execution
     */
    async handleGetExecution(req, res) {
        try {
            const { executionId } = req.params;
            // This would require the data persistence service
            res.status(501).json({
                success: false,
                error: 'Get execution by ID not implemented yet',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get recent alerts (last 24 hours)
     */
    async handleGetRecentAlerts(req, res) {
        try {
            if (!this.alertService) {
                // Return empty alerts if service not available
                res.json({
                    success: true,
                    data: [],
                    count: 0,
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const limit = parseInt(req.query.limit) || 50;
            const alerts = await this.alertService.getAlertHistory(undefined, limit);
            // Filter to last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentAlerts = alerts.filter(alert => new Date(alert.timestamp) > oneDayAgo);
            res.json({
                success: true,
                data: recentAlerts,
                count: recentAlerts.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get system health status
     */
    async handleSystemHealth(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: {
                    database: 'unknown',
                    jobMonitor: this.jobMonitor ? 'healthy' : 'not_configured',
                    alertService: this.alertService ? 'healthy' : 'not_configured'
                }
            };
            // Test database connection
            try {
                await this.dashboardService.getSystemMetrics();
                health.services.database = 'healthy';
            }
            catch (error) {
                health.services.database = 'unhealthy';
                health.status = 'warning';
            }
            res.json({
                success: true,
                data: health,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get alert history
     */
    async handleGetAlerts(req, res) {
        try {
            if (!this.alertService) {
                res.status(503).json({
                    success: false,
                    error: 'Alert service not available',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const jobId = req.query.jobId;
            const limit = parseInt(req.query.limit) || 100;
            const alerts = await this.alertService.getAlertHistory(jobId, limit);
            res.json({
                success: true,
                data: alerts,
                count: alerts.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Suppress alerts for a job
     */
    async handleSuppressAlerts(req, res) {
        try {
            if (!this.alertService) {
                res.status(503).json({
                    success: false,
                    error: 'Alert service not available',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const { duration } = req.body; // Duration in minutes
            if (!duration || duration <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Duration (in minutes) is required and must be positive',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            await this.alertService.suppressAlerts(jobId, duration);
            res.json({
                success: true,
                message: `Alerts suppressed for job ${jobId} for ${duration} minutes`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Start monitoring for a job
     */
    async handleStartMonitoring(req, res) {
        try {
            if (!this.jobMonitor) {
                res.status(503).json({
                    success: false,
                    error: 'Job monitor service not available',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            const configuration = await this.configManager.getJobConfiguration(jobId);
            await this.jobMonitor.startMonitoring(configuration);
            res.json({
                success: true,
                message: `Monitoring started for job ${jobId}`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Stop monitoring for a job
     */
    async handleStopMonitoring(req, res) {
        try {
            if (!this.jobMonitor) {
                res.status(503).json({
                    success: false,
                    error: 'Job monitor service not available',
                    timestamp: new Date().toISOString()
                });
                return;
            }
            const { jobId } = req.params;
            if (typeof jobId !== 'string') {
                res.status(400).json({ success: false, error: 'Invalid job ID' });
                return;
            }
            await this.jobMonitor.stopMonitoring(jobId);
            res.json({
                success: true,
                message: `Monitoring stopped for job ${jobId}`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Start the API server
     */
    async start(port = 3000) {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(port, () => {
                    this.logger.info('API', `Dashboard API server started on port ${port}`);
                    resolve();
                });
                this.server.on('error', (error) => {
                    this.logger.error('API', 'Server error:', error);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop the API server
     */
    async stop() {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((error) => {
                    if (error) {
                        this.logger.error('API', 'Error stopping server:', error);
                        reject(error);
                    }
                    else {
                        this.logger.info('API', 'Dashboard API server stopped');
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }
}
exports.DashboardAPI = DashboardAPI;
//# sourceMappingURL=dashboard-api.js.map