// Validation utilities for job configurations and data

import { JobConfiguration, DataSourceConfig, SLAThresholds, AlertChannel, CredentialConfig } from '../types';

export class ValidationError extends Error {
  constructor(message: string, public field?: string, public code?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

export interface ValidationOptions {
  strict?: boolean;
  allowEmptyCredentials?: boolean;
  maxLogPaths?: number;
  maxAlertChannels?: number;
}

export class ConfigurationValidator {
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    strict: true,
    allowEmptyCredentials: false,
    maxLogPaths: 10,
    maxAlertChannels: 5
  };

  /**
   * Validates a complete job configuration
   * @param config The job configuration to validate
   * @param options Validation options
   * @returns ValidationResult with detailed error information
   */
  static validateJobConfiguration(config: JobConfiguration, options?: ValidationOptions): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic required field validation
      this.validateRequiredFields(config, errors);
      
      // Validate individual components
      this.validateJobIdentifiers(config, errors);
      this.validateSchedule(config.schedule, errors);
      this.validateDuration(config.expectedDuration, errors);
      this.validateLogPaths(config.logPaths, errors, opts);
      
      // Validate nested objects
      const dataSourceResult = this.validateDataSourceConfig(config.dataSource, opts);
      errors.push(...dataSourceResult.errors);
      warnings.push(...(dataSourceResult.warnings || []));

      const slaResult = this.validateSLAThresholds(config.slaThresholds, opts);
      errors.push(...slaResult.errors);
      warnings.push(...(slaResult.warnings || []));

      if (config.alertChannels && config.alertChannels.length > 0) {
        const alertResult = this.validateAlertChannels(config.alertChannels, opts);
        errors.push(...alertResult.errors);
        warnings.push(...(alertResult.warnings || []));
      }

      // Cross-field validation
      this.validateCrossFieldConstraints(config, errors, warnings);

    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(new ValidationError(`Unexpected validation error: ${errorMessage}`, undefined, 'VALIDATION_ERROR'));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validates job configuration and throws on first error (legacy method)
   */
  static validateJobConfigurationStrict(config: JobConfiguration): void {
    const result = this.validateJobConfiguration(config, { strict: true });
    if (!result.isValid) {
      throw result.errors[0];
    }
  }

  private static validateRequiredFields(config: JobConfiguration, errors: ValidationError[]): void {
    if (!config) {
      errors.push(new ValidationError('Configuration object is required', 'config', 'REQUIRED_FIELD'));
      return;
    }

    const requiredFields = [
      { field: 'jobId', value: config.jobId },
      { field: 'name', value: config.name },
      { field: 'schedule', value: config.schedule },
      { field: 'expectedDuration', value: config.expectedDuration },
      { field: 'logPaths', value: config.logPaths },
      { field: 'dataSource', value: config.dataSource },
      { field: 'slaThresholds', value: config.slaThresholds }
    ];

    requiredFields.forEach(({ field, value }) => {
      if (value === undefined || value === null) {
        errors.push(new ValidationError(`${field} is required`, field, 'REQUIRED_FIELD'));
      }
    });
  }

  private static validateJobIdentifiers(config: JobConfiguration, errors: ValidationError[]): void {
    // Job ID validation
    if (config.jobId !== undefined) {
      if (typeof config.jobId !== 'string' || config.jobId.trim().length === 0) {
        errors.push(new ValidationError('Job ID must be a non-empty string', 'jobId', 'INVALID_FORMAT'));
      } else if (config.jobId.length > 100) {
        errors.push(new ValidationError('Job ID must be 100 characters or less', 'jobId', 'LENGTH_EXCEEDED'));
      } else if (!/^[a-zA-Z0-9_-]+$/.test(config.jobId)) {
        errors.push(new ValidationError('Job ID can only contain alphanumeric characters, underscores, and hyphens', 'jobId', 'INVALID_FORMAT'));
      }
    }

    // Job name validation
    if (config.name !== undefined) {
      if (typeof config.name !== 'string' || config.name.trim().length === 0) {
        errors.push(new ValidationError('Job name must be a non-empty string', 'name', 'INVALID_FORMAT'));
      } else if (config.name.length > 255) {
        errors.push(new ValidationError('Job name must be 255 characters or less', 'name', 'LENGTH_EXCEEDED'));
      }
    }
  }

  private static validateSchedule(schedule: string, errors: ValidationError[]): void {
    if (schedule !== undefined) {
      if (typeof schedule !== 'string' || schedule.trim().length === 0) {
        errors.push(new ValidationError('Schedule must be a non-empty string', 'schedule', 'INVALID_FORMAT'));
        return;
      }

      if (!this.isValidCronExpression(schedule)) {
        errors.push(new ValidationError('Invalid cron expression format. Expected 5 or 6 space-separated fields', 'schedule', 'INVALID_CRON'));
      }
    }
  }

  private static validateDuration(duration: number, errors: ValidationError[]): void {
    if (duration !== undefined) {
      if (typeof duration !== 'number' || isNaN(duration)) {
        errors.push(new ValidationError('Expected duration must be a number', 'expectedDuration', 'INVALID_TYPE'));
      } else if (duration <= 0) {
        errors.push(new ValidationError('Expected duration must be positive', 'expectedDuration', 'INVALID_RANGE'));
      } else if (duration > 10080) { // 7 days in minutes
        errors.push(new ValidationError('Expected duration cannot exceed 7 days (10080 minutes)', 'expectedDuration', 'INVALID_RANGE'));
      }
    }
  }

  private static validateLogPaths(logPaths: string[], errors: ValidationError[], options: ValidationOptions): void {
    if (logPaths !== undefined) {
      if (!Array.isArray(logPaths)) {
        errors.push(new ValidationError('Log paths must be an array', 'logPaths', 'INVALID_TYPE'));
        return;
      }

      if (logPaths.length === 0) {
        errors.push(new ValidationError('At least one log path is required', 'logPaths', 'REQUIRED_FIELD'));
        return;
      }

      if (logPaths.length > (options.maxLogPaths || 10)) {
        errors.push(new ValidationError(`Too many log paths. Maximum allowed: ${options.maxLogPaths}`, 'logPaths', 'LENGTH_EXCEEDED'));
      }

      logPaths.forEach((path, index) => {
        if (typeof path !== 'string' || path.trim().length === 0) {
          errors.push(new ValidationError(`Log path at index ${index} must be a non-empty string`, `logPaths[${index}]`, 'INVALID_FORMAT'));
        } else if (path.length > 500) {
          errors.push(new ValidationError(`Log path at index ${index} is too long (max 500 characters)`, `logPaths[${index}]`, 'LENGTH_EXCEEDED'));
        }
      });

      // Check for duplicates
      const uniquePaths = new Set(logPaths);
      if (uniquePaths.size !== logPaths.length) {
        errors.push(new ValidationError('Duplicate log paths are not allowed', 'logPaths', 'DUPLICATE_VALUES'));
      }
    }
  }

  private static validateAlertChannels(channels: AlertChannel[], options: ValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (channels.length > (options.maxAlertChannels || 5)) {
      errors.push(new ValidationError(`Too many alert channels. Maximum allowed: ${options.maxAlertChannels}`, 'alertChannels', 'LENGTH_EXCEEDED'));
    }

    channels.forEach((channel, index) => {
      const channelResult = this.validateAlertChannel(channel, `alertChannels[${index}]`, options);
      errors.push(...channelResult.errors);
      warnings.push(...(channelResult.warnings || []));
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateCrossFieldConstraints(config: JobConfiguration, errors: ValidationError[], warnings: string[]): void {
    // Validate that SLA thresholds make sense with expected duration
    if (config.slaThresholds && config.expectedDuration) {
      if (config.slaThresholds.maxExecutionTime < config.expectedDuration) {
        warnings.push('SLA max execution time is less than expected duration');
      }
    }

    // Validate data source poll interval makes sense
    if (config.dataSource && config.dataSource.pollInterval) {
      if (config.dataSource.pollInterval > 300) { // 5 minutes
        warnings.push('Poll interval is quite high (>5 minutes), consider reducing for better responsiveness');
      }
    }
  }

  static validateDataSourceConfig(config: DataSourceConfig, options?: ValidationOptions): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push(new ValidationError('Data source configuration is required', 'dataSource', 'REQUIRED_FIELD'));
      return { isValid: false, errors };
    }

    // Type validation
    if (!config.type) {
      errors.push(new ValidationError('Data source type is required', 'dataSource.type', 'REQUIRED_FIELD'));
    } else if (!['SchedulerLogs', 'ETLLogs', 'Database'].includes(config.type)) {
      errors.push(new ValidationError('Invalid data source type. Must be one of: SchedulerLogs, ETLLogs, Database', 'dataSource.type', 'INVALID_VALUE'));
    }

    // Connection string validation
    if (!config.connectionString) {
      errors.push(new ValidationError('Connection string is required', 'dataSource.connectionString', 'REQUIRED_FIELD'));
    } else if (typeof config.connectionString !== 'string' || config.connectionString.trim().length === 0) {
      errors.push(new ValidationError('Connection string must be a non-empty string', 'dataSource.connectionString', 'INVALID_FORMAT'));
    } else if (config.connectionString.length > 1000) {
      errors.push(new ValidationError('Connection string is too long (max 1000 characters)', 'dataSource.connectionString', 'LENGTH_EXCEEDED'));
    }

    // Query pattern validation
    if (!config.queryPattern) {
      errors.push(new ValidationError('Query pattern is required', 'dataSource.queryPattern', 'REQUIRED_FIELD'));
    } else if (typeof config.queryPattern !== 'string' || config.queryPattern.trim().length === 0) {
      errors.push(new ValidationError('Query pattern must be a non-empty string', 'dataSource.queryPattern', 'INVALID_FORMAT'));
    } else if (config.queryPattern.length > 2000) {
      errors.push(new ValidationError('Query pattern is too long (max 2000 characters)', 'dataSource.queryPattern', 'LENGTH_EXCEEDED'));
    }

    // Poll interval validation
    if (config.pollInterval === undefined || config.pollInterval === null) {
      errors.push(new ValidationError('Poll interval is required', 'dataSource.pollInterval', 'REQUIRED_FIELD'));
    } else if (typeof config.pollInterval !== 'number' || isNaN(config.pollInterval)) {
      errors.push(new ValidationError('Poll interval must be a number', 'dataSource.pollInterval', 'INVALID_TYPE'));
    } else if (config.pollInterval <= 0) {
      errors.push(new ValidationError('Poll interval must be positive', 'dataSource.pollInterval', 'INVALID_RANGE'));
    } else if (config.pollInterval < 5) {
      warnings.push('Poll interval is very low (<5 seconds), this may cause high system load');
    } else if (config.pollInterval > 3600) {
      errors.push(new ValidationError('Poll interval cannot exceed 1 hour (3600 seconds)', 'dataSource.pollInterval', 'INVALID_RANGE'));
    }

    // Credentials validation
    if (config.credentials) {
      const credResult = this.validateCredentialConfig(config.credentials, 'dataSource.credentials', opts);
      errors.push(...credResult.errors);
      warnings.push(...(credResult.warnings || []));
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateSLAThresholds(thresholds: SLAThresholds, options?: ValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!thresholds) {
      errors.push(new ValidationError('SLA thresholds are required', 'slaThresholds', 'REQUIRED_FIELD'));
      return { isValid: false, errors };
    }

    // Max execution time validation
    if (thresholds.maxExecutionTime === undefined || thresholds.maxExecutionTime === null) {
      errors.push(new ValidationError('Max execution time is required', 'slaThresholds.maxExecutionTime', 'REQUIRED_FIELD'));
    } else if (typeof thresholds.maxExecutionTime !== 'number' || isNaN(thresholds.maxExecutionTime)) {
      errors.push(new ValidationError('Max execution time must be a number', 'slaThresholds.maxExecutionTime', 'INVALID_TYPE'));
    } else if (thresholds.maxExecutionTime <= 0) {
      errors.push(new ValidationError('Max execution time must be positive', 'slaThresholds.maxExecutionTime', 'INVALID_RANGE'));
    } else if (thresholds.maxExecutionTime > 10080) { // 7 days
      errors.push(new ValidationError('Max execution time cannot exceed 7 days (10080 minutes)', 'slaThresholds.maxExecutionTime', 'INVALID_RANGE'));
    }

    // Alert delay validation
    if (thresholds.alertDelayMinutes === undefined || thresholds.alertDelayMinutes === null) {
      errors.push(new ValidationError('Alert delay minutes is required', 'slaThresholds.alertDelayMinutes', 'REQUIRED_FIELD'));
    } else if (typeof thresholds.alertDelayMinutes !== 'number' || isNaN(thresholds.alertDelayMinutes)) {
      errors.push(new ValidationError('Alert delay minutes must be a number', 'slaThresholds.alertDelayMinutes', 'INVALID_TYPE'));
    } else if (thresholds.alertDelayMinutes < 0) {
      errors.push(new ValidationError('Alert delay minutes cannot be negative', 'slaThresholds.alertDelayMinutes', 'INVALID_RANGE'));
    } else if (thresholds.alertDelayMinutes > 1440) { // 24 hours
      warnings.push('Alert delay is quite high (>24 hours)');
    }

    // Critical delay validation
    if (thresholds.criticalDelayMinutes === undefined || thresholds.criticalDelayMinutes === null) {
      errors.push(new ValidationError('Critical delay minutes is required', 'slaThresholds.criticalDelayMinutes', 'REQUIRED_FIELD'));
    } else if (typeof thresholds.criticalDelayMinutes !== 'number' || isNaN(thresholds.criticalDelayMinutes)) {
      errors.push(new ValidationError('Critical delay minutes must be a number', 'slaThresholds.criticalDelayMinutes', 'INVALID_TYPE'));
    } else if (thresholds.criticalDelayMinutes < 0) {
      errors.push(new ValidationError('Critical delay minutes cannot be negative', 'slaThresholds.criticalDelayMinutes', 'INVALID_RANGE'));
    }

    // Cross-field validation
    if (thresholds.alertDelayMinutes !== undefined && thresholds.criticalDelayMinutes !== undefined) {
      if (thresholds.criticalDelayMinutes < thresholds.alertDelayMinutes) {
        errors.push(new ValidationError('Critical delay must be greater than or equal to alert delay', 'slaThresholds.criticalDelayMinutes', 'INVALID_CONSTRAINT'));
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateAlertChannel(channel: AlertChannel, fieldPrefix: string = 'alertChannel', options?: ValidationOptions): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!channel) {
      errors.push(new ValidationError('Alert channel is required', fieldPrefix, 'REQUIRED_FIELD'));
      return { isValid: false, errors };
    }

    // Type validation
    if (!channel.type) {
      errors.push(new ValidationError('Alert channel type is required', `${fieldPrefix}.type`, 'REQUIRED_FIELD'));
    } else if (!['Email', 'Teams'].includes(channel.type)) {
      errors.push(new ValidationError('Invalid alert channel type. Must be Email or Teams', `${fieldPrefix}.type`, 'INVALID_VALUE'));
    }

    // Endpoint validation
    if (!channel.endpoint) {
      errors.push(new ValidationError('Alert channel endpoint is required', `${fieldPrefix}.endpoint`, 'REQUIRED_FIELD'));
    } else if (typeof channel.endpoint !== 'string' || channel.endpoint.trim().length === 0) {
      errors.push(new ValidationError('Alert channel endpoint must be a non-empty string', `${fieldPrefix}.endpoint`, 'INVALID_FORMAT'));
    } else {
      // Type-specific endpoint validation
      if (channel.type === 'Email' && !this.isValidEmail(channel.endpoint)) {
        errors.push(new ValidationError('Invalid email address format', `${fieldPrefix}.endpoint`, 'INVALID_EMAIL'));
      } else if (channel.type === 'Teams' && !this.isValidUrl(channel.endpoint)) {
        errors.push(new ValidationError('Invalid Teams webhook URL format', `${fieldPrefix}.endpoint`, 'INVALID_URL'));
      }
    }

    // Enabled flag validation
    if (channel.enabled === undefined || channel.enabled === null) {
      warnings.push(`Alert channel enabled flag not specified, defaulting to true`);
    } else if (typeof channel.enabled !== 'boolean') {
      errors.push(new ValidationError('Alert channel enabled must be a boolean', `${fieldPrefix}.enabled`, 'INVALID_TYPE'));
    }

    // Credentials validation
    if (channel.credentials) {
      const credResult = this.validateCredentialConfig(channel.credentials, `${fieldPrefix}.credentials`, opts);
      errors.push(...credResult.errors);
      warnings.push(...(credResult.warnings || []));
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateCredentialConfig(credentials: CredentialConfig, fieldPrefix: string, options: ValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!credentials) {
      if (!options.allowEmptyCredentials) {
        errors.push(new ValidationError('Credentials are required', fieldPrefix, 'REQUIRED_FIELD'));
      }
      return { isValid: errors.length === 0, errors };
    }

    const hasAnyCredential = credentials.username || credentials.password || credentials.apiKey || credentials.token;
    
    if (!hasAnyCredential && !options.allowEmptyCredentials) {
      errors.push(new ValidationError('At least one credential field must be provided', fieldPrefix, 'REQUIRED_FIELD'));
    }

    // Validate individual credential fields
    if (credentials.username !== undefined) {
      if (typeof credentials.username !== 'string') {
        errors.push(new ValidationError('Username must be a string', `${fieldPrefix}.username`, 'INVALID_TYPE'));
      } else if (credentials.username.length > 100) {
        errors.push(new ValidationError('Username is too long (max 100 characters)', `${fieldPrefix}.username`, 'LENGTH_EXCEEDED'));
      }
    }

    if (credentials.password !== undefined) {
      if (typeof credentials.password !== 'string') {
        errors.push(new ValidationError('Password must be a string', `${fieldPrefix}.password`, 'INVALID_TYPE'));
      } else if (credentials.password.length > 200) {
        errors.push(new ValidationError('Password is too long (max 200 characters)', `${fieldPrefix}.password`, 'LENGTH_EXCEEDED'));
      } else if (credentials.password.length < 8 && credentials.password.length > 0) {
        warnings.push('Password is quite short (<8 characters)');
      }
    }

    if (credentials.apiKey !== undefined) {
      if (typeof credentials.apiKey !== 'string') {
        errors.push(new ValidationError('API key must be a string', `${fieldPrefix}.apiKey`, 'INVALID_TYPE'));
      } else if (credentials.apiKey.length > 500) {
        errors.push(new ValidationError('API key is too long (max 500 characters)', `${fieldPrefix}.apiKey`, 'LENGTH_EXCEEDED'));
      }
    }

    if (credentials.token !== undefined) {
      if (typeof credentials.token !== 'string') {
        errors.push(new ValidationError('Token must be a string', `${fieldPrefix}.token`, 'INVALID_TYPE'));
      } else if (credentials.token.length > 1000) {
        errors.push(new ValidationError('Token is too long (max 1000 characters)', `${fieldPrefix}.token`, 'LENGTH_EXCEEDED'));
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static isValidCronExpression(cron: string): boolean {
    // Enhanced cron validation
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return false;
    }

    // Basic field validation (simplified)
    const cronRegex = /^(\*|[0-9,-/]+)$/;
    return parts.every(part => cronRegex.test(part));
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
  }

  private static isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes configuration data by removing sensitive information for logging
   */
  static sanitizeConfigForLogging(config: JobConfiguration): Partial<JobConfiguration> {
    const sanitized = { ...config };
    
    // Remove sensitive credential information
    if (sanitized.dataSource?.credentials) {
      sanitized.dataSource = {
        ...sanitized.dataSource,
        credentials: {
          username: sanitized.dataSource.credentials.username ? '[REDACTED]' : undefined,
          password: sanitized.dataSource.credentials.password ? '[REDACTED]' : undefined,
          apiKey: sanitized.dataSource.credentials.apiKey ? '[REDACTED]' : undefined,
          token: sanitized.dataSource.credentials.token ? '[REDACTED]' : undefined,
        }
      };
    }

    if (sanitized.alertChannels) {
      sanitized.alertChannels = sanitized.alertChannels.map(channel => ({
        ...channel,
        credentials: channel.credentials ? {
          username: channel.credentials.username ? '[REDACTED]' : undefined,
          password: channel.credentials.password ? '[REDACTED]' : undefined,
          apiKey: channel.credentials.apiKey ? '[REDACTED]' : undefined,
          token: channel.credentials.token ? '[REDACTED]' : undefined,
        } : undefined
      }));
    }

    return sanitized;
  }

  /**
   * Validates configuration parameters before accepting them (Requirement 6.2)
   */
  static validateConfigurationParameters(config: JobConfiguration): ValidationResult {
    return this.validateJobConfiguration(config, { strict: true });
  }

  /**
   * Ensures data integrity for all configuration fields (Requirement 6.2)
   */
  static ensureDataIntegrity(config: JobConfiguration): ValidationResult {
    const result = this.validateJobConfiguration(config, { 
      strict: true, 
      allowEmptyCredentials: false 
    });

    // Additional integrity checks
    const errors = [...result.errors];
    const warnings = [...(result.warnings || [])];

    // Check for potential security issues
    if (config.dataSource?.connectionString?.includes('password=') || 
        config.dataSource?.connectionString?.match(/:\/\/[^:]+:[^@]+@/)) {
      warnings.push('Connection string contains embedded password, consider using credentials object');
    }

    // Check for reasonable configuration values
    if (config.slaThresholds?.maxExecutionTime > 1440) { // > 24 hours
      warnings.push('Max execution time is very high (>24 hours), verify this is intentional');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}