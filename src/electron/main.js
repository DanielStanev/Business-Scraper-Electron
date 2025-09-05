const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// Initialize electron-store for persistent settings
const store = new Store();

class BusinessScraperApp {
    constructor() {
        this.mainWindow = null;
        this.isDev = process.argv.includes('--dev');
        this.showDevTools = process.argv.includes('--devtools');
        this.setupApp();
    }

    setupApp() {
        // Handle app ready
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupIpcHandlers();
        });

        // Quit when all windows are closed (except on macOS)
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // Handle app activation (macOS)
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            icon: path.join(__dirname, '../../assets/icon.png'),
            autoHideMenuBar: true, // Hide the menu bar (File, Edit, View, etc.)
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            show: false,
            // Hide the window initially to prevent flash
            // In production, we don't want console window
            ...(process.platform === 'win32' && !this.isDev && {
                webSecurity: true,
                allowRunningInsecureContent: false
            })
        });

        // Load the renderer
        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        // Open DevTools in development if explicitly requested
        if (this.isDev && this.showDevTools) {
            this.mainWindow.webContents.openDevTools();
        }

        // Handle external links
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
    }

    setupIpcHandlers() {
        // Get application paths
        ipcMain.handle('get-app-paths', () => {
            return {
                userData: app.getPath('userData'),
                documents: app.getPath('documents'),
                desktop: app.getPath('desktop'),
                downloads: app.getPath('downloads')
            };
        });

        // Configuration management
        ipcMain.handle('save-config', async (event, config) => {
            try {
                const configPath = path.join(app.getPath('userData'), 'config.ini');
                const configContent = `# Business Scraper Configuration
[API]
google_maps_api_key=${config.apiKey}
`;
                fs.writeFileSync(configPath, configContent);
                store.set('config', config);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('load-config', async () => {
            try {
                const configPath = path.join(app.getPath('userData'), 'config.ini');
                const storedConfig = store.get('config', {});

                if (fs.existsSync(configPath)) {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const apiKeyMatch = configContent.match(/google_maps_api_key=(.+)/);
                    if (apiKeyMatch) {
                        storedConfig.apiKey = apiKeyMatch[1].trim();
                    }
                }

                return { success: true, config: storedConfig };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Business search
        ipcMain.handle('search-businesses', async (event, searchParams) => {
            return new Promise((resolve) => {
                try {
                    const executablePath = this.getExecutablePath();
                    const configPath = path.join(app.getPath('userData'), 'config.ini');

                    // Check if config exists
                    if (!fs.existsSync(configPath)) {
                        resolve({
                            success: false,
                            error: 'Configuration file not found. Please set up your Google Maps API key first.'
                        });
                        return;
                    }

                    // Build command arguments
                    const args = [
                        '-k', searchParams.keyword,
                        '-l', searchParams.location,
                        '-r', searchParams.maxResults.toString(),
                        '-f', searchParams.outputFormat
                    ];

                    if (!searchParams.enableWebScraping) {
                        args.push('--no-web-scraping');
                    }

                    // Set output file
                    const outputDir = searchParams.outputDirectory || app.getPath('documents');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const outputFile = path.join(outputDir, `business-results-${timestamp}.${searchParams.outputFormat}`);
                    args.push('-o', outputFile);

                    // Spawn the CLI process
                    const cliProcess = spawn(executablePath, args, {
                        cwd: path.dirname(configPath),
                        env: { ...process.env }
                    });

                    let stdout = '';
                    let stderr = '';

                    cliProcess.stdout.on('data', (data) => {
                        const message = data.toString();
                        stdout += message;
                        // Send real-time status updates
                        this.mainWindow?.webContents.send('search-status', message.trim());
                    });

                    cliProcess.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });

                    cliProcess.on('close', (code) => {
                        if (code === 0) {
                            // Extract CSV data from stdout
                            const csvData = this.extractCSVData(stdout);

                            resolve({
                                success: true,
                                outputFile: outputFile,
                                output: stdout,
                                csvData: csvData
                            });
                        } else {
                            resolve({
                                success: false,
                                error: stderr || 'Unknown error occurred',
                                output: stdout
                            });
                        }
                    });

                    cliProcess.on('error', (error) => {
                        resolve({
                            success: false,
                            error: `Failed to start search process: ${error.message}`
                        });
                    });

                } catch (error) {
                    resolve({
                        success: false,
                        error: error.message
                    });
                }
            });
        });

        // File operations
        ipcMain.handle('select-directory', async () => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    properties: ['openDirectory'],
                    defaultPath: app.getPath('documents')
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    return { success: true, path: result.filePaths[0] };
                }

                return { success: false, error: 'No directory selected' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('read-csv-file', async (event, filePath) => {
            try {
                console.log('Reading CSV file:', filePath);

                if (!fs.existsSync(filePath)) {
                    console.error('CSV file not found:', filePath);
                    return { success: false, error: 'File not found' };
                }

                const content = fs.readFileSync(filePath, 'utf8');
                console.log('CSV file content length:', content.length);
                console.log('CSV file first 200 chars:', content.substring(0, 200));

                const lines = content.split('\n').filter(line => line.trim());
                console.log('CSV lines count:', lines.length);

                if (lines.length < 2) {
                    console.error('Invalid CSV file - not enough lines');
                    return { success: false, error: 'Invalid CSV file - no data rows found' };
                }

                // Parse CSV header - C++ format: Name,Address,Phone Number,Email,Website,Rating,Total Ratings,Additional Numbers,Additional Emails,Social Media Links
                const headerLine = lines[0];
                console.log('CSV header line:', headerLine);

                const headers = this.parseCSVLine(headerLine).map(h => h.trim());
                console.log('CSV headers:', headers);

                const rows = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVLine(lines[i]);
                    if (values.length > 0) {
                        const row = {};
                        headers.forEach((header, index) => {
                            // Create standardized property names from headers
                            const propName = header.toLowerCase()
                                .replace(/\s+/g, '_')
                                .replace(/[^a-z0-9_]/g, '');
                            row[propName] = (values[index] || '').trim();
                        });
                        rows.push(row);
                    }
                }

                console.log('Parsed CSV rows:', rows.length);
                if (rows.length > 0) {
                    console.log('First row:', rows[0]);
                }

                return { success: true, data: rows };
            } catch (error) {
                console.error('Error reading CSV file:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('open-file', async (event, filePath) => {
            try {
                await shell.openPath(filePath);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('show-item-in-folder', async (event, filePath) => {
            try {
                shell.showItemInFolder(filePath);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }

    extractCSVData(stdout) {
        try {
            const startMarker = '--- CSV_DATA_START ---';
            const endMarker = '--- CSV_DATA_END ---';

            const startIndex = stdout.indexOf(startMarker);
            const endIndex = stdout.indexOf(endMarker);

            if (startIndex === -1 || endIndex === -1) {
                console.log('CSV data markers not found in output');
                return null;
            }

            const csvContent = stdout.substring(startIndex + startMarker.length, endIndex).trim();
            console.log('Extracted CSV content length:', csvContent.length);

            if (!csvContent) {
                return null;
            }

            // Parse the CSV content
            const lines = csvContent.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                console.log('Not enough CSV lines found');
                return null;
            }

            const headers = this.parseCSVLine(lines[0]).map(h => h.trim());
            console.log('CSV headers from stdout:', headers);

            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length > 0) {
                    const row = {};
                    headers.forEach((header, index) => {
                        const propName = header.toLowerCase()
                            .replace(/\s+/g, '_')
                            .replace(/[^a-z0-9_]/g, '');
                        row[propName] = (values[index] || '').trim();
                    });
                    rows.push(row);
                }
            }

            console.log('Parsed CSV rows from stdout:', rows.length);
            return rows;

        } catch (error) {
            console.error('Error extracting CSV data from stdout:', error);
            return null;
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    getExecutablePath() {
        if (this.isDev) {
            // In development, use the built executable
            return path.join(__dirname, '../../build/business_scraper');
        } else {
            // In production, use the bundled executable
            return path.join(process.resourcesPath, 'business_scraper');
        }
    }
}

// Create the app instance
new BusinessScraperApp();
