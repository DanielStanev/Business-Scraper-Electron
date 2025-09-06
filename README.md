# Business Scraper

A professional desktop application for searching and collecting business information using the Google Maps API, built with Electron and C++.

## Background

I originally built this as a web application in an afternoon by combining parts from an old Perl project and an old Python project, then vibe-coding a front-end using HTML, CSS, and Node.js. The original project was created to help my friend Rhoan Egemo with his unpaid business internship, making it easier for him to gather business data.

The original web app is currently in a private GitHub repository because I naively exposed API keys in the first few commits. I'll make it public when I stop being lazy and retire those keys.

I eventually rewrote the web app as C++/Qt project to create a desktop app.

This version uses the C++ backend of the previous desktop app, but now uses Electron for the front-end, providing a modern, cross-platform desktop experience that can be easily packaged as an installable Windows program.

## Screenshots

### Processing View
![Processing View](screenshots/output.png)

### Results Display
![Results View](screenshots/results.png)


## Prerequisites

- Node.js 16+ and npm
- C++ compiler (for building the backend)
- Google Maps API key with Places API enabled


## Building Installers

### Windows

The application can be packaged as both NSIS installer and MSI:

```bash
npm install
npm run dist
```

This will create:
- `dist/Business Scraper Setup 1.0.0.exe` (NSIS installer)
- `dist/Business Scraper 1.0.0.msi` (MSI installer)

### macOS

```bash
npm install
npm run dist
```
or
```bash
npm install
./build-dist.sh
```

Creates: `dist/Business Scraper-1.0.0.dmg`

### Linux

```bash
npm install
npm run dist
```
or
```bash
npm install
./build-dist.sh
```

Creates:
- `dist/Business Scraper-1.0.0.AppImage`
- `dist/business-scraper-electron_1.0.0_amd64.deb`

## Development

### Architecture

The application consists of two main parts:

1. **C++ Backend**: High-performance core engine for business scraping
   - Google Maps API integration
   - Web scraping capabilities
   - Multiple output format support
   - Built as a standalone CLI executable

2. **Electron Frontend**: Modern desktop interface
   - Cross-platform GUI built with web technologies
   - Secure communication with C++ backend via IPC
   - Real-time status updates and progress tracking


## Configuration:

Configure the program with your google maps api key by either
adding the following line to a config.ini file:

```ini
[API]
google_maps_api_key=YOUR_GOOGLE_MAPS_API_KEY
```

or by configuring in app by clicking the gear icon:
![Configuration Dialog](screenshots/config.png)

## Troubleshooting

### Windows MSI Installation Issues

If you're getting permission errors when trying to save your API key after installing via MSI, try these solutions:

#### Error: "EPERM: operation not permitted"

This error typically occurs when the application doesn't have permission to write to the AppData directory. Here are the solutions in order of preference:

1. **Run as Administrator** (Quickest fix)
   - Right-click on the Business Scraper icon
   - Select "Run as administrator"
   - Configure your API key
   - The app will automatically use fallback locations for future runs

2. **Check Folder Permissions**
   - Navigate to `C:\Users\[YourUsername]\AppData\Roaming\`
   - Right-click → Properties → Security
   - Ensure your user account has "Full control" permissions

3. **Manual Fallback Location**
   - The app automatically tries to save configuration to your Documents folder if AppData is not writable
   - Look for a `BusinessScraper` folder in your Documents directory

4. **Use NSIS Installer Instead**
   - Download the `.exe` installer instead of the `.msi` file
   - NSIS installers typically have fewer permission restrictions

#### Why This Happens

MSI installers on Windows can sometimes create directories with restrictive permissions, especially in enterprise environments or when Windows User Account Control (UAC) is strictly configured. The application now includes automatic fallback mechanisms to handle these scenarios.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. See the [LICENSE](LICENSE) file for details.

Third-party components are licensed under their respective licenses. See [LICENSE_THIRD_PARTY](LICENSE_THIRD_PARTY) for details.
