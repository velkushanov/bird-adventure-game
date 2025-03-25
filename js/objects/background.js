/**
 * BackgroundManager Class
 * Manages scrolling backgrounds with parallax effects
 */
class BackgroundManager {
    /**
     * Create a new background manager
     * @param {Phaser.Scene} scene - The scene this manager belongs to
     */
    constructor(scene) {
        this.scene = scene;
        
        // Background layers
        this.layers = [];
        
        // Current background theme
        this.currentTheme = null;
    }
    
    /**
     * Create background with parallax effect based on theme
     * @param {string} theme - Theme ID from CONFIG.BACKGROUNDS
     */
    createBackground(theme) {
        // Clear existing layers
        this.clearLayers();
        
        // Find theme in config
        const themeConfig = CONFIG.BACKGROUNDS.find(bg => bg.id === theme);
        if (!themeConfig) {
            console.error(`Background theme "${theme}" not found`);
            return;
        }
        
        // Store current theme
        this.currentTheme = theme;
        
        // Create background layers based on theme
        switch (theme) {
            case 'theme-forest':
                this.createForestBackground();
                break;
                
            case 'theme-cave':
                this.createCaveBackground();
                break;
                
            case 'theme-sky':
                this.createSkyBackground();
                break;
                
            case 'theme-mountain':
                this.createMountainBackground();
                break;
                
            case 'theme-underwater':
                this.createUnderwaterBackground();
                break;
                
            case 'theme-castle':
                this.createCastleBackground();
                break;
                
            default:
                // Default to sky theme if specific theme not implemented
                this.createSkyBackground();
                break;
        }
    }
    
    /**
     * Create forest theme background
     */
    createForestBackground() {
        // Sky layer (furthest)
        this.addLayer('bg-forest', 0, 0.2);
        
        // Far trees layer
        this.addLayer('bg-forest-far', 1, 0.4);
        
        // Near trees layer
        this.addLayer('bg-forest-near', 2, 0.6);
        
        // Ground layer (closest)
        this.addLayer('bg-forest-ground', 3, 1.0);
    }
    
    /**
     * Create cave theme background
     */
    createCaveBackground() {
        // Far cave wall
        this.addLayer('bg-cave', 0, 0.2);
        
        // Mid cave details
        this.addLayer('bg-cave-mid', 1, 0.5);
        
        // Cave foreground
        this.addLayer('bg-cave-near', 2, 0.8);
        
        // Add floating particles
        this.createParticleEffect('dust');
    }
    
    /**
     * Create sky theme background
     */
    createSkyBackground() {
        // Sky layer
        this.addLayer('bg-sky', 0, 0.1);
        
        // Far clouds
        this.addLayer('bg-sky-clouds-far', 1, 0.3);
        
        // Mid clouds
        this.addLayer('bg-sky-clouds-mid', 2, 0.5);
        
        // Near clouds
        this.addLayer('bg-sky-clouds-near', 3, 0.7);
    }
    
    /**
     * Create mountain theme background
     */
    createMountainBackground() {
        // Sky layer
        this.addLayer('bg-mountain-sky', 0, 0.1);
        
        // Far mountains
        this.addLayer('bg-mountain-far', 1, 0.3);
        
        // Mid mountains
        this.addLayer('bg-mountain-mid', 2, 0.5);
        
        // Near mountains
        this.addLayer('bg-mountain-near', 3, 0.8);
    }
    
    /**
     * Create underwater theme background
     */
    createUnderwaterBackground() {
        // Deep water
        this.addLayer('bg-underwater', 0, 0.2);
        
        // Mid water plants
        this.addLayer('bg-underwater-mid', 1, 0.4);
        
        // Near water plants
        this.addLayer('bg-underwater-near', 2, 0.6);
        
        // Add bubble particles
        this.createParticleEffect('bubbles');
    }
    
    /**
     * Create castle theme background
     */
    createCastleBackground() {
        // Castle background
        this.addLayer('bg-castle', 0, 0.2);
        
        // Castle mid layer
        this.addLayer('bg-castle-mid', 1, 0.5);
        
        // Castle foreground
        this.addLayer('bg-castle-near', 2, 0.8);
        
        // Add flame particles
        this.createParticleEffect('flames');
    }
    
