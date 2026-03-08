// Sample data loader for demonstration purposes

import * as fs from 'fs';
import * as path from 'path';
import { JobConfiguration, JobExecution } from '../types';
import { ConfigurationManagerService } from './configuration-manager';
import { Logger } from '../utils/logger';

export interface SampleData {
  jobConfigurations: JobConfiguration[];
  jobExecutions: JobExecution[];
}

export class SampleDataLoader {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  async loadSampleData(configManager: ConfigurationManagerService): Promise<void> {
    try {
      const sampleDataPath = path.join(process.cwd(), 'data', 'SampleData.json');
      
      if (!fs.existsSync(sampleDataPath)) {
        this.logger.warn('SampleDataLoader', 'Sample data file not found, skipping data load');
        return;
      }

      const sampleDataContent = fs.readFileSync(sampleDataPath, 'utf8');
      const sampleData: SampleData = JSON.parse(sampleDataContent);

      this.logger.info('SampleDataLoader', `Loading ${sampleData.jobConfigurations.length} job configurations`);

      // Load job configurations
      for (const config of sampleData.jobConfigurations) {
        try {
          await configManager.addJobConfiguration(config);
          this.logger.info('SampleDataLoader', `Loaded job configuration: ${config.jobId}`);
        } catch (error) {
          if (error instanceof Error && error.message.includes('already exists')) {
            this.logger.debug('SampleDataLoader', `Job configuration ${config.jobId} already exists, skipping`);
          } else {
            this.logger.error('SampleDataLoader', `Failed to load job configuration ${config.jobId}:`, error);
          }
        }
      }

      this.logger.info('SampleDataLoader', 'Sample data loading completed');
    } catch (error) {
      this.logger.error('SampleDataLoader', 'Failed to load sample data:', error);
      throw error;
    }
  }

  getCurrentJobStatuses(): any[] {
    // Mock current job statuses for demonstration
    return [
      {
        jobId: 'daily-sales-etl',
        name: 'Daily Sales ETL',
        status: 'Running',
        startTime: new Date('2026-01-23T14:30:00Z'),
        lastHeartbeat: new Date(),
        progress: 75
      },
      {
        jobId: 'inventory-sync',
        name: 'Inventory Sync Job',
        status: 'Failed',
        startTime: new Date('2026-01-23T04:00:00Z'),
        endTime: new Date('2026-01-23T04:35:00Z'),
        lastHeartbeat: new Date('2026-01-23T04:35:00Z'),
        failureReason: 'Database connection timeout'
      },
      {
        jobId: 'customer-reports',
        name: 'Customer Reports Generation',
        status: 'Success',
        startTime: new Date('2026-01-20T06:00:00Z'),
        endTime: new Date('2026-01-20T07:15:00Z'),
        lastHeartbeat: new Date('2026-01-20T07:15:00Z')
      }
    ];
  }

  getRecentExecutions(): any[] {
    return [
      {
        executionId: 'exec-001',
        jobId: 'daily-sales-etl',
        jobName: 'Daily Sales ETL',
        startTime: new Date('2026-01-23T02:00:00Z'),
        endTime: new Date('2026-01-23T02:45:00Z'),
        status: 'Success',
        duration: 45
      },
      {
        executionId: 'exec-002',
        jobId: 'inventory-sync',
        jobName: 'Inventory Sync Job',
        startTime: new Date('2026-01-23T04:00:00Z'),
        endTime: new Date('2026-01-23T04:35:00Z'),
        status: 'Failed',
        duration: 35,
        failureReason: 'Database connection timeout'
      },
      {
        executionId: 'exec-003',
        jobId: 'customer-reports',
        jobName: 'Customer Reports Generation',
        startTime: new Date('2026-01-20T06:00:00Z'),
        endTime: new Date('2026-01-20T07:15:00Z'),
        status: 'Success',
        duration: 75
      },
      {
        executionId: 'exec-004',
        jobId: 'daily-sales-etl',
        jobName: 'Daily Sales ETL',
        startTime: new Date('2026-01-23T14:30:00Z'),
        status: 'Running',
        duration: null
      }
    ];
  }
}