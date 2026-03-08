import axios from 'axios';
import { getJobDetailsFromKnowledgeBase } from './jobDetailsService';
import { findSimilarIncidents } from './knowledgeBase';

const API_BASE_URL = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timeout - please try again'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error - please check your connection'));
    }
    return Promise.reject(error);
  }
);

const mockDashboardSummary = {
  totalJobs: 156,
  failedToday: 8,
  slaBreachCount: 3,
  mttr: '45m'
};

const mockFailedJobs = [
  {
    id: 'job-001',
    jobName: 'ETL_SALES_DAILY',
    status: 'FAILED',
    failedTime: '2024-01-23 02:15:30',
    uptime: '1h 45m',
    downtime: '2h 15m',
    severity: 'HIGH'
  },
  {
    id: 'job-002',
    jobName: 'INVENTORY_SYNC',
    status: 'FAILED',
    failedTime: '2024-01-23 03:45:12',
    uptime: '3h 15m',
    downtime: '45m',
    severity: 'MEDIUM'
  },
  {
    id: 'job-003',
    jobName: 'CUSTOMER_DATA_LOAD',
    status: 'FAILED',
    failedTime: '2024-01-23 01:30:00',
    uptime: '30m',
    downtime: '3h 30m',
    severity: 'CRITICAL'
  },
  {
    id: 'job-004',
    jobName: 'REPORT_GENERATION',
    status: 'FAILED',
    failedTime: '2024-01-23 04:20:45',
    uptime: '4h 10m',
    downtime: '20m',
    severity: 'LOW'
  },
  {
    id: 'job-005',
    jobName: 'DATA_WAREHOUSE_REFRESH',
    status: 'FAILED',
    failedTime: '2024-01-23 00:05:00',
    uptime: '5m',
    downtime: '5h 0m',
    severity: 'CRITICAL'
  }
];

const mockJobDetails = {
  'job-001': {
    jobName: 'ETL_SALES_DAILY',
    status: 'FAILED',
    returnCode: 'RC-8',
    failureTime: '2024-01-23 02:15:30',
    resolutionTime: null,
    uptime: '1h 45m',
    downtime: '2h 15m',
    slaImpact: 'HIGH',
    rca: {
      errorPattern: 'DATABASE_CONNECTION_TIMEOUT',
      description: 'The job failed due to a database connection timeout. The target database was unresponsive, causing the ETL process to fail after exceeding the maximum retry attempts.',
      category: 'DB',
      confidenceScore: 92
    },
    resolutionSteps: [
      'Verify database server status and connectivity',
      'Check database connection pool settings',
      'Review database performance metrics for the failure time window',
      'Restart the database connection pool if necessary',
      'Re-run the ETL job after confirming database availability'
    ],
    logInsights: {
      errorExtracted: 'ORA-12170: TNS:Connect timeout occurred\nat oracle.jdbc.driver.T4CConnection.logon(T4CConnection.java:774)\nat oracle.jdbc.driver.PhysicalConnection.connect(PhysicalConnection.java:688)',
      patternMatchType: 'Regex Pattern Match',
      aiAnalysisSummary: 'Analysis indicates a network-level timeout when attempting to establish connection to the Oracle database. This is typically caused by network latency, firewall issues, or database server overload. Historical data shows similar patterns during peak load times.'
    }
  },
  'job-002': {
    jobName: 'INVENTORY_SYNC',
    status: 'FAILED',
    returnCode: 'RC-4',
    failureTime: '2024-01-23 03:45:12',
    resolutionTime: null,
    uptime: '3h 15m',
    downtime: '45m',
    slaImpact: 'MEDIUM',
    rca: {
      errorPattern: 'FILE_NOT_FOUND',
      description: 'The inventory sync job failed because the expected input file was not present in the designated directory. This suggests an upstream process failure or file transfer issue.',
      category: 'FILE',
      confidenceScore: 88
    },
    resolutionSteps: [
      'Check if the upstream file generation job completed successfully',
      'Verify file transfer logs for any failures',
      'Confirm file naming convention matches expected pattern',
      'Check file permissions and directory access',
      'Manually place the file if available, or re-run upstream job'
    ],
    logInsights: {
      errorExtracted: 'FileNotFoundException: /data/inventory/inv_20240123.csv (No such file or directory)\nat java.io.FileInputStream.open0(Native Method)\nat java.io.FileInputStream.open(FileInputStream.java:195)',
      patternMatchType: 'Exception Type Match',
      aiAnalysisSummary: 'The job expected file "inv_20240123.csv" in the /data/inventory directory but it was not found. This is a common issue when dependent jobs fail or file transfers are delayed. Check the file generation schedule and transfer logs.'
    }
  },
  'job-003': {
    jobName: 'CUSTOMER_DATA_LOAD',
    status: 'FAILED',
    returnCode: 'RC-12',
    failureTime: '2024-01-23 01:30:00',
    resolutionTime: null,
    uptime: '30m',
    downtime: '3h 30m',
    slaImpact: 'CRITICAL',
    rca: {
      errorPattern: 'DISK_SPACE_FULL',
      description: 'The customer data load job failed due to insufficient disk space on the target server. The job attempted to write temporary files but encountered a disk full error.',
      category: 'INFRA',
      confidenceScore: 95
    },
    resolutionSteps: [
      'Check disk space usage on the target server',
      'Identify and remove old temporary files or logs',
      'Archive or compress historical data if needed',
      'Increase disk space allocation if this is a recurring issue',
      'Re-run the job after freeing up sufficient space'
    ],
    logInsights: {
      errorExtracted: 'IOException: No space left on device\nat java.io.FileOutputStream.writeBytes(Native Method)\nat java.io.FileOutputStream.write(FileOutputStream.java:326)',
      patternMatchType: 'System Error Match',
      aiAnalysisSummary: 'Critical infrastructure issue detected. The server ran out of disk space during the data load operation. This is a high-priority issue that requires immediate attention to prevent further job failures.'
    }
  }
};

