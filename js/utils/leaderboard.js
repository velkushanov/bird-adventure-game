/**
 * Leaderboard.js
 * Provides helper functions for working with leaderboards
 * Compatible with Firebase v9 SDK exposed through window.firebaseFunctions
 */

/**
 * Get top scores from leaderboard
 * @param {number} limit - Maximum number of scores to retrieve 
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<Array>} Array of score objects sorted by score
 */
function getTopScores(limit = 10, timeframe = 'all') {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!window.firebase || !window.firebase.firestore) {
                console.error("Firebase Firestore not available");
                resolve([]);
                return;
            }
            
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
            
            try {
                // Get scores sorted by score in descending order
                window.firebase.firestore()
                    .collection(collectionPath)
                    .orderBy('score', 'desc')
                    .limit(limit)
                    .get()
                    .then(snapshot => {
                        const scores = [];
                        snapshot.forEach(doc => {
                            scores.push({
                                id: doc.id,
                                ...doc.data()
                            });
                        });
                        
                        console.log(`Retrieved ${scores.length} scores from ${collectionPath}`);
                        resolve(scores);
                    })
                    .catch(error => {
                        console.error('Error getting top scores:', error);
                        
                        // If the collection doesn't exist yet (new timeframe), return empty array
                        if (error.code === 'permission-denied' || error.code === 'not-found') {
                            resolve([]);
                        } else {
                            reject(error);
                        }
                    });
            } catch (error) {
                console.error('Exception getting top scores:', error);
                resolve([]);
            }
        });
    });
}

/**
 * Get user's ranking on the leaderboard
 * @param {number} score - User's score
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<number>} User's rank (position)
 */
function getUserRanking(score, timeframe = 'all') {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!window.firebase || !window.firebase.firestore) {
                console.error("Firebase Firestore not available");
                resolve(0);
                return;
            }
            
            let collectionPath = 'leaderboard';
            
            if (timeframe === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                collectionPath = `leaderboard_daily/${today}/scores`;
            } else if (timeframe === 'weekly') {
                const now = new Date();
                const weekNum = getWeekNumber(now);
                const weekStr = `${now.getFullYear()}-W${weekNum}`;
                collectionPath = `leaderboard_weekly/${weekStr}/scores`;
            }
            
            try {
                // Get number of scores higher than the user's score
                window.firebase.firestore()
                    .collection(collectionPath)
                    .where('score', '>', score)
                    .get()
                    .then(snapshot => {
                        // Return rank (number of players with higher score + 1)
                        resolve(snapshot.size + 1);
                    })
                    .catch(error => {
                        console.error('Error getting user ranking:', error);
                        resolve(0);
                    });
            } catch (error) {
                console.error('Exception getting user ranking:', error);
                resolve(0);
            }
        });
    });
}

/**
 * Get user's high score
 * @returns {Promise<number>} User's high score
 */
function getUserHighScore() {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!isAuthenticated()) {
                // Return guest high score from local storage
                const localHighScore = localStorage.getItem('highScore') || 0;
                resolve(parseInt(localHighScore));
                return;
            }
            
            if (!window.firebase || !window.firebase.firestore) {
                console.error("Firebase Firestore not available");
                resolve(0);
                return;
            }
            
            const userId = getCurrentUser().uid;
            
            try {
                // Get user document from Firestore
                window.firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .get()
                    .then(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            resolve(userData.highScore || 0);
                        } else {
                            resolve(0);
                        }
                    })
                    .catch(error => {
                        console.error('Error getting user high score:', error);
                        resolve(0);
                    });
            } catch (error) {
                console.error('Exception getting user high score:', error);
                resolve(0);
            }
        });
    });
}

/**
 * Get user's scores history
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of scores to retrieve
 * @returns {Promise<Array>} Array of score objects for the user
 */
function getUserScoreHistory(userId, limit = 10) {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!window.firebase || !window.firebase.firestore) {
                console.error("Firebase Firestore not available");
                resolve([]);
                return;
            }
            
            if (!userId) {
                console.error('Invalid userId');
                resolve([]);
                return;
            }
            
            try {
                // Get user's score history
                window.firebase.firestore()
                    .collection('leaderboard')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get()
                    .then(snapshot => {
                        const scores = [];
                        snapshot.forEach(doc => {
                            scores.push({
                                id: doc.id,
                                ...doc.data()
                            });
                        });
                        resolve(scores);
                    })
                    .catch(error => {
                        console.error('Error getting user score history:', error);
                        resolve([]);
                    });
            } catch (error) {
                console.error('Exception getting user score history:', error);
                resolve([]);
            }
        });
    });
}

/**
 * Get leaderboard statistics
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<Object>} Statistics object
 */
function getLeaderboardStats(timeframe = 'all') {
    return new Promise((resolve, reject) => {
        ensureFirebaseLoaded(() => {
            if (!window.firebase || !window.firebase.firestore) {
                console.error("Firebase Firestore not available");
                resolve({});
                return;
            }
            
            let collectionPath = 'leaderboard';
            
            if (timeframe === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                collectionPath = `leaderboard_daily/${today}/scores`;
            } else if (timeframe === 'weekly') {
                const now = new Date();
                const weekNum = getWeekNumber(now);
                const weekStr = `${now.getFullYear()}-W${weekNum}`;
                collectionPath = `leaderboard_weekly/${weekStr}/scores`;
            }
            
            try {
                // Get all scores to calculate statistics
                window.firebase.firestore()
                    .collection(collectionPath)
                    .get()
                    .then(snapshot => {
                        const scores = [];
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.score) {
                                scores.push(data.score);
                            }
                        });
                        
                        // Calculate statistics
                        const count = scores.length;
                        const total = scores.reduce((sum, score) => sum + score, 0);
                        const average = count > 0 ? total / count : 0;
                        const highest = count > 0 ? Math.max(...scores) : 0;
                        const lowest = count > 0 ? Math.min(...scores) : 0;
                        
                        resolve({
                            count,
                            total,
                            average,
                            highest,
                            lowest
                        });
                    })
                    .catch(error => {
                        console.error('Error getting leaderboard stats:', error);
                        resolve({});
                    });
            } catch (error) {
                console.error('Exception getting leaderboard stats:', error);
                resolve({});
            }
        });
    });
}

/**
 * Helper function to get ISO week number from date
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
 * Ensure Firebase is loaded before executing code
 * @param {Function} callback - Function to execute when Firebase is loaded
 */
function ensureFirebaseLoaded(callback) {
    if (window.firebaseLoaded) {
        callback();
    } else {
        // Wait for Firebase to load
        const firebaseLoadedListener = () => {
            callback();
            document.removeEventListener('firebaseLoaded', firebaseLoadedListener);
        };
        document.addEventListener('firebaseLoaded', firebaseLoadedListener);
        
        // Set a timeout in case Firebase doesn't load
        setTimeout(() => {
            // Check if callback has already been executed by the event listener
            if (window.firebaseLoaded) return;
            
            // If not, execute callback to prevent blocking
            document.removeEventListener('firebaseLoaded', firebaseLoadedListener);
            console.warn('Firebase took too long to load, proceeding anyway');
            callback();
        }, 5000);
    }
}