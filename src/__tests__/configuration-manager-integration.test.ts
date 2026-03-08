// Integration tests for ConfigurationManager service
// Tests the complete CRUD operations and database persistence

import { ConfigurationManagerService } from '../services/configuration-manager';
import { DatabaseConnection } from '../database/connection';
import { JobConfiguration } from '../types';
import * as fs from 'fs';

describe('ConfigurationManager Integration Tests', () => {
  let configManager: ConfigurationManagerService;
  let db: DatabaseConnection;
  const testDbPath = './data/test_integration.db';

  const sampleConfig: JobConfiguration = {
    jobId: 'integration-test-job',
    name: 'Integration Test Job',
    schedule: '0 3 * * *',
    expectedDuration: 45,
    logPaths: ['/var/log/integration.log', '/var/log/integration-error.log'],
    dataSource: {
      type: 'Database',
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      queryPattern: 'SELECT * FROM jobs WHERE job_id = $1',
      pollInterval: 60,
      credentials: {
        username: 'testuser',
        password: 'testpass'
      }
    },
    alertChannels: [
      {
        type: 'Email',
        endpoint: 'admin@test.com',
        enabled: true
      },
      {
        type: 'Teams',
        endpoint: 'https://outlook.office.com/webhook/test123',
        enabled: true,
        credentials: {
          token: 'teams-webhook-token'
        }
      }
    ],
    slaThresholds: {
      maxExecutionTime: 90,
      alertDelayMinutes: 10,
      criticalDelayMinutes: 30
    }
  };

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create fresh database connection and configuration manager
    db = new DatabaseConnection(testDbPath);
    configManager = new ConfigurationManagerService(db);
    await configManager.initialize();
  });

  afterEach(async () => {
    await configManager.cleanup();
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Complete CRUD Operations', () => {
    it('should perform complete CRUD lifecycle successfully', async () => {
      // CREATE: Add new configuration
      await configManager.addJobConfiguration(sampleConfig);
      
      // READ: Retrieve the configuration
      const retrieved = await configManager.getJobConfiguration(sampleConfig.jobId);
      expect(retrieved).toEqual(sampleConfig);
      
      // UPDATE: Modify the configuration
      const updates = {
        name: 'Updated Integration Test Job',
        expectedDuration: 60,
        alertChannels: [{
          type: 'Email' as const,
          endpoint: 'updated-admin@test.com',
          enabled: true
        }]
      };
      
      await configManager.updateJobConfiguration(sampleConfig.jobId, updates);
      
      const updatedConfig = await configManager.getJobConfiguration(sampleConfig.jobId);
      expect(updatedConfig.name).toBe(updates.name);
      expect(updatedConfig.expectedDuration).toBe(updates.expectedDuration);
      expect(updatedConfig.alertChannels).toEqual(updates.alertChannels);
      expect(updatedConfig.schedule).toBe(sampleConfig.schedule); // Should remain unchanged
      
      // DELETE: Remove the configuration
      await configManager.removeJobConfiguration(sampleConfig.jobId);
      
      await expect(configManager.getJobConfiguration(sampleConfig.jobId))
        .rejects.toThrow(`Job configuration with ID '${sampleConfig.jobId}' not found`);
    });

    it('should handle multiple configurations correctly', async () => {
      const config1 = { ...sampleConfig, jobId: 'job-1', name: 'Job 1' };
      const config2 = { ...sampleConfig, jobId: 'job-2', name: 'Job 2' };
      const config3 = { ...sampleConfig, jobId: 'job-3', name: 'Job 3' };

      // Add multiple configurations
      await configManager.addJobConfiguration(config1);
      await configManager.addJobConfiguration(config2);
      await configManager.addJobConfiguration(config3);

      // Retrieve all configurations
      const allConfigs = await configManager.getAllJobConfigurations();
      expect(allConfigs).toHaveLength(3);
      
      // Should be ordered by name
      expect(allConfigs[0].name).toBe('Job 1');
      expect(allConfigs[1].name).toBe('Job 2');
      expect(allConfigs[2].name).toBe('Job 3');

      // Update one configuration
      await configManager.updateJobConfiguration('job-2', { name: 'Updated Job 2' });
      
      const updatedConfig = await configManager.getJobConfiguration('job-2');
      expect(updatedConfig.name).toBe('Updated Job 2');

      // Remove one configuration
      await configManager.removeJobConfiguration('job-1');
      
      const remainingConfigs = await configManager.getAllJobConfigurations();
      expect(remainingConfigs).toHaveLength(2);
      expect(remainingConfigs.find(c => c.jobId === 'job-1')).toBeUndefined();
    });
  });

  describe('Data Persistence Verification', () => {
    it('should persist configurations across system restarts (Requirement 6.5)', async () => {
      // Add configuration
      await configManager.addJobConfiguration(sampleConfig);
      
      // Simulate system restart by creating new instances
      await configManager.cleanup();
      
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      // Verify configuration persisted
      const persistedConfig = await newConfigManager.getJobConfiguration(sampleConfig.jobId);
      expect(persistedConfig).toEqual(sampleConfig);
      
      // Verify complex nested objects are preserved
      expect(persistedConfig.dataSource.credentials).toEqual(sampleConfig.dataSource.credentials);
      expect(persistedConfig.alertChannels[1].credentials).toEqual(sampleConfig.alertChannels[1].credentials);
      
      await newConfigManager.cleanup();
    });

    it('should persist updates across system restarts', async () => {
      // Add and update configuration
      await configManager.addJobConfiguration(sampleConfig);
      
      const updates = {
        name: 'Persistent Update Test',
        expectedDuration: 120,
        dataSource: {
          ...sampleConfig.dataSource,
          pollInterval: 120,
          credentials: {
            username: 'updated-user',
            password: 'updated-pass',
            apiKey: 'new-api-key'
          }
        }
      };
      
      await configManager.updateJobConfiguration(sampleConfig.jobId, updates);
      
      // Simulate system restart
      await configManager.cleanup();
      
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      // Verify updates persisted
      const persistedConfig = await newConfigManager.getJobConfiguration(sampleConfig.jobId);
      expect(persistedConfig.name).toBe(updates.name);
      expect(persistedConfig.expectedDuration).toBe(updates.expectedDuration);
      expect(persistedConfig.dataSource.pollInterval).toBe(updates.dataSource.pollInterval);
      expect(persistedConfig.dataSource.credentials).toEqual(updates.dataSource.credentials);
      
      await newConfigManager.cleanup();
    });

    it('should persist removals across system restarts', async () => {
      // Add multiple configurations
      const config1 = { ...sampleConfig, jobId: 'persist-1', name: 'Persist 1' };
      const config2 = { ...sampleConfig, jobId: 'persist-2', name: 'Persist 2' };
      
      await configManager.addJobConfiguration(config1);
      await configManager.addJobConfiguration(config2);
      
      // Remove one configuration
      await configManager.removeJobConfiguration('persist-1');
      
      // Simulate system restart
      await configManager.cleanup();
      
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      // Verify removal persisted
      await expect(newConfigManager.getJobConfiguration('persist-1'))
        .rejects.toThrow(`Job configuration with ID 'persist-1' not found`);
      
      const remainingConfig = await newConfigManager.getJobConfiguration('persist-2');
      expect(remainingConfig.name).toBe('Persist 2');
      
      await newConfigManager.cleanup();
    });
  });

  describe('Requirements Validation', () => {
    it('should support adding configurations without system restart (Requirement 6.3)', async () => {
      // System is already running (initialized in beforeEach)
      
      // Add configuration while system is running
      await configManager.addJobConfiguration(sampleConfig);
      
      // Verify it's immediately available without restart
      const retrieved = await configManager.getJobConfiguration(sampleConfig.jobId);
      expect(retrieved).toEqual(sampleConfig);
      
      // Add another configuration
      const config2 = { ...sampleConfig, jobId: 'runtime-add', name: 'Runtime Add' };
      await configManager.addJobConfiguration(config2);
      
      // Verify both are available
      const allConfigs = await configManager.getAllJobConfigurations();
      expect(allConfigs).toHaveLength(2);
    });

    it('should support modifying configurations without system restart (Requirement 6.4)', async () => {
      // Add initial configuration
      await configManager.addJobConfiguration(sampleConfig);
      
      // Modify configuration while system is running
      const updates = {
        name: 'Runtime Modified Job',
        expectedDuration: 75,
        logPaths: ['/var/log/modified.log']
      };
      
      await configManager.updateJobConfiguration(sampleConfig.jobId, updates);
      
      // Verify changes are immediately available without restart
      const modifiedConfig = await configManager.getJobConfiguration(sampleConfig.jobId);
      expect(modifiedConfig.name).toBe(updates.name);
      expect(modifiedConfig.expectedDuration).toBe(updates.expectedDuration);
      expect(modifiedConfig.logPaths).toEqual(updates.logPaths);
    });

    it('should validate all configuration parameters (Requirement 6.2)', async () => {
      // Test various validation scenarios
      const invalidConfigs = [
        { ...sampleConfig, jobId: '' }, // Empty jobId
        { ...sampleConfig, name: '' }, // Empty name
        { ...sampleConfig, expectedDuration: -10 }, // Negative duration
        { ...sampleConfig, logPaths: [] }, // Empty log paths
        { ...sampleConfig, schedule: 'invalid-cron' }, // Invalid cron
        { 
          ...sampleConfig, 
          dataSource: { 
            ...sampleConfig.dataSource, 
            pollInterval: -5 
          } 
        }, // Invalid poll interval
        {
          ...sampleConfig,
          slaThresholds: {
            ...sampleConfig.slaThresholds,
            maxExecutionTime: -1
          }
        } // Invalid SLA threshold
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(configManager.addJobConfiguration(invalidConfig))
          .rejects.toThrow('Configuration validation failed');
      }
    });
  });

  describe('Complex Data Handling', () => {
    it('should handle complex nested configurations correctly', async () => {
      const complexConfig: JobConfiguration = {
        ...sampleConfig,
        jobId: 'complex-config',
        dataSource: {
          type: 'ETLLogs',
          connectionString: 'file:///complex/path/with spaces/logs.txt',
          queryPattern: 'grep -E "^\\d{4}-\\d{2}-\\d{2}.*ERROR.*job_id=complex-config" /var/log/*.log',
          pollInterval: 45,
          credentials: {
            username: 'complex-user',
            password: 'complex!@#$%^&*()password',
            apiKey: 'ak-1234567890abcdef',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
          }
        },
        alertChannels: [
          {
            type: 'Email',
            endpoint: 'complex+test@example.com',
            enabled: true,
            credentials: {
              username: 'smtp-user',
              password: 'smtp-pass'
            }
          },
          {
            type: 'Teams',
            endpoint: 'https://outlook.office.com/webhook/a1b2c3d4-e5f6-7890-abcd-ef1234567890@tenant-id/IncomingWebhook/channel-id/connector-id',
            enabled: false
          }
        ],
        logPaths: [
          '/var/log/application.log',
          '/var/log/application-error.log',
          '/tmp/debug-$(date +%Y%m%d).log',
          'C:\\Logs\\Windows\\Application.log'
        ]
      };

      await configManager.addJobConfiguration(complexConfig);
      const retrieved = await configManager.getJobConfiguration(complexConfig.jobId);
      
      expect(retrieved).toEqual(complexConfig);
      expect(retrieved.dataSource.credentials).toEqual(complexConfig.dataSource.credentials);
      expect(retrieved.alertChannels).toEqual(complexConfig.alertChannels);
      expect(retrieved.logPaths).toEqual(complexConfig.logPaths);
    });
  });
});