/**
 * MultiplayerScene
 * Handles multiplayer lobby and game modes
 */
class MultiplayerScene extends Phaser.Scene {
    constructor() {
        super('MultiplayerScene');
        this.roomList = [];
        this.currentView = 'lobby'; // 'lobby', 'room', 'game'
        this.selectedRoom = null;
        this.roomListeners = [];
        this.otherPlayers = {};
        this.debugText = null; // For debugging
        this.connectionListener = null;
        this.connectivityTimeout = null;
        this.characterSelectModal = null;
        this.startedGame = false; // Flag to prevent multiple game starts
    }
    
    create() {
        // Background
        this.bg = this.add.tileSprite(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 'bg-sky')
            .setOrigin(0, 0)
            .setScrollFactor(0);
            
        // Add slow scrolling
        this.bgScrollSpeed = 0.2;
        
        // Create debug text for multiplayer diagnostics
        this.debugText = this.add.text(10, CONFIG.GAME_HEIGHT - 20, 'Multiplayer Debug: Initializing...', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#333333'
        }).setDepth(1000);
        
        // Create the view containers
        this.lobbyContainer = this.add.container(0, 0);
        this.roomContainer = this.add.container(0, 0);
        this.gameContainer = this.add.container(0, 0);
        
        // Hide containers initially
        this.roomContainer.setVisible(false);
        this.gameContainer.setVisible(false);
        
        // Create UI for each view
        this.createLobbyUI();
        this.createRoomUI();
        
        // Check Firebase connectivity
        this.checkFirebaseConnection();
        
        // Check if user is authenticated
        if (!isAuthenticated()) {
            this.showAuthRequiredMessage();
            return;
        }
        
        // Load available rooms
        this.loadRooms();
        
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
     * Check connection to Firebase
     */
    checkFirebaseConnection() {
        // Update debug text
        this.debugText.setText('Checking Firebase connection...');
        
        // Set a timeout for connectivity check
        this.connectivityTimeout = setTimeout(() => {
            if (window.firebase) {
                this.debugText.setText('Firebase loaded. Checking connection...');
                
                try {
                    // Use the database ref directly with an error handler
                    const connectedRef = window.firebase.database().ref('.info/connected');
                    
                    // Store the listener reference for later cleanup
                    this.connectionListener = connectedRef.on('value', (snap) => {
                        if (snap.val() === true) {
                            this.debugText.setText('Connected to Firebase ✓');
                        } else {
                            this.debugText.setText('WARNING: Not connected to Firebase ✗');
                            this.showConnectionError();
                        }
                    }, (error) => {
                        this.debugText.setText(`Firebase error: ${error.message}`);
                        console.error("Firebase connection error:", error);
                        this.showConnectionError();
                    });
                } catch (err) {
                    this.debugText.setText(`Firebase error: ${err.message}`);
                    console.error("Firebase connection error:", err);
                    this.showConnectionError();
                }
            } else {
                this.debugText.setText('Firebase not loaded after timeout ✗');
                this.showConnectionError();
            }
        }, 3000);
    }
    
    /**
     * Show connection error message
     */
    showConnectionError() {
        // Create error message container
        const errorContainer = this.add.container(CONFIG.GAME_WIDTH/2, CONFIG.GAME_HEIGHT/2);
        
        // Background
        const bg = this.add.rectangle(0, 0, 400, 200, 0x000000, 0.8)
            .setStrokeStyle(2, 0xff0000);
            
        // Error message
        const errorText = this.add.text(0, -40, 'Connection Error', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ff0000',
            align: 'center'
        }).setOrigin(0.5);
        
