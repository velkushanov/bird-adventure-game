/**
 * Multiplayer.js
 * Handles multiplayer game functionality using Firebase Realtime Database
 */

// Global multiplayer variables
let currentRoom = null;
let playerPositionRef = null;
let gameStateListener = null;
let playerUpdateInterval = null;

/**
 * Create a new multiplayer room
 * @returns {Promise<string>} Promise that resolves with room ID
 */
function createMultiplayerRoom() {
    if (!isAuthenticated()) {
        return Promise.reject(new Error('Must be logged in to create a multiplayer room'));
    }
    
    const user = getCurrentUser();
    
    // Create a new room in the database
    const roomsRef = firebaseRtdb.ref('rooms');
    const newRoomRef = roomsRef.push();
    
    const roomData = {
        host: user.uid,
        hostName: user.displayName || 'Host Player',
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        maxPlayers: CONFIG.MAX_PLAYERS,
        players: {}
    };
    
    // Add host as first player
    roomData.players[user.uid] = {
        name: user.displayName || 'Player',
        ready: false,
        character: '',
        host: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Save room data
    return newRoomRef.set(roomData)
        .then(() => {
            currentRoom = newRoomRef.key;
            
            // Set up auto-delete for inactive rooms
            newRoomRef.onDisconnect().remove();
            
            return currentRoom;
        })
        .catch(error => {
            console.error('Error creating room:', error);
            throw error;
        });
}

/**
 * Join an existing multiplayer room
 * @param {string} roomId - Room ID to join
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function joinMultiplayerRoom(roomId) {
    if (!isAuthenticated()) {
        return Promise.reject(new Error('Must be logged in to join a multiplayer room'));
    }
    
    const user = getCurrentUser();
    const roomRef = firebaseRtdb.ref(`rooms/${roomId}`);
    
    // Check if room exists and has space
    return roomRef.once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                throw new Error('Room not found');
            }
            
            const roomData = snapshot.val();
            
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
            return roomRef.child(`players/${user.uid}`).set({
                name: user.displayName || 'Player',
                ready: false,
                character: '',
                host: false,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            currentRoom = roomId;
            return roomRef.once('value');
        })
        .then(snapshot => {
            return snapshot.val();
        })
        .catch(error => {
            console.error('Error joining room:', error);
            throw error;
        });
}

/**
 * Leave current multiplayer room
 * @returns {Promise} Promise that resolves when operation is complete
 */
function leaveMultiplayerRoom() {
    if (!currentRoom) {
        return Promise.resolve();
    }
    
    const user = getCurrentUser();
    if (!user) {
        return Promise.resolve();
    }
    
    const playerRef = firebaseRtdb.ref(`rooms/${currentRoom}/players/${user.uid}`);
    
    // Remove player from room
    return playerRef.remove()
        .then(() => {
            // Check if room is now empty, if so delete it
            return firebaseRtdb.ref(`rooms/${currentRoom}/players`).once('value');
        })
        .then(snapshot => {
            const players = snapshot.val();
            
            if (!players || Object.keys(players).length === 0) {
                // Room is empty, delete it
                return firebaseRtdb.ref(`rooms/${currentRoom}`).remove();
            }
            
            // If current user was host, assign new host
            if (user.uid === getCurrentRoomData().host) {
                const newHostId = Object.keys(players)[0];
                
                return Promise.all([
                    firebaseRtdb.ref(`rooms/${currentRoom}/host`).set(newHostId),
                    firebaseRtdb.ref(`rooms/${currentRoom}/players/${newHostId}/host`).set(true)
                ]);
            }
            
            return Promise.resolve();
        })
        .then(() => {
            currentRoom = null;
            
            // Clean up listeners
            if (gameStateListener) {
                gameStateListener.off();
                gameStateListener = null;
            }
            
            if (playerUpdateInterval) {
                clearInterval(playerUpdateInterval);
                playerUpdateInterval = null;
            }
        })
        .catch(error => {
            console.error('Error leaving room:', error);
            throw error;
        });
}

/**
 * Set player ready status in room
 * @param {boolean} isReady - Whether player is ready
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerReady(isReady) {
    if (!currentRoom || !isAuthenticated()) {
        return Promise.reject(new Error('Not in a room or not authenticated'));
    }
    
    const user = getCurrentUser();
    return firebaseRtdb.ref(`rooms/${currentRoom}/players/${user.uid}/ready`).set(isReady);
}

/**
 * Set player character selection
 * @param {string} characterId - ID of selected character
 * @returns {Promise} Promise that resolves when operation is complete
 */
function setPlayerCharacter(characterId) {
    if (!currentRoom || !isAuthenticated()) {
        return Promise.reject(new Error('Not in a room or not authenticated'));
    }
    
    const user = getCurrentUser();
    return firebaseRtdb.ref(`rooms/${currentRoom}/players/${user.uid}/character`).set(characterId);
}

/**
 * Start multiplayer game (host only)
 * @returns {Promise} Promise that resolves when game starts
 */
function startMultiplayerGame() {
    if (!currentRoom || !isAuthenticated()) {
        return Promise.reject(new Error('Not in a room or not authenticated'));
    }
    
    // Check if user is the host
    return getCurrentRoomData()
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
            return firebaseRtdb.ref(`rooms/${currentRoom}`).update({
                status: 'playing',
                startedAt: firebase.database.ServerValue.TIMESTAMP
            });
        });
}

