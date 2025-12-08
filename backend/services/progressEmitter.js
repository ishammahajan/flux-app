/**
 * Progress Emitter
 * Event-based progress updates for async operations
 */

const EventEmitter = require('events');

class ProgressEmitter extends EventEmitter {
    constructor() {
        super();
        this.requests = new Map(); // requestId -> { status, events[] }
    }

    /**
     * Create a new request tracker
     * @param {string} requestId - Unique request identifier
     * @returns {object} - Request tracker with emit methods
     */
    createRequest(requestId) {
        this.requests.set(requestId, {
            status: 'pending',
            events: [],
            startTime: Date.now()
        });

        return {
            emit: (stage, data = {}) => this.emitProgress(requestId, stage, data),
            complete: (result) => this.completeRequest(requestId, result),
            error: (error) => this.errorRequest(requestId, error)
        };
    }

    /**
     * Emit a progress event
     */
    emitProgress(requestId, stage, data = {}) {
        const event = {
            requestId,
            stage,
            timestamp: new Date().toISOString(),
            ...data
        };

        const request = this.requests.get(requestId);
        if (request) {
            request.events.push(event);
            request.status = stage;
        }

        this.emit('progress', event);
        return event;
    }

    /**
     * Mark request as complete
     */
    completeRequest(requestId, result) {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = 'complete';
            request.result = result;
            request.duration = Date.now() - request.startTime;
        }

        this.emit('progress', {
            requestId,
            stage: 'complete',
            timestamp: new Date().toISOString(),
            result
        });

        // Cleanup after 5 minutes
        setTimeout(() => this.requests.delete(requestId), 5 * 60 * 1000);
    }

    /**
     * Mark request as errored
     */
    errorRequest(requestId, error) {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = 'error';
            request.error = error.message || error;
        }

        this.emit('progress', {
            requestId,
            stage: 'error',
            timestamp: new Date().toISOString(),
            error: error.message || error
        });
    }

    /**
     * Get request status
     */
    getRequest(requestId) {
        return this.requests.get(requestId);
    }
}

// Singleton instance
const progressEmitter = new ProgressEmitter();

module.exports = progressEmitter;
