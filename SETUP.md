# Church Website Setup Guide

This repo is a ready-to-deploy PWA template for a church website. Follow the
steps below to create your own instance. After the initial setup you will never
need the Firebase CLI or a code editor to customise the site -- everything is
managed from the admin panel.

---

## Before You Start

You will need:

- A [Firebase](https://firebase.google.com) account (free to sign up)
- [Node.js](https://nodejs.org) 18 or later
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- Git (to clone and push your repo)

---

## Step 1 — Fork the template

On GitHub, open the `egcchurch/egc-church` repository and click
**"Use this template" > "Create a new repository"**. This creates a fresh repo
in your account with no EGC commit history.

Clone your new repo locally:

```
git clone https://github.com/YOUR-ORG/YOUR-REPO.git
cd YOUR-REPO
```

---

## Step 2 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** and follow the wizard
3. Choose the **Blaze (pay-as-you-go)** plan -- Cloud Functions require it.
   Usage at church scale stays well within the free tier limits.

---

## Step 3 — Enable Firebase services

In the Firebase console for your new project, enable:

| Service | Notes |
|---|---|
| Authentication | Enable Google and Email/Password providers |
| Firestore | Create a database in production mode |
| Storage | Accept default rules for now |
| Hosting | Add two sites: `your-app` (prod) and `your-staging` (staging) |
| Functions | Enabled automatically on the Blaze plan |

---

## Step 4 — Add your Firebase config

1. In the Firebase console, go to **Project settings > Your apps**
2. Click **Add app > Web**
3. Copy the `firebaseConfig` object
4. Open `firebase-config.js` in your repo and replace the existing config object
   with your own values

The file should look like:

```js
const firebaseConfig = {
  apiKey:            "YOUR-API-KEY",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.firebasestorage.app",
  messagingSenderId: "YOUR-SENDER-ID",
  appId:             "YOUR-APP-ID",
  measurementId:     "YOUR-MEASUREMENT-ID",   // optional
};
firebase.initializeApp(firebaseConfig);
```

---

## Step 5 — Run the setup script

The setup script replaces all "Emmanuel Gospel Centre" / "EGC" placeholder text
in the HTML files, manifest, and config with your church's name.

**Windows (PowerShell):**

```powershell
./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC"
```

Or with a custom domain:

```powershell
./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC" -Domain "app.gracechurch.com"
```

**Mac / Linux (Bash):**

```bash
chmod +x setup.sh
./setup.sh "Grace Community Church" GCC
# or with a domain:
./setup.sh "Grace Community Church" GCC app.gracechurch.com
```

The script updates page titles, the nav logo text, the PWA manifest name, and
`church-config.js`. It is safe to re-run if you need to correct a typo.

---

## Step 6 — Edit `church-config.js`

Open `church-config.js` and confirm these values:

```js
var churchConfig = {
  name:      "Grace Community Church",   // already set by the setup script
  shortName: "GCC",                      // already set by the setup script
  timezone:  "America/New_York",         // your IANA timezone
  domain:    "app.gracechurch.com",      // your Firebase Hosting URL
};
```

Change `timezone` to your local IANA timezone string
(e.g. `America/Chicago`, `Europe/London`, `Africa/Nairobi`).

---

## Step 7 — Set Firebase Functions environment variables

The weekly digest and email alerts read these values from Firebase Functions
config. Run these commands from the repo root:

```
firebase functions:config:set church.timezone="America/New_York"
firebase functions:config:set church.domain="app.gracechurch.com"
```

If you want email alerts when someone fills in the connect form (recommended):

```
firebase functions:config:set resend.api_key="re_YOUR_KEY"
firebase functions:config:set resend.from_email="noreply@gracechurch.com"
```

Sign up for a free [Resend](https://resend.com) account to get an API key.
The free tier covers 3,000 emails/month, which is more than enough for a church.
If you skip this step, connect form submissions are still saved to Firestore --
email alerts are just not sent until you configure the API key.

---

## Step 8 — Update `.firebaserc` and `firebase.json`

Open `.firebaserc` and replace the site targets with your own:

```json
{
  "projects": { "default": "your-project-id" },
  "targets": {
    "your-project-id": {
      "hosting": {
        "production": ["your-app-site"],
        "staging":    ["your-staging-site"]
      }
    }
  }
}
```

Open `firebase.json` and update the `site` values under `hosting` to match.

---

## Step 9 — Deploy

```
firebase login
firebase deploy
```

This deploys Hosting (both sites), Cloud Functions, Firestore rules, and
Storage rules in one command. Your site is now live.

If you want to deploy only specific parts:

```
firebase deploy --only hosting:production
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## Step 10 — Create the first superadmin

1. Open your live site and register an account (the first account you want to
   be the admin)
2. Verify your email address via the link in the verification email
3. In the Firebase console, open **Firestore > users > YOUR-UID**
4. Set `isSuperadmin` to `true` and `membership` to `"member"`
5. Sign out and sign back in -- your account now has full admin access

---

## After Setup

Log in to your site and go to **/admin/settings** to complete configuration:

- **Church Info** -- display name, tagline, address, contact details, social links
- **Branding** -- primary and accent colours (colour pickers), logo upload
- **Notifications** -- connect form alert email address
- **Features** -- toggle modules on/off (music, gallery, live stream, etc.)

No code changes or redeployments are needed for any of these settings.

---

## Ongoing Customisation

| Task | Where |
|---|---|
| Add/manage sermons | /admin/sermons |
| Manage events | /admin/events |
| Write announcements | /admin/blog |
| Update leadership team | /admin/team |
| Manage galleries | /admin/gallery |
| Upload music | /admin/music |
| Approve new members | /admin/users |
| Send notifications | /admin/notifications |
| Edit homepage content | /admin/homepage |
| Change branding / features | /admin/settings |

All content is managed through the admin UI. The only time you need a code
editor or Firebase CLI after initial setup is to deploy code updates from the
upstream template (optional -- you can stay on your fork indefinitely).

---

## Pulling Updates from the Template

If new features are published to the upstream `egcchurch/egc-church` template,
you can pull them into your fork:

```
git remote add upstream https://github.com/egcchurch/egc-church.git
git fetch upstream
git merge upstream/main
```

Resolve any conflicts (typically just `firebase-config.js` and `church-config.js`,
which you customised). Then re-run `firebase deploy`.
