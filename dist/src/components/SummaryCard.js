import React from 'react';
import '../styles/SummaryCard.css';

const SummaryCard = ({ title, value, icon, trend, trendValue, className = '' }) => {
  return (
    <div className={`summary-card ${className}`}>
      <div className="summary-card-header">
        <span className="summary-card-title">{title}</span>
        {icon && <span className="summary-card-icon">{icon}</span>}
      </div>
      <div className="summary-card-value">{value}</div>
      {trend && (
        <div className={`summary-card-trend ${trend}`}>
          <span className="trend-indicator">
            {trend === 'up' ? '↑' : '↓'}
          </span>
          <span className="trend-value">{trendValue}</span>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;