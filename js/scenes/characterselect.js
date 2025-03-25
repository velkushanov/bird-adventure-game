/**
 * CharacterSelectScene
 * Allows the player to select a bird character
 */
class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelectScene');
        this.selectedCharacter = null;
    }
    
    create() {
        // Background
        this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 'bg-sky')
            .setOrigin(0, 0)
            .setScrollFactor(0);
            
        // Add parallax effect with slow scrolling
        this.bgScrollSpeed = 0.2;
        
        // Add title
        this.title = this.add.text(CONFIG.GAME_WIDTH / 2, 80, 'SELECT YOUR BIRD', {
            fontFamily: 'Arial',
            fontSize: '40px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Create character selection grid
        this.createCharacterGrid();
        
        // Create start button
        this.createStartButton();
        
        // Create back button
        this.createBackButton();
        
        // Play background music if not already playing
        if (!this.sound.get('music-menu')) {
            this.sound.play('music-menu', {
                loop: true,
                volume: 0.7
            });
        }
    }
    
    update() {
        // Scroll background
        this.bg.tilePositionX += this.bgScrollSpeed;
        
        // Update character previews if needed
        if (this.characterPreviews) {
            this.characterPreviews.getChildren().forEach(preview => {
                if (preview.previewBird) {
                    // Add some idle animation to the birds
                    preview.previewBird.y += Math.sin(this.time.now / 300 + preview.index) * 0.5;
                }
            });
        }
    }
    
    /**
     * Create the character selection grid
     */
    createCharacterGrid() {
        this.characterPreviews = this.add.group();
        
        // Calculate grid layout
        const gridWidth = 3;
        const gridHeight = Math.ceil(CONFIG.CHARACTERS.length / gridWidth);
        const cellWidth = 200;
        const cellHeight = 220;
        const startX = (CONFIG.GAME_WIDTH - (gridWidth * cellWidth)) / 2 + cellWidth / 2;
        const startY = 180;
        
        // Create character options
        CONFIG.CHARACTERS.forEach((character, index) => {
            const col = index % gridWidth;
            const row = Math.floor(index / gridWidth);
            const x = startX + col * cellWidth;
            const y = startY + row * cellHeight;
            
            // Create preview container
            const preview = this.add.container(x, y);
            preview.index = index;
            
            // Background panel
            const bg = this.add.rectangle(0, 0, cellWidth - 20, cellHeight - 20, 0x000000, 0.5)
                .setOrigin(0.5)
                .setStrokeStyle(2, 0xffffff);
                
            // Character name
            const nameText = this.add.text(0, -70, character.name, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Preview bird
            const previewBird = this.add.sprite(0, 0, character.texture, 0)
                .setScale(2);
            
            // Play flying animation
            this.anims.create({
                key: `select-fly-${character.texture}`,
                frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
                frameRate: 10,
                repeat: -1
            });
            
            previewBird.play(`select-fly-${character.texture}`);
            
            // Character stats
            const statsText = this.add.text(0, 50, `Flight Power: ${character.flightPower.toFixed(1)}`, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Add all elements to the preview container
            preview.add([bg, nameText, previewBird, statsText]);
            
            // Store reference to the bird
            preview.previewBird = previewBird;
            
            // Make clickable
            bg.setInteractive();
            bg.on('pointerdown', () => {
                this.selectCharacter(character.id, preview);
            });
            
            // Add to group
            this.characterPreviews.add(preview);
        });
    }
    
    /**
     * Select a character
     * @param {string} characterId - The ID of the selected character
     * @param {Phaser.GameObjects.Container} preview - The preview container
     */
    selectCharacter(characterId, preview) {
        // Play select sound
        this.sound.play('sfx-powerup', { volume: 0.5 });
        
        // Update selected character
        this.selectedCharacter = characterId;
        
        // Update visuals for all characters
        this.characterPreviews.getChildren().forEach(p => {
            // Get the background rectangle
            const bg = p.getAt(0);
            
            if (p === preview) {
                // Selected character
                bg.setFillStyle(0x3498db, 0.7);
                bg.setStrokeStyle(4, 0x2ecc71);
                
                // Scale up the selected character
                this.tweens.add({
                    targets: p.previewBird,
                    scaleX: 2.5,
                    scaleY: 2.5,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            } else {
                // Unselected characters
                bg.setFillStyle(0x000000, 0.5);
                bg.setStrokeStyle(2, 0xffffff);
                
                // Reset scale for unselected characters
                this.tweens.add({
                    targets: p.previewBird,
                    scaleX: 2,
                    scaleY: 2,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }
        });
        
        // Enable start button
        this.startButton.setTint(0xffffff);
        this.startText.setColor('#ffffff');
    }
    
    /**
     * Create the start button
     */
    createStartButton() {
        // Determine y-position based on grid size
        const buttonY = 180 + (Math.ceil(CONFIG.CHARACTERS.length / 3) * 220) + 40;
        
        // Button background
        this.startButton = this.add.image(CONFIG.GAME_WIDTH / 2, buttonY, 'button')
            .setInteractive()
            .setTint(0x999999) // Disabled initially
            .on('pointerdown', () => {
                if (this.selectedCharacter) {
                    this.startGame();
                } else {
                    // Prompt user to select a character
                    this.showSelectPrompt();
                }
            });
            
        // Button text
        this.startText = this.add.text(CONFIG.GAME_WIDTH / 2, buttonY, 'START GAME', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#aaaaaa', // Disabled initially
            align: 'center'
        }).setOrigin(0.5);
        
        // Add hover effect
        this.startButton.on('pointerover', () => {
            if (this.selectedCharacter) {
                this.tweens.add({
                    targets: this.startButton,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 100
                });
            }
        });
        
        this.startButton.on('pointerout', () => {
            this.tweens.add({
                targets: this.startButton,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });
    }
    
    /**
     * Create the back button to return to main menu
     */
    createBackButton() {
        // Button background
        this.backButton = this.add.image(80, 40, 'button')
            .setScale(0.6)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MainMenuScene');
            });
            
        // Button text
        this.backText = this.add.text(80, 40, 'BACK', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add hover effect
        this.backButton.on('pointerover', () => {
            this.tweens.add({
                targets: this.backButton,
                scaleX: 0.65,
                scaleY: 0.65,
                duration: 100
            });
        });
        
        this.backButton.on('pointerout', () => {
            this.tweens.add({
                targets: this.backButton,
                scaleX: 0.6,
                scaleY: 0.6,
                duration: 100
            });
        });
    }
    
    /**
     * Start the game with selected character
     */
    startGame() {
        if (!this.selectedCharacter) return;
        
        // Play start sound
        this.sound.play('sfx-levelup', { volume: 0.7 });
        
        // Transition effect
        this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                // Stop menu music
                this.sound.stopByKey('music-menu');
                
                // Start game with selected character
                this.scene.start('GameScene', { 
                    characterId: this.selectedCharacter
                });
            }
        });
    }
    
    /**
     * Show prompt to select a character
     */
    showSelectPrompt() {
        // Create prompt text with bounce effect
        const promptText = this.add.text(CONFIG.GAME_WIDTH / 2, 500, 'Please select a character!', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ff0000',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Add bounce animation
        this.tweens.add({
            targets: promptText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                // Remove prompt after animation
                this.tweens.add({
                    targets: promptText,
                    alpha: 0,
                    y: '+=20',
                    duration: 500,
                    delay: 1000,
                    onComplete: () => {
                        promptText.destroy();
                    }
                });
            }
        });
    }
}