#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BLACKLIST="$PROJECT_DIR/data/blacklist.json"

echo "=== Blacklist Editor ==="
echo "File: $BLACKLIST"
echo ""

# Show current stats
node -e "
const d = JSON.parse(require('fs').readFileSync('$BLACKLIST','utf-8'));
const vCount = Object.values(d.violations).reduce((s,a)=>s+a.length,0);
const rCount = Object.values(d.risks).reduce((s,a)=>s+a.length,0);
console.log('Current blacklist:');
console.log('  VIOLATION categories: ' + Object.keys(d.violations).join(', '));
Object.entries(d.violations).forEach(([k,v])=>console.log('    ' + k + ': ' + v.length + ' keywords'));
console.log('  RISK categories: ' + Object.keys(d.risks).join(', '));
Object.entries(d.risks).forEach(([k,v])=>console.log('    ' + k + ': ' + v.length + ' keywords'));
console.log('  Violence patterns: ' + d.violence_patterns.length);
console.log('  Safe words: ' + d.violence_safe_words.length);
console.log('  Total: ' + vCount + ' violation + ' + rCount + ' risk keywords');
"

echo ""
echo "To edit, open: $BLACKLIST"
echo "Changes take effect on next scan (no code change needed)."
