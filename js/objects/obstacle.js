/**
 * Obstacle Class
 * Represents obstacles like pipes that the player must avoid
 */
class Obstacle extends Phaser.Physics.Arcade.Sprite {
    /**
     * Create a new obstacle
     * @param {Phaser.Scene} scene - The scene the obstacle belongs to
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
        this.type = config.type || 'pipe';
        this.health = config.health || 1;
        this.isBreakable = config.isBreakable || false;
        this.scored = false;
        this.destroyed = false;
        
        // Configure physics body
        this.body.allowGravity = false;
        this.body.setImmovable(true);
    }
    
    /**
     * Take damage from player or projectiles
     * @param {number} amount - Amount of damage to take
     * @returns {boolean} True if obstacle was destroyed
     */
    takeDamage(amount = 1) {
        if (this.destroyed || !this.active) return false;
        
        // Only breakable obstacles can be damaged
        if (!this.isBreakable) return false;
        
        this.health -= amount;
        
        if (this.health <= 0) {
            // Mark as destroyed to prevent multiple hits
            this.destroyed = true;
            
            // Create destruction effect
            this.createDestructionEffect();
            
            // Play destruction sound
            this.scene.sound.play('sfx-break', { volume: 0.6 });
            
            // Destroy the obstacle
            this.destroy();
            return true;
        } else {
            // Create hit effect
            this.createHitEffect();
            
            // Play hit sound
            this.scene.sound.play('sfx-hit-obstacle', { volume: 0.5 });
            
            return false;
        }
    }
    
    /**
     * Create destruction effect when obstacle is destroyed
     */
    createDestructionEffect() {
        try {
            // Create particles
            const particles = this.scene.add.particles('particle');
            
            // Create particle emitter
            const emitter = particles.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 50, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.6, end: 0 },
                lifespan: 800,
                quantity: 20,
                tint: 0xaaaaaa
            });
            
            // Stop emitting after burst
            this.scene.time.delayedCall(100, () => {
                if (emitter && emitter.active) {
                    emitter.stop();
                    
                    // Clean up particles after they fade
                    this.scene.time.delayedCall(800, () => {
                        if (particles && particles.active) {
                            particles.destroy();
                        }
                    });
                }
            });
        } catch (error) {
            console.error("Error in Obstacle.createDestructionEffect:", error);
        }
    }
    
    /**
     * Create hit effect when obstacle is damaged but not destroyed
     */
    createHitEffect() {
        try {
            // Play hit animation if available
            if (this.scene.anims.exists('impact-anim')) {
                const impact = this.scene.add.sprite(this.x, this.y, 'impact')
                    .play('impact-anim')
                    .once('animationcomplete', () => {
                        impact.destroy();
                    });
            }
            
            // Flash the obstacle
            this.scene.tweens.add({
                targets: this,
                alpha: 0.5,
                duration: 50,
                yoyo: true,
                repeat: 2,
                ease: 'Linear'
            });
        } catch (error) {
            console.error("Error in Obstacle.createHitEffect:", error);
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Mark as destroyed
        this.destroyed = true;
        
        // Call parent destroy
        super.destroy();
    }
}

/**
 * ObstacleManager Class
 * Manages obstacle generation and patterns
 */
class ObstacleManager {
    /**
     * Create a new obstacle manager
     * @param {Phaser.Scene} scene - The scene this manager belongs to
     * @param {Phaser.Physics.Arcade.Group} obstacleGroup - Group for obstacles
     */
    constructor(scene, obstacleGroup) {
        this.scene = scene;
        this.obstacles = obstacleGroup;
        this.lastObstacleTime = 0;
        
        // Obstacle types
        this.obstacleTypes = [
            {
                type: 'pipe',
                texture: 'pipe',
                isBreakable: false,
                health: 1,
                minLevel: 1
            },
            {
                type: 'brick',
                texture: 'brick',
                isBreakable: true,
                health: 1,
                minLevel: 2
            },
            {
                type: 'rock',
                texture: 'rock',
                isBreakable: false,
                health: 2,
                minLevel: 3
            },
            {
                type: 'spikes',
                texture: 'spikes',
                isBreakable: false,
                health: 1,
                minLevel: 4
            }
        ];
    }
    
    /**
     * Generate obstacles based on current level
     * @param {number} level - Current game level
     * @param {number} gameSpeed - Current game speed
     */
    generate(level, gameSpeed) {
        try {
            // Calculate gap size based on level (gets smaller as level increases)
            const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
            const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (this.level - 1), maxReduction);
            const gapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
            
            // Random position for the gap
            const gapPosition = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100 - gapSize);
            
            // Determine obstacle type based on level
            let obstacleType = this.obstacleTypes[0]; // Default to pipe
            
            // Get available obstacle types for current level
            const availableTypes = this.obstacleTypes.filter(t => t.minLevel <= level);
            if (availableTypes.length > 0) {
                // Randomize obstacle type, but keep pipes more common
                if (Math.random() < 0.7) {
                    obstacleType = this.obstacleTypes[0]; // 70% chance for pipes
                } else {
                    obstacleType = Phaser.Math.RND.pick(availableTypes);
                }
            }
            
            // Create top obstacle
            this.createObstacle(
                CONFIG.GAME_WIDTH,
                gapPosition - 320,
                obstacleType.texture,
                {
                    type: obstacleType.type,
                    isBreakable: obstacleType.isBreakable,
                    health: obstacleType.health
                }
            );
            
            // Create bottom obstacle
            this.createObstacle(
                CONFIG.GAME_WIDTH,
                gapPosition + gapSize,
                obstacleType.texture,
                {
                    type: obstacleType.type,
                    isBreakable: obstacleType.isBreakable,
                    health: obstacleType.health,
                    flipY: true
                }
            );
        } catch (error) {
            console.error("Error in ObstacleManager.generate:", error);
        }
    }
    
    /**
     * Create an obstacle
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} texture - Texture key
     * @param {Object} config - Additional configuration
     * @returns {Obstacle} The created obstacle
     */
    createObstacle(x, y, texture, config = {}) {
        try {
            // Create new obstacle
            const obstacle = new Obstacle(
                this.scene,
                x,
                y,
                texture,
                config
            );
            
            // Apply config properties
            if (config.flipY) {
                obstacle.flipY = true;
            }
            
            // Add to group
            this.obstacles.add(obstacle);
            
            return obstacle;
        } catch (error) {
            console.error("Error in ObstacleManager.createObstacle:", error);
            return null;
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear references
        this.scene = null;
        this.obstacles = null;
    }
}