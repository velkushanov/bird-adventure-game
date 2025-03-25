/**
 * Enemy Class
 * Represents enemies like turtles that the player must avoid or defeat
 * FIXED: Added proper cleanup and error handling
 */
class Enemy extends Phaser.Physics.Arcade.Sprite {
    /**
     * Create a new enemy
     * @param {Phaser.Scene} scene - The scene the enemy belongs to
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
        this.type = config.type || 'turtle';
        this.movementPattern = config.movementPattern || 'sine';
        this.health = config.health || 1;
        this.speed = config.speed || 1;
        
        // Store original position for movement patterns
        this.startX = x;
        this.startY = y;
        this.moveTime = 0;
        this.ySpeed = 0;
        this.destroyed = false;
        
        // Configure physics body
        this.body.allowGravity = false;
        
        // Create animations
        this.createAnimations();
        
        // Start animation
        this.playAnimation();
    }
    
    /**
     * Create animations for the enemy
     * FIX: Added error handling
     */
    createAnimations() {
        try {
            const textureKey = this.texture.key;
            
            // Only create animations if they don't exist yet
            if (!this.scene.anims.exists(`${textureKey}_walk`)) {
                // Walking animation
                this.scene.anims.create({
                    key: `${textureKey}_walk`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 1 }),
                    frameRate: 5,
                    repeat: -1
                });
                
                // Hit animation (single frame for stunned effect)
                this.scene.anims.create({
                    key: `${textureKey}_hit`,
                    frames: [ { key: textureKey, frame: 1 } ],
                    frameRate: 5
                });
            }
        } catch (error) {
            console.error("Error in Enemy.createAnimations:", error);
        }
    }
    
    /**
     * Play the appropriate animation
     * FIX: Added error handling
     */
    playAnimation() {
        try {
            const textureKey = this.texture.key;
            
            // Play walk animation
            this.play(`${textureKey}_walk`);
        } catch (error) {
            console.error("Error in Enemy.playAnimation:", error);
        }
    }
    
    /**
     * Update enemy behavior
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     * @param {number} speed - Game speed
     * FIX: Added active check and error handling
     */
    update(time, delta, speed) {
        if (!this.active || this.destroyed) return;
        
        try {
            // Move based on game speed
            const moveAmount = (speed - CONFIG.ENEMY_SPEED_OFFSET) * delta / 1000;
            this.x -= moveAmount;
            
            // Update move time counter
            this.moveTime += delta;
            
            // Apply movement pattern
            this.applyMovementPattern(delta);
            
            // Remove if off screen
            if (this.x < -this.width) {
                this.destroy();
            }
        } catch (error) {
            console.error("Error in Enemy.update:", error);
        }
    }
    
    /**
     * Apply movement pattern
     * @param {number} delta - Time since last update
     * FIX: Added error handling and active checks
     */
    applyMovementPattern(delta) {
        if (!this.active) return;
        
        try {
            switch (this.movementPattern) {
                case 'sine':
                    // Sine wave movement
                    this.y = this.startY + Math.sin(this.moveTime / 500) * 50;
                    break;
                    
                case 'chase':
                    // Get player reference (if available)
                    const player = this.scene.bird;
                    
                    if (player && player.active && !player.isDead) {
                        // Simple chase logic
                        const dy = player.y - this.y;
                        const chaseSpeed = 1.5;
                        
                        if (dy > 10) {
                            this.y += chaseSpeed;
                        } else if (dy < -10) {
                            this.y -= chaseSpeed;
                        }
                        
                        // Keep within screen bounds
                        this.y = Phaser.Math.Clamp(this.y, 30, CONFIG.GAME_HEIGHT - 30);
                    }
                    break;
                    
                case 'bounce':
                    // Bounce between top and bottom
                    const bounceHeight = CONFIG.GAME_HEIGHT - 100;
                    const bounceSpeed = 2;
                    
                    // Initialize ySpeed if not set
                    if (this.ySpeed === undefined || this.ySpeed === 0) {
                        this.ySpeed = bounceSpeed;
                    }
                    
                    this.y += this.ySpeed;
                    
                    // Bounce off top and bottom
                    if (this.y < 50) {
                        this.y = 50;
                        this.ySpeed = Math.abs(this.ySpeed);
                    } else if (this.y > bounceHeight) {
                        this.y = bounceHeight;
                        this.ySpeed = -Math.abs(this.ySpeed);
                    }
                    break;
                    
                case 'hover':
                    // Hover in place, only moving horizontally
                    break;
                    
                default:
                    // Default to sine movement if pattern not recognized
                    this.y = this.startY + Math.sin(this.moveTime / 500) * 30;
                    break;
            }
        } catch (error) {
            console.error("Error in Enemy.applyMovementPattern:", error);
        }
    }

        /**
     * Shoot at the player
     * @returns {Phaser.GameObjects.Sprite} The created projectile
     */
    shootAtPlayer() {
        if (this.destroyed || !this.active || !this.scene) return null;
        
        try {
            // Don't shoot if enemy is off-screen
            if (this.x < 0 || this.x > CONFIG.GAME_WIDTH || 
                this.y < 0 || this.y > CONFIG.GAME_HEIGHT) {
                return null;
            }
            
            // Get target (the bird)
            const target = this.scene.bird;
            if (!target || !target.active) return null;
            
            // Create enemy projectile
            const projectile = this.scene.enemyProjectiles.create(
                this.x - 10, // Shoot from left side of enemy
                this.y,
                'fireball' // Reuse fireball texture
            );
            
            if (!projectile) return null;
            
            // Configure projectile physics
            projectile.body.allowGravity = false;
            
            // Add visual distinction - tint it red
            projectile.setTint(0xff0000);
            
            // Calculate angle to player
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                target.x, target.y
            );
            
            // Set velocity based on angle
            const speed = 300;
            projectile.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
            
            // Set proper rotation
            projectile.rotation = angle;
            
            // Play sound
            this.scene.sound.play('sfx-fireball', { volume: 0.4 });
            
            // Add a cleanup timer
            this.scene.time.addEvent({
                delay: 4000,
                callback: () => {
                    if (projectile && projectile.active) {
                        projectile.destroy();
                    }
                },
                callbackScope: this
            });
            
            return projectile;
        } catch (error) {
            console.error("Error in Enemy.shootAtPlayer:", error);
            return null;
        }
    }
    
    /**
     * Take damage from player or projectiles
     * @param {number} amount - Amount of damage to take
     * @returns {boolean} True if enemy was defeated
     * FIX: Added error handling and active checks
     */
    takeDamage(amount = 1) {
        if (!this.active || this.destroyed) return false;
        
        try {
            this.health -= amount;
            
            if (this.health <= 0) {
                // Enemy defeated
                this.createDeathEffect();
                
                // Play defeat sound
                if (this.type === 'turtle') {
                    this.scene.sound.play('sfx-stomp', { volume: 0.7 });
                } else {
                    this.scene.sound.play('sfx-hit', { volume: 0.7 });
                }
                
                // Mark as destroyed to prevent multiple hits
                this.destroyed = true;
                
                // Destroy the enemy
                this.destroy();
                return true;
            } else {
                // Enemy took damage but survived
                this.createHitEffect();
                
                // Play hit animation
                this.play(`${this.texture.key}_hit`);
                
                // Restore normal animation after a delay
                this.scene.time.delayedCall(300, () => {
                    if (this.active && !this.destroyed) {
                        this.playAnimation();
                    }
                });
                
                // Play hit sound
                this.scene.sound.play('sfx-hit', { volume: 0.5 });
                
                return false;
            }
        } catch (error) {
            console.error("Error in Enemy.takeDamage:", error);
            
            // Still try to destroy if there was a fatal error
            if (amount >= this.health) {
                this.destroyed = true;
                this.destroy();
                return true;
            }
            
            return false;
        }
    }
    
    /**
     * Create death effect when enemy is defeated
     * FIX: Added error handling
     */
    createDeathEffect() {
        try {
            // Create particles
            const particles = this.scene.add.particles('particle');
            
            // Set particle color based on enemy type
            let particleColor;
            
            switch (this.type) {
                case 'turtle':
                    particleColor = 0x22AA22; // Green for turtles
                    break;
                    
                case 'goomba':
                    particleColor = 0xA52A2A; // Brown for goombas
                    break;
                    
                default:
                    particleColor = 0xFFFFFF; // White for others
                    break;
            }
            
            // Create particle emitter
            const emitter = particles.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 50, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.6, end: 0 },
                lifespan: 800,
                quantity: 20,
                tint: particleColor
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
            console.error("Error in Enemy.createDeathEffect:", error);
        }
    }
    
    /**
     * Create hit effect when enemy is damaged but not defeated
     * FIX: Added active check and error handling
     */
    createHitEffect() {
        if (!this.active) return;
        
        try {
            // Flash the enemy
            this.scene.tweens.add({
                targets: this,
                alpha: 0.5,
                duration: 50,
                yoyo: true,
                repeat: 2,
                ease: 'Linear'
            });
            
            // Small knock-back effect
            this.scene.tweens.add({
                targets: this,
                x: this.x + 15,
                duration: 100,
                ease: 'Sine.easeOut',
                yoyo: true
            });
        } catch (error) {
            console.error("Error in Enemy.createHitEffect:", error);
        }
    }
    
    /**
     * Override destroy to ensure proper cleanup
     * FIX: Added comprehensive cleanup
     */
    destroy() {
        try {
            // Mark as destroyed
            this.destroyed = true;
            
            // Call parent destroy
            super.destroy();
        } catch (error) {
            console.error("Error in Enemy.destroy:", error);
            
            // Try to still destroy the sprite even if there was an error
            try {
                super.destroy();
            } catch (e) {
                console.error("Error in Enemy.super.destroy:", e);
            }
        }
    }
}

