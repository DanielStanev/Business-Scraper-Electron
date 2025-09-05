#!/bin/bash

echo "Building Business Scraper for distribution..."

# Build C++ backend first
echo "Building C++ backend..."
./build.sh

if [ ! -f "build/business_scraper" ]; then
    echo "Error: C++ backend build failed. Please ensure build.sh works correctly."
    exit 1
fi

# Build Electron distributables
echo "Building Electron distributables..."
npm run dist

echo "Build complete! Check the 'dist' directory for installable packages."
echo ""
echo "Available packages:"
ls -la dist/ 2>/dev/null | grep -E '\.(exe|msi|dmg|AppImage|deb)$' || echo "No packages found in dist directory"
