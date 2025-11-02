#!/bin/bash
# Setup script for Canvas repository
# Run this after initial setup

set -e

echo "🚀 Setting up Canvas repository..."

# Rename default branch to main
git branch -m master main

# Create initial commit
echo "📝 Creating initial commit..."
git add .
git commit -m "chore: initial repository setup

- Add package.json with dependencies
- Add TypeScript configuration
- Add README and documentation
- Set up directory structure
- Add extraction plan

This repository will contain the extracted Canvas rendering system
from the DungeonMind LandingPage."

echo "✅ Repository setup complete!"
echo ""
echo "Next steps:"
echo "1. Create remote repository (e.g., on GitHub)"
echo "2. Add remote: git remote add origin <repo-url>"
echo "3. Push: git push -u origin main"
echo ""
echo "Then proceed with Phase 2: Core Extraction"

