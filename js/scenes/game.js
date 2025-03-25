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
        
        // Setup game timers
        this.setupTimers();
        
        // Setup input
        this.setupInput();
        
        // Start background music
        this.sound.play('music-gameplay', { loop: true, volume: 0.7 });
        
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
        this.fireballs = this.physics.add.group();
    }
    
    /**
     * Create the player character (bird)
     */
    createBird() {
        // Find character config
        const character = CONFIG.CHARACTERS.find(c => c.id === this.characterId) || CONFIG.CHARACTERS[0];
        
        // Create bird sprite
        this.bird = this.physics.add.sprite(CONFIG.BIRD_START_X, CONFIG.BIRD_START_Y, character.texture);
        this.bird.setCollideWorldBounds(true);
        
        // Set smaller collision body
        const bodyWidth = this.bird.width * CONFIG.BIRD_COLLIDER_REDUCTION;
        const bodyHeight = this.bird.height * CONFIG.BIRD_COLLIDER_REDUCTION;
        this.bird.body.setSize(bodyWidth, bodyHeight);
        this.bird.body.setOffset(
            (this.bird.width - bodyWidth) / 2, 
            (this.bird.height - bodyHeight) / 2
        );
        
        // Store character properties
        this.bird.flightPower = character.flightPower;
        
        // Add animations
        this.anims.create({
            key: 'fly',
            frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
            frameRate: 10,
            repeat: -1
        });
        
        this.bird.play('fly');
    }
    
    /**
     * Setup collision detection between game objects
     */
    setupCollisions() {
        // Bird collisions
        this.physics.add.collider(this.bird, this.obstacles, this.hitObstacle, null, this);
        this.physics.add.collider(this.bird, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.bird, this.powerUps, this.collectPowerUp, null, this);
        
        // Fireball collisions
        this.physics.add.collider(this.fireballs, this.enemies, this.hitEnemyWithFireball, null, this);
        this.physics.add.collider(this.fireballs, this.obstacles, this.hitObstacleWithFireball, null, this);
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
        
        // Level text
        this.levelText = this.add.text(20, 55, 'Level: 1', { 
            fontFamily: 'Arial', 
            fontSize: '24px', 
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.levelText.setScrollFactor(0);
        
        // Power-up indicators
        this.powerupIndicator = this.add.container(CONFIG.GAME_WIDTH - 150, 20);
        this.powerupIndicator.setScrollFactor(0);
        
        // Create indicators but hide them initially
        this.bigIndicator = this.add.image(0, 0, 'mushroom-icon').setVisible(false);
        this.shootIndicator = this.add.image(50, 0, 'flower-icon').setVisible(false);
        
        this.powerupIndicator.add([this.bigIndicator, this.shootIndicator]);
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
     * Setup player input controls
     */
    setupInput() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Spacebar for flapping
        this.input.keyboard.on('keydown-SPACE', () => {
            this.flapBird();
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
        
        // Update game objects
        this.updateObstacles(delta);
        this.updateEnemies(delta);
        this.updatePowerUps(delta);
        this.updateFireballs(delta);
        
        // Apply gravity to bird (always falling)
        // The actual flap is handled by input events
    }
    
    /**
     * Make the bird flap its wings
     */
    flapBird() {
        if (this.isGameOver) return;
        
        // Apply upward velocity
        const flapPower = CONFIG.BIRD_FLAP_VELOCITY * this.bird.flightPower;
        this.bird.setVelocityY(flapPower);
        
        // Play flap sound
        this.sound.play('sfx-flap', { volume: 0.5 });
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
        const moveAmount = this.gameSpeed * delta / 1000;
        
        this.obstacles.getChildren().forEach(obstacle => {
            obstacle.x -= moveAmount;
            
            // Check if obstacle passed bird (for scoring)
            if (!obstacle.scored && obstacle.x < this.bird.x - obstacle.width / 2) {
                this.increaseScore(CONFIG.BASE_OBSTACLE_POINTS);
                obstacle.scored = true;
            }
            
            // Remove if off screen
            if (obstacle.x < -obstacle.width) {
                obstacle.destroy();
            }
        });
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
        // Auto-shoot if flower power is active
        if (this.isShooting && this.time.now > this.lastFireTime + CONFIG.FIREBALL_RATE) {
            this.shootFireball();
            this.lastFireTime = this.time.now;
        }
        
        // Move fireballs forward
        const fireballSpeed = CONFIG.FIREBALL_SPEED * delta / 1000;
        this.fireballs.getChildren().forEach(fireball => {
            fireball.x += fireballSpeed;
            
            // Rotate the fireball for effect
            fireball.angle += 5;
            
            // Remove if off screen
            if (fireball.x > CONFIG.GAME_WIDTH) {
                fireball.destroy();
            }
        });
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
        const powerUpType = Phaser.Math.RND.pick(['mushroom', 'flower']);
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
        } else {
            this.tweens.add({
                targets: powerUp,
                angle: { from: -5, to: 5 },
                duration: 500,
                yoyo: true,
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
        }
        
        // Destroy the power-up
        powerUp.destroy();
    }
    
    /**
     * Activate mushroom power-up (size increase)
     */
    activateMushroom() {
        // Set big flag
        this.isBig = true;
        this.bigIndicator.setVisible(true);
        
        // Increase bird size
        this.bird.setScale(1.5);
        
        // Clear any existing mushroom timer
        if (this.mushroomTimer) {
            this.mushroomTimer.remove();
        }
        
        // Set timer for power-up duration
        this.mushroomTimer = this.time.delayedCall(CONFIG.MUSHROOM_DURATION, () => {
            this.isBig = false;
            this.bird.setScale(1);
            this.bigIndicator.setVisible(false);
        }, [], this);
    }
    
    /**
     * Activate flower power-up (shooting)
     */
    activateFlower() {
        // Set shooting flag
        this.isShooting = true;
        this.shootIndicator.setVisible(true);
        this.lastFireTime = this.time.now;
        
        // Clear any existing flower timer
        if (this.flowerTimer) {
            this.flowerTimer.remove();
        }
        
        // Set timer for power-up duration
        this.flowerTimer = this.time.delayedCall(CONFIG.FLOWER_DURATION, () => {
            this.isShooting = false;
            this.shootIndicator.setVisible(false);
        }, [], this);
    }
    
    /**
     * Shoot a fireball
     */
    shootFireball() {
        // Create fireball at bird's position
        const fireball = this.fireballs.create(
            this.bird.x + this.bird.width / 2,
            this.bird.y,
            'fireball'
        );
        
        // Setup fireball properties
        fireball.body.allowGravity = false;
        
        // Play sound
        this.sound.play('sfx-fireball', { volume: 0.5 });
    }
    
    /**
     * Handle collision between bird and obstacle
     * @param {Phaser.GameObjects.Sprite} bird - The player bird
     * @param {Phaser.GameObjects.Sprite} obstacle - The obstacle hit
     */
    hitObstacle(bird, obstacle) {
        if (this.isBig) {
            // If bird is big, destroy obstacle
            obstacle.destroy();
            this.increaseScore(CONFIG.BIG_OBSTACLE_POINTS);
            this.sound.play('sfx-break', { volume: 0.7 });
            
            // Add particles/effect
            this.addDestructionEffect(obstacle.x, obstacle.y);
        } else {
            // Game over
            this.gameOver();
        }
    }
    
    /**
     * Handle collision between bird and enemy
     * @param {Phaser.GameObjects.Sprite} bird - The player bird
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy hit
     */
    hitEnemy(bird, enemy) {
        if (this.isBig) {
            // If bird is big, destroy enemy
            enemy.destroy();
            this.increaseScore(CONFIG.BASE_ENEMY_POINTS);
            this.sound.play('sfx-stomp', { volume: 0.7 });
            
            // Add particles/effect
            this.addDestructionEffect(enemy.x, enemy.y);
        } else {
            // Game over
            this.gameOver();
        }
    }
    
    /**
     * Handle collision between fireball and enemy
     * @param {Phaser.GameObjects.Sprite} fireball - The fireball
     * @param {Phaser.GameObjects.Sprite} enemy - The enemy hit
     */
    hitEnemyWithFireball(fireball, enemy) {
        // Destroy both objects
        fireball.destroy();
        enemy.destroy();
        
        // Increase score
        this.increaseScore(CONFIG.BASE_ENEMY_POINTS);
        
        // Play sound
        this.sound.play('sfx-hit', { volume: 0.7 });
        
        // Add particles/effect
        this.addDestructionEffect(enemy.x, enemy.y);
    }
    
    /**
     * Handle collision between fireball and obstacle
     * @param {Phaser.GameObjects.Sprite} fireball - The fireball
     * @param {Phaser.GameObjects.Sprite} obstacle - The obstacle hit
     */
    hitObstacleWithFireball(fireball, obstacle) {
        // Destroy fireball but not obstacle
        fireball.destroy();
        
        // Play sound
        this.sound.play('sfx-hit-obstacle', { volume: 0.5 });
        
        // Add impact effect
        this.addImpactEffect(fireball.x, fireball.y);
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
        this.scoreText.setText(`Score: ${this.score}`);
        
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
        this.levelText.setText(`Level: ${this.level}`);
        
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
        // Create impact sprite
        const impact = this.add.sprite(x, y, 'impact');
        impact.play('impact-anim');
        
        // Remove after animation completes
        impact.once('animationcomplete', () => {
            impact.destroy();
        });
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
        this.levelTimer.remove();
        this.obstacleTimer.remove();
        this.enemyTimer.remove();
        this.powerUpTimer.remove();
        
        if (this.mushroomTimer) this.mushroomTimer.remove();
        if (this.flowerTimer) this.flowerTimer.remove();
        
        // Red tint on bird to indicate death
        this.bird.setTint(0xff0000);
        this.bird.play('bird-hurt');
        
        // Play game over sound
        this.sound.stopAll();
        this.sound.play('sfx-gameover', { volume: 0.8 });
        
        // Save score to leaderboard if authenticated
        let highScore = 0;
        
        if (isAuthenticated()) {
            highScore = saveScore(this.score);
            updatePlayerStatus('menu');
        } else {
            // For guests, just use local storage
            const savedHighScore = localStorage.getItem('highScore') || 0;
            highScore = Math.max(this.score, savedHighScore);
            localStorage.setItem('highScore', highScore);
        }
        
        // Show game over screen after delay
        this.time.delayedCall(1500, () => {
            showGameOverModal(this.score, highScore);
        });
    }
}