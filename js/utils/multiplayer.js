/**
 * Multiplayer.js
 * Handles multiplayer game functionality using Firebase Realtime Database
 * Compatible with Firebase v9 SDK exposed through window.firebaseFunctions
 */

// Global multiplayer variables
let currentRoom = null;
let playerPositionRef = null;
let gameStateListener = null;
let playerUpdateInterval = null;

/**
 * Ensure Firebase is loaded before executing code
 * @param {Function} callback - Function to execute when Firebase is loaded
 */
function ensureFirebaseLoaded(callback) {
    if (window.firebaseLoaded) {
        callback();
    } else {
        document.addEventListener('firebaseLoaded', callback);
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
                joinedAt: Date.now()
            };
            
            // Create a new room with a unique ID
            const roomId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            
            console.log("Creating room:", roomId, roomData);
            window.firebase.database().ref(`rooms/${roomId}`).set(roomData)
                .then(() => {
                    currentRoom = roomId;
                    console.log("Room created successfully:", roomId);
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
 * Join an existing multiplayer room
 * @param {string} roomId - Room ID to join
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function joinMultiplayerRoom(roomId) {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!isAuthenticated()) {
                reject(new Error('Must be logged in to join a multiplayer room'));
                return;
            }
            
            const user = getCurrentUser();
            
            // Check if room exists and has space
            window.firebaseFunctions.getData(`rooms/${roomId}`)
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
                    
                    // Add player to room
                    return window.firebaseFunctions.setData(`rooms/${roomId}/players/${user.uid}`, {
                        name: user.displayName || 'Player',
                        ready: false,
                        character: '',
                        host: false,
                        joinedAt: Date.now()
                    });
                })
                .then(() => {
                    currentRoom = roomId;
                    return window.firebaseFunctions.getData(`rooms/${roomId}`);
                })
                .then(snapshot => {
                    resolve(snapshot.val());
                })
                .catch(error => {
                    console.error('Error joining room:', error);
                    reject(error);
                });
        });
    });
}

/**
 * Leave current multiplayer room
 * @returns {Promise} Promise that resolves when operation is complete
 */
function leaveMultiplayerRoom() {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!currentRoom) {
                resolve();
                return;
            }
            
            const user = getCurrentUser();
            if (!user) {
                resolve();
                return;
            }
            
            // Remove player from room
            window.firebaseFunctions.removeData(`rooms/${currentRoom}/players/${user.uid}`)
                .then(() => {
                    // Check if room is now empty
                    return window.firebaseFunctions.getData(`rooms/${currentRoom}/players`);
                })
                .then(snapshot => {
                    const players = snapshot.val();
                    
                    if (!players || Object.keys(players).length === 0) {
                        // Room is empty, delete it
                        return window.firebaseFunctions.removeData(`rooms/${currentRoom}`);
                    }
                    
                    // Get current room data to check if user was host
                    return window.firebaseFunctions.getData(`rooms/${currentRoom}`)
                        .then(roomSnapshot => {
                            const roomData = roomSnapshot.val();
                            
                            // If current user was host, assign new host
                            if (user.uid === roomData.host) {
                                const newHostId = Object.keys(players)[0];
                                
                                return Promise.all([
                                    window.firebaseFunctions.setData(`rooms/${currentRoom}/host`, newHostId),
                                    window.firebaseFunctions.setData(`rooms/${currentRoom}/players/${newHostId}/host`, true)
                                ]);
                            }
                            
                            return Promise.resolve();
                        });
                })
                .then(() => {
                    currentRoom = null;
                    
                    // Clean up listeners
                    if (gameStateListener) {
                        gameStateListener();
                        gameStateListener = null;
                    }
                    
                    if (playerUpdateInterval) {
                        clearInterval(playerUpdateInterval);
                        playerUpdateInterval = null;
                    }
                    
                    resolve();
                })
                .catch(error => {
                    console.error('Error leaving room:', error);
                    reject(error);
                });
        });
    });
}

/**
 * Set player ready status in room
 * @param {boolean} isReady - Whether player is ready
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerReady(isReady) {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!currentRoom || !isAuthenticated()) {
                reject(new Error('Not in a room or not authenticated'));
                return;
            }
            
            const user = getCurrentUser();
            window.firebaseFunctions.setData(`rooms/${currentRoom}/players/${user.uid}/ready`, isReady)
                .then(() => resolve())
                .catch(error => reject(error));
        });
    });
}

/**
 * Set player character selection
 * @param {string} characterId - ID of selected character
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerCharacter(characterId) {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!currentRoom || !isAuthenticated()) {
                reject(new Error('Not in a room or not authenticated'));
                return;
            }
            
            const user = getCurrentUser();
            window.firebaseFunctions.setData(`rooms/${currentRoom}/players/${user.uid}/character`, characterId)
                .then(() => resolve())
                .catch(error => reject(error));
        });
    });
}

/**
 * Start multiplayer game (host only)
 * @returns {Promise} Promise that resolves when game starts
 */
