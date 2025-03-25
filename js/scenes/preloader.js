/**
 * PreloaderScene
 * Handles loading of all game assets
 */
class PreloaderScene extends Phaser.Scene {
    constructor() {
        super('PreloaderScene');
    }
    
    preload() {
        // Display loading progress
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Loading background
        this.add.rectangle(width/2, height/2, width, height, 0x123456);
        
        // Create loading bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width/2 - 160, height/2 - 25, 320, 50);
        
        // Loading text
        const loadingText = this.make.text({
            x: width/2,
            y: height/2 - 50,
            text: 'Loading...',
            style: {
                font: '20px Arial',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        // Percentage text
        const percentText = this.make.text({
            x: width/2,
            y: height/2,
            text: '0%',
            style: {
                font: '18px Arial',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);
        
        // Asset count text
        const assetText = this.make.text({
            x: width/2,
            y: height/2 + 50,
            text: '',
            style: {
                font: '18px Arial',
                fill: '#ffffff'
            }
        });
        assetText.setOrigin(0.5, 0.5);
        
        // Update the loading bar as assets are loaded
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x3587e2, 1);
            progressBar.fillRect(width/2 - 150, height/2 - 15, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
            
            // Update external loading bar if available
            if (typeof updateLoadingProgress === 'function') {
                updateLoadingProgress(value);
            }
        });
        
        this.load.on('fileprogress', (file) => {
            assetText.setText('Loading asset: ' + file.key);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            assetText.destroy();
            
            // Notify the game that loading is complete
            this.game.events.emit('ready');
        });
        
        // Load all game assets
        this.loadAssets();
    }
    
    /**
     * Load all game assets
     */
    loadAssets() {
        const assetPath = CONFIG.ASSET_PATH;
        
        // Load background images
        this.load.image('bg-forest', `${assetPath}backgrounds/forest.png`);
        this.load.image('bg-cave', `${assetPath}backgrounds/cave.png`);
        this.load.image('bg-sky', `${assetPath}backgrounds/sky.png`);
        this.load.image('bg-mountain', `${assetPath}backgrounds/mountain.png`);
        this.load.image('bg-underwater', `${assetPath}backgrounds/underwater.png`);
        this.load.image('bg-castle', `${assetPath}backgrounds/castle.png`);
        
        // Load bird character sprites (with animation frames)
        this.load.spritesheet('bird-blue', `${assetPath}characters/blue_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('bird-red', `${assetPath}characters/red_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('bird-yellow', `${assetPath}characters/yellow_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('bird-purple', `${assetPath}characters/purple_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('bird-green', `${assetPath}characters/green_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        this.load.spritesheet('bird-rainbow', `${assetPath}characters/rainbow_bird.png`, { 
            frameWidth: 32, 
            frameHeight: 32 
        });
        
        // Load obstacle sprites
        this.load.image('pipe', `${assetPath}obstacles/pipe.png`);
        this.load.image('rock', `${assetPath}obstacles/rock.png`);
        this.load.image('spikes', `${assetPath}obstacles/spikes.png`);
        this.load.image('brick', `${assetPath}obstacles/brick.png`);
        
        // Load enemy sprites
        this.load.spritesheet('turtle', `${assetPath}enemies/turtle.png`, {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('goomba', `${assetPath}enemies/goomba.png`, {
            frameWidth: 32,
            frameHeight: 32
        });
        
        // Load power-up sprites
        this.load.image('mushroom', `${assetPath}powerups/mushroom.png`);
        this.load.image('flower', `${assetPath}powerups/flower.png`);
        this.load.image('star', `${assetPath}powerups/star.png`);
        this.load.image('coin', `${assetPath}powerups/coin.png`);
        
        // Load UI elements
        this.load.image('title', `${assetPath}ui/title.png`);
        this.load.image('button', `${assetPath}ui/button.png`);
        this.load.image('mushroom-icon', `${assetPath}ui/mushroom_icon.png`);
        this.load.image('flower-icon', `${assetPath}ui/flower_icon.png`);
        
        // Load effect sprites
        this.load.image('particle', `${assetPath}effects/particle.png`);
        this.load.image('fireball', `${assetPath}effects/fireball.png`);
        this.load.spritesheet('impact', `${assetPath}effects/impact.png`, {
            frameWidth: 32,
            frameHeight: 32
        });
        
        // Load audio files
        this.load.audio('music-menu', `${assetPath}audio/menu_music.mp3`);
        this.load.audio('music-gameplay', `${assetPath}audio/gameplay_music.mp3`);
        this.load.audio('sfx-flap', `${assetPath}audio/flap.wav`);
        this.load.audio('sfx-powerup', `${assetPath}audio/powerup.wav`);
        this.load.audio('sfx-fireball', `${assetPath}audio/fireball.wav`);
        this.load.audio('sfx-hit', `${assetPath}audio/hit.wav`);
        this.load.audio('sfx-break', `${assetPath}audio/break.wav`);
        this.load.audio('sfx-stomp', `${assetPath}audio/stomp.wav`);
        this.load.audio('sfx-levelup', `${assetPath}audio/levelup.wav`);
        this.load.audio('sfx-gameover', `${assetPath}audio/gameover.wav`);
        this.load.audio('sfx-hit-obstacle', `${assetPath}audio/hit_obstacle.wav`);
        this.load.audio('sfx-coin', `${assetPath}audio/coin.wav`);
    }
    
    create() {
        // Create animations that will be used across the game
        this.createAnimations();
        
        // Transition to the main menu
        this.scene.start('MainMenuScene');
    }
    
    /**
     * Create global animations
     */
    createAnimations() {
        // Impact animation
        this.anims.create({
            key: 'impact-anim',
            frames: this.anims.generateFrameNumbers('impact', { start: 0, end: 5 }),
            frameRate: 20,
            repeat: 0
        });
        
        // Hurt animations for each bird
        CONFIG.CHARACTERS.forEach(character => {
            this.anims.create({
                key: `${character.texture}-hurt`,
                frames: [ { key: character.texture, frame: 2 } ],
                frameRate: 20
            });
        });
    }
}