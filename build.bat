@echo off
echo Business Scraper - C++ Backend Build
echo ====================================
echo.

REM Check if CMake is installed
cmake --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: CMake is not installed or not found in PATH
    echo Please install CMake from https://cmake.org/download/
    echo Make sure to add CMake to your system PATH during installation
    echo.
    pause
    exit /b 1
)

echo Found CMake installation

REM Check if a C++ compiler is available
where cl >nul 2>&1
if %errorlevel% equ 0 (
    echo Found MSVC compiler
    set GENERATOR="Visual Studio 16 2019"
    goto :build
)

where g++ >nul 2>&1
if %errorlevel% equ 0 (
    echo Found MinGW compiler
    set GENERATOR="MinGW Makefiles"
    goto :build
)

echo ERROR: No suitable C++ compiler found
echo Please install one of the following:
echo   - Visual Studio 2019 or later with C++ development tools
echo   - MinGW-w64 compiler
echo   - MSYS2 with mingw-w64 toolchain
echo.
pause
exit /b 1

:build
echo.
echo Creating build directory...
if not exist build mkdir build

echo Configuring project with CMake...
cd build

REM Configure the project
cmake .. -G %GENERATOR% -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo ERROR: CMake configuration failed
    echo Please check that all dependencies are installed
    cd ..
    pause
    exit /b 1
)

echo.
echo Building project...
REM Build the project
cmake --build . --config Release
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    echo Please check the compiler output above for details
    cd ..
    pause
    exit /b 1
)

cd ..

REM Check if build was successful
if exist "build\business_scraper.exe" (
    echo.
    echo BUILD SUCCESSFUL
    echo ================
    echo Executable: build\business_scraper.exe
    echo The C++ backend is ready for use.
) else if exist "build\Release\business_scraper.exe" (
    echo.
    echo BUILD SUCCESSFUL
    echo ================
    echo Executable: build\Release\business_scraper.exe
    REM Copy to build directory for consistency
    copy "build\Release\business_scraper.exe" "build\business_scraper.exe" >nul
    echo Copied to: build\business_scraper.exe
    echo The C++ backend is ready for use.
) else (
    echo.
    echo ERROR: Build failed - executable not found
    echo Check the build output above for error details
    pause
    exit /b 1
)

echo.
pause
