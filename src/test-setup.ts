// Jest test setup for property-based testing and common utilities

import * as fc from 'fast-check';

// Extend Jest matchers for property-based testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toSatisfyProperty(property: fc.IProperty<any>): R;
    }
  }
}

// Custom matcher for property-based tests
expect.extend({
  async toSatisfyProperty(received: any, property: fc.IProperty<any>) {
    const result = await fc.check(property, { numRuns: 100 });
    
    if (result.failed) {
      return {
        message: () => `Property failed with counterexample: ${JSON.stringify(result.counterexample)}`,
        pass: false,
      };
    }

    return {
      message: () => `Property passed all ${result.numRuns} tests`,
      pass: true,
    };
  },
});

// Test utilities for generating test data
export const TestGenerators = {
  jobId: () => fc.string({ minLength: 1, maxLength: 50 }),
  jobName: () => fc.string({ minLength: 1, maxLength: 100 }),
  schedule: () => fc.constantFrom('0 2 * * *', '0 */6 * * *', '0 0 * * 0'),
  expectedDuration: () => fc.integer({ min: 1, max: 480 }), // 1 minute to 8 hours
  logPath: () => fc.string({ minLength: 5, maxLength: 200 }),
  timestamp: () => fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  jobStatus: () => fc.constantFrom('Running', 'Success', 'Failed', 'Delayed'),
  alertType: () => fc.constantFrom('Failure', 'Delay', 'SystemHealth'),
  severity: () => fc.constantFrom('Low', 'Medium', 'High', 'Critical'),
  dataSourceType: () => fc.constantFrom('SchedulerLogs', 'ETLLogs', 'Database'),
};

// Test database setup
export const setupTestDatabase = async () => {
  // This will be implemented when we create the database service
  return Promise.resolve();
};

export const cleanupTestDatabase = async () => {
  // This will be implemented when we create the database service
  return Promise.resolve();
};