/**
 * Main.js - Entry point for the game
 * Initializes the Phaser game and manages the game lifecycle
 */

// Global variables
let gameInstance = null;
let gameInitialized = false;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    initializeFirebase();
    
    // Start game initialization
    initGame();
    
    // Handle modal buttons
    setupModalButtons();
    
    // Handle window resizing
    window.addEventListener('resize', function() {
        if (gameInstance && gameInstance.scale) {
            gameInstance.scale.refresh();
        }
    });
    
    // Handle visibility change (for mobile browser tab switching)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set a timeout to check if the game is taking too long to load
    setTimeout(checkGameLoading, 15000); // 15 seconds
});

/**
 * Initialize the game
 */
function initGame() {
    // Set loading screen progress to 0
    document.querySelector('.progress').style.width = '0%';
    
    // Game configuration
    const gameConfig = {
        type: Phaser.AUTO,
        width: CONFIG.GAME_WIDTH,
        height: CONFIG.GAME_HEIGHT,
        backgroundColor: '#87CEEB',
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: CONFIG.GRAVITY },
                debug: CONFIG.DEBUG
            }
        },
        // Set all scenes
        scene: [
            BootScene,
            PreloaderScene, 
            MainMenuScene,
            CharacterSelectScene,
            GameScene,
            LeaderboardScene,
            MultiplayerScene
        ],
        // Scaling options
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        // Better performance settings for mobile
        render: {
            antialias: false,
            pixelArt: false,
            roundPixels: true
        },
        // Audio settings
        audio: {
            disableWebAudio: false,
            noAudio: false
        }
    };
    
    try {
        // Create and initialize the game
        gameInstance = new Phaser.Game(gameConfig);
        
        // Global game instance
        window.game = gameInstance;
        
        // Hide loading screen when game is ready
        gameInstance.events.once('ready', function() {
            document.getElementById('loading-screen').style.display = 'none';
            gameInitialized = true;
        });
        
        // Update progress bar during asset loading
        gameInstance.events.on('progress', function(value) {
            const progressBar = document.querySelector('.progress');
            if (progressBar) {
                progressBar.style.width = Math.floor(value * 100) + '%';
            }
        });
        
        // Game start time for diagnostics
        window.gameStartTime = Date.now();
        
        console.log('Game instance created successfully');
    } catch (error) {
        console.error('Error creating game instance:', error);
        showGameError('Failed to initialize game engine. Please try again later.');
    }
}

/**
 * Check if the game is taking too long to load
 */
function checkGameLoading() {
    if (!gameInitialized) {
        console.warn('Game is taking too long to load. Showing warning to user.');
        
        // Show a message to the user
        const loadingContent = document.querySelector('.loading-content');
        if (loadingContent) {
            const warningEl = document.createElement('p');
            warningEl.textContent = 'Game is taking longer than expected to load. Please wait or try refreshing the page.';
            warningEl.style.color = '#ffcc00';
            loadingContent.appendChild(warningEl);
            
            // Add refresh button
            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = 'Refresh Page';
            refreshBtn.onclick = function() {
                location.reload();
            };
            refreshBtn.style.margin = '10px';
            refreshBtn.style.padding = '8px 16px';
            loadingContent.appendChild(refreshBtn);
        }
    }
}

/**
 * Display error message when game fails to load
 * @param {string} message - Error message to display
 */
