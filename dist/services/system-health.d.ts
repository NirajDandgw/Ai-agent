import { SystemHealthStatus } from '../types';
import { DatabaseConnection } from '../database/connection';
import { AlertServiceImpl } from './alert-service';
export interface HealthCheckResult {
    component: string;
    status: 'Healthy' | 'Degraded' | 'Unhealthy';
    details?: string;
    lastCheck: Date;
    responseTime?: number;
}
export declare class SystemHealthMonitor {
    private db;
    private logger;
    private alertService;
    private healthCheckInterval;
    private componentStatuses;
    private isMonitoring;
    constructor(db: DatabaseConnection, alertService?: AlertServiceImpl);
    /**
     * Start system health monitoring
     * Requirements: 7.1 - Validate system health every 5 minutes
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop system health monitoring
     */
    stopMonitoring(): Promise<void>;
    /**
     * Perform comprehensive health check
     * Requirements: 7.1, 7.3 - Validate system health and data source connections
     */
    performHealthCheck(): Promise<HealthCheckResult[]>;
    /**
     * Check database health and connectivity
     * Requirements: 7.3 - Monitor data source connections
     */
    private checkDatabaseHealth;
    /**
     * Check system resource utilization
     */
    private checkSystemResources;
    /**
     * Check available disk space
     */
    private checkDiskSpace;
    /**
     * Check memory usage patterns
     */
    private checkMemoryUsage;
    /**
     * Check data source connections
     * Requirements: 7.3 - Monitor data source connection failures
     */
    private checkDataSourceConnections;
    /**
     * Test individual data source connection
     */
    private testDataSourceConnection;
    /**
     * Check service dependencies
     */
    private checkServiceDependencies;
    /**
     * Determine overall system health
     */
    private determineOverallHealth;
    /**
     * Process health alerts
     * Requirements: 7.2 - Send system health alerts
     */
    private processHealthAlerts;
    /**
     * Send system health alert
     */
    private sendSystemHealthAlert;
    /**
     * Update component status in memory and database
     */
    private updateComponentStatus;
    /**
     * Store health status in database
     * Requirements: 7.4 - Log all monitoring activities
     */
    private storeHealthStatus;
    /**
     * Get current system health status
     */
    getSystemHealth(): Promise<SystemHealthStatus[]>;
    /**
     * Get health status for a specific component
     */
    getComponentHealth(component: string): Promise<SystemHealthStatus | undefined>;
    /**
     * Initialize the system health monitor
     */
    initialize(): Promise<void>;
    /**
     * Load health statuses from database
     */
    private loadHealthStatusesFromDatabase;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=system-health.d.ts.map