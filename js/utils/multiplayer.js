/**
 * Multiplayer.js
 * Handles multiplayer game functionality using Firebase Realtime Database
 */

// Global multiplayer variables
let currentRoom = null;
let playerPositionRef = null;
let gameStateListener = null;
let playerUpdateInterval = null;
let firebaseListeners = []; // Track all listeners for cleanup

// Debug flag - set to true for verbose logging
const MULTIPLAYER_DEBUG = true;

/**
 * Debug logging function for multiplayer
 * @param {...any} args - Arguments to log
 */
function mpLog(...args) {
    if (MULTIPLAYER_DEBUG) {
        console.log('[Multiplayer]', ...args);
    }
}

/**
 * Ensure Firebase is loaded before executing code
 * @param {Function} callback - Function to execute when Firebase is loaded
 */
function ensureFirebaseLoaded(callback) {
    if (window.firebaseLoaded) {
        callback();
    } else {
        const listener = () => {
            callback();
            document.removeEventListener('firebaseLoaded', listener);
        };
        document.addEventListener('firebaseLoaded', listener);
    }
}

/**
 * Create a new multiplayer room
 * @returns {Promise<string>} Promise that resolves with room ID
 */
function createMultiplayerRoom() {
    return new Promise((resolve, reject) => {
        if (!window.firebase) {
            console.error("Firebase not initialized!");
            reject(new Error("Firebase not initialized"));
            return;
        }

        try {
            if (!isAuthenticated()) {
                reject(new Error('Must be logged in to create a multiplayer room'));
                return;
            }
            
            const user = getCurrentUser();
            mpLog("Creating room for user:", user.uid, user.displayName);
            
            // Create a new room data object
            const roomData = {
                host: user.uid,
                hostName: user.displayName || 'Host Player',
                status: 'waiting',
                createdAt: Date.now(),
                maxPlayers: CONFIG.MAX_PLAYERS,
                players: {}
            };
            
            // Add host as first player
            roomData.players[user.uid] = {
                name: user.displayName || 'Player',
                ready: false,
                character: '',
                host: true,
                joinedAt: Date.now(),
                position: {
                    x: CONFIG.BIRD_START_X,
                    y: CONFIG.BIRD_START_Y,
                    timestamp: Date.now()
                }
            };
            
            // Create a new room with a unique ID
            const roomId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            
            mpLog("Creating room with ID:", roomId, roomData);
            window.firebase.database().ref(`rooms/${roomId}`).set(roomData)
                .then(() => {
                    currentRoom = roomId;
                    mpLog("Room created successfully:", roomId);
                    
                    // Set up cleanup on window unload
                    setupRoomCleanup(roomId, user.uid);
                    
                    resolve(currentRoom);
                })
                .catch(error => {
                    console.error('Error creating room:', error);
                    reject(error);
                });
        } catch (err) {
            console.error("Exception creating room:", err);
            reject(err);
        }
    });
}

/**
 * Set up cleanup for room if user unexpectedly leaves (browser close, etc)
 */
function setupRoomCleanup(roomId, userId) {
    // Don't set up multiple cleanup handlers
    if (window.onbeforeunload) {
        return;
    }
    
    window.onbeforeunload = () => {
        // Try to clean up room resources
        cleanupAllFirebaseListeners();
        
        // If user is host, mark room for deletion
        if (currentRoom) {
            const userRef = window.firebase.database().ref(`rooms/${currentRoom}/players/${userId}`);
            userRef.remove().catch(() => {});
            
            // Check if we're the host
            window.firebase.database().ref(`rooms/${currentRoom}/host`).once('value')
                .then(snapshot => {
                    if (snapshot.val() === userId) {
                        // We're the host, mark room for cleanup
                        window.firebase.database().ref(`rooms/${currentRoom}/status`).set('closed')
                            .catch(() => {});
                    }
                })
                .catch(() => {});
        }
    };
}

