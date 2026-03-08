import { ConfigurationValidator, ValidationError } from '../utils/validation';
import { JobConfiguration, DataSourceConfig, SLAThresholds, AlertChannel } from '../types';

describe('ConfigurationValidator', () => {
  const validJobConfig: JobConfiguration = {
    jobId: 'test-job-1',
    name: 'Test Job',
    schedule: '0 2 * * *',
    expectedDuration: 60,
    logPaths: ['/var/log/test.log'],
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

  describe('validateJobConfiguration', () => {
    it('should validate a correct job configuration', () => {
      const result = ConfigurationValidator.validateJobConfiguration(validJobConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when jobId is missing', () => {
      const config = { ...validJobConfig, jobId: undefined as any };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'jobId is required',
          field: 'jobId',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should fail when jobId is empty string', () => {
      const config = { ...validJobConfig, jobId: '' };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Job ID must be a non-empty string',
          field: 'jobId',
          code: 'INVALID_FORMAT'
        })
      );
    });

    it('should fail when jobId contains invalid characters', () => {
      const config = { ...validJobConfig, jobId: 'test job!' };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Job ID can only contain alphanumeric characters, underscores, and hyphens',
          field: 'jobId',
          code: 'INVALID_FORMAT'
        })
      );
    });

    it('should fail when jobId is too long', () => {
      const config = { ...validJobConfig, jobId: 'a'.repeat(101) };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Job ID must be 100 characters or less',
          field: 'jobId',
          code: 'LENGTH_EXCEEDED'
        })
      );
    });

    it('should fail when name is missing', () => {
      const config = { ...validJobConfig, name: undefined as any };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'name is required',
          field: 'name',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should fail when schedule is invalid cron expression', () => {
      const config = { ...validJobConfig, schedule: 'invalid cron' };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid cron expression format. Expected 5 or 6 space-separated fields',
          field: 'schedule',
          code: 'INVALID_CRON'
        })
      );
    });

    it('should fail when expectedDuration is negative', () => {
      const config = { ...validJobConfig, expectedDuration: -10 };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Expected duration must be positive',
          field: 'expectedDuration',
          code: 'INVALID_RANGE'
        })
      );
    });

    it('should fail when expectedDuration exceeds maximum', () => {
      const config = { ...validJobConfig, expectedDuration: 20000 };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Expected duration cannot exceed 7 days (10080 minutes)',
          field: 'expectedDuration',
          code: 'INVALID_RANGE'
        })
      );
    });

    it('should fail when logPaths is empty', () => {
      const config = { ...validJobConfig, logPaths: [] };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'At least one log path is required',
          field: 'logPaths',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should fail when logPaths contains duplicates', () => {
      const config = { ...validJobConfig, logPaths: ['/var/log/test.log', '/var/log/test.log'] };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Duplicate log paths are not allowed',
          field: 'logPaths',
          code: 'DUPLICATE_VALUES'
        })
      );
    });

    it('should fail when too many log paths are provided', () => {
      const config = { ...validJobConfig, logPaths: Array(15).fill('/var/log/test').map((path, i) => `${path}${i}.log`) };
      const result = ConfigurationValidator.validateJobConfiguration(config, { maxLogPaths: 10 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Too many log paths. Maximum allowed: 10',
          field: 'logPaths',
          code: 'LENGTH_EXCEEDED'
        })
      );
    });

    it('should provide warnings for cross-field constraints', () => {
      const config = { 
        ...validJobConfig, 
        expectedDuration: 120,
        slaThresholds: {
          ...validJobConfig.slaThresholds,
          maxExecutionTime: 60 // Less than expected duration
        }
      };
      const result = ConfigurationValidator.validateJobConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('SLA max execution time is less than expected duration');
    });
  });

  describe('validateDataSourceConfig', () => {
    const validDataSource: DataSourceConfig = {
      type: 'Database',
      connectionString: 'postgresql://user:pass@localhost:5432/db',
      queryPattern: 'SELECT * FROM jobs WHERE id = $1',
      pollInterval: 30
    };

    it('should validate a correct data source configuration', () => {
      const result = ConfigurationValidator.validateDataSourceConfig(validDataSource);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when type is invalid', () => {
      const config = { ...validDataSource, type: 'InvalidType' as any };
      const result = ConfigurationValidator.validateDataSourceConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid data source type. Must be one of: SchedulerLogs, ETLLogs, Database',
          field: 'dataSource.type',
          code: 'INVALID_VALUE'
        })
      );
    });

    it('should fail when connectionString is missing', () => {
      const config = { ...validDataSource, connectionString: undefined as any };
      const result = ConfigurationValidator.validateDataSourceConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Connection string is required',
          field: 'dataSource.connectionString',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should fail when pollInterval is zero', () => {
      const config = { ...validDataSource, pollInterval: 0 };
      const result = ConfigurationValidator.validateDataSourceConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Poll interval must be positive',
          field: 'dataSource.pollInterval',
          code: 'INVALID_RANGE'
        })
      );
    });

    it('should warn when pollInterval is very low', () => {
      const config = { ...validDataSource, pollInterval: 3 };
      const result = ConfigurationValidator.validateDataSourceConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Poll interval is very low (<5 seconds), this may cause high system load');
    });

    it('should fail when pollInterval exceeds maximum', () => {
      const config = { ...validDataSource, pollInterval: 4000 };
      const result = ConfigurationValidator.validateDataSourceConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Poll interval cannot exceed 1 hour (3600 seconds)',
          field: 'dataSource.pollInterval',
          code: 'INVALID_RANGE'
        })
      );
    });
  });

  describe('validateSLAThresholds', () => {
    const validSLA: SLAThresholds = {
      maxExecutionTime: 120,
      alertDelayMinutes: 5,
      criticalDelayMinutes: 15
    };

    it('should validate correct SLA thresholds', () => {
      const result = ConfigurationValidator.validateSLAThresholds(validSLA);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when maxExecutionTime is negative', () => {
      const config = { ...validSLA, maxExecutionTime: -10 };
      const result = ConfigurationValidator.validateSLAThresholds(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Max execution time must be positive',
          field: 'slaThresholds.maxExecutionTime',
          code: 'INVALID_RANGE'
        })
      );
    });

    it('should fail when alertDelayMinutes is negative', () => {
      const config = { ...validSLA, alertDelayMinutes: -5 };
      const result = ConfigurationValidator.validateSLAThresholds(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Alert delay minutes cannot be negative',
          field: 'slaThresholds.alertDelayMinutes',
          code: 'INVALID_RANGE'
        })
      );
    });

    it('should fail when criticalDelayMinutes is less than alertDelayMinutes', () => {
      const config = { ...validSLA, alertDelayMinutes: 15, criticalDelayMinutes: 10 };
      const result = ConfigurationValidator.validateSLAThresholds(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Critical delay must be greater than or equal to alert delay',
          field: 'slaThresholds.criticalDelayMinutes',
          code: 'INVALID_CONSTRAINT'
        })
      );
    });

    it('should warn when alert delay is very high', () => {
      const config = { ...validSLA, alertDelayMinutes: 1500, criticalDelayMinutes: 1500 };
      const result = ConfigurationValidator.validateSLAThresholds(config);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Alert delay is quite high (>24 hours)');
    });
  });

  describe('validateAlertChannel', () => {
    const validEmailChannel: AlertChannel = {
      type: 'Email',
      endpoint: 'admin@example.com',
      enabled: true
    };

    const validTeamsChannel: AlertChannel = {
      type: 'Teams',
      endpoint: 'https://outlook.office.com/webhook/abc123',
      enabled: true
    };

    it('should validate a correct email alert channel', () => {
      const result = ConfigurationValidator.validateAlertChannel(validEmailChannel);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct Teams alert channel', () => {
      const result = ConfigurationValidator.validateAlertChannel(validTeamsChannel);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when type is invalid', () => {
      const config = { ...validEmailChannel, type: 'SMS' as any };
      const result = ConfigurationValidator.validateAlertChannel(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid alert channel type. Must be Email or Teams',
          field: 'alertChannel.type',
          code: 'INVALID_VALUE'
        })
      );
    });

    it('should fail when email endpoint is invalid', () => {
      const config = { ...validEmailChannel, endpoint: 'invalid-email' };
      const result = ConfigurationValidator.validateAlertChannel(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid email address format',
          field: 'alertChannel.endpoint',
          code: 'INVALID_EMAIL'
        })
      );
    });

    it('should fail when Teams endpoint is invalid URL', () => {
      const config = { ...validTeamsChannel, endpoint: 'not-a-url' };
      const result = ConfigurationValidator.validateAlertChannel(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid Teams webhook URL format',
          field: 'alertChannel.endpoint',
          code: 'INVALID_URL'
        })
      );
    });

    it('should warn when enabled flag is not specified', () => {
      const config = { ...validEmailChannel, enabled: undefined as any };
      const result = ConfigurationValidator.validateAlertChannel(config);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Alert channel enabled flag not specified, defaulting to true');
    });
  });

  describe('validateCredentialConfig', () => {
    it('should validate credentials with username and password', () => {
      const credentials = { username: 'user', password: 'password123' };
      const result = ConfigurationValidator.validateCredentialConfig(credentials, 'creds', { strict: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate credentials with API key', () => {
      const credentials = { apiKey: 'abc123def456' };
      const result = ConfigurationValidator.validateCredentialConfig(credentials, 'creds', { strict: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when no credentials are provided and not allowed', () => {
      const credentials = {};
      const result = ConfigurationValidator.validateCredentialConfig(credentials, 'creds', { allowEmptyCredentials: false });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'At least one credential field must be provided',
          field: 'creds',
          code: 'REQUIRED_FIELD'
        })
      );
    });

    it('should warn when password is short', () => {
      const credentials = { username: 'user', password: '123' };
      const result = ConfigurationValidator.validateCredentialConfig(credentials, 'creds', { strict: true });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Password is quite short (<8 characters)');
    });

    it('should fail when username is too long', () => {
      const credentials = { username: 'a'.repeat(101) };
      const result = ConfigurationValidator.validateCredentialConfig(credentials, 'creds', { strict: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Username is too long (max 100 characters)',
          field: 'creds.username',
          code: 'LENGTH_EXCEEDED'
        })
      );
    });
  });

  describe('sanitizeConfigForLogging', () => {
    it('should redact sensitive credential information', () => {
      const config = {
        ...validJobConfig,
        dataSource: {
          ...validJobConfig.dataSource,
          credentials: {
            username: 'testuser',
            password: 'secret123',
            apiKey: 'abc123'
          }
        }
      };

      const sanitized = ConfigurationValidator.sanitizeConfigForLogging(config);
      expect(sanitized.dataSource?.credentials?.username).toBe('[REDACTED]');
      expect(sanitized.dataSource?.credentials?.password).toBe('[REDACTED]');
      expect(sanitized.dataSource?.credentials?.apiKey).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive information', () => {
      const sanitized = ConfigurationValidator.sanitizeConfigForLogging(validJobConfig);
      expect(sanitized.jobId).toBe(validJobConfig.jobId);
      expect(sanitized.name).toBe(validJobConfig.name);
      expect(sanitized.schedule).toBe(validJobConfig.schedule);
    });
  });

  describe('legacy methods', () => {
    it('validateJobConfigurationStrict should throw on validation error', () => {
      const config = { ...validJobConfig, jobId: '' };
      expect(() => {
        ConfigurationValidator.validateJobConfigurationStrict(config);
      }).toThrow(ValidationError);
    });

    it('validateJobConfigurationStrict should not throw on valid config', () => {
      expect(() => {
        ConfigurationValidator.validateJobConfigurationStrict(validJobConfig);
      }).not.toThrow();
    });
  });

  describe('requirement validation methods', () => {
    it('validateConfigurationParameters should validate parameters before accepting them', () => {
      const result = ConfigurationValidator.validateConfigurationParameters(validJobConfig);
      expect(result.isValid).toBe(true);
    });

    it('ensureDataIntegrity should ensure data integrity for all fields', () => {
      const result = ConfigurationValidator.ensureDataIntegrity(validJobConfig);
      expect(result.isValid).toBe(true);
    });

    it('ensureDataIntegrity should warn about embedded passwords', () => {
      const config = {
        ...validJobConfig,
        dataSource: {
          ...validJobConfig.dataSource,
          connectionString: 'postgresql://user:password@localhost:5432/db'
        }
      };
      const result = ConfigurationValidator.ensureDataIntegrity(config);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Connection string contains embedded password, consider using credentials object');
    });
  });
});