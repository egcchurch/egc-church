// firebase-config.js
// =============================================================================
// NEW CHURCH: REPLACE THIS ENTIRE FILE before your first deploy.
//
// The values below belong to Emmanuel Gospel Centre's Firebase project.
// Your site will not work until you replace them with your own.
//
// How to get your config:
//   1. Go to https://console.firebase.google.com and open your project
//   2. Click the gear icon (top-left) > Project settings
//   3. Scroll to "Your apps" > click your web app (or "Add app" > Web)
//   4. Copy the firebaseConfig object shown there
//   5. Replace EVERY value below (apiKey, authDomain, projectId, etc.)
//      Do not leave any egc-church values — they all need to change.
//
// Is it safe to commit this file?
//   Yes. Firebase web config values are intentionally public — they identify
//   your project but do not grant access to it. Security is enforced by
//   Firestore security rules (firestore.rules) and Firebase Auth,
//   not by keeping these values secret.
// =============================================================================

const firebaseConfig = {

  apiKey: "AIzaSyAly2rtcYlwmk-TyhMqBcybUzupB76DCY8",

  authDomain: "egc-church.firebaseapp.com",

  projectId: "egc-church",

  storageBucket: "egc-church.firebasestorage.app",

  messagingSenderId: "1062334725558",

  appId: "1:1062334725558:web:6ba21350d61b55c6515517",

  measurementId: "G-LPWNC8L61B"

};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
