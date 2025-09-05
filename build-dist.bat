@echo off
echo Building Business Scraper for Distribution
echo =========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install npm dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Building C++ backend with CMake...
call build.bat
if %errorlevel% neq 0 (
    echo Error: Failed to build C++ backend
    echo Make sure you have CMake and a C++ compiler installed
    pause
    exit /b 1
)

REM Verify C++ build succeeded
if not exist "build\business_scraper.exe" (
    if not exist "build\business_scraper" (
        echo Error: C++ backend build failed - executable not found
        pause
        exit /b 1
    )
)

echo.
echo Step 3: Building Electron application...
call npm run dist
if %errorlevel% neq 0 (
    echo Error: Failed to build Electron application
    pause
    exit /b 1
)

echo.
echo Step 4: Verifying build outputs...
if exist "dist" (
    echo Build completed successfully!
    echo.
    echo Generated files:
    dir /b dist\*.exe 2>nul
    dir /b dist\*.msi 2>nul
    echo.
    echo Files are ready for distribution in the 'dist' folder.
) else (
    echo Error: No dist folder found - build may have failed
    pause
    exit /b 1
)

echo.
echo Build complete! You can now distribute the installers from the 'dist' folder.
pause
