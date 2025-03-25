/**
 * Obstacle Class
 * Represents obstacles that the player must avoid
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
        this.strength = config.strength || 1;
        this.scored = false;
        
        // Configure physics body
        this.body.allowGravity = false;
        this.setImmovable(true);
        
        // Setup based on obstacle type
        this.setupObstacleType();
    }
    
    /**
     * Setup obstacle based on its type
     */
    setupObstacleType() {
        switch (this.type) {
            case 'pipe':
                // Standard pipe - no special properties
                break;
                
            case 'brick':
                // Brick block - breakable by big bird
                this.strength = 1;
                break;
                
            case 'rock':
                // Rock - tougher, requires 2 hits when big
                this.strength = 2;
                break;
                
            case 'spikes':
                // Spikes - deadly even when big
                this.strength = 99; // Essentially unbreakable
                break;
                
            default:
                // Default to standard pipe
                this.type = 'pipe';
                break;
        }
    }
    
    /**
     * Take damage
     * @param {number} amount - Amount of damage to take
     * @returns {boolean} True if obstacle was destroyed
     */
    takeDamage(amount = 1) {
        this.strength -= amount;
        
        if (this.strength <= 0) {
            // Create destruction effect
            this.createDestructionEffect();
            
            // Play destroy sound based on type
            switch (this.type) {
                case 'brick':
                    this.scene.sound.play('sfx-break', { volume: 0.7 });
                    break;
                    
                case 'rock':
                    this.scene.sound.play('sfx-break', { volume: 0.8 });
                    break;
                    
                default:
                    this.scene.sound.play('sfx-hit', { volume: 0.6 });
                    break;
            }
            
            // Destroy the obstacle
            this.destroy();
            return true;
        } else {
            // Obstacle took damage but survived
            this.createHitEffect();
            
            // Play hit sound
            this.scene.sound.play('sfx-hit-obstacle', { volume: 0.5 });
            
            return false;
        }
    }
    
    /**
     * Create destruction effect
     */
    createDestructionEffect() {
        // Create particles
        const particles = this.scene.add.particles('particle');
        
        // Set particle color based on obstacle type
        let particleColor = 0xFFFFFF;
        
        switch (this.type) {
            case 'brick':
                particleColor = 0xC25B17; // Brown
                break;
                
            case 'rock':
                particleColor = 0x888888; // Gray
                break;
                
            case 'pipe':
                particleColor = 0x22AA22; // Green
                break;
                
            case 'spikes':
                particleColor = 0xCCCCCC; // Silver
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
            emitter.stop();
            
            // Clean up particles after they fade
            this.scene.time.delayedCall(800, () => {
                particles.destroy();
            });
        });
    }
    
    /**
     * Create hit effect when obstacle is hit but not destroyed
     */
    createHitEffect() {
        // Flash the obstacle
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 50,
            yoyo: true,
            repeat: 2,
            ease: 'Linear'
        });
        
        // Small shake effect
        this.scene.tweens.add({
            targets: this,
            x: this.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
    }
    
    /**
     * Update obstacle
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     * @param {number} speed - Game speed
     */
    update(time, delta, speed) {
        // Move obstacle based on game speed
        this.x -= speed * delta / 1000;
        
        // Remove if offscreen
        if (this.x < -this.width) {
            this.destroy();
        }
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
        
        // Pattern definitions
        this.patterns = [
            this.generateBasicPipes,      // Standard pipe pair
            this.generateStaggeredPipes,  // Staggered pipes
            this.generateWavyPipes,       // Wavy pattern
            this.generateNarrowGap,       // Extra narrow gap
            this.generateBlockade         // Blockade with small gaps
        ];
        
        // Obstacle types by level
        this.levelObstacleTypes = [
            ['pipe'],                                  // Level 1
            ['pipe', 'brick'],                         // Level 2
            ['pipe', 'brick', 'rock'],                 // Level 3
            ['pipe', 'brick', 'rock', 'spikes'],       // Level 4+
        ];
    }
    
    /**
     * Generate obstacles based on current level
     * @param {number} level - Current game level
     */
    generate(level) {
        // Determine pattern based on level
        const patternIndex = Math.min(level - 1, this.patterns.length - 1);
        const extraPatterns = Math.floor((level - 1) / this.patterns.length);
        
        // Choose random pattern with weighting toward level-appropriate patterns
        let selectedPattern;
        
        if (Phaser.Math.RND.frac() < 0.7) {
            // 70% chance for level-appropriate pattern
            selectedPattern = Phaser.Math.RND.integerInRange(0, patternIndex);
        } else {
            // 30% chance for any pattern
            selectedPattern = Phaser.Math.RND.integerInRange(0, this.patterns.length - 1);
        }
        
        // Get available obstacle types for this level
        const levelIndex = Math.min(level - 1, this.levelObstacleTypes.length - 1);
        const availableTypes = this.levelObstacleTypes[levelIndex];
        
        // Generate the obstacles
        const pattern = this.patterns[selectedPattern];
        pattern.call(this, level, availableTypes);
    }
    
    /**
     * Generate basic pipe pair with gap
     * @param {number} level - Current game level
     * @param {Array} types - Available obstacle types
     */
    generateBasicPipes(level, types) {
        // Calculate gap size based on level (gets smaller as level increases)
        const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
        const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (level - 1), maxReduction);
        const gapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
        
        // Random position for the gap
        const gapPosition = Phaser.Math.Between(100, CONFIG.GAME_HEIGHT - 100 - gapSize);
        
        // Choose obstacle type (prefer pipes for basic pattern)
        const obstacleType = (Phaser.Math.RND.frac() < 0.7) ? 'pipe' : Phaser.Math.RND.pick(types);
        
        // Create top obstacle
        const topObstacle = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            gapPosition - 320,
            obstacleType,
            { type: obstacleType }
        );
        
        // Create bottom obstacle
        const bottomObstacle = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            gapPosition + gapSize,
            obstacleType,
            { type: obstacleType }
        );
        
        // Flip bottom obstacle
        bottomObstacle.flipY = true;
        
        // Add to group
        this.obstacles.add(topObstacle);
        this.obstacles.add(bottomObstacle);
    }
    
    /**
     * Generate staggered pipes pattern
     * @param {number} level - Current game level
     * @param {Array} types - Available obstacle types
     */
    generateStaggeredPipes(level, types) {
        // Calculate gap size
        const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
        const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (level - 1), maxReduction);
        const gapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
        
        // Calculate positions for staggered pattern
        const positions = [
            Phaser.Math.Between(100, CONFIG.GAME_HEIGHT / 3),
            Phaser.Math.Between(CONFIG.GAME_HEIGHT * 2/3, CONFIG.GAME_HEIGHT - 100)
        ];
        
        // Random obstacle types
        const types1 = Phaser.Math.RND.pick(types);
        const types2 = Phaser.Math.RND.pick(types);
        
        // First pair
        const topObstacle1 = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            positions[0] - 320,
            types1,
            { type: types1 }
        );
        
        const bottomObstacle1 = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            positions[0] + gapSize,
            types1,
            { type: types1 }
        );
        bottomObstacle1.flipY = true;
        
        // Second pair (staggered)
        const topObstacle2 = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH + 300,
            positions[1] - 320,
            types2,
            { type: types2 }
        );
        
        const bottomObstacle2 = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH + 300,
            positions[1] + gapSize,
            types2,
            { type: types2 }
        );
        bottomObstacle2.flipY = true;
        
        // Add to group
        this.obstacles.add(topObstacle1);
        this.obstacles.add(bottomObstacle1);
        this.obstacles.add(topObstacle2);
        this.obstacles.add(bottomObstacle2);
    }
    
    /**
     * Generate wavy pattern of pipes
     * @param {number} level - Current game level
     * @param {Array} types - Available obstacle types
     */
    generateWavyPipes(level, types) {
        // Calculate gap size
        const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
        const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (level - 1), maxReduction);
        const gapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
        
        // Number of pipe pairs
        const pairCount = 3;
        
        // Generate wave parameters
        const waveHeight = CONFIG.GAME_HEIGHT / 3;
        const waveCenter = CONFIG.GAME_HEIGHT / 2;
        
        // Obstacle type
        const obstacleType = Phaser.Math.RND.pick(types);
        
        // Create pipe pairs along a sine wave
        for (let i = 0; i < pairCount; i++) {
            // Position along wave
            const xOffset = i * 250;
            const yOffset = Math.sin(i * Math.PI / 2) * waveHeight;
            const gapPosition = waveCenter + yOffset;
            
            // Create top obstacle
            const topObstacle = new Obstacle(
                this.scene,
                CONFIG.GAME_WIDTH + xOffset,
                gapPosition - 320,
                obstacleType,
                { type: obstacleType }
            );
            
            // Create bottom obstacle
            const bottomObstacle = new Obstacle(
                this.scene,
                CONFIG.GAME_WIDTH + xOffset,
                gapPosition + gapSize,
                obstacleType,
                { type: obstacleType }
            );
            bottomObstacle.flipY = true;
            
            // Add to group
            this.obstacles.add(topObstacle);
            this.obstacles.add(bottomObstacle);
        }
    }
    
    /**
     * Generate pattern with extra narrow gap
     * @param {number} level - Current game level
     * @param {Array} types - Available obstacle types
     */
    generateNarrowGap(level, types) {
        // Calculate extra narrow gap
        const maxReduction = CONFIG.OBSTACLE_GAP_DECREMENT * CONFIG.MAX_LEVEL;
        const levelReduction = Math.min(CONFIG.OBSTACLE_GAP_DECREMENT * (level - 1), maxReduction);
        const normalGapSize = CONFIG.MIN_OBSTACLE_GAP - levelReduction;
        const narrowGapSize = normalGapSize * 0.7; // 30% narrower
        
        // Position for the gap
        const gapPosition = Phaser.Math.Between(150, CONFIG.GAME_HEIGHT - 150 - narrowGapSize);
        
        // Choose obstacle type that's not spikes for fairness
        const safeTypes = types.filter(type => type !== 'spikes');
        const obstacleType = Phaser.Math.RND.pick(safeTypes.length > 0 ? safeTypes : ['pipe']);
        
        // Create top obstacle
        const topObstacle = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            gapPosition - 320,
            obstacleType,
            { type: obstacleType }
        );
        
        // Create bottom obstacle
        const bottomObstacle = new Obstacle(
            this.scene,
            CONFIG.GAME_WIDTH,
            gapPosition + narrowGapSize,
            obstacleType,
            { type: obstacleType }
        );
        bottomObstacle.flipY = true;
        
        // Add to group
        this.obstacles.add(topObstacle);
        this.obstacles.add(bottomObstacle);
        
        // Add a power-up in the middle of the gap to reward the risk
        if (Phaser.Math.RND.frac() < 0.7) { // 70% chance
            this.scene.events.emit('spawn_powerup', {
                x: CONFIG.GAME_WIDTH + 50, 
                y: gapPosition + (narrowGapSize / 2)
            });
        }
    }
    
    /**
     * Generate blockade pattern with small gaps
     * @param {number} level - Current game level
     * @param {Array} types - Available obstacle types
     */
    generateBlockade(level, types) {
        // Divide screen into sections
        const sections = 5;
        const sectionHeight = CONFIG.GAME_HEIGHT / sections;
        
        // Number of gaps to leave open (based on level)
        const openings = Math.max(2, 4 - Math.floor(level / 3));
        
        // Choose which sections will have gaps
        const openSections = [];
        while (openSections.length < openings) {
            const section = Phaser.Math.Between(0, sections - 1);
            if (!openSections.includes(section)) {
                openSections.push(section);
            }
        }
        
        // Create obstacles for all sections except the open ones
        for (let i = 0; i < sections; i++) {
            if (!openSections.includes(i)) {
                // Choose obstacle type
                const obstacleType = Phaser.Math.RND.pick(types);
                
                // Create obstacle in this section
                const obstacle = new Obstacle(
                    this.scene,
                    CONFIG.GAME_WIDTH,
                    i * sectionHeight + sectionHeight / 2,
                    obstacleType,
                    { type: obstacleType }
                );
                
                // Scale to section size
                obstacle.displayHeight = sectionHeight * 0.8;
                
                // Add to group
                this.obstacles.add(obstacle);
            } else {
                // Add a power-up in some of the open sections
                if (Phaser.Math.RND.frac() < 0.4) { // 40% chance
                    this.scene.events.emit('spawn_powerup', {
                        x: CONFIG.GAME_WIDTH + Phaser.Math.Between(0, 100),
                        y: i * sectionHeight + sectionHeight / 2
                    });
                }
            }
        }
    }
}