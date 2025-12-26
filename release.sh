#!/bin/bash

# Exit on error, unset variables, and pipe failures
set -euo pipefail

echo "⬇️  Pulling latest changes..."

# Capture the output of git pull into a variable
GIT_OUTPUT=$(git pull)

# Print the output so you can still see it in the console
echo "$GIT_OUTPUT"

# Check if the output contains the specific string "Already up to date."
# If it does, exit successfully (exit 0) immediately.
if [[ "$GIT_OUTPUT" == *"Already up to date."* ]]; then
    echo "🛑 Code is already up to date. Exiting without rebuild."
    exit 0
fi

echo "🏗️  Building images..."
docker compose build

echo "🚀 Starting services..."
docker compose up -d

echo "🧹 Cleaning up dangling images..."
# -f forces the removal without a confirmation prompt
docker image prune -f

# Use -e to interpret the backslash escapes nicely
echo -e "\n ✅ Release done"