function showGameError(message) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Try Again</button>
            </div>
        `;
    }
}

/**
 * Handle when the browser tab visibility changes
 */
function handleVisibilityChange() {
    if (document.hidden) {
        // Tab is hidden, pause the game if it's running
        if (gameInstance && gameInstance.scene) {
            const activeScenes = gameInstance.scene.getScenes(true);
            activeScenes.forEach(scene => {
                // Only pause gameplay scene, not menus
                if (scene.scene.key === 'GameScene' && !scene.scene.isPaused()) {
                    scene.scene.pause();
                    // Mute audio
                    scene.sound.mute = true;
                }
            });
        }
    } else {
        // Tab is visible again, resume the game if it was paused
        if (gameInstance && gameInstance.scene) {
            const pausedScenes = gameInstance.scene.getScenes(false);
            pausedScenes.forEach(scene => {
                if (scene.scene.key === 'GameScene' && scene.scene.isPaused()) {
                    // Show a 3-2-1 countdown before resuming
                    showCountdown(scene, () => {
                        scene.scene.resume();
                        // Unmute audio
                        scene.sound.mute = false;
                    });
                }
            });
        }
    }
}

/**
 * Show countdown before resuming the game
 * @param {Phaser.Scene} scene - The scene to show countdown in
 * @param {Function} callback - Function to call when countdown finishes
 */
function showCountdown(scene, callback) {
    // Create a semi-transparent overlay
    const overlay = scene.add.rectangle(
        CONFIG.GAME_WIDTH / 2, 
        CONFIG.GAME_HEIGHT / 2,
        CONFIG.GAME_WIDTH,
        CONFIG.GAME_HEIGHT,
        0x000000,
        0.7
    );
    overlay.setDepth(1000);
    
    // Create countdown text
    const countdownText = scene.add.text(
        CONFIG.GAME_WIDTH / 2,
        CONFIG.GAME_HEIGHT / 2,
        '3',
        {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ffffff'
        }
    ).setOrigin(0.5);
    countdownText.setDepth(1001);
    
    // Start countdown
    let count = 3;
    const countdownTimer = scene.time.addEvent({
        delay: 1000,
        callback: () => {
            count--;
            
            if (count > 0) {
                countdownText.setText(count.toString());
            } else {
                countdownText.setText('Go!');
                
                // Clean up after a short delay
                scene.time.delayedCall(500, () => {
                    overlay.destroy();
                    countdownText.destroy();
                    
                    // Call the callback
                    if (callback) callback();
                });
            }
        },
        repeat: 3
    });
}

/**
 * Sets up all modal button interactions
 */
function setupModalButtons() {
    try {
        // Authentication modal
        const loginGoogleBtn = document.getElementById('login-google');
        if (loginGoogleBtn) {
            loginGoogleBtn.addEventListener('click', function() {
                loginWithGoogle();
            });
        }
        
        const loginFacebookBtn = document.getElementById('login-facebook');
        if (loginFacebookBtn) {
            loginFacebookBtn.addEventListener('click', function() {
                loginWithFacebook();
            });
        }
        
        const loginInstagramBtn = document.getElementById('login-instagram');
        if (loginInstagramBtn) {
            loginInstagramBtn.addEventListener('click', function() {
                loginWithInstagram();
            });
        }
        
        const playAsGuestBtn = document.getElementById('play-as-guest');
        if (playAsGuestBtn) {
            playAsGuestBtn.addEventListener('click', function() {
                playAsGuest();
            });
        }
        
        // Character selection modal
        const startGameBtn = document.getElementById('start-game');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', function() {
                const selected = document.querySelector('.character-option.selected');
                if (selected) {
                    const characterId = selected.getAttribute('data-id');
                    startGame(characterId);
                    document.getElementById('character-modal').style.display = 'none';
                } else {
                    alert('Please select a character');
                }
            });
        }
        
        // Game over modal
        const restartGameBtn = document.getElementById('restart-game');
        if (restartGameBtn) {
            restartGameBtn.addEventListener('click', function() {
                restartGame();
                document.getElementById('gameover-modal').style.display = 'none';
            });
        }
        
        const viewLeaderboardBtn = document.getElementById('view-leaderboard');
        if (viewLeaderboardBtn) {
            viewLeaderboardBtn.addEventListener('click', function() {
                viewLeaderboard();
                document.getElementById('gameover-modal').style.display = 'none';
            });
        }
        
        // Close buttons
        document.querySelectorAll('.close').forEach(function(closeBtn) {
            closeBtn.addEventListener('click', function() {
                this.parentElement.parentElement.style.display = 'none';
            });
        });
    } catch (error) {
        console.error('Error setting up modal buttons:', error);
    }
}

/**
 * Dynamically populates the character selection grid
 */
function populateCharacterSelection() {
    const grid = document.querySelector('.character-grid');
    if (!grid) return;
    
    grid.innerHTML = ''; // Clear existing content
    
    // Add each character option from CONFIG
    if (CONFIG && CONFIG.CHARACTERS) {
        CONFIG.CHARACTERS.forEach(character => {
            const charDiv = document.createElement('div');
            charDiv.className = 'character-option';
            charDiv.setAttribute('data-id', character.id);
            
            // Create character preview with proper path
            const img = document.createElement('div');
            img.className = 'character-image';
            img.style.backgroundImage = `url(${CONFIG.ASSET_PATH}characters/${character.texture}.png)`;
            
            const name = document.createElement('div');
            name.className = 'character-name';
            name.textContent = character.name;
            
            charDiv.appendChild(img);
            charDiv.appendChild(name);
            
            // Add selection functionality
            charDiv.addEventListener('click', function() {
                // Remove selected class from all options
                document.querySelectorAll('.character-option').forEach(element => {
                    element.classList.remove('selected');
                });
                
                // Add selected class to clicked option
                this.classList.add('selected');
            });
            
            grid.appendChild(charDiv);
        });
    } else {
        console.error('CONFIG.CHARACTERS not available for character selection');
        
        // Fallback if CONFIG is not available
        const fallbackMessage = document.createElement('div');
        fallbackMessage.textContent = 'Character data not available. Please refresh the page.';
        fallbackMessage.style.color = 'white';
        fallbackMessage.style.padding = '20px';
        grid.appendChild(fallbackMessage);
    }
}

/**
 * Shows the authentication modal
 */
function showAuthModal() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.style.display = 'block';
    } else {
        console.error('Auth modal element not found');
    }
}

/**
 * Shows the character selection modal
 */
function showCharacterModal() {
    try {
        populateCharacterSelection();
        const characterModal = document.getElementById('character-modal');
        if (characterModal) {
            // First hide any other potentially open modals
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
            
            // Then show character modal
            characterModal.style.display = 'block';
        } else {
            console.error('Character modal element not found');
        }
    } catch (error) {
        console.error('Error showing character modal:', error);
    }
}

/**
 * Shows the game over modal with final score
 * @param {number} score - The player's final score
 * @param {number} highScore - The player's high score
 */
function showGameOverModal(score, highScore) {
    try {
        // Update score displays
        const finalScoreEl = document.getElementById('final-score');
        const highScoreEl = document.getElementById('high-score');
        
        if (finalScoreEl) finalScoreEl.textContent = `Your Score: ${score}`;
        if (highScoreEl) highScoreEl.textContent = `Your High Score: ${highScore}`;
        
        // Update leaderboard preview
        getTopScores(5).then(scores => {
            const leaderboardList = document.getElementById('leaderboard-list');
            if (!leaderboardList) return;
            
            leaderboardList.innerHTML = '';
            
            if (scores && scores.length > 0) {
                scores.forEach((entry, index) => {
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    
                    const rank = document.createElement('div');
                    rank.className = 'rank';
                    rank.textContent = `#${index + 1}`;
                    
                    const name = document.createElement('div');
                    name.className = 'player-name';
                    name.textContent = entry.name || 'Unknown';
                    
                    const scoreElement = document.createElement('div');
                    scoreElement.className = 'score';
                    scoreElement.textContent = entry.score || 0;
                    
                    item.appendChild(rank);
                    item.appendChild(name);
                    item.appendChild(scoreElement);
                    
                    leaderboardList.appendChild(item);
                });
            } else {
                leaderboardList.innerHTML = '<p>No leaderboard entries yet!</p>';
            }
        }).catch(error => {
            console.error('Error fetching leaderboard:', error);
            
            const leaderboardList = document.getElementById('leaderboard-list');
            if (leaderboardList) {
                leaderboardList.innerHTML = '<p>Could not load leaderboard. Please try again later.</p>';
            }
        });
        
        // Show the modal
        const gameoverModal = document.getElementById('gameover-modal');
        if (gameoverModal) {
            gameoverModal.style.display = 'block';
        } else {
            console.error('Game over modal element not found');
        }
    } catch (error) {
        console.error('Error showing game over modal:', error);
    }
}

