/**
 * PowerUp Class
 * Represents collectible power-ups that give the player special abilities
 * FIXED: Added proper cleanup and error handling
 */
class PowerUp extends Phaser.Physics.Arcade.Sprite {
    /**
     * Create a new power-up
     * @param {Phaser.Scene} scene - The scene the power-up belongs to
     * @param {number} x - Initial x position
     * @param {number} y - Initial y position
     * @param {string} texture - The texture key to use
     * @param {Object} config - Additional configuration
     */
    constructor(scene, x, y, texture, config = {}) {
        super(scene, x, y, texture);
        
        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Store reference to scene
        this.scene = scene;
        
        // Set properties from config
        this.type = config.type || texture;
        this.value = config.value || 1;
        this.collected = false;
        
        // Configure physics body
        this.body.allowGravity = false;
        
        // Initialize tween reference
        this.animationTween = null;
        this.colorCycle = null;
        this.colorIndex = 0;
        
        // Apply effects based on power-up type
        this.applyTypeEffects();
    }
    
    /**
     * Apply visual and behavior effects based on power-up type
     * FIX: Store tween references for cleanup
     */
    applyTypeEffects() {
        try {
            switch (this.type) {
                case 'mushroom':
                    // Mushroom - size increase power
                    // Pulsing effect
                    this.animationTween = this.scene.tweens.add({
                        targets: this,
                        scale: { from: 0.9, to: 1.1 },
                        duration: 600,
                        yoyo: true,
                        repeat: -1
                    });
                    break;
                    
                case 'flower':
                    // Flower - shooting ability
                    // Rotation effect
                    this.animationTween = this.scene.tweens.add({
                        targets: this,
                        angle: { from: -5, to: 5 },
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                    break;
                    
                case 'star':
                    // Star - invincibility
                    // Rotation and pulsing
                    this.animationTween = this.scene.tweens.add({
                        targets: this,
                        angle: { from: 0, to: 360 },
                        scale: { from: 0.8, to: 1.2 },
                        duration: 1500,
                        repeat: -1
                    });
                    
                    // Color cycling
                    this.colorCycle = this.scene.time.addEvent({
                        delay: 150,
                        callback: this.cycleColor,
                        callbackScope: this,
                        loop: true
                    });
                    break;
                    
                case 'coin':
                    // Coin - points
                    // Rotation effect
                    this.animationTween = this.scene.tweens.add({
                        targets: this,
                        angle: { from: 0, to: 360 },
                        duration: 1000,
                        repeat: -1
                    });
                    break;
                
                default:
                    // Default floating animation
                    this.animationTween = this.scene.tweens.add({
                        targets: this,
                        y: this.y + 10,
                        duration: 1000,
                        yoyo: true,
                        repeat: -1
                    });
                    break;
            }
        } catch (error) {
            console.error('Error in PowerUp.applyTypeEffects:', error);
        }
    }
    
    /**
     * Cycle colors for star power-up
     * FIX: Added active check
     */
    cycleColor() {
        if (!this.active) return;
        
        try {
            const colors = [0xffff00, 0xff0000, 0x00ff00, 0x0000ff, 0xff00ff];
            this.colorIndex = (this.colorIndex || 0) + 1;
            if (this.colorIndex >= colors.length) this.colorIndex = 0;
            
            this.setTint(colors[this.colorIndex]);
        } catch (error) {
            console.error('Error in PowerUp.cycleColor:', error);
        }
    }
    
    /**
     * Update power-up behavior
     * @param {number} time - Current time
     * @param {number} delta - The delta time in ms since the last frame
     * @param {number} speed - Game speed
     * FIX: Added active check
     */
    update(time, delta, speed) {
        if (!this.active) return;
        
        try {
            // Move based on game speed (slower than obstacles)
            const moveAmount = (speed - CONFIG.POWERUP_SPEED_OFFSET) * delta / 1000;
            this.x -= moveAmount;
            
            // Add floating effect
            if (this.type !== 'star' && this.type !== 'coin') {
                this.y += Math.sin(time / 300) * 0.5;
            }
            
            // Remove if off screen
            if (this.x < -this.width) {
                this.destroy();
            }
        } catch (error) {
            console.error('Error in PowerUp.update:', error);
        }
    }
    
    /**
     * Collect the power-up
     * @returns {Object} Power-up effect info
     * FIX: Added active check and error handling
     */
    collect() {
        if (this.collected || !this.active) return null;
        
        try {
            // Mark as collected
            this.collected = true;
            
            // Create collection effect
            this.createCollectEffect();
            
            // Play collection sound
            if (this.type === 'coin') {
                this.scene.sound.play('sfx-coin', { volume: 0.7 });
            } else {
                this.scene.sound.play('sfx-powerup', { volume: 0.7 });
            }
            
            // Return power-up effect info
            const effectInfo = {
                type: this.type,
                value: this.value
            };
            
            // Destroy power-up
            this.destroy();
            
            return effectInfo;
        } catch (error) {
            console.error('Error in PowerUp.collect:', error);
            
            // Still try to destroy if there was an error
            if (this.active) {
                this.destroy();
            }
            
            return {
                type: this.type,
                value: this.value
            };
        }
    }
    
    /**
     * Create collection effect
     * FIX: Added error handling
     */
    createCollectEffect() {
        try {
            // Create particles
            const particles = this.scene.add.particles('particle');
            
            // Set particle color based on power-up type
            let particleColor;
            
            switch (this.type) {
                case 'mushroom':
                    particleColor = 0xff0000; // Red for mushroom
                    break;
                    
                case 'flower':
                    particleColor = 0xff9900; // Orange for flower
                    break;
                    
                case 'star':
                    particleColor = 0xffff00; // Yellow for star
                    break;
                    
                case 'coin':
                    particleColor = 0xffdd00; // Gold for coin
                    break;
                    
                default:
                    particleColor = 0xffffff; // White default
                    break;
            }
            
            // Create particle emitter
            const emitter = particles.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 30, max: 80 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.4, end: 0 },
                lifespan: 600,
                quantity: 15,
                tint: particleColor
            });
            
            // Stop emitting after burst
            this.scene.time.delayedCall(100, () => {
                if (emitter && emitter.active) {
                    emitter.stop();
                    
                    // Clean up particles after they fade
                    this.scene.time.delayedCall(600, () => {
                        if (particles && particles.active) {
                            particles.destroy();
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error in PowerUp.createCollectEffect:', error);
        }
    }
    
    /**
     * Clean up resources
     * FIX: Comprehensive cleanup of all resources
     */
    destroy() {
        try {
            // Clean up color cycle timer if it exists
            if (this.colorCycle) {
                this.colorCycle.remove();
                this.colorCycle = null;
            }
            
            // Clean up animation tween if it exists
            if (this.animationTween) {
                this.animationTween.stop();
                this.animationTween = null;
            }
            
            // Reset state
            this.collected = true;
            
            // Call parent destroy
            super.destroy();
        } catch (error) {
            console.error('Error in PowerUp.destroy:', error);
            
            // Still try to call parent destroy even if there was an error
            try {
                super.destroy();
            } catch (e) {
                console.error('Error in PowerUp.super.destroy:', e);
            }
        }
    }
}

/**
 * PowerUpManager Class
 * Manages power-up generation and types
 * FIXED: Added error handling and proper event handling
 */
class PowerUpManager {
    /**
     * Create a new power-up manager
     * @param {Phaser.Scene} scene - The scene this manager belongs to
     * @param {Phaser.Physics.Arcade.Group} powerUpGroup - Group for power-ups
     */
    constructor(scene, powerUpGroup) {
        this.scene = scene;
        this.powerUps = powerUpGroup;
        
        // Power-up types with their rarities and levels
        this.powerUpTypes = [
            {
                type: 'mushroom',
                texture: 'mushroom',
                rarity: 0.5,  // Common
                minLevel: 1
            },
            {
                type: 'flower',
                texture: 'flower',
                rarity: 0.3,  // Uncommon
                minLevel: 2
            },
            {
                type: 'coin',
                texture: 'coin',
                rarity: 0.8,  // Very common
                minLevel: 1
            },
            {
                type: 'star',
                texture: 'star',
                rarity: 0.15, // Rare
                minLevel: 3
            }
        ];
        
        // Listen for spawn requests from obstacle patterns
        this.spawnListener = this.scene.events.on('spawn_powerup', this.spawnAtPosition, this);
    }
    
    /**
     * Generate random power-up based on current level
     * @param {number} level - Current game level
     * FIX: Added error handling
     */
    generate(level) {
        try {
            // Don't spawn too many power-ups
            if (this.powerUps.getLength() >= 3) return;
            
            // Random position
            const x = CONFIG.GAME_WIDTH;
            const y = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100);
            
            // Select power-up type based on level and rarity
            this.spawnPowerUp(x, y, level);
        } catch (error) {
            console.error('Error in PowerUpManager.generate:', error);
        }
    }
    
    /**
     * Spawn a power-up at a specific position (used by obstacle patterns)
     * @param {Object} position - Position object with x and y coordinates
     * FIX: Added error handling
     */
    spawnAtPosition(position) {
        try {
            const level = this.scene.level || 1;
            this.spawnPowerUp(position.x, position.y, level);
        } catch (error) {
            console.error('Error in PowerUpManager.spawnAtPosition:', error);
        }
    }
    
    /**
     * Spawn a power-up at the given position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} level - Current game level
     * FIX: Added comprehensive error handling
     */
    spawnPowerUp(x, y, level) {
        try {
            // Get available power-ups for current level
            const availableTypes = this.powerUpTypes.filter(p => p.minLevel <= level);
            
            if (availableTypes.length === 0) return;
            
            // Weighted selection based on rarity
            let totalWeight = 0;
            
            // Calculate total weight
            availableTypes.forEach(powerUp => {
                totalWeight += powerUp.rarity;
            });
            
            // Random value
            let random = Phaser.Math.RND.frac() * totalWeight;
            let selectedType = null;
            
            // Select based on weight
            for (const powerUp of availableTypes) {
                random -= powerUp.rarity;
                if (random <= 0) {
                    selectedType = powerUp;
                    break;
                }
            }
            
            // Fallback if no power-up selected
            if (!selectedType && availableTypes.length > 0) {
                selectedType = availableTypes[0];
            }
            
            // Create power-up if type was selected
            if (selectedType) {
                // Make sure x and y are valid numbers
                if (isNaN(x) || isNaN(y)) {
                    console.error('Invalid position for power-up:', x, y);
                    return;
                }
                
                const powerUp = new PowerUp(
                    this.scene,
                    x,
                    y,
                    selectedType.texture,
                    {
                        type: selectedType.type,
                        value: this.getPowerUpValue(selectedType.type, level)
                    }
                );
                
                // Add to group
                this.powerUps.add(powerUp);
            }
        } catch (error) {
            console.error('Error in PowerUpManager.spawnPowerUp:', error, 'Position:', x, y);
        }
    }
    
    /**
     * Get power-up value based on type and level
     * @param {string} type - Power-up type
     * @param {number} level - Current game level
     * @returns {number} Power-up value
     */
    getPowerUpValue(type, level) {
        switch (type) {
            case 'mushroom':
                // Mushroom - standard duration
                return 1;
                
            case 'flower':
                // Flower - standard duration
                return 1;
                
            case 'star':
                // Star - standard duration
                return 1;
                
            case 'coin':
                // Coin - value increases with level
                return 5 * Math.max(1, Math.floor(level / 2));
                
            default:
                return 1;
        }
    }
    
    /**
     * Clean up resources
     * FIX: Comprehensive cleanup
     */
    destroy() {
        try {
            // Remove event listeners
            this.scene.events.off('spawn_powerup', this.spawnAtPosition, this);
            
            // Clear reference to event listener
            this.spawnListener = null;
            
            // Clear any pending power-ups if they exist
            if (this.powerUps) {
                this.powerUps.clear(true, true);
            }
            
            // Clear references
            this.scene = null;
            this.powerUps = null;
        } catch (error) {
            console.error('Error in PowerUpManager.destroy:', error);
        }
    }
}