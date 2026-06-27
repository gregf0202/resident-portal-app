#!/bin/bash
# NaloHub — one-shot: make this folder a git repo, single commit, push to GitHub.
# HOW TO RUN: open Terminal, then drag this file into the Terminal window and press Enter.
# (Or: cd into this folder and run  bash push-to-github.command )

set -e
cd "$(dirname "$0")"
echo "Working in: $(pwd)"
echo

# 1. Clean any partial/broken git state, then start fresh
rm -rf .git
git init -b main
git config user.email "gregf0202@gmail.com"
git config user.name  "Greg Ferguson"

# 2. Stage everything (node_modules/.env are ignored via .gitignore) and commit
git add -A
git commit -m "NaloHub: manual invites, CSV upload (users + key/fob), member & fob editing"
echo
echo "Commit created:"
git log --oneline -1
echo

# 3. Connect to your GitHub repo and push
read -r -p "Paste your GitHub repo URL (e.g. https://github.com/you/nalohub.git): " REPO
if [ -z "$REPO" ]; then
  echo "No URL entered. When ready, run:"
  echo "  git remote add origin <YOUR_REPO_URL>"
  echo "  git push -u origin main --force"
  exit 0
fi
git remote add origin "$REPO"
git branch -M main

echo
echo "About to push and OVERWRITE the remote 'main' with this commit."
read -r -p "Type  yes  to continue: " OK
if [ "$OK" != "yes" ]; then echo "Stopped. Nothing pushed."; exit 0; fi

git push -u origin main --force
echo
echo "Done. Netlify should start building from this commit shortly."