/**
 * Join an existing multiplayer room
 * @param {string} roomId - Room ID to join
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function joinMultiplayerRoom(roomId) {
    return new Promise((resolve, reject) => {
        if (!window.firebase) {
            reject(new Error("Firebase not initialized"));
            return;
        }
        
        if (!isAuthenticated()) {
            reject(new Error('Must be logged in to join a multiplayer room'));
            return;
        }
        
        const user = getCurrentUser();
        mpLog("Joining room:", roomId, "User:", user.uid);
        
        // Check if room exists and has space
        window.firebase.database().ref(`rooms/${roomId}`).once('value')
            .then(snapshot => {
                const roomData = snapshot.val();
                
                if (!roomData) {
                    throw new Error('Room not found');
                }
                
                // Check if game is already in progress
                if (roomData.status === 'playing') {
                    throw new Error('Game already in progress');
                }
                
                // Check if room is full
                const playerCount = Object.keys(roomData.players || {}).length;
                if (playerCount >= roomData.maxPlayers) {
                    throw new Error('Room is full');
                }
                
                // Add player to room with initial position
                return window.firebase.database().ref(`rooms/${roomId}/players/${user.uid}`).set({
                    name: user.displayName || 'Player',
                    ready: false,
                    character: '',
                    host: false,
                    joinedAt: Date.now(),
                    position: {
                        x: CONFIG.BIRD_START_X,
                        y: CONFIG.BIRD_START_Y,
                        timestamp: Date.now()
                    }
                });
            })
            .then(() => {
                currentRoom = roomId;
                mpLog("Successfully joined room:", roomId);
                
                // Set up cleanup on window unload
                setupRoomCleanup(roomId, user.uid);
                
                return window.firebase.database().ref(`rooms/${roomId}`).once('value');
            })
            .then(snapshot => {
                resolve(snapshot.val());
            })
            .catch(error => {
                console.error('Error joining room:', error);
                reject(error);
            });
    });
}

/**
 * Leave current multiplayer room
 * @returns {Promise} Promise that resolves when operation is complete
 */
function leaveMultiplayerRoom() {
    return new Promise((resolve, reject) => {
        if (!currentRoom) {
            cleanupAllFirebaseListeners();
            resolve();
            return;
        }
        
        const user = getCurrentUser();
        if (!user) {
            cleanupAllFirebaseListeners();
            currentRoom = null;
            resolve();
            return;
        }
        
        mpLog("Leaving room:", currentRoom);
        
        try {
            // Remove player from room
            window.firebase.database().ref(`rooms/${currentRoom}/players/${user.uid}`).remove()
                .then(() => {
                    // Check if room is now empty
                    return window.firebase.database().ref(`rooms/${currentRoom}/players`).once('value');
                })
                .then(snapshot => {
                    const players = snapshot.val();
                    
                    if (!players || Object.keys(players).length === 0) {
                        // Room is empty, delete it
                        mpLog("Room is empty, removing room:", currentRoom);
                        return window.firebase.database().ref(`rooms/${currentRoom}`).remove();
                    }
                    
                    // Get current room data to check if user was host
                    return window.firebase.database().ref(`rooms/${currentRoom}`).once('value')
                        .then(roomSnapshot => {
                            const roomData = roomSnapshot.val();
                            
                            // If current user was host, assign new host
                            if (roomData && user.uid === roomData.host) {
                                const newHostId = Object.keys(players)[0];
                                mpLog("Assigning new host:", newHostId);
                                
                                return Promise.all([
                                    window.firebase.database().ref(`rooms/${currentRoom}/host`).set(newHostId),
                                    window.firebase.database().ref(`rooms/${currentRoom}/hostName`).set(players[newHostId].name),
                                    window.firebase.database().ref(`rooms/${currentRoom}/players/${newHostId}/host`).set(true)
                                ]);
                            }
                            
                            return Promise.resolve();
                        });
                })
                .then(() => {
                    currentRoom = null;
                    
                    // Clean up all listeners
                    cleanupAllFirebaseListeners();
                    
                    if (playerUpdateInterval) {
                        clearInterval(playerUpdateInterval);
                        playerUpdateInterval = null;
                    }
                    
                    // Remove window unload handler
                    window.onbeforeunload = null;
                    
                    mpLog("Successfully left room");
                    resolve();
                })
                .catch(error => {
                    console.error('Error leaving room:', error);
                    
                    // Still clean up resources even if there was an error
                    currentRoom = null;
                    cleanupAllFirebaseListeners();
                    
                    if (playerUpdateInterval) {
                        clearInterval(playerUpdateInterval);
                        playerUpdateInterval = null;
                    }
                    
                    // Remove window unload handler
                    window.onbeforeunload = null;
                    
                    reject(error);
                });
        } catch (error) {
            console.error('Exception leaving room:', error);
            
            // Still clean up resources
            currentRoom = null;
            cleanupAllFirebaseListeners();
            
            if (playerUpdateInterval) {
                clearInterval(playerUpdateInterval);
                playerUpdateInterval = null;
            }
            
            // Remove window unload handler
            window.onbeforeunload = null;
            
            reject(error);
        }
    });
}

