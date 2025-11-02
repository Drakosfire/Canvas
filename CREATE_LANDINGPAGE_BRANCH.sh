#!/bin/bash
# Script to create LandingPage integration branch
# Run from Canvas directory

set -e

LANDINGPAGE_DIR="../LandingPage"

if [ ! -d "$LANDINGPAGE_DIR" ]; then
    echo "❌ Error: LandingPage directory not found at $LANDINGPAGE_DIR"
    echo "   Make sure you're running this from the Canvas directory"
    exit 1
fi

cd "$LANDINGPAGE_DIR"

echo "🌿 Creating integration branch in LandingPage..."

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/feat/canvas-package-integration; then
    echo "⚠️  Branch 'feat/canvas-package-integration' already exists"
    read -p "   Switch to it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout feat/canvas-package-integration
        echo "✅ Switched to existing branch"
        exit 0
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Create branch from current branch
CURRENT_BRANCH=$(git branch --show-current)
git checkout -b feat/canvas-package-integration

echo "✅ Created branch 'feat/canvas-package-integration' from '$CURRENT_BRANCH'"
echo ""
echo "Next steps:"
echo "1. Install Canvas package: pnpm add file:../Canvas"
echo "2. Follow LANDINGPAGE_INTEGRATION.md for detailed steps"
echo "3. Update imports to use @dungeonmind/canvas"
echo "4. Test statblock generation"

