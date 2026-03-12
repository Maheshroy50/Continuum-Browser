/**
 * AI Agent Module
 * 
 * Exports all agent-related functionality for use in main process.
 */

// Types
export * from './types';

// Core services
export { IntentValidator, intentValidator } from './IntentValidator';
export { PermissionManager, permissionManager } from './PermissionManager';
export { AgentMemory, agentMemory } from './AgentMemory';
export { ActionExecutor, actionExecutor } from './ActionExecutor';
export { AgentGateway, agentGateway, initializeAgentGateway } from './AgentGateway';
export { WorkflowEngine } from './WorkflowEngine';
