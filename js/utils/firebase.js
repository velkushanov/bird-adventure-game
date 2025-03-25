/**
 * Firebase.js
 * Handles Firebase initialization and core functionality
 */

// Firebase app instance
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseRtdb = null;
let currentUser = null;

/**
 * Initialize Firebase with configuration
 */
function initializeFirebase() {
    // Initialize Firebase only if not already initialized
    if (!firebaseApp) {
        firebaseApp = firebase.initializeApp(CONFIG.FIREBASE);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        firebaseRtdb = firebase.database();
        
        // Set up auth state listener
        firebaseAuth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in
                currentUser = {
                    uid: user.uid,
                    displayName: user.displayName || 'Player',
                    email: user.email,
                    photoURL: user.photoURL
                };
                
                // Create or update user document in Firestore
                firebaseDb.collection('users').doc(user.uid).set({
                    displayName: user.displayName || 'Player',
                    email: user.email,
                    photoURL: user.photoURL,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                console.log('User signed in:', currentUser.displayName);
            } else {
                // User is signed out
                currentUser = null;
                console.log('User signed out');
            }
        });
    }
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
    return firebaseAuth.signOut()
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
    const userRef = firebaseDb.collection('users').doc(userId);
    
    // First get the user document to check their high score
    return userRef.get()
        .then(doc => {
            let highScore = 0;
            
            if (doc.exists) {
                // Get current high score
                highScore = doc.data().highScore || 0;
                
                // Only update if new score is higher
                if (score > highScore) {
                    highScore = score;
                    
                    // Update user document with new high score
                    userRef.update({
                        highScore: highScore,
                        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Add score to global leaderboard
                    addScoreToLeaderboard(score);
                } else {
                    // Just update lastPlayed
                    userRef.update({
                        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                // User document doesn't exist, create it
                highScore = score;
                userRef.set({
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
    firebaseDb.collection('leaderboard').add({
        userId: userId,
        name: playerName,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Add to daily leaderboard
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    firebaseDb.collection('leaderboard_daily').doc(dateStr).collection('scores').add({
        userId: userId,
        name: playerName,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Add to weekly leaderboard
    // Get ISO week number
    const weekNum = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${weekNum}`;
    
    firebaseDb.collection('leaderboard_weekly').doc(weekStr).collection('scores').add({
        userId: userId,
        name: playerName,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
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
    let query;
    
    if (timeframe === 'daily') {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        query = firebaseDb.collection('leaderboard_daily')
            .doc(today)
            .collection('scores')
            .orderBy('score', 'desc')
            .limit(limit);
    } else if (timeframe === 'weekly') {
        // Get current week
        const now = new Date();
        const weekNum = getWeekNumber(now);
        const weekStr = `${now.getFullYear()}-W${weekNum}`;
        
        query = firebaseDb.collection('leaderboard_weekly')
            .doc(weekStr)
            .collection('scores')
            .orderBy('score', 'desc')
            .limit(limit);
    } else {
        // All time scores
        query = firebaseDb.collection('leaderboard')
            .orderBy('score', 'desc')
            .limit(limit);
    }
    
    return query.get()
        .then(snapshot => {
            const scores = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                scores.push({
                    id: doc.id,
                    name: data.name,
                    score: data.score,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                });
            });
            return scores;
        })
        .catch(error => {
            console.error('Error getting top scores:', error);
            return [];
        });
}

/**
 * Get user's high score
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<number>} Promise that resolves with user's high score
 */
function getUserHighScore(userId = null) {
    const uid = userId || (currentUser ? currentUser.uid : null);
    
    if (!uid) {
        return Promise.resolve(0);
    }
    
    return firebaseDb.collection('users').doc(uid).get()
        .then(doc => {
            if (doc.exists) {
                return doc.data().highScore || 0;
            }
            return 0;
        })
        .catch(error => {
            console.error('Error getting user high score:', error);
            return 0;
        });
}

/**
 * Update player status (for multiplayer)
 * @param {string} status - Player status ('menu', 'playing', 'waiting')
 */
function updatePlayerStatus(status) {
    if (!isAuthenticated()) return;
    
    const userId = currentUser.uid;
    const statusRef = firebaseRtdb.ref(`players/${userId}/status`);
    
    // Update status
    statusRef.set({
        status: status,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Set up cleanup on disconnect
    statusRef.onDisconnect().remove();
}