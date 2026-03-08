// Simple Dashboard Service implementation for demo

import { DashboardService, JobStatusSummary, SystemMetrics } from '../interfaces/services';
import { JobExecution, JobStatus } from '../types';
import { DatabaseConnection } from '../database/connection';
import { JobMonitorServiceImpl } from './job-monitor';
import { DataPersistenceServiceImpl } from './data-persistence';
import { Logger } from '../utils/logger';

export class DashboardServiceImpl implements DashboardService {
  private db: DatabaseConnection;
  private jobMonitor: JobMonitorServiceImpl;
  private dataPersistence: DataPersistenceServiceImpl;
  private logger: Logger;

  constructor(
    db: DatabaseConnection, 
    jobMonitor: JobMonitorServiceImpl, 
    alertService: any, 
    dataPersistence: DataPersistenceServiceImpl
  ) {
    this.db = db;
    this.jobMonitor = jobMonitor;
    this.dataPersistence = dataPersistence;
    this.logger = Logger.getInstance();
  }

  async getJobStatusSummary(): Promise<JobStatusSummary> {
    try {
      const jobStatuses = await this.jobMonitor.getAllJobStatuses();
      
      return {
        totalJobs: jobStatuses.length,
        runningJobs: jobStatuses.filter(j => j.status === 'Running').length,
        successfulJobs: jobStatuses.filter(j => j.status === 'Success').length,
        failedJobs: jobStatuses.filter(j => j.status === 'Failed').length,
        delayedJobs: jobStatuses.filter(j => j.status === 'Delayed').length,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('DashboardService', 'Failed to get job status summary:', error);
      throw error;
    }
  }

  async getJobExecutionHistory(jobId?: string, days?: number): Promise<JobExecution[]> {
    try {
      if (jobId) {
        return await this.dataPersistence.getJobExecutionHistory(jobId, days);
      } else {
        // Get all recent executions
        const filters = {
          startDate: new Date(Date.now() - (days || 7) * 24 * 60 * 60 * 1000),
          limit: 50
        };
        return await this.dataPersistence.queryExecutions(filters);
      }
    } catch (error) {
      this.logger.error('DashboardService', 'Failed to get execution history:', error);
      throw error;
    }
  }

  async getFilteredJobs(status?: string): Promise<JobStatus[]> {
    try {
      const allJobs = await this.jobMonitor.getAllJobStatuses();
      
      if (status) {
        return allJobs.filter(job => job.status.toLowerCase() === status.toLowerCase());
      }
      
      return allJobs;
    } catch (error) {
      this.logger.error('DashboardService', 'Failed to get filtered jobs:', error);
      throw error;
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const jobStatuses = await this.jobMonitor.getAllJobStatuses();
      const recentExecutions = await this.getJobExecutionHistory(undefined, 7);
      
      // Calculate average execution time
      const completedExecutions = recentExecutions.filter(e => e.endTime && e.startTime);
      const avgExecutionTime = completedExecutions.length > 0 
        ? completedExecutions.reduce((sum, exec) => {
            const duration = (exec.endTime!.getTime() - exec.startTime.getTime()) / 1000 / 60; // minutes
            return sum + duration;
          }, 0) / completedExecutions.length
        : 0;

      return {
        uptime: process.uptime(),
        totalExecutions: recentExecutions.length,
        alertsSent: 5, // Mock value
        averageExecutionTime: Math.round(avgExecutionTime),
        systemHealth: [
          {
            component: 'JobMonitor',
            status: 'Healthy',
            lastCheck: new Date(),
            details: 'All systems operational'
          }
        ]
      };
    } catch (error) {
      this.logger.error('DashboardService', 'Failed to get system metrics:', error);
      throw error;
    }
  }
}