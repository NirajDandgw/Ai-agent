import React from 'react';
import '../styles/StatusBadge.css';

const StatusBadge = ({ status, severity }) => {
  const getStatusClass = () => {
    if (status) {
      return status.toLowerCase();
    }
    if (severity) {
      return severity.toLowerCase();
    }
    return '';
  };

  return (
    <span className={`status-badge ${getStatusClass()}`}>
      {status || severity}
    </span>
  );
};

export default StatusBadge;