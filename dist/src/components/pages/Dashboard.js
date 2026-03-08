import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary, getFailedJobs } from '../../services/api';
import SummaryCard from '../SummaryCard';
import Card from '../Card';
import Table from '../Table';
import StatusBadge from '../StatusBadge';
import Loader from '../Loader';
import ErrorMessage from '../ErrorMessage';
import '../../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [failedJobs, setFailedJobs] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summaryData, jobsData] = await Promise.all([
        getDashboardSummary(),
        getFailedJobs()
      ]);
      
      setSummary(summaryData);
      setFailedJobs(jobsData);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewRCA = (job) => {
    navigate(`/job/${job.id}`);
  };

  const columns = [
    {
      header: 'Job Name',
      key: 'jobName',
      className: 'job-name-col'
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Failed Time',
      key: 'failedTime'
    },
    {
      header: 'Failed Count',
      key: 'failedCount',
      className: 'failed-count-col'
    },
    {
      header: 'Severity',
      key: 'severity',
      render: (row) => <StatusBadge severity={row.severity} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button 
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            handleViewRCA(row);
          }}
        >
          View RCA
        </button>
      )
    }
  ];

  if (loading) {
    return <Loader message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard Overview</h2>
        <button className="refresh-button" onClick={fetchData}>
          ↻ Refresh
        </button>
      </div>

      <div className="summary-grid">
        <SummaryCard
          title="Total Jobs"
          value={summary?.totalJobs || 0}
          icon="📊"
          className="total-jobs"
        />
        <SummaryCard
          title="Failed Today"
          value={summary?.failedToday || 0}
          icon="❌"
          className="failed-jobs"
        />
        <SummaryCard
          title="SLA Breach"
          value={summary?.slaBreachCount || 0}
          icon="⚠️"
          className="sla-breach"
        />
        <SummaryCard
          title="MTTR"
          value={summary?.mttr || '0m'}
          icon="⏱️"
          className="mttr"
        />
      </div>

      <Card title="Failed Jobs" className="failed-jobs-card">
        <Table 
          columns={columns} 
          data={failedJobs}
          onRowClick={handleViewRCA}
        />
      </Card>
    </div>
  );
};

export default Dashboard;