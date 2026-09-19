#!/bin/sh
# Boots the daemon, applies the two scripted edits, prints the event tail, resets.
# See .claude/skills/verify/SKILL.md for what a passing run looks like.
cd "$(dirname "$0")/.." || exit 1
LOG=${AYE_TAIL_LOG:-/tmp/aye-aye-tail.log}

cleanup() {
  kill "$DAEMON" "$TAIL" 2>/dev/null
  wait "$DAEMON" "$TAIL" 2>/dev/null
  npm run -s reset-sample
}
trap cleanup EXIT INT TERM

npm run -s reset-sample
node daemon/index.js > /tmp/aye-aye-daemon.log 2>&1 &
DAEMON=$!
i=0
until nc -z localhost 4317 2>/dev/null; do
  i=$((i + 1)); [ "$i" -gt 50 ] && { echo "daemon did not open :4317"; cat /tmp/aye-aye-daemon.log; exit 1; }
  sleep 0.1
done
node scripts/tail.js > "$LOG" 2>&1 &
TAIL=$!
sleep 0.5

echo "--- beat 1: templates.py"
sed -i '' 's/click here/tap here/' sample-repo/services/notifications/templates.py
sleep 8
echo "--- beat 2: session.py"
sed -i '' 's/timedelta(minutes=30)/timedelta(days=7)/' sample-repo/services/auth/session.py
sleep 15

echo "--- tail"
cat "$LOG"
