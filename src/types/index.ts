// Core data types for batch job monitoring system

export type JobExecutionStatus = 'Running' | 'Success' | 'Failed' | 'Delayed';
export type AlertType = 'Failure' | 'Delay' | 'SystemHealth';
export type AlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type DataSourceType = 'SchedulerLogs' | 'ETLLogs' | 'Database';

export interface JobStatus {
  jobId: string;
  name: string;
  status: JobExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  lastHeartbeat: Date;
  failureReason?: string;
}

export interface JobExecution {
  executionId: string;
  jobId: string;
  startTime: Date;
  endTime?: Date;
  status: JobExecutionStatus;
  exitCode?: number;
  failureReason?: string;
  logAnalysis?: LogAnalysisResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobConfiguration {
  jobId: string;
  name: string;
  schedule: string;
  expectedDuration: number; // in minutes
  logPaths: string[];
  dataSource: DataSourceConfig;
  alertChannels: AlertChannel[];
  slaThresholds: SLAThresholds;
}

export interface DataSourceConfig {
  type: DataSourceType;
  connectionString: string;
  queryPattern: string;
  credentials?: CredentialConfig;
  pollInterval: number; // in seconds
}

export interface CredentialConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
}

export interface SLAThresholds {
  maxExecutionTime: number; // in minutes
  alertDelayMinutes: number;
  criticalDelayMinutes: number;
}

export interface AlertChannel {
  type: 'Email' | 'Teams';
  endpoint: string;
  credentials?: CredentialConfig;
  enabled: boolean;
}

export interface AlertMessage {
  jobId: string;
  jobName: string;
  alertType: AlertType;
  message: string;
  timestamp: Date;
  severity: AlertSeverity;
  failureReason?: string;
}

export interface AlertResult {
  success: boolean;
  channelType: string;
  deliveredAt?: Date;
  error?: string;
}

export interface LogAnalysisResult {
  jobId: string;
  rootCause: string;
  errorMessages: string[];
  stackTrace?: string;
  failureCategory: string;
  confidence: number;
  analysisTimestamp: Date;
}

export interface FailurePattern {
  patternId: string;
  name: string;
  regex: string;
  category: string;
  severity: AlertSeverity;
  description: string;
}

export interface FailureCategory {
  categoryId: string;
  name: string;
  description: string;
  patterns: FailurePattern[];
}

export interface SystemHealthStatus {
  component: string;
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  lastCheck: Date;
  details?: string;
}

export interface SLAMetrics {
  jobId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  delayedExecutions: number;
  averageExecutionTime: number; // in minutes
  slaComplianceRate: number; // percentage
  lastCalculated: Date;
}

export interface SLAComplianceStatus {
  jobId: string;
  isCompliant: boolean;
  currentStatus: JobExecutionStatus;
  complianceLevel: 'Green' | 'Yellow' | 'Red';
  message: string;
  checkedAt: Date;
}