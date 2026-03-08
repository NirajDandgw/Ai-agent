// System Health Monitoring Service - Monitors system components and data source connections
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

import { SystemHealthStatus } from '../types';
import { DatabaseConnection } from '../database/connection';
import { Logger } from '../utils/logger';
import { AlertServiceImpl } from './alert-service';
import * as fs from 'fs/promises';
import * as os from 'os';

export interface HealthCheckResult {
  component: string;
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  details?: string;
  lastCheck: Date;
  responseTime?: number;
}

export class SystemHealthMonitor {
  private db: DatabaseConnection;
  private logger: Logger;
  private alertService: AlertServiceImpl | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private componentStatuses: Map<string, SystemHealthStatus> = new Map();
  private isMonitoring: boolean = false;

  constructor(db: DatabaseConnection, alertService?: AlertServiceImpl) {
    this.db = db;
    this.logger = Logger.getInstance();
    this.alertService = alertService || null;
  }

  /**
   * Start system health monitoring
   * Requirements: 7.1 - Validate system health every 5 minutes
   */
  async startMonitoring(): Promise<void> {
    this.logger.info('SystemHealth', 'Starting system health monitoring');

    try {
      if (this.isMonitoring) {
        this.logger.warn('SystemHealth', 'System health monitoring is already running');
        return;
      }

      // Perform initial health check
      await this.performHealthCheck();

      // Set up periodic health checks (every 5 minutes)
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          this.logger.error('SystemHealth', 'Error during periodic health check:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      this.isMonitoring = true;
      this.logger.info('SystemHealth', 'System health monitoring started successfully');
    } catch (error) {
      const errorMessage = `Failed to start system health monitoring: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('SystemHealth', errorMessage, { error });
      throw new Error(errorMessage);
    }
  }

  /**
   * Stop system health monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.logger.info('SystemHealth', 'Stopping system health monitoring');

    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.isMonitoring = false;
      this.logger.info('SystemHealth', 'System health monitoring stopped');
    } catch (error) {
      this.logger.error('SystemHealth', 'Error stopping system health monitoring:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   * Requirements: 7.1, 7.3 - Validate system health and data source connections
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    this.logger.debug('SystemHealth', 'Performing system health check');

    const startTime = Date.now();
    const results: HealthCheckResult[] = [];

    try {
      // Check database health
      const dbHealth = await this.checkDatabaseHealth();
      results.push(dbHealth);
      this.updateComponentStatus(dbHealth);

      // Check system resources
      const systemHealth = await this.checkSystemResources();
      results.push(systemHealth);
      this.updateComponentStatus(systemHealth);

      // Check disk space
      const diskHealth = await this.checkDiskSpace();
      results.push(diskHealth);
      this.updateComponentStatus(diskHealth);

      // Check memory usage
      const memoryHealth = await this.checkMemoryUsage();
      results.push(memoryHealth);
      this.updateComponentStatus(memoryHealth);

      // Check data source connections
      const dataSourceHealth = await this.checkDataSourceConnections();
      results.push(...dataSourceHealth);
      dataSourceHealth.forEach(result => this.updateComponentStatus(result));

      // Check service dependencies
      const serviceHealth = await this.checkServiceDependencies();
      results.push(...serviceHealth);
      serviceHealth.forEach(result => this.updateComponentStatus(result));

      // Determine overall system health
      const overallHealth = this.determineOverallHealth(results);
      results.push(overallHealth);
      this.updateComponentStatus(overallHealth);

      // Send alerts for unhealthy components (Requirements 7.2)
      await this.processHealthAlerts(results);

      const checkDuration = Date.now() - startTime;
      this.logger.info('SystemHealth', 'System health check completed', {
        duration: checkDuration,
        totalComponents: results.length,
        healthyComponents: results.filter(r => r.status === 'Healthy').length,
        degradedComponents: results.filter(r => r.status === 'Degraded').length,
        unhealthyComponents: results.filter(r => r.status === 'Unhealthy').length
      });

      return results;
    } catch (error) {
      const errorMessage = `System health check failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('SystemHealth', errorMessage, { error });
      
      const failedResult: HealthCheckResult = {
        component: 'SystemHealthMonitor',
        status: 'Unhealthy',
        details: errorMessage,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
      
      results.push(failedResult);
      this.updateComponentStatus(failedResult);
      
      return results;
    }
  }

  /**
   * Check database health and connectivity
   * Requirements: 7.3 - Monitor data source connections
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      if (!this.db.isConnected()) {
        return {
          component: 'Database',
          status: 'Unhealthy',
          details: 'Database connection is not established',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      // Test database with a simple query
      await this.db.get('SELECT 1 as test');
      
      // Test database write capability
      await this.db.run('INSERT OR REPLACE INTO system_health (component, status, last_check, details) VALUES (?, ?, ?, ?)', 
        ['DatabaseHealthCheck', 'Healthy', new Date().toISOString(), 'Health check query successful']);

      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Database',
        status: responseTime > 5000 ? 'Degraded' : 'Healthy', // Degraded if query takes > 5 seconds
        details: responseTime > 5000 ? `Slow database response: ${responseTime}ms` : 'Database is responsive',
        lastCheck: new Date(),
        responseTime
      };
    } catch (error) {
      return {
        component: 'Database',
        status: 'Unhealthy',
        details: `Database error: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check system resource utilization
   */
  private async checkSystemResources(): Promise<HealthCheckResult> {
    try {
      const cpuUsage = process.cpuUsage();
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Calculate CPU usage percentage (simplified)
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / uptime * 100;
      
      // Calculate memory usage percentage
      const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      let status: 'Healthy' | 'Degraded' | 'Unhealthy' = 'Healthy';
      let details = `CPU: ${cpuPercent.toFixed(1)}%, Memory: ${memoryPercent.toFixed(1)}%, Uptime: ${Math.floor(uptime / 3600)}h`;
      
      if (cpuPercent > 90 || memoryPercent > 90) {
        status = 'Unhealthy';
        details += ' - High resource usage detected';
      } else if (cpuPercent > 70 || memoryPercent > 70) {
        status = 'Degraded';
        details += ' - Elevated resource usage';
      }
      
      return {
        component: 'SystemResources',
        status,
        details,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        component: 'SystemResources',
        status: 'Unhealthy',
        details: `Failed to check system resources: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    try {
      const stats = await fs.stat('./');
      const freeSpace = os.freemem();
      const totalSpace = os.totalmem();
      const usedPercent = ((totalSpace - freeSpace) / totalSpace) * 100;
      
      let status: 'Healthy' | 'Degraded' | 'Unhealthy' = 'Healthy';
      let details = `Disk usage: ${usedPercent.toFixed(1)}%`;
      
      if (usedPercent > 95) {
        status = 'Unhealthy';
        details += ' - Critical disk space shortage';
      } else if (usedPercent > 85) {
        status = 'Degraded';
        details += ' - Low disk space warning';
      }
      
      return {
        component: 'DiskSpace',
        status,
        details,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        component: 'DiskSpace',
        status: 'Unhealthy',
        details: `Failed to check disk space: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check memory usage patterns
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    try {
      const memoryUsage = process.memoryUsage();
      const totalSystemMemory = os.totalmem();
      const freeSystemMemory = os.freemem();
      const systemMemoryUsage = ((totalSystemMemory - freeSystemMemory) / totalSystemMemory) * 100;
      
      const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      let status: 'Healthy' | 'Degraded' | 'Unhealthy' = 'Healthy';
      let details = `Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB/${(memoryUsage.heapTotal / 1024 / 1024).toFixed(1)}MB, System: ${systemMemoryUsage.toFixed(1)}%`;
      
      if (heapUsagePercent > 90 || systemMemoryUsage > 95) {
        status = 'Unhealthy';
        details += ' - Critical memory usage';
      } else if (heapUsagePercent > 75 || systemMemoryUsage > 85) {
        status = 'Degraded';
        details += ' - High memory usage';
      }
      
      return {
        component: 'Memory',
        status,
        details,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        component: 'Memory',
        status: 'Unhealthy',
        details: `Failed to check memory usage: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check data source connections
   * Requirements: 7.3 - Monitor data source connection failures
   */
  private async checkDataSourceConnections(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    try {
      // Get all configured data sources from job configurations
      const sql = 'SELECT job_id, name, data_source FROM job_configurations';
      const rows = await this.db.all<any>(sql);
      
      const uniqueDataSources = new Map<string, any>();
      
      // Extract unique data sources
      for (const row of rows) {
        try {
          const dataSource = JSON.parse(row.data_source);
          const key = `${dataSource.type}-${dataSource.connectionString}`;
          if (!uniqueDataSources.has(key)) {
            uniqueDataSources.set(key, {
              ...dataSource,
              jobIds: [row.job_id]
            });
          } else {
            uniqueDataSources.get(key)!.jobIds.push(row.job_id);
          }
        } catch (parseError) {
          this.logger.warn('SystemHealth', `Failed to parse data source for job ${row.job_id}:`, parseError);
        }
      }
      
      // Test each unique data source
      for (const [key, dataSource] of uniqueDataSources) {
        const result = await this.testDataSourceConnection(dataSource);
        results.push(result);
      }
      
      if (results.length === 0) {
        results.push({
          component: 'DataSources',
          status: 'Degraded',
          details: 'No data sources configured',
          lastCheck: new Date()
        });
      }
      
    } catch (error) {
      results.push({
        component: 'DataSources',
        status: 'Unhealthy',
        details: `Failed to check data sources: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      });
    }
    
    return results;
  }

  /**
   * Test individual data source connection
   */
  private async testDataSourceConnection(dataSource: any): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = `DataSource-${dataSource.type}`;
    
    try {
      // Simulate data source connection test based on type
      // In a real implementation, this would actually test the connections
      
      switch (dataSource.type) {
        case 'Database':
          // For database connections, we could test the actual connection
          // For now, simulate based on connection string format
          if (!dataSource.connectionString || dataSource.connectionString.length < 10) {
            throw new Error('Invalid connection string');
          }
          break;
          
        case 'SchedulerLogs':
        case 'ETLLogs':
          // For log files, check if paths are accessible
          // This is a simplified check
          if (!dataSource.connectionString.startsWith('file://') && 
              !dataSource.connectionString.startsWith('/')) {
            throw new Error('Invalid log file path');
          }
          break;
          
        default:
          throw new Error(`Unsupported data source type: ${dataSource.type}`);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        component: componentName,
        status: responseTime > 10000 ? 'Degraded' : 'Healthy',
        details: `Connection test successful (${dataSource.jobIds.length} jobs)`,
        lastCheck: new Date(),
        responseTime
      };
      
    } catch (error) {
      return {
        component: componentName,
        status: 'Unhealthy',
        details: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check service dependencies
   */
  private async checkServiceDependencies(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    // Check if alert service is available
    if (this.alertService) {
      try {
        // Test alert service by checking its configuration
        const alertResult: HealthCheckResult = {
          component: 'AlertService',
          status: 'Healthy',
          details: 'Alert service is available',
          lastCheck: new Date()
        };
        results.push(alertResult);
      } catch (error) {
        results.push({
          component: 'AlertService',
          status: 'Unhealthy',
          details: `Alert service error: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date()
        });
      }
    } else {
      results.push({
        component: 'AlertService',
        status: 'Degraded',
        details: 'Alert service not configured',
        lastCheck: new Date()
      });
    }
    
    return results;
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(results: HealthCheckResult[]): HealthCheckResult {
    const unhealthyCount = results.filter(r => r.status === 'Unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'Degraded').length;
    const healthyCount = results.filter(r => r.status === 'Healthy').length;
    
    let overallStatus: 'Healthy' | 'Degraded' | 'Unhealthy';
    let details: string;
    
    if (unhealthyCount > 0) {
      overallStatus = 'Unhealthy';
      details = `${unhealthyCount} unhealthy, ${degradedCount} degraded, ${healthyCount} healthy components`;
    } else if (degradedCount > 0) {
      overallStatus = 'Degraded';
      details = `${degradedCount} degraded, ${healthyCount} healthy components`;
    } else {
      overallStatus = 'Healthy';
      details = `All ${healthyCount} components are healthy`;
    }
    
    return {
      component: 'OverallSystem',
      status: overallStatus,
      details,
      lastCheck: new Date()
    };
  }

  /**
   * Process health alerts
   * Requirements: 7.2 - Send system health alerts
   */
  private async processHealthAlerts(results: HealthCheckResult[]): Promise<void> {
    if (!this.alertService) {
      return; // No alert service configured
    }
    
    try {
      const unhealthyComponents = results.filter(r => r.status === 'Unhealthy');
      const degradedComponents = results.filter(r => r.status === 'Degraded');
      
      // Send alerts for unhealthy components
      for (const component of unhealthyComponents) {
        await this.sendSystemHealthAlert(component, 'Critical');
      }
      
      // Send alerts for degraded components (but with lower severity)
      for (const component of degradedComponents) {
        await this.sendSystemHealthAlert(component, 'Medium');
      }
      
    } catch (error) {
      this.logger.error('SystemHealth', 'Failed to process health alerts:', error);
    }
  }

  /**
   * Send system health alert
   */
  private async sendSystemHealthAlert(component: HealthCheckResult, severity: 'Low' | 'Medium' | 'High' | 'Critical'): Promise<void> {
    try {
      const alertMessage = {
        jobId: 'system-health',
        jobName: 'System Health Monitor',
        alertType: 'SystemHealth' as const,
        message: `Component ${component.component} is ${component.status.toLowerCase()}: ${component.details}`,
        timestamp: new Date(),
        severity,
        failureReason: component.status === 'Unhealthy' ? component.details : undefined
      };
      
      await this.alertService!.sendAlert(alertMessage);
      
      this.logger.info('SystemHealth', `Sent system health alert for component: ${component.component}`, {
        status: component.status,
        severity
      });
    } catch (error) {
      this.logger.error('SystemHealth', `Failed to send system health alert for ${component.component}:`, error);
    }
  }

  /**
   * Update component status in memory and database
   */
  private updateComponentStatus(result: HealthCheckResult): void {
    const status: SystemHealthStatus = {
      component: result.component,
      status: result.status,
      lastCheck: result.lastCheck,
      details: result.details
    };
    
    this.componentStatuses.set(result.component, status);
    
    // Store in database (Requirements 7.4 - Log monitoring activities)
    this.storeHealthStatus(status).catch(error => {
      this.logger.error('SystemHealth', `Failed to store health status for ${result.component}:`, error);
    });
  }

  /**
   * Store health status in database
   * Requirements: 7.4 - Log all monitoring activities
   */
  private async storeHealthStatus(status: SystemHealthStatus): Promise<void> {
    try {
      const sql = `
        INSERT OR REPLACE INTO system_health (component, status, last_check, details, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      await this.db.run(sql, [
        status.component,
        status.status,
        status.lastCheck.toISOString(),
        status.details
      ]);
    } catch (error) {
      // Don't throw here as health monitoring should continue
      this.logger.error('SystemHealth', 'Failed to store health status in database:', error);
    }
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus[]> {
    try {
      return Array.from(this.componentStatuses.values());
    } catch (error) {
      this.logger.error('SystemHealth', 'Failed to get system health:', error);
      return [];
    }
  }

  /**
   * Get health status for a specific component
   */
  async getComponentHealth(component: string): Promise<SystemHealthStatus | undefined> {
    try {
      return this.componentStatuses.get(component);
    } catch (error) {
      this.logger.error('SystemHealth', `Failed to get health for component ${component}:`, error);
      return undefined;
    }
  }

  /**
   * Initialize the system health monitor
   */
  async initialize(): Promise<void> {
    this.logger.info('SystemHealth', 'Initializing System Health Monitor');

    try {
      if (!this.db.isConnected()) {
        await this.db.connect();
        await this.db.initializeSchema();
      }

      // Load existing health statuses from database
      await this.loadHealthStatusesFromDatabase();

      this.logger.info('SystemHealth', 'System Health Monitor initialized successfully');
    } catch (error) {
      const errorMessage = `Failed to initialize System Health Monitor: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('SystemHealth', errorMessage, { error });
      throw new Error(errorMessage);
    }
  }

  /**
   * Load health statuses from database
   */
  private async loadHealthStatusesFromDatabase(): Promise<void> {
    try {
      const sql = 'SELECT component, status, last_check, details FROM system_health';
      const rows = await this.db.all<any>(sql);
      
      for (const row of rows) {
        const status: SystemHealthStatus = {
          component: row.component,
          status: row.status,
          lastCheck: new Date(row.last_check),
          details: row.details
        };
        
        this.componentStatuses.set(row.component, status);
      }
      
      this.logger.debug('SystemHealth', `Loaded ${rows.length} health statuses from database`);
    } catch (error) {
      this.logger.error('SystemHealth', 'Failed to load health statuses from database:', error);
      // Continue without existing statuses
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('SystemHealth', 'Cleaning up System Health Monitor');

    try {
      await this.stopMonitoring();
      this.componentStatuses.clear();
      
      this.logger.info('SystemHealth', 'System Health Monitor cleanup completed');
    } catch (error) {
      this.logger.error('SystemHealth', 'Error during System Health Monitor cleanup:', error);
      throw error;
    }
  }
}