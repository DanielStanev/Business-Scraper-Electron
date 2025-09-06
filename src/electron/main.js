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

        // Fix GPU process issues on Windows
        if (process.platform === 'win32') {
            app.disableHardwareAcceleration();
        }

        this.setupApp();
    }

    setupApp() {
        // Handle app ready
        app.whenReady().then(() => {
            // Initialize config handling before creating the window
            this.initializeConfig();
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
                this.initializeConfig();
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

    initializeConfig() {
        try {
            // Determine paths for config files
            const templatePath = this.isDev
                ? path.join(__dirname, '../../config.template.ini')
                : path.join(process.resourcesPath, 'config.template.ini');

            // Check for existing config in stored location first
            const storedConfigPath = store.get('configPath', null);
            
            // Always use user data directory for the actual config file
            // This ensures it's writable even in AppImage environments
            const userDataPath = app.getPath('userData');
            const userConfigPath = path.join(userDataPath, 'config.ini');

            // Ensure userData directory exists and is writable
            let primaryConfigPath = userConfigPath;
            try {
                this.ensureDirectoryWritable(userDataPath);
            } catch (userDataError) {
                console.warn('UserData directory not writable, will use fallback location');
                // Set up fallback location
                const documentsPath = app.getPath('documents');
                const appDocumentsPath = path.join(documentsPath, 'BusinessScraper');
                primaryConfigPath = path.join(appDocumentsPath, 'config.ini');
                
                try {
                    this.ensureDirectoryWritable(appDocumentsPath);
                } catch (fallbackError) {
                    console.error('Neither userData nor Documents directory is writable');
                }
            }

            // For C++ backend, determine where it should look for config
            let appConfigPath;
            if (this.isDev) {
                appConfigPath = path.join(__dirname, '../../config.ini');
            } else {
                // In production, try resources first, but fall back to stored or primary config
                const resourcesConfigPath = path.join(process.resourcesPath, 'config.ini');
                if (fs.existsSync(resourcesConfigPath)) {
                    appConfigPath = resourcesConfigPath;
                } else if (storedConfigPath && fs.existsSync(storedConfigPath)) {
                    appConfigPath = storedConfigPath;
                } else {
                    appConfigPath = primaryConfigPath;
                }
            }

            console.log('Initializing config...');
            console.log('  Template path:', templatePath);
            console.log('  Primary config path:', primaryConfigPath);
            console.log('  Stored config path:', storedConfigPath);
            console.log('  App config path:', appConfigPath);

            // If no config exists anywhere but template does, create initial config
            const configExists = (storedConfigPath && fs.existsSync(storedConfigPath)) || 
                                fs.existsSync(primaryConfigPath) || 
                                fs.existsSync(appConfigPath);
                                
            if (!configExists && fs.existsSync(templatePath)) {
                console.log('Creating initial config from template...');
                this.safeWriteFile(primaryConfigPath, fs.readFileSync(templatePath, 'utf8'));
                store.set('configPath', primaryConfigPath);
            }

            // If we're in development and app config doesn't exist, copy from the primary location
            if (this.isDev && !fs.existsSync(appConfigPath)) {
                const sourceConfig = storedConfigPath || primaryConfigPath;
                if (fs.existsSync(sourceConfig)) {
                    console.log('Creating app config from primary config...');
                    fs.copyFileSync(sourceConfig, appConfigPath);
                }
            }
        } catch (error) {
            console.warn('Failed to initialize config:', error.message);
        }
    }

    ensureDirectoryWritable(dirPath) {
        try {
            // Create directory if it doesn't exist
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            // Test write access by creating a temporary file
            const testFile = path.join(dirPath, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            console.log('Directory is writable:', dirPath);
        } catch (error) {
            console.error('Directory is not writable:', dirPath, error.message);
            throw new Error(`Cannot write to directory: ${dirPath}. Please check permissions.`);
        }
    }

    safeWriteFile(filePath, content) {
        try {
            // Ensure the directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write the file
            fs.writeFileSync(filePath, content);
            console.log('Successfully wrote file:', filePath);
        } catch (error) {
            console.error('Failed to write file:', filePath, error.message);
            throw error;
        }
    }

    setupIpcHandlers() {
        // Initialize configuration on startup
        this.initializeConfig();

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
                const configContent = `# Business Scraper Configuration
[API]
google_maps_api_key=${config.apiKey}
`;

                // Save to user data directory (for persistence)
                const userDataPath = app.getPath('userData');
                const userConfigPath = path.join(userDataPath, 'config.ini');
                
                let configSaved = false;
                let actualConfigPath = userConfigPath;
                
                // Ensure directory is writable before attempting to save
                try {
                    this.ensureDirectoryWritable(userDataPath);
                    this.safeWriteFile(userConfigPath, configContent);
                    configSaved = true;
                    console.log('Config saved to primary location:', userConfigPath);
                } catch (dirError) {
                    // If userData directory is not writable, try alternative locations
                    console.error('Cannot write to userData directory:', dirError.message);
                    
                    // Try Documents folder as fallback
                    const documentsPath = app.getPath('documents');
                    const appDocumentsPath = path.join(documentsPath, 'BusinessScraper');
                    const fallbackConfigPath = path.join(appDocumentsPath, 'config.ini');
                    
                    try {
                        this.ensureDirectoryWritable(appDocumentsPath);
                        this.safeWriteFile(fallbackConfigPath, configContent);
                        console.log('Saved config to fallback location:', fallbackConfigPath);
                        actualConfigPath = fallbackConfigPath;
                        configSaved = true;
                    } catch (fallbackError) {
                        throw new Error(`Failed to save configuration. Cannot write to userData (${dirError.message}) or Documents folder (${fallbackError.message}). Please run as administrator or check folder permissions.`);
                    }
                }
                
                if (configSaved) {
                    // Always store the actual config path that was used
                    store.set('configPath', actualConfigPath);
                    store.set('config', config);
                }

                // Also try to save to application directory if writable (development mode)
                if (this.isDev) {
                    const appConfigPath = path.join(__dirname, '../../config.ini');
                    try {
                        fs.writeFileSync(appConfigPath, configContent);
                    } catch (appError) {
                        console.warn('Could not write to app directory:', appError.message);
                    }
                }

                return { success: true };
            } catch (error) {
                console.error('Failed to save configuration:', error.message);
                return { 
                    success: false, 
                    error: `Failed to save configuration: ${error.message}` 
                };
            }
        });

        ipcMain.handle('load-config', async () => {
            try {
                const storedConfig = store.get('config', {});
                
                // Get the stored config path (this will be the actual path that was successfully used)
                const storedConfigPath = store.get('configPath', null);
                const userConfigPath = path.join(app.getPath('userData'), 'config.ini');
                
                // Determine which config file to read from
                let configPathsToTry = [];
                
                if (storedConfigPath) {
                    // If we have a stored config path, try it first
                    configPathsToTry.push(storedConfigPath);
                }
                
                // Always try the default user config path as fallback
                if (storedConfigPath !== userConfigPath) {
                    configPathsToTry.push(userConfigPath);
                }
                
                // Try to load from each path until one succeeds
                let configLoaded = false;
                for (const configPath of configPathsToTry) {
                    if (fs.existsSync(configPath)) {
                        try {
                            console.log('Attempting to load config from:', configPath);
                            const configContent = fs.readFileSync(configPath, 'utf8');
                            const apiKeyMatch = configContent.match(/google_maps_api_key=(.+)/);
                            if (apiKeyMatch) {
                                storedConfig.apiKey = apiKeyMatch[1].trim();
                                configLoaded = true;
                                console.log('Successfully loaded config from:', configPath);
                                
                                // Update the stored path if this is a different location
                                if (configPath !== storedConfigPath) {
                                    store.set('configPath', configPath);
                                }
                                break;
                            }
                        } catch (readError) {
                            console.warn('Failed to read config file:', configPath, readError.message);
                        }
                    }
                }

                return { success: true, config: storedConfig };
            } catch (error) {
                console.error('Failed to load configuration:', error.message);
                return { success: false, error: error.message };
            }
        });

        // Business search
        ipcMain.handle('search-businesses', async (event, searchParams) => {
            return new Promise((resolve) => {
                try {
                    console.log('Starting search with params:', searchParams);

                    let executablePath;
                    try {
                        executablePath = this.getExecutablePath();
                        console.log('Using executable at:', executablePath);
                    } catch (pathError) {
                        console.error('Failed to get executable path:', pathError.message);
                        resolve({
                            success: false,
                            error: `Executable not found: ${pathError.message}`
                        });
                        return;
                    }

                    // Check if config exists - use the stored config path
                    let appConfigPath;
                    if (this.isDev) {
                        appConfigPath = path.join(__dirname, '../../config.ini');
                    } else {
                        // In production, use the stored config path (which could be fallback location)
                        const storedConfigPath = store.get('configPath', null);
                        const defaultConfigPath = path.join(app.getPath('userData'), 'config.ini');
                        
                        if (storedConfigPath && fs.existsSync(storedConfigPath)) {
                            appConfigPath = storedConfigPath;
                        } else if (fs.existsSync(defaultConfigPath)) {
                            appConfigPath = defaultConfigPath;
                        } else {
                            appConfigPath = defaultConfigPath; // Will fail later with proper error
                        }
                    }

                    console.log('Checking config at:', appConfigPath);

                    if (!fs.existsSync(appConfigPath)) {
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

                    // Determine working directory and ensure config is available there
                    let cwd;
                    if (this.isDev) {
                        cwd = path.join(__dirname, '../..'); // Development: project root
                    } else {
                        // Production: determine working directory based on config location
                        const configDir = path.dirname(appConfigPath);
                        const defaultUserDataDir = app.getPath('userData');
                        
                        // If config is in userData, use userData as working directory
                        if (configDir === defaultUserDataDir) {
                            cwd = defaultUserDataDir;
                        } else {
                            // If config is in fallback location, we need to copy it to a writable working directory
                            // or use the config's directory as working directory
                            try {
                                // Try to use userData as working directory and copy config there
                                this.ensureDirectoryWritable(defaultUserDataDir);
                                const workingConfigPath = path.join(defaultUserDataDir, 'config.ini');
                                if (!fs.existsSync(workingConfigPath)) {
                                    fs.copyFileSync(appConfigPath, workingConfigPath);
                                    console.log('Copied config from fallback to working directory');
                                }
                                cwd = defaultUserDataDir;
                            } catch (copyError) {
                                console.warn('Could not copy config to userData directory:', copyError.message);
                                // Use the config's directory as working directory
                                cwd = configDir;
                                console.log('Using config directory as working directory:', cwd);
                            }
                        }
                    }

                    console.log('Spawn configuration:');
                    console.log('  Executable:', executablePath);
                    console.log('  Arguments:', args);
                    console.log('  Working directory:', cwd);
                    console.log('  Output file:', outputFile);

                    // Spawn the CLI process
                    const cliProcess = spawn(executablePath, args, {
                        cwd: cwd,
                        env: { ...process.env }
                    });

                    let stdout = '';
                    let stderr = '';

                    cliProcess.stdout.on('data', (data) => {
                        const message = data.toString();
                        console.log('STDOUT:', message);
                        stdout += message;
                        // Send real-time status updates
                        this.mainWindow?.webContents.send('search-status', message.trim());
                    });

                    cliProcess.stderr.on('data', (data) => {
                        const errorMessage = data.toString();
                        console.log('STDERR:', errorMessage);
                        stderr += errorMessage;
                    });

                    cliProcess.on('close', (code) => {
                        console.log('Process closed with code:', code);
                        console.log('Final stdout:', stdout);
                        console.log('Final stderr:', stderr);

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
        const executableName = process.platform === 'win32' ? 'business_scraper.exe' : 'business_scraper';

        if (this.isDev) {
            // In development, use the built executable
            if (process.platform === 'win32') {
                // On Windows, check both Release and root build directories
                const releasePath = path.join(__dirname, '../../build/Release', executableName);
                const buildPath = path.join(__dirname, '../../build', executableName);

                console.log('Development mode - checking paths:');
                console.log('  Release path:', releasePath, 'exists:', fs.existsSync(releasePath));
                console.log('  Build path:', buildPath, 'exists:', fs.existsSync(buildPath));

                if (fs.existsSync(releasePath)) {
                    return releasePath;
                } else if (fs.existsSync(buildPath)) {
                    return buildPath;
                } else {
                    throw new Error(`Executable not found. Expected at: ${releasePath} or ${buildPath}`);
                }
            } else {
                return path.join(__dirname, '../../build', executableName);
            }
        } else {
            // In production, use the bundled executable
            const executablePath = path.join(process.resourcesPath, executableName);
            console.log('Production mode - checking path:');
            console.log('  Resources path:', process.resourcesPath);
            console.log('  Executable path:', executablePath, 'exists:', fs.existsSync(executablePath));

            if (!fs.existsSync(executablePath)) {
                // List files in resources directory for debugging
                console.log('Files in resources directory:');
                try {
                    const files = fs.readdirSync(process.resourcesPath);
                    files.forEach(file => {
                        const filePath = path.join(process.resourcesPath, file);
                        const stats = fs.statSync(filePath);
                        console.log(`  ${file} ${stats.isDirectory() ? '(directory)' : '(file)'}`);
                    });
                } catch (err) {
                    console.log('  Error reading directory:', err.message);
                }

                throw new Error(`Executable not found at: ${executablePath}`);
            }

            return executablePath;
        }
    }
}

// Create the app instance
new BusinessScraperApp();
