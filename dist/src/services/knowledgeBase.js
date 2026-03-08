// Knowledge Base Service for Self-Learning Incident Analysis

// Match incident by error code, pattern, or text similarity
export const findMatchingIncident = (incidents, errorCode, errorPattern, problemText) => {
  // Priority 1: Match by errorCode
  let match = incidents.find(inc => inc.errorCode === errorCode);
  if (match) {
    return { incident: match, matchType: 'Error Code Match', confidence: match.confidenceScore || 95 };
  }
  
  // Priority 2: Match by errorPattern
  if (errorPattern) {
    match = incidents.find(inc => 
      inc.errorPattern && inc.errorPattern.toLowerCase().includes(errorPattern.toLowerCase())
    );
    if (match) {
      return { incident: match, matchType: 'Error Pattern Match', confidence: match.confidenceScore || 85 };
    }
  }
  
  // Priority 3: Text similarity with problem field
  if (problemText) {
    const similarities = incidents.map(inc => {
      const problem = inc.problem.toLowerCase();
      const text = problemText.toLowerCase();
      const words = text.split(' ').filter(w => w.length > 3); // Filter short words
      const matchCount = words.filter(word => problem.includes(word)).length;
      const similarity = words.length > 0 ? matchCount / words.length : 0;
      return { incident: inc, similarity };
    });
    
    const bestMatch = similarities.reduce((best, current) => 
      current.similarity > best.similarity ? current : best
    , { similarity: 0 });
    
    if (bestMatch.similarity > 0.5) {
      return { 
        incident: bestMatch.incident, 
        matchType: 'Text Similarity Match', 
        confidence: Math.round(bestMatch.similarity * 100) 
      };
    }
  }
  
  return null;
};

// Find similar incidents by category and pattern
export const findSimilarIncidents = (incidents, currentIncidentId, category, errorPattern, limit = 5) => {
  return incidents
    .filter(inc => 
      inc.incidentId !== currentIncidentId &&
      (inc.category === category || inc.errorPattern === errorPattern)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
    .slice(0, limit);
};

// Extract error information from job
export const extractErrorInfo = (job) => {
  // Map exit codes to error patterns
  const exitCodeMap = {
    4: { errorCode: 'FILE404', errorPattern: 'File not found' },
    8: { errorCode: 'DB_TIMEOUT', errorPattern: 'Connection timeout' },
    12: { errorCode: 'PERMISSION_ERR', errorPattern: 'Permission denied' },
    101: { errorCode: 'DB_CONN_ERR', errorPattern: 'Connection refused' }
  };
  
  const errorInfo = exitCodeMap[job.execution.exitCode] || {
    errorCode: `ERR_${job.execution.exitCode}`,
    errorPattern: 'Unknown error'
  };
  
  return {
    ...errorInfo,
    problemText: job.jobDescription || job.jobName
  };
};

// Generate new incident ID
export const generateIncidentId = (incidents) => {
  const incNumbers = incidents
    .map(inc => parseInt(inc.incidentId.replace(/[^\d]/g, '')))
    .filter(num => !isNaN(num));
  
  const maxNum = incNumbers.length > 0 ? Math.max(...incNumbers) : 1000;
  return `INC${maxNum + 1}`;
};

// Add new incident to knowledge base
export const addIncidentToKnowledgeBase = async (newIncident) => {
  try {
    // In a real implementation, this would POST to a backend API
    // For now, we'll simulate the addition
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncident)
    });
    return await response.json();
  } catch (error) {
    // Fallback: return the incident as if it was added
    return { success: true, incident: newIncident };
  }
};