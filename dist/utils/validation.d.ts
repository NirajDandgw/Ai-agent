import { JobConfiguration, DataSourceConfig, SLAThresholds, AlertChannel, CredentialConfig } from '../types';
export declare class ValidationError extends Error {
    field?: string | undefined;
    code?: string | undefined;
    constructor(message: string, field?: string | undefined, code?: string | undefined);
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
export declare class ConfigurationValidator {
    private static readonly DEFAULT_OPTIONS;
    /**
     * Validates a complete job configuration
     * @param config The job configuration to validate
     * @param options Validation options
     * @returns ValidationResult with detailed error information
     */
    static validateJobConfiguration(config: JobConfiguration, options?: ValidationOptions): ValidationResult;
    /**
     * Validates job configuration and throws on first error (legacy method)
     */
    static validateJobConfigurationStrict(config: JobConfiguration): void;
    private static validateRequiredFields;
    private static validateJobIdentifiers;
    private static validateSchedule;
    private static validateDuration;
    private static validateLogPaths;
    private static validateAlertChannels;
    private static validateCrossFieldConstraints;
    static validateDataSourceConfig(config: DataSourceConfig, options?: ValidationOptions): ValidationResult;
    static validateSLAThresholds(thresholds: SLAThresholds, options?: ValidationOptions): ValidationResult;
    static validateAlertChannel(channel: AlertChannel, fieldPrefix?: string, options?: ValidationOptions): ValidationResult;
    static validateCredentialConfig(credentials: CredentialConfig, fieldPrefix: string, options: ValidationOptions): ValidationResult;
    private static isValidCronExpression;
    private static isValidEmail;
    private static isValidUrl;
    /**
     * Sanitizes configuration data by removing sensitive information for logging
     */
    static sanitizeConfigForLogging(config: JobConfiguration): Partial<JobConfiguration>;
    /**
     * Validates configuration parameters before accepting them (Requirement 6.2)
     */
    static validateConfigurationParameters(config: JobConfiguration): ValidationResult;
    /**
     * Ensures data integrity for all configuration fields (Requirement 6.2)
     */
    static ensureDataIntegrity(config: JobConfiguration): ValidationResult;
}
//# sourceMappingURL=validation.d.ts.map