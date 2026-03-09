const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');

function readJSONFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

function writeJSONFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error.message);
    return false;
  }
}

function readLogFile(logPath) {
  try {
    const fullPath = path.join(__dirname, '..', logPath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading log file ${logPath}:`, error.message);
    return null;
  }
}

function extractErrorFromLog(logContent) {
  const lines = logContent.split('\n');
  const errorLines = lines.filter(line => line.includes('ERROR'));
  return errorLines.join('\n') || 'No error found in log';
}

function analyzeLog(logContent) {
  const errorPatterns = {
    'File not found': { category: 'FILE', errorCode: 'FILE404' },
    'FileNotFoundException': { category: 'FILE', errorCode: 'FILE404' },
    'ORA-12541': { category: 'DB', errorCode: 'DB_CONN_ERR' },
    'ORA-12170': { category: 'DB', errorCode: 'DB_TIMEOUT' },
    'TNS': { category: 'DB', errorCode: 'DB_CONN_ERR' },
    'heap space': { category: 'INFRA', errorCode: 'MEMORY_ERR' },
    'permission denied': { category: 'FILE', errorCode: 'PERMISSION_ERR' }
  };

  for (const [pattern, info] of Object.entries(errorPatterns)) {
    if (logContent.includes(pattern)) {
      return info;
    }
  }

  return { category: 'APPLICATION', errorCode: 'UNKNOWN' };
}

function findSimilarIncidents(errorCode, jobId) {
  const incidentsData = readJSONFile(INCIDENTS_FILE);
  if (!incidentsData) return [];

  return incidentsData.incidents.filter(incident => 
    incident.errorCode === errorCode || incident.jobId === jobId
  );
}

function calculateConfidence(similarIncidents, errorCode) {
  if (similarIncidents.length === 0) return 0;
  
  const exactMatches = similarIncidents.filter(inc => inc.errorCode === errorCode).length;
  return Math.min(95, 60 + (exactMatches * 10));
}

app.get('/api/dashboard/summary', (req, res) => {
  const jobsData = readJSONFile(JOBS_FILE);
  if (!jobsData) {
    return res.status(500).json({ error: 'Failed to read jobs data' });
  }

  const totalJobs = jobsData.jobs.length;
  const failedToday = jobsData.jobs.filter(job => job.execution.status === 'FAILED').length;
  const slaBreachCount = jobsData.jobs.filter(job => {
    const duration = parseInt(job.execution.uptime) || 0;
    return duration > job.expectedDurationMinutes;
  }).length;

  const failedJobs = jobsData.jobs.filter(job => job.execution.status === 'FAILED');
  const totalDowntime = failedJobs.reduce((sum, job) => {
    const downtime = job.execution.downtime || '0m';
    const minutes = parseInt(downtime);
    return sum + (isNaN(minutes) ? 0 : minutes);
  }, 0);
  const mttr = failedJobs.length > 0 ? Math.round(totalDowntime / failedJobs.length) + 'm' : '0m';

  res.json({
    totalJobs,
    failedToday,
    slaBreachCount,
    mttr
  });
});

app.get('/api/jobs/failed', (req, res) => {
  const jobsData = readJSONFile(JOBS_FILE);
  if (!jobsData) {
    return res.status(500).json({ error: 'Failed to read jobs data' });
  }

  const failedJobs = jobsData.jobs
    .filter(job => job.execution.status === 'FAILED')
    .map(job => ({
      id: job.jobId,
      jobName: job.jobName,
      status: job.execution.status,
      failedTime: `${job.execution.runDate} ${job.execution.startTime}`,
      uptime: job.execution.uptime || 'N/A',
      downtime: job.execution.downtime || 'N/A',
      severity: job.severity || 'MEDIUM'
    }));

  res.json(failedJobs);
});

app.get('/api/jobs/:id', (req, res) => {
  const jobId = req.params.id;
  const jobsData = readJSONFile(JOBS_FILE);
  
  if (!jobsData) {
    return res.status(500).json({ error: 'Failed to read jobs data' });
  }

  const job = jobsData.jobs.find(j => j.jobId === jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const logContent = readLogFile(job.logFilePath);
  const errorExtracted = logContent ? extractErrorFromLog(logContent) : 'Log file not accessible';
  const logAnalysis = logContent ? analyzeLog(logContent) : { category: 'UNKNOWN', errorCode: 'UNKNOWN' };
  
  const similarIncidents = findSimilarIncidents(logAnalysis.errorCode, jobId);
  const confidence = calculateConfidence(similarIncidents, logAnalysis.errorCode);

  let rootCauseDescription = 'Unable to determine root cause';
  let resolutionSteps = ['Analyze log files manually', 'Contact support team'];

  if (similarIncidents.length > 0) {
    const latestIncident = similarIncidents[0];
    rootCauseDescription = latestIncident.rootCause || latestIncident.problem;
    resolutionSteps = latestIncident.resolution.split('.').filter(s => s.trim());
  }

  const jobDetails = {
    jobName: job.jobName,
    status: job.execution.status,
    returnCode: `RC-${job.execution.exitCode}`,
    failureTime: `${job.execution.runDate} ${job.execution.startTime}`,
    resolutionTime: null,
    uptime: job.execution.uptime || 'N/A',
    downtime: job.execution.downtime || 'N/A',
    slaImpact: job.severity || 'MEDIUM',
    rca: {
      errorPattern: logAnalysis.errorCode,
      description: rootCauseDescription,
      category: logAnalysis.category,
      confidenceScore: confidence
    },
    resolutionSteps: resolutionSteps.length > 0 ? resolutionSteps : [
      'Review job logs for error details',
      'Check system resources and connectivity',
      'Verify input files and dependencies',
      'Restart failed job after fixing the issue'
    ],
    logInsights: {
      errorExtracted: errorExtracted,
      patternMatchType: confidence > 70 ? 'Exact Pattern Match' : 'Fuzzy Match',
      aiAnalysisSummary: `Analysis indicates ${logAnalysis.category} related issue. ${similarIncidents.length > 0 ? `Found ${similarIncidents.length} similar past incident(s).` : 'No similar incidents found in knowledge base.'}`
    }
  };

  res.json(jobDetails);
});

app.get('/api/jobs/:id/similar-incidents', (req, res) => {
  const jobId = req.params.id;
  const jobsData = readJSONFile(JOBS_FILE);
  
  if (!jobsData) {
    return res.status(500).json({ error: 'Failed to read jobs data' });
  }

  const job = jobsData.jobs.find(j => j.jobId === jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const logContent = readLogFile(job.logFilePath);
  const logAnalysis = logContent ? analyzeLog(logContent) : { errorCode: 'UNKNOWN' };
  
  const similarIncidents = findSimilarIncidents(logAnalysis.errorCode, jobId);

  const formattedIncidents = similarIncidents.map(incident => ({
    incidentId: incident.incidentId,
    date: incident.date,
    rootCause: incident.rootCause,
    resolutionSummary: incident.resolution
  }));

  res.json(formattedIncidents);
});

app.post('/api/incidents', (req, res) => {
  const newIncident = req.body;
  const incidentsData = readJSONFile(INCIDENTS_FILE);
  
  if (!incidentsData) {
    return res.status(500).json({ error: 'Failed to read incidents data' });
  }

  const incidentId = `INC${Date.now()}`;
  const incident = {
    incidentId,
    ...newIncident,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0]
  };

  incidentsData.incidents.push(incident);
  
  if (writeJSONFile(INCIDENTS_FILE, incidentsData)) {
    res.json({ success: true, incidentId, message: 'Incident saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save incident' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Control-M RCA Server running on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`📄 Logs directory: ${LOGS_DIR}`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - GET  /api/dashboard/summary`);
  console.log(`   - GET  /api/jobs/failed`);
  console.log(`   - GET  /api/jobs/:id`);
  console.log(`   - GET  /api/jobs/:id/similar-incidents`);
  console.log(`   - POST /api/incidents`);
  console.log(`   - GET  /api/health`);
});