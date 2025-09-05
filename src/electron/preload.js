const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App paths
    getAppPaths: () => ipcRenderer.invoke('get-app-paths'),

    // Configuration
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),

    // Business search
    searchBusinesses: (searchParams) => ipcRenderer.invoke('search-businesses', searchParams),

    // Listen for search status updates
    onSearchStatus: (callback) => {
        ipcRenderer.on('search-status', callback);
        // Return a function to remove the listener
        return () => ipcRenderer.removeListener('search-status', callback);
    },

    // File operations
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    readCSVFile: (filePath) => ipcRenderer.invoke('read-csv-file', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath)
});
