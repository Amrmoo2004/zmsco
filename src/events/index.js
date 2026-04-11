import EventEmitter from 'events';

class SystemEventBus extends EventEmitter {}

// Global instance to be used across the application
const eventBus = new SystemEventBus();

// Optionally setup central error handling for events
eventBus.on('error', (err) => {
    console.error('🔥 [EventBus Error]:', err);
});

export default eventBus;
