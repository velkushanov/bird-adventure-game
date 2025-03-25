/**
 * GameScene - The main gameplay scene
 * Handles all gameplay mechanics including the bird, obstacles, enemies and power-ups
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
        this.isGameOver = false;
        this.characterId = null;
        this.currentBackground = null;
        
        // Multiplayer properties
        this.isMultiplayer = false;
        this.roomId = null;
        this.otherPlayers = {};
        this.otherPlayerSprites = {};
        this.playerPositionListener = null;
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
        
        // Set multiplayer flag if provided
        this.isMultiplayer = data.multiplayer || false;
        this.roomId = data.roomId || null;
        
        // Clear any previous multiplayer state
        this.otherPlayers = {};
        this.otherPlayerSprites = {};
        
        console.log(`Game initialized: CharacterId=${this.characterId}, Multiplayer=${this.isMultiplayer}, RoomId=${this.roomId}`);
    }
    
    create() {
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
    }
    
    /**
     * Setup the scrolling background
     */
    setupBackground() {
        // Choose background theme based on level
        const bgIndex = (this.level - 1) % CONFIG.BACKGROUNDS.length;
        const bgConfig = CONFIG.BACKGROUNDS[bgIndex];
        
        this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, bgConfig.texture)
            .setOrigin(0, 0)
            .setScrollFactor(0);
            
        this.currentBackground = bgConfig.id;
    }
    
    /**
     * Create all game object groups
     */
    createGroups() {
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
    }
    
    /**
     * Create the player character (bird)
     */
    createBird() {
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
        
        // NEW: Sync bird powerup state with game state
        this.bird.on('powerup-mushroom-activated', () => {
            console.log("Game: Mushroom powerup activated");
            this.isBig = true;
            if (this.bigIndicator) this.bigIndicator.setVisible(true);
        });
        
        this.bird.on('powerup-mushroom-deactivated', () => {
            console.log("Game: Mushroom powerup deactivated");
            this.isBig = false;
            if (this.bigIndicator) this.bigIndicator.setVisible(false);
        });
        
        this.bird.on('powerup-flower-activated', () => {
            console.log("Game: Flower powerup activated");
            this.isShooting = true;
            if (this.shootIndicator) this.shootIndicator.setVisible(true);
        });
        
        this.bird.on('powerup-flower-deactivated', () => {
            console.log("Game: Flower powerup deactivated");
            this.isShooting = false;
            if (this.shootIndicator) this.shootIndicator.setVisible(false);
        });
    }
    
    /**
     * Setup collision detection between game objects
     */
    setupCollisions() {
        // Bird collisions
        this.physics.add.collider(this.bird, this.obstacles, this.hitObstacle, null, this);
        this.physics.add.collider(this.bird, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.bird, this.powerUps, this.collectPowerUp, null, this);
        
        // Fireball collisions - use overlap instead of collider for more reliable detection
        this.physics.add.overlap(this.fireballs, this.enemies, this.hitEnemyWithFireball, null, this);
        this.physics.add.overlap(this.fireballs, this.obstacles, this.hitObstacleWithFireball, null, this);
    }

    hitEnemy(bird, enemy) {
        // Don't process if game is already over or bird is invulnerable
        if (this.isGameOver) return;
        
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
    }
    
    /**
     * Create UI elements like score display
     */
    createUI() {
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
    }
    
    /**
     * Setup gameplay timers
     */
    setupTimers() {
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
    }
    
    /**
     * Setup multiplayer functionality
     */
    setupMultiplayer() {
        console.log("Setting up multiplayer game with roomId:", this.roomId);
        
        // Create a group for other players
        this.otherPlayerSprites = {};
        
        // Start syncing player position
        if (this.bird) {
            startMultiplayerSync(this.bird);
        }
        
        // Listen for other players' positions
        this.playerPositionListener = listenToPlayerPositions(this.updateOtherPlayers.bind(this));
        
        // Set up multiplayer timers (same as single player for now)
        this.setupTimers();
    }

    /**
     * Update other players' positions in multiplayer
     * @param {Object} playerData - Data of other players
     */
    updateOtherPlayers(playerData) {
        console.log("Updating other players, received data for", Object.keys(playerData).length, "players");
        
        if (!playerData) return;
        
        // Process each player
        for (const playerId in playerData) {
            const player = playerData[playerId];
            
            // Skip if no position data or character
            if (!player.position || !player.character) {
                console.log("Skipping player with missing data:", playerId, player);
                continue;
            }
            
            // Find the character texture 
            const character = CONFIG.CHARACTERS.find(c => c.id === player.character);
            if (!character) {
                console.log("Character not found for player:", playerId, player.character);
                continue;
            }
            
            // Create or update player sprite
            if (!this.otherPlayerSprites[playerId]) {
                console.log(`Creating sprite for player ${playerId} with character ${player.character} at position X:${player.position.x} Y:${player.position.y}`);
                
                // Create new sprite for this player
                const sprite = this.add.sprite(
                    player.position.x,
                    player.position.y,
                    character.texture
                );
                
                // Create name tag above player
                const nameTag = this.add.text(
                    player.position.x,
                    player.position.y - 30,
                    player.name || 'Player',
                    {
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        color: '#FFFFFF',
                        stroke: '#000000',
                        strokeThickness: 3
                    }
                ).setOrigin(0.5);
                
                // Store both sprite and name tag
                this.otherPlayerSprites[playerId] = {
                    sprite: sprite,
                    nameTag: nameTag,
                    lastUpdate: Date.now()
                };
                
                // Create and play animation
                const animKey = `mp-fly-${character.texture}-${playerId}`;
                if (!this.anims.exists(animKey)) {
                    this.anims.create({
                        key: animKey,
                        frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
                        frameRate: 10,
                        repeat: -1
                    });
                }
                
                sprite.play(animKey);
                
                // Update player count display
                this.updatePlayerCountDisplay();
            } else {
                // Update existing sprite if position data is newer
                const spriteData = this.otherPlayerSprites[playerId];
                const sprite = spriteData.sprite;
                const nameTag = spriteData.nameTag;
                
                if (player.position.timestamp > spriteData.lastUpdate) {
                    console.log(`Updating player ${playerId} to position X:${player.position.x} Y:${player.position.y}`);
                    
                    // Set position directly for smoother updates
                    sprite.x = player.position.x;
                    sprite.y = player.position.y;
                    
                    if (player.position.rotation !== undefined) {
                        sprite.rotation = player.position.rotation;
                    }
                    
                    // Update name tag position
                    nameTag.x = player.position.x;
                    nameTag.y = player.position.y - 30;
                    
                    // Apply scale and tint if available
                    if (player.position.scale) {
                        sprite.setScale(player.position.scale);
                    }
                    
                    if (player.position.tint) {
                        sprite.setTint(player.position.tint);
                    } else {
                        sprite.clearTint();
                    }
                    
                    // Update last update timestamp
                    spriteData.lastUpdate = player.position.timestamp;
                }
            }
        }
        
        // Remove sprites for players no longer in the room
        for (const playerId in this.otherPlayerSprites) {
            if (!playerData[playerId]) {
                console.log("Player left:", playerId);
                // Player left, remove their sprite
                const spriteData = this.otherPlayerSprites[playerId];
                if (spriteData.sprite) spriteData.sprite.destroy();
                if (spriteData.nameTag) spriteData.nameTag.destroy();
                delete this.otherPlayerSprites[playerId];
                
                // Update player count display
                this.updatePlayerCountDisplay();
            }
        }
    }

    /**
     * Update the player count display in multiplayer
     */
    updatePlayerCountDisplay() {
        if (this.isMultiplayer && this.playersText) {
            const playerCount = Object.keys(this.otherPlayerSprites).length + 1; // +1 for local player
            this.playersText.setText(`Players: ${playerCount}`);
        }
    }
    
    /**
     * Setup player input controls
     */
    setupInput() {
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
    }
    
    /**
     * Main update function called every frame
     * @param {number} time - The current time
     * @param {number} delta - The delta time in ms since the last frame
     */
    update(time, delta) {
        if (this.isGameOver) return;
        
        // Update scrolling background
        this.updateBackground(delta);
        
        // Update bird
        if (this.bird) {
            this.bird.update(time, delta);
        }
        
        // Update game objects
        this.updateObstacles(delta);
        this.updateEnemies(delta);
        this.updatePowerUps(delta);
        this.updateFireballs(delta); // Make sure this line is added!
        
        // Auto-shoot if flower power is active
        if (this.isShooting && time > this.lastFireTime + CONFIG.FIREBALL_RATE) {
            this.shootFireball();
            this.lastFireTime = time;
        }
    }
    
    /**
     * Make the bird flap its wings
     */
    flapBird() {
        if (this.isGameOver || !this.bird) return;
        
        this.bird.flap();
    }
    
    /**
     * Update the scrolling background
     * @param {number} delta - Delta time since last frame
     */
    updateBackground(delta) {
        // Scroll background based on game speed
        const scrollFactor = this.gameSpeed * delta / 1000;
        this.bg.tilePositionX += scrollFactor;
    }
    
    /**
     * Update obstacles position and check for off-screen
     * @param {number} delta - Delta time since last frame
     */

    updateObstacles(delta) {
        // Get game speed for movement
        const moveAmount = this.gameSpeed * delta / 1000;
        
        // Ensure the obstacles group exists
        if (!this.obstacles) return;
        
        // Track how many obstacles were removed (for debugging)
        let removedCount = 0;
        
        this.obstacles.getChildren().forEach(obstacle => {
            // Move obstacle
            obstacle.x -= moveAmount;
            
            // Check if obstacle passed bird (for scoring)
            if (!obstacle.scored && obstacle.x < this.bird.x - obstacle.width / 2) {
                this.increaseScore(CONFIG.BASE_OBSTACLE_POINTS);
                obstacle.scored = true;
            }
            
            // Remove if off screen (far left of screen)
            if (obstacle.x < -obstacle.width * 2) {
                obstacle.destroy();
                removedCount++;
            }
        });
        
        // Debug log if we removed many obstacles at once
        if (removedCount > 3) {
            console.log(`Removed ${removedCount} off-screen obstacles`);
        }
    }
    
    /**
     * Update enemies position and behavior
     * @param {number} delta - Delta time since last frame
     */
    updateEnemies(delta) {
        const moveAmount = (this.gameSpeed - CONFIG.ENEMY_SPEED_OFFSET) * delta / 1000;
        
        this.enemies.getChildren().forEach(enemy => {
            enemy.x -= moveAmount;
            
            // Apply enemy movement pattern
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
            
            // Play animation
            if (enemy.anims && !enemy.anims.isPlaying) {
                enemy.play('turtle-walk');
            }
            
            // Remove if off screen
            if (enemy.x < -enemy.width) {
                enemy.destroy();
            }
        });
    }
    
    /**
     * Update power-ups position
     * @param {number} delta - Delta time since last frame
     */
    updatePowerUps(delta) {
        const moveAmount = (this.gameSpeed - CONFIG.POWERUP_SPEED_OFFSET) * delta / 1000;
        
        this.powerUps.getChildren().forEach(powerUp => {
            powerUp.x -= moveAmount;
            
            // Make power-ups hover/float slightly
            powerUp.y += Math.sin(this.time.now / 300) * 0.5;
            
            // Remove if off screen
            if (powerUp.x < -powerUp.width) {
                powerUp.destroy();
            }
        });
    }
    
    /**
     * Update fireballs position and behavior
     * @param {number} delta - Delta time since last frame
     */
    updateFireballs(delta) {
        if (this.fireballs) {
            this.fireballs.getChildren().forEach(fireball => {
                // Skip if already marked for destruction
                if (fireball.destroyed) return;
                
                // Check if fireball is off screen
                if (fireball.x > CONFIG.GAME_WIDTH + 50) {
                    fireball.destroyed = true;
                    fireball.destroy();
                }
            });
        }
    }
    
    /**
     * Generate obstacle pairs (pipes)
     */
    generateObstacles() {
        if (this.isGameOver) return;
        
        // Calculate gap size based on level (gets smaller as level increases)
        const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
        const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (this.level - 1), maxReduction);
        const gapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
        
        // Random position for the gap
        const gapPosition = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100 - gapSize);
        
        // Create top obstacle
        const topObstacle = this.obstacles.create(CONFIG.GAME_WIDTH, gapPosition - 320, 'pipe');
        topObstacle.body.allowGravity = false;
        topObstacle.setImmovable(true);
        topObstacle.scored = false;
        
        // Create bottom obstacle
        const bottomObstacle = this.obstacles.create(CONFIG.GAME_WIDTH, gapPosition + gapSize, 'pipe');
        bottomObstacle.body.allowGravity = false;
        bottomObstacle.setImmovable(true);
        bottomObstacle.flipY = true;
        bottomObstacle.scored = false;
    }
    
    /**
     * Generate enemy turtles
     */
    generateEnemies() {
        if (this.isGameOver) return;
        
        const y = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100);
        const turtle = this.enemies.create(CONFIG.GAME_WIDTH, y, 'turtle');
        
        // Setup enemy properties
        turtle.body.allowGravity = false;
        turtle.startY = y;
        
        // 50% chance for each movement pattern
        turtle.movementPattern = Phaser.Math.RND.pick(['sine', 'chase']);
        
        // Add animations if they don't exist yet
        if (!this.anims.exists('turtle-walk')) {
            this.anims.create({
                key: 'turtle-walk',
                frames: this.anims.generateFrameNumbers('turtle', { start: 0, end: 1 }),
                frameRate: 5,
                repeat: -1
            });
        }
        
        turtle.play('turtle-walk');
    }
    
    /**
     * Generate power-ups
     */
    generatePowerUps() {
        if (this.isGameOver) return;
        
        // Random y position
        const y = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100);
        
        // Randomly choose power-up type
        const powerUpType = Phaser.Math.RND.pick(['mushroom', 'flower', 'coin']);
        const powerUp = this.powerUps.create(CONFIG.GAME_WIDTH, y, powerUpType);
        
        // Setup power-up properties
        powerUp.body.allowGravity = false;
        powerUp.type = powerUpType;
        
        // Add pulsing or rotation animation
        if (powerUpType === 'mushroom') {
            this.tweens.add({
                targets: powerUp,
                scale: { from: 0.9, to: 1.1 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } else if (powerUpType === 'flower') {
            this.tweens.add({
                targets: powerUp,
                angle: { from: -5, to: 5 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } else if (powerUpType === 'coin') {
            this.tweens.add({
                targets: powerUp,
                angle: { from: 0, to: 360 },
                duration: 1000,
                repeat: -1
            });
        }
    }
    
    /**
     * Player collects a power-up
     * @param {Phaser.GameObjects.Sprite} bird - The player bird
     * @param {Phaser.GameObjects.Sprite} powerUp - The collected power-up
     */
    collectPowerUp(bird, powerUp) {
        // Play sound
        this.sound.play('sfx-powerup', { volume: 0.7 });
        
        // Apply power-up effect based on type
        if (powerUp.type === 'mushroom') {
            this.activateMushroom();
        } else if (powerUp.type === 'flower') {
            this.activateFlower();
        } else if (powerUp.type === 'coin') {
            // Add points for coin
            this.increaseScore(10);
            this.sound.play('sfx-coin', { volume: 0.7 });
        }
        
        // Create collection effect
        this.addCollectionEffect(powerUp.x, powerUp.y, powerUp.type);
        
        // Destroy the power-up
        powerUp.destroy();
    }
    
    /**
     * Add collection effect for power-ups
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} type - Power-up type
     */
    addCollectionEffect(x, y, type) {
        // Create particles
        const particles = this.add.particles('particle');
        
        // Set particle color based on power-up type
        let particleColor;
        switch (type) {
            case 'mushroom': particleColor = 0xff0000; break;
            case 'flower': particleColor = 0xff9900; break;
            case 'coin': particleColor = 0xffdd00; break;
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
            emitter.stop();
            
            // Clean up particles after they fade
            this.time.delayedCall(600, () => {
                particles.destroy();
            });
        });
    }
    
    /**
     * Activate mushroom power-up (size increase)
     */
    activateMushroom() {
        // Already big, just reset the timer
        if (this.isBig) {
            if (this.mushroomTimer) this.mushroomTimer.remove();
            if (this.mushroomBlinkTimer) this.mushroomBlinkTimer.remove();
            if (this.mushroomBlinkTween) this.mushroomBlinkTween.stop();
        } else {
            // Become big
            this.isBig = true;
            this.setScale(1.5);
            
            // Emit event to sync game state
            this.scene.events.emit('powerup-mushroom-activated');
            
            // Play transformation sound
            this.scene.sound.play('sfx-powerup', { volume: 0.7 });
            
            // Add growth effect
            this.addGrowEffect();
        }
        
        // Set timer for power-up duration
        this.mushroomTimer = this.scene.time.delayedCall(CONFIG.MUSHROOM_DURATION, () => {
            // Return to normal size
            this.isBig = false;
            this.setScale(1);
            
            // Emit event to sync game state
            this.scene.events.emit('powerup-mushroom-deactivated');
            
            // Add shrink effect
            this.addShrinkEffect();
            
            // Clear blinking effect
            if (this.mushroomBlinkTween) {
                this.mushroomBlinkTween.stop();
                this.clearTint();
                this.alpha = 1;
            }
        }, [], this);
        
        // Add blinking timer at 1 second before expiration
        if (CONFIG.MUSHROOM_DURATION > 1000) {
            this.mushroomBlinkTimer = this.scene.time.delayedCall(CONFIG.MUSHROOM_DURATION - 1000, () => {
                console.log("Starting mushroom expiration blink");
                
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
        }
    }
    
    /**
     * Activate flower power-up (shooting)
     */
    activateFlower() {
        // Already shooting, just reset the timer
        if (this.isShooting) {
            if (this.flowerTimer) this.flowerTimer.remove();
            if (this.flowerBlinkTimer) this.flowerBlinkTimer.remove();
            if (this.flowerBlinkTween) this.flowerBlinkTween.stop();
        } else {
            // Enable shooting
            this.isShooting = true;
            
            // Emit event to sync game state
            this.scene.events.emit('powerup-flower-activated');
            
            // Play power-up sound
            this.scene.sound.play('sfx-powerup', { volume: 0.7 });
            
            // Add glow effect
            this.addGlowEffect();
        }
        
        // Set timer for power-up duration
        this.flowerTimer = this.scene.time.delayedCall(CONFIG.FLOWER_DURATION, () => {
            // Disable shooting
            this.isShooting = false;
            
            // Emit event to sync game state
            this.scene.events.emit('powerup-flower-deactivated');
            
            // Remove glow effect
            this.removeGlowEffect();
            
            // Clear blinking effect
            if (this.flowerBlinkTween) {
                this.flowerBlinkTween.stop();
                this.clearTint();
                this.alpha = 1;
            }
        }, [], this);
        
        // Add blinking timer at 1 second before expiration
        if (CONFIG.FLOWER_DURATION > 1000) {
            this.flowerBlinkTimer = this.scene.time.delayedCall(CONFIG.FLOWER_DURATION - 1000, () => {
                console.log("Starting flower expiration blink");
                
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
        }
    }
    
    /**
     * Shoot a fireball
     * @returns {Phaser.GameObjects.Sprite} The created fireball or null if can't shoot
     */
    shootFireball() {
        // Only call the bird's shootFireball if it exists
        if (this.bird && typeof this.bird.shootFireball === 'function') {
            return this.bird.shootFireball();
        }
        return null;
    }
    
    /**
     * Handle collision between fireball and enemy
     * @param {Phaser.GameObjects.Sprite} fireball - The fireball
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy hit
     */
    hitEnemyWithFireball(fireball, enemy) {
        // Extra safeguards
        if (!fireball || !enemy) return;
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
        }
    }
    
    /**
     * Handle collision between fireball and obstacle
     * @param {Phaser.GameObjects.Sprite} fireball - The fireball
     * @param {Phaser.GameObjects.Sprite} obstacle - The obstacle hit
     */
    hitObstacle(bird, obstacle) {
        // Don't process if game is already over or bird is invulnerable
        if (this.isGameOver) return;
        
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
    }
    
    /**
     * Increase player score
     * @param {number} points - Points to add
     */
    increaseScore(points) {
        // Calculate points based on level
        const levelMultiplier = Math.max(1, this.level);
        const pointsToAdd = points * levelMultiplier;
        
        // Update score
        this.score += pointsToAdd;
        
        // Update score text with animation for visibility
        this.tweens.add({
            targets: this.scoreText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                this.scoreText.setText(`Score: ${this.score}`);
            }
        });
        
        // Create floating score text
        this.createFloatingText(`+${pointsToAdd}`, this.bird.x, this.bird.y - 30);
    }
    
    /**
     * Increase level
     */
    increaseLevel() {
        if (this.isGameOver) return;
        
        // Increment level
        this.level++;
        
        // Update level text with animation
        this.tweens.add({
            targets: this.levelText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                this.levelText.setText(`Level: ${this.level}`);
            }
        });
        
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
                if (progress === 1) {
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
    }
    
    /**
     * Create destruction particle effect
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    addDestructionEffect(x, y) {
        // Create particle emitter for destruction effect
        const particles = this.add.particles('particle');
        
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: 50, max: 150 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            lifespan: 500,
            quantity: 20
        });
        
        // Stop emitter after a single burst
        this.time.delayedCall(100, () => {
            emitter.stop();
            
            // Remove particles after they fade out
            this.time.delayedCall(500, () => {
                particles.destroy();
            });
        });
    }
    
    /**
     * Create impact effect
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    addImpactEffect(x, y) {
        try {
            // Create impact sprite
            const impact = this.add.sprite(x, y, 'impact');
            
            // Make sure the impact animation exists
            if (!this.anims.exists('impact-anim')) {
                this.anims.create({
                    key: 'impact-anim',
                    frames: this.anims.generateFrameNumbers('impact', { start: 0, end: 5 }),
                    frameRate: 20,
                    repeat: 0
                });
            }
            
            // Play the animation
            impact.play('impact-anim');
            
            // Set proper depth
            impact.setDepth(10);
            
            // Use Phaser's timer to ensure removal
            this.time.addEvent({
                delay: 300, // Animation duration
                callback: () => {
                    if (impact && impact.active) {
                        impact.destroy();
                    }
                }
            });
        } catch (error) {
            console.error("Error creating impact effect:", error);
        }
    }
    
    /**
     * Create floating score text
     * @param {string} text - Text to display
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createFloatingText(text, x, y) {
        const floatingText = this.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Animate the text floating up and fading out
        this.tweens.add({
            targets: floatingText,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: 'Power1',
            onComplete: () => {
                floatingText.destroy();
            }
        });
    }
    
    /**
     * Create level up text effect
     */
    createLevelUpText() {
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
                levelUpText.destroy();
            }
        });
    }
    
    /**
     * Game over
     */
    gameOver() {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        
        // Stop physics
        this.physics.pause();
        
        // Stop timers
        if (this.levelTimer) this.levelTimer.remove();
        if (this.obstacleTimer) this.obstacleTimer.remove();
        if (this.enemyTimer) this.enemyTimer.remove();
        if (this.powerUpTimer) this.powerUpTimer.remove();
        
        if (this.mushroomTimer) this.mushroomTimer.remove();
        if (this.flowerTimer) this.flowerTimer.remove();
        
        // Red tint on bird to indicate death
        if (this.bird) {
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
    }
    
    /**
     * Cleanup resources when shutting down scene
     */
    shutdown() {
        console.log('GameScene shutdown called');
        
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
        
        // Stop all timers
        if (this.levelTimer) this.levelTimer.remove();
        if (this.obstacleTimer) this.obstacleTimer.remove();
        if (this.enemyTimer) this.enemyTimer.remove();
        if (this.powerUpTimer) this.powerUpTimer.remove();
        if (this.mushroomTimer) this.mushroomTimer.remove();
        if (this.flowerTimer) this.flowerTimer.remove();
        
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
        
        // Call parent shutdown - MUST BE LAST
        try {
            super.shutdown();
        } catch (error) {
            console.error('Error in parent shutdown:', error);
        }
    }
    
    /**
     * Custom cleanup method that can be called from outside
     */
    cleanup() {
        console.log('GameScene external cleanup called');
        
        // Just call shutdown method
        this.shutdown();
    }
}