/**
 * EnemyManager Class
 * Manages enemy generation and patterns
 * FIXED: Added proper cleanup and error handling
 */
class EnemyManager {
    /**
     * Create a new enemy manager
     * @param {Phaser.Scene} scene - The scene this manager belongs to
     * @param {Phaser.Physics.Arcade.Group} enemyGroup - Group for enemies
     */
    constructor(scene, enemyGroup) {
        this.scene = scene;
        this.enemies = enemyGroup;
        
        // Enemy types
        this.enemyTypes = [
            {
                type: 'turtle',
                texture: 'turtle',
                movementPatterns: ['sine', 'chase', 'bounce'],
                minLevel: 1
            },
            {
                type: 'goomba',
                texture: 'goomba',
                movementPatterns: ['hover', 'bounce'],
                minLevel: 2
            }
        ];
        
        // Formation patterns
        this.formations = [
            this.spawnSingle,      // Single enemy
            this.spawnPair,        // Pair of enemies
            this.spawnTriangle,    // Triangle formation
            this.spawnLine,        // Line of enemies
            this.spawnWave         // Wave of enemies
        ];
    }
    
    /**
     * Generate enemies based on current level
     * @param {number} level - Current game level
     * FIX: Added error handling
     */
    generate(level) {
        try {
            // Filter enemy types available at current level
            const availableTypes = this.enemyTypes.filter(e => e.minLevel <= level);
            
            if (availableTypes.length === 0) return;
            
            // Choose formation based on level
            const formationIndex = Math.min(level - 1, this.formations.length - 1);
            const extraFormations = Math.floor((level - 1) / this.formations.length);
            
            // Choose random formation with weighting toward level-appropriate ones
            let selectedFormation;
            
            if (Phaser.Math.RND.frac() < 0.7) {
                // 70% chance for level-appropriate formation
                selectedFormation = Phaser.Math.RND.integerInRange(0, formationIndex);
            } else {
                // 30% chance for any formation
                selectedFormation = Phaser.Math.RND.integerInRange(0, this.formations.length - 1);
            }
            
            // Generate the enemies
            const formation = this.formations[selectedFormation];
            formation.call(this, level, availableTypes);
        } catch (error) {
            console.error("Error in EnemyManager.generate:", error);
        }
    }
    
