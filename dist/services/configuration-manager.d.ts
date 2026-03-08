import { ConfigurationManager } from '../interfaces/services';
import { JobConfiguration } from '../types';
import { DatabaseConnection } from '../database/connection';
export declare class ConfigurationManagerService implements ConfigurationManager {
    private db;
    private logger;
    constructor(db: DatabaseConnection);
    /**
     * Add a new job configuration to the system
     * Requirements: 6.3 - Support adding new job configurations without system restart
     */
    addJobConfiguration(config: JobConfiguration): Promise<void>;
    /**
     * Update an existing job configuration
     * Requirements: 6.4 - Support modifying existing job configurations
     */
    updateJobConfiguration(jobId: string, config: Partial<JobConfiguration>): Promise<void>;
    /**
     * Remove a job configuration from the system
     * Requirements: 6.4 - Support modifying existing job configurations (includes removal)
     */
    removeJobConfiguration(jobId: string): Promise<void>;
    /**
     * Get a specific job configuration by ID
     */
    getJobConfiguration(jobId: string): Promise<JobConfiguration>;
    /**
     * Get all job configurations
     */
    getAllJobConfigurations(): Promise<JobConfiguration[]>;
    /**
     * Validate a job configuration without persisting it
     * Requirements: 6.2 - Validate configuration parameters before accepting them
     */
    validateConfiguration(config: JobConfiguration): Promise<boolean>;
    /**
     * Internal method to get job configuration without additional validation
     */
    private getJobConfigurationInternal;
    /**
     * Parse a database row into a JobConfiguration object
     */
    private parseConfigurationRow;
    /**
     * Initialize the configuration manager (ensure database connection)
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=configuration-manager.d.ts.map