/**
 * Starts the game with the selected character
 * @param {string} characterId - The ID of the selected character
 */
function startGame(characterId) {
    if (!characterId) {
        console.error('No character ID provided to startGame');
        return;
    }
    
    try {
        // Get the current scene
        const currentScene = gameInstance.scene.getScenes(true)[0];
        
        // Start the actual game scene
        console.log(`Starting game with character: ${characterId}`);
        currentScene.scene.start('GameScene', { characterId: characterId });
    } catch (error) {
        console.error('Error starting game:', error);
        
        // Fallback method - if the scene transition fails, try to refresh the page
        alert('Error starting the game. The page will refresh to fix this issue.');
        location.reload();
    }
}

/**
 * Restarts the game
 */
function restartGame() {
    try {
        // Make sure the modal is hidden first
        const gameoverModal = document.getElementById('gameover-modal');
        if (gameoverModal) {
            gameoverModal.style.display = 'none';
        }
        
        // Make sure gameInstance exists
        if (!gameInstance || !gameInstance.scene) {
            console.error('Game instance not found when restarting game');
            location.reload(); // Force page reload as fallback
            return;
        }
        
        // Clean up all active scenes first
        cleanupGameScenes();
        
        // More aggressive cleanup
        if (gameInstance.tweens) {
            gameInstance.tweens.killAll();
        }
        
        try {
            // Stop all active scenes with a more direct approach
            const activeScenes = gameInstance.scene.getScenes(true);
            for (let i = 0; i < activeScenes.length; i++) {
                if (activeScenes[i] && activeScenes[i].scene) {
                    const sceneName = activeScenes[i].scene.key;
                    console.log('Stopping scene:', sceneName);
                    
                    if (activeScenes[i].cleanup && typeof activeScenes[i].cleanup === 'function') {
                        activeScenes[i].cleanup();
                    }
                    
                    try {
                        gameInstance.scene.stop(sceneName);
                    } catch (e) {
                        console.warn('Error stopping scene:', e);
                    }
                }
            }
            
            // Short delay to ensure scenes are fully stopped
            setTimeout(() => {
                // Start character select scene
                console.log('Starting CharacterSelectScene');
                try {
                    gameInstance.scene.start('CharacterSelectScene');
                } catch (e) {
                    console.error('Error starting CharacterSelectScene:', e);
                    // Last resort - reload page
                    location.reload();
                }
            }, 100);
        } catch (error) {
            console.error('Error during scene transition:', error);
            // Fallback to reload
            location.reload();
        }
    } catch (error) {
        console.error('Critical error restarting game:', error);
        
        // Reload the page as a last resort
        alert('An error occurred while restarting the game. The page will reload now.');
        location.reload();
    }
}

