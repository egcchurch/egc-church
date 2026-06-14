// js/auth.js

// ── Panel / tab management ─────────────────────────────────────────────────

function showTab(tab) {
  ['signin', 'register', 'forgot'].forEach(function (t) {
    document.getElementById('panel-' + t).classList.toggle('hidden', t !== tab);
    var btn = document.getElementById('tab-' + t);
    if (btn) {
      btn.className = t === tab
        ? 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-white shadow-sm text-[#0A3D62]'
        : 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all text-gray-500 hover:text-gray-700';
    }
  });
  clearMessages();
}

function showForgotPassword() {
  document.getElementById('panel-signin').classList.add('hidden');
  document.getElementById('panel-register').classList.add('hidden');
  document.getElementById('panel-forgot').classList.remove('hidden');
  clearMessages();
}

function showError(msg) {
  var el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

function showSuccess(msg) {
  var el = document.getElementById('auth-success');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('auth-error').classList.add('hidden');
}

function clearMessages() {
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

// ── Google sign-in ─────────────────────────────────────────────────────────

function signInWithGoogle() {
  clearMessages();
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  auth.signInWithPopup(provider)
    .then(function () { window.location.href = 'index.html'; })
    .catch(function (error) {
      if (error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/popup-blocked') {
        showError('Popup blocked by browser. Please allow popups for this site.');
      } else {
        showError('Google sign-in failed: ' + error.message);
      }
    });
}

// ── Email sign-in ──────────────────────────────────────────────────────────

document.getElementById('signin-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearMessages();

  var email    = document.getElementById('signin-email').value.trim();
  var password = document.getElementById('signin-password').value;

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(function () { window.location.href = 'index.html'; })
    .catch(function (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' ||
          error.code === 'auth/invalid-credential') {
        showError('Incorrect email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        showError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        showError('Sign-in failed: ' + error.message);
      }
    });
});

// ── Email registration ─────────────────────────────────────────────────────

document.getElementById('register-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearMessages();

  var name     = document.getElementById('reg-name').value.trim();
  var email    = document.getElementById('reg-email').value.trim();
  var password = document.getElementById('reg-password').value;
  var confirm  = document.getElementById('reg-confirm').value;

  if (!name) {
    showError('Please enter your full name.');
    return;
  }
  if (!email) {
    showError('Please enter your email address.');
    return;
  }
  if (password.length < 8) {
    showError('Password must be at least 8 characters.');
    return;
  }
  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(function (result) {
      return result.user.updateProfile({ displayName: name })
        .then(function () { return result.user.sendEmailVerification(); })
        .then(function () {
          showSuccess(
            'Account created! Check your inbox for a verification email. ' +
            'Once verified, a church admin will review and approve your account.'
          );
          document.getElementById('register-form').reset();
        });
    })
    .catch(function (error) {
      if (error.code === 'auth/email-already-in-use') {
        showError('An account with this email already exists. Try signing in instead.');
      } else if (error.code === 'auth/invalid-email') {
        showError('Please enter a valid email address.');
      } else if (error.code === 'auth/weak-password') {
        showError('Password is too weak. Please choose a stronger password.');
      } else {
        showError('Registration failed: ' + error.message);
      }
    });
});

// ── Forgot password ────────────────────────────────────────────────────────

document.getElementById('forgot-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearMessages();

  var email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showError('Please enter your email address.');
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(function () {
      showSuccess('Password reset email sent. Check your inbox.');
      document.getElementById('forgot-form').reset();
    })
    .catch(function (error) {
      if (error.code === 'auth/user-not-found') {
        // Don't confirm whether the address is registered — security best practice
        showSuccess('If that address is registered, a reset link has been sent.');
      } else {
        showError('Could not send reset email: ' + error.message);
      }
    });
});
