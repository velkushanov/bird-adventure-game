# Bird Adventure Game

A fun, side-scrolling game that combines Flappy Bird mechanics with Super Mario elements. Navigate your bird through obstacles, collect power-ups, and defeat enemies in this action-packed adventure!

## Features

- Multiple playable bird characters with unique abilities
- Super Mario inspired power-ups (mushroom, flower, star)
- Various themed backgrounds that change with levels
- Increasing difficulty with progressive levels
- Global leaderboard system
- Multiplayer mode
- Mobile and desktop compatible

## Demo

[Play the game online](https://your-github-username.github.io/bird-adventure-game) (Replace with your actual hosting URL)

## Installation

### Prerequisites

- Web server (local or remote)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Setting Up the Game

1. **Clone the repository**

```bash
git clone https://github.com/your-username/bird-adventure-game.git
cd bird-adventure-game
```

2. **Configure Firebase** (for leaderboards and multiplayer)

- Create a new Firebase project at [firebase.google.com](https://firebase.google.com)
- Enable Authentication (Google, Facebook), Firestore Database, and Realtime Database
- Get your Firebase configuration
- Update `js/config.js` with your Firebase settings:

```javascript
FIREBASE: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com"
}
```

3. **Set up Firebase Security Rules**

For Firestore Database:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /leaderboard/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /leaderboard_daily/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /leaderboard_weekly/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

For Realtime Database:

```
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": "auth != null",
      "$roomId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "players": {
      ".read": true,
      ".write": "auth != null",
      "$playerId": {
        ".read": true,
        ".write": "auth.uid == $playerId"
      }
    }
  }
}
```

4. **Serve the game**

You can use any web server to host the game. For local development, you can use:

- Python's built-in server:
  ```bash
  # Python 3
  python -m http.server 8000
  
  # Python 2
  python -m SimpleHTTPServer 8000
  ```

- Node.js with http-server:
  ```bash
  npm install -g http-server
  http-server -p 8000
  ```

5. **Access the game**

Open your browser and navigate to:
```
http://localhost:8000
```

## Game Assets

The game requires various assets to function properly. Place all assets in the `/assets` directory structure as described in the `assets-list.md` file.

### Creating or Finding Assets

- You can create your own assets using pixel art tools like Piskel, Aseprite, or GIMP
- Find free game assets on sites like:
  - [OpenGameArt.org](https://opengameart.org/)
  - [Kenney.nl](https://kenney.nl/)
  - [Itch.io Free Game Assets](https://itch.io/game-assets/free)

## Deployment

### GitHub Pages

1. Push your code to GitHub
2. Enable GitHub Pages in your repository settings
3. Set the source to the branch containing your game

### Vercel

1. Create a Vercel account
2. Connect your GitHub repository
3. Deploy from the Vercel dashboard

## Firebase Integration Details

For more detailed instructions on how to set up Firebase, refer to:
- [Firebase Authentication Guide](https://firebase.google.com/docs/auth/web/start)
- [Firestore Database Guide](https://firebase.google.com/docs/firestore/quickstart)
- [Realtime Database Guide](https://firebase.google.com/docs/database/web/start)

## Customization

You can easily customize various aspects of the game by modifying the `js/config.js` file:

- Game dimensions and physics
- Bird characters and their properties
- Difficulty scaling
- Power-up effects and durations
- And much more!

## Browser Compatibility

The game is built with modern web technologies and should work on all recent browsers:
- Chrome 60+
- Firefox 60+
- Safari 11+
- Edge 79+
- Mobile browsers with WebGL support

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Phaser.js game framework
- Firebase for backend services
- Inspired by classic games like Flappy Bird and Super Mario