/**
 * Shows the full leaderboard screen
 */
function viewLeaderboard() {
    try {
        // Get the current scene
        const currentScene = gameInstance.scene.getScenes(true)[0];
        
        // Go to leaderboard scene
        currentScene.scene.start('LeaderboardScene');
    } catch (error) {
        console.error('Error showing leaderboard:', error);
        
        // Fallback - alert user
        alert('Error showing leaderboard. Please try again later.');
    }
}

/**
 * Enhanced game scene transition with proper cleanup
 * @param {string} fromScene - Current scene key
 * @param {string} toScene - Target scene key
 * @param {Object} data - Data to pass to the new scene
 * @param {boolean} fadeTransition - Whether to use fade transition effect
 */
function transitionToScene(fromScene, toScene, data = {}, fadeTransition = true) {
    // Get the current scene
    const currentSceneObject = gameInstance.scene.getScene(fromScene);
    
    if (!currentSceneObject) {
        console.error(`Could not find scene: ${fromScene}`);
        return;
    }
    
    // Perform cleanup before transition
    cleanupGameResources(currentSceneObject);
    
    // Transition with fade effect if requested
    if (fadeTransition) {
        currentSceneObject.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                // Stop any music based on the scene we're leaving
                if (fromScene === 'MainMenuScene' || fromScene === 'CharacterSelectScene' || 
                    fromScene === 'LeaderboardScene' || fromScene === 'MultiplayerScene') {
                    currentSceneObject.sound.stopByKey('music-menu');
                } else if (fromScene === 'GameScene') {
                    currentSceneObject.sound.stopByKey('music-gameplay');
                }
                
                // Start the new scene
                currentSceneObject.scene.start(toScene, data);
                
                // Stop the current scene
                currentSceneObject.scene.stop();
            }
        });
    } else {
        // Immediate transition without fade
        if (fromScene === 'MainMenuScene' || fromScene === 'CharacterSelectScene' || 
            fromScene === 'LeaderboardScene' || fromScene === 'MultiplayerScene') {
            currentSceneObject.sound.stopByKey('music-menu');
        } else if (fromScene === 'GameScene') {
            currentSceneObject.sound.stopByKey('music-gameplay');
        }
        
        // Start the new scene
        currentSceneObject.scene.start(toScene, data);
        
        // Stop the current scene
        currentSceneObject.scene.stop();
    }
}

