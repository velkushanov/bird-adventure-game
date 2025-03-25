/**
 * Firebase.js
 * Handles Firebase initialization and core functionality
 * This version works with the Firebase v9 SDK (exposed via window.firebaseFunctions)
 */

// User data
let currentUser = null;

/**
 * Wait for Firebase to load before initializing
 */
function ensureFirebaseLoaded(callback) {
    if (window.firebaseLoaded) {
        callback();
    } else {
        document.addEventListener('firebaseLoaded', callback);
    }
}

/**
 * Initialize Firebase with configuration
 */
function initializeFirebase() {
    ensureFirebaseLoaded(() => {
        console.log('Firebase initialized');
        
        // Set up auth state listener
        window.firebaseFunctions.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in
                currentUser = {
                    uid: user.uid,
                    displayName: user.displayName || 'Player',
                    email: user.email,
                    photoURL: user.photoURL
                };
                
                // Create or update user document in Firestore
                window.firebaseFunctions.setDocument('users', user.uid, {
                    displayName: user.displayName || 'Player',
                    email: user.email,
                    photoURL: user.photoURL,
                    lastLogin: window.firebaseFunctions.serverTimestamp()
                }, { merge: true });
                
                console.log('User signed in:', currentUser.displayName);
            } else {
                // User is signed out
                currentUser = null;
                console.log('User signed out');
            }
        });
    });
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
    return window.firebaseFunctions.signOut()
        .then(() => {
            console.log('User signed out successfully');
        })
        .catch(error => {
            console.error('Error signing out:', error);
        });
}

/**
 * Save player score to leaderboard
 * @param {number} score - Player's score
 * @returns {number} Player's high score
 */
function saveScore(score) {
    if (!isAuthenticated()) {
        console.error('Cannot save score: User not authenticated');
        return 0;
    }
    
    const userId = currentUser.uid;
    
    // First get the user document to check their high score
    return window.firebaseFunctions.getDocument('users', userId)
        .then(docSnapshot => {
            let highScore = 0;
            let userData = {};
            
            if (docSnapshot.exists()) {
                // Get existing data
                userData = docSnapshot.data();
                highScore = userData.highScore || 0;
                
                // Only update if new score is higher
                if (score > highScore) {
                    highScore = score;
                    
                    // Update user document with new high score
                    window.firebaseFunctions.updateDocument('users', userId, {
                        highScore: highScore,
                        lastPlayed: window.firebaseFunctions.serverTimestamp()
                    });
                    
                    // Add score to global leaderboard
                    addScoreToLeaderboard(score);
                } else {
                    // Just update lastPlayed
                    window.firebaseFunctions.updateDocument('users', userId, {
                        lastPlayed: window.firebaseFunctions.serverTimestamp()
                    });
                }
            } else {
                // User document doesn't exist, create it
                highScore = score;
                window.firebaseFunctions.setDocument('users', userId, {
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    photoURL: currentUser.photoURL,
                    highScore: score,
                    lastPlayed: window.firebaseFunctions.serverTimestamp()
                });
                
                // Add score to global leaderboard
                addScoreToLeaderboard(score);
            }
            
            return highScore;
        })
        .catch(error => {
            console.error('Error saving score:', error);
            return 0;
        });
}

/**
 * Add score to global leaderboard
 * @param {number} score - Player's score
 */
function addScoreToLeaderboard(score) {
    if (!isAuthenticated()) return;
    
    const now = new Date();
    const userId = currentUser.uid;
    const playerName = currentUser.displayName || 'Player';
    
    // Add to global leaderboard
    window.firebaseFunctions.addDocument('leaderboard', {
        userId: userId,
        name: playerName,
        score: score,
        timestamp: window.firebaseFunctions.serverTimestamp()
    });
    
    // Add to daily leaderboard
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    window.firebaseFunctions.addDocument(`leaderboard_daily/${dateStr}/scores`, {
        userId: userId,
        name: playerName,
        score: score,
        timestamp: window.firebaseFunctions.serverTimestamp()
    });
    
    // Add to weekly leaderboard
    // Get ISO week number
    const weekNum = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${weekNum}`;
    
    window.firebaseFunctions.addDocument(`leaderboard_weekly/${weekStr}/scores`, {
        userId: userId,
        name: playerName,
        score: score,
        timestamp: window.firebaseFunctions.serverTimestamp()
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
 * Get top scores from leaderboard
 * @param {number} limit - Number of scores to retrieve
 * @param {string} timeframe - Time frame ('all', 'daily', 'weekly')
 * @returns {Promise<Array>} Promise that resolves with array of score objects
 */
function getTopScores(limit = 10, timeframe = 'all') {
    ensureFirebaseLoaded(() => {
        let constraints = [
            window.firebaseFunctions.orderBy('score', 'desc'),
            window.firebaseFunctions.limit(limit)
        ];
        
        let collectionPath = 'leaderboard';
        
        if (timeframe === 'daily') {
            // Get today's date
            const today = new Date().toISOString().split('T')[0];
            collectionPath = `leaderboard_daily/${today}/scores`;
        } else if (timeframe === 'weekly') {
            // Get current week
            const now = new Date();
            const weekNum = getWeekNumber(now);
            const weekStr = `${now.getFullYear()}-W${weekNum}`;
            collectionPath = `leaderboard_weekly/${weekStr}/scores`;
        }
        
        return window.firebaseFunctions.getCollection(collectionPath, constraints)
            .then(scores => {
                return scores.map(score => ({
                    id: score.id,
                    name: score.name || 'Unknown Player',
                    score: score.score || 0,
                    timestamp: score.timestamp ? new Date(score.timestamp.seconds * 1000) : new Date()
                }));
            })
            .catch(error => {
                console.error('Error getting top scores:', error);
                return [];
            });
    });
}

/**
 * Get user's high score
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<number>} Promise that resolves with user's high score
 */
function getUserHighScore(userId = null) {
    ensureFirebaseLoaded(() => {
        const uid = userId || (currentUser ? currentUser.uid : null);
        
        if (!uid) {
            return Promise.resolve(0);
        }
        
        return window.firebaseFunctions.getDocument('users', uid)
            .then(docSnapshot => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    return userData.highScore || 0;
                }
                return 0;
            })
            .catch(error => {
                console.error('Error getting user high score:', error);
                return 0;
            });
    });
}

/**
 * Update player status (for multiplayer)
 * @param {string} status - Player status ('menu', 'playing', 'waiting')
 */
function updatePlayerStatus(status) {
    ensureFirebaseLoaded(() => {
        if (!isAuthenticated()) return;
        
        const userId = currentUser.uid;
        const statusPath = `players/${userId}/status`;
        
        // Update status
        window.firebaseFunctions.setData(statusPath, {
            status: status,
            lastUpdated: Date.now()
        });
        
        // Remove data when disconnected
        // Note: This is handled differently in Firebase v9 and would require server-side onDisconnect functionality
    });
}