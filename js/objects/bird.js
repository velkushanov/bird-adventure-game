/**
 * Bird Class
 * Represents the player-controlled bird character
 * FIXED: Added proper cleanup for powerups and fixed event handling
 */
class Bird extends Phaser.Physics.Arcade.Sprite {
    /**
     * Create a new bird
     * @param {Phaser.Scene} scene - The scene the bird belongs to
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
        this.flightPower = config.flightPower || 1.0;
        this.isInvulnerable = false;
        this.isBig = false;
        this.isShooting = false;
        
        // Bird state
        this.isDead = false;
        
        // Configure physics body
        this.setCollideWorldBounds(true);
        this.body.setGravityY(CONFIG.GRAVITY);
        
        // Set smaller collision body for better gameplay
        const bodyWidth = this.width * CONFIG.BIRD_COLLIDER_REDUCTION;
        const bodyHeight = this.height * CONFIG.BIRD_COLLIDER_REDUCTION;
        this.body.setSize(bodyWidth, bodyHeight);
        this.body.setOffset(
            (this.width - bodyWidth) / 2, 
            (this.height - bodyHeight) / 2
        );
        
        // Create animations
        this.createAnimations();
        
        // Play default flying animation
        this.play('fly');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Effects container
        this.effects = scene.add.container(0, 0);
        this.effects.setDepth(1);
        
        // Trail effect (initially hidden)
        this.trail = scene.add.particles('particle');
        this.trailEmitter = null;
        
        // Fireball cooldown
        this.lastFireballTime = 0;
        
        // FIX: Initialize tween references
        this.mushroomBlinkTween = null;
        this.flowerBlinkTween = null;
        this.invulnerabilityBlinkTween = null;
        this.growTween = null;
        this.glowTween = null;
        this.starTimer = null;
    }
    
    /**
     * Create animations for the bird
     */
    createAnimations() {
        const textureKey = this.texture.key;
        
        // Only create animations if they don't exist yet
        if (!this.scene.anims.exists(`${textureKey}_fly`)) {
            // Flying animation
            this.scene.anims.create({
                key: `${textureKey}_fly`,
                frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 2 }),
                frameRate: 10,
                repeat: -1
            });
            
