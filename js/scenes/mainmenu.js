/**
 * MainMenuScene
 * The main menu for the game
 */
class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }
    
    create() {
        // Background
        const bgIndex = Phaser.Math.Between(0, CONFIG.BACKGROUNDS.length - 1);
        const bgTexture = CONFIG.BACKGROUNDS[bgIndex].texture;
        this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, bgTexture)
            .setOrigin(0, 0)
            .setScrollFactor(0);
            
        // Add some depth to the menu by making the background scroll
        this.bgScrollSpeed = 0.5;
        
        // Add game title
        this.title = this.add.image(CONFIG.GAME_WIDTH / 2, 120, 'title')
            .setScale(0.8);
            
        // Animate the title for visual appeal
        this.tweens.add({
            targets: this.title,
            y: 130,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Create main menu buttons
        this.createMenuButtons();
        
        // Add decorative birds flying around
        this.createDecorativeBirds();
        
        // Play menu music
        this.sound.play('music-menu', {
            loop: true,
            volume: 0.7
        });
        
        // Check for existing user authentication at startup
        this.checkUserAuth();
    }
    
    update() {
        // Scroll the background for visual effect
        this.bg.tilePositionX += this.bgScrollSpeed;
        
        // Update decorative birds
        this.decorativeBirds.getChildren().forEach(bird => {
            // Move birds
            bird.x += bird.speedX;
            bird.y += Math.sin(bird.x / 100) * 0.5;
            
            // Loop birds back when they leave the screen
            if (bird.x > CONFIG.GAME_WIDTH + 50) {
                bird.x = -50;
                bird.y = Phaser.Math.Between(50, CONFIG.GAME_HEIGHT - 100);
            }
        });
    }
    
    /**
     * Create menu buttons
     */
    createMenuButtons() {
        // Container for all menu items for easier positioning
        this.menuContainer = this.add.container(CONFIG.GAME_WIDTH / 2, 250);
        
        // Play button
        this.playButton = this.add.image(0, 0, 'button')
            .setInteractive()
            .on('pointerdown', this.onPlayClicked, this);
            
        // Play text
        this.playText = this.add.text(0, 0, 'Play Game', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Multiplayer button
        this.multiplayerButton = this.add.image(0, 80, 'button')
            .setInteractive()
            .on('pointerdown', this.onMultiplayerClicked, this);
            
        // Multiplayer text
        this.multiplayerText = this.add.text(0, 80, 'Multiplayer', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Leaderboard button
        this.leaderboardButton = this.add.image(0, 160, 'button')
            .setInteractive()
            .on('pointerdown', this.onLeaderboardClicked, this);
            
        // Leaderboard text
        this.leaderboardText = this.add.text(0, 160, 'Leaderboard', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add all buttons to the container
        this.menuContainer.add([
            this.playButton, 
            this.playText,
            this.multiplayerButton, 
            this.multiplayerText,
            this.leaderboardButton, 
            this.leaderboardText
        ]);
        
        // Add button hover effects
        this.addButtonEffects(this.playButton);
        this.addButtonEffects(this.multiplayerButton);
        this.addButtonEffects(this.leaderboardButton);
    }
    
    /**
     * Add hover and click effects to a button
     * @param {Phaser.GameObjects.Image} button - The button to add effects to
     */
    addButtonEffects(button) {
        button.on('pointerover', () => {
            this.tweens.add({
                targets: button,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100
            });
        });
        
        button.on('pointerout', () => {
            this.tweens.add({
                targets: button,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });
        
        button.on('pointerdown', () => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50,
                yoyo: true
            });
        });
    }
    
    /**
     * Create decorative birds in the background
     */
    createDecorativeBirds() {
        this.decorativeBirds = this.add.group();
        
        // Create several birds at random positions
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(-50, CONFIG.GAME_WIDTH);
            const y = Phaser.Math.Between(50, CONFIG.GAME_HEIGHT - 100);
            
            // Randomly choose a bird texture
            const characterIndex = Phaser.Math.Between(0, CONFIG.CHARACTERS.length - 1);
            const birdTexture = CONFIG.CHARACTERS[characterIndex].texture;
            
            const bird = this.add.sprite(x, y, birdTexture, 0);
            
            // Random movement speed
            bird.speedX = Phaser.Math.FloatBetween(0.5, 2);
            
            // Play flying animation
            this.anims.create({
                key: `fly-${birdTexture}-${i}`,
                frames: this.anims.generateFrameNumbers(birdTexture, { start: 0, end: 2 }),
                frameRate: 10,
                repeat: -1
            });
            
            bird.play(`fly-${birdTexture}-${i}`);
            
            this.decorativeBirds.add(bird);
        }
    }
    
    /**
     * Check user authentication status
     */
    checkUserAuth() {
        if (isAuthenticated()) {
            // Show user info if logged in
            this.createUserInfoPanel();
        } else {
            // Show login button if not logged in
            this.createLoginButton();
        }
    }
    
    /**
     * Create user info panel
     */
    createUserInfoPanel() {
        const user = getCurrentUser();
        
        // Container for user info
        this.userPanel = this.add.container(CONFIG.GAME_WIDTH - 150, 50);
        
        // Background
        const bg = this.add.rectangle(0, 0, 280, 80, 0x000000, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff);
            
        // User name
        const nameText = this.add.text(0, -15, user.displayName, {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Log out button
        const logoutText = this.add.text(0, 15, 'Log Out', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ff9999'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            signOut().then(() => {
                this.userPanel.destroy();
                this.createLoginButton();
            });
        });
        
        this.userPanel.add([bg, nameText, logoutText]);
    }
    
    /**
     * Create login button
     */
    createLoginButton() {
        // Container for login button
        this.loginPanel = this.add.container(CONFIG.GAME_WIDTH - 100, 50);
        
        // Background
        const bg = this.add.rectangle(0, 0, 180, 50, 0x000000, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff);
            
        // Login text
        const loginText = this.add.text(0, 0, 'Login / Register', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            showAuthModal();
        });
        
        this.loginPanel.add([bg, loginText]);
    }
    
    /**
     * Handle play button click
     */
    onPlayClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Either show character selection or auth modal
        if (isAuthenticated() || localStorage.getItem('guestSession')) {
            this.scene.start('CharacterSelectScene');
        } else {
            showAuthModal();
        }
    }
    
    /**
     * Handle multiplayer button click
     */
    onMultiplayerClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Check if user is authenticated
        if (isAuthenticated()) {
            this.scene.start('MultiplayerScene');
        } else {
            // Must be logged in for multiplayer
            alert('You need to log in to play multiplayer games.');
            showAuthModal();
        }
    }
    
    /**
     * Handle leaderboard button click
     */
    onLeaderboardClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Show leaderboard scene
        this.scene.start('LeaderboardScene');
    }
}