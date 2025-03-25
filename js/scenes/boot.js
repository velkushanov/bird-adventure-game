/**
 * BootScene
 * First scene loaded - handles initial setup and transitions to the preloader
 */
class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }
    
    preload() {
        // Load minimal assets needed for the loading screen
        this.load.image('logo', 'assets/ui/logo.png');
        this.load.image('loading-bar', 'assets/ui/loading-bar.png');
    }
    
    create() {
        // Set up any game configurations that need to be done before loading all assets
        
        // Apply any device-specific settings
        this.setupDevice();
        
        // Initialize game systems
        this.initializeGameSystems();
        
        // Proceed to the preloader scene
        this.scene.start('PreloaderScene');
    }
    
    /**
     * Set up device-specific configurations
     */
    setupDevice() {
        // Detect mobile device
        const isMobile = this.sys.game.device.os.android || 
                          this.sys.game.device.os.iOS || 
                          this.sys.game.device.os.iPad ||
                          this.sys.game.device.os.iPhone;
        
        // Store this information for later use
        this.registry.set('isMobile', isMobile);
        
        // Set up touch-specific input if on mobile
        if (isMobile) {
            this.input.addPointer(2); // Support multi-touch
        }
        
        // Set up for different screen orientations
        this.scale.on('orientationchange', this.handleOrientation, this);
        this.handleOrientation(this.scale.orientation);
    }
    
    /**
     * Handle screen orientation changes
     * @param {string} orientation - The new orientation
     */
    handleOrientation(orientation) {
        // You can respond to orientation changes here
        if (orientation === Phaser.Scale.PORTRAIT) {
            // Portrait mode settings
            console.log('Portrait mode');
        } else if (orientation === Phaser.Scale.LANDSCAPE) {
            // Landscape mode settings
            console.log('Landscape mode');
        }
    }
    
    /**
     * Initialize game systems
     */
    initializeGameSystems() {
        // Set up any game-wide systems here
        
        // Example: Game-wide event emitter
        this.events.emit('system-ready');
    }
}