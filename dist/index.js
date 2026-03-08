"use strict";
// Main entry point for the batch job monitoring system
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const logger_1 = require("./utils/logger");
const connection_1 = require("./database/connection");
const configuration_manager_1 = require("./services/configuration-manager");
const job_monitor_1 = require("./services/job-monitor");
const alert_service_1 = require("./services/alert-service");
const log_parser_1 = require("./services/log-parser");
const dashboard_service_1 = require("./services/dashboard-service");
const data_persistence_1 = require("./services/data-persistence");
const dashboard_api_1 = require("./api/dashboard-api");
const logger = logger_1.Logger.getInstance();
async function main() {
    try {
        logger.info('BatchJobMonitor', 'Starting Batch Job Monitoring System...');
        // Initialize database connection
        const db = new connection_1.DatabaseConnection();
        await db.connect();
        await db.initializeSchema();
        logger.info('Database', 'Database initialized successfully');
        // Initialize services
        const configManager = new configuration_manager_1.ConfigurationManagerService(db);
        const dataPersistence = new data_persistence_1.DataPersistenceServiceImpl(db);
        const logParser = new log_parser_1.LogParserServiceImpl(db);
        const alertService = new alert_service_1.AlertServiceImpl(db);
        const jobMonitor = new job_monitor_1.JobMonitorServiceImpl(db);
        const dashboardService = new dashboard_service_1.DashboardServiceImpl(db, jobMonitor, undefined, dataPersistence);
        logger.info('Services', 'All services initialized successfully');
        // Initialize web server
        const port = process.env.PORT || 3000;
        // Initialize Dashboard API
        const dashboardAPI = new dashboard_api_1.DashboardAPI(dashboardService, configManager, jobMonitor, alertService);
        // Start the dashboard API server
        await dashboardAPI.start(Number(port));
        // Add sample data for demonstration
        await addSampleData(configManager, dataPersistence);
        logger.info('BatchJobMonitor', 'System startup completed successfully');
        logger.info('BatchJobMonitor', `Dashboard available at http://localhost:${port}`);
        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('BatchJobMonitor', 'Shutting down gracefully...');
            await dashboardAPI.stop();
            await db.close();
            process.exit(0);
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('BatchJobMonitor', 'Failed to start system', { error: errorMessage });
        process.exit(1);
    }
}
async function addSampleData(configManager, dataPersistence) {
    try {
        logger.info('SampleData', 'Adding sample job configurations and data...');
        // Sample job configurations
        const sampleJobs = [
            {
                jobId: 'etl-daily-sales',
                name: 'Daily Sales ETL',
                schedule: '0 2 * * *', // 2 AM daily
                expectedDuration: 3600, // 1 hour
                logPaths: ['/var/log/etl/daily-sales.log'],
                dataSource: {
                    type: 'Database',
                    connectionString: 'postgresql://localhost:5432/sales_db',
                    queryPattern: 'SELECT * FROM job_status WHERE job_name = ?',
                    pollInterval: 30
                },
                alertChannels: [
                    {
                        type: 'Email',
                        endpoint: 'admin@company.com',
                        enabled: true
                    }
                ],
                slaThresholds: {
                    maxExecutionTime: 3600,
                    alertDelayMinutes: 5,
                    criticalDelayMinutes: 15
                }
            },
            {
                jobId: 'backup-nightly',
                name: 'Nightly Database Backup',
                schedule: '0 1 * * *', // 1 AM daily
                expectedDuration: 1800, // 30 minutes
                logPaths: ['/var/log/backup/nightly.log'],
                dataSource: {
                    type: 'SchedulerLogs',
                    connectionString: '/var/log/cron/backup.log',
                    queryPattern: 'backup-nightly',
                    pollInterval: 30
                },
                alertChannels: [
                    {
                        type: 'Email',
                        endpoint: 'admin@company.com',
                        enabled: true
                    }
                ],
                slaThresholds: {
                    maxExecutionTime: 1800,
                    alertDelayMinutes: 10,
                    criticalDelayMinutes: 30
                }
            },
            {
                jobId: 'report-generation',
                name: 'Monthly Report Generation',
                schedule: '0 3 1 * *', // 3 AM on 1st of month
                expectedDuration: 7200, // 2 hours
                logPaths: ['/var/log/reports/monthly.log'],
                dataSource: {
                    type: 'ETLLogs',
                    connectionString: '/var/log/etl/reports.log',
                    queryPattern: 'monthly-report',
                    pollInterval: 60
                },
                alertChannels: [
                    {
                        type: 'Email',
                        endpoint: 'reports@company.com',
                        enabled: true
                    }
                ],
                slaThresholds: {
                    maxExecutionTime: 7200,
                    alertDelayMinutes: 15,
                    criticalDelayMinutes: 60
                }
            }
        ];
        // Add sample configurations
        for (const job of sampleJobs) {
            try {
                await configManager.addJobConfiguration(job);
                logger.info('SampleData', `Added job configuration: ${job.name}`);
            }
            catch (error) {
                // Job might already exist, that's okay
                logger.debug('SampleData', `Job ${job.name} already exists or failed to add`);
            }
        }
        // Add sample execution history
        const now = new Date();
        const sampleExecutions = [
            {
                executionId: 'exec-1',
                jobId: 'etl-daily-sales',
                startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
                endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 3000 * 1000), // 50 minutes later
                status: 'Success',
                exitCode: 0,
                createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 3000 * 1000)
            },
            {
                executionId: 'exec-2',
                jobId: 'backup-nightly',
                startTime: new Date(now.getTime() - 23 * 60 * 60 * 1000), // 23 hours ago
                endTime: new Date(now.getTime() - 23 * 60 * 60 * 1000 + 1500 * 1000), // 25 minutes later
                status: 'Success',
                exitCode: 0,
                createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
                updatedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000 + 1500 * 1000)
            },
            {
                executionId: 'exec-3',
                jobId: 'etl-daily-sales',
                startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
                endTime: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
                status: 'Failed',
                exitCode: 1,
                failureReason: 'Database connection timeout',
                createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
                updatedAt: new Date(now.getTime() - 60 * 60 * 1000)
            },
            {
                executionId: 'exec-4',
                jobId: 'report-generation',
                startTime: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
                status: 'Running',
                createdAt: new Date(now.getTime() - 30 * 60 * 1000),
                updatedAt: new Date(now.getTime() - 30 * 60 * 1000)
            },
            {
                executionId: 'exec-5',
                jobId: 'backup-nightly',
                startTime: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
                status: 'Delayed',
                createdAt: new Date(now.getTime() - 10 * 60 * 1000),
                updatedAt: new Date(now.getTime() - 10 * 60 * 1000)
            }
        ];
        // Add sample executions
        for (const execution of sampleExecutions) {
            try {
                await dataPersistence.saveJobExecution(execution);
                logger.info('SampleData', `Added execution: ${execution.executionId}`);
            }
            catch (error) {
                logger.debug('SampleData', `Execution ${execution.executionId} already exists or failed to add`);
            }
        }
        logger.info('SampleData', 'Sample data added successfully');
    }
    catch (error) {
        logger.warn('SampleData', 'Failed to add some sample data:', error);
    }
}
// Set log level from environment variable
const logLevel = process.env.LOG_LEVEL?.toUpperCase();
if (logLevel && logLevel in logger_1.LogLevel) {
    logger.setLogLevel(logger_1.LogLevel[logLevel]);
}
// Start the application
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map