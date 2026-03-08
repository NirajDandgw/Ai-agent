"use strict";
// Data Persistence Service - Manages job execution history and data archival
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataPersistenceServiceImpl = void 0;
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const gzip = (0, util_1.promisify)(zlib.gzip);
const gunzip = (0, util_1.promisify)(zlib.gunzip);
class DataPersistenceServiceImpl {
    constructor(db, archiveDirectory = './data/archive') {
        this.retentionCleanupInterval = null;
        this.db = db;
        this.logger = logger_1.Logger.getInstance();
        this.archiveDirectory = archiveDirectory;
    }
    /**
     * Save job execution record
     * Requirements: 8.1 - Store job execution records with complete information
     */
    async saveJobExecution(execution) {
        this.logger.debug('DataPersistence', `Saving job execution: ${execution.executionId}`, {
            jobId: execution.jobId,
            status: execution.status
        });
        try {
            // Validate execution data
            this.validateJobExecution(execution);
            const sql = `
        INSERT OR REPLACE INTO job_executions (
          execution_id, job_id, start_time, end_time, status, exit_code,
          failure_reason, log_analysis, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
            const params = [
                execution.executionId,
                execution.jobId,
                execution.startTime.toISOString(),
                execution.endTime?.toISOString(),
                execution.status,
                execution.exitCode,
                execution.failureReason,
                execution.logAnalysis ? JSON.stringify(execution.logAnalysis) : null,
                execution.createdAt.toISOString()
            ];
            await this.db.run(sql, params);
            this.logger.debug('DataPersistence', `Successfully saved job execution: ${execution.executionId}`);
        }
        catch (error) {
            const errorMessage = `Failed to save job execution ${execution.executionId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { execution, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get job execution history for a specific job
     * Requirements: 8.2, 8.3 - Retain and query historical data
     */
    async getJobExecutionHistory(jobId, days = 30) {
        this.logger.debug('DataPersistence', `Retrieving execution history for job: ${jobId}`, { days });
        try {
            if (!jobId || typeof jobId !== 'string') {
                throw new Error('Job ID is required and must be a string');
            }
            if (days <= 0 || days > 365) {
                throw new Error('Days must be between 1 and 365');
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const sql = `
        SELECT execution_id, job_id, start_time, end_time, status, exit_code,
               failure_reason, log_analysis, created_at, updated_at
        FROM job_executions
        WHERE job_id = ? AND created_at >= ?
        ORDER BY start_time DESC
      `;
            const rows = await this.db.all(sql, [jobId, cutoffDate.toISOString()]);
            const executions = rows.map(row => this.parseExecutionRow(row));
            this.logger.debug('DataPersistence', `Retrieved ${executions.length} execution records for job: ${jobId}`);
            return executions;
        }
        catch (error) {
            const errorMessage = `Failed to get job execution history for ${jobId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { jobId, days, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get specific job execution by ID
     */
    async getJobExecution(executionId) {
        this.logger.debug('DataPersistence', `Retrieving job execution: ${executionId}`);
        try {
            if (!executionId || typeof executionId !== 'string') {
                throw new Error('Execution ID is required and must be a string');
            }
            const sql = `
        SELECT execution_id, job_id, start_time, end_time, status, exit_code,
               failure_reason, log_analysis, created_at, updated_at
        FROM job_executions
        WHERE execution_id = ?
      `;
            const row = await this.db.get(sql, [executionId]);
            if (!row) {
                throw new Error(`Job execution not found: ${executionId}`);
            }
            const execution = this.parseExecutionRow(row);
            this.logger.debug('DataPersistence', `Successfully retrieved job execution: ${executionId}`);
            return execution;
        }
        catch (error) {
            const errorMessage = `Failed to get job execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { executionId, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Archive old job executions
     * Requirements: 8.4 - Compress and archive data older than specified days
     */
    async archiveOldExecutions(olderThanDays) {
        this.logger.info('DataPersistence', `Starting archival of executions older than ${olderThanDays} days`);
        try {
            if (olderThanDays < 1) {
                throw new Error('Archive age must be at least 1 day');
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            // Get executions to archive
            const sql = `
        SELECT execution_id, job_id, start_time, end_time, status, exit_code,
               failure_reason, log_analysis, created_at, updated_at
        FROM job_executions
        WHERE created_at < ?
        ORDER BY created_at ASC
      `;
            const rows = await this.db.all(sql, [cutoffDate.toISOString()]);
            if (rows.length === 0) {
                this.logger.info('DataPersistence', 'No executions found for archival');
                return 0;
            }
            // Ensure archive directory exists
            await this.ensureArchiveDirectory();
            // Group executions by month for efficient archiving
            const executionsByMonth = this.groupExecutionsByMonth(rows);
            let archivedCount = 0;
            for (const [monthKey, executions] of executionsByMonth) {
                try {
                    await this.archiveExecutionsForMonth(monthKey, executions);
                    archivedCount += executions.length;
                }
                catch (archiveError) {
                    this.logger.error('DataPersistence', `Failed to archive executions for ${monthKey}:`, archiveError);
                    // Continue with other months
                }
            }
            // Remove archived executions from main database
            if (archivedCount > 0) {
                const deleteCount = await this.removeArchivedExecutions(cutoffDate);
                this.logger.info('DataPersistence', `Archived and removed ${deleteCount} job executions`);
            }
            this.logger.info('DataPersistence', `Archival completed: ${archivedCount} executions archived`);
            return archivedCount;
        }
        catch (error) {
            const errorMessage = `Failed to archive old executions: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { olderThanDays, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Query executions with filters
     * Requirements: 8.3 - Provide APIs to query historical job execution data
     */
    async queryExecutions(filters) {
        this.logger.debug('DataPersistence', 'Querying job executions with filters', filters);
        try {
            let sql = `
        SELECT execution_id, job_id, start_time, end_time, status, exit_code,
               failure_reason, log_analysis, created_at, updated_at
        FROM job_executions
        WHERE 1=1
      `;
            const params = [];
            // Apply filters
            if (filters.jobId) {
                sql += ' AND job_id = ?';
                params.push(filters.jobId);
            }
            if (filters.status) {
                sql += ' AND status = ?';
                params.push(filters.status);
            }
            if (filters.startDate) {
                sql += ' AND start_time >= ?';
                params.push(filters.startDate.toISOString());
            }
            if (filters.endDate) {
                sql += ' AND start_time <= ?';
                params.push(filters.endDate.toISOString());
            }
            // Add ordering
            sql += ' ORDER BY start_time DESC';
            // Apply pagination
            if (filters.limit) {
                sql += ' LIMIT ?';
                params.push(filters.limit);
            }
            if (filters.offset) {
                sql += ' OFFSET ?';
                params.push(filters.offset);
            }
            const rows = await this.db.all(sql, params);
            const executions = rows.map(row => this.parseExecutionRow(row));
            this.logger.debug('DataPersistence', `Query returned ${executions.length} execution records`);
            return executions;
        }
        catch (error) {
            const errorMessage = `Failed to query job executions: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { filters, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Validate job execution data
     * Requirements: 8.5 - Ensure data integrity
     */
    validateJobExecution(execution) {
        if (!execution.executionId || typeof execution.executionId !== 'string') {
            throw new Error('Execution ID is required and must be a string');
        }
        if (!execution.jobId || typeof execution.jobId !== 'string') {
            throw new Error('Job ID is required and must be a string');
        }
        if (!execution.startTime || !(execution.startTime instanceof Date)) {
            throw new Error('Start time is required and must be a Date');
        }
        if (execution.endTime && !(execution.endTime instanceof Date)) {
            throw new Error('End time must be a Date if provided');
        }
        if (execution.endTime && execution.endTime < execution.startTime) {
            throw new Error('End time cannot be before start time');
        }
        if (!execution.status || !['Running', 'Success', 'Failed', 'Delayed'].includes(execution.status)) {
            throw new Error('Status must be one of: Running, Success, Failed, Delayed');
        }
        if (!execution.createdAt || !(execution.createdAt instanceof Date)) {
            throw new Error('Created at is required and must be a Date');
        }
        if (!execution.updatedAt || !(execution.updatedAt instanceof Date)) {
            throw new Error('Updated at is required and must be a Date');
        }
    }
    /**
     * Parse database row into JobExecution object
     */
    parseExecutionRow(row) {
        try {
            return {
                executionId: row.execution_id,
                jobId: row.job_id,
                startTime: new Date(row.start_time),
                endTime: row.end_time ? new Date(row.end_time) : undefined,
                status: row.status,
                exitCode: row.exit_code,
                failureReason: row.failure_reason,
                logAnalysis: row.log_analysis ? JSON.parse(row.log_analysis) : undefined,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            };
        }
        catch (parseError) {
            const errorMessage = `Failed to parse execution row: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
            this.logger.error('DataPersistence', errorMessage, { row, parseError });
            throw new Error(errorMessage);
        }
    }
    /**
     * Ensure archive directory exists
     */
    async ensureArchiveDirectory() {
        try {
            await fs.mkdir(this.archiveDirectory, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw new Error(`Failed to create archive directory: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    /**
     * Group executions by month for efficient archiving
     */
    groupExecutionsByMonth(rows) {
        const groups = new Map();
        for (const row of rows) {
            const date = new Date(row.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groups.has(monthKey)) {
                groups.set(monthKey, []);
            }
            groups.get(monthKey).push(row);
        }
        return groups;
    }
    /**
     * Archive executions for a specific month
     * Requirements: 8.4 - Compress and archive historical data
     */
    async archiveExecutionsForMonth(monthKey, executions) {
        try {
            const archiveFileName = `executions-${monthKey}.json.gz`;
            const archiveFilePath = path.join(this.archiveDirectory, archiveFileName);
            // Convert executions to JSON
            const archiveData = {
                month: monthKey,
                archivedAt: new Date().toISOString(),
                executionCount: executions.length,
                executions: executions.map(row => this.parseExecutionRow(row))
            };
            const jsonData = JSON.stringify(archiveData, null, 2);
            // Compress data
            const compressedData = await gzip(Buffer.from(jsonData, 'utf8'));
            // Write to archive file
            await fs.writeFile(archiveFilePath, compressedData);
            this.logger.info('DataPersistence', `Archived ${executions.length} executions for ${monthKey}`, {
                archiveFile: archiveFileName,
                originalSize: jsonData.length,
                compressedSize: compressedData.length,
                compressionRatio: ((1 - compressedData.length / jsonData.length) * 100).toFixed(1) + '%'
            });
        }
        catch (error) {
            throw new Error(`Failed to archive executions for ${monthKey}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Remove archived executions from main database
     */
    async removeArchivedExecutions(cutoffDate) {
        try {
            const sql = 'DELETE FROM job_executions WHERE created_at < ?';
            const result = await this.db.run(sql, [cutoffDate.toISOString()]);
            return result.changes || 0;
        }
        catch (error) {
            throw new Error(`Failed to remove archived executions: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Retrieve archived executions (for data recovery)
     */
    async retrieveArchivedExecutions(monthKey) {
        this.logger.info('DataPersistence', `Retrieving archived executions for: ${monthKey}`);
        try {
            const archiveFileName = `executions-${monthKey}.json.gz`;
            const archiveFilePath = path.join(this.archiveDirectory, archiveFileName);
            // Check if archive file exists
            try {
                await fs.access(archiveFilePath);
            }
            catch {
                throw new Error(`Archive file not found for month: ${monthKey}`);
            }
            // Read and decompress archive file
            const compressedData = await fs.readFile(archiveFilePath);
            const decompressedData = await gunzip(compressedData);
            const archiveData = JSON.parse(decompressedData.toString('utf8'));
            // Parse executions
            const executions = archiveData.executions.map((exec) => ({
                ...exec,
                startTime: new Date(exec.startTime),
                endTime: exec.endTime ? new Date(exec.endTime) : undefined,
                createdAt: new Date(exec.createdAt),
                updatedAt: new Date(exec.updatedAt)
            }));
            this.logger.info('DataPersistence', `Retrieved ${executions.length} archived executions for ${monthKey}`);
            return executions;
        }
        catch (error) {
            const errorMessage = `Failed to retrieve archived executions for ${monthKey}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { monthKey, error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Get archive statistics
     */
    async getArchiveStatistics() {
        try {
            const files = await fs.readdir(this.archiveDirectory);
            const archiveFiles = files.filter(f => f.endsWith('.json.gz'));
            let totalExecutions = 0;
            let totalSize = 0;
            let oldestArchive = null;
            let newestArchive = null;
            for (const file of archiveFiles) {
                const filePath = path.join(this.archiveDirectory, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                // Extract month from filename
                const monthMatch = file.match(/executions-(\d{4}-\d{2})\.json\.gz/);
                if (monthMatch) {
                    const month = monthMatch[1];
                    if (!oldestArchive || month < oldestArchive) {
                        oldestArchive = month;
                    }
                    if (!newestArchive || month > newestArchive) {
                        newestArchive = month;
                    }
                }
                // Count executions in this archive (quick estimate from filename pattern)
                try {
                    const compressedData = await fs.readFile(filePath);
                    const decompressedData = await gunzip(compressedData);
                    const archiveData = JSON.parse(decompressedData.toString('utf8'));
                    totalExecutions += archiveData.executionCount || 0;
                }
                catch {
                    // If we can't read the archive, skip counting
                }
            }
            return {
                totalArchiveFiles: archiveFiles.length,
                totalArchivedExecutions: totalExecutions,
                oldestArchive,
                newestArchive,
                totalArchiveSize: totalSize
            };
        }
        catch (error) {
            this.logger.error('DataPersistence', 'Failed to get archive statistics:', error);
            return {
                totalArchiveFiles: 0,
                totalArchivedExecutions: 0,
                oldestArchive: null,
                newestArchive: null,
                totalArchiveSize: 0
            };
        }
    }
    /**
     * Start automatic retention cleanup
     * Requirements: 8.2 - Retain job execution history for at least 30 days
     */
    async startRetentionCleanup(retentionDays = 30, cleanupIntervalHours = 24) {
        this.logger.info('DataPersistence', `Starting automatic retention cleanup`, {
            retentionDays,
            cleanupIntervalHours
        });
        try {
            if (this.retentionCleanupInterval) {
                clearInterval(this.retentionCleanupInterval);
            }
            // Perform initial cleanup
            await this.archiveOldExecutions(retentionDays);
            // Set up periodic cleanup
            this.retentionCleanupInterval = setInterval(async () => {
                try {
                    await this.archiveOldExecutions(retentionDays);
                }
                catch (error) {
                    this.logger.error('DataPersistence', 'Error during automatic retention cleanup:', error);
                }
            }, cleanupIntervalHours * 60 * 60 * 1000);
            this.logger.info('DataPersistence', 'Automatic retention cleanup started successfully');
        }
        catch (error) {
            const errorMessage = `Failed to start retention cleanup: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Stop automatic retention cleanup
     */
    async stopRetentionCleanup() {
        this.logger.info('DataPersistence', 'Stopping automatic retention cleanup');
        try {
            if (this.retentionCleanupInterval) {
                clearInterval(this.retentionCleanupInterval);
                this.retentionCleanupInterval = null;
            }
            this.logger.info('DataPersistence', 'Automatic retention cleanup stopped');
        }
        catch (error) {
            this.logger.error('DataPersistence', 'Error stopping retention cleanup:', error);
            throw error;
        }
    }
    /**
     * Initialize the data persistence service
     */
    async initialize() {
        this.logger.info('DataPersistence', 'Initializing Data Persistence Service');
        try {
            if (!this.db.isConnected()) {
                await this.db.connect();
                await this.db.initializeSchema();
            }
            // Ensure archive directory exists
            await this.ensureArchiveDirectory();
            // Start automatic retention cleanup (30 days retention, daily cleanup)
            await this.startRetentionCleanup(30, 24);
            this.logger.info('DataPersistence', 'Data Persistence Service initialized successfully');
        }
        catch (error) {
            const errorMessage = `Failed to initialize Data Persistence Service: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('DataPersistence', errorMessage, { error });
            throw new Error(errorMessage);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('DataPersistence', 'Cleaning up Data Persistence Service');
        try {
            await this.stopRetentionCleanup();
            this.logger.info('DataPersistence', 'Data Persistence Service cleanup completed');
        }
        catch (error) {
            this.logger.error('DataPersistence', 'Error during Data Persistence Service cleanup:', error);
            throw error;
        }
    }
}
exports.DataPersistenceServiceImpl = DataPersistenceServiceImpl;
//# sourceMappingURL=data-persistence.js.map