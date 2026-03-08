import sqlite3 from 'sqlite3';
export declare class DatabaseConnection {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    connect(): Promise<void>;
    initializeSchema(): Promise<void>;
    run(sql: string, params?: any[]): Promise<sqlite3.RunResult>;
    get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
    all<T = any>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
    isConnected(): boolean;
}
//# sourceMappingURL=connection.d.ts.map