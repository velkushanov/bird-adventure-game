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
                        query = query.where(constraint.field, constraint.operator, constraint.value);
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
                    field,
                    operator,
                    value
                }),
                orderBy: (field, direction) => ({
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
 * @returns {number} Player's high score
 */
function saveScore(score) {
    if (!isAuthenticated()) {
        console.warn('Cannot save score: User not authenticated');
        return score;
    }
    
    if (!window.firebase) {
        console.error("Firebase not initialized");
        return score;
    }
    
    const userId = currentUser.uid;
    
    try {
        // First get the user document to check their high score
        return window.firebase.firestore().collection('users').doc(userId).get()
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
                        window.firebase.firestore().collection('users').doc(userId).update({
                            highScore: highScore,
                            lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Add score to global leaderboard
                        addScoreToLeaderboard(score);
                    } else {
                        // Just update lastPlayed
                        window.firebase.firestore().collection('users').doc(userId).update({
                            lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                } else {
                    // User document doesn't exist, create it
                    highScore = score;
                    window.firebase.firestore().collection('users').doc(userId).set({
                        displayName: currentUser.displayName,
                        email: currentUser.email,
                        photoURL: currentUser.photoURL,
                        highScore: score,
                        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Add score to global leaderboard
                    addScoreToLeaderboard(score);
                }
                
                return highScore;
            })
            .catch(error => {
                console.error('Error saving score:', error);
                return score;
            });
    } catch (error) {
        console.error('Exception saving score:', error);
        return score;
    }
}

/**
 * Add score to global leaderboard
 * @param {number} score - Player's score
 */
function addScoreToLeaderboard(score) {
    if (!isAuthenticated() || !window.firebase) return;
    
    try {
        const now = new Date();
        const userId = currentUser.uid;
        const playerName = currentUser.displayName || 'Player';
        
        // Add to global leaderboard
        window.firebase.firestore().collection('leaderboard').add({
            userId: userId,
            name: playerName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to daily leaderboard
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        window.firebase.firestore().collection(`leaderboard_daily/${dateStr}/scores`).add({
            userId: userId,
            name: playerName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to weekly leaderboard
        // Get ISO week number
        const weekNum = getWeekNumber(now);
        const weekStr = `${now.getFullYear()}-W${weekNum}`;
        
        window.firebase.firestore().collection(`leaderboard_weekly/${weekStr}/scores`).add({
            userId: userId,
            name: playerName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding score to leaderboard:', error);
    }
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
        });
    } catch (error) {
        console.error('Error updating player status:', error);
    }
}