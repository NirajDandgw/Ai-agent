-- Database schema for batch job monitoring system

-- Job configurations table
CREATE TABLE IF NOT EXISTS job_configurations (
    job_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    expected_duration INTEGER NOT NULL, -- in minutes
    log_paths TEXT NOT NULL, -- JSON array
    data_source TEXT NOT NULL, -- JSON object
    alert_channels TEXT NOT NULL, -- JSON array
    sla_thresholds TEXT NOT NULL, -- JSON object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Job executions table
CREATE TABLE IF NOT EXISTS job_executions (
    execution_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status TEXT NOT NULL CHECK (status IN ('Running', 'Success', 'Failed', 'Delayed')),
    exit_code INTEGER,
    failure_reason TEXT,
    log_analysis TEXT, -- JSON object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_configurations(job_id)
);

-- Alert history table
CREATE TABLE IF NOT EXISTS alert_history (
    alert_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    job_name TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('Failure', 'Delay', 'SystemHealth')),
    message TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    failure_reason TEXT,
    channels_sent TEXT NOT NULL, -- JSON array of delivery results
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_configurations(job_id)
);

-- Failure patterns table
CREATE TABLE IF NOT EXISTS failure_patterns (
    pattern_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    regex TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
    component TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('Healthy', 'Degraded', 'Unhealthy')),
    last_check DATETIME NOT NULL,
    details TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log analyses table
CREATE TABLE IF NOT EXISTS log_analyses (
    analysis_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    execution_id TEXT,
    root_cause TEXT NOT NULL,
    error_messages TEXT NOT NULL, -- JSON array
    stack_trace TEXT,
    failure_category TEXT NOT NULL,
    confidence REAL NOT NULL,
    analysis_timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_configurations(job_id),
    FOREIGN KEY (execution_id) REFERENCES job_executions(execution_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_job_executions_start_time ON job_executions(start_time);
CREATE INDEX IF NOT EXISTS idx_alert_history_job_id ON alert_history(job_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_analyses_job_id ON log_analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);