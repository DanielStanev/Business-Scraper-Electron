#!/bin/bash

# Cross-platform CMake build script for Business Scraper
# This script configures and builds the C++ backend using CMake

set -e

echo "Business Scraper - C++ Backend Build"
echo "===================================="
echo

# Check if CMake is installed
if ! command -v cmake &> /dev/null; then
    echo "ERROR: CMake is not installed or not found in PATH"
    echo "Please install CMake 3.16 or higher:"
    echo "  Ubuntu/Debian: sudo apt install cmake"
    echo "  macOS: brew install cmake"
    echo "  Windows: Download from https://cmake.org/download/"
    echo
    exit 1
fi

CMAKE_VERSION=$(cmake --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
echo "Found CMake version: $CMAKE_VERSION"

# Create build directory if it doesn't exist
if [ ! -d "build" ]; then
    echo "Creating build directory..."
    mkdir build
fi

# Check for dependencies on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Checking Linux dependencies..."

    # Check for libcurl
    if ! pkg-config --exists libcurl; then
        echo "ERROR: libcurl development package not found"
        echo "Install with: sudo apt install libcurl4-openssl-dev"
        echo
        exit 1
    fi

    # Check for jsoncpp
    if ! pkg-config --exists jsoncpp; then
        echo "ERROR: jsoncpp development package not found"
        echo "Install with: sudo apt install libjsoncpp-dev"
        echo
        exit 1
    fi

    echo "All Linux dependencies found"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macOS build detected"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "Windows build detected"
fi

echo

# Configure with CMake
echo "Configuring project with CMake..."
cd build

if ! cmake .. -DCMAKE_BUILD_TYPE=Release; then
    echo "ERROR: CMake configuration failed"
    echo "Please check that all dependencies are installed"
    exit 1
fi

echo
echo "Building project..."

# Build the project
if ! cmake --build . --config Release; then
    echo "ERROR: Build failed"
    echo "Please check the compiler output above for details"
    exit 1
fi

cd ..

# Check if build was successful
if [ -f "build/business_scraper" ] || [ -f "build/business_scraper.exe" ]; then
    echo
    echo "BUILD SUCCESSFUL"
    echo "================"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "Executable: build/business_scraper.exe"
    else
        echo "Executable: build/business_scraper"
    fi
    echo "The C++ backend is ready for use."
else
    echo
    echo "ERROR: Build failed - executable not found"
    echo "Check the build output above for error details"
    exit 1
fi
