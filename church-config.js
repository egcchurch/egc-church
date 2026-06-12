// church-config.js — deploy-time constants
// Edit once when setting up a new instance of this template.
// Runtime config (branding, features, contact info, notification routing)
// is managed in Firestore via /admin/settings.html (Phase 8b+).
//
// After editing this file, set the matching Firebase Functions config vars:
//   firebase functions:config:set church.timezone="Africa/Johannesburg"
//   firebase functions:config:set church.domain="app.egc.church"
//   firebase functions:config:set resend.api_key="re_..."
//   firebase functions:config:set resend.from_email="noreply@yourdomain.com"
// Then redeploy functions: firebase deploy --only functions

var churchConfig = {
  name:      'Emmanuel Gospel Centre',
  shortName: 'EGC',
  timezone:  'Africa/Johannesburg',  // IANA timezone — used by weeklyDigest scheduled function
  domain:    'app.egc.church',       // primary hostname — used in email links
};