/**
 * Clean up all Firebase listeners
 */
function cleanupAllFirebaseListeners() {
    // Clean up game state listener
    if (gameStateListener && typeof gameStateListener === 'function') {
        try {
            gameStateListener();
            gameStateListener = null;
        } catch (e) {
            console.error("Error cleaning up game state listener:", e);
        }
    }
    
    // Clean up all tracked listeners
    firebaseListeners.forEach(listener => {
        try {
            if (typeof listener.off === 'function') {
                listener.off();
            } else if (typeof listener === 'function') {
                listener();
            }
        } catch (e) {
            console.error("Error cleaning up Firebase listener:", e);
        }
    });
    
    firebaseListeners = [];
}

/**
 * Set player ready status in room
 * @param {boolean} isReady - Whether player is ready
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerReady(isReady) {
    return new Promise((resolve, reject) => {
        if (!currentRoom || !isAuthenticated()) {
            reject(new Error('Not in a room or not authenticated'));
            return;
        }
        
        const user = getCurrentUser();
        mpLog("Setting player ready status:", isReady, "User:", user.uid);
        
        window.firebase.database().ref(`rooms/${currentRoom}/players/${user.uid}/ready`).set(isReady)
            .then(() => resolve())
            .catch(error => reject(error));
    });
}

/**
 * Set player character selection
 * @param {string} characterId - ID of selected character
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerCharacter(characterId) {
    return new Promise((resolve, reject) => {
        if (!currentRoom || !isAuthenticated()) {
            reject(new Error('Not in a room or not authenticated'));
            return;
        }
        
        const user = getCurrentUser();
        mpLog("Setting player character:", characterId, "User:", user.uid);
        
        window.firebase.database().ref(`rooms/${currentRoom}/players/${user.uid}/character`).set(characterId)
            .then(() => resolve())
            .catch(error => reject(error));
    });
}

/**
 * Start multiplayer game (host only)
 * @returns {Promise} Promise that resolves when game starts
 */
function startMultiplayerGame() {
    return new Promise((resolve, reject) => {
        if (!currentRoom || !isAuthenticated()) {
            reject(new Error('Not in a room or not authenticated'));
            return;
        }
        
        mpLog("Starting multiplayer game");
        
        // Get current room data
        getCurrentRoomData()
            .then(roomData => {
                const user = getCurrentUser();
                
                if (roomData.host !== user.uid) {
                    throw new Error('Only the host can start the game');
                }
                
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
                
                if (!allReady) {
                    throw new Error('Not all players are ready');
                }
                
                if (playerCount < 1) { // Changed from 2 to 1 for testing
                    throw new Error('At least 1 player is required');
                }
                
                // Update room status to playing
                const updates = {
                    status: 'playing',
                    startedAt: Date.now()
                };
                
                mpLog("Game starting with updates:", updates);
                return window.firebase.database().ref(`rooms/${currentRoom}`).update(updates);
            })
            .then(() => resolve())
            .catch(error => reject(error));
    });
}

