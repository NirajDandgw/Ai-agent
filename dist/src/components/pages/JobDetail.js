import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobDetails, getSimilarIncidents } from '../../services/api';
import Card from '../Card';
import Table from '../Table';
import StatusBadge from '../StatusBadge';
import Loader from '../Loader';
import ErrorMessage from '../ErrorMessage';
import AddIncidentForm from '../AddIncidentForm';
import '../../styles/JobDetail.css';

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [similarIncidents, setSimilarIncidents] = useState([]);
  const [showAddIncidentForm, setShowAddIncidentForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [details, incidents] = await Promise.all([
        getJobDetails(id),
        getSimilarIncidents(id)
      ]);
      
      setJobDetails(details);
      setSimilarIncidents(incidents);
    } catch (err) {
      setError(err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAddIncident = async (newIncident) => {
    try {
      // In a real implementation, this would POST to backend API
      // For now, we'll show success message
      console.log('New incident to add:', newIncident);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the page data
      await fetchData();
    } catch (err) {
      throw new Error('Failed to add incident to knowledge base');
    }
  };

  const incidentColumns = [
    {
      header: 'Incident ID',
      key: 'incidentId'
    },
    {
      header: 'Date',
      key: 'date'
    },
    {
      header: 'Environment',
      key: 'environment',
      render: (row) => (
        <span className={`env-badge ${row.environment?.toLowerCase()}`}>
          {row.environment}
        </span>
      )
    },
    {
      header: 'Root Cause',
      key: 'rootCause',
      className: 'root-cause-col'
    },
    {
      header: 'Resolution Summary',
      key: 'resolutionSummary',
      className: 'resolution-col'
    }
  ];

  if (loading) {
    return <Loader message="Loading job details..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  if (!jobDetails) {
    return <ErrorMessage message="Job not found" />;
  }

  return (
    <div className="job-detail">
      <div className="job-detail-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <h2>Job Analysis: {jobDetails.jobName}</h2>
      </div>

      <div className="job-detail-grid">
        <Card title="Job Basic Information" className="job-info-card">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Job Name</span>
              <span className="info-value">{jobDetails.jobName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value">
                <StatusBadge status={jobDetails.status} />
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Return Code</span>
              <span className="info-value code">{jobDetails.returnCode}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Failure Time</span>
              <span className="info-value">{jobDetails.failureTime}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Resolution Time</span>
              <span className="info-value">{jobDetails.resolutionTime || 'Pending'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Failed Count</span>
              <span className="info-value failed-count">{jobDetails.failedCount || 0} times</span>
            </div>
            <div className="info-item">
              <span className="info-label">Downtime</span>
              <span className="info-value downtime">{jobDetails.downtime}</span>
            </div>
            <div className="info-item">
              <span className="info-label">SLA Impact</span>
              <span className="info-value">
                <StatusBadge severity={jobDetails.slaImpact} />
              </span>
            </div>
          </div>
        </Card>

        <Card title="Root Cause Analysis" className="rca-card">
          <div className="rca-content">
            <div className="rca-item">
              <span className="rca-label">Error Pattern</span>
              <span className="rca-value pattern">{jobDetails.rca?.errorPattern}</span>
            </div>
            <div className="rca-item">
              <span className="rca-label">Root Cause Description</span>
              <p className="rca-description">{jobDetails.rca?.description}</p>
            </div>
            <div className="rca-item">
              <span className="rca-label">Category</span>
              <span className="rca-value">
                <StatusBadge severity={jobDetails.rca?.category} />
              </span>
            </div>
            <div className="rca-item">
              <span className="rca-label">Confidence Score</span>
              <div className="confidence-bar">
                <div 
                  className="confidence-fill" 
                  style={{ width: `${jobDetails.rca?.confidenceScore}%` }}
                ></div>
                <span className="confidence-text">{jobDetails.rca?.confidenceScore}%</span>
              </div>
            </div>
            
            {jobDetails.needsKnowledgeBaseEntry && (
              <div className="add-to-kb-section">
                <div className="kb-alert">
                  <span className="kb-alert-icon">💡</span>
                  <span className="kb-alert-text">
                    This is a new type of failure. Help improve the system by adding it to the knowledge base!
                  </span>
                </div>
                <button 
                  className="add-to-kb-button"
                  onClick={() => setShowAddIncidentForm(true)}
                >
                  + Add to Knowledge Base
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Similar Past Incidents" className="incidents-card">
        {similarIncidents.length === 0 ? (
          <div className="no-incidents">
            <p className="no-incidents-message">
              No similar incidents found in the knowledge base.
            </p>
          </div>
        ) : (
          <Table columns={incidentColumns} data={similarIncidents} />
        )}
      </Card>

      <Card title="Recommended Resolution Steps" className="resolution-card">
        <ol className="resolution-steps">
          {jobDetails.resolutionSteps?.map((step, index) => (
            <li key={index} className="resolution-step">
              <span className="step-number">{index + 1}</span>
              <span className="step-text">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Log Insights" className="log-insights-card">
        <div className="log-insights">
          <div className="insight-item">
            <span className="insight-label">Error Extracted</span>
            <pre className="insight-code">{jobDetails.logInsights?.errorExtracted}</pre>
          </div>
          <div className="insight-item">
            <span className="insight-label">Pattern Match Type</span>
            <span className="insight-value">{jobDetails.logInsights?.patternMatchType}</span>
          </div>
          <div className="insight-item">
            <span className="insight-label">AI Analysis Summary</span>
            <p className="insight-summary">{jobDetails.logInsights?.aiAnalysisSummary}</p>
          </div>
        </div>
      </Card>

      {showAddIncidentForm && (
        <AddIncidentForm
          jobDetails={{ ...jobDetails, jobId: id }}
          onClose={() => setShowAddIncidentForm(false)}
          onSubmit={handleAddIncident}
        />
      )}
    </div>
  );
};

export default JobDetail;