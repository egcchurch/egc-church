#!/usr/bin/env bash
# setup.sh - One-time setup script for new churches forking this template.
#
# Replaces "Emmanuel Gospel Centre" / "EGC" / "egc-church" placeholder text
# across HTML files, manifests, config files, and GitHub workflow files.
#
# Run from the repo root AFTER replacing firebase-config.js with your own.
# Safe to re-run: each replacement is idempotent.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh "Grace Community Church" GCC
#
# With optional Firebase deployment values (recommended):
#   ./setup.sh "Grace Community Church" GCC app.gracechurch.com grace-community-777 grace-staging
#
# Arguments (positional):
#   $1  ChurchName   Full church name  (e.g. "Grace Community Church")
#   $2  ShortName    Short name / abbreviation  (e.g. "GCC")
#   $3  Domain       Firebase Hosting production URL  (e.g. "app.gracechurch.com")  [optional]
#   $4  ProjectId    Firebase project ID  (e.g. "grace-community-777")              [optional]
#                    Found in Firebase console > Project settings
#   $5  StagingSite  Firebase Hosting staging site name  (e.g. "grace-staging")    [optional]
#                    The site name you created in Firebase Hosting for PR previews
#
# See SETUP.md for the full 10-step setup checklist.

set -euo pipefail

CHURCH_NAME="${1:?First argument required: ChurchName (e.g. \"Grace Community Church\")}"
SHORT_NAME="${2:?Second argument required: ShortName (e.g. GCC)}"
DOMAIN="${3:-}"
PROJECT_ID="${4:-}"
STAGING_SITE="${5:-}"

# -- Nav logo lines ----------------------------------------------------------
UPPER=$(echo "$CHURCH_NAME" | tr '[:lower:]' '[:upper:]')
NAV_LINE1=$(echo "$UPPER" | awk '{print $1}')
WORD_COUNT=$(echo "$UPPER" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -gt 1 ]; then
    NAV_LINE2=$(echo "$UPPER" | cut -d' ' -f2-)
else
    NAV_LINE2=$(echo "$SHORT_NAME" | tr '[:lower:]' '[:upper:]')
fi

# -- Cache name prefix (lowercase short name, no spaces) ---------------------
CACHE_PREFIX=$(echo "$SHORT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

echo ""
echo "EGC Church Template Setup"
echo "========================="
echo "Church name  : $CHURCH_NAME"
echo "Short name   : $SHORT_NAME"
echo "Nav logo     : $NAV_LINE1 / $NAV_LINE2"
[ -n "$DOMAIN" ]       && echo "Domain       : $DOMAIN"
[ -n "$PROJECT_ID" ]   && echo "Project ID   : $PROJECT_ID"
[ -n "$STAGING_SITE" ] && echo "Staging site : $STAGING_SITE"
echo ""

CHANGED=0

# -- sed in-place (BSD on macOS, GNU on Linux) --------------------------------
inplace() {
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# -- Helper: track whether a file changed ------------------------------------
replace_in_file() {
    local path="$1"
    shift
    local before_sum after_sum
    before_sum=$(cksum "$path")
    "$@" "$path"
    after_sum=$(cksum "$path")
    if [ "$before_sum" != "$after_sum" ]; then
        echo "  Updated : $path"
        CHANGED=$((CHANGED + 1))
    fi
}

# -- HTML files --------------------------------------------------------------
while IFS= read -r -d '' f; do
    replace_in_file "$f" inplace \
        -e "s@Emmanuel Gospel Centre | EGC Church@${CHURCH_NAME}@g" \
        -e "s@Emmanuel Gospel Centre@${CHURCH_NAME}@g" \
        -e "s@EGC Admin@${SHORT_NAME} Admin@g" \
        -e "s@>EMMANUEL<@>${NAV_LINE1}<@g" \
        -e "s@>GOSPEL CENTRE<@>${NAV_LINE2}<@g"
done < <(find . -name "*.html" -not -path "*/node_modules/*" -print0)

# -- manifest.json -----------------------------------------------------------
replace_in_file manifest.json inplace \
    -e "s@\"name\": \"Emmanuel Gospel Centre\"@\"name\": \"${CHURCH_NAME}\"@g" \
    -e "s@\"short_name\": \"EGC\"@\"short_name\": \"${SHORT_NAME}\"@g" \
    -e "s@\"description\": \"Emmanuel Gospel Centre church website\"@\"description\": \"${CHURCH_NAME} church website\"@g"

# -- church-config.js --------------------------------------------------------
replace_in_file church-config.js inplace \
    -e "s@'Emmanuel Gospel Centre'@'${CHURCH_NAME}'@g" \
    -e "s@shortName: *'EGC'@shortName: '${SHORT_NAME}'@g"

[ -n "$DOMAIN" ] && inplace -e "s@'app\.egc\.church'@'${DOMAIN}'@g" church-config.js

# -- js/main.js -- PWA install prompt ----------------------------------------
replace_in_file js/main.js inplace \
    -e "s@Add EGC to your home screen@Add ${SHORT_NAME} to your home screen@g"

# -- service-worker.js -- cache name prefix ----------------------------------
replace_in_file service-worker.js inplace \
    -e "s@egc-cache-v[0-9]*@${CACHE_PREFIX}-cache-v1@g"

# -- .firebaserc -- Firebase project ID and site names -----------------------
if [ -n "$PROJECT_ID" ]; then
    replace_in_file .firebaserc inplace \
        -e "s@\"default\": \"egc-church\"@\"default\": \"${PROJECT_ID}\"@g" \
        -e "s@\"egc-church\": {@\"${PROJECT_ID}\": {@g"
    if [ -n "$STAGING_SITE" ]; then
        inplace -e "s@\"egc-staging777\"@\"${STAGING_SITE}\"@g" .firebaserc
    fi
fi

# -- GitHub workflow files -- project ID and staging site --------------------
if [ -n "$PROJECT_ID" ]; then
    replace_in_file .github/workflows/deploy.yml inplace \
        -e "s@projectId: egc-church@projectId: ${PROJECT_ID}@g"
    replace_in_file .github/workflows/preview.yml inplace \
        -e "s@projectId: egc-church@projectId: ${PROJECT_ID}@g" \
        -e "s@projects/egc-church/@projects/${PROJECT_ID}/@g"
    if [ -n "$STAGING_SITE" ]; then
        inplace -e "s@sites/egc-staging777@sites/${STAGING_SITE}@g" \
            .github/workflows/preview.yml
    fi
fi

# -- Summary -----------------------------------------------------------------
echo ""
echo "Done. $CHANGED file(s) updated."
echo ""
echo "Remaining manual steps:"
[ -z "$DOMAIN" ]      && echo "  - Edit church-config.js -- set domain to your Firebase Hosting URL"
[ -z "$PROJECT_ID" ]  && echo "  - Update projectId in .github/workflows/deploy.yml and preview.yml"
[ -z "$STAGING_SITE" ] && [ -n "$PROJECT_ID" ] && \
    echo "  - Update egc-staging777 in .github/workflows/preview.yml with your staging site name"
[ -z "$PROJECT_ID" ]  && echo "  - Update .firebaserc with your Firebase project ID and site names"
echo "  - Replace firebase-config.js with your project's config (if not done already)"
echo "  - Add FIREBASE_SERVICE_ACCOUNT and FIREBASE_TOKEN to GitHub repo secrets"
echo "  - Run: firebase deploy"
echo ""
echo "See SETUP.md for the full checklist."
echo ""
