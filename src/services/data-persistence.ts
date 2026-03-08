// Simple Data Persistence Service implementation for demo

import { DataPersistenceService, ExecutionQueryFilters } from '../interfaces/services';
import { JobExecution } from '../types';
import { DatabaseConnection } from '../database/connection';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class DataPersistenceServiceImpl implements DataPersistenceService {
  private db: DatabaseConnection;
  private logger: Logger;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.logger = Logger.getInstance();
  }

  async saveJobExecution(execution: JobExecution): Promise<void> {
    try {
      const sql = `
        INSERT OR REPLACE INTO job_executions (
          execution_id, job_id, start_time, end_time, status, 
          exit_code, failure_reason, log_analysis, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        execution.executionId,
        execution.jobId,
        execution.startTime.toISOString(),
        execution.endTime?.toISOString() || null,
        execution.status,
        execution.exitCode || null,
        execution.failureReason || null,
        execution.logAnalysis ? JSON.stringify(execution.logAnalysis) : null,
        execution.createdAt.toISOString(),
        execution.updatedAt.toISOString()
      ];

      await this.db.run(sql, params);
      this.logger.debug('DataPersistence', `Saved execution: ${execution.executionId}`);
    } catch (error) {
      this.logger.error('DataPersistence', `Failed to save execution ${execution.executionId}:`, error);
      throw error;
    }
  }

  async getJobExecutionHistory(jobId: string, days?: number): Promise<JobExecution[]> {
    try {
      const daysBack = days || 7;
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const sql = `
        SELECT * FROM job_executions 
        WHERE job_id = ? AND start_time >= ?
        ORDER BY start_time DESC
        LIMIT 50
      `;

      const rows = await this.db.all<any>(sql, [jobId, cutoffDate.toISOString()]);
      return rows.map(row => this.parseExecutionRow(row));
    } catch (error) {
      this.logger.error('DataPersistence', `Failed to get execution history for ${jobId}:`, error);
      throw error;
    }
  }

  async getJobExecution(executionId: string): Promise<JobExecution> {
    try {
      const sql = 'SELECT * FROM job_executions WHERE execution_id = ?';
      const row = await this.db.get<any>(sql, [executionId]);
      
      if (!row) {
        throw new Error(`Execution ${executionId} not found`);
      }

      return this.parseExecutionRow(row);
    } catch (error) {
      this.logger.error('DataPersistence', `Failed to get execution ${executionId}:`, error);
      throw error;
    }
  }

  async archiveOldExecutions(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const sql = 'DELETE FROM job_executions WHERE start_time < ?';
      const result = await this.db.run(sql, [cutoffDate.toISOString()]);
      
      this.logger.info('DataPersistence', `Archived ${result.changes} old executions`);
      return result.changes || 0;
    } catch (error) {
      this.logger.error('DataPersistence', 'Failed to archive old executions:', error);
      throw error;
    }
  }

  async queryExecutions(filters: ExecutionQueryFilters): Promise<JobExecution[]> {
    try {
      let sql = 'SELECT * FROM job_executions WHERE 1=1';
      const params: any[] = [];

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

      sql += ' ORDER BY start_time DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }

      const rows = await this.db.all<any>(sql, params);
      return rows.map(row => this.parseExecutionRow(row));
    } catch (error) {
      this.logger.error('DataPersistence', 'Failed to query executions:', error);
      throw error;
    }
  }

  private parseExecutionRow(row: any): JobExecution {
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
}