# Batch Job Monitoring Automation Solution

An automated system for monitoring batch job execution status, detecting failures and delays, analyzing logs for root cause identification, and providing real-time alerts and centralized visibility.

## Features

- **Automated Job Monitoring**: Track batch job execution status (Success/Failed/Delayed)
- **Multi-Source Integration**: Fetch job details from scheduler logs, ETL logs, or database tables
- **Intelligent Alerting**: Email and Microsoft Teams notifications with failure details
- **Log Analysis**: Automated parsing and root cause extraction from log files
- **Centralized Dashboard**: Real-time visibility of all job statuses and history
- **Flexible Configuration**: Easy setup for different job types and monitoring requirements

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and Run**
   ```bash
   npm run build
   npm start
   ```

4. **Development Mode**
   ```bash
   npm run dev
   ```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── types/           # TypeScript type definitions
├── interfaces/      # Service interfaces
├── database/        # Database schema and connection
├── utils/          # Utility functions and validation
├── services/       # Core business logic services (to be implemented)
├── api/            # REST API endpoints (to be implemented)
├── dashboard/      # Web dashboard (to be implemented)
└── __tests__/      # Test files
```

## Configuration

The system uses environment variables for configuration. See `.env.example` for all available options.

### Job Configuration Example

```typescript
{
  jobId: "etl-daily-sales",
  name: "Daily Sales ETL",
  schedule: "0 2 * * *",
  expectedDuration: 60,
  logPaths: ["/var/log/etl/sales.log"],
  dataSource: {
    type: "Database",
    connectionString: "postgresql://user:pass@host:5432/db",
    queryPattern: "SELECT * FROM job_status WHERE job_name = 'sales-etl'",
    pollInterval: 30
  },
  alertChannels: [
    {
      type: "Email",
      endpoint: "admin@company.com",
      enabled: true
    },
    {
      type: "Teams",
      endpoint: "https://company.webhook.office.com/...",
      enabled: true
    }
  ],
  slaThresholds: {
    maxExecutionTime: 120,
    alertDelayMinutes: 5,
    criticalDelayMinutes: 15
  }
}
```

## Architecture

The system follows a microservices architecture with the following components:

- **Job Monitor Service**: Core monitoring and status tracking
- **Log Parser Service**: Automated log analysis and root cause extraction
- **Alert Service**: Multi-channel notification delivery
- **Configuration Manager**: Job configuration management
- **Dashboard Service**: Web interface and API endpoints
- **Data Persistence Service**: Historical data storage and retrieval

## Development

This project is built with TypeScript and includes:

- **Property-Based Testing**: Using fast-check for comprehensive test coverage
- **Type Safety**: Full TypeScript support with strict type checking
- **Database**: SQLite for local development, easily configurable for production databases
- **Logging**: Structured logging with configurable levels
- **Validation**: Comprehensive input validation and error handling

## License

MIT License - see LICENSE file for details.