export const getDashboardSummary = async () => {
  try {
    const response = await api.get('/dashboard/summary');
    return response.data;
  } catch (error) {
    // Load from jobs.json and calculate summary
    try {
      const jobsResponse = await fetch('/jobs.json');
      const jobsData = await jobsResponse.json();
      const failedJobs = jobsData.jobs.filter(job => job.execution.status === 'FAILED');
      const slaBreaches = failedJobs.filter(job => job.criticalJob).length;
      
      return {
        totalJobs: jobsData.jobs.length,
        failedToday: failedJobs.length,
        slaBreachCount: slaBreaches,
        mttr: '45m'
      };
    } catch {
      return mockDashboardSummary;
    }
  }
};

export const getFailedJobs = async () => {
  try {
    const response = await api.get('/jobs/failed');
    return response.data;
  } catch (error) {
    // Load from jobs.json and transform
    try {
      const jobsResponse = await fetch('/jobs.json');
      const jobsData = await jobsResponse.json();
      
      return jobsData.jobs
        .filter(job => job.execution.status === 'FAILED')
        .map(job => ({
          id: job.jobId,
          jobName: job.jobName,
          status: job.execution.status,
          failedTime: `${job.execution.runDate} ${job.execution.endTime}`,
          failedCount: job.execution.failedCount || 0,
          severity: job.severity
        }));
    } catch {
      return mockFailedJobs;
    }
  }
};

export const getJobDetails = async (jobId) => {
  try {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    // Use knowledge base service
    try {
      return await getJobDetailsFromKnowledgeBase(jobId);
    } catch (err) {
      // Fallback to mock data
      return mockJobDetails[jobId] || mockJobDetails['job-001'];
    }
  }
};

export const getSimilarIncidents = async (jobId) => {
  try {
    const response = await api.get(`/jobs/${jobId}/similar-incidents`);
    return response.data;
  } catch (error) {
    // Load from incidents.json and use knowledge base matching
    try {
      const incidentsResponse = await fetch('/incidents.json');
      const incidentsData = await incidentsResponse.json();
      
      // Get the current job's incident if it exists
      const currentIncident = incidentsData.incidents.find(inc => inc.jobId === jobId);
      
      if (currentIncident) {
        // Find similar incidents using knowledge base service
        const similar = findSimilarIncidents(
          incidentsData.incidents,
          currentIncident.incidentId,
          currentIncident.category,
          currentIncident.errorPattern,
          5
        );
        
        return similar.map(incident => ({
          incidentId: incident.incidentId,
          date: `${incident.date} ${incident.time}`,
          environment: incident.environment,
          rootCause: incident.rootCause,
          resolutionSummary: incident.resolutionSummary,
          errorCode: incident.errorCode,
          category: incident.category,
          developerOnCall: incident.developerOnCall
        }));
      }
      
      // If no current incident found, return empty array (no similar incidents for unknown errors)
      return [];
    } catch {
      // Return empty array when incidents.json is not available
      return [];
    }
  }
};

export const saveNewIncident = async (incidentData) => {
  const response = await api.post('/incidents', incidentData);
  return response.data;
};

export default api;