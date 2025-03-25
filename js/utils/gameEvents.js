/**
 * gameEvents.js
 * A centralized event management system for the game
 * This helps with managing cross-scene communication
 */

// Create a global event emitter if it doesn't exist
window.gameEvents = window.gameEvents || new Phaser.Events.EventEmitter();

/**
 * Helper class to manage game-wide events
 */
class GameEventManager {
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context for the callback
     * @returns {Object} Subscription object with remove method
     */
    static subscribe(event, callback, context) {
        if (!window.gameEvents) {
            console.error('Game events system not initialized');
            return { remove: () => {} };
        }
        
        window.gameEvents.on(event, callback, context);
        
        // Return an object with a remove method for easy cleanup
        return {
            remove: () => {
                this.unsubscribe(event, callback, context);
            }
        };
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context for the callback
     */
    static unsubscribe(event, callback, context) {
        if (!window.gameEvents) return;
        
        window.gameEvents.off(event, callback, context);
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to the callbacks
     */
    static emit(event, ...args) {
        if (!window.gameEvents) {
            console.error('Game events system not initialized');
            return;
        }
        
        window.gameEvents.emit(event, ...args);
    }
    
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context for the callback
     */
    static once(event, callback, context) {
        if (!window.gameEvents) {
            console.error('Game events system not initialized');
            return;
        }
        
        window.gameEvents.once(event, callback, context);
    }
    
    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    static removeAllListeners(event) {
        if (!window.gameEvents) return;
        
        window.gameEvents.removeAllListeners(event);
    }
}

/**
 * Game event constants
 * Centralizing event names helps prevent typos and makes refactoring easier
 */
const GameEvents = {
    // System events
    GAME_READY: 'game:ready',
    GAME_PAUSED: 'game:paused',
    GAME_RESUMED: 'game:resumed',
    SCENE_CHANGED: 'scene:changed',
    SCENE_RESTART: 'scene:restart',
    
    // Player events
    PLAYER_DIED: 'player:died',
    PLAYER_SCORED: 'player:scored',
    PLAYER_POWERUP: 'player:powerup',
    PLAYER_READY: 'player:ready',
    PLAYER_CHARACTER_SELECTED: 'player:characterSelected',
    
    // Multiplayer events
    MULTIPLAYER_ROOM_JOINED: 'multiplayer:roomJoined',
    MULTIPLAYER_ROOM_LEFT: 'multiplayer:roomLeft',
    MULTIPLAYER_GAME_STARTED: 'multiplayer:gameStarted',
    MULTIPLAYER_GAME_ENDED: 'multiplayer:gameEnded',
    MULTIPLAYER_PLAYER_JOINED: 'multiplayer:playerJoined',
    MULTIPLAYER_PLAYER_LEFT: 'multiplayer:playerLeft',
    MULTIPLAYER_PLAYER_READY: 'multiplayer:playerReady',
    MULTIPLAYER_PLAYER_POSITION: 'multiplayer:playerPosition',
    MULTIPLAYER_ERROR: 'multiplayer:error',
    
    // UI events
    MODAL_OPENED: 'ui:modalOpened',
    MODAL_CLOSED: 'ui:modalClosed',
    BUTTON_CLICKED: 'ui:buttonClicked',
    
    // Firebase events
    FIREBASE_INITIALIZED: 'firebase:initialized',
    FIREBASE_AUTH_CHANGED: 'firebase:authChanged',
    FIREBASE_ERROR: 'firebase:error',
    
    // Game state events
    LEVEL_CHANGED: 'game:levelChanged',
    HIGH_SCORE_UPDATED: 'game:highScoreUpdated',
    
    // Custom event to handle network errors
    NETWORK_ERROR: 'system:networkError'
};

/**
 * Helper function to create a logger specifically for event handling
 * @param {string} component - Component name
 * @returns {Object} Logger object
 */
function createEventLogger(component) {
    return {
        log: (message, ...args) => {
            if (CONFIG.DEBUG) {
                console.log(`[${component}] ${message}`, ...args);
            }
        },
        error: (message, ...args) => {
            console.error(`[${component}] ${message}`, ...args);
        },
        warn: (message, ...args) => {
            console.warn(`[${component}] ${message}`, ...args);
        }
    };
}