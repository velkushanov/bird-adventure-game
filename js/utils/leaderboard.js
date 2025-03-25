/**
 * Leaderboard.js Utility Functions
 * Provides helper functions for working with leaderboards
 */

/**
 * Get top scores from leaderboard
 * @param {number} limit - Maximum number of scores to retrieve 
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<Array>} Array of score objects sorted by score
 */
function getTopScores(limit = 10, timeframe = 'all') {
    if (!firebaseDb) {
        console.error('Firebase not initialized');
        return Promise.resolve([]);
    }

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
                    name: data.name || 'Unknown Player',
                    score: data.score || 0,
                    userId: data.userId,
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
 * Get user's ranking on the leaderboard
 * @param {number} score - User's score
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<number>} User's rank (position)
 */
function getUserRanking(score, timeframe = 'all') {
    if (!firebaseDb) {
        console.error('Firebase not initialized');
        return Promise.resolve(0);
    }
    
    let query;
    
    if (timeframe === 'daily') {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        query = firebaseDb.collection('leaderboard_daily')
            .doc(today)
            .collection('scores')
            .where('score', '>', score)
            .count();
    } else if (timeframe === 'weekly') {
        // Get current week
        const now = new Date();
        const weekNum = getWeekNumber(now);
        const weekStr = `${now.getFullYear()}-W${weekNum}`;
        
        query = firebaseDb.collection('leaderboard_weekly')
            .doc(weekStr)
            .collection('scores')
            .where('score', '>', score)
            .count();
    } else {
        // All time scores
        query = firebaseDb.collection('leaderboard')
            .where('score', '>', score)
            .count();
    }
    
    return query.get()
        .then(snapshot => {
            // Return rank (number of players with higher score + 1)
            return snapshot.data().count + 1;
        })
        .catch(error => {
            console.error('Error getting user ranking:', error);
            return 0;
        });
}

/**
 * Get user's scores history
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of scores to retrieve
 * @returns {Promise<Array>} Array of score objects for the user
 */
function getUserScoreHistory(userId, limit = 10) {
    if (!firebaseDb || !userId) {
        console.error('Firebase not initialized or invalid userId');
        return Promise.resolve([]);
    }
    
    return firebaseDb.collection('leaderboard')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get()
        .then(snapshot => {
            const scores = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                scores.push({
                    id: doc.id,
                    score: data.score || 0,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                });
            });
            return scores;
        })
        .catch(error => {
            console.error('Error getting user score history:', error);
            return [];
        });
}

/**
 * Get leaderboard statistics
 * @param {string} timeframe - Time period ('all', 'daily', 'weekly')
 * @returns {Promise<Object>} Statistics object
 */
function getLeaderboardStats(timeframe = 'all') {
    if (!firebaseDb) {
        console.error('Firebase not initialized');
        return Promise.resolve({});
    }
    
    let query;
    
    if (timeframe === 'daily') {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        query = firebaseDb.collection('leaderboard_daily')
            .doc(today)
            .collection('scores');
    } else if (timeframe === 'weekly') {
        // Get current week
        const now = new Date();
        const weekNum = getWeekNumber(now);
        const weekStr = `${now.getFullYear()}-W${weekNum}`;
        
        query = firebaseDb.collection('leaderboard_weekly')
            .doc(weekStr)
            .collection('scores');
    } else {
        // All time scores
        query = firebaseDb.collection('leaderboard');
    }
    
    return query.get()
        .then(snapshot => {
            const scores = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                scores.push(data.score || 0);
            });
            
            // Calculate statistics
            const count = scores.length;
            const total = scores.reduce((sum, score) => sum + score, 0);
            const average = count > 0 ? total / count : 0;
            const highest = count > 0 ? Math.max(...scores) : 0;
            const lowest = count > 0 ? Math.min(...scores) : 0;
            
            return {
                count,
                total,
                average,
                highest,
                lowest
            };
        })
        .catch(error => {
            console.error('Error getting leaderboard stats:', error);
            return {};
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