/**
 * Clean up game resources before scene transition
 * @param {Phaser.Scene} scene - The scene to clean up
 */
function cleanupGameResources(scene) {
    // Kill all tweens
    scene.tweens.killAll();
    
    // Stop all sounds
    scene.sound.getAllPlaying().forEach(sound => {
        sound.stop();
    });
    
    // Remove any full-screen modals or overlays
    scene.children.getAll().forEach(child => {
        if (child instanceof Phaser.GameObjects.Container && 
            child.name && child.name.includes('modal')) {
            child.destroy();
        }
        
        // Remove any full-screen rectangles that might block input
        if (child instanceof Phaser.GameObjects.Rectangle && 
            child.width >= CONFIG.GAME_WIDTH && 
            child.height >= CONFIG.GAME_HEIGHT) {
            child.destroy();
        }
    });
    
    // Cancel any pending timers
    scene.time.removeAllEvents();
    
    // If the scene has a custom cleanup method, call it
    if (typeof scene.cleanup === 'function') {
        scene.cleanup();
    }
}

/**
 * Global cleanup function to ensure proper scene transitions
 */
function cleanupGameScenes() {
    if (!gameInstance || !gameInstance.scene) return;
    
    // Stop all running tweens
    if (gameInstance.tweens) {
        gameInstance.tweens.killAll();
    }
    
    // Stop all timers in all scenes
    const activeScenes = gameInstance.scene.getScenes(true);
    activeScenes.forEach(scene => {
        // Remove all timers
        if (scene.time) {
            scene.time.removeAllEvents();
        }
        
        // Stop all animations
        if (scene.anims) {
            scene.anims.pauseAll();
        }
        
        // Stop all sounds
        if (scene.sound) {
            scene.sound.stopAll();
        }
        
        // Remove any full-screen rectangles that might block input
        if (scene.children) {
            scene.children.getAll().forEach(child => {
                if (child instanceof Phaser.GameObjects.Rectangle && 
                    child.width >= CONFIG.GAME_WIDTH && 
                    child.height >= CONFIG.GAME_HEIGHT) {
                    child.destroy();
                }
            });
        }
        
        // Call scene-specific cleanup if it exists
        if (typeof scene.cleanup === 'function') {
            scene.cleanup();
        }
    });
    
    // Make sure physics is working
    if (gameInstance.physics && gameInstance.physics.world) {
        gameInstance.physics.resume();
        gameInstance.physics.world.resume();
    }
}

// Call this function when switching major scenes
window.addEventListener('click', function() {
    // This helps clear any stuck input blockers
    setTimeout(cleanupGameScenes, 100);
});