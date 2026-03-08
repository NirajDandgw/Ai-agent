import * as fc from 'fast-check';
declare global {
    namespace jest {
        interface Matchers<R> {
            toSatisfyProperty(property: fc.IProperty<any>): R;
        }
    }
}
export declare const TestGenerators: {
    jobId: () => fc.Arbitrary<string>;
    jobName: () => fc.Arbitrary<string>;
    schedule: () => fc.Arbitrary<string>;
    expectedDuration: () => fc.Arbitrary<number>;
    logPath: () => fc.Arbitrary<string>;
    timestamp: () => fc.Arbitrary<Date>;
    jobStatus: () => fc.Arbitrary<string>;
    alertType: () => fc.Arbitrary<string>;
    severity: () => fc.Arbitrary<string>;
    dataSourceType: () => fc.Arbitrary<string>;
};
export declare const setupTestDatabase: () => Promise<void>;
export declare const cleanupTestDatabase: () => Promise<void>;
//# sourceMappingURL=test-setup.d.ts.map