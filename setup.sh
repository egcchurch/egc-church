#!/usr/bin/env bash
# setup.sh - One-time setup script for new churches forking this template.
#
# Replaces "Emmanuel Gospel Centre" / "EGC" placeholder text across all HTML
# files, manifest.json, and church-config.js with the new church's name.
#
# Run from the repo root AFTER replacing firebase-config.js with your own.
# Safe to re-run: each replacement is idempotent.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh "Grace Community Church" GCC
#   ./setup.sh "Grace Community Church" GCC app.gracechurch.com
#
# See SETUP.md for the full 10-step setup checklist.

set -euo pipefail

CHURCH_NAME="${1:?First argument required: ChurchName (e.g. \"Grace Community Church\")}"
SHORT_NAME="${2:?Second argument required: ShortName (e.g. GCC)}"
DOMAIN="${3:-}"

# -- Nav logo lines ----------------------------------------------------------
UPPER=$(echo "$CHURCH_NAME" | tr '[:lower:]' '[:upper:]')
NAV_LINE1=$(echo "$UPPER" | awk '{print $1}')
WORD_COUNT=$(echo "$UPPER" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -gt 1 ]; then
    NAV_LINE2=$(echo "$UPPER" | cut -d' ' -f2-)
else
    NAV_LINE2=$(echo "$SHORT_NAME" | tr '[:lower:]' '[:upper:]')
fi

echo ""
echo "EGC Church Template Setup"
echo "========================="
echo "Church name : $CHURCH_NAME"
echo "Short name  : $SHORT_NAME"
echo "Nav logo    : $NAV_LINE1 / $NAV_LINE2"
[ -n "$DOMAIN" ] && echo "Domain      : $DOMAIN"
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

if [ -n "$DOMAIN" ]; then
    inplace -e "s@'app\.egc\.church'@'${DOMAIN}'@g" church-config.js
fi

# -- js/main.js -- PWA install prompt ----------------------------------------
replace_in_file js/main.js inplace \
    -e "s@Add EGC to your home screen@Add ${SHORT_NAME} to your home screen@g"

# -- Summary -----------------------------------------------------------------
echo ""
echo "Done. $CHANGED file(s) updated."
echo ""
echo "Next steps:"
echo "  1. Edit church-config.js -- set timezone if not already done"
if [ -z "$DOMAIN" ]; then
    echo "  2. Edit church-config.js -- set domain to your Firebase Hosting URL"
else
    echo "  2. Domain already set to $DOMAIN"
fi
echo "  3. Run: firebase deploy"
echo "  4. Open /admin/settings to finish branding and feature setup"
echo ""
echo "See SETUP.md for the full checklist."
echo ""
