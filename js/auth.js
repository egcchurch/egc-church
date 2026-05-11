// js/auth.js

let isAuthInProgress = false;

// Prevent multiple simultaneous login attempts
function startAuth() {
  if (isAuthInProgress) return;
  isAuthInProgress = true;
}

function endAuth() {
  isAuthInProgress = false;
}

// ==================== GOOGLE LOGIN ====================
function signInWithGoogle() {
  startAuth();

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  auth.signInWithPopup(provider)
    .then((result) => {
      console.log("✅ Google login successful:", result.user.email);
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Google login error:", error.code, error.message);
      
      if (error.code === "auth/cancelled-popup-request") {
        alert("Login was cancelled. Please try again.");
      } else if (error.code === "auth/popup-blocked") {
        alert("Popup blocked by browser. Please allow popups for this site.");
      } else {
        alert("Google login failed: " + error.message);
      }
    })
    .finally(() => endAuth());
}

// ==================== EMAIL / PASSWORD LOGIN ====================
document.getElementById('email-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then((result) => {
      console.log("✅ Email login successful");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Email login error:", error.code);
      alert("Login failed: " + error.message);
    });
});

// Helper function for future registration
function showRegister() {
  alert("Registration is not yet implemented.\n\nYou can create test users in Firebase Console > Authentication.");
}