            // Hurt animation (single frame)
            this.scene.anims.create({
                key: `${textureKey}_hurt`,
                frames: [ { key: textureKey, frame: 2 } ],
                frameRate: 10
            });
        }
        
        // Store animation keys
        this.flyAnim = `${textureKey}_fly`;
        this.hurtAnim = `${textureKey}_hurt`;
    }
    
    /**
     * Setup event listeners
     * FIX: Standardized event names to match Game scene
     */
    setupEventListeners() {
        // Listen for game events that affect the bird
        this.scene.events.on('powerup_mushroom', this.activateMushroom, this);
        this.scene.events.on('powerup_flower', this.activateFlower, this);
        this.scene.events.on('powerup_star', this.activateInvulnerability, this);
    }
    
    /**
     * Update bird state
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     */
    update(time, delta) {
        if (this.isDead || !this.active) return;
        
        // Add rotation based on velocity for visual effect
        const targetRotation = Phaser.Math.Clamp(this.body.velocity.y / 600, -0.3, 0.3);
        this.rotation = Phaser.Math.Linear(this.rotation, targetRotation, 0.1);
        
        // Update trail effect if active
        if (this.trailEmitter && this.active) {
            this.trailEmitter.setPosition(this.x - this.width / 2, this.y);
        }
    }
    
    /**
     * Make the bird flap its wings
     */
    flap() {
        if (this.isDead || !this.active) return;
        
        // Apply upward velocity
        const flapPower = CONFIG.BIRD_FLAP_VELOCITY * this.flightPower;
        this.setVelocityY(flapPower);
        
        // Play flap animation
        this.play(this.flyAnim, true);
        
        // Play flap sound
        this.scene.sound.play('sfx-flap', { volume: 0.5 });
    }
    
    /**
     * Activate mushroom power-up (size increase)
     * FIX: Added active checks and improved cleanup
     */
    activateMushroom() {
        if (!this.active) return;
        
        try {
            // Already big, just reset the timer
            if (this.isBig) {
                this.resetMushroomTimers();
            } else {
                // Become big
                this.isBig = true;
                this.setScale(1.5);
                
                // Play transformation sound
                this.scene.sound.play('sfx-powerup', { volume: 0.7 });
                
                // Add growth effect
                this.addGrowEffect();
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'mushroom', active: true });
            }
            
            // Set timer for power-up duration
            this.mushroomTimer = this.scene.time.delayedCall(CONFIG.MUSHROOM_DURATION, () => {
                if (!this.active) return;
                
                // Return to normal size
                this.isBig = false;
                this.setScale(1);
                
                // Add shrink effect
                this.addShrinkEffect();
                
                // Clear blinking effect
                if (this.mushroomBlinkTween) {
                    this.mushroomBlinkTween.stop();
                    this.mushroomBlinkTween = null;
                    if (this.active) {
                        this.clearTint();
                        this.alpha = 1;
                    }
                }
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'mushroom', active: false });
            }, [], this);
            
            // Set timer for blinking warning (1 second before expiration)
            this.mushroomBlinkTimer = this.scene.time.delayedCall(CONFIG.MUSHROOM_DURATION - 1000, () => {
                if (!this.active) return;
                
                // Start blinking effect
                this.mushroomBlinkTween = this.scene.tweens.add({
                    targets: this,
                    alpha: 0.5,
                    duration: 100,
                    yoyo: true,
                    repeat: 9, // 10 blinks in 1 second
                    onComplete: () => {
                        if (this.active) this.alpha = 1; // Reset alpha when done
                    }
                });
            }, [], this);
        } catch (error) {
            console.error('Error in activateMushroom:', error);
        }
    }
    
    /**
     * Reset mushroom timers
     * FIX: Extracted common code to avoid duplication
     */
    resetMushroomTimers() {
        if (this.mushroomTimer) {
            this.mushroomTimer.remove();
            this.mushroomTimer = null;
        }
        
        if (this.mushroomBlinkTimer) {
            this.mushroomBlinkTimer.remove();
            this.mushroomBlinkTimer = null;
        }
        
        if (this.mushroomBlinkTween) {
            this.mushroomBlinkTween.stop();
            this.mushroomBlinkTween = null;
        }
    }
    
    /**
     * Activate flower power-up (shooting)
     * FIX: Added active checks and improved cleanup
     */
    activateFlower() {
        if (!this.active) return;
        
        try {
            // Already shooting, just reset the timer
            if (this.isShooting) {
                this.resetFlowerTimers();
            } else {
                // Enable shooting
                this.isShooting = true;
                
                // Play power-up sound
                this.scene.sound.play('sfx-powerup', { volume: 0.7 });
                
                // Add glow effect
                this.addGlowEffect();
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'flower', active: true });
            }
            
            // Set timer for power-up duration
            this.flowerTimer = this.scene.time.delayedCall(CONFIG.FLOWER_DURATION, () => {
                if (!this.active) return;
                
                // Disable shooting
                this.isShooting = false;
                
                // Remove glow effect
                this.removeGlowEffect();
                
                // Clear blinking effect
                if (this.flowerBlinkTween) {
                    this.flowerBlinkTween.stop();
                    this.flowerBlinkTween = null;
                    if (this.active) {
                        this.clearTint();
                        this.alpha = 1;
                    }
                }
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'flower', active: false });
            }, [], this);
            
            // Set timer for blinking warning (1 second before expiration)
            this.flowerBlinkTimer = this.scene.time.delayedCall(CONFIG.FLOWER_DURATION - 1000, () => {
                if (!this.active) return;
                
                // Start blinking effect
                this.flowerBlinkTween = this.scene.tweens.add({
                    targets: this,
                    alpha: 0.5,
                    duration: 100,
                    yoyo: true,
                    repeat: 9, // 10 blinks in 1 second
                    onComplete: () => {
                        if (this.active) this.alpha = 1; // Reset alpha when done
                    }
                });
            }, [], this);
        } catch (error) {
            console.error('Error in activateFlower:', error);
        }
    }
    
    /**
     * Reset flower timers
     * FIX: Extracted common code to avoid duplication
     */
    resetFlowerTimers() {
        if (this.flowerTimer) {
            this.flowerTimer.remove();
            this.flowerTimer = null;
        }
        
        if (this.flowerBlinkTimer) {
            this.flowerBlinkTimer.remove();
            this.flowerBlinkTimer = null;
        }
        
        if (this.flowerBlinkTween) {
            this.flowerBlinkTween.stop();
            this.flowerBlinkTween = null;
        }
    }
    
    /**
     * Activate star power-up (invulnerability)
     * FIX: Added active checks and improved cleanup
     */
    activateInvulnerability() {
        if (!this.active) return;
        
        try {
            // Already invulnerable, just reset the timer
            if (this.isInvulnerable) {
                this.resetInvulnerabilityTimers();
            } else {
                // Become invulnerable
                this.isInvulnerable = true;
                
                // Play star power-up sound
                this.scene.sound.play('sfx-powerup', { volume: 0.8 });
                
                // Add star effect (flashing and trail)
                this.addStarEffect();
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'star', active: true });
            }
            
            // Set timer for power-up duration
            this.invulnerabilityTimer = this.scene.time.delayedCall(10000, () => {
                if (!this.active) return;
                
                // Disable invulnerability
                this.isInvulnerable = false;
                
                // Remove star effect
                this.removeStarEffect();
                
                // Clear blinking effect
                if (this.invulnerabilityBlinkTween) {
                    this.invulnerabilityBlinkTween.stop();
                    this.invulnerabilityBlinkTween = null;
                    if (this.active) {
                        this.alpha = 1;
                    }
                }
                
                // Emit event so game scene knows state changed
                this.emit('powerup-state-changed', { type: 'star', active: false });
            }, [], this);
            
            // Set timer for blinking warning (1 second before expiration)
            this.invulnerabilityBlinkTimer = this.scene.time.delayedCall(9000, () => { // 10000 - 1000 = 9000
                if (!this.active) return;
                
                // Start more intense blinking effect
                this.invulnerabilityBlinkTween = this.scene.tweens.add({
                    targets: this,
                    alpha: 0.3,
                    duration: 100,
                    yoyo: true,
                    repeat: 9, // 10 blinks in 1 second
                    onComplete: () => {
                        if (this.active) this.alpha = 1; // Reset alpha when done
                    }
                });
            }, [], this);
        } catch (error) {
            console.error('Error in activateInvulnerability:', error);
        }
    }
    
    /**
     * Reset invulnerability timers
     * FIX: Extracted common code to avoid duplication
     */
    resetInvulnerabilityTimers() {
        if (this.invulnerabilityTimer) {
            this.invulnerabilityTimer.remove();
            this.invulnerabilityTimer = null;
        }
        
        if (this.invulnerabilityBlinkTimer) {
            this.invulnerabilityBlinkTimer.remove();
            this.invulnerabilityBlinkTimer = null;
        }
        
        if (this.invulnerabilityBlinkTween) {
            this.invulnerabilityBlinkTween.stop();
            this.invulnerabilityBlinkTween = null;
        }
        
        if (this.starTimer) {
            this.starTimer.remove();
            this.starTimer = null;
        }
    }
    
    /**
     * Make the bird die
     * FIX: Added active check
     */
    die() {
        if (this.isDead || !this.active) return;
        
        // Set dead state
        this.isDead = true;
        
        // Stop any active power-ups
        this.clearPowerUps();
        
        // Play hurt animation
        this.play(this.hurtAnim);
        
        // Set red tint
        this.setTint(0xff0000);
        
        // Disable physics
        this.body.checkCollision.none = true;
        
        // Drop the bird
        this.body.setVelocityY(300);
        
        // Trigger death effect
        this.addDeathEffect();
        
        // Notify scene of death
        this.scene.events.emit('player_died');
    }
    
    /**
     * Clear all active power-ups
     * FIX: More comprehensive cleanup
     */
    clearPowerUps() {
        try {
            // Clear mushroom power-up
            this.resetMushroomTimers();
            this.isBig = false;
            if (this.active) this.setScale(1);
            
            // Clear flower power-up
            this.resetFlowerTimers();
            this.isShooting = false;
            this.removeGlowEffect();
            
            // Clear star power-up
            this.resetInvulnerabilityTimers();
            this.isInvulnerable = false;
            this.removeStarEffect();
            
            // Make sure alpha and tint are reset
            if (this.active) {
                this.alpha = 1;
                this.clearTint();
            }
        } catch (error) {
            console.error('Error in clearPowerUps:', error);
        }
    }
    
    /**
     * Add growth effect when mushroom is activated
     * FIX: Added safe tween handling
     */
    addGrowEffect() {
        if (!this.active) return;
        
        try {
            // Scaling animation
            this.scene.tweens.add({
                targets: this,
                scale: 1.5,
                duration: 300,
                ease: 'Back.easeOut',
                onComplete: () => {
                    if (!this.active) return;
                    
                    // Add pulsing effect
                    this.growTween = this.scene.tweens.add({
                        targets: this,
                        scale: { from: 1.5, to: 1.6 },
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                }
            });
            
            // Particle burst
            const particles = this.scene.add.particles('particle');
            const emitter = particles.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 50, max: 100 },
                scale: { start: 0.5, end: 0 },
                lifespan: 500,
                quantity: 20
            });
            
            // Destroy particles after emitting
            this.scene.time.delayedCall(500, () => {
                emitter.stop();
                this.scene.time.delayedCall(500, () => {
                    particles.destroy();
                });
            });
        } catch (error) {
            console.error('Error in addGrowEffect:', error);
        }
    }
    
    /**
     * Add shrink effect when mushroom power-up expires
     * FIX: Added safe tween handling
     */
    addShrinkEffect() {
        if (!this.active) return;
        
        try {
            // Stop grow tween if running
            if (this.growTween) {
                this.growTween.stop();
                this.growTween = null;
            }
            
            // Scaling animation
            this.scene.tweens.add({
                targets: this,
                scale: 1,
                duration: 300,
                ease: 'Back.easeIn'
            });
        } catch (error) {
            console.error('Error in addShrinkEffect:', error);
        }
    }
    
    /**
     * Add glow effect when flower is activated
     * FIX: Added active check
     */
    addGlowEffect() {
        if (!this.active) return;
        
        try {
            // Create glow sprite
            this.glow = this.scene.add.sprite(this.x, this.y, 'particle')
                .setScale(3)
                .setAlpha(0.5)
                .setTint(0xff9900);
                
            // Attach to bird
            this.glow.setDepth(-1);
            
            // Add pulsing effect
            this.glowTween = this.scene.tweens.add({
                targets: this.glow,
                alpha: { from: 0.3, to: 0.5 },
                scale: { from: 2.5, to: 3 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } catch (error) {
            console.error('Error in addGlowEffect:', error);
        }
    }
    
    /**
     * Remove glow effect when flower power-up expires
     * FIX: Added null checks
     */
    removeGlowEffect() {
        if (!this.glow) return;
        
        try {
            // Fade out animation
            this.scene.tweens.add({
                targets: this.glow,
                alpha: 0,
                scale: 2,
                duration: 300,
                onComplete: () => {
                    if (this.glow) {
                        this.glow.destroy();
                        this.glow = null;
                    }
                }
            });
            
            // Stop glow tween
            if (this.glowTween) {
                this.glowTween.stop();
                this.glowTween = null;
            }
        } catch (error) {
            console.error('Error in removeGlowEffect:', error);
        }
    }
    
    /**
     * Add star effect for invulnerability
     * FIX: Added active check
     */
    addStarEffect() {
        if (!this.active) return;
        
        try {
            // Start flashing colors
            this.starColorIndex = 0;
            this.starColors = [0xffff00, 0xff0000, 0x00ff00, 0x0000ff, 0xff00ff];
            
            // Color cycling timer
            this.starTimer = this.scene.time.addEvent({
                delay: 100,
                callback: this.cycleColor,
                callbackScope: this,
                loop: true
            });
            
            // Add trail particles
            this.trail = this.scene.add.particles('particle');
            this.trailEmitter = this.trail.createEmitter({
                x: this.x - this.width / 2,
                y: this.y,
                speed: { min: 10, max: 30 },
                angle: { min: 150, max: 210 },
                scale: { start: 0.4, end: 0 },
                lifespan: 500,
                frequency: 30,
                tint: this.starColors
            });
        } catch (error) {
            console.error('Error in addStarEffect:', error);
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
            console.error('Error in cycleColor:', error);
        }
    }
    
    /**
     * Remove star effect when invulnerability expires
     * FIX: Added null checks
     */
    removeStarEffect() {
        try {
            // Stop flashing colors
            if (this.starTimer) {
                this.starTimer.remove();
                this.starTimer = null;
            }
            
            // Clear tint
            if (this.active) {
                this.clearTint();
            }
            
            // Remove trail
            if (this.trailEmitter) {
                this.trailEmitter.stop();
                
                this.scene.time.delayedCall(500, () => {
                    if (this.trail) {
                        this.trail.destroy();
                        this.trail = null;
                        this.trailEmitter = null;
                    }
                });
            }
        } catch (error) {
            console.error('Error in removeStarEffect:', error);
        }
    }
    
    /**
     * Add death effect when bird dies
     */
    addDeathEffect() {
        try {
            // Particle explosion
            const particles = this.scene.add.particles('particle');
            const emitter = particles.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 50, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.6, end: 0 },
                lifespan: 800,
                quantity: 30
            });
            
            // Stop emitting after burst
            this.scene.time.delayedCall(100, () => {
                emitter.stop();
                
                // Clean up
                this.scene.time.delayedCall(800, () => {
                    particles.destroy();
                });
            });
        } catch (error) {
            console.error('Error in addDeathEffect:', error);
        }
    }
    
    /**
     * Shoot a fireball
     * FIX: Added active, null, and error checks
     */
    shootFireball() {
        if (!this.isShooting || this.isDead || !this.active) return null;
        
        try {
            // Implement cooldown to prevent too many fireballs
            const currentTime = this.scene.time.now;
            if (currentTime - this.lastFireballTime < CONFIG.FIREBALL_RATE) {
                return null;
            }
            
            // Update last fireball time
            this.lastFireballTime = currentTime;
            
            // Access the fireballs group from the scene - very important to get this right
            if (!this.scene.fireballs) {
                console.error("Fireballs group not found in scene");
                return null;
            }
            
            // Create fireball with proper physics setup
            const fireball = this.scene.fireballs.create(
                this.x + this.width / 2,
                this.y,
                'fireball'
            );
            
            if (!fireball) {
                console.error("Failed to create fireball");
                return null;
            }
            
            // Configure fireball physics
            fireball.body.allowGravity = false;
            fireball.setVelocityX(CONFIG.FIREBALL_SPEED);
            
            // Set a proper collision size
            fireball.body.setSize(fireball.width * 0.8, fireball.height * 0.8);
            
            // Add custom properties to the fireball
            fireball.isFireball = true;
            fireball.ownerBird = this;
            fireball.birthTime = currentTime;
            
            // Play sound
            this.scene.sound.play('sfx-fireball', { volume: 0.5 });
            
            // Add a safer cleanup timer using Phaser's timer system
            this.scene.time.addEvent({
                delay: 5000,
                callback: () => {
                    if (fireball && fireball.active && !fireball.destroyed) {
                        fireball.destroyed = true;
                        fireball.destroy();
                    }
                },
                callbackScope: this
            });
            
            // Add rotation animation
            this.scene.tweens.add({
                targets: fireball,
                angle: 360,
                duration: 1000,
                repeat: -1
            });
            
            return fireball;
        } catch (error) {
            console.error("Error shooting fireball:", error);
            return null;
        }
    }
    
    /**
     * Clean up bird resources
     * FIX: More comprehensive cleanup
     */
    destroy() {
        try {
            // Clean up timers
            this.clearPowerUps();
            
            // Clean up effects
            if (this.effects) {
                this.effects.destroy();
                this.effects = null;
            }
            
            if (this.trail) {
                this.trail.destroy();
                this.trail = null;
            }
            
            if (this.glow) {
                this.glow.destroy();
                this.glow = null;
            }
            
            // Clean up tweens
            if (this.mushroomBlinkTween) this.mushroomBlinkTween.stop();
            if (this.flowerBlinkTween) this.flowerBlinkTween.stop();
            if (this.invulnerabilityBlinkTween) this.invulnerabilityBlinkTween.stop();
            if (this.growTween) this.growTween.stop();
            if (this.glowTween) this.glowTween.stop();
            
            // Clean up event listeners
            this.scene.events.off('powerup_mushroom', this.activateMushroom, this);
            this.scene.events.off('powerup_flower', this.activateFlower, this);
            this.scene.events.off('powerup_star', this.activateInvulnerability, this);
            
            // Reset all states
            this.isBig = false;
            this.isShooting = false;
            this.isInvulnerable = false;
            this.isDead = true;
            
            // Call parent destroy
            super.destroy();
        } catch (error) {
            console.error('Error in Bird.destroy:', error);
            // Still try to call parent destroy
            try {
                super.destroy();
            } catch (e) {
                console.error('Error in super.destroy:', e);
            }
        }
    }
}