/**
 * Get current room data
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function getCurrentRoomData() {
    return new Promise((resolve, reject) => {
        if (!currentRoom) {
            reject(new Error('Not in a room'));
            return;
        }
        
        window.firebase.database().ref(`rooms/${currentRoom}`).once('value')
            .then(snapshot => {
                const roomData = snapshot.val();
                if (!roomData) {
                    throw new Error('Room not found');
                }
                
                resolve(roomData);
            })
            .catch(error => reject(error));
    });
}

/**
 * Listen for room state changes
 * @param {Function} callback - Callback function when room state changes
 * @returns {Function} Function to stop listening
 */
function listenToRoomChanges(callback) {
    if (!currentRoom) {
        return () => {};
    }
    
    try {
        mpLog("Setting up room listener for room:", currentRoom);
        
        // Set up a listener for room changes
        const roomRef = window.firebase.database().ref(`rooms/${currentRoom}`);
        const onRoomChange = roomRef.on('value', snapshot => {
            const roomData = snapshot.val();
            if (roomData) {
                mpLog("Room data updated:", roomData.status);
                callback(roomData);
            } else {
                // Room was deleted
                mpLog("Room was deleted");
                callback(null);
                currentRoom = null;
            }
        }, error => {
            console.error("Error in room listener:", error);
            // Keep the app functional even if there's an error
            callback(null);
        });
        
        // Track this listener
        firebaseListeners.push({
            off: () => roomRef.off('value', onRoomChange)
        });
        
        // Store reference to cleanup function
        const unsubscribe = () => {
            mpLog("Unsubscribing from room changes");
            roomRef.off('value', onRoomChange);
        };
        
        gameStateListener = unsubscribe;
        
        // Return function to stop listening
        return unsubscribe;
    } catch (error) {
        console.error("Error setting up room listener:", error);
        return () => {};
    }
}

/**
 * Start updating player position in multiplayer game
 * @param {Phaser.Physics.Arcade.Sprite} bird - Player bird sprite
 */
function startMultiplayerSync(bird) {
    if (!currentRoom || !isAuthenticated() || !bird) {
        console.error("Cannot start multiplayer sync: missing requirements");
        return;
    }
    
    const user = getCurrentUser();
    
    // Clear any existing interval
    if (playerUpdateInterval) {
        clearInterval(playerUpdateInterval);
    }
    
    mpLog("Starting position sync for player:", user.uid, "in room:", currentRoom);
    
    // Send initial position immediately
    try {
        const initialPosition = {
            x: bird.x,
            y: bird.y,
            rotation: bird.rotation,
            scale: bird.scale,
            tint: bird.tintTopLeft || 0xffffff,
            timestamp: Date.now()
        };
        
        window.firebase.database().ref(`rooms/${currentRoom}/players/${user.uid}/position`).update(initialPosition)
            .then(() => {
                mpLog("Initial position sent successfully:", initialPosition);
            })
            .catch(error => {
                console.error("Error sending initial position:", error);
            });
    } catch (error) {
        console.error("Exception sending initial position:", error);
    }
    
    // Update position every 50ms (more frequent updates for smoother gameplay)
    playerUpdateInterval = setInterval(() => {
        if (!currentRoom || !bird || !bird.active) {
            // Stop syncing if no longer valid
            clearInterval(playerUpdateInterval);
            playerUpdateInterval = null;
            return;
        }
        
        try {
            // Only update if the bird is still alive
            if (!bird.isDead) {
                const position = {
                    x: bird.x,
                    y: bird.y,
                    rotation: bird.rotation,
                    scale: bird.scaleX, // Use scaleX since it's a number not an object
                    tint: bird.tintTopLeft || 0xffffff, // Store tint for visual effects
                    timestamp: Date.now()
                };
                
                window.firebase.database().ref(`rooms/${currentRoom}/players/${user.uid}/position`).update(position)
                    .catch(error => {
                        mpLog("Error updating position:", error.message);
                    });
            }
        } catch (error) {
            console.error("Error updating player position:", error);
        }
    }, 50); // More frequent updates

    mpLog("Multiplayer position sync started");
}

