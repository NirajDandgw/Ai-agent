// Basic setup tests to verify project structure

import { Logger } from '../utils/logger';
import { ConfigurationValidator, ValidationError } from '../utils/validation';
import { DatabaseConnection } from '../database/connection';
import { JobConfiguration } from '../types';

describe('Project Setup', () => {
  test('Logger should be initialized', () => {
    const logger = Logger.getInstance();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  test('Database connection should be creatable', () => {
    const db = new DatabaseConnection(':memory:');
    expect(db).toBeDefined();
    expect(db.isConnected()).toBe(false);
  });

  test('Configuration validator should validate job config', () => {
    const validConfig: JobConfiguration = {
      jobId: 'test-job-1',
      name: 'Test Job',
      schedule: '0 2 * * *',
      expectedDuration: 60,
      logPaths: ['/var/log/test.log'],
      dataSource: {
        type: 'SchedulerLogs',
        connectionString: '/var/log/scheduler.log',
        queryPattern: 'job-{jobId}',
        pollInterval: 30
      },
      alertChannels: [{
        type: 'Email',
        endpoint: 'admin@example.com',
        enabled: true
      }],
      slaThresholds: {
        maxExecutionTime: 120,
        alertDelayMinutes: 5,
        criticalDelayMinutes: 15
      }
    };

    const result = ConfigurationValidator.validateJobConfiguration(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Configuration validator should reject invalid config', () => {
    const invalidConfig = {
      jobId: '',
      name: 'Test Job',
      schedule: 'invalid-cron',
      expectedDuration: -1,
      logPaths: [],
      dataSource: {
        type: 'InvalidType',
        connectionString: '',
        queryPattern: '',
        pollInterval: 0
      },
      alertChannels: [],
      slaThresholds: {
        maxExecutionTime: -1,
        alertDelayMinutes: -1,
        criticalDelayMinutes: -1
      }
    } as any;

    const result = ConfigurationValidator.validateJobConfiguration(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBeInstanceOf(ValidationError);
  });

  test('Configuration validator strict mode should throw on invalid config', () => {
    const invalidConfig = {
      jobId: '',
      name: 'Test Job'
    } as any;

    expect(() => ConfigurationValidator.validateJobConfigurationStrict(invalidConfig)).toThrow(ValidationError);
  });
});