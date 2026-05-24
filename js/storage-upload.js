// js/storage-upload.js
//
// The ONLY module that knows about Firebase Storage. Everything else stores and
// renders plain HTTPS URL strings, so migrating to Cloudflare R2 (or any other
// host) means rewriting just this file — no Firestore docs or rendering changes.
// See CLAUDE.md "Media Storage — Designed for Migration".
//
// Requires firebase-storage-compat.js to be loaded on the page.

/**
 * Upload a file to Firebase Storage and return its public HTTPS URL.
 * @param {string} path  Storage path, e.g. "gallery/<galleryId>/<fileName>"
 * @param {File}   file  The file to upload
 * @returns {Promise<string>} the getDownloadURL() HTTPS string to store in Firestore
 */
async function uploadMedia(path, file) {
  const ref = firebase.storage().ref(path);
  const snapshot = await ref.put(file);
  return snapshot.ref.getDownloadURL();
}

/**
 * Delete a file from Firebase Storage given its public HTTPS URL.
 * Safe to call with non-Firebase URLs (e.g. already migrated to R2) — it just
 * logs and resolves, so callers don't need to special-case the host.
 * @param {string} url  the stored HTTPS URL
 * @returns {Promise<void>}
 */
async function deleteMedia(url) {
  if (!url) return;
  try {
    await firebase.storage().refFromURL(url).delete();
  } catch (err) {
    // Not a Firebase Storage URL for this bucket, or already deleted — ignore.
    console.warn('deleteMedia skipped for', url, '-', err.message);
  }
}
