// js/storage-upload.js
//
// The ONLY module that knows about Firebase Storage. Everything else stores and
// renders plain HTTPS URL strings, so migrating to Cloudflare R2 (or any other
// host) means rewriting just this file — no Firestore docs or rendering changes.
// See CLAUDE.md "Media Storage — Designed for Migration".
//
// Requires firebase-storage-compat.js to be loaded on the page.

/**
 * Resize and compress an image file using the Canvas API.
 * Returns a JPEG Blob at the given max dimension and quality.
 * Images already smaller than maxPx are re-encoded but not upscaled.
 * @param {File}   file     Image file to compress
 * @param {number} maxPx    Max width or height in pixels (default 1920)
 * @param {number} quality  JPEG quality 0–1 (default 0.85)
 * @returns {Promise<Blob>}
 */
function compressImage(file, maxPx = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round(height * maxPx / width);
          width = maxPx;
        } else {
          width = Math.round(width * maxPx / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Image compression failed')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

/**
 * Upload a file to Firebase Storage and return its public HTTPS URL.
 * @param {string}    path  Storage path, e.g. "gallery/<galleryId>/<fileName>"
 * @param {File|Blob} file  The file or blob to upload
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