    /**
     * Add a scrolling background layer
     * @param {string} texture - Texture key for the background layer
     * @param {number} depth - Display depth (z-index)
     * @param {number} scrollFactor - How fast this layer scrolls (1.0 = full speed)
     * @returns {Phaser.GameObjects.TileSprite} The created layer
     */
    addLayer(texture, depth, scrollFactor) {
        // Create tile sprite for repeating background
        const layer = this.scene.add.tileSprite(
            0, 0,
            CONFIG.GAME_WIDTH,
            CONFIG.GAME_HEIGHT,
            texture
        ).setOrigin(0, 0);
        
        // Set layer depth
        layer.setDepth(-10 + depth);
        
        // Store scroll speed
        layer.scrollFactor = scrollFactor;
        
        // Add to layers array
        this.layers.push(layer);
        
        return layer;
    }
    
    /**
     * Create particle effect for the background
     * @param {string} type - Type of particle effect ('dust', 'bubbles', 'flames')
     */
    createParticleEffect(type) {
        // Create particle manager if not exists
        if (!this.particles) {
            this.particles = this.scene.add.particles('particle');
            this.particles.setDepth(-5); // Between background and foreground
        }
        
        // Configure emitter based on effect type
        switch (type) {
            case 'dust':
                // Dust particles for cave
                this.particleEmitter = this.particles.createEmitter({
                    x: { min: 0, max: CONFIG.GAME_WIDTH },
                    y: { min: 0, max: CONFIG.GAME_HEIGHT },
                    speedX: { min: -20, max: -10 },
                    speedY: { min: -5, max: 5 },
                    scale: { start: 0.2, end: 0 },
                    alpha: { start: 0.5, end: 0 },
                    lifespan: { min: 2000, max: 5000 },
                    quantity: 1,
                    frequency: 200,
                    tint: 0xcccccc
                });
                break;
                
            case 'bubbles':
                // Bubble particles for underwater
                this.particleEmitter = this.particles.createEmitter({
                    x: { min: 0, max: CONFIG.GAME_WIDTH },
                    y: CONFIG.GAME_HEIGHT,
                    speedX: { min: -10, max: 10 },
                    speedY: { min: -60, max: -30 },
                    scale: { start: 0.3, end: 0.1 },
                    alpha: { start: 0.8, end: 0 },
                    lifespan: { min: 3000, max: 6000 },
                    quantity: 1,
                    frequency: 300,
                    tint: 0xaaddff
                });
                break;
                
            case 'flames':
                // Flame particles for castle
                this.particleEmitter = this.particles.createEmitter({
                    x: { min: 0, max: CONFIG.GAME_WIDTH },
                    y: { min: CONFIG.GAME_HEIGHT - 50, max: CONFIG.GAME_HEIGHT },
                    speedX: { min: -5, max: 5 },
                    speedY: { min: -60, max: -30 },
                    scale: { start: 0.4, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    lifespan: { min: 1000, max: 2000 },
                    quantity: 1,
                    frequency: 200,
                    tint: [0xff3300, 0xff9900]
                });
                break;
        }
    }
    
    /**
     * Update background layers
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     * @param {number} speed - Game speed
     */
    update(time, delta, speed) {
        // Update each layer based on scroll factor
        this.layers.forEach(layer => {
            // Move layer based on game speed and its scroll factor
            layer.tilePositionX += (speed * layer.scrollFactor * delta) / 1000;
        });
    }
    
    /**
     * Transition to a new background theme
     * @param {string} newTheme - New theme ID
     */
    transition(newTheme) {
        // Don't transition to the same theme
        if (newTheme === this.currentTheme) return;
        
        // Fade out current background
        this.scene.tweens.add({
            targets: this.layers,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                // Clear layers
                this.clearLayers();
                
                // Create new background
                this.createBackground(newTheme);
                
                // Fade in new background
                this.scene.tweens.add({
                    targets: this.layers,
                    alpha: { from: 0, to: 1 },
                    duration: 500
                });
            }
        });
        
        // Fade out particles if they exist
        if (this.particleEmitter) {
            this.scene.tweens.add({
                targets: this.particles,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    if (this.particles) {
                        this.particles.destroy();
                        this.particles = null;
                        this.particleEmitter = null;
                    }
                }
            });
        }
    }
    
    /**
     * Clear all background layers
     */
    clearLayers() {
        // Destroy all layers
        this.layers.forEach(layer => {
            layer.destroy();
        });
        
        // Reset layers array
        this.layers = [];
        
        // Clean up particles
        if (this.particles) {
            this.particles.destroy();
            this.particles = null;
            this.particleEmitter = null;
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.clearLayers();
    }
}