    /**
     * Create a single enemy
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} typeInfo - Enemy type information
     * @param {number} level - Current game level
     * @returns {Enemy} The created enemy
     * FIX: Added error handling
     */
    createEnemy(x, y, typeInfo, level) {
        try {
            // Validate inputs
            if (isNaN(x) || isNaN(y) || !typeInfo || !this.scene || !this.enemies) {
                console.error("Invalid parameters for createEnemy:", x, y, typeInfo, level);
                return null;
            }
            
            // Choose random movement pattern
            const pattern = Phaser.Math.RND.pick(typeInfo.movementPatterns);
            
            // Create enemy with scaled health based on level
            const healthBonus = Math.floor((level - 1) / 3);
            
            const enemy = new Enemy(
                this.scene,
                x,
                y,
                typeInfo.texture,
                {
                    type: typeInfo.type,
                    movementPattern: pattern,
                    health: 1 + healthBonus,
                    speed: 1 + (level * 0.1)
                }
            );
            
            // Add to group
            this.enemies.add(enemy);
            
            return enemy;
        } catch (error) {
            console.error("Error in EnemyManager.createEnemy:", error);
            return null;
        }
    }
    
    /**
     * Spawn a single enemy
     * @param {number} level - Current game level
     * @param {Array} availableTypes - Available enemy types
     * FIX: Added error handling
     */
    spawnSingle(level, availableTypes) {
        try {
            // Choose random enemy type
            const typeInfo = Phaser.Math.RND.pick(availableTypes);
            
            // Random vertical position
            const y = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100);
            
            // Create enemy
            this.createEnemy(CONFIG.GAME_WIDTH, y, typeInfo, level);
        } catch (error) {
            console.error("Error in EnemyManager.spawnSingle:", error);
        }
    }
    
    /**
     * Spawn a pair of enemies
     * @param {number} level - Current game level
     * @param {Array} availableTypes - Available enemy types
     * FIX: Added error handling
     */
    spawnPair(level, availableTypes) {
        try {
            // Choose random enemy type
            const typeInfo = Phaser.Math.RND.pick(availableTypes);
            
            // Vertical positions
            const y1 = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT / 2 - 50);
            const y2 = Phaser.Math.Between(CONFIG.GAME_HEIGHT / 2 + 50, CONFIG.GAME_HEIGHT - 100);
            
            // Create enemies
            this.createEnemy(CONFIG.GAME_WIDTH, y1, typeInfo, level);
            this.createEnemy(CONFIG.GAME_WIDTH + 50, y2, typeInfo, level);
        } catch (error) {
            console.error("Error in EnemyManager.spawnPair:", error);
        }
    }
    
    /**
     * Spawn a triangle formation of enemies
     * @param {number} level - Current game level
     * @param {Array} availableTypes - Available enemy types
     * FIX: Added error handling
     */
    spawnTriangle(level, availableTypes) {
        try {
            // Choose random enemy type
            const typeInfo = Phaser.Math.RND.pick(availableTypes);
            
            // Center position
            const centerY = Phaser.Math.Between(150, CONFIG.GAME_HEIGHT - 150);
            
            // Create enemies in triangle formation
            this.createEnemy(CONFIG.GAME_WIDTH, centerY, typeInfo, level);
            this.createEnemy(CONFIG.GAME_WIDTH + 80, centerY - 70, typeInfo, level);
            this.createEnemy(CONFIG.GAME_WIDTH + 80, centerY + 70, typeInfo, level);
        } catch (error) {
            console.error("Error in EnemyManager.spawnTriangle:", error);
        }
    }
    
    /**
     * Spawn a line of enemies
     * @param {number} level - Current game level
     * @param {Array} availableTypes - Available enemy types
     * FIX: Added error handling
     */
    spawnLine(level, availableTypes) {
        try {
            // Choose random enemy type
            const typeInfo = Phaser.Math.RND.pick(availableTypes);
            
            // Vertical or horizontal line
            const isHorizontal = Phaser.Math.RND.frac() < 0.5;
            
            if (isHorizontal) {
                // Horizontal line
                const y = Phaser.Math.Between(150, CONFIG.GAME_HEIGHT - 150);
                const count = Phaser.Math.Between(3, 5);
                const spacing = 80;
                
                for (let i = 0; i < count; i++) {
                    this.createEnemy(CONFIG.GAME_WIDTH + (i * spacing), y, typeInfo, level);
                }
            } else {
                // Vertical line
                const count = Phaser.Math.Between(3, 4);
                const spacing = CONFIG.GAME_HEIGHT / (count + 1);
                
                for (let i = 1; i <= count; i++) {
                    this.createEnemy(CONFIG.GAME_WIDTH, i * spacing, typeInfo, level);
                }
            }
        } catch (error) {
            console.error("Error in EnemyManager.spawnLine:", error);
        }
    }
    
    /**
     * Spawn a wave of enemies
     * @param {number} level - Current game level
     * @param {Array} availableTypes - Available enemy types
     * FIX: Added error handling
     */
    spawnWave(level, availableTypes) {
        try {
            // Choose random enemy type
            const typeInfo = Phaser.Math.RND.pick(availableTypes);
            
            // Wave parameters
            const count = Phaser.Math.Between(4, 6);
            const waveWidth = 250;
            const centerY = Phaser.Math.Between(150, CONFIG.GAME_HEIGHT - 150);
            
            // Create enemies along a sine wave
            for (let i = 0; i < count; i++) {
                const xOffset = (i / (count - 1)) * waveWidth;
                const yOffset = Math.sin((i / (count - 1)) * Math.PI * 2) * 80;
                
                this.createEnemy(
                    CONFIG.GAME_WIDTH + xOffset,
                    centerY + yOffset,
                    typeInfo,
                    level
                );
            }
        } catch (error) {
            console.error("Error in EnemyManager.spawnWave:", error);
        }
    }
    
    /**
     * Clean up resources
     * FIX: Added cleanup method
     */
    destroy() {
        try {
            // Clear out references
            this.scene = null;
            this.enemies = null;
            this.enemyTypes = null;
            this.formations = null;
        } catch (error) {
            console.error("Error in EnemyManager.destroy:", error);
        }
    }
}