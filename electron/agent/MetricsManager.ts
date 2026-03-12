/**
 * Metrics Manager
 * 
 * Tracks agent performance metrics to drive improvements.
 * Stores data in `agent-metrics.json`.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface TaskMetric {
    taskId: string;
    goal: string;
    startTime: number;
    endTime?: number;
    success: boolean;
    stepCount: number;
    retryCount: number;
    error?: string;
}

export interface ActionMetric {
    actionId: string;
    taskId: string;
    type: string;
    durationMs: number;
    retries: number;
    finalRetryLevel: number;
    success: boolean;
    error?: string;
    timestamp: number;
}

export class MetricsManager {
    private metricsPath: string;
    private currentTask: TaskMetric | null = null;
    private actionBuffer: ActionMetric[] = [];

    constructor() {
        // Handle potential issues if app is not ready (though usually it is in main process)
        try {
            this.metricsPath = path.join(app.getPath('userData'), 'agent-metrics.json');
        } catch (e) {
            this.metricsPath = 'agent-metrics.json'; // Fallback for tests
        }
    }

    // --- Task Tracking ---

    startTask(taskId: string, goal: string): void {
        this.currentTask = {
            taskId,
            goal,
            startTime: Date.now(),
            success: false,
            stepCount: 0,
            retryCount: 0
        };
        console.log(`[MetricsManager] Started Task: ${taskId}`);
    }

    endTask(success: boolean, error?: string): void {
        if (!this.currentTask) return;

        this.currentTask.endTime = Date.now();
        this.currentTask.success = success;
        this.currentTask.error = error;

        this.saveTask(this.currentTask);
        this.currentTask = null;
    }

    // --- Action Tracking ---

    recordAction(metric: Omit<ActionMetric, 'taskId'>): void {
        const fullMetric: ActionMetric = {
            ...metric,
            taskId: this.currentTask?.taskId || 'unknown'
        };
        this.actionBuffer.push(fullMetric);
        
        if (this.currentTask) {
            this.currentTask.stepCount++;
            this.currentTask.retryCount += metric.retries;
        }

        // Flush periodically or on every action for now
        this.saveActions();
    }

    // --- Persistence ---

    private saveTask(task: TaskMetric): void {
        // Append to file (simulated by reading, appending, writing)
        // For production, we might want a proper DB or rotating logs
        try {
            let data: { tasks: TaskMetric[], actions: ActionMetric[] } = { tasks: [], actions: [] };
            if (fs.existsSync(this.metricsPath)) {
                data = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
            }
            data.tasks.push(task);
            
            // Limit history
            if (data.tasks.length > 100) data.tasks = data.tasks.slice(-100);

            fs.writeFileSync(this.metricsPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[MetricsManager] Failed to save task metrics:', error);
        }
    }

    private saveActions(): void {
        if (this.actionBuffer.length === 0) return;

        try {
            let data: { tasks: TaskMetric[], actions: ActionMetric[] } = { tasks: [], actions: [] };
            if (fs.existsSync(this.metricsPath)) {
                data = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
            }
            
            data.actions.push(...this.actionBuffer);
            this.actionBuffer = [];

            // Limit history
            if (data.actions.length > 1000) data.actions = data.actions.slice(-1000);

            fs.writeFileSync(this.metricsPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[MetricsManager] Failed to save action metrics:', error);
        }
    }

    // --- Analysis ---

    getSuccessRate(): number {
        try {
            if (!fs.existsSync(this.metricsPath)) return 0;
            const data = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
            if (data.tasks.length === 0) return 0;
            
            const successful = data.tasks.filter((t: TaskMetric) => t.success).length;
            return (successful / data.tasks.length) * 100;
        } catch {
            return 0;
        }
    }
}

export const metricsManager = new MetricsManager();
