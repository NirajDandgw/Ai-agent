"use strict";
// Configuration Manager Service - Handles CRUD operations for job configurations
// Requirements: 6.3, 6.4, 6.5
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManagerService = void 0;
const validation_1 = require("../utils/validation");
const logger_1 = require("../utils/logger");
class ConfigurationManagerService {
    constructor(db) {
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
    }
    /**
     * Add a new job configuration to the system
     * Requirements: 6.3 - Support adding new job configurations without system restart
     */
    async addJobConfiguration(config) {
        this.logger.info('ConfigurationManager', `Adding new job configuration: ${config.jobId}`);
        try {
            // Validate configuration before adding (Requirement 6.2)
            const validationResult = validation_1.ConfigurationValidator.validateJobConfiguration(config);
            if (!validationResult.isValid) {
                const errorMessage = `Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId: config.jobId, errors: validationResult.errors });
                throw new validation_1.ValidationError(errorMessage);
            }
            // Log warnings if any
            if (validationResult.warnings && validationResult.warnings.length > 0) {
                this.logger.warn('ConfigurationManager', `Configuration warnings for job ${config.jobId}:`, validationResult.warnings);
            }
            // Check if job configuration already exists
            const existingConfig = await this.getJobConfigurationInternal(config.jobId);
            if (existingConfig) {
                const errorMessage = `Job configuration with ID '${config.jobId}' already exists`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId: config.jobId });
                throw new Error(errorMessage);
            }
            // Insert configuration into database (Requirement 6.5 - Persist configuration changes)
            const sql = `
        INSERT INTO job_configurations (
          job_id, name, schedule, expected_duration, log_paths, 
          data_source, alert_channels, sla_thresholds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
            const params = [
                config.jobId,
                config.name,
                config.schedule,
                config.expectedDuration,
                JSON.stringify(config.logPaths),
                JSON.stringify(config.dataSource),
                JSON.stringify(config.alertChannels),
                JSON.stringify(config.slaThresholds)
            ];
            await this.db.run(sql, params);
            this.logger.info('ConfigurationManager', `Successfully added job configuration: ${config.jobId}`);
        }
        catch (error) {
            if (error instanceof validation_1.ValidationError) {
                throw error;
            }
            const errorMessage = `Failed to add job configuration ${config.jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { jobId: config.jobId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Update an existing job configuration
     * Requirements: 6.4 - Support modifying existing job configurations
     */
    async updateJobConfiguration(jobId, config) {
        this.logger.info('ConfigurationManager', `Updating job configuration: ${jobId}`);
        try {
            // Validate jobId
            if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
                throw new validation_1.ValidationError('Job ID is required and must be a non-empty string');
            }
            // Get existing configuration
            const existingConfig = await this.getJobConfigurationInternal(jobId);
            if (!existingConfig) {
                const errorMessage = `Job configuration with ID '${jobId}' not found`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            // Merge with existing configuration
            const mergedConfig = {
                ...existingConfig,
                ...config,
                jobId // Ensure jobId cannot be changed
            };
            // Validate merged configuration (Requirement 6.2)
            const validationResult = validation_1.ConfigurationValidator.validateJobConfiguration(mergedConfig);
            if (!validationResult.isValid) {
                const errorMessage = `Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId, errors: validationResult.errors });
                throw new validation_1.ValidationError(errorMessage);
            }
            // Log warnings if any
            if (validationResult.warnings && validationResult.warnings.length > 0) {
                this.logger.warn('ConfigurationManager', `Configuration warnings for job ${jobId}:`, validationResult.warnings);
            }
            // Update configuration in database (Requirement 6.5 - Persist configuration changes)
            const sql = `
        UPDATE job_configurations 
        SET name = ?, schedule = ?, expected_duration = ?, log_paths = ?, 
            data_source = ?, alert_channels = ?, sla_thresholds = ?, updated_at = datetime('now')
        WHERE job_id = ?
      `;
            const params = [
                mergedConfig.name,
                mergedConfig.schedule,
                mergedConfig.expectedDuration,
                JSON.stringify(mergedConfig.logPaths),
                JSON.stringify(mergedConfig.dataSource),
                JSON.stringify(mergedConfig.alertChannels),
                JSON.stringify(mergedConfig.slaThresholds),
                jobId
            ];
            const result = await this.db.run(sql, params);
            if (result.changes === 0) {
                const errorMessage = `No configuration found to update for job ID: ${jobId}`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            this.logger.info('ConfigurationManager', `Successfully updated job configuration: ${jobId}`);
        }
        catch (error) {
            const errorMessage = `Failed to update job configuration ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { jobId, error });
            throw error instanceof validation_1.ValidationError ? error : new Error(errorMessage);
        }
    }
    /**
     * Remove a job configuration from the system
     * Requirements: 6.4 - Support modifying existing job configurations (includes removal)
     */
    async removeJobConfiguration(jobId) {
        this.logger.info('ConfigurationManager', `Removing job configuration: ${jobId}`);
        try {
            // Validate jobId
            if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
                throw new validation_1.ValidationError('Job ID is required and must be a non-empty string');
            }
            // Check if configuration exists
            const existingConfig = await this.getJobConfigurationInternal(jobId);
            if (!existingConfig) {
                const errorMessage = `Job configuration with ID '${jobId}' not found`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            // Remove configuration from database (Requirement 6.5 - Persist configuration changes)
            const sql = 'DELETE FROM job_configurations WHERE job_id = ?';
            const result = await this.db.run(sql, [jobId]);
            if (result.changes === 0) {
                const errorMessage = `No configuration found to remove for job ID: ${jobId}`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            this.logger.info('ConfigurationManager', `Successfully removed job configuration: ${jobId}`);
        }
        catch (error) {
            const errorMessage = `Failed to remove job configuration ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { jobId, error });
            throw error instanceof validation_1.ValidationError ? error : new Error(errorMessage);
        }
    }
    /**
     * Get a specific job configuration by ID
     */
    async getJobConfiguration(jobId) {
        this.logger.debug('ConfigurationManager', `Retrieving job configuration: ${jobId}`);
        try {
            // Validate jobId
            if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
                throw new validation_1.ValidationError('Job ID is required and must be a non-empty string');
            }
            const config = await this.getJobConfigurationInternal(jobId);
            if (!config) {
                const errorMessage = `Job configuration with ID '${jobId}' not found`;
                this.logger.error('ConfigurationManager', errorMessage, { jobId });
                throw new Error(errorMessage);
            }
            this.logger.debug('ConfigurationManager', `Successfully retrieved job configuration: ${jobId}`);
            return config;
        }
        catch (error) {
            const errorMessage = `Failed to retrieve job configuration ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { jobId, error });
            throw error instanceof validation_1.ValidationError ? error : new Error(errorMessage);
        }
    }
    /**
     * Get all job configurations
     */
    async getAllJobConfigurations() {
        this.logger.debug('ConfigurationManager', 'Retrieving all job configurations');
        try {
            const sql = `
        SELECT job_id, name, schedule, expected_duration, log_paths, 
               data_source, alert_channels, sla_thresholds, created_at, updated_at
        FROM job_configurations 
        ORDER BY name
      `;
            const rows = await this.db.all(sql);
            const configurations = [];
            for (const row of rows) {
                try {
                    const config = this.parseConfigurationRow(row);
                    configurations.push(config);
                }
                catch (parseError) {
                    this.logger.error('ConfigurationManager', `Failed to parse configuration for job ${row.job_id}:`, parseError);
                    // Continue processing other configurations
                }
            }
            this.logger.debug('ConfigurationManager', `Successfully retrieved ${configurations.length} job configurations`);
            return configurations;
        }
        catch (error) {
            const errorMessage = `Failed to retrieve job configurations: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Validate a job configuration without persisting it
     * Requirements: 6.2 - Validate configuration parameters before accepting them
     */
    async validateConfiguration(config) {
        this.logger.debug('ConfigurationManager', `Validating job configuration: ${config.jobId}`);
        try {
            const validationResult = validation_1.ConfigurationValidator.validateJobConfiguration(config);
            if (validationResult.warnings && validationResult.warnings.length > 0) {
                this.logger.warn('ConfigurationManager', `Configuration warnings for job ${config.jobId}:`, validationResult.warnings);
            }
            if (!validationResult.isValid) {
                this.logger.warn('ConfigurationManager', `Configuration validation failed for job ${config.jobId}:`, validationResult.errors);
            }
            return validationResult.isValid;
        }
        catch (error) {
            this.logger.error('ConfigurationManager', `Failed to validate configuration for job ${config.jobId}:`, error);
            return false;
        }
    }
    /**
     * Internal method to get job configuration without additional validation
     */
    async getJobConfigurationInternal(jobId) {
        const sql = `
      SELECT job_id, name, schedule, expected_duration, log_paths, 
             data_source, alert_channels, sla_thresholds, created_at, updated_at
      FROM job_configurations 
      WHERE job_id = ?
    `;
        const row = await this.db.get(sql, [jobId]);
        if (!row) {
            return undefined;
        }
        return this.parseConfigurationRow(row);
    }
    /**
     * Parse a database row into a JobConfiguration object
     */
    parseConfigurationRow(row) {
        try {
            return {
                jobId: row.job_id,
                name: row.name,
                schedule: row.schedule,
                expectedDuration: row.expected_duration,
                logPaths: JSON.parse(row.log_paths),
                dataSource: JSON.parse(row.data_source),
                alertChannels: JSON.parse(row.alert_channels),
                slaThresholds: JSON.parse(row.sla_thresholds)
            };
        }
        catch (parseError) {
            const errorMessage = `Failed to parse configuration data for job ${row.job_id}: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
            this.logger.error('ConfigurationManager', errorMessage, { jobId: row.job_id, parseError });
            throw new Error(errorMessage);
        }
    }
    /**
     * Initialize the configuration manager (ensure database connection)
     */
    async initialize() {
        this.logger.info('ConfigurationManager', 'Initializing Configuration Manager');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            this.logger.info('ConfigurationManager', 'Configuration Manager initialized successfully');
        }
        catch (error) {
            const errorMessage = `Failed to initialize Configuration Manager: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('ConfigurationManager', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('ConfigurationManager', 'Cleaning up Configuration Manager');
        try {
            if (this.db.isConnected()) {
                await this.db.close();
            }
            this.logger.info('ConfigurationManager', 'Configuration Manager cleanup completed');
        }
        catch (error) {
            this.logger.error('ConfigurationManager', 'Error during Configuration Manager cleanup:', error);
            throw error;
        }
    }
}
exports.ConfigurationManagerService = ConfigurationManagerService;
//# sourceMappingURL=configuration-manager.js.map