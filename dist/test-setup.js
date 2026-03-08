"use strict";
// Jest test setup for property-based testing and common utilities
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTestDatabase = exports.setupTestDatabase = exports.TestGenerators = void 0;
const fc = __importStar(require("fast-check"));
// Custom matcher for property-based tests
expect.extend({
    async toSatisfyProperty(received, property) {
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
exports.TestGenerators = {
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
const setupTestDatabase = async () => {
    // This will be implemented when we create the database service
    return Promise.resolve();
};
exports.setupTestDatabase = setupTestDatabase;
const cleanupTestDatabase = async () => {
    // This will be implemented when we create the database service
    return Promise.resolve();
};
exports.cleanupTestDatabase = cleanupTestDatabase;
//# sourceMappingURL=test-setup.js.map