/**
 * Stop updating player position
 */
function stopMultiplayerSync() {
    if (playerUpdateInterval) {
        clearInterval(playerUpdateInterval);
        playerUpdateInterval = null;
        mpLog("Multiplayer position sync stopped");
    }
}

/**
 * Listen for other players' positions
 * @param {Function} callback - Callback with player positions
 * @returns {Function} Function to stop listening
 */
function listenToPlayerPositions(callback) {
    if (!currentRoom) {
        mpLog("Cannot listen to player positions: not in a room");
        return () => {};
    }
    
    try {
        mpLog("Setting up player positions listener for room:", currentRoom);
        
        // Set up listener for player positions - More efficient approach
        // Only listen to the players node to reduce unnecessary data transfer
        const playersRef = window.firebase.database().ref(`rooms/${currentRoom}/players`);
        
        const onPlayersChange = playersRef.on('value', snapshot => {
            const players = snapshot.val() || {};
            const positions = {};
            
            // Get current user ID
            const currentUserId = getCurrentUser() ? getCurrentUser().uid : null;
            
            // Extract positions, excluding current player
            for (const playerId in players) {
                if (playerId !== currentUserId && players[playerId].position) {
                    positions[playerId] = {
                        position: players[playerId].position,
                        name: players[playerId].name,
                        character: players[playerId].character
                    };
                }
            }
            
            mpLog("Got positions for", Object.keys(positions).length, "other players");
            callback(positions);
        }, error => {
            console.error("Error in player positions listener:", error);
        });
        
        // Track this listener
        firebaseListeners.push({
            off: () => playersRef.off('value', onPlayersChange)
        });
        
        mpLog("Player positions listener established");
        
        // Return function to stop listening
        return () => {
            playersRef.off('value', onPlayersChange);
        };
    } catch (error) {
        console.error("Error setting up player positions listener:", error);
        return () => {};
    }
}

/**
 * List available multiplayer rooms
 * @returns {Promise<Array>} Promise that resolves with array of room objects
 */
function listMultiplayerRooms() {
    return new Promise((resolve, reject) => {
        if (!window.firebase) {
            reject(new Error("Firebase not initialized"));
            return;
        }
        
        mpLog("Listing available multiplayer rooms");
        
        window.firebase.database().ref('rooms').once('value')
            .then(snapshot => {
                const rooms = [];
                const roomsData = snapshot.val() || {};
                
                for (const roomId in roomsData) {
                    const roomData = roomsData[roomId];
                    
                    // Only include rooms that are waiting for players
                    if (roomData.status === 'waiting') {
                        const playerCount = Object.keys(roomData.players || {}).length;
                        
                        rooms.push({
                            id: roomId,
                            host: roomData.hostName || 'Unknown Host',
                            players: playerCount,
                            maxPlayers: roomData.maxPlayers || 4,
                            createdAt: roomData.createdAt || Date.now()
                        });
                    }
                }
                
                mpLog("Found", rooms.length, "available rooms");
                resolve(rooms);
            })
            .catch(error => {
                console.error('Error listing rooms:', error);
                reject(error);
            });
    });
}

/**
 * End multiplayer game and return to lobby
 * @param {Object} finalScores - Object mapping player IDs to their final scores
 * @returns {Promise} Promise that resolves when operation is complete
 */
function endMultiplayerGame(finalScores) {
    return new Promise((resolve, reject) => {
        if (!currentRoom) {
            resolve();
            return;
        }
        
        mpLog("Ending multiplayer game with scores:", finalScores);
        
        const updates = {
            status: 'ended',
            endedAt: Date.now(),
            finalScores: finalScores || {}
        };
        
        window.firebase.database().ref(`rooms/${currentRoom}`).update(updates)
            .then(() => {
                mpLog("Game ended successfully");
                resolve();
            })
            .catch(error => {
                console.error("Error ending game:", error);
                reject(error);
            });
    });
}