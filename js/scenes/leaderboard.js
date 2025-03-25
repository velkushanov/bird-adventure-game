/**
 * LeaderboardScene
 * Displays the game's high scores
 */
class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super('LeaderboardScene');
        this.currentTab = 'all'; // 'all', 'daily', 'weekly'
        this.scores = [];
        this.isLoading = true;
    }
    
    create() {
        // Background
        this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 'bg-sky')
            .setOrigin(0, 0)
            .setScrollFactor(0);
            
        // Add parallax effect with slow scrolling
        this.bgScrollSpeed = 0.2;
        
        // Add title
        this.title = this.add.text(CONFIG.GAME_WIDTH / 2, 60, 'LEADERBOARD', {
            fontFamily: 'Arial',
            fontSize: '40px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Create tab buttons for different timeframes
        this.createTabButtons();
        
        // Create back button
        this.createBackButton();
        
        // Create loading indicator
        this.loadingText = this.add.text(CONFIG.GAME_WIDTH / 2, 250, 'Loading scores...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Create container for scores
        this.scoresContainer = this.add.container(0, 0);
        
        // Load all-time scores by default
        this.loadScores('all');
        
        // Load player's high score if logged in
        this.loadPlayerHighScore();
        
        // Play menu music if not already playing
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
    }
    
    /**
     * Create tab buttons for different time periods
     */
    createTabButtons() {
        // Container for tabs
        this.tabsContainer = this.add.container(CONFIG.GAME_WIDTH / 2, 120);
        
        // Tab button dimensions
        const tabWidth = 160;
        const tabHeight = 40;
        const tabSpacing = 10;
        const totalWidth = (tabWidth * 3) + (tabSpacing * 2);
        const startX = -(totalWidth / 2) + (tabWidth / 2);
        
        // All-time tab
        this.allTimeTab = this.createTab(startX, 0, tabWidth, tabHeight, 'All Time', 'all');
        
        // Weekly tab
        this.weeklyTab = this.createTab(startX + tabWidth + tabSpacing, 0, tabWidth, tabHeight, 'Weekly', 'weekly');
        
        // Daily tab
        this.dailyTab = this.createTab(startX + 2 * (tabWidth + tabSpacing), 0, tabWidth, tabHeight, 'Daily', 'daily');
        
        // Add tabs to container
        this.tabsContainer.add([this.allTimeTab, this.weeklyTab, this.dailyTab]);
        
        // Set all-time tab as active initially
        this.setActiveTab('all');
    }
    
    /**
     * Create a single tab button
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Tab width
     * @param {number} height - Tab height
     * @param {string} text - Tab text
     * @param {string} tabId - Tab identifier
     * @returns {Phaser.GameObjects.Container} Tab container
     */
    createTab(x, y, width, height, text, tabId) {
        // Container for tab
        const tab = this.add.container(x, y);
        tab.tabId = tabId;
        
        // Background
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff);
            
        // Text
        const tabText = this.add.text(0, 0, text, {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add to container
        tab.add([bg, tabText]);
        
        // Store references
        tab.bg = bg;
        tab.text = tabText;
        
        // Make interactive
        bg.setInteractive();
        bg.on('pointerdown', () => {
            this.setActiveTab(tabId);
            this.loadScores(tabId);
        });
        
        // Add hover effect
        bg.on('pointerover', () => {
            if (tabId !== this.currentTab) {
                bg.setFillStyle(0x333333, 0.7);
            }
        });
        
        bg.on('pointerout', () => {
            if (tabId !== this.currentTab) {
                bg.setFillStyle(0x000000, 0.5);
            }
        });
        
        return tab;
    }
    
    /**
     * Set a tab as active
     * @param {string} tabId - Tab identifier
     */
    setActiveTab(tabId) {
        const tabs = [this.allTimeTab, this.weeklyTab, this.dailyTab];
        
        tabs.forEach(tab => {
            if (tab.tabId === tabId) {
                // Active tab
                tab.bg.setFillStyle(0x3498db, 0.7);
                tab.bg.setStrokeStyle(3, 0x2ecc71);
                tab.text.setFontSize(20);
            } else {
                // Inactive tab
                tab.bg.setFillStyle(0x000000, 0.5);
                tab.bg.setStrokeStyle(2, 0xffffff);
                tab.text.setFontSize(18);
            }
        });
        
        this.currentTab = tabId;
    }
    
    /**
     * Create back button
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
     * Load scores from Firebase
     * @param {string} timeframe - Time period ('all', 'weekly', 'daily')
     */
    loadScores(timeframe) {
        // Show loading indicator
        this.showLoading();
        
        // Get scores from Firebase
        getTopScores(20, timeframe)
            .then(scores => {
                if (Array.isArray(scores)) {
                    console.log(`Loaded ${scores.length} scores for ${timeframe} timeframe`);
                    this.scores = scores;
                    this.displayScores();
                } else {
                    console.error('Invalid scores data returned:', scores);
                    this.showError('Error loading scores. Invalid data format.');
                }
            })
            .catch(error => {
                console.error('Error loading scores:', error);
                this.showError('Error loading scores. Please try again.');
            });
    }
    
    /**
     * Load player's high score
     */
    loadPlayerHighScore() {
        if (isAuthenticated()) {
            getUserHighScore()
                .then(highScore => {
                    if (typeof highScore === 'number') {
                        this.createHighScoreDisplay(highScore);
                    } else {
                        console.error('Invalid high score value:', highScore);
                        this.createHighScoreDisplay(0);
                    }
                })
                .catch(error => {
                    console.error('Error getting user high score:', error);
                    this.createHighScoreDisplay(0);
                });
        } else if (localStorage.getItem('highScore')) {
            // For guest players, get from local storage
            try {
                const highScore = parseInt(localStorage.getItem('highScore')) || 0;
                this.createHighScoreDisplay(highScore);
            } catch (error) {
                console.error('Error parsing local high score:', error);
                this.createHighScoreDisplay(0);
            }
        } else {
            this.createHighScoreDisplay(0);
        }
    }
    
    /**
     * Create high score display for current player
     * @param {number} highScore - Player's high score
     */
    createHighScoreDisplay(highScore) {
        // Remove existing display if any
        if (this.highScoreContainer) {
            this.highScoreContainer.destroy();
        }
        
        // Container for high score display
        this.highScoreContainer = this.add.container(CONFIG.GAME_WIDTH - 160, 50);
        
        // Background
        const bg = this.add.rectangle(0, 0, 300, 60, 0x000000, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff);
            
        // Text
        const playerName = isAuthenticated() ? getCurrentUser().displayName : 'Guest';
        const nameText = this.add.text(0, -15, `${playerName}'s Best Score`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const scoreText = this.add.text(0, 15, `${highScore}`, {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffff00',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add to container
        this.highScoreContainer.add([bg, nameText, scoreText]);
    }
    
    /**
     * Display the loaded scores
     */
    displayScores() {
        // Hide loading indicator
        this.hideLoading();
        
        // Clear existing scores
        this.scoresContainer.removeAll(true);
        
        // Check if we have scores
        if (!this.scores || this.scores.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Create header
        this.createScoreHeader();
        
        // Create score rows
        this.scores.forEach((score, index) => {
            this.createScoreRow(score, index);
        });
    }
    
    /**
     * Create header for score table
     */
    createScoreHeader() {
        // Header container
        const header = this.add.container(0, 170);
        
        // Background
        const bg = this.add.rectangle(CONFIG.GAME_WIDTH / 2, 0, 600, 40, 0x000000, 0.7)
            .setOrigin(0.5);
            
        // Rank column
        const rankText = this.add.text(CONFIG.GAME_WIDTH / 2 - 250, 0, 'RANK', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Player column
        const playerText = this.add.text(CONFIG.GAME_WIDTH / 2 - 50, 0, 'PLAYER', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Score column
        const scoreText = this.add.text(CONFIG.GAME_WIDTH / 2 + 150, 0, 'SCORE', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Date column
        const dateText = this.add.text(CONFIG.GAME_WIDTH / 2 + 280, 0, 'DATE', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add to header
        header.add([bg, rankText, playerText, scoreText, dateText]);
        
        // Add to scores container
        this.scoresContainer.add(header);
    }
    
    /**
     * Create a single score row
     * @param {Object} score - Score data
     * @param {number} index - Row index
     */
    createScoreRow(score, index) {
        // Calculate y position
        const y = 220 + (index * 35);
        
        // Row container
        const row = this.add.container(0, y);
        
        // Background (alternating colors)
        const bgColor = index % 2 === 0 ? 0x333333 : 0x222222;
        const bg = this.add.rectangle(CONFIG.GAME_WIDTH / 2, 0, 600, 30, bgColor, 0.7)
            .setOrigin(0.5);
            
        // Highlight current user's score
        if (isAuthenticated() && score.userId && score.userId === getCurrentUser().uid) {
            bg.setStrokeStyle(2, 0xffff00);
        }
        
        // Rank column
        const rankText = this.add.text(CONFIG.GAME_WIDTH / 2 - 250, 0, `#${index + 1}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: this.getRankColor(index),
            align: 'center'
        }).setOrigin(0.5);
        
        // Player column
        let playerName = score.name || 'Unknown Player';
        // Truncate long names
        if (playerName.length > 15) {
            playerName = playerName.substring(0, 15) + '...';
        }
        
        const playerText = this.add.text(CONFIG.GAME_WIDTH / 2 - 50, 0, playerName, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Score column
        const scoreValue = score.score || 0;
        const scoreText = this.add.text(CONFIG.GAME_WIDTH / 2 + 150, 0, scoreValue.toString(), {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Date column
        let dateText;
        if (score.timestamp) {
            let dateStr;
            try {
                // Handle different timestamp formats
                if (score.timestamp instanceof Date) {
                    dateStr = this.formatDate(score.timestamp);
                } else if (score.timestamp.seconds) {
                    // Firestore timestamp
                    const date = new Date(score.timestamp.seconds * 1000);
                    dateStr = this.formatDate(date);
                } else if (typeof score.timestamp === 'number') {
                    // Unix timestamp
                    const date = new Date(score.timestamp);
                    dateStr = this.formatDate(date);
                } else {
                    dateStr = 'Unknown';
                }
            } catch (error) {
                console.error('Error formatting date:', error);
                dateStr = 'Error';
            }
            
            dateText = this.add.text(CONFIG.GAME_WIDTH / 2 + 280, 0, dateStr, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#aaaaaa',
                align: 'center'
            }).setOrigin(0.5);
        } else {
            dateText = this.add.text(CONFIG.GAME_WIDTH / 2 + 280, 0, 'Unknown', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#aaaaaa',
                align: 'center'
            }).setOrigin(0.5);
        }
        
        // Add to row
        row.add([bg, rankText, playerText, scoreText, dateText]);
        
        // Add to scores container
        this.scoresContainer.add(row);
    }
    
    /**
     * Show loading indicator
     */
    showLoading() {
        this.isLoading = true;
        this.loadingText.setVisible(true);
        this.scoresContainer.setVisible(false);
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.isLoading = false;
        this.loadingText.setVisible(false);
        this.scoresContainer.setVisible(true);
    }
    
    /**
     * Show empty state when no scores are available
     */
    showEmptyState() {
        const emptyText = this.add.text(CONFIG.GAME_WIDTH / 2, 250, 'No scores available yet.\nBe the first to play!', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        this.scoresContainer.add(emptyText);
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.hideLoading();
        
        const errorText = this.add.text(CONFIG.GAME_WIDTH / 2, 250, message, {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ff6666',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add a retry button
        const retryButton = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            320,
            200,
            40,
            0x3498db,
            0.8
        ).setInteractive();
        
        const retryText = this.add.text(
            CONFIG.GAME_WIDTH / 2,
            320,
            'Retry',
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        
        retryButton.on('pointerdown', () => {
            this.loadScores(this.currentTab);
        });
        
        this.scoresContainer.add([errorText, retryButton, retryText]);
    }
    
    /**
     * Get color for rank display
     * @param {number} index - Rank index
     * @returns {string} Color in hex format
     */
    getRankColor(index) {
        if (index === 0) return '#ffd700'; // Gold
        if (index === 1) return '#c0c0c0'; // Silver
        if (index === 2) return '#cd7f32'; // Bronze
        return '#ffffff'; // White for other ranks
    }
    
    /**
     * Format date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        if (!date) return 'Unknown';
        
        try {
            // Format as MM/DD/YYYY
            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
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
        
        // Call parent shutdown
        super.shutdown();
    }
}