function startMultiplayerGame() {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!currentRoom || !isAuthenticated()) {
                reject(new Error('Not in a room or not authenticated'));
                return;
            }
            
            // Get current room data
            getCurrentRoomData()
                .then(roomData => {
                    const user = getCurrentUser();
                    
                    if (roomData.host !== user.uid) {
                        throw new Error('Only the host can start the game');
                    }
                    
                    // Check if all players are ready
                    let allReady = true;
                    for (const playerId in roomData.players) {
                        if (!roomData.players[playerId].ready) {
                            allReady = false;
                            break;
                        }
                    }
                    
                    if (!allReady) {
                        throw new Error('Not all players are ready');
                    }
                    
                    // Update room status to playing
                    return window.firebaseFunctions.updateData(`rooms/${currentRoom}`, {
                        status: 'playing',
                        startedAt: Date.now()
                    });
                })
                .then(() => resolve())
                .catch(error => reject(error));
        });
    });
}

/**
 * Get current room data
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function getCurrentRoomData() {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!currentRoom) {
                reject(new Error('Not in a room'));
                return;
            }
            
            window.firebaseFunctions.getData(`rooms/${currentRoom}`)
                .then(snapshot => {
                    const roomData = snapshot.val();
                    if (!roomData) {
                        throw new Error('Room not found');
                    }
                    
                    resolve(roomData);
                })
                .catch(error => reject(error));
        });
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
    
    ensureFirebaseLoaded(() => {
        // Set up a listener for room changes
        const unsubscribe = window.firebaseFunctions.onValueChange(`rooms/${currentRoom}`, snapshot => {
            const roomData = snapshot.val();
            if (roomData) {
                callback(roomData);
            } else {
                // Room was deleted
                callback(null);
                currentRoom = null;
            }
        });
        
        gameStateListener = unsubscribe;
        
        // Return function to stop listening
        return unsubscribe;
    });
}

/**
 * Start updating player position in multiplayer game
 * @param {Phaser.Physics.Arcade.Sprite} bird - Player bird sprite
 */
function startMultiplayerSync(bird) {
    ensureFirebaseLoaded(() => {
        if (!currentRoom || !isAuthenticated()) {
            return;
        }
        
        const user = getCurrentUser();
        
        // Update position every 100ms
        playerUpdateInterval = setInterval(() => {
            window.firebaseFunctions.setData(`rooms/${currentRoom}/players/${user.uid}/position`, {
                x: bird.x,
                y: bird.y,
                timestamp: Date.now()
            });
        }, 100);
    });
}

/**
 * Stop updating player position
 */
function stopMultiplayerSync() {
    if (playerUpdateInterval) {
        clearInterval(playerUpdateInterval);
        playerUpdateInterval = null;
    }
}

/**
 * Listen for other players' positions
 * @param {Function} callback - Callback with player positions
 * @returns {Function} Function to stop listening
 */
function listenToPlayerPositions(callback) {
    if (!currentRoom) {
        return () => {};
    }
    
    ensureFirebaseLoaded(() => {
        // Set up listener for player positions
        const unsubscribe = window.firebaseFunctions.onValueChange(`rooms/${currentRoom}/players`, snapshot => {
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
            
            callback(positions);
        });
        
        // Return function to stop listening
        return unsubscribe;
    });
}

/**
 * List available multiplayer rooms
 * @returns {Promise<Array>} Promise that resolves with array of room objects
 */
function listMultiplayerRooms() {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            window.firebaseFunctions.getData('rooms')
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
                                host: roomData.hostName,
                                players: playerCount,
                                maxPlayers: roomData.maxPlayers,
                                createdAt: roomData.createdAt
                            });
                        }
                    }
                    
                    resolve(rooms);
                })
                .catch(error => {
                    console.error('Error listing rooms:', error);
                    reject(error);
                });
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
        ensureFirebaseLoaded(() => {
            if (!currentRoom) {
                resolve();
                return;
            }
            
            window.firebaseFunctions.updateData(`rooms/${currentRoom}`, {
                status: 'ended',
                endedAt: Date.now(),
                finalScores: finalScores
            })
                .then(() => resolve())
                .catch(error => reject(error));
        });
    });
}