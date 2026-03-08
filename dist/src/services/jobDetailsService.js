// Job Details Service using Knowledge Base
import { findMatchingIncident, extractErrorInfo } from './knowledgeBase';

export const getJobDetailsFromKnowledgeBase = async (jobId) => {
  try {
    // Load job data
    const jobsResponse = await fetch('/jobs.json');
    const jobsData = await jobsResponse.json();
    const job = jobsData.jobs.find(j => j.jobId === jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    // Load knowledge base
    const incidentsResponse = await fetch('/incidents.json');
    const incidentsData = await incidentsResponse.json();
    
    // Extract error information from job
    const errorInfo = extractErrorInfo(job);
    
    // Find matching incident in knowledge base
    const matchResult = findMatchingIncident(
      incidentsData.incidents,
      errorInfo.errorCode,
      errorInfo.errorPattern,
      errorInfo.problemText
    );
    
    if (matchResult) {
      // Found matching incident - use knowledge base data
      const incident = matchResult.incident;
      
      return {
        jobName: job.jobName,
        status: job.execution.status,
        returnCode: `RC-${job.execution.exitCode}`,
        failureTime: `${job.execution.runDate} ${job.execution.endTime}`,
        resolutionTime: null,
        failedCount: job.execution.failedCount || 0,
        downtime: job.execution.downtime,
        slaImpact: job.severity,
        matchFound: true,
        matchType: matchResult.matchType,
        rca: {
          errorPattern: incident.errorPattern,
          description: incident.rcaDescription,
          category: incident.category,
          confidenceScore: matchResult.confidence
        },
        resolutionSteps: incident.resolutionSteps,
        logInsights: {
          errorExtracted: incident.logExample,
          patternMatchType: matchResult.matchType,
          aiAnalysisSummary: `Matched with incident ${incident.incidentId} from knowledge base. ${incident.rcaDescription}`
        },
        knowledgeBaseIncident: incident
      };
    } else {
      // No matching incident found
      return {
        jobName: job.jobName,
        status: job.execution.status,
        returnCode: `RC-${job.execution.exitCode}`,
        failureTime: `${job.execution.runDate} ${job.execution.endTime}`,
        resolutionTime: null,
        failedCount: job.execution.failedCount || 0,
        downtime: job.execution.downtime,
        slaImpact: job.severity,
        matchFound: false,
        rca: {
          errorPattern: errorInfo.errorPattern,
          description: 'No matching incident found in the knowledge base.',
          category: 'UNKNOWN',
          confidenceScore: 0
        },
        resolutionSteps: [
          'This is a new type of failure not seen before',
          'Investigate the job logs manually',
          'Document the root cause once identified',
          'Add resolution steps to the knowledge base'
        ],
        logInsights: {
          errorExtracted: `Exit Code: ${job.execution.exitCode}`,
          patternMatchType: 'No Match',
          aiAnalysisSummary: 'No matching incident found in the knowledge base. This appears to be a new type of failure. Please investigate and add the resolution to the knowledge base.'
        },
        needsKnowledgeBaseEntry: true,
        extractedError: errorInfo
      };
    }
  } catch (error) {
    throw error;
  }
};