        const detailText = this.add.text(0, 0, 'Failed to connect to multiplayer server.\nCheck your internet connection and try again.', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Back button
        const backButton = this.add.rectangle(0, 60, 150, 40, 0x3498db)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MainMenuScene');
            });
            
        const backText = this.add.text(0, 60, 'Back to Menu', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Add all to container
        errorContainer.add([bg, errorText, detailText, backButton, backText]);
        errorContainer.setDepth(1001); // Above everything else
    }
    
    /**
     * Create UI for the lobby view
     */
    createLobbyUI() {
        // Title
        this.lobbyTitle = this.add.text(CONFIG.GAME_WIDTH / 2, 60, 'MULTIPLAYER LOBBY', {
            fontFamily: 'Arial',
            fontSize: '40px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Room list panel
        this.roomListPanel = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            300,
            600,
            350,
            0x000000,
            0.7
        ).setOrigin(0.5);
        
        // Room list header
        this.createRoomListHeader();
        
        // Loading text
        this.loadingText = this.add.text(CONFIG.GAME_WIDTH / 2, 300, 'Loading rooms...', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // No rooms text (hidden initially)
        this.noRoomsText = this.add.text(CONFIG.GAME_WIDTH / 2, 300, 'No rooms available.\nCreate a new room to play!', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setVisible(false);
        
        // Room rows container
        this.roomRowsContainer = this.add.container(0, 0);
        
        // Create room button
        this.createRoomButton = this.add.image(CONFIG.GAME_WIDTH / 2, 500, 'button')
            .setInteractive()
            .on('pointerdown', this.onCreateRoomClicked, this);
            
        // Create room text
        this.createRoomText = this.add.text(CONFIG.GAME_WIDTH / 2, 500, 'Create New Room', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Refresh button
        this.refreshButton = this.add.image(CONFIG.GAME_WIDTH / 2 + 250, 180, 'button')
            .setScale(0.6)
            .setInteractive()
            .on('pointerdown', this.loadRooms, this);
            
        // Refresh text
        this.refreshText = this.add.text(CONFIG.GAME_WIDTH / 2 + 250, 180, 'Refresh', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Back button
        this.backButton = this.add.image(80, 40, 'button')
            .setScale(0.6)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MainMenuScene');
            });
            
        // Back text
        this.backText = this.add.text(80, 40, 'BACK', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add all elements to the lobby container
        this.lobbyContainer.add([
            this.lobbyTitle,
            this.roomListPanel,
            this.loadingText,
            this.noRoomsText,
            this.roomRowsContainer,
            this.createRoomButton,
            this.createRoomText,
            this.refreshButton,
            this.refreshText,
            this.backButton,
            this.backText
        ]);
        
        // Add hover effects to buttons
        this.addButtonHoverEffect(this.createRoomButton);
        this.addButtonHoverEffect(this.refreshButton, 0.6, 0.65);
        this.addButtonHoverEffect(this.backButton, 0.6, 0.65);
    }
    
    /**
     * Create header for room list
     */
    createRoomListHeader() {
        // Header container
        this.roomListHeader = this.add.container(0, 170);
        
        // Header background
        const headerBg = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            0,
            600,
            40,
            0x333333,
            0.9
        ).setOrigin(0.5);
        
        // Column headers
        const hostText = this.add.text(CONFIG.GAME_WIDTH / 2 - 200, 0, 'HOST', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const playersText = this.add.text(CONFIG.GAME_WIDTH / 2, 0, 'PLAYERS', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const statusText = this.add.text(CONFIG.GAME_WIDTH / 2 + 200, 0, 'STATUS', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add elements to header container
        this.roomListHeader.add([headerBg, hostText, playersText, statusText]);
        
        // Add to lobby container
        this.lobbyContainer.add(this.roomListHeader);
    }
    
    /**
     * Create UI for the room view
     */
    createRoomUI() {
        // Title
        this.roomTitle = this.add.text(CONFIG.GAME_WIDTH / 2, 60, 'GAME ROOM', {
            fontFamily: 'Arial',
            fontSize: '40px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Room info panel
        this.roomInfoPanel = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            130,
            600,
            60,
            0x000000,
            0.7
        ).setOrigin(0.5);
        
        // Room info text
        this.roomInfoText = this.add.text(CONFIG.GAME_WIDTH / 2, 130, 'Waiting for players...', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Debug text for room state
        this.roomDebugText = this.add.text(10, CONFIG.GAME_HEIGHT - 40, '', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ffff00',
            backgroundColor: '#333333'
        }).setDepth(1000);
        
        // Players panel
        this.playersPanel = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            300,
            600,
            250,
            0x000000,
            0.7
        ).setOrigin(0.5);
        
        // Players container
        this.playersContainer = this.add.container(0, 0);
        
        // Ready button
        this.readyButton = this.add.image(CONFIG.GAME_WIDTH / 2 - 150, 480, 'button')
            .setInteractive()
            .on('pointerdown', this.onReadyClicked, this);
            
        // Ready text
        this.readyText = this.add.text(CONFIG.GAME_WIDTH / 2 - 150, 480, 'Ready', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Start button (for host only)
        this.startButton = this.add.image(CONFIG.GAME_WIDTH / 2 + 150, 480, 'button')
            .setInteractive()
            .on('pointerdown', this.onStartGameClicked, this)
            .setVisible(false);
            
        // Start text
        this.startText = this.add.text(CONFIG.GAME_WIDTH / 2 + 150, 480, 'Start Game', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5)
        .setVisible(false);
        
        // Leave button
        this.leaveButton = this.add.image(80, 40, 'button')
            .setScale(0.6)
            .setInteractive()
            .on('pointerdown', this.onLeaveRoomClicked, this);
            
        // Leave text
        this.leaveText = this.add.text(80, 40, 'LEAVE', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add all elements to the room container
        this.roomContainer.add([
            this.roomTitle,
            this.roomInfoPanel,
            this.roomInfoText,
            this.roomDebugText,
            this.playersPanel,
            this.playersContainer,
            this.readyButton,
            this.readyText,
            this.startButton,
            this.startText,
            this.leaveButton,
            this.leaveText
        ]);
        
        // Add hover effects to buttons
        this.addButtonHoverEffect(this.readyButton);
        this.addButtonHoverEffect(this.startButton);
        this.addButtonHoverEffect(this.leaveButton, 0.6, 0.65);
    }
    
    /**
     * Show a message that authentication is required
     */
    showAuthRequiredMessage() {
        // Hide other containers
        this.lobbyContainer.setVisible(false);
        this.roomContainer.setVisible(false);
        this.gameContainer.setVisible(false);
        
        // Container for auth message
        this.authContainer = this.add.container(0, 0);
        
        // Auth message text
        const authText = this.add.text(CONFIG.GAME_WIDTH / 2, 200, 'You need to be logged in\nto access multiplayer features.', {
            fontFamily: 'Arial',
            fontSize: '30px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Login button
        const loginButton = this.add.image(CONFIG.GAME_WIDTH / 2, 300, 'button')
            .setInteractive()
            .on('pointerdown', () => {
                showAuthModal();
                // Monitor auth state to detect when login completes
                const checkAuth = setInterval(() => {
                    if (isAuthenticated()) {
                        clearInterval(checkAuth);
                        this.authContainer.destroy();
                        this.lobbyContainer.setVisible(true);
                        this.loadRooms();
                    }
                }, 1000);
            });
            
        // Login text
        const loginText = this.add.text(CONFIG.GAME_WIDTH / 2, 300, 'Login / Register', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Back button
        const backButton = this.add.image(CONFIG.GAME_WIDTH / 2, 380, 'button')
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MainMenuScene');
            });
            
        // Back text
        const backText = this.add.text(CONFIG.GAME_WIDTH / 2, 380, 'Back to Menu', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add elements to auth container
        this.authContainer.add([authText, loginButton, loginText, backButton, backText]);
        
        // Add hover effects
        this.addButtonHoverEffect(loginButton);
        this.addButtonHoverEffect(backButton);
    }
    
    /**
     * Load available multiplayer rooms
     */
    loadRooms() {
        // Show loading text
        this.loadingText.setVisible(true);
        this.noRoomsText.setVisible(false);
        
        // Update debug text
        this.debugText.setText('Loading rooms list...');
        
        // Clear existing room rows
        this.roomRowsContainer.removeAll(true);
        
        // Load rooms from Firebase
        listMultiplayerRooms()
            .then(rooms => {
                this.roomList = rooms;
                
                // Hide loading text
                this.loadingText.setVisible(false);
                
                if (rooms.length === 0) {
                    // Show no rooms message
                    this.noRoomsText.setVisible(true);
                    this.debugText.setText('No rooms available');
                } else {
                    // Create room rows
                    this.createRoomRows(rooms);
                    this.debugText.setText(`Found ${rooms.length} rooms`);
                }
            })
            .catch(error => {
                console.error('Error loading rooms:', error);
                this.loadingText.setText('Error loading rooms.\nTry again later.');
                this.debugText.setText(`Error loading rooms: ${error.message}`);
            });
    }
    
    /**
     * Create room list rows
     * @param {Array} rooms - Array of room objects
     */
    createRoomRows(rooms) {
        // Calculate row height
        const rowHeight = 40;
        const startY = 200;
        
        // Create rows for each room
        rooms.forEach((room, index) => {
            const y = startY + (index * rowHeight);
            
            // Row container
            const row = this.add.container(0, y);
            
            // Row background (alternating colors)
            const bgColor = index % 2 === 0 ? 0x333333 : 0x222222;
            const bg = this.add.rectangle(
                CONFIG.GAME_WIDTH / 2,
                0,
                600,
                rowHeight,
                bgColor,
                0.7
            ).setOrigin(0.5);
            
            // Host name
            const hostText = this.add.text(CONFIG.GAME_WIDTH / 2 - 200, 0, room.host, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Player count
            const playersText = this.add.text(CONFIG.GAME_WIDTH / 2, 0, `${room.players}/${room.maxPlayers}`, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Status / Join button
            let statusText;
            
            if (room.players < room.maxPlayers) {
                // Room has space, show join button
                statusText = this.add.text(CONFIG.GAME_WIDTH / 2 + 200, 0, 'Join', {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#4CAF50',
                    align: 'center'
                }).setOrigin(0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.debugText.setText(`Joining room ${room.id}...`);
                    this.joinRoom(room.id);
                });
                
                // Add hover effect
                statusText.on('pointerover', () => {
                    statusText.setScale(1.1);
                });
                
                statusText.on('pointerout', () => {
                    statusText.setScale(1);
                });
            } else {
                // Room is full
                statusText = this.add.text(CONFIG.GAME_WIDTH / 2 + 200, 0, 'Full', {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#F44336',
                    align: 'center'
                }).setOrigin(0.5);
            }
            
            // Make the entire row clickable
            bg.setInteractive();
            bg.on('pointerdown', () => {
                if (room.players < room.maxPlayers) {
                    this.debugText.setText(`Joining room ${room.id} (row click)...`);
                    this.joinRoom(room.id);
                }
            });
            
            // Add hover effect to row
            bg.on('pointerover', () => {
                bg.setFillStyle(0x3498db, 0.4);
            });
            
            bg.on('pointerout', () => {
                bg.setFillStyle(bgColor, 0.7);
            });
            
            // Add all elements to row
            row.add([bg, hostText, playersText, statusText]);
            
            // Add row to container
            this.roomRowsContainer.add(row);
        });
    }
    
    /**
     * Create a new multiplayer room
     */
    onCreateRoomClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Update debug text
        this.debugText.setText('Creating new room...');
        
        // Create room in Firebase
        createMultiplayerRoom()
            .then(roomId => {
                this.debugText.setText(`Room created: ${roomId}`);
                this.selectedRoom = roomId;
                this.enterRoom(roomId);
            })
            .catch(error => {
                console.error('Error creating room:', error);
                this.debugText.setText(`Error creating room: ${error.message}`);
                alert('Failed to create room. Please try again.');
            });
    }
    
    /**
     * Join an existing room
     * @param {string} roomId - ID of the room to join
     */
    joinRoom(roomId) {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Update debug text
        this.debugText.setText(`Attempting to join room ${roomId}...`);
        
        // Join room in Firebase
        joinMultiplayerRoom(roomId)
            .then(roomData => {
                this.debugText.setText(`Joined room ${roomId}`);
                this.selectedRoom = roomId;
                this.enterRoom(roomId);
            })
            .catch(error => {
                console.error('Error joining room:', error);
                this.debugText.setText(`Error joining room: ${error.message}`);
                alert('Failed to join room: ' + error.message);
                
                // Refresh room list
                this.loadRooms();
            });
    }
    
    /**
     * Enter a room and switch to room view
     * @param {string} roomId - ID of the room
     */
    enterRoom(roomId) {
        // Switch to room view
        this.lobbyContainer.setVisible(false);
        this.roomContainer.setVisible(true);
        this.currentView = 'room';
        
        // Update debug text
        this.debugText.setText(`Entered room ${roomId}, setting up listeners...`);
        
        // Set up room state listener
        const unsubscribe = listenToRoomChanges(roomData => {
            if (roomData === null) {
                // Room was deleted
                this.debugText.setText('Room was closed by the host');
                alert('The room was closed by the host.');
                this.leaveRoom();
                return;
            }
            
            // Update debug text with room data preview
            this.roomDebugText.setText(`Room: ${roomId} | Host: ${roomData.host} | Status: ${roomData.status} | Players: ${Object.keys(roomData.players || {}).length}`);
            
            // Update room info
            this.updateRoomInfo(roomData);
            
            // Update players list
            this.updatePlayersList(roomData.players);
            
            // Check if game is starting
            if (roomData.status === 'playing') {
                console.log('Game is starting...');
                this.debugText.setText('Game is starting...');
                this.startMultiplayerGame(roomData);
            }
        });
        
        // Store unsubscribe function
        this.roomListeners.push(unsubscribe);
    }
    
    /**
     * Update room information display
     * @param {Object} roomData - Room data object
     */
    updateRoomInfo(roomData) {
        // Log for debugging
        console.log('Room info updated:', roomData);
        
        // Update room info text
        const playerCount = Object.keys(roomData.players || {}).length;
        this.roomInfoText.setText(`Host: ${roomData.hostName}  |  Players: ${playerCount}/${roomData.maxPlayers}  |  Status: ${roomData.status}`);
        
        // Show/hide start button for host
        const currentUser = getCurrentUser();
        const isHost = currentUser && roomData.host === currentUser.uid;
        
        this.startButton.setVisible(isHost);
        this.startText.setVisible(isHost);
        
        // Disable start button if not all players are ready
        if (isHost) {
            let allReady = true;
            for (const playerId in roomData.players) {
                if (!roomData.players[playerId].ready) {
                    allReady = false;
                    break;
                }
            }
            
            if (allReady && playerCount > 1) {
                this.startButton.clearTint();
                this.startText.setColor('#ffffff');
            } else {
                this.startButton.setTint(0x999999);
                this.startText.setColor('#aaaaaa');
            }
        }
    }
    
    /**
     * Update the players list display
     * @param {Object} players - Players object from room data
     */
    updatePlayersList(players) {
        // Log for debugging
        console.log('Players list updated:', players);
        
        // Clear existing players
        this.playersContainer.removeAll(true);
        
        // Current user
        const currentUser = getCurrentUser();
        
        // Calculate player slot positions
        const maxPlayers = CONFIG.MAX_PLAYERS;
        const slotWidth = 120;
        const slotHeight = 150;
        const startX = CONFIG.GAME_WIDTH / 2 - ((maxPlayers * slotWidth) / 2) + (slotWidth / 2);
        const slotY = 300;
        
        // Create slots for each potential player
        for (let i = 0; i < maxPlayers; i++) {
            const x = startX + (i * slotWidth);
            
            // Slot container
            const slot = this.add.container(x, slotY);
            
            // Slot background
            const bg = this.add.rectangle(0, 0, slotWidth - 10, slotHeight - 10, 0x333333, 0.5)
                .setOrigin(0.5)
                .setStrokeStyle(2, 0xffffff);
                
            // Empty slot text
            const emptyText = this.add.text(0, 0, 'Empty', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#aaaaaa',
                align: 'center'
            }).setOrigin(0.5);
            
            // Add to slot
            slot.add([bg, emptyText]);
            
            // Store slot for later reference
            slot.slotIndex = i;
            
            // Add to players container
            this.playersContainer.add(slot);
        }
        
        // Add players to slots
        let slotIndex = 0;
        for (const playerId in players) {
            const player = players[playerId];
            const slot = this.playersContainer.getAt(slotIndex);
            
            // Clear empty text
            slot.removeAt(1);
            
            // Player name
            const nameText = this.add.text(0, -40, player.name, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Truncate long names
            if (nameText.width > slotWidth - 20) {
                nameText.setText(player.name.substring(0, 10) + '...');
            }
            
            // Host badge
            let hostBadge = null;
            if (player.host) {
                hostBadge = this.add.text(0, -60, 'HOST', {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: '#ffff00',
                    align: 'center'
                }).setOrigin(0.5);
            }
            
            // Character preview (if selected)
            let characterPreview = null;
            if (player.character) {
                const character = CONFIG.CHARACTERS.find(c => c.id === player.character);
                if (character) {
                    characterPreview = this.add.sprite(0, 0, character.texture, 0)
                        .setScale(1.5);
                        
                    // Add animation
                    const animKey = `lobby-preview-${character.texture}-${slotIndex}`;
                    if (!this.anims.exists(animKey)) {
                        this.anims.create({
                            key: animKey,
                            frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
                            frameRate: 10,
                            repeat: -1
                        });
                    }
                    
                    characterPreview.play(animKey);
                }
            } else {
                // No character selected
                const noCharText = this.add.text(0, 0, 'Select Character', {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: '#ff9900',
                    align: 'center'
                }).setOrigin(0.5);
                
                slot.add(noCharText);
            }
            
            // Ready status
            const readyStatus = this.add.text(0, 40, player.ready ? 'READY' : 'NOT READY', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: player.ready ? '#4CAF50' : '#F44336',
                align: 'center'
            }).setOrigin(0.5);
            
            // Highlight current player's slot
            if (currentUser && playerId === currentUser.uid) {
                slot.getAt(0).setStrokeStyle(3, 0x4CAF50);
            }
            
            // Add elements to slot
            slot.add([nameText, readyStatus]);
            if (hostBadge) slot.add(hostBadge);
            if (characterPreview) slot.add(characterPreview);
            
            slotIndex++;
        }
        
        // Update ready button text based on current ready status
        if (currentUser && players && players[currentUser.uid]) {
            const playerData = players[currentUser.uid];
            if (playerData) {
                if (playerData.ready) {
                    this.readyText.setText('Not Ready');
                } else {
                    this.readyText.setText('Ready');
                }
            }
        }
    }
    
    /**
     * Handle player ready button click
     */
    onReadyClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Log button click for debugging
        console.log("Ready button clicked");
        this.debugText.setText("Ready button clicked");
        
        // Get current user
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        // Toggle ready status
        getCurrentRoomData()
            .then(roomData => {
                if (!roomData || !roomData.players) {
                    this.debugText.setText("Error: Room data not available");
                    return;
                }
                
                const playerData = roomData.players[currentUser.uid];
                if (playerData) {
                    // Toggle ready status
                    const newReadyStatus = !playerData.ready;
                    
                    // If not ready and no character selected, show character selection
                    if (newReadyStatus && !playerData.character) {
                        this.debugText.setText("Need to select character before ready");
                        this.showCharacterSelection();
                    } else {
                        // Just update ready status
                        this.debugText.setText(`Setting ready status to: ${newReadyStatus}`);
                        setPlayerReady(newReadyStatus)
                            .then(() => this.debugText.setText("Ready status updated successfully"))
                            .catch(err => this.debugText.setText(`Error updating ready status: ${err.message}`));
                    }
                } else {
                    this.debugText.setText("Error: Player data not found in room");
                }
            })
            .catch(error => {
                console.error("Error getting room data:", error);
                this.debugText.setText(`Error getting room data: ${error.message}`);
            });
    }
    
    /**
     * Show character selection for multiplayer
     */
    showCharacterSelection() {
        // First, clear any existing modal to prevent stacking
        if (this.characterSelectModal) {
            this.characterSelectModal.destroy();
        }
        
        // Create modal container
        this.characterSelectModal = this.add.container(0, 0);
        
        // Modal background (darken everything else)
        const modalBg = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            CONFIG.GAME_HEIGHT / 2,
            CONFIG.GAME_WIDTH,
            CONFIG.GAME_HEIGHT,
            0x000000,
            0.7
        ).setInteractive(); // Make it block input to elements below
        
        // Modal panel
        const modalPanel = this.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            CONFIG.GAME_HEIGHT / 2,
            600,
            400,
            0x333333,
            0.9
        ).setStrokeStyle(3, 0xffffff);
        
        // Title
        const titleText = this.add.text(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2 - 170, 'Select Your Character', {
            fontFamily: 'Arial',
            fontSize: '30px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Close button
        const closeButton = this.add.text(
            CONFIG.GAME_WIDTH / 2 + 280, 
            CONFIG.GAME_HEIGHT / 2 - 170, 
            'X', 
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ff0000',
                align: 'center'
            }
        ).setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            // Destroy the modal when close button is clicked
            if (this.characterSelectModal) {
                this.characterSelectModal.destroy();
                this.characterSelectModal = null;
            }
        });
        
        // Character options container
        const charactersContainer = this.add.container(0, 0);
        
        // Create character options
        this.createCharacterOptions(charactersContainer);
        
        // Add elements to modal
        this.characterSelectModal.add([modalBg, modalPanel, titleText, closeButton, charactersContainer]);
        
        // Set depth to be above other UI
        this.characterSelectModal.setDepth(100);
    }
    
    /**
     * Create character options for selection
     * @param {Phaser.GameObjects.Container} container - Container to add options to
     */
    createCharacterOptions(container) {
        // Calculate grid layout
        const gridWidth = 3;
        const gridHeight = Math.ceil(CONFIG.CHARACTERS.length / gridWidth);
        const cellWidth = 160;
        const cellHeight = 180;
        const startX = CONFIG.GAME_WIDTH / 2 - ((gridWidth * cellWidth) / 2) + (cellWidth / 2);
        const startY = CONFIG.GAME_HEIGHT / 2 - 100;
        
        // Create options for each character
        CONFIG.CHARACTERS.forEach((character, index) => {
            const col = index % gridWidth;
            const row = Math.floor(index / gridWidth);
            const x = startX + (col * cellWidth);
            const y = startY + (row * cellHeight);
            
            // Option container
            const option = this.add.container(x, y);
            
            // Background
            const bg = this.add.rectangle(0, 0, cellWidth - 20, cellHeight - 20, 0x000000, 0.5)
                .setOrigin(0.5)
                .setStrokeStyle(2, 0xffffff);
                
            // Character name
            const nameText = this.add.text(0, -60, character.name, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            // Preview sprite
            const preview = this.add.sprite(0, 0, character.texture, 0)
                .setScale(1.5);
                
            // Add animation
            const animKey = `select-preview-${character.texture}`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(character.texture, { start: 0, end: 2 }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            
            preview.play(animKey);
            
            // Select button
            const selectButton = this.add.text(0, 50, 'Select', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#4CAF50',
                align: 'center'
            }).setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => {
                // Play selection sound
                this.sound.play('sfx-powerup', { volume: 0.5 });
                
                // Select this character
                this.debugText.setText(`Selecting character: ${character.id}`);
                this.selectMultiplayerCharacter(character.id);
            });
            
            // Add hover effect
            selectButton.on('pointerover', () => {
                selectButton.setScale(1.1);
            });
            
            selectButton.on('pointerout', () => {
                selectButton.setScale(1);
            });
            
            // Make whole option clickable
            bg.setInteractive();
            bg.on('pointerdown', () => {
                // Play selection sound
                this.sound.play('sfx-powerup', { volume: 0.5 });
                
                // Select this character
                this.debugText.setText(`Selecting character: ${character.id}`);
                this.selectMultiplayerCharacter(character.id);
            });
            
            // Add hover effect to background
            bg.on('pointerover', () => {
                bg.setFillStyle(0x3498db, 0.4);
            });
            
            bg.on('pointerout', () => {
                bg.setFillStyle(0x000000, 0.5);
            });
            
            // Add elements to option
            option.add([bg, nameText, preview, selectButton]);
            
            // Add to container
            container.add(option);
        });
    }
    
    /**
     * Select a character for multiplayer
     * @param {string} characterId - ID of the selected character
     */
    selectMultiplayerCharacter(characterId) {
        // Log character selection
        console.log(`Character selected: ${characterId}`);
        
        // Set character selection
        setPlayerCharacter(characterId)
            .then(() => {
                this.debugText.setText(`Character set: ${characterId}, now setting ready status`);
                // Set ready status
                return setPlayerReady(true);
            })
            .then(() => {
                this.debugText.setText("Character selected and ready status set to true");
                // Close character selection modal
                if (this.characterSelectModal) {
                    this.characterSelectModal.destroy();
                    this.characterSelectModal = null;
                }
            })
            .catch(error => {
                console.error('Error selecting character:', error);
                this.debugText.setText(`Error selecting character: ${error.message}`);
                alert('Failed to select character. Please try again.');
            });
    }
    
    /**
     * Handle start game button click
     */
    onStartGameClicked() {
        // Get current room data
        getCurrentRoomData()
            .then(roomData => {
                // Check if all players are ready
                let allReady = true;
                let playerCount = 0;
                
                for (const playerId in roomData.players) {
                    playerCount++;
                    if (!roomData.players[playerId].ready) {
                        allReady = false;
                        break;
                    }
                }
                
                if (allReady && playerCount > 0) { // Changed from 1 to allow single player test
                    // Play button sound
                    this.sound.play('sfx-levelup', { volume: 0.7 });
                    
                    // Update debug text
                    this.debugText.setText("Starting multiplayer game...");
                    
                    // Start the game
                    startMultiplayerGame()
                        .then(() => {
                            this.debugText.setText("Game start command sent successfully");
                        })
                        .catch(error => {
                            console.error('Error starting game:', error);
                            this.debugText.setText(`Error starting game: ${error.message}`);
                            alert('Failed to start game: ' + error.message);
                        });
                } else if (playerCount <= 0) {
                    this.debugText.setText("Can't start: Need at least 1 player");
                    alert('You need at least one more player to start a multiplayer game.');
                } else {
                    this.debugText.setText("Can't start: Not all players ready");
                    alert('All players must be ready to start the game.');
                }
            })
            .catch(error => {
                console.error('Error checking room data:', error);
                this.debugText.setText(`Error checking room data: ${error.message}`);
            });
    }
    
    /**
     * Handle leave room button click
     */
    onLeaveRoomClicked() {
        // Play button sound
        this.sound.play('sfx-hit', { volume: 0.5 });
        
        // Update debug text
        this.debugText.setText("Leaving room...");
        
        // Leave the room
        this.leaveRoom();
    }
    
    /**
     * Leave the current room
     */
    leaveRoom() {
        // Leave room in Firebase
        leaveMultiplayerRoom()
            .catch(error => {
                console.error('Error leaving room:', error);
                this.debugText.setText(`Error leaving room: ${error.message}`);
            })
            .finally(() => {
                // Clean up room listeners
                this.cleanupRoomListeners();
                
                // Switch back to lobby view
                this.selectedRoom = null;
                this.roomContainer.setVisible(false);
                this.lobbyContainer.setVisible(true);
                this.currentView = 'lobby';
                
                // Update debug text
                this.debugText.setText("Left room, refreshing lobby");
                
                // Refresh room list
                this.loadRooms();
            });
    }
    
    /**
     * Clean up room listeners
     */
    cleanupRoomListeners() {
        this.roomListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (e) {
                    console.error("Error unsubscribing:", e);
                }
            }
        });
        
        this.roomListeners = [];
        
        // Also clean up connection listener if it exists
        if (this.connectionListener && window.firebase) {
            try {
                const connectedRef = window.firebase.database().ref('.info/connected');
                connectedRef.off('value', this.connectionListener);
                this.connectionListener = null;
            } catch (e) {
                console.error("Error removing connection listener:", e);
            }
        }
        
        // Clear any timeout
        if (this.connectivityTimeout) {
            clearTimeout(this.connectivityTimeout);
            this.connectivityTimeout = null;
        }
    }
    
    /**
     * Start multiplayer game
     * @param {Object} roomData - Room data
     */
    startMultiplayerGame(roomData) {
        // Play start sound if not already played
        if (!this.startedGame) {
            this.sound.play('sfx-levelup', { volume: 0.7 });
            this.startedGame = true;
        }
        
        // Check if user has a character selected
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        const playerData = roomData.players[currentUser.uid];
        if (!playerData || !playerData.character) {
            this.debugText.setText("Can't start: No character selected");
            alert('You need to select a character to play.');
            return;
        }
        
        // Update debug text
        this.debugText.setText(`Starting game with character: ${playerData.character}`);
        
        // Hide room view
        this.roomContainer.setVisible(false);
        
        // Fade out effect
        this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                // Stop menu music
                this.sound.stopByKey('music-menu');
                
                // Start actual game scene with multiplayer data
                this.scene.start('GameScene', {
                    characterId: playerData.character,
                    multiplayer: true,
                    roomId: this.selectedRoom
                });
            }
        });
    }
    
    /**
     * Add hover effect to a button
     * @param {Phaser.GameObjects.Image} button - The button to add effect to
     * @param {number} baseScale - Base scale of the button
     * @param {number} hoverScale - Scale when hovered
     */
    addButtonHoverEffect(button, baseScale = 1, hoverScale = 1.1) {
        button.on('pointerover', () => {
            this.tweens.add({
                targets: button,
                scaleX: hoverScale,
                scaleY: hoverScale,
                duration: 100
            });
        });
        
        button.on('pointerout', () => {
            this.tweens.add({
                targets: button,
                scaleX: baseScale,
                scaleY: baseScale,
                duration: 100
            });
        });
        
        button.on('pointerdown', () => {
            this.tweens.add({
                targets: button,
                scaleX: baseScale * 0.95,
                scaleY: baseScale * 0.95,
                duration: 50,
                yoyo: true
            });
        });
    }
    
    /**
     * Clean up resources when scene is shut down
     */
    shutdown() {
        // Clean up room listeners
        this.cleanupRoomListeners();
        
        // Leave room if in one
        if (this.selectedRoom) {
            leaveMultiplayerRoom().catch(e => console.error("Error leaving room during shutdown:", e));
        }
        
        // Kill all tweens
        this.tweens.killAll();
        
        // Remove all event listeners
        this.input.keyboard.shutdown();
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Clear any modal that might be open
        if (this.characterSelectModal) {
            this.characterSelectModal.destroy();
            this.characterSelectModal = null;
        }
        
        // Call parent shutdown
        super.shutdown();
    }
}