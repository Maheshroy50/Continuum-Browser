import { EventEmitter } from 'events';
import { AgentGateway } from './AgentGateway';
// import { AgentIntent } from './types';

export type JobType = 'discovery' | 'execution';

export interface WorkflowJob {
    id: string;
    type: JobType;
    status: 'pending' | 'running' | 'completed' | 'failed';
    target: string; // URL or Query
    goal: string;
    result?: any;
    error?: string;
}

export class WorkflowEngine extends EventEmitter {
    private queue: WorkflowJob[] = [];
    private activeJobs: Map<string, WorkflowJob> = new Map();
    private isRunning: boolean = false;
    private concurrency: number;

    constructor(private agentGateway: AgentGateway, concurrency: number = 1) {
        super();
        this.concurrency = concurrency;
    }

    /**
     * Add a job to the queue
     */
    addJob(type: JobType, target: string, goal: string): string {
        const job: WorkflowJob = {
            id: Math.random().toString(36).substring(7),
            type,
            status: 'pending',
            target,
            goal
        };
        this.queue.push(job);
        this.emit('queue-updated', this.queue);
        return job.id;
    }

    /**
     * Start processing the queue
     */
    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.processQueue();
    }

    /**
     * Stop processing
     */
    stop() {
        this.isRunning = false;
        // Mark all active jobs as failed
        if (this.activeJobs.size > 0) {
            this.activeJobs.forEach(job => {
                job.status = 'failed';
                job.error = 'Workflow stopped by user';
            });
            this.activeJobs.clear();
        }
        this.emit('queue-updated', this.queue);
    }

    /**
     * Process the queue to fill available concurrency slots
     */
    private async processQueue() {
        if (!this.isRunning) return;

        while (this.activeJobs.size < this.concurrency && this.isRunning) {
            const nextJob = this.queue.find(j => j.status === 'pending');
            if (!nextJob) {
                if (this.activeJobs.size === 0) {
                    this.isRunning = false;
                    this.emit('workflow-complete');
                }
                break;
            }

            this.runJob(nextJob);
        }
    }

    /**
     * Run a specific job
     */
    private async runJob(job: WorkflowJob) {
        job.status = 'running';
        this.activeJobs.set(job.id, job);
        this.emit('job-started', job);
        this.emit('queue-updated', this.queue);

        try {
            await this.executeJob(job);
            job.status = 'completed';
        } catch (error: any) {
            job.status = 'failed';
            job.error = error.message;
        } finally {
            this.activeJobs.delete(job.id);
            this.emit('job-completed', job);
            this.emit('queue-updated', this.queue);
            
            // Trigger next
            this.processQueue();
        }
    }

    /**
     * Execute a single job using the AgentGateway
     */
    private async executeJob(job: WorkflowJob) {
        console.log(`[WorkflowEngine] Executing job ${job.id}: ${job.type} -> ${job.target}`);

        // TODO: For concurrency > 1, we need to spawn separate BrowserViews here.
        // Currently, AgentGateway uses the single active view.
        
        if (job.type === 'discovery') {
            await this.agentGateway.processRequest(
                `Go to ${job.target} and ${job.goal}. Return a list of relevant URLs found.`,
                'openai',
                '',
                'gpt-4o'
            );
        } else if (job.type === 'execution') {
            await this.agentGateway.processRequest(
                `Go to ${job.target} and ${job.goal}. Use my resume profile to fill forms if needed.`,
                'openai',
                '',
                'gpt-4o'
            );
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.activeJobs.values()),
            queueLength: this.queue.length,
            completed: this.queue.filter(j => j.status === 'completed').length,
            failed: this.queue.filter(j => j.status === 'failed').length
        };
    }
}
