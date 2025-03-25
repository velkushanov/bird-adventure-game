/**
 * Game Configuration and Constants
 * This file contains global game settings and constants
 */

const CONFIG = {
    // Game settings
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,
    GRAVITY: 600,
    FPS: 60,
    
    // Bird settings
    BIRD_START_X: 150,
    BIRD_START_Y: 300,
    BIRD_FLAP_VELOCITY: -350,
    BIRD_COLLIDER_REDUCTION: 0.8, // Smaller hitbox than visual
    
    // Level settings
    LEVEL_DURATION: 30000, // 30 seconds per level
    BASE_GAME_SPEED: 200,
    LEVEL_SPEED_INCREASE: 25,
    
    // Obstacle settings
    OBSTACLE_SPAWN_RATE: 2000, // 2 seconds
    MIN_OBSTACLE_GAP: 150,
    OBSTACLE_GAP_DECREMENT: 5, // Per level
    
    // Enemy settings
    ENEMY_SPAWN_RATE: 3000, // 3 seconds
    ENEMY_SPEED_OFFSET: 50, // Slower than obstacles
    
    // Power-up settings
    POWERUP_SPAWN_RATE: 5000, // 5 seconds
    POWERUP_SPEED_OFFSET: 100, // Slower than obstacles
    MUSHROOM_DURATION: 5000, // 5 seconds
    FLOWER_DURATION: 10000, // 10 seconds
    FIREBALL_SPEED: 400,
    FIREBALL_RATE: 1000, // 1 shot per second
    
    // Scoring
    BASE_OBSTACLE_POINTS: 1,
    BASE_ENEMY_POINTS: 5,
    BIG_OBSTACLE_POINTS: 3,
    
    // Firebase config - Replace with your Firebase project details
    FIREBASE: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com"
    },
    
    // Character options
    CHARACTERS: [
        { 
            id: 'bluebird', 
            name: 'Blue Bird', 
            texture: 'bird-blue',
            flightPower: 1.0
        },
        { 
            id: 'redbird', 
            name: 'Red Bird', 
            texture: 'bird-red',
            flightPower: 1.2 // Flies stronger
        },
        { 
            id: 'yellowbird', 
            name: 'Yellow Bird', 
            texture: 'bird-yellow',
            flightPower: 0.9 // More agile but weaker
        },
        { 
            id: 'purplebird', 
            name: 'Purple Bird', 
            texture: 'bird-purple',
            flightPower: 1.1 // Balanced
        },
        { 
            id: 'greenbird', 
            name: 'Green Bird', 
            texture: 'bird-green',
            flightPower: 1.0 // Standard
        },
        { 
            id: 'rainbowbird', 
            name: 'Rainbow Bird', 
            texture: 'bird-rainbow',
            flightPower: 1.3 // Special character
        }
    ],
    
    // Background themes
    BACKGROUNDS: [
        { id: 'theme-forest', texture: 'bg-forest' },
        { id: 'theme-cave', texture: 'bg-cave' },
        { id: 'theme-sky', texture: 'bg-sky' },
        { id: 'theme-mountain', texture: 'bg-mountain' },
        { id: 'theme-underwater', texture: 'bg-underwater' },
        { id: 'theme-castle', texture: 'bg-castle' }
    ],
    
    // Difficulty scaling
    MAX_LEVEL: 10, // After this level, difficulty stops increasing
    
    // Multiplayer
    MAX_PLAYERS: 4,
    ROOM_TIMEOUT: 120000, // 2 minutes
    
    // Asset paths
    ASSET_PATH: 'assets/',
    
    // Debug mode
    DEBUG: false
};

// Export configuration for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}