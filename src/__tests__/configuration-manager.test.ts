// Unit tests for ConfigurationManager service

import { ConfigurationManagerService } from '../services/configuration-manager';
import { DatabaseConnection } from '../database/connection';
import { JobConfiguration } from '../types';
import { ValidationError } from '../utils/validation';
import * as fs from 'fs';
import * as path from 'path';

describe('ConfigurationManagerService', () => {
  let configManager: ConfigurationManagerService;
  let db: DatabaseConnection;
  const testDbPath = './data/test_config_manager.db';

  const validJobConfig: JobConfiguration = {
    jobId: 'test-job-1',
    name: 'Test Job 1',
    schedule: '0 2 * * *',
    expectedDuration: 60,
    logPaths: ['/var/log/test1.log'],
    dataSource: {
      type: 'SchedulerLogs',
      connectionString: 'file:///var/log/scheduler.log',
      queryPattern: 'SELECT * FROM jobs WHERE id = ?',
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

  const validJobConfig2: JobConfiguration = {
    jobId: 'test-job-2',
    name: 'Test Job 2',
    schedule: '0 4 * * *',
    expectedDuration: 90,
    logPaths: ['/var/log/test2.log'],
    dataSource: {
      type: 'Database',
      connectionString: 'postgresql://user:pass@localhost:5432/db',
      queryPattern: 'SELECT * FROM jobs WHERE id = $1',
      pollInterval: 60
    },
    alertChannels: [{
      type: 'Teams',
      endpoint: 'https://outlook.office.com/webhook/abc123',
      enabled: true
    }],
    slaThresholds: {
      maxExecutionTime: 180,
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

  describe('addJobConfiguration', () => {
    it('should successfully add a valid job configuration', async () => {
      await configManager.addJobConfiguration(validJobConfig);

      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved).toEqual(validJobConfig);
    });

    it('should fail when adding a configuration with invalid data', async () => {
      const invalidConfig = { ...validJobConfig, jobId: '' };
      
      await expect(configManager.addJobConfiguration(invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should fail when adding a configuration with duplicate jobId', async () => {
      await configManager.addJobConfiguration(validJobConfig);
      
      await expect(configManager.addJobConfiguration(validJobConfig))
        .rejects.toThrow(`Job configuration with ID '${validJobConfig.jobId}' already exists`);
    });

    it('should validate configuration before adding (Requirement 6.2)', async () => {
      const invalidConfig = { ...validJobConfig, expectedDuration: -10 };
      
      await expect(configManager.addJobConfiguration(invalidConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should persist configuration changes (Requirement 6.5)', async () => {
      await configManager.addJobConfiguration(validJobConfig);
      
      // Create new instance to verify persistence
      await configManager.cleanup();
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      const retrieved = await newConfigManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved).toEqual(validJobConfig);
      
      await newConfigManager.cleanup();
    });

    it('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await configManager.cleanup();
      
      await expect(configManager.addJobConfiguration(validJobConfig))
        .rejects.toThrow('Database not connected');
    });

    it('should handle JSON serialization of complex objects', async () => {
      const configWithComplexData = {
        ...validJobConfig,
        dataSource: {
          ...validJobConfig.dataSource,
          credentials: {
            username: 'testuser',
            password: 'testpass',
            apiKey: 'abc123'
          }
        }
      };

      await configManager.addJobConfiguration(configWithComplexData);
      const retrieved = await configManager.getJobConfiguration(configWithComplexData.jobId);
      expect(retrieved).toEqual(configWithComplexData);
    });
  });

  describe('updateJobConfiguration', () => {
    beforeEach(async () => {
      await configManager.addJobConfiguration(validJobConfig);
    });

    it('should successfully update an existing job configuration', async () => {
      const updates = {
        name: 'Updated Test Job',
        expectedDuration: 90
      };

      await configManager.updateJobConfiguration(validJobConfig.jobId, updates);

      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.name).toBe(updates.name);
      expect(retrieved.expectedDuration).toBe(updates.expectedDuration);
      expect(retrieved.schedule).toBe(validJobConfig.schedule); // Unchanged
    });

    it('should fail when updating non-existent configuration', async () => {
      const updates = { name: 'Updated Name' };
      
      await expect(configManager.updateJobConfiguration('non-existent', updates))
        .rejects.toThrow(`Job configuration with ID 'non-existent' not found`);
    });

    it('should validate merged configuration after update (Requirement 6.2)', async () => {
      const invalidUpdates = { expectedDuration: -10 };
      
      await expect(configManager.updateJobConfiguration(validJobConfig.jobId, invalidUpdates))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should not allow changing jobId', async () => {
      const updates = { jobId: 'different-id', name: 'Updated Name' };
      
      await configManager.updateJobConfiguration(validJobConfig.jobId, updates);
      
      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.jobId).toBe(validJobConfig.jobId); // Should remain unchanged
      expect(retrieved.name).toBe('Updated Name'); // Other changes should apply
    });

    it('should persist configuration changes (Requirement 6.5)', async () => {
      const updates = { name: 'Persisted Update' };
      await configManager.updateJobConfiguration(validJobConfig.jobId, updates);
      
      // Create new instance to verify persistence
      await configManager.cleanup();
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      const retrieved = await newConfigManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.name).toBe(updates.name);
      
      await newConfigManager.cleanup();
    });

    it('should handle partial updates correctly', async () => {
      const updates = {
        alertChannels: [{
          type: 'Teams' as const,
          endpoint: 'https://teams.webhook.url',
          enabled: true
        }]
      };

      await configManager.updateJobConfiguration(validJobConfig.jobId, updates);

      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.alertChannels).toEqual(updates.alertChannels);
      expect(retrieved.schedule).toBe(validJobConfig.schedule); // Unchanged
    });

    it('should fail with invalid jobId parameter', async () => {
      await expect(configManager.updateJobConfiguration('', { name: 'Test' }))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
      
      await expect(configManager.updateJobConfiguration(null as any, { name: 'Test' }))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
    });
  });

  describe('removeJobConfiguration', () => {
    beforeEach(async () => {
      await configManager.addJobConfiguration(validJobConfig);
    });

    it('should successfully remove an existing job configuration', async () => {
      await configManager.removeJobConfiguration(validJobConfig.jobId);
      
      await expect(configManager.getJobConfiguration(validJobConfig.jobId))
        .rejects.toThrow(`Job configuration with ID '${validJobConfig.jobId}' not found`);
    });

    it('should fail when removing non-existent configuration', async () => {
      await expect(configManager.removeJobConfiguration('non-existent'))
        .rejects.toThrow(`Job configuration with ID 'non-existent' not found`);
    });

    it('should persist removal (Requirement 6.5)', async () => {
      await configManager.removeJobConfiguration(validJobConfig.jobId);
      
      // Create new instance to verify persistence
      await configManager.cleanup();
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      await expect(newConfigManager.getJobConfiguration(validJobConfig.jobId))
        .rejects.toThrow(`Job configuration with ID '${validJobConfig.jobId}' not found`);
      
      await newConfigManager.cleanup();
    });

    it('should fail with invalid jobId parameter', async () => {
      await expect(configManager.removeJobConfiguration(''))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
      
      await expect(configManager.removeJobConfiguration(null as any))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
    });
  });

  describe('getJobConfiguration', () => {
    beforeEach(async () => {
      await configManager.addJobConfiguration(validJobConfig);
    });

    it('should successfully retrieve an existing job configuration', async () => {
      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved).toEqual(validJobConfig);
    });

    it('should fail when retrieving non-existent configuration', async () => {
      await expect(configManager.getJobConfiguration('non-existent'))
        .rejects.toThrow(`Job configuration with ID 'non-existent' not found`);
    });

    it('should fail with invalid jobId parameter', async () => {
      await expect(configManager.getJobConfiguration(''))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
      
      await expect(configManager.getJobConfiguration(null as any))
        .rejects.toThrow('Job ID is required and must be a non-empty string');
    });

    it('should handle JSON deserialization correctly', async () => {
      const configWithComplexData = {
        ...validJobConfig,
        jobId: 'test-job-complex', // Use different ID to avoid conflicts
        dataSource: {
          ...validJobConfig.dataSource,
          credentials: {
            username: 'testuser',
            password: 'testpass'
          }
        }
      };

      await configManager.addJobConfiguration(configWithComplexData);
      const retrieved = await configManager.getJobConfiguration(configWithComplexData.jobId);
      expect(retrieved.dataSource.credentials).toEqual(configWithComplexData.dataSource.credentials);
    });
  });

  describe('getAllJobConfigurations', () => {
    it('should return empty array when no configurations exist', async () => {
      const configurations = await configManager.getAllJobConfigurations();
      expect(configurations).toEqual([]);
    });

    it('should return all job configurations', async () => {
      await configManager.addJobConfiguration(validJobConfig);
      await configManager.addJobConfiguration(validJobConfig2);

      const configurations = await configManager.getAllJobConfigurations();
      expect(configurations).toHaveLength(2);
      
      // Should be ordered by name
      expect(configurations[0].name).toBe('Test Job 1');
      expect(configurations[1].name).toBe('Test Job 2');
    });

    it('should handle corrupted data gracefully', async () => {
      // Add valid configuration first
      await configManager.addJobConfiguration(validJobConfig);
      
      // Manually insert corrupted data
      await db.run(
        'INSERT INTO job_configurations (job_id, name, schedule, expected_duration, log_paths, data_source, alert_channels, sla_thresholds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['corrupted', 'Corrupted Job', '0 2 * * *', 60, 'invalid-json', '{}', '[]', '{}']
      );

      const configurations = await configManager.getAllJobConfigurations();
      // Should return only the valid configuration
      expect(configurations).toHaveLength(1);
      expect(configurations[0].jobId).toBe(validJobConfig.jobId);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid configuration', async () => {
      const isValid = await configManager.validateConfiguration(validJobConfig);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid configuration', async () => {
      const invalidConfig = { ...validJobConfig, jobId: '' };
      const isValid = await configManager.validateConfiguration(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      const configWithUndefinedFields = { ...validJobConfig, schedule: undefined as any };
      const isValid = await configManager.validateConfiguration(configWithUndefinedFields);
      expect(isValid).toBe(false);
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize database connection and schema', async () => {
      const newDb = new DatabaseConnection('./data/test_init.db');
      const newConfigManager = new ConfigurationManagerService(newDb);
      
      await newConfigManager.initialize();
      expect(newDb.isConnected()).toBe(true);
      
      // Should be able to perform operations
      await newConfigManager.addJobConfiguration(validJobConfig);
      const retrieved = await newConfigManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved).toEqual(validJobConfig);
      
      await newConfigManager.cleanup();
      
      // Clean up test file
      if (fs.existsSync('./data/test_init.db')) {
        fs.unlinkSync('./data/test_init.db');
      }
    });

    it('should handle initialization errors', async () => {
      // Create a mock database that will fail during schema initialization
      const mockDb = new DatabaseConnection('./data/test_init_fail.db');
      const newConfigManager = new ConfigurationManagerService(mockDb);
      
      // Mock the initializeSchema method to throw an error
      const originalInitializeSchema = mockDb.initializeSchema;
      mockDb.initializeSchema = jest.fn().mockRejectedValue(new Error('Schema initialization failed'));
      
      await expect(newConfigManager.initialize()).rejects.toThrow('Failed to initialize Configuration Manager');
      
      // Restore original method
      mockDb.initializeSchema = originalInitializeSchema;
    });

    it('should cleanup resources properly', async () => {
      await configManager.cleanup();
      expect(db.isConnected()).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection failures during operations', async () => {
      await configManager.cleanup(); // Close database
      
      await expect(configManager.addJobConfiguration(validJobConfig))
        .rejects.toThrow('Database not connected');
      
      await expect(configManager.getJobConfiguration('test'))
        .rejects.toThrow('Database not connected');
      
      await expect(configManager.getAllJobConfigurations())
        .rejects.toThrow('Database not connected');
    });

    it('should handle JSON parsing errors in database data', async () => {
      // Manually insert invalid JSON data
      await db.run(
        'INSERT INTO job_configurations (job_id, name, schedule, expected_duration, log_paths, data_source, alert_channels, sla_thresholds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['invalid-json', 'Invalid Job', '0 2 * * *', 60, 'invalid-json', '{}', '[]', '{}']
      );

      await expect(configManager.getJobConfiguration('invalid-json'))
        .rejects.toThrow('Failed to parse configuration data');
    });

    it('should handle concurrent access scenarios', async () => {
      // Add configuration
      await configManager.addJobConfiguration(validJobConfig);
      
      // Simulate concurrent updates
      const update1 = configManager.updateJobConfiguration(validJobConfig.jobId, { name: 'Update 1' });
      const update2 = configManager.updateJobConfiguration(validJobConfig.jobId, { expectedDuration: 120 });
      
      await Promise.all([update1, update2]);
      
      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      // One of the updates should have succeeded
      expect(retrieved.name === 'Update 1' || retrieved.expectedDuration === 120).toBe(true);
    });
  });

  describe('requirements validation', () => {
    it('should support adding new job configurations without system restart (Requirement 6.3)', async () => {
      // Add configuration while system is running
      await configManager.addJobConfiguration(validJobConfig);
      
      // Verify it's immediately available
      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved).toEqual(validJobConfig);
    });

    it('should support modifying existing job configurations (Requirement 6.4)', async () => {
      await configManager.addJobConfiguration(validJobConfig);
      
      // Modify configuration while system is running
      const updates = { name: 'Modified Job', expectedDuration: 120 };
      await configManager.updateJobConfiguration(validJobConfig.jobId, updates);
      
      // Verify changes are immediately available
      const retrieved = await configManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.name).toBe(updates.name);
      expect(retrieved.expectedDuration).toBe(updates.expectedDuration);
    });

    it('should persist configuration changes to survive system restarts (Requirement 6.5)', async () => {
      // Add and modify configuration
      await configManager.addJobConfiguration(validJobConfig);
      await configManager.updateJobConfiguration(validJobConfig.jobId, { name: 'Persistent Update' });
      
      // Simulate system restart by creating new instances
      await configManager.cleanup();
      
      const newDb = new DatabaseConnection(testDbPath);
      const newConfigManager = new ConfigurationManagerService(newDb);
      await newConfigManager.initialize();
      
      // Verify configuration persisted
      const retrieved = await newConfigManager.getJobConfiguration(validJobConfig.jobId);
      expect(retrieved.name).toBe('Persistent Update');
      
      await newConfigManager.cleanup();
    });
  });
});