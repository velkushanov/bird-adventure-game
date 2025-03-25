/**
 * Main.js - Entry point for the game
 * Initializes the Phaser game and manages the game lifecycle
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    initializeFirebase();
    
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
        }
    };
    
    // Create and initialize the game
    const game = new Phaser.Game(gameConfig);
    
    // Global game instance
    window.game = game;
    
    // Hide loading screen when game is ready
    game.events.once('ready', function() {
        document.getElementById('loading-screen').style.display = 'none';
    });
    
    // Update progress bar during asset loading
    game.events.on('progress', function(value) {
        document.querySelector('.progress').style.width = Math.floor(value * 100) + '%';
    });
    
    // Handle modal buttons
    setupModalButtons();
    
    // Handle window resizing
    window.addEventListener('resize', function() {
        if (game.scale) {
            game.scale.refresh();
        }
    });
    
    // Check for stored authentication
    checkUserAuth();
});

/**
 * Sets up all modal button interactions
 */
function setupModalButtons() {
    // Authentication modal
    document.getElementById('login-google').addEventListener('click', function() {
        loginWithGoogle();
    });
    
    document.getElementById('login-facebook').addEventListener('click', function() {
        loginWithFacebook();
    });
    
    document.getElementById('login-instagram').addEventListener('click', function() {
        loginWithInstagram();
    });
    
    document.getElementById('play-as-guest').addEventListener('click', function() {
        playAsGuest();
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('character-modal').style.display = 'block';
    });
    
    // Character selection modal
    document.getElementById('start-game').addEventListener('click', function() {
        const selected = document.querySelector('.character-option.selected');
        if (selected) {
            const characterId = selected.getAttribute('data-id');
            startGame(characterId);
            document.getElementById('character-modal').style.display = 'none';
        } else {
            alert('Please select a character');
        }
    });
    
    // Game over modal
    document.getElementById('restart-game').addEventListener('click', function() {
        restartGame();
        document.getElementById('gameover-modal').style.display = 'none';
    });
    
    document.getElementById('view-leaderboard').addEventListener('click', function() {
        viewLeaderboard();
        document.getElementById('gameover-modal').style.display = 'none';
    });
    
    // Close buttons
    document.querySelectorAll('.close').forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function() {
            this.parentElement.parentElement.style.display = 'none';
        });
    });
}

/**
 * Dynamically populates the character selection grid
 */
function populateCharacterSelection() {
    const grid = document.querySelector('.character-grid');
    grid.innerHTML = ''; // Clear existing content
    
    // Add each character option
    CONFIG.CHARACTERS.forEach(character => {
        const charDiv = document.createElement('div');
        charDiv.className = 'character-option';
        charDiv.setAttribute('data-id', character.id);
        
        // Create character preview
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
}

/**
 * Shows the authentication modal
 */
function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'block';
}

/**
 * Shows the character selection modal
 */
function showCharacterModal() {
    populateCharacterSelection();
    document.getElementById('character-modal').style.display = 'block';
}

/**
 * Shows the game over modal with final score
 * @param {number} score - The player's final score
 * @param {number} highScore - The player's high score
 */
function showGameOverModal(score, highScore) {
    document.getElementById('final-score').textContent = `Your Score: ${score}`;
    document.getElementById('high-score').textContent = `Your High Score: ${highScore}`;
    
    // Update leaderboard preview
    getTopScores(5).then(scores => {
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';
        
        scores.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            const rank = document.createElement('div');
            rank.className = 'rank';
            rank.textContent = `#${index + 1}`;
            
            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = entry.name;
            
            const scoreElement = document.createElement('div');
            scoreElement.className = 'score';
            scoreElement.textContent = entry.score;
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(scoreElement);
            
            leaderboardList.appendChild(item);
        });
    });
    
    document.getElementById('gameover-modal').style.display = 'block';
}

/**
 * Starts the game with the selected character
 * @param {string} characterId - The ID of the selected character
 */
function startGame(characterId) {
    // Get the current scene
    const currentScene = window.game.scene.getScenes(true)[0];
    
    // Start the game scene
    currentScene.scene.start('GameScene', { characterId: characterId });
}

/**
 * Restarts the game
 */
function restartGame() {
    const currentScene = window.game.scene.getScenes(true)[0];
    currentScene.scene.start('CharacterSelectScene');
}

/**
 * Shows the full leaderboard screen
 */
function viewLeaderboard() {
    const currentScene = window.game.scene.getScenes(true)[0];
    currentScene.scene.start('LeaderboardScene');
}

/**
 * Updates the loading progress bar
 * @param {number} progress - Loading progress (0-1)
 */
function updateLoadingProgress(progress) {
    document.querySelector('.progress').style.width = Math.floor(progress * 100) + '%';
}