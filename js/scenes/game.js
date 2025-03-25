/**
 * GameScene - The main gameplay scene
 * Handles all gameplay mechanics including the bird, obstacles, enemies and power-ups
 * FIXED: Fixed powerup handling and state synchronization
 */
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.bird = null;
        this.obstacles = null;
        this.enemies = null;
        this.powerUps = null;
        this.fireballs = null;
        this.score = 0;
        this.level = 1;
        this.gameSpeed = CONFIG.BASE_GAME_SPEED;
        this.isBig = false;
        this.isShooting = false;
        this.isInvulnerable = false;
        this.isGameOver = false;
        this.characterId = null;
        this.currentBackground = null;
        
        // Multiplayer properties
        this.isMultiplayer = false;
        this.roomId = null;
        this.otherPlayers = {};
        this.otherPlayerSprites = {};
        this.playerPositionListener = null;
        
        // FIX: Initialize timers
        this.mushroomTimer = null;
        this.flowerTimer = null;
        this.invulnerabilityTimer = null;
        this.mushroomBlinkTimer = null;
        this.flowerBlinkTimer = null;
        this.invulnerabilityBlinkTimer = null;
        this.lastFireTime = 0;
    }
    
    /**
     * Initialize the scene with data
     * @param {Object} data - The data passed to the scene
     */
    init(data) {
        this.characterId = data.characterId || 'bluebird';
        this.score = 0;
        this.level = 1;
        this.gameSpeed = CONFIG.BASE_GAME_SPEED;
        this.isGameOver = false;
        this.isBig = false;
        this.isShooting = false;
        this.isInvulnerable = false;
        
        // Set multiplayer flag if provided
        this.isMultiplayer = data.multiplayer || false;
        this.roomId = data.roomId || null;
        
        // Clear any previous multiplayer state
        this.otherPlayers = {};
        this.otherPlayerSprites = {};
        
        console.log(`Game initialized: CharacterId=${this.characterId}, Multiplayer=${this.isMultiplayer}, RoomId=${this.roomId}`);
    }
    
    create() {
        try {
            // Setup background
            this.setupBackground();
            
            // Create game groups
            this.createGroups();
            
            // Create the player bird
            this.createBird();
            
            // Setup collisions
            this.setupCollisions();
            
            // Create UI elements
            this.createUI();
            
            // Setup input
            this.setupInput();
            
            // Setup bird power-up state listener
            this.setupBirdStateListener();
            
            // Start background music
            this.sound.play('music-gameplay', { loop: true, volume: 0.7 });
            
            // Setup multiplayer if enabled
            if (this.isMultiplayer && this.roomId) {
                this.setupMultiplayer();
            } else {
                // Setup game timers for single player
                this.setupTimers();
            }
            
            // Notify other systems that game started
            if (isAuthenticated()) {
                updatePlayerStatus('playing');
            }
        } catch (error) {
            console.error('Error in GameScene.create:', error);
        }
    }
    
    /**
     * Set up listener for bird state changes
     * FIX: Added synchronization between bird and game state
     */
    setupBirdStateListener() {
        if (this.bird) {
            this.bird.on('powerup-state-changed', this.onBirdPowerupStateChanged, this);
        }
    }
    
    /**
     * Handle bird powerup state changes
     * FIX: Added to keep bird and game state in sync
     */
    onBirdPowerupStateChanged(data) {
        try {
            if (data.type === 'mushroom') {
                this.isBig = data.active;
                if (this.bigIndicator) this.bigIndicator.setVisible(data.active);
            } else if (data.type === 'flower') {
                this.isShooting = data.active;
                if (this.shootIndicator) this.shootIndicator.setVisible(data.active);
            } else if (data.type === 'star') {
                this.isInvulnerable = data.active;
            }
        } catch (error) {
            console.error('Error in onBirdPowerupStateChanged:', error);
        }
    }
    
    /**
     * Setup the scrolling background
     */
    setupBackground() {
        try {
            // Choose background theme based on level
            const bgIndex = (this.level - 1) % CONFIG.BACKGROUNDS.length;
            const bgConfig = CONFIG.BACKGROUNDS[bgIndex];
            
            this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, bgConfig.texture)
                .setOrigin(0, 0)
                .setScrollFactor(0);
                
            this.currentBackground = bgConfig.id;
        } catch (error) {
            console.error('Error in setupBackground:', error);
        }
    }
    
    /**
     * Create all game object groups
     */
    createGroups() {
        try {
            this.obstacles = this.physics.add.group();
            this.enemies = this.physics.add.group();
            this.powerUps = this.physics.add.group();
            
            // Create fireball group with physics
            this.fireballs = this.physics.add.group({
                allowGravity: false,
                immovable: false
            });
            
            // Create a group for other players (multiplayer)
            this.multiplayer = this.add.group();
        } catch (error) {
            console.error('Error in createGroups:', error);
        }
    }
    
    /**
     * Create the player character (bird)
     */
    createBird() {
        try {
            // Find character config
            const character = CONFIG.CHARACTERS.find(c => c.id === this.characterId) || CONFIG.CHARACTERS[0];
            
            // Create bird
            this.bird = new Bird(
                this,
                CONFIG.BIRD_START_X,
                CONFIG.BIRD_START_Y,
                character.texture,
                {
                    flightPower: character.flightPower
                }
            );
            
            // Apply physics settings
            this.bird.setCollideWorldBounds(true);
            
            // Store character properties
            this.bird.flightPower = character.flightPower;
            
            // IMPORTANT: Give the bird access to the fireballs group
            this.bird.fireballs = this.fireballs;
        } catch (error) {
            console.error('Error in createBird:', error);
        }
    }
    
    /**
     * Setup collision detection between game objects
     */
    setupCollisions() {
        try {
            // Bird collisions
            this.physics.add.collider(this.bird, this.obstacles, this.hitObstacle, null, this);
            this.physics.add.collider(this.bird, this.enemies, this.hitEnemy, null, this);
            this.physics.add.overlap(this.bird, this.powerUps, this.collectPowerUp, null, this);
            
            // Fireball collisions - use overlap instead of collider for more reliable detection
            this.physics.add.overlap(this.fireballs, this.enemies, this.hitEnemyWithFireball, null, this);
            this.physics.add.overlap(this.fireballs, this.obstacles, this.hitObstacleWithFireball, null, this);
        } catch (error) {
            console.error('Error in setupCollisions:', error);
        }
    }

    /**
     * Handle collision between bird and enemy
     * FIX: Added null checks and error handling
     */
    hitEnemy(bird, enemy) {
        // Don't process if game is already over or objects don't exist
        if (this.isGameOver || !bird || !bird.active || !enemy || !enemy.active) return;
        
        try {
            // Check if bird is invulnerable from star powerup
            if (bird.isInvulnerable) {
                console.log("Bird is invulnerable - killing enemy instead");
                
                // Kill the enemy
                if (enemy.takeDamage) {
                    enemy.takeDamage(999); // One-hit kill
                } else {
                    enemy.destroy();
                }
                
                // Add points
                this.increaseScore(CONFIG.BASE_ENEMY_POINTS);
                return;
            }
            
            // Check if bird is big - it can defeat enemies when big
            if (this.isBig) {
                console.log("Big bird defeated enemy");
                
                // Kill the enemy
                if (enemy.takeDamage) {
                    enemy.takeDamage(1);
                } else {
                    enemy.destroy();
                }
                
                // Add points
                this.increaseScore(CONFIG.BASE_ENEMY_POINTS);
                return;
            }
            
            console.log("Bird hit enemy - game over");
            
            // Bird died - game over
            if (bird.die) {
                bird.die();
            }
            
            this.gameOver();
        } catch (error) {
            console.error('Error in hitEnemy:', error);
        }
    }
    
    /**
     * Handle collision between bird and obstacle
     * FIX: Added null checks and error handling
     */
    hitObstacle(bird, obstacle) {
        // Don't process if game is already over or objects don't exist
        if (this.isGameOver || !bird || !bird.active || !obstacle || !obstacle.active) return;
        
        try {
            // Check if bird is invulnerable from star powerup
            if (bird.isInvulnerable) {
                console.log("Bird is invulnerable - obstacle hit ignored");
                return;
            }
            
            // Check if bird is big - if so, it can break some obstacles
            if (this.isBig && obstacle.takeDamage) {
                const wasDestroyed = obstacle.takeDamage(1);
                if (wasDestroyed) {
                    // Obstacle was destroyed, bird survives
                    this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
                    return;
                }
            }
            
            console.log("Bird hit obstacle - game over");
            
            // Bird died - game over
            if (bird.die) {
                bird.die();
            }
            
            this.gameOver();
        } catch (error) {
            console.error('Error in hitObstacle:', error);
        }
    }
    
    /**
     * Handle collision between fireball and enemy
     * FIX: Added comprehensive error handling
     */
    hitEnemyWithFireball(fireball, enemy) {
        // Extra safeguards
        if (!fireball || !enemy || !fireball.active || !enemy.active) return;
        if (fireball.destroyed || enemy.destroyed) return;
        
        try {
            // Mark as destroyed first
            fireball.destroyed = true;
            enemy.destroyed = true;
            
            // Play sound before destroying objects
            this.sound.play('sfx-hit', { volume: 0.7 });
            
            // Add particles/effect before destroying objects
            this.addDestructionEffect(enemy.x, enemy.y);
            
            // Increase score
            this.increaseScore(CONFIG.BASE_ENEMY_POINTS);
            
            // NOW destroy both objects
            fireball.destroy();
            enemy.destroy();
        } catch (error) {
            console.error("Error in hitEnemyWithFireball:", error);
            
            // Attempt cleanup even if error occurred
            if (fireball && fireball.active) fireball.destroy();
            if (enemy && enemy.active) enemy.destroy();
        }
    }
    
    /**
     * Handle collision between fireball and obstacle
     * FIX: Added proper implementation
     */
    hitObstacleWithFireball(fireball, obstacle) {
        // Extra safeguards
        if (!fireball || !obstacle || !fireball.active || !obstacle.active) return;
        if (fireball.destroyed || obstacle.destroyed) return;
        
        try {
            // Mark fireball as destroyed
            fireball.destroyed = true;
            
            // Play hit sound
            this.sound.play('sfx-hit-obstacle', { volume: 0.5 });
            
            // Check if obstacle can be damaged
            let obstacleDestroyed = false;
            if (obstacle.takeDamage) {
                obstacleDestroyed = obstacle.takeDamage(1);
                if (obstacleDestroyed) {
                    // Obstacle was destroyed, add points
                    this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
                }
            }
            
            // Add impact effect
            this.addImpactEffect(fireball.x, obstacle.y);
            
            // Destroy fireball
            fireball.destroy();
        } catch (error) {
            console.error("Error in hitObstacleWithFireball:", error);
            
            // Attempt cleanup even if error occurred
            if (fireball && fireball.active) fireball.destroy();
        }
    }
    
    /**
     * Create UI elements like score display
     */
    createUI() {
        try {
            // Score text
            this.scoreText = this.add.text(20, 20, 'Score: 0', { 
                fontFamily: 'Arial', 
                fontSize: '24px', 
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            });
            this.scoreText.setScrollFactor(0);
            this.scoreText.setDepth(1000); // Ensure UI is always on top
            
            // Level text
            this.levelText = this.add.text(20, 55, 'Level: 1', { 
                fontFamily: 'Arial', 
                fontSize: '24px', 
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            });
            this.levelText.setScrollFactor(0);
            this.levelText.setDepth(1000);
            
            // Power-up indicators
            this.powerupIndicator = this.add.container(CONFIG.GAME_WIDTH - 150, 20);
            this.powerupIndicator.setScrollFactor(0);
            this.powerupIndicator.setDepth(1000);
            
            // Create indicators but hide them initially
            this.bigIndicator = this.add.image(0, 0, 'mushroom-icon').setVisible(false);
            this.shootIndicator = this.add.image(50, 0, 'flower-icon').setVisible(false);
            
            this.powerupIndicator.add([this.bigIndicator, this.shootIndicator]);
            
            // Multiplayer indicators
            if (this.isMultiplayer) {
                // Room info
                this.roomText = this.add.text(CONFIG.GAME_WIDTH - 250, 20, 'Multiplayer Mode', {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    fill: '#FFFF00',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                this.roomText.setScrollFactor(0);
                this.roomText.setDepth(1000);
                
                // Player count
                this.playersText = this.add.text(CONFIG.GAME_WIDTH - 250, 45, 'Players: 1', {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    fill: '#FFFFFF',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                this.playersText.setScrollFactor(0);
                this.playersText.setDepth(1000);
            }
        } catch (error) {
            console.error('Error in createUI:', error);
        }
    }
    
    /**
     * Player collects a power-up
     * FIX: Fixed event emission, added error handling
     */
    collectPowerUp(bird, powerUp) {
        if (!bird || !powerUp || !bird.active || !powerUp.active) return;
        
        try {
            // Play sound
            this.sound.play('sfx-powerup', { volume: 0.7 });
            
            // Apply power-up effect based on type
            if (powerUp.type === 'mushroom') {
                // Emit the standardized event
                this.events.emit('powerup_mushroom');
                this.isBig = true;
                if (this.bigIndicator) this.bigIndicator.setVisible(true);
            } else if (powerUp.type === 'flower') {
                // Emit the standardized event
                this.events.emit('powerup_flower');
                this.isShooting = true;
                if (this.shootIndicator) this.shootIndicator.setVisible(true);
            } else if (powerUp.type === 'star') {
                // Emit the standardized event
                this.events.emit('powerup_star');
                this.isInvulnerable = true;
            } else if (powerUp.type === 'coin') {
                // Add points for coin
                this.increaseScore(10);
                this.sound.play('sfx-coin', { volume: 0.7 });
            }
            
            // Create collection effect
            this.addCollectionEffect(powerUp.x, powerUp.y, powerUp.type);
            
            // Store reference to type before destroying
            const powerUpType = powerUp.type;
            
            // Destroy the power-up
            powerUp.destroy();
            
            console.log(`Collected ${powerUpType} powerup`);
        } catch (error) {
            console.error('Error in collectPowerUp:', error);
            
            // Still try to destroy the powerup if there was an error
            if (powerUp && powerUp.active) {
                powerUp.destroy();
            }
        }
    }
    
    /**
     * Add collection effect for power-ups
     * FIX: Added error handling
     */
    addCollectionEffect(x, y, type) {
        try {
            // Create particles
            const particles = this.add.particles('particle');
            
            // Set particle color based on power-up type
            let particleColor;
            switch (type) {
                case 'mushroom': particleColor = 0xff0000; break;
                case 'flower': particleColor = 0xff9900; break;
                case 'coin': particleColor = 0xffdd00; break;
                case 'star': particleColor = 0xffff00; break;
                default: particleColor = 0xffffff; break;
            }
            
            // Create particle emitter
            const emitter = particles.createEmitter({
                x: x,
                y: y,
                speed: { min: 30, max: 80 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.4, end: 0 },
                lifespan: 600,
                quantity: 15,
                tint: particleColor
            });
            
            // Stop emitting after burst
            this.time.delayedCall(100, () => {
                if (emitter && emitter.active) {
                    emitter.stop();
                    
                    // Clean up particles after they fade
                    this.time.delayedCall(600, () => {
                        if (particles && particles.active) {
                            particles.destroy();
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error in addCollectionEffect:', error);
        }
    }
    
    /**
     * Setup gameplay timers
     */
    setupTimers() {
        try {
            // Level progression timer
            this.levelTimer = this.time.addEvent({
                delay: CONFIG.LEVEL_DURATION,
                callback: this.increaseLevel,
                callbackScope: this,
                loop: true
            });
            
            // Obstacle generation timer
            this.obstacleTimer = this.time.addEvent({
                delay: CONFIG.OBSTACLE_SPAWN_RATE,
                callback: this.generateObstacles,
                callbackScope: this,
                loop: true
            });
            
            // Enemy generation timer
            this.enemyTimer = this.time.addEvent({
                delay: CONFIG.ENEMY_SPAWN_RATE,
                callback: this.generateEnemies,
                callbackScope: this,
                loop: true
            });
            
            // Power-up generation timer
            this.powerUpTimer = this.time.addEvent({
                delay: CONFIG.POWERUP_SPAWN_RATE,
                callback: this.generatePowerUps,
                callbackScope: this,
                loop: true
            });
        } catch (error) {
            console.error('Error in setupTimers:', error);
        }
    }
    
    /**
     * Setup player input controls
     */
    setupInput() {
        try {
            // Keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            
            // Spacebar for flapping
            this.input.keyboard.on('keydown-SPACE', () => {
                this.flapBird();
            });
            
            // Keyboard for shooting (when power-up active)
            this.input.keyboard.on('keydown-F', () => {
                this.shootFireball();
            });
            
            // Touch/mouse input for mobile
            this.input.on('pointerdown', () => {
                this.flapBird();
            });
        } catch (error) {
            console.error('Error in setupInput:', error);
        }
    }
    
    /**
     * Main update function called every frame
     * @param {number} time - The current time
     * @param {number} delta - The delta time in ms since the last frame
     */
    update(time, delta) {
        if (this.isGameOver) return;
        
        try {
            // Update scrolling background
            this.updateBackground(delta);
            
            // Update bird
            if (this.bird && this.bird.active) {
                this.bird.update(time, delta);
            }
            
            // Update game objects
            this.updateObstacles(delta);
            this.updateEnemies(delta);
            this.updatePowerUps(delta);
            this.updateFireballs(delta);
            
            // Auto-shoot if flower power is active
            if (this.isShooting && time > this.lastFireTime + CONFIG.FIREBALL_RATE) {
                this.shootFireball();
                this.lastFireTime = time;
            }
        } catch (error) {
            console.error('Error in update:', error);
        }
    }
    
    /**
     * Make the bird flap its wings
     * FIX: Added active check
     */
    flapBird() {
        if (this.isGameOver || !this.bird || !this.bird.active) return;
        
        this.bird.flap();
    }
    
    /**
     * Update the scrolling background
     * @param {number} delta - Delta time since last frame
     */
    updateBackground(delta) {
        try {
            // Scroll background based on game speed
            const scrollFactor = this.gameSpeed * delta / 1000;
            if (this.bg && this.bg.active) {
                this.bg.tilePositionX += scrollFactor;
            }
        } catch (error) {
            console.error('Error in updateBackground:', error);
        }
    }
    
    /**
     * Update obstacles position and check for off-screen
     * @param {number} delta - Delta time since last frame
     * FIX: Added error handling and active checks
     */
    updateObstacles(delta) {
        try {
            // Get game speed for movement
            const moveAmount = this.gameSpeed * delta / 1000;
            
            // Ensure the obstacles group exists
            if (!this.obstacles) return;
            
            // Track how many obstacles were removed (for debugging)
            let removedCount = 0;
            
            this.obstacles.getChildren().forEach(obstacle => {
                if (!obstacle || !obstacle.active) return;
                
                // Move obstacle
                obstacle.x -= moveAmount;
                
                // Check if obstacle passed bird (for scoring)
                if (!obstacle.scored && this.bird && this.bird.active && 
                    obstacle.x < this.bird.x - obstacle.width / 2) {
                    this.increaseScore(CONFIG.BASE_OBSTACLE_POINTS);
                    obstacle.scored = true;
                }
                
                // Remove if off screen (far left of screen)
                if (obstacle.x < -obstacle.width * 2) {
                    obstacle.destroy();
                    removedCount++;
                }
            });
        } catch (error) {
            console.error('Error in updateObstacles:', error);
        }
    }
    
    /**
     * Update enemies position and behavior
     * @param {number} delta - Delta time since last frame
     * FIX: Added error handling and active checks
     */
    updateEnemies(delta) {
        try {
            const moveAmount = (this.gameSpeed - CONFIG.ENEMY_SPEED_OFFSET) * delta / 1000;
            
            if (!this.enemies) return;
            
            this.enemies.getChildren().forEach(enemy => {
                if (!enemy || !enemy.active) return;
                
                enemy.x -= moveAmount;
                
                // Apply enemy movement pattern if bird exists
                if (this.bird && this.bird.active) {
                    if (enemy.movementPattern === 'sine') {
                        enemy.y = enemy.startY + Math.sin(enemy.x / 100) * 50;
                    } else if (enemy.movementPattern === 'chase') {
                        // Simple chase logic
                        if (enemy.y < this.bird.y) {
                            enemy.y += 1;
                        } else if (enemy.y > this.bird.y) {
                            enemy.y -= 1;
                        }
                    }
                }
                
                // Play animation
                if (enemy.anims && !enemy.anims.isPlaying) {
                    enemy.play('turtle-walk');
                }
                
                // Remove if off screen
                if (enemy.x < -enemy.width) {
                    enemy.destroy();
                }
            });
        } catch (error) {
            console.error('Error in updateEnemies:', error);
        }
    }
    
    /**
     * Update power-ups position
     * @param {number} delta - Delta time since last frame
     * FIX: Added error handling and active checks
     */
    updatePowerUps(delta) {
        try {
            const moveAmount = (this.gameSpeed - CONFIG.POWERUP_SPEED_OFFSET) * delta / 1000;
            
            if (!this.powerUps) return;
            
            this.powerUps.getChildren().forEach(powerUp => {
                if (!powerUp || !powerUp.active) return;
                
                powerUp.x -= moveAmount;
                
                // Make power-ups hover/float slightly
                powerUp.y += Math.sin(this.time.now / 300) * 0.5;
                
                // Remove if off screen
                if (powerUp.x < -powerUp.width) {
                    powerUp.destroy();
                }
            });
        } catch (error) {
            console.error('Error in updatePowerUps:', error);
        }
    }
    
    /**
     * Update fireballs position and behavior
     * @param {number} delta - Time since last update
     * FIX: Added better off-screen detection for all sides
     */
    updateFireballs(delta) {
        try {
            if (!this.fireballs) return;
            
            this.fireballs.getChildren().forEach(fireball => {
                // Skip if already marked for destruction or inactive
                if (!fireball || !fireball.active || fireball.destroyed) return;
                
                // Check if fireball is off screen (check all sides)
                if (fireball.x > CONFIG.GAME_WIDTH + 50 || 
                    fireball.x < -50 || 
                    fireball.y < -50 || 
                    fireball.y > CONFIG.GAME_HEIGHT + 50) {
                    fireball.destroyed = true;
                    fireball.destroy();
                }
            });
        } catch (error) {
            console.error('Error in updateFireballs:', error);
        }
    }

    /**
     * Handle collision between fireball and obstacle
     * @param {Phaser.GameObjects.Sprite} fireball - The fireball
     * @param {Phaser.GameObjects.Sprite} obstacle - The obstacle
     * FIXED: Now destroys obstacles completely
     */
    hitObstacleWithFireball(fireball, obstacle) {
        // Extra safeguards
        if (!fireball || !obstacle || !fireball.active || !obstacle.active) return;
        if (fireball.destroyed || obstacle.destroyed) return;
        
        try {
            // Mark fireball and obstacle as destroyed
            fireball.destroyed = true;
            obstacle.destroyed = true;
            
            // Play break sound for obstacle destruction
            this.sound.play('sfx-break', { volume: 0.6 });
            
            // Create explosion effect at obstacle position
            this.addDestructionEffect(obstacle.x, obstacle.y);
            
            // Add points for destroying obstacle
            this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
            
            // Destroy both objects
            fireball.destroy();
            obstacle.destroy();
        } catch (error) {
            console.error("Error in hitObstacleWithFireball:", error);
            
            // Attempt cleanup even if error occurred
            if (fireball && fireball.active) fireball.destroy();
            if (obstacle && obstacle.active) obstacle.destroy();
        }
    }

    /**
     * Handle collision between bird and obstacle
     * @param {Bird} bird - The player bird
     * @param {Phaser.GameObjects.Sprite} obstacle - The obstacle
     * FIXED: Big bird now destroys obstacles
     */
    hitObstacle(bird, obstacle) {
        // Don't process if game is already over or objects don't exist
        if (this.isGameOver || !bird || !bird.active || !obstacle || !obstacle.active) return;
        
        try {
            // Check if bird is invulnerable from star powerup
            if (bird.isInvulnerable) {
                console.log("Bird is invulnerable - destroying obstacle");
                
                // Destroy the obstacle
                this.addDestructionEffect(obstacle.x, obstacle.y);
                this.sound.play('sfx-break', { volume: 0.6 });
                this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
                obstacle.destroy();
                return;
            }
            
            // Check if bird is big - it can now destroy all obstacles
            if (this.isBig) {
                console.log("Big bird destroyed obstacle");
                
                // Destroy the obstacle completely
                this.addDestructionEffect(obstacle.x, obstacle.y);
                this.sound.play('sfx-break', { volume: 0.6 });
                this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
                obstacle.destroy();
                return;
            }
            
            console.log("Bird hit obstacle - game over");
            
            // Bird died - game over
            if (bird.die) {
                bird.die();
            }
            
            this.gameOver();
        } catch (error) {
            console.error('Error in hitObstacle:', error);
        }
    }

    /**
     * Create game object groups
     * FIXED: Added enemy projectiles group
     */
    createGroups() {
        try {
            this.obstacles = this.physics.add.group();
            this.enemies = this.physics.add.group();
            this.powerUps = this.physics.add.group();
            
            // Create fireball group with physics
            this.fireballs = this.physics.add.group({
                allowGravity: false,
                immovable: false
            });
            
            // Create enemy projectiles group
            this.enemyProjectiles = this.physics.add.group({
                allowGravity: false,
                immovable: false
            });
            
            // Create a group for other players (multiplayer)
            this.multiplayer = this.add.group();
        } catch (error) {
            console.error('Error in createGroups:', error);
        }
    }

    /**
     * Setup collision detection between game objects
     * FIXED: Added enemy projectile collision
     */
    setupCollisions() {
        try {
            // Bird collisions
            this.physics.add.collider(this.bird, this.obstacles, this.hitObstacle, null, this);
            this.physics.add.collider(this.bird, this.enemies, this.hitEnemy, null, this);
            this.physics.add.overlap(this.bird, this.powerUps, this.collectPowerUp, null, this);
            
            // Fireball collisions - use overlap instead of collider for more reliable detection
            this.physics.add.overlap(this.fireballs, this.enemies, this.hitEnemyWithFireball, null, this);
            this.physics.add.overlap(this.fireballs, this.obstacles, this.hitObstacleWithFireball, null, this);
            
            // Enemy projectile collisions
            this.physics.add.overlap(this.enemyProjectiles, this.bird, this.hitBirdWithProjectile, null, this);
        } catch (error) {
            console.error('Error in setupCollisions:', error);
        }
    }

    /**
     * Handle collision between bird and enemy projectile
     * @param {Bird} bird - The player bird
     * @param {Phaser.GameObjects.Sprite} projectile - Enemy projectile
     */
    hitBirdWithProjectile(bird, projectile) {
        if (!bird || !projectile || !bird.active || !projectile.active) return;
        if (this.isGameOver) return;
        
        try {
            // Destroy the projectile
            projectile.destroy();
            
            // Check if bird is invulnerable
            if (bird.isInvulnerable) {
                console.log("Bird is invulnerable - projectile hit ignored");
                return;
            }
            
            // Check if bird is big - takes hit without dying
            if (this.isBig) {
                console.log("Big bird hit by projectile - becoming small");
                this.sound.play('sfx-hit', { volume: 0.6 });
                
                // Lose mushroom powerup
                if (bird.isBig) {
                    bird.clearPowerUps();
                    this.isBig = false;
                    if (this.bigIndicator) this.bigIndicator.setVisible(false);
                }
                return;
            }
            
            console.log("Bird hit by projectile - game over");
            
            // Bird died - game over
            if (bird.die) {
                bird.die();
            }
            
            this.gameOver();
        } catch (error) {
            console.error('Error in hitBirdWithProjectile:', error);
        }
    }

    /**
     * Update method to handle enemy projectiles
     * @param {number} delta - Time since last update
     */
    updateEnemyProjectiles(delta) {
        try {
            if (!this.enemyProjectiles) return;
            
            this.enemyProjectiles.getChildren().forEach(projectile => {
                // Skip if inactive
                if (!projectile || !projectile.active) return;
                
                // Check if projectile is off screen
                if (projectile.x < -50 || projectile.x > CONFIG.GAME_WIDTH + 50 ||
                    projectile.y < -50 || projectile.y > CONFIG.GAME_HEIGHT + 50) {
                    projectile.destroy();
                }
            });
        } catch (error) {
            console.error('Error in updateEnemyProjectiles:', error);
        }
    }

    /**
     * Main update function called every frame
     * @param {number} time - The current time
     * @param {number} delta - The delta time in ms since the last frame
     * FIXED: Added enemy projectiles update
     */
    update(time, delta) {
        if (this.isGameOver) return;
        
        try {
            // Update scrolling background
            this.updateBackground(delta);
            
            // Update bird
            if (this.bird && this.bird.active) {
                this.bird.update(time, delta);
            }
            
            // Update game objects
            this.updateObstacles(delta);
            this.updateEnemies(delta);
            this.updatePowerUps(delta);
            this.updateFireballs(delta);
            this.updateEnemyProjectiles(delta); // Add this line to handle enemy projectiles
            
            // Auto-shoot if flower power is active
            if (this.isShooting && time > this.lastFireTime + CONFIG.FIREBALL_RATE) {
                this.shootFireball();
                this.lastFireTime = time;
            }
        } catch (error) {
            console.error('Error in update:', error);
        }
    }

    /**
     * Trigger end of level enemy shooting
     */
    triggerEnemyShooting() {
        if (this.isGameOver) return;
        
        try {
            console.log("Triggering end of level enemy shooting");
            
            // Show warning message
            const warningText = this.add.text(
                CONFIG.GAME_WIDTH / 2,
                100,
                "ENEMY ATTACK!",
                {
                    fontFamily: 'Arial',
                    fontSize: '32px',
                    color: '#ff0000',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5);
            
            // Add warning flash effect
            this.tweens.add({
                targets: warningText,
                alpha: { from: 1, to: 0 },
                duration: 500,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    warningText.destroy();
                }
            });
            
            // Play warning sound
            this.sound.play('sfx-levelup', { volume: 0.7 }); // Reuse level up sound
            
            // Make all on-screen enemies shoot at intervals
            const enemies = this.enemies.getChildren();
            if (enemies.length > 0) {
                // Create a timer to make enemies shoot
                this.enemyShootingTimer = this.time.addEvent({
                    delay: 1000, // 1 second between shots
                    callback: () => {
                        // Get all active enemies
                        const activeEnemies = this.enemies.getChildren().filter(e => e.active);
                        
                        // Have random enemies shoot
                        if (activeEnemies.length > 0) {
                            const randomIndex = Phaser.Math.Between(0, activeEnemies.length - 1);
                            const shooter = activeEnemies[randomIndex];
                            
                            if (shooter && shooter.active && typeof shooter.shootAtPlayer === 'function') {
                                shooter.shootAtPlayer();
                            }
                        }
                    },
                    repeat: 5 // 6 total shots (1 immediate + 5 repeats)
                });
            }
        } catch (error) {
            console.error('Error in triggerEnemyShooting:', error);
        }
    }

    /**
     * Increase level
     * FIXED: Added enemy shooting at end of level
     */
    increaseLevel() {
        if (this.isGameOver) return;
        
        try {
            // Trigger enemy shooting at end of current level
            this.triggerEnemyShooting();
            
            // Wait a bit before changing level
            this.time.delayedCall(3000, () => {
                if (this.isGameOver) return;
                
                // Increment level
                this.level++;
                
                // Update level text with animation
                if (this.levelText && this.levelText.active) {
                    this.tweens.add({
                        targets: this.levelText,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 100,
                        yoyo: true,
                        onComplete: () => {
                            if (this.levelText && this.levelText.active) {
                                this.levelText.setText(`Level: ${this.level}`);
                            }
                        }
                    });
                }
                
                // Increase game speed (up to a maximum)
                if (this.level <= CONFIG.MAX_LEVEL) {
                    this.gameSpeed += CONFIG.LEVEL_SPEED_INCREASE;
                }
                
                // Change background if needed
                const bgIndex = (this.level - 1) % CONFIG.BACKGROUNDS.length;
                const newBgConfig = CONFIG.BACKGROUNDS[bgIndex];
                
                if (newBgConfig.id !== this.currentBackground) {
                    // Fade transition to new background
                    this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
                        if (progress === 1 && this.bg && this.bg.active) {
                            // Change background
                            this.bg.setTexture(newBgConfig.texture);
                            this.currentBackground = newBgConfig.id;
                            
                            // Fade back in
                            this.cameras.main.fadeIn(500);
                        }
                    });
                }
                
                // Play level up sound
                this.sound.play('sfx-levelup', { volume: 0.7 });
                
                // Show level up text
                this.createLevelUpText();
            });
        } catch (error) {
            console.error('Error in increaseLevel:', error);
        }
    }
    
    /**
     * Create level up text effect
     * FIX: Added error handling
     */
    createLevelUpText() {
        try {
            const levelUpText = this.add.text(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2, `LEVEL ${this.level}!`, {
                fontFamily: 'Arial',
                fontSize: '40px',
                color: '#FFFF00',
                stroke: '#000000',
                strokeThickness: 6
            }).setOrigin(0.5);
            
            levelUpText.setAlpha(0);
            levelUpText.setScale(0.5);
            
            // Animate the text appearing and then fading out
            this.tweens.add({
                targets: levelUpText,
                alpha: 1,
                scale: 1.2,
                duration: 500,
                ease: 'Power1',
                yoyo: true,
                hold: 1000,
                onComplete: () => {
                    if (levelUpText && levelUpText.active) {
                        levelUpText.destroy();
                    }
                }
            });
        } catch (error) {
            console.error('Error in createLevelUpText:', error);
        }
    }
    
    /**
     * Game over
     * FIX: Complete cleanup of all timers and objects
     */
    gameOver() {
        if (this.isGameOver) return;
        
        try {
            console.log("Game over called");
            this.isGameOver = true;
            
            // Stop physics
            this.physics.pause();
            
            // Stop timers
            if (this.levelTimer) this.levelTimer.remove();
            if (this.obstacleTimer) this.obstacleTimer.remove();
            if (this.enemyTimer) this.enemyTimer.remove();
            if (this.powerUpTimer) this.powerUpTimer.remove();
            
            // Stop all powerup-related timers
            if (this.mushroomTimer) this.mushroomTimer.remove();
            if (this.flowerTimer) this.flowerTimer.remove();
            if (this.invulnerabilityTimer) this.invulnerabilityTimer.remove();
            if (this.mushroomBlinkTimer) this.mushroomBlinkTimer.remove();
            if (this.flowerBlinkTimer) this.flowerBlinkTimer.remove();
            if (this.invulnerabilityBlinkTimer) this.invulnerabilityBlinkTimer.remove();
            
            // Red tint on bird to indicate death
            if (this.bird && this.bird.active) {
                this.bird.setTint(0xff0000);
                this.bird.play('bird-hurt');
            }
            
            // Play game over sound
            this.sound.stopAll();
            this.sound.play('sfx-gameover', { volume: 0.8 });
            
            // Clean up multiplayer if active
            if (this.isMultiplayer) {
                stopMultiplayerSync();
                
                if (this.playerPositionListener) {
                    this.playerPositionListener();
                    this.playerPositionListener = null;
                }
                
                // Send final score to multiplayer room
                if (this.roomId) {
                    const finalScores = {};
                    finalScores[getCurrentUser().uid] = this.score;
                    endMultiplayerGame(finalScores).catch(err => console.error("Error ending multiplayer game:", err));
                }
            }
            
            // Save score to leaderboard if authenticated
            let highScore = 0;
            
            if (isAuthenticated()) {
                // Save score asynchronously
                saveScore(this.score)
                    .then(savedHighScore => {
                        highScore = savedHighScore;
                        // Show game over screen after delay
                        this.time.delayedCall(1500, () => {
                            showGameOverModal(this.score, highScore);
                        });
                    })
                    .catch(error => {
                        console.error("Error saving score:", error);
                        // Still show game over screen
                        this.time.delayedCall(1500, () => {
                            showGameOverModal(this.score, this.score);
                        });
                    });
                    
                updatePlayerStatus('menu');
            } else {
                // For guests, just use local storage
                const savedHighScore = localStorage.getItem('highScore') || 0;
                highScore = Math.max(this.score, savedHighScore);
                localStorage.setItem('highScore', highScore);
                
                // Show game over screen after delay
                this.time.delayedCall(1500, () => {
                    showGameOverModal(this.score, highScore);
                });
            }
        } catch (error) {
            console.error('Error in gameOver:', error);
            
            // Try to still show the game over screen even if there was an error
            try {
                showGameOverModal(this.score, this.score);
            } catch (e) {
                console.error('Failed to show game over screen:', e);
            }
        }
    }
    
    /**
     * Cleanup resources when shutting down scene
     * FIX: Comprehensive cleanup
     */
    shutdown() {
        console.log('GameScene shutdown called');
        
        try {
            // Stop the game if it's still running
            this.isGameOver = true;
            
            // Resume physics if paused
            if (this.physics && this.physics.world) {
                this.physics.resume();
                this.physics.world.resume();
            }
            
            // Clean up multiplayer resources
            if (this.isMultiplayer) {
                stopMultiplayerSync();
                
                if (this.playerPositionListener) {
                    this.playerPositionListener();
                    this.playerPositionListener = null;
                }
            }
            
            // Clean up event listeners in Bird
            if (this.bird) {
                this.bird.off('powerup-state-changed', this.onBirdPowerupStateChanged, this);
            }
            
            // Stop all timers
            if (this.levelTimer) this.levelTimer.remove();
            if (this.obstacleTimer) this.obstacleTimer.remove();
            if (this.enemyTimer) this.enemyTimer.remove();
            if (this.powerUpTimer) this.powerUpTimer.remove();
            if (this.mushroomTimer) this.mushroomTimer.remove();
            if (this.flowerTimer) this.flowerTimer.remove();
            if (this.invulnerabilityTimer) this.invulnerabilityTimer.remove();
            if (this.mushroomBlinkTimer) this.mushroomBlinkTimer.remove();
            if (this.flowerBlinkTimer) this.flowerBlinkTimer.remove();
            if (this.invulnerabilityBlinkTimer) this.invulnerabilityBlinkTimer.remove();
            
            // Remove all pending delayed calls
            this.time.removeAllEvents();
            
            // Kill all tweens
            this.tweens.killAll();
            
            // Remove all event listeners
            this.input.keyboard.shutdown();
            this.input.off('pointerdown');
            
            // Clear all groups with proper cleanup
            if (this.obstacles) {
                this.obstacles.clear(true, true);
                this.obstacles.destroy();
                this.obstacles = null;
            }
            
            if (this.enemies) {
                this.enemies.clear(true, true);
                this.enemies.destroy();
                this.enemies = null;
            }
            
            if (this.powerUps) {
                this.powerUps.clear(true, true);
                this.powerUps.destroy();
                this.powerUps = null;
            }
            
            if (this.fireballs) {
                this.fireballs.clear(true, true);
                this.fireballs.destroy();
                this.fireballs = null;
            }
            
            if (this.multiplayer) {
                this.multiplayer.clear(true, true);
                this.multiplayer.destroy();
                this.multiplayer = null;
            }
            
            // Destroy bird properly if it exists
            if (this.bird) {
                if (typeof this.bird.destroy === 'function') {
                    this.bird.destroy();
                }
                this.bird = null;
            }
            
            // Stop all sounds to prevent audio leaks
            this.sound.stopAll();
            
            // Reset all state variables
            this.isBig = false;
            this.isShooting = false;
            this.isInvulnerable = false;
            
            // Call parent shutdown - MUST BE LAST
            try {
                super.shutdown();
            } catch (error) {
                console.error('Error in parent shutdown:', error);
            }
        } catch (error) {
            console.error('Error in GameScene.shutdown:', error);
            
            // Try to call parent shutdown even if there was an error
            try {
                super.shutdown();
            } catch (e) {
                console.error('Error in parent shutdown after error:', e);
            }
        }
    }
    
    /**
     * Custom cleanup method that can be called from outside
     * FIX: Complete and comprehensive cleanup
     */
    cleanup() {
        console.log('GameScene external cleanup called');
        
        // Just call shutdown method
        this.shutdown();
    }
}