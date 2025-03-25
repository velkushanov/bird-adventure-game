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
            
            window.firebaseFunctions.getCollection(collectionPath, constraints)
                .then(scores => {
                    resolve(scores.map(score => ({
                        id: score.id,
                        name: score.name || 'Unknown Player',
                        score: score.score || 0,
                        userId: score.userId,
                        timestamp: score.timestamp ? new Date(score.timestamp.seconds * 1000) : new Date()
                    })));
                })
                .catch(error => {
                    console.error('Error getting top scores:', error);
                    resolve([]);
                });
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
            
            const constraints = [
                window.firebaseFunctions.where('score', '>', score)
            ];
            
            window.firebaseFunctions.getCollection(collectionPath, constraints)
                .then(higherScores => {
                    // Return rank (number of players with higher score + 1)
                    resolve(higherScores.length + 1);
                })
                .catch(error => {
                    console.error('Error getting user ranking:', error);
                    resolve(0);
                });
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
            if (!userId) {
                console.error('Invalid userId');
                resolve([]);
                return;
            }
            
            const constraints = [
                window.firebaseFunctions.where('userId', '==', userId),
                window.firebaseFunctions.orderBy('timestamp', 'desc'),
                window.firebaseFunctions.limit(limit)
            ];
            
            window.firebaseFunctions.getCollection('leaderboard', constraints)
                .then(scores => {
                    resolve(scores.map(score => ({
                        id: score.id,
                        score: score.score || 0,
                        timestamp: score.timestamp ? new Date(score.timestamp.seconds * 1000) : new Date()
                    })));
                })
                .catch(error => {
                    console.error('Error getting user score history:', error);
                    resolve([]);
                });
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
            
            window.firebaseFunctions.getCollection(collectionPath, [])
                .then(scores => {
                    const scoreValues = scores.map(s => s.score || 0);
                    
                    // Calculate statistics
                    const count = scoreValues.length;
                    const total = scoreValues.reduce((sum, score) => sum + score, 0);
                    const average = count > 0 ? total / count : 0;
                    const highest = count > 0 ? Math.max(...scoreValues) : 0;
                    const lowest = count > 0 ? Math.min(...scoreValues) : 0;
                    
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
        document.addEventListener('firebaseLoaded', callback);
    }
}