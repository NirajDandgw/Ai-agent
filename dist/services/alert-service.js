"use strict";
// Alert Service - Handles alert delivery via multiple channels
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertServiceImpl = void 0;
const logger_1 = require("../utils/logger");
const nodemailer = __importStar(require("nodemailer"));
const axios_1 = __importDefault(require("axios"));
// Simple UUID generator for testing
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
class AlertServiceImpl {
    constructor(db) {
        this.emailTransporter = null;
        this.alertSuppressions = new Map(); // jobId -> suppression end time
        this.recentAlerts = new Map(); // alert key -> last sent time
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
    }
    /**
     * Send alert via all configured channels
     * Requirements: 3.1, 3.2 - Send alerts within 60 seconds for failures and delays
     */
    async sendAlert(alert) {
        this.logger.info('AlertService', `Sending alert for job: ${alert.jobId}`, {
            alertType: alert.alertType,
            severity: alert.severity
        });
        const startTime = Date.now();
        const results = [];
        try {
            // Check if alerts are suppressed for this job
            if (this.isAlertSuppressed(alert.jobId)) {
                this.logger.info('AlertService', `Alerts suppressed for job: ${alert.jobId}`);
                return [{
                        success: false,
                        channelType: 'Suppressed',
                        error: 'Alerts are currently suppressed for this job'
                    }];
            }
            // Check for duplicate alerts (Requirement 3.6)
            const alertKey = `${alert.jobId}-${alert.alertType}`;
            const lastSentTime = this.recentAlerts.get(alertKey);
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            if (lastSentTime && lastSentTime > thirtyMinutesAgo) {
                this.logger.info('AlertService', `Duplicate alert suppressed for job: ${alert.jobId}`, {
                    alertType: alert.alertType,
                    lastSent: lastSentTime
                });
                return [{
                        success: false,
                        channelType: 'Duplicate',
                        error: 'Duplicate alert suppressed (sent within last 30 minutes)'
                    }];
            }
            // Get configured alert channels for this job
            const channels = await this.getAlertChannelsForJob(alert.jobId);
            if (channels.length === 0) {
                this.logger.warn('AlertService', `No alert channels configured for job: ${alert.jobId}`);
                return [{
                        success: false,
                        channelType: 'NoChannels',
                        error: 'No alert channels configured for this job'
                    }];
            }
            // Send alert to each channel
            const sendPromises = channels.map(async (channel) => {
                try {
                    const result = await this.sendToChannel(alert, channel);
                    return result;
                }
                catch (error) {
                    this.logger.error('AlertService', `Failed to send alert via ${channel.type}:`, error);
                    return {
                        success: false,
                        channelType: channel.type,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            });
            const channelResults = await Promise.allSettled(sendPromises);
            // Process results
            for (const result of channelResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    results.push({
                        success: false,
                        channelType: 'Unknown',
                        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
                    });
                }
            }
            // Update recent alerts tracking
            this.recentAlerts.set(alertKey, new Date());
            // Store alert in history
            await this.storeAlertHistory(alert, results);
            const deliveryTime = Date.now() - startTime;
            const successfulDeliveries = results.filter(r => r.success).length;
            this.logger.info('AlertService', `Alert delivery completed for job: ${alert.jobId}`, {
                deliveryTimeMs: deliveryTime,
                totalChannels: channels.length,
                successfulDeliveries,
                failedDeliveries: results.length - successfulDeliveries
            });
            // Check if delivery was within 60 seconds (Requirements 3.1, 3.2)
            if (deliveryTime > 60000) {
                this.logger.warn('AlertService', `Alert delivery took longer than 60 seconds: ${deliveryTime}ms`, {
                    jobId: alert.jobId
                });
            }
            return results;
        }
        catch (error) {
            const errorMessage = `Failed to send alert for job ${alert.jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('AlertService', errorMessage, { alert, error });
            return [{
                    success: false,
                    channelType: 'System',
                    error: errorMessage
                }];
        }
    }
    /**
     * Configure an alert channel
     */
    async configureAlertChannel(channel) {
        this.logger.info('AlertService', `Configuring alert channel: ${channel.type}`, {
            endpoint: this.sanitizeEndpoint(channel.endpoint),
            enabled: channel.enabled
        });
        try {
            // Validate channel configuration
            await this.validateAlertChannel(channel);
            // Test channel connectivity
            await this.testAlertChannel(channel);
            this.logger.info('AlertService', `Successfully configured alert channel: ${channel.type}`);
        }
        catch (error) {
            const errorMessage = `Failed to configure alert channel ${channel.type}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('AlertService', errorMessage, { channel: this.sanitizeChannel(channel), error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Suppress alerts for a specific job for a given duration
     */
    async suppressAlerts(jobId, duration) {
        this.logger.info('AlertService', `Suppressing alerts for job: ${jobId}`, {
            durationMinutes: duration
        });
        try {
            if (!jobId || typeof jobId !== 'string') {
                throw new Error('Job ID is required and must be a string');
            }
            if (!duration || duration <= 0) {
                throw new Error('Duration must be a positive number (in minutes)');
            }
            const suppressionEndTime = new Date(Date.now() + duration * 60 * 1000);
            this.alertSuppressions.set(jobId, suppressionEndTime);
            this.logger.info('AlertService', `Alerts suppressed for job: ${jobId} until ${suppressionEndTime.toISOString()}`);
        }
        catch (error) {
            const errorMessage = `Failed to suppress alerts for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('AlertService', errorMessage, { jobId, duration, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get alert history for a job or all jobs
     */
    async getAlertHistory(jobId, limit = 100) {
        this.logger.debug('AlertService', 'Retrieving alert history', { jobId, limit });
        try {
            let sql = `
        SELECT job_id, job_name, alert_type, message, timestamp, severity, 
               failure_reason, channels_sent
        FROM alert_history
      `;
            const params = [];
            if (jobId) {
                sql += ' WHERE job_id = ?';
                params.push(jobId);
            }
            sql += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);
            const rows = await this.db.all(sql, params);
            const alerts = rows.map(row => ({
                jobId: row.job_id,
                jobName: row.job_name,
                alertType: row.alert_type,
                message: row.message,
                timestamp: new Date(row.timestamp),
                severity: row.severity,
                failureReason: row.failure_reason
            }));
            this.logger.debug('AlertService', `Retrieved ${alerts.length} alert history records`);
            return alerts;
        }
        catch (error) {
            const errorMessage = `Failed to get alert history: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('AlertService', errorMessage, { jobId, limit, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Send alert to a specific channel
     */
    async sendToChannel(alert, channel) {
        if (!channel.enabled) {
            return {
                success: false,
                channelType: channel.type,
                error: 'Channel is disabled'
            };
        }
        switch (channel.type) {
            case 'Email':
                return this.sendEmailAlert(alert, channel);
            case 'Teams':
                return this.sendTeamsAlert(alert, channel);
            default:
                return {
                    success: false,
                    channelType: channel.type,
                    error: `Unsupported channel type: ${channel.type}`
                };
        }
    }
    /**
     * Send alert via email
     * Requirements: 3.3 - Send notifications via email
     */
    async sendEmailAlert(alert, channel) {
        this.logger.debug('AlertService', `Sending email alert for job: ${alert.jobId}`);
        try {
            // Initialize email transporter if not already done
            if (!this.emailTransporter) {
                await this.initializeEmailTransporter(channel);
            }
            // Format email content (Requirement 3.5)
            const subject = this.formatEmailSubject(alert);
            const htmlContent = this.formatEmailContent(alert);
            const textContent = this.formatEmailTextContent(alert);
            // Send email
            const mailOptions = {
                from: process.env.SMTP_FROM || 'batch-monitor@company.com',
                to: channel.endpoint,
                subject,
                text: textContent,
                html: htmlContent
            };
            const info = await this.emailTransporter.sendMail(mailOptions);
            this.logger.debug('AlertService', `Email sent successfully for job: ${alert.jobId}`, {
                messageId: info.messageId,
                to: channel.endpoint
            });
            return {
                success: true,
                channelType: 'Email',
                deliveredAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('AlertService', `Failed to send email alert for job ${alert.jobId}:`, error);
            return {
                success: false,
                channelType: 'Email',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Send alert via Microsoft Teams
     * Requirements: 3.4 - Send notifications via Teams webhook
     */
    async sendTeamsAlert(alert, channel) {
        this.logger.debug('AlertService', `Sending Teams alert for job: ${alert.jobId}`);
        try {
            // Format Teams message (Requirement 3.5)
            const teamsMessage = this.formatTeamsMessage(alert);
            // Send to Teams webhook
            const response = await axios_1.default.post(channel.endpoint, teamsMessage, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            if (response.status === 200) {
                this.logger.debug('AlertService', `Teams alert sent successfully for job: ${alert.jobId}`);
                return {
                    success: true,
                    channelType: 'Teams',
                    deliveredAt: new Date()
                };
            }
            else {
                throw new Error(`Teams webhook returned status: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error('AlertService', `Failed to send Teams alert for job ${alert.jobId}:`, error);
            return {
                success: false,
                channelType: 'Teams',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Format email subject line
     */
    formatEmailSubject(alert) {
        const severityPrefix = alert.severity === 'Critical' ? '🚨 CRITICAL' :
            alert.severity === 'High' ? '⚠️ HIGH' :
                alert.severity === 'Medium' ? '⚡ MEDIUM' : 'ℹ️ LOW';
        return `${severityPrefix}: ${alert.alertType} - ${alert.jobName}`;
    }
    /**
     * Format email HTML content
     * Requirements: 3.5 - Include job name, failure time, and error reason
     */
    formatEmailContent(alert) {
        const severityColor = alert.severity === 'Critical' ? '#dc3545' :
            alert.severity === 'High' ? '#fd7e14' :
                alert.severity === 'Medium' ? '#ffc107' : '#17a2b8';
        return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">${alert.alertType} Alert</h1>
              <p style="margin: 5px 0 0 0; font-size: 16px;">Severity: ${alert.severity}</p>
            </div>
            <div style="padding: 20px;">
              <h2 style="color: #333; margin-top: 0;">Job Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Job Name:</td>
                  <td style="padding: 8px 0;">${alert.jobName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Job ID:</td>
                  <td style="padding: 8px 0;">${alert.jobId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Alert Time:</td>
                  <td style="padding: 8px 0;">${alert.timestamp.toLocaleString()}</td>
                </tr>
                ${alert.failureReason ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Failure Reason:</td>
                  <td style="padding: 8px 0; color: #dc3545;">${alert.failureReason}</td>
                </tr>
                ` : ''}
              </table>
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid ${severityColor};">
                <h3 style="margin-top: 0; color: #333;">Message</h3>
                <p style="margin-bottom: 0;">${alert.message}</p>
              </div>
            </div>
            <div style="padding: 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px;">
              This alert was generated by the Batch Job Monitoring System
            </div>
          </div>
        </body>
      </html>
    `;
    }
    /**
     * Format email text content (fallback)
     */
    formatEmailTextContent(alert) {
        return `
${alert.alertType} Alert - ${alert.severity} Severity

Job Details:
- Job Name: ${alert.jobName}
- Job ID: ${alert.jobId}
- Alert Time: ${alert.timestamp.toLocaleString()}
${alert.failureReason ? `- Failure Reason: ${alert.failureReason}` : ''}

Message:
${alert.message}

---
This alert was generated by the Batch Job Monitoring System
    `.trim();
    }
    /**
     * Format Teams message
     * Requirements: 3.5 - Include job name, failure time, and error reason
     */
    formatTeamsMessage(alert) {
        const severityColor = alert.severity === 'Critical' ? 'attention' :
            alert.severity === 'High' ? 'warning' :
                alert.severity === 'Medium' ? 'good' : 'accent';
        return {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": severityColor === 'attention' ? 'FF0000' :
                severityColor === 'warning' ? 'FFA500' :
                    severityColor === 'good' ? 'FFFF00' : '0078D4',
            "summary": `${alert.alertType} Alert: ${alert.jobName}`,
            "sections": [{
                    "activityTitle": `${alert.alertType} Alert`,
                    "activitySubtitle": `Severity: ${alert.severity}`,
                    "facts": [
                        {
                            "name": "Job Name",
                            "value": alert.jobName
                        },
                        {
                            "name": "Job ID",
                            "value": alert.jobId
                        },
                        {
                            "name": "Alert Time",
                            "value": alert.timestamp.toLocaleString()
                        },
                        ...(alert.failureReason ? [{
                                "name": "Failure Reason",
                                "value": alert.failureReason
                            }] : [])
                    ],
                    "text": alert.message
                }]
        };
    }
    /**
     * Check if alerts are suppressed for a job
     */
    isAlertSuppressed(jobId) {
        const suppressionEndTime = this.alertSuppressions.get(jobId);
        if (!suppressionEndTime) {
            return false;
        }
        const now = new Date();
        if (now > suppressionEndTime) {
            // Suppression has expired, remove it
            this.alertSuppressions.delete(jobId);
            return false;
        }
        return true;
    }
    /**
     * Get alert channels configured for a job
     */
    async getAlertChannelsForJob(jobId) {
        try {
            const sql = 'SELECT alert_channels FROM job_configurations WHERE job_id = ?';
            const row = await this.db.get(sql, [jobId]);
            if (!row || !row.alert_channels) {
                return [];
            }
            return JSON.parse(row.alert_channels);
        }
        catch (error) {
            this.logger.error('AlertService', `Failed to get alert channels for job ${jobId}:`, error);
            return [];
        }
    }
    /**
     * Store alert in history
     */
    async storeAlertHistory(alert, results) {
        try {
            const alertId = generateId();
            const sql = `
        INSERT INTO alert_history (
          alert_id, job_id, job_name, alert_type, message, timestamp,
          severity, failure_reason, channels_sent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
            await this.db.run(sql, [
                alertId,
                alert.jobId,
                alert.jobName,
                alert.alertType,
                alert.message,
                alert.timestamp.toISOString(),
                alert.severity,
                alert.failureReason,
                JSON.stringify(results)
            ]);
            this.logger.debug('AlertService', `Stored alert history: ${alertId}`, {
                jobId: alert.jobId
            });
        }
        catch (error) {
            this.logger.error('AlertService', 'Failed to store alert history:', error);
            // Don't throw here as alert delivery is more important
        }
    }
    /**
     * Initialize email transporter
     */
    async initializeEmailTransporter(channel) {
        try {
            // Use environment variables or channel credentials for SMTP configuration
            const smtpConfig = {
                host: process.env.SMTP_HOST || 'localhost',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: channel.credentials ? {
                    user: channel.credentials.username || process.env.SMTP_USER,
                    pass: channel.credentials.password || process.env.SMTP_PASS
                } : undefined
            };
            this.emailTransporter = nodemailer.createTransport(smtpConfig);
            // Verify connection
            if (this.emailTransporter) {
                await this.emailTransporter.verify();
            }
            this.logger.info('AlertService', 'Email transporter initialized successfully');
        }
        catch (error) {
            this.logger.error('AlertService', 'Failed to initialize email transporter:', error);
            throw new Error(`Email configuration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Validate alert channel configuration
     */
    async validateAlertChannel(channel) {
        if (!channel.type || !['Email', 'Teams'].includes(channel.type)) {
            throw new Error('Invalid channel type. Must be Email or Teams');
        }
        if (!channel.endpoint || typeof channel.endpoint !== 'string') {
            throw new Error('Channel endpoint is required');
        }
        if (channel.type === 'Email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(channel.endpoint)) {
                throw new Error('Invalid email address format');
            }
        }
        if (channel.type === 'Teams') {
            try {
                new URL(channel.endpoint);
            }
            catch {
                throw new Error('Invalid Teams webhook URL format');
            }
        }
    }
    /**
     * Test alert channel connectivity
     */
    async testAlertChannel(channel) {
        // For now, just validate the configuration
        // In a production system, you might send a test message
        this.logger.debug('AlertService', `Testing alert channel: ${channel.type}`);
    }
    /**
     * Sanitize endpoint for logging
     */
    sanitizeEndpoint(endpoint) {
        if (endpoint.includes('@')) {
            // Email - show domain only
            const parts = endpoint.split('@');
            return `***@${parts[1]}`;
        }
        if (endpoint.startsWith('http')) {
            // URL - show domain only
            try {
                const url = new URL(endpoint);
                return `${url.protocol}//${url.hostname}/***`;
            }
            catch {
                return '***';
            }
        }
        return '***';
    }
    /**
     * Sanitize channel for logging
     */
    sanitizeChannel(channel) {
        return {
            type: channel.type,
            endpoint: this.sanitizeEndpoint(channel.endpoint),
            enabled: channel.enabled
        };
    }
    /**
     * Initialize the alert service
     */
    async initialize() {
        this.logger.info('AlertService', 'Initializing Alert Service');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            // Clean up expired suppressions periodically
            setInterval(() => {
                this.cleanupExpiredSuppressions();
            }, 5 * 60 * 1000); // Every 5 minutes
            // Clean up old recent alerts tracking
            setInterval(() => {
                this.cleanupOldAlertTracking();
            }, 60 * 60 * 1000); // Every hour
            this.logger.info('AlertService', 'Alert Service initialized successfully');
        }
        catch (error) {
            const errorMessage = `Failed to initialize Alert Service: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('AlertService', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup expired alert suppressions
     */
    cleanupExpiredSuppressions() {
        const now = new Date();
        const expiredJobs = [];
        for (const [jobId, endTime] of this.alertSuppressions) {
            if (now > endTime) {
                expiredJobs.push(jobId);
            }
        }
        for (const jobId of expiredJobs) {
            this.alertSuppressions.delete(jobId);
        }
        if (expiredJobs.length > 0) {
            this.logger.debug('AlertService', `Cleaned up ${expiredJobs.length} expired alert suppressions`);
        }
    }
    /**
     * Cleanup old alert tracking entries
     */
    cleanupOldAlertTracking() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const expiredKeys = [];
        for (const [key, time] of this.recentAlerts) {
            if (time < oneHourAgo) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.recentAlerts.delete(key);
        }
        if (expiredKeys.length > 0) {
            this.logger.debug('AlertService', `Cleaned up ${expiredKeys.length} old alert tracking entries`);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('AlertService', 'Cleaning up Alert Service');
        try {
            if (this.emailTransporter) {
                this.emailTransporter = null;
            }
            this.alertSuppressions.clear();
            this.recentAlerts.clear();
            this.logger.info('AlertService', 'Alert Service cleanup completed');
        }
        catch (error) {
            this.logger.error('AlertService', 'Error during Alert Service cleanup:', error);
            throw error;
        }
    }
}
exports.AlertServiceImpl = AlertServiceImpl;
//# sourceMappingURL=alert-service.js.map