/**
 * Get current room data
 * @returns {Promise<Object>} Promise that resolves with room data
 */
function getCurrentRoomData() {
    if (!currentRoom) {
        return Promise.reject(new Error('Not in a room'));
    }
    
    return firebaseRtdb.ref(`rooms/${currentRoom}`).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                throw new Error('Room not found');
            }
            
            return snapshot.val();
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
    
    const roomRef = firebaseRtdb.ref(`rooms/${currentRoom}`);
    
    // Set up listener
    roomRef.on('value', snapshot => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // Room was deleted
            callback(null);
            currentRoom = null;
        }
    });
    
    // Return function to stop listening
    return () => {
        roomRef.off('value');
    };
}

/**
 * Start updating player position in multiplayer game
 * @param {Phaser.Physics.Arcade.Sprite} bird - Player bird sprite
 */
function startMultiplayerSync(bird) {
    if (!currentRoom || !isAuthenticated()) {
        return;
    }
    
    const user = getCurrentUser();
    playerPositionRef = firebaseRtdb.ref(`rooms/${currentRoom}/players/${user.uid}/position`);
    
    // Update position every 100ms
    playerUpdateInterval = setInterval(() => {
        playerPositionRef.set({
            x: bird.x,
            y: bird.y,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }, 100);
    
    // Remove position data when disconnected
    playerPositionRef.onDisconnect().remove();
}

/**
 * Stop updating player position
 */
function stopMultiplayerSync() {
    if (playerUpdateInterval) {
        clearInterval(playerUpdateInterval);
        playerUpdateInterval = null;
    }
    
    if (playerPositionRef) {
        playerPositionRef.remove();
        playerPositionRef = null;
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
    
    const positionsRef = firebaseRtdb.ref(`rooms/${currentRoom}/players`);
    
    // Set up listener
    positionsRef.on('value', snapshot => {
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
    return () => {
        positionsRef.off('value');
    };
}

/**
 * List available multiplayer rooms
 * @returns {Promise<Array>} Promise that resolves with array of room objects
 */
function listMultiplayerRooms() {
    return firebaseRtdb.ref('rooms').once('value')
        .then(snapshot => {
            const rooms = [];
            snapshot.forEach(roomSnapshot => {
                const roomData = roomSnapshot.val();
                
                // Only include rooms that are waiting for players
                if (roomData.status === 'waiting') {
                    const playerCount = Object.keys(roomData.players || {}).length;
                    
                    rooms.push({
                        id: roomSnapshot.key,
                        host: roomData.hostName,
                        players: playerCount,
                        maxPlayers: roomData.maxPlayers,
                        createdAt: roomData.createdAt
                    });
                }
            });
            
            return rooms;
        });
}

/**
 * End multiplayer game and return to lobby
 * @param {Object} finalScores - Object mapping player IDs to their final scores
 * @returns {Promise} Promise that resolves when operation is complete
 */
function endMultiplayerGame(finalScores) {
    if (!currentRoom) {
        return Promise.resolve();
    }
    
    return firebaseRtdb.ref(`rooms/${currentRoom}`).update({
        status: 'ended',
        endedAt: firebase.database.ServerValue.TIMESTAMP,
        finalScores: finalScores
    });
}