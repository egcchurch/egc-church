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
- Git

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
3. Choose the **Blaze (pay-as-you-go)** plan — Cloud Functions require it.
   Usage at church scale stays well within the free tier limits.
4. Note your **project ID** shown during creation (e.g. `grace-church-777`).
   You will use it in several places below.

---

## Step 3 — Enable Firebase services

In the Firebase console for your new project, enable each service:

**Authentication**
- Build > Authentication > Get started
- Sign-in method tab > Enable **Google** and **Email/Password**

**Firestore**
- Build > Firestore Database > Create database
- Choose **production mode** — the security rules in this repo take over
- Pick the region closest to your congregation

**Storage**
- Build > Storage > Get started
- Accept the default rules for now (this repo's `storage.rules` will replace them on deploy)

**Hosting**
- Build > Hosting > Get started
- Create two sites:
  - One for **production** (e.g. `grace-app`) — this is your live site
  - One for **staging** (e.g. `grace-staging`) — used for PR preview deployments
- To add the second site: Hosting > Add another site

**Functions**
- Enabled automatically when you chose the Blaze plan

---

## Step 4 — Replace `firebase-config.js`

1. In the Firebase console, go to **Project settings** (gear icon, top-left)
2. Scroll to **Your apps** > click your web app, or click **Add app > Web**
3. Copy the `firebaseConfig` object
4. Open `firebase-config.js` in your repo and replace every value inside the
   `firebaseConfig` object (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId, measurementId)

The file should look like:

```js
const firebaseConfig = {
  apiKey:            "YOUR-API-KEY",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.firebasestorage.app",
  messagingSenderId: "YOUR-SENDER-ID",
  appId:             "YOUR-APP-ID",
  measurementId:     "YOUR-MEASUREMENT-ID",
};
```

This file is safe to commit. Firebase web config values are public-facing by
design — security comes from Firestore rules, not from hiding these values.

---

## Step 5 — Run the setup script

The setup script replaces all "Emmanuel Gospel Centre" / "EGC" / "egc-church"
placeholder text across the site, config files, and GitHub workflow files.

**Windows (PowerShell) — recommended with all optional values:**

```powershell
./setup.ps1 `
  -ChurchName  "Grace Community Church" `
  -ShortName   "GCC" `
  -Domain      "app.gracechurch.com" `
  -ProjectId   "grace-community-777" `
  -StagingSite "grace-staging"
```

**Mac / Linux (Bash):**

```bash
chmod +x setup.sh
./setup.sh "Grace Community Church" GCC app.gracechurch.com grace-community-777 grace-staging
```

What each value means:

| Parameter | Example | Where to find it |
|---|---|---|
| ChurchName | Grace Community Church | Your church's full name |
| ShortName | GCC | Abbreviation — used in page titles and the nav logo |
| Domain | app.gracechurch.com | Your Firebase Hosting production URL |
| ProjectId | grace-community-777 | Firebase console > Project settings > Project ID |
| StagingSite | grace-staging | The staging site name you created in Firebase Hosting |

The script is safe to re-run — each replacement is idempotent.

---

## Step 6 — Edit `church-config.js`

Open `church-config.js` and confirm these values:

```js
var churchConfig = {
  name:      "Grace Community Church",   // set by the setup script
  shortName: "GCC",                      // set by the setup script
  timezone:  "America/New_York",         // change to your IANA timezone
  domain:    "app.gracechurch.com",      // set by the setup script (if -Domain was given)
};
```

Change `timezone` to your local IANA timezone string. Examples:

| Region | Timezone string |
|---|---|
| US Eastern | `America/New_York` |
| US Central | `America/Chicago` |
| UK | `Europe/London` |
| South Africa | `Africa/Johannesburg` |
| Nigeria | `Africa/Lagos` |
| Kenya | `Africa/Nairobi` |
| Australia (Sydney) | `Australia/Sydney` |

A full list is at [en.wikipedia.org/wiki/List_of_tz_database_time_zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

---

## Step 7 — Update `.firebaserc` and `firebase.json`

If you ran the setup script with `-ProjectId` and `-StagingSite`, `.firebaserc`
is already updated. Otherwise, open it and replace the EGC values:

```json
{
  "projects": { "default": "your-project-id" },
  "targets": {
    "your-project-id": {
      "hosting": {
        "staging":    ["your-staging-site"],
        "production": ["your-production-site"]
      }
    }
  }
}
```

`firebase.json` does not contain project-specific values and does not need to change.

---

## Step 8 — Set Firebase Functions environment variables

The weekly digest and email alerts read these at runtime.
Run each command from the repo root (you must be logged in: `firebase login`):

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
The free tier covers 3,000 emails/month — more than enough for a church.

If you skip the Resend config, connect form submissions are still saved to
Firestore. Email alerts simply won't be sent until you configure the key later.

---

## Step 9 — Add GitHub Secrets for CI/CD

The GitHub Actions workflows (auto-deploy and PR previews) need two secrets.
Both are added the same way:

**GitHub repo > Settings > Secrets and variables > Actions > New repository secret**

### Secret 1: `FIREBASE_SERVICE_ACCOUNT`

Used by the deploy and PR preview workflows to push to Firebase Hosting.

1. Firebase console > Project settings > Service accounts
2. Click **Generate new private key** > **Generate key**
3. A JSON file downloads — open it and copy the entire contents
4. GitHub: name = `FIREBASE_SERVICE_ACCOUNT`, value = paste the JSON

### Secret 2: `FIREBASE_TOKEN`

Used by the CI security-rules test to authenticate the Firebase CLI.

1. In your terminal, run: `firebase login:ci`
2. A browser window opens — log in with your Firebase account
3. Copy the token printed in the terminal
4. GitHub: name = `FIREBASE_TOKEN`, value = paste the token

---

## Step 10 — Check the GitHub workflow files

If you ran the setup script with `-ProjectId` and `-StagingSite`, the workflow
files are already updated. Otherwise, open these two files and replace
`egc-church` / `egc-staging777` with your own values:

- `.github/workflows/deploy.yml` — change `projectId: egc-church`
- `.github/workflows/preview.yml` — change `projectId: egc-church` and
  the two occurrences of `egc-staging777`

Each file has comments marking exactly which lines to change.

---

## Step 11 — Deploy

Log in to Firebase if you haven't already:

```
firebase login
```

Deploy everything:

```
firebase deploy
```

This deploys Hosting (both staging and production sites), Cloud Functions,
Firestore rules, and Storage rules in one command.

If you want to deploy only specific parts:

```
firebase deploy --only hosting:production
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## Step 12 — Create the first superadmin

1. Open your live site and register an account (the account you want as admin)
2. Verify your email address via the link in the verification email
3. In the Firebase console, open **Firestore > users > YOUR-UID**
4. Set `isSuperadmin` to `true` and `membership` to `"member"`
5. Sign out and sign back in — your account now has full admin access

---

## After Setup

Log in to your site and go to **/admin/settings** to complete configuration:

- **Church Info** — display name, tagline, address, contact details, social links
- **Branding** — primary and accent colours (colour pickers), logo upload
- **Notifications** — connect form alert email address
- **Features** — toggle modules on/off (music, gallery, live stream, etc.)

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

---

## Troubleshooting

**"Permission denied" on the site after logging in**
- Check that `isSuperadmin: true` and `membership: "member"` are set on your user doc in Firestore
- Sign out and sign back in after changing Firestore — auth claims refresh on login

**CI checks failing on GitHub**
- Make sure both `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_TOKEN` secrets are added to the repo
- Make sure `projectId` in the workflow files matches your Firebase project ID

**Deploy fails with "Hosting site not found"**
- Check that the site names in `.firebaserc` match the sites you created in Firebase Hosting
- Run `firebase target:apply hosting production YOUR-PROD-SITE` to re-link them

**Push notifications not working**
- Notifications only register for installed PWA (home-screen) sessions, not browser tabs
- Only approved members (`membership: "member"`) receive push notifications
