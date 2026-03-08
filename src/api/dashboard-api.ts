// Dashboard API endpoints for the batch job monitoring system

import express from 'express';
import cors from 'cors';
import { ConfigurationManagerService } from '../services/configuration-manager';
import { DashboardServiceImpl } from '../services/dashboard-service';
import { JobMonitorServiceImpl } from '../services/job-monitor';
import { AlertServiceImpl } from '../services/alert-service';
import { Logger } from '../utils/logger';

export class DashboardAPI {
  private app: express.Application;
  private server: any;
  private dashboardService: DashboardServiceImpl;
  private configManager: ConfigurationManagerService;
  private jobMonitor: JobMonitorServiceImpl;
  private alertService: AlertServiceImpl;
  private logger: Logger;

  constructor(
    dashboardService: DashboardServiceImpl,
    configManager: ConfigurationManagerService,
    jobMonitor: JobMonitorServiceImpl,
    alertService: AlertServiceImpl
  ) {
    this.app = express();
    this.dashboardService = dashboardService;
    this.configManager = configManager;
    this.jobMonitor = jobMonitor;
    this.alertService = alertService;
    this.logger = Logger.getInstance();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    // Dashboard data endpoints
    this.app.get('/api/jobs', this.getJobs.bind(this));
    this.app.get('/api/jobs/:jobId', this.getJob.bind(this));
    this.app.get('/api/jobs/:jobId/executions', this.getJobExecutions.bind(this));
    this.app.get('/api/executions/recent', this.getRecentExecutions.bind(this));
    this.app.get('/api/dashboard/summary', this.getDashboardSummary.bind(this));
    
    // Configuration management endpoints
    this.app.post('/api/jobs', this.createJob.bind(this));
    this.app.put('/api/jobs/:jobId', this.updateJob.bind(this));
    this.app.delete('/api/jobs/:jobId', this.deleteJob.bind(this));
    
    // Health check
    this.app.get('/api/health', this.getHealth.bind(this));
    
    // Serve dashboard UI
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });
  }

  private async getJobs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const jobs = await this.dashboardService.getFilteredJobs(status);
      
      res.json({
        success: true,
        data: jobs,
        total: jobs.length
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to get jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve jobs'
      });
    }
  }

  private async getJob(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await this.jobMonitor.getJobStatus(jobId);
      
      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to get job:', error);
      res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
  }

  private async getJobExecutions(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const days = parseInt(req.query.days as string) || 7;
      const executions = await this.dashboardService.getJobExecutionHistory(jobId, days);
      
      res.json({
        success: true,
        data: executions,
        total: executions.length
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to get job executions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve job executions'
      });
    }
  }

  private async getRecentExecutions(req: express.Request, res: express.Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const days = parseInt(req.query.days as string) || 7;
      const executions = await this.dashboardService.getJobExecutionHistory(undefined, days);
      
      res.json({
        success: true,
        data: executions.slice(0, limit),
        total: executions.length
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to get recent executions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent executions'
      });
    }
  }

  private async getDashboardSummary(req: express.Request, res: express.Response): Promise<void> {
    try {
      const summary = await this.dashboardService.getJobStatusSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to get dashboard summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard summary'
      });
    }
  }

  private async createJob(req: express.Request, res: express.Response): Promise<void> {
    try {
      const jobConfig = req.body;
      await this.configManager.addJobConfiguration(jobConfig);
      
      res.status(201).json({
        success: true,
        message: 'Job configuration created successfully',
        data: jobConfig
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to create job:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create job'
      });
    }
  }

  private async updateJob(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const updates = req.body;
      
      await this.configManager.updateJobConfiguration(jobId, updates);
      
      res.json({
        success: true,
        message: 'Job configuration updated successfully'
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to update job:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update job'
      });
    }
  }

  private async deleteJob(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { jobId } = req.params;
      await this.configManager.removeJobConfiguration(jobId);
      
      res.json({
        success: true,
        message: 'Job configuration deleted successfully'
      });
    } catch (error) {
      this.logger.error('DashboardAPI', 'Failed to delete job:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete job'
      });
    }
  }

  private async getHealth(req: express.Request, res: express.Response): Promise<void> {
    try {
      const systemHealth = await this.jobMonitor.validateHealth();
      
      res.json({
        success: true,
        data: {
          status: systemHealth.status,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '1.0.0',
          details: systemHealth.details
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        this.logger.info('DashboardAPI', `Dashboard API server started on port ${port}`);
        this.logger.info('DashboardAPI', `Dashboard available at: http://localhost:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('DashboardAPI', 'Dashboard API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}