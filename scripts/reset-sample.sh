#!/bin/sh
# Restore sample-repo/ from the pristine copy in fixtures/ between takes.
# Independent of git so it works on an uncommitted tree.
cd "$(dirname "$0")/.." || exit 1
rm -rf sample-repo
cp -R fixtures/sample-repo sample-repo
find sample-repo -name '__pycache__' -type d -prune -exec rm -rf {} +
echo "sample-repo/ reset"
