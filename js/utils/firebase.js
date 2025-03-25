/**
 * Firebase.js
 * Handles Firebase initialization and core functionality
 */

// User data
let currentUser = null;
let firebaseInitialized = false;

/**
 * Wait for Firebase to load before initializing
 */
function ensureFirebaseLoaded(callback) {
    if (window.firebaseLoaded && firebaseInitialized) {
        callback();
    } else if (window.firebaseLoaded) {
        // Firebase is loaded but not initialized yet
        initializeFirebase();
        // Set a short timeout to allow initialization to complete
        setTimeout(callback, 500);
    } else {
        const listener = () => {
            initializeFirebase();
            setTimeout(callback, 500);
            document.removeEventListener('firebaseLoaded', listener);
        };
        document.addEventListener('firebaseLoaded', listener);
    }
}

/**
 * Initialize Firebase with configuration
 */
function initializeFirebase() {
    if (firebaseInitialized) {
        return;
    }
    
    if (window.firebase) {
        console.log('Firebase compat version initialized');
        
        try {
            // Set up auth state listener
            window.firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    // User is signed in
                    currentUser = {
                        uid: user.uid,
                        displayName: user.displayName || 'Player',
                        email: user.email,
                        photoURL: user.photoURL
                    };
                    
                    try {
                        // Create or update user document in Firestore
                        window.firebase.firestore().collection('users').doc(user.uid).set({
                            displayName: user.displayName || 'Player',
                            email: user.email,
                            photoURL: user.photoURL,
                            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    } catch (error) {
                        console.error('Error updating user document:', error);
                    }
                    
                    console.log('User signed in:', currentUser.displayName);
                    
                    // Dispatch event for other components to know user is signed in
                    document.dispatchEvent(new CustomEvent('userSignedIn', { detail: currentUser }));
                } else {
                    // User is signed out
                    currentUser = null;
                    console.log('User signed out');
                    
                    // Dispatch event for other components
                    document.dispatchEvent(new Event('userSignedOut'));
                }
            });
            
            // Add Firebase functions to window for easy access
            window.firebaseFunctions = {
                // Auth functions
                signInWithGoogle: () => {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    return firebase.auth().signInWithPopup(provider);
                },
                signOut: () => firebase.auth().signOut(),
                
                // Firestore functions
                getDocument: (collection, id) => {
                    return window.firebase.firestore().collection(collection).doc(id).get();
                },
                setDocument: (collection, id, data) => {
                    return window.firebase.firestore().collection(collection).doc(id).set(data);
                },
                updateDocument: (collection, id, data) => {
                    return window.firebase.firestore().collection(collection).doc(id).update(data);
                },
                addDocument: (collection, data) => {
                    return window.firebase.firestore().collection(collection).add(data);
                },
                getCollection: (collection, constraints = []) => {
                    let query = window.firebase.firestore().collection(collection);
                    
                    constraints.forEach(constraint => {
                        if (constraint.type === 'where') {
                            query = query.where(constraint.field, constraint.operator, constraint.value);
                        } else if (constraint.type === 'orderBy') {
                            query = query.orderBy(constraint.field, constraint.direction);
                        } else if (constraint.type === 'limit') {
                            query = query.limit(constraint.value);
                        }
                    });
                    
                    return query.get().then(snapshot => {
                        const results = [];
                        snapshot.forEach(doc => {
                            results.push({
                                id: doc.id,
                                ...doc.data()
                            });
                        });
                        return results;
                    });
                },
                
                // Realtime Database functions
                getData: (path) => {
                    return window.firebase.database().ref(path).once('value');
                },
                setData: (path, data) => {
                    return window.firebase.database().ref(path).set(data);
                },
                updateData: (path, data) => {
                    return window.firebase.database().ref(path).update(data);
                },
                removeData: (path) => {
                    return window.firebase.database().ref(path).remove();
                },
                onValueChange: (path, callback) => {
                    const ref = window.firebase.database().ref(path);
                    ref.on('value', callback);
                    return () => ref.off('value', callback);
                },
                
                // Helper functions
                serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),
                databaseTimestamp: () => firebase.database.ServerValue.TIMESTAMP,
                
                // Query constraints
                where: (field, operator, value) => ({
                    type: 'where',
                    field,
                    operator,
                    value
                }),
                orderBy: (field, direction = 'asc') => ({
                    type: 'orderBy',
                    field,
                    direction
                }),
                limit: (value) => ({
                    type: 'limit',
                    value
                })
            };
            
            firebaseInitialized = true;
            
            // Dispatch event for other components to know Firebase is ready
            document.dispatchEvent(new Event('firebaseInitialized'));
        } catch (error) {
            console.error('Error initializing Firebase:', error);
        }
    } else {
        console.error("Firebase not available - check script loading");
    }
}

/**
 * Check if Firebase is initialized
 * @returns {boolean} True if Firebase is initialized
 */
