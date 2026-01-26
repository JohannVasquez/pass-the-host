// Domain
export * from "./domain";

// Infrastructure
export * from "./infrastructure/event-bus";

// Dependency Injection
export * from "./di";

// Re-export specific items that are commonly used
export { eventBus } from "./infrastructure/event-bus";
export { appContainer } from "./di";
