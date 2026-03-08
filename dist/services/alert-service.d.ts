import { AlertService } from '../interfaces/services';
import { AlertMessage, AlertResult, AlertChannel } from '../types';
import { DatabaseConnection } from '../database/connection';
export declare class AlertServiceImpl implements AlertService {
    private db;
    private logger;
    private emailTransporter;
    private alertSuppressions;
    private recentAlerts;
    constructor(db: DatabaseConnection);
    /**
     * Send alert via all configured channels
     * Requirements: 3.1, 3.2 - Send alerts within 60 seconds for failures and delays
     */
    sendAlert(alert: AlertMessage): Promise<AlertResult[]>;
    /**
     * Configure an alert channel
     */
    configureAlertChannel(channel: AlertChannel): Promise<void>;
    /**
     * Suppress alerts for a specific job for a given duration
     */
    suppressAlerts(jobId: string, duration: number): Promise<void>;
    /**
     * Get alert history for a job or all jobs
     */
    getAlertHistory(jobId?: string, limit?: number): Promise<AlertMessage[]>;
    /**
     * Send alert to a specific channel
     */
    private sendToChannel;
    /**
     * Send alert via email
     * Requirements: 3.3 - Send notifications via email
     */
    private sendEmailAlert;
    /**
     * Send alert via Microsoft Teams
     * Requirements: 3.4 - Send notifications via Teams webhook
     */
    private sendTeamsAlert;
    /**
     * Format email subject line
     */
    private formatEmailSubject;
    /**
     * Format email HTML content
     * Requirements: 3.5 - Include job name, failure time, and error reason
     */
    private formatEmailContent;
    /**
     * Format email text content (fallback)
     */
    private formatEmailTextContent;
    /**
     * Format Teams message
     * Requirements: 3.5 - Include job name, failure time, and error reason
     */
    private formatTeamsMessage;
    /**
     * Check if alerts are suppressed for a job
     */
    private isAlertSuppressed;
    /**
     * Get alert channels configured for a job
     */
    private getAlertChannelsForJob;
    /**
     * Store alert in history
     */
    private storeAlertHistory;
    /**
     * Initialize email transporter
     */
    private initializeEmailTransporter;
    /**
     * Validate alert channel configuration
     */
    private validateAlertChannel;
    /**
     * Test alert channel connectivity
     */
    private testAlertChannel;
    /**
     * Sanitize endpoint for logging
     */
    private sanitizeEndpoint;
    /**
     * Sanitize channel for logging
     */
    private sanitizeChannel;
    /**
     * Initialize the alert service
     */
    initialize(): Promise<void>;
    /**
     * Cleanup expired alert suppressions
     */
    private cleanupExpiredSuppressions;
    /**
     * Cleanup old alert tracking entries
     */
    private cleanupOldAlertTracking;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=alert-service.d.ts.map