function isFirebaseInitialized() {
    return firebaseInitialized;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Get current user data
 * @returns {Object|null} Current user data or null if not authenticated
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Sign out current user
 * @returns {Promise} Promise that resolves when sign out is complete
 */
function signOut() {
    if (!window.firebase) {
        return Promise.reject(new Error("Firebase not initialized"));
    }
    
    return window.firebase.auth().signOut()
        .then(() => {
            console.log('User signed out successfully');
        })
        .catch(error => {
            console.error('Error signing out:', error);
            throw error;
        });
}

/**
 * Save player score to leaderboard
 * @param {number} score - Player's score
 * @returns {Promise<number>} Player's high score
 */
function saveScore(score) {
    return new Promise((resolve, reject) => {
        if (!window.firebase || !window.firebase.firestore) {
            console.error("Firebase Firestore not available");
            resolve(score);
            return;
        }
        
        if (!isAuthenticated()) {
            console.warn('Cannot save score to leaderboard: User not authenticated');
            // For guests, just use local storage
            try {
                const savedHighScore = localStorage.getItem('highScore') || 0;
                const highScore = Math.max(score, parseInt(savedHighScore));
                localStorage.setItem('highScore', highScore);
                resolve(highScore);
            } catch (error) {
                console.error('Error saving score to local storage:', error);
                resolve(score);
            }
            return;
        }
        
        const userId = currentUser.uid;
        
        try {
            // First get the user document to check their high score
            window.firebase.firestore().collection('users').doc(userId).get()
                .then(docSnapshot => {
                    let highScore = 0;
                    let userData = {};
                    
                    if (docSnapshot.exists) {
                        // Get existing data
                        userData = docSnapshot.data();
                        highScore = userData.highScore || 0;
                        
                        // Only update if new score is higher
                        if (score > highScore) {
                            highScore = score;
                            
                            // Update user document with new high score
                            return window.firebase.firestore().collection('users').doc(userId).update({
                                highScore: highScore,
                                lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                            }).then(() => {
                                // Add score to global leaderboard
                                return addScoreToLeaderboard(score).then(() => highScore);
                            });
                        } else {
                            // Just update lastPlayed
                            return window.firebase.firestore().collection('users').doc(userId).update({
                                lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                            }).then(() => highScore);
                        }
                    } else {
                        // User document doesn't exist, create it
                        highScore = score;
                        return window.firebase.firestore().collection('users').doc(userId).set({
                            displayName: currentUser.displayName,
                            email: currentUser.email,
                            photoURL: currentUser.photoURL,
                            highScore: score,
                            lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            // Add score to global leaderboard
                            return addScoreToLeaderboard(score).then(() => highScore);
                        });
                    }
                })
                .then(highScore => {
                    console.log(`Score saved. High score: ${highScore}`);
                    resolve(highScore);
                })
                .catch(error => {
                    console.error('Error saving score:', error);
                    // Still return the score even if there was an error
                    resolve(score);
                });
        } catch (error) {
            console.error('Exception saving score:', error);
            resolve(score);
        }
    });
}

/**
 * Add score to global leaderboard
 * @param {number} score - Player's score
 * @returns {Promise} Promise that resolves when score is added
 */
function addScoreToLeaderboard(score) {
    return new Promise((resolve, reject) => {
        if (!isAuthenticated() || !window.firebase) {
            resolve(); // Silently resolve for guests
            return;
        }
        
        try {
            const now = new Date();
            const userId = currentUser.uid;
            const playerName = currentUser.displayName || 'Player';
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Score data
            const scoreData = {
                userId: userId,
                name: playerName,
                score: score,
                timestamp: timestamp
            };
            
            // Batch write for efficiency
            const batch = window.firebase.firestore().batch();
            
            // Add to global leaderboard
            const globalRef = window.firebase.firestore().collection('leaderboard').doc();
            batch.set(globalRef, scoreData);
            
            // Add to daily leaderboard
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const dailyRef = window.firebase.firestore().collection(`leaderboard_daily/${dateStr}/scores`).doc();
            batch.set(dailyRef, scoreData);
            
            // Add to weekly leaderboard
            // Get ISO week number
            const weekNum = getWeekNumber(now);
            const weekStr = `${now.getFullYear()}-W${weekNum}`;
            
            const weeklyRef = window.firebase.firestore().collection(`leaderboard_weekly/${weekStr}/scores`).doc();
            batch.set(weeklyRef, scoreData);
            
            // Commit batch
            return batch.commit()
                .then(() => {
                    console.log('Score added to all leaderboards');
                    resolve();
                })
                .catch(error => {
                    console.error('Error adding score to leaderboards:', error);
                    resolve(); // Still resolve to not break the flow
                });
        } catch (error) {
            console.error('Exception adding score to leaderboard:', error);
            resolve(); // Still resolve to not break the flow
        }
    });
}

/**
 * Get week number from date
 * @param {Date} date - Date to get week number from
 * @returns {number} Week number (1-53)
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Update player status (for multiplayer)
 * @param {string} status - Player status ('menu', 'playing', 'waiting')
 */
function updatePlayerStatus(status) {
    if (!isAuthenticated() || !window.firebase) return;
    
    try {
        const userId = currentUser.uid;
        
        // Update status
        window.firebase.database().ref(`players/${userId}/status`).set({
            status: status,
            lastUpdated: Date.now()
        }).catch(error => {
            console.error('Error updating player status:', error);
        });
    } catch (error) {
        console.error('Exception updating player status:', error);
    }
}