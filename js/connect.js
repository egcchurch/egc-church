// js/connect.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('connect-form');
  form.addEventListener('submit', handleSubmit);
});

function handleSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const message = document.getElementById('f-message').value.trim();
  const error = document.getElementById('form-error');

  if (!name || !email || !message) {
    showError('Please fill in your name, email, and message.');
    return;
  }

  error.classList.add('hidden');
  setSubmitting(true);

  firebase.firestore().collection('connect').add({
    name,
    email,
    phone: phone || null,
    message,
    read: false,
    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
  })
    .then(() => {
      document.getElementById('connect-form').classList.add('hidden');
      document.getElementById('success-msg').classList.remove('hidden');
    })
    .catch((err) => {
      console.error('Error submitting connect form:', err);
      showError('Sorry, something went wrong. Please try again.');
      setSubmitting(false);
    });
}

function setSubmitting(isSubmitting) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? 'Sending...' : 'Send Message';
  btn.classList.toggle('opacity-60', isSubmitting);
  btn.classList.toggle('cursor-not-allowed', isSubmitting);
}

function showError(msg) {
  const error = document.getElementById('form-error');
  error.textContent = msg;
  error.classList.remove('hidden');
}

function resetForm() {
  document.getElementById('connect-form').reset();
  document.getElementById('connect-form').classList.remove('hidden');
  document.getElementById('success-msg').classList.add('hidden');
  setSubmitting(false);
}
