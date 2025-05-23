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
        // Initialize state variables
        this.isTransitioning = false;
        this.selectedCharacter = null;
        
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
        
        // Listen for global events if using event system
        if (window.gameEvents) {
            this.sceneListener = window.gameEvents.on('scene:restart', this.resetScene, this);
        }
        
        // Debug text (always show to help diagnose issues)
        this.debugText = this.add.text(10, CONFIG.GAME_HEIGHT - 20, 'Character Selection Debug', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffff00',
            backgroundColor: '#333333'
        }).setDepth(100);
    }
    
    update() {
        // Scroll background
        this.bg.tilePositionX += this.bgScrollSpeed;
        
        // Update character previews
        if (this.characterPreviews) {
            this.characterPreviews.getChildren().forEach(preview => {
                if (preview.previewBird) {
                    // Add some idle animation to the birds
                    preview.previewBird.y = preview.previewBirdBaseY + Math.sin(this.time.now / 300 + preview.index) * 3;
                }
            });
        }
        
        // Always update debug text to help diagnose issues
        if (this.debugText) {
            this.debugText.setText(`Selected: ${this.selectedCharacter || 'None'} | Transitioning: ${this.isTransitioning} | Start Enabled: ${this.startButton && !this.startButton.tintTopLeft ? 'Yes' : 'No'}`);
        }
    }
    
    /**
     * Create the character selection grid
     */
    createCharacterGrid() {
        this.characterPreviews = this.add.group();
        
        // Ensure CONFIG.CHARACTERS exists and has elements
        if (!CONFIG.CHARACTERS || CONFIG.CHARACTERS.length === 0) {
            console.error('CONFIG.CHARACTERS is missing or empty!');
            // Create a default character if none exist
            CONFIG.CHARACTERS = [
                { id: 'blue', name: 'Blue Bird', texture: 'bird-blue', flightPower: 1.0 },
                { id: 'red', name: 'Red Bird', texture: 'bird-red', flightPower: 1.2 }
            ];
        }
        
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
                .setStrokeStyle(2, 0xffffff)
                .setInteractive() // Make it clickable directly
                .on('pointerdown', () => {
                    this.selectCharacter(character.id, preview);
                })
                .on('pointerover', () => {
                    if (this.selectedCharacter !== character.id) {
                        bg.setFillStyle(0x3498db, 0.3);
                    }
                })
                .on('pointerout', () => {
                    if (this.selectedCharacter !== character.id) {
                        bg.setFillStyle(0x000000, 0.5);
                    }
                });
                
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
            
            // Store base Y position for animation
            preview.previewBirdBaseY = 0;
            
            // Create flying animation
            const animKey = `select-fly-${character.texture}-${index}`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            
            previewBird.play(animKey);
            
            // Character stats
            const statsText = this.add.text(0, 50, `Flight Power: ${character.flightPower.toFixed(1)}`, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Add all elements to the preview container
            preview.add([bg, nameText, previewBird, statsText]);
            
            // Store references for easier access
            preview.previewBird = previewBird;
            preview.background = bg; // Reference to background for color changes
            
            // Add to group for management
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
        
        // Store the selected character ID in localStorage to persist it
        try {
            localStorage.setItem('selectedCharacter', characterId);
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
        
        // If we have active tweens, stop them first to prevent conflicts
        this.characterPreviews.getChildren().forEach(p => {
            if (p.activeTween) {
                p.activeTween.stop();
                p.activeTween = null;
            }
        });
        
        // Update visuals for all characters
        this.characterPreviews.getChildren().forEach(p => {
            // Get the background rectangle
            const bg = p.getAt(0);
            
            if (p === preview) {
                // Selected character
                bg.setFillStyle(0x3498db, 0.7);
                bg.setStrokeStyle(4, 0x2ecc71);
                
                // Scale up the selected character - store tween reference
                if (p.previewBird) {
                    p.activeTween = this.tweens.add({
                        targets: p.previewBird,
                        scaleX: 2.5,
                        scaleY: 2.5,
                        duration: 200,
                        ease: 'Back.easeOut'
                    });
                }
            } else {
                // Unselected characters
                bg.setFillStyle(0x000000, 0.5);
                bg.setStrokeStyle(2, 0xffffff);
                
                // Reset scale for unselected characters - store tween reference
                if (p.previewBird) {
                    p.activeTween = this.tweens.add({
                        targets: p.previewBird,
                        scaleX: 2,
                        scaleY: 2,
                        duration: 200,
                        ease: 'Back.easeOut'
                    });
                }
            }
        });
        
        // IMPORTANT: Ensure the start button is enabled and properly visible
        if (this.startButton) {
            this.startButton.clearTint();
            this.startButton.setInteractive();
            
            // Make start button more noticeable with a pulse animation
            this.tweens.add({
                targets: this.startButton,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 300,
                yoyo: true,
                repeat: 2
            });
        }
        
        if (this.startText) {
            this.startText.setColor('#ffffff');
        }
        
        // Log selection for debugging
        console.log(`Character selected: ${characterId}`);
        
        // Emit character selected event if using global events
        if (window.gameEvents) {
            window.gameEvents.emit('player:characterSelected', characterId);
        }
    }
    
    /**
     * Create the start button
     */
    createStartButton() {
        // Determine y-position based on grid size
        const buttonY = 180 + (Math.ceil(CONFIG.CHARACTERS.length / 3) * 220) + 40;
        
        // Ensure button is visible on screen
        const safeButtonY = Math.min(buttonY, CONFIG.GAME_HEIGHT - 80);
        
        // Button background
        this.startButton = this.add.image(CONFIG.GAME_WIDTH / 2, safeButtonY, 'button')
            .setInteractive()
            .setTint(0x999999) // Disabled initially
            .on('pointerdown', () => {
                // Always log when button is clicked
                console.log('Start button clicked. Selected character:', this.selectedCharacter);
                
                if (this.selectedCharacter) {
                    this.startGame();
                } else {
                    // Prompt user to select a character
                    this.showSelectPrompt();
                }
            })
            .on('pointerup', () => {
                // Sometimes pointerdown doesn't register correctly, try with pointerup too
                if (this.selectedCharacter && !this.isTransitioning) {
                    console.log('Start button pointerup. Starting game...');
                    this.startGame();
                }
            });
            
        // Button text
        this.startText = this.add.text(CONFIG.GAME_WIDTH / 2, safeButtonY, 'START GAME', {
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
        
        // Check if there's a previously selected character in localStorage
        try {
            const savedCharacter = localStorage.getItem('selectedCharacter');
            if (savedCharacter) {
                // Find the preview container for this character
                if (this.characterPreviews) {
                    const previews = this.characterPreviews.getChildren();
                    for (let i = 0; i < previews.length; i++) {
                        const characterId = CONFIG.CHARACTERS[previews[i].index].id;
                        if (characterId === savedCharacter) {
                            // Auto-select the previously selected character
                            this.selectCharacter(characterId, previews[i]);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not access localStorage:', e);
        }
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
                // Prevent multiple transitions
                if (this.isTransitioning) return;
                this.isTransitioning = true;
                
                // Stop any active sounds
                this.sound.stopByKey('sfx-powerup');
                
                // Start main menu scene with transition
                this.cameras.main.fade(300, 0, 0, 0, false, (camera, progress) => {
                    if (progress === 1) {
                        this.scene.start('MainMenuScene');
                    }
                });
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
        console.log('startGame method called');
        
        // Extra safety check - make sure character is selected
        if (!this.selectedCharacter) {
            console.error('No character selected!');
            this.showSelectPrompt();
            return;
        }
        
        // Prevent double-clicking the start button
        if (this.isTransitioning) {
            console.log('Already transitioning, ignoring duplicate start request');
            return;
        }
        
        console.log('Starting game with character:', this.selectedCharacter);
        this.isTransitioning = true;
        
        // Play start sound
        this.sound.play('sfx-levelup', { volume: 0.7 });
        
        // IMPORTANT: Kill all tweens to prevent memory leaks
        this.tweens.killAll();
        
        // Ensure GameScene exists
        if (!this.scene.get('GameScene')) {
            console.error('GameScene not found! Creating a fallback scene.');
            this.scene.add('GameScene', {
                init: function(data) {
                    this.characterId = data.characterId;
                },
                create: function() {
                    this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 
                        `Game started with ${this.characterId}!\nGame implementation missing.`, {
                        fontFamily: 'Arial', 
                        fontSize: '24px',
                        color: '#ffffff',
                        align: 'center'
                    }).setOrigin(0.5);
                    
                    this.input.on('pointerdown', () => {
                        this.scene.start('MainMenuScene');
                    });
                }
            });
        }
        
        // Transition effect
        this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                // Stop menu music
                this.sound.stopByKey('music-menu');
                
                // Start game with selected character
                try {
                    this.scene.start('GameScene', { 
                        characterId: this.selectedCharacter
                    });
                    console.log('GameScene started successfully');
                } catch (error) {
                    console.error('Error starting GameScene:', error);
                    // Fallback to main menu if game scene fails
                    this.scene.start('MainMenuScene');
                }
                
                // IMPORTANT: Shutdown this scene completely
                this.scene.stop();
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
    
    /**
     * Reset the scene
     */
    resetScene() {
        this.selectedCharacter = null;
        this.isTransitioning = false;
        
        // Reset button state
        if (this.startButton) {
            this.startButton.setTint(0x999999);
        }
        
        if (this.startText) {
            this.startText.setColor('#aaaaaa');
        }
        
        // Reset character previews
        if (this.characterPreviews) {
            this.characterPreviews.getChildren().forEach(preview => {
                const bg = preview.getAt(0);
                bg.setFillStyle(0x000000, 0.5);
                bg.setStrokeStyle(2, 0xffffff);
                
                if (preview.previewBird) {
                    preview.previewBird.setScale(2);
                }
                
                if (preview.activeTween) {
                    preview.activeTween.stop();
                    preview.activeTween = null;
                }
            });
        }
    }
    
    /**
     * Clean up resources when scene is shut down
     */
    shutdown() {
        // Kill all tweens
        this.tweens.killAll();
        
        // Remove all event listeners
        this.input.keyboard.shutdown();
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Clear all containers
        if (this.characterPreviews) {
            this.characterPreviews.clear(true, true);
        }
        
        // Remove global event listeners if applicable
        if (window.gameEvents && this.sceneListener) {
            window.gameEvents.off('scene:restart', this.resetScene, this);
        }
        
        // Call parent shutdown
        super.shutdown();
    }
}