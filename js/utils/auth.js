/**
 * Auth.js
 * Handles user authentication operations
 * Compatible with Firebase v9 SDK exposed through window.firebaseFunctions
 */

/**
 * Check if user is already authenticated
 * If not, show login modal
 */
function checkUserAuth() {
    ensureFirebaseLoaded(() => {
        if (isAuthenticated()) {
            // User is already logged in, proceed to character selection
            showCharacterModal();
        } else {
            // Check if we have a stored guest session
            if (localStorage.getItem('guestSession')) {
                // Guest session exists, go to character selection
                showCharacterModal();
            } else {
                // No authentication, show login modal
                showAuthModal();
            }
        }
    });
}

/**
 * Login with Google
 */
function loginWithGoogle() {
    ensureFirebaseLoaded(() => {
        window.firebaseFunctions.signInWithGoogle()
            .then((result) => {
                // Login successful
                document.getElementById('auth-modal').style.display = 'none';
                showCharacterModal();
            })
            .catch((error) => {
                console.error('Google login error:', error);
                alert('Login failed. Please try again.');
            });
    });
}

/**
 * Login with Facebook
 */
function loginWithFacebook() {
    // Since we didn't fully set up Facebook auth, redirect to Google auth for now
    alert('Facebook login requires additional setup. Using Google authentication for demo.');
    loginWithGoogle();
}

/**
 * Login with Instagram (via Firebase custom auth)
 * Note: This requires backend setup for Instagram OAuth
 */
function loginWithInstagram() {
    // For Instagram integration, we usually need a custom backend
    // This is a simplified version that would redirect to a backend authentication endpoint
    
    alert('Instagram login requires backend setup. Using Google authentication for demo.');
    loginWithGoogle();
    
    // In a real implementation, you would:
    // 1. Redirect to your backend auth endpoint
    // 2. Backend handles Instagram OAuth flow
    // 3. Backend creates a custom token
    // 4. Frontend signs in with that custom token
}

/**
 * Play as guest (no authentication)
 */
function playAsGuest() {
    // Create a guest session ID
    const guestId = 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    localStorage.setItem('guestSession', guestId);
    
    // Set a guest display name
    const guestNames = [
        'Speedy Bird',
        'Adventure Flyer',
        'Sky Explorer',
        'Wing Master',
        'Cloud Hopper',
        'Feather Dash',
        'Brave Flapper',
        'Nimble Glider'
    ];
    
    const randomName = guestNames[Math.floor(Math.random() * guestNames.length)];
    localStorage.setItem('guestName', randomName);
    
    // Close auth modal and proceed to character selection
    document.getElementById('auth-modal').style.display = 'none';
    showCharacterModal();
}

/**
 * Get current player's display name
 * @returns {string} Player's display name
 */
function getPlayerDisplayName() {
    if (isAuthenticated()) {
        return getCurrentUser().displayName;
    } else {
        return localStorage.getItem('guestName') || 'Guest Player';
    }
}

/**
 * Get player avatar URL
 * @returns {string} URL to player avatar image
 */
function getPlayerAvatar() {
    if (isAuthenticated() && getCurrentUser().photoURL) {
        return getCurrentUser().photoURL;
    } else {
        // Default avatar for guests
        return 'assets/ui/default-avatar.png';
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
        document.addEventListener('firebaseLoaded', callback);
    }
}