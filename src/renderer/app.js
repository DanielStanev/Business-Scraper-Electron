class BusinessScraperApp {
    constructor() {
        this.isSearching = false;
        this.lastOutputFile = null;
        this.lastSearchResults = [];
        this.statusUnsubscribe = null;
        this.currentStage = 'idle'; // idle, searching, complete, error
        this.scrapingProgress = { current: 0, total: 0 };

        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.loadConfiguration();
        await this.setDefaultOutputDirectory();
    }

    setupEventListeners() {
        // Search form
        const searchForm = document.getElementById('search-form');
        searchForm.addEventListener('submit', (e) => this.handleSearch(e));

        // Configuration modal
        const configBtn = document.getElementById('config-btn');
        const configModal = document.getElementById('config-modal');
        const closeConfigBtn = document.getElementById('close-config');
        const cancelConfigBtn = document.getElementById('cancel-config');
        const configForm = document.getElementById('config-form');

        configBtn.addEventListener('click', () => this.showConfigModal());
        closeConfigBtn.addEventListener('click', () => this.hideConfigModal());
        cancelConfigBtn.addEventListener('click', () => this.hideConfigModal());
        configForm.addEventListener('submit', (e) => this.handleConfigSave(e));
        
        // API key validation on input change
        const apiKeyField = document.getElementById('api-key');
        if (apiKeyField) {
            apiKeyField.addEventListener('input', () => this.validateApiKey());
        }

        // Click outside modal to close
        configModal.addEventListener('click', (e) => {
            if (e.target === configModal) {
                this.hideConfigModal();
            }
        });

        // Directory selection
        const selectDirBtn = document.getElementById('select-directory-btn');
        selectDirBtn.addEventListener('click', () => this.selectOutputDirectory());

        // Results actions
        const exportBtn = document.getElementById('export-btn');
        const openFileBtn = document.getElementById('open-file-btn');
        const showInFolderBtn = document.getElementById('show-in-folder-btn');
        const clearResultsBtn = document.getElementById('clear-results-btn');

        exportBtn.addEventListener('click', () => this.exportResults());
        openFileBtn.addEventListener('click', () => this.openResultFile());
        showInFolderBtn.addEventListener('click', () => this.showResultInFolder());
        clearResultsBtn.addEventListener('click', () => this.clearResults());

        // Status updates
        this.statusUnsubscribe = window.electronAPI.onSearchStatus((event, message) => {
            this.updateStatus(message);
        });
    }

    async loadConfiguration() {
        try {
            const result = await window.electronAPI.loadConfig();
            if (result.success && result.config) {
                const apiKeyField = document.getElementById('api-key');
                if (result.config.apiKey) {
                    apiKeyField.value = result.config.apiKey;
                }
            }
            // Check API key validity after loading
            this.validateApiKey();
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.validateApiKey();
        }
    }

    validateApiKey() {
        const apiKeyField = document.getElementById('api-key');
        const searchBtn = document.getElementById('search-btn');
        const apiKey = apiKeyField ? apiKeyField.value : '';
        
        const isValidApiKey = apiKey && 
                             apiKey.trim() !== '' && 
                             apiKey.trim() !== 'YOUR_API_KEY_HERE';
        
        if (!isValidApiKey) {
            // Show API key error status
            this.setStatusState('api-key-error');
            
            // Disable search button and add tooltip
            searchBtn.disabled = true;
            searchBtn.classList.add('disabled');
            searchBtn.title = 'You must set an API key before you begin searching';
        } else {
            // API key is valid, enable search
            if (this.currentStage === 'api-key-error') {
                this.setStatusState('idle');
            }
            
            // Enable search button and remove tooltip
            searchBtn.disabled = false;
            searchBtn.classList.remove('disabled');
            searchBtn.title = '';
        }
        
        return isValidApiKey;
    }

    async setDefaultOutputDirectory() {
        try {
            const paths = await window.electronAPI.getAppPaths();
            const outputDirField = document.getElementById('output-directory');
            if (!outputDirField.value) {
                outputDirField.value = paths.documents;
            }
        } catch (error) {
            console.error('Failed to set default output directory:', error);
        }
    }

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.style.display = 'flex';
        document.getElementById('api-key').focus();
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.style.display = 'none';
    }

    async handleConfigSave(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const config = {
            apiKey: formData.get('apiKey')
        };

        if (!config.apiKey.trim()) {
            this.showError('Please enter a valid API key');
            return;
        }

        try {
            const result = await window.electronAPI.saveConfig(config);

            if (result.success) {
                this.hideConfigModal();
                this.showSuccess('Configuration saved successfully.');
                
                // Validate API key after saving
                this.validateApiKey();
                
                // Reset to idle after a brief moment
                setTimeout(() => {
                    if (this.currentStage === 'complete') {
                        this.setStatusState('idle');
                    }
                }, 2000);
            } else {
                // Provide more helpful error messages for permission issues
                let errorMessage = result.error;
                if (errorMessage.includes('EPERM') || errorMessage.includes('operation not permitted')) {
                    errorMessage = `Permission denied when saving configuration. This can happen with MSI installations. 
                    Try one of these solutions:
                    • Run the application as administrator
                    • Check that your Documents folder is writable
                    • Contact support if the issue persists
                    
                    Technical details: ${result.error}`;
                }
                this.showError('Failed to save configuration: ' + errorMessage);
            }
        } catch (error) {
            this.showError('Failed to save configuration: ' + error.message);
        }
    }

    async selectOutputDirectory() {
        try {
            const result = await window.electronAPI.selectDirectory();

            if (result.success) {
                const outputDirField = document.getElementById('output-directory');
                outputDirField.value = result.path;
            }
        } catch (error) {
            this.showError('Failed to select directory: ' + error.message);
        }
    }

    async handleSearch(event) {
        event.preventDefault();

        if (this.isSearching) {
            return;
        }

        // Validate API key first
        if (!this.validateApiKey()) {
            return;
        }

        const formData = new FormData(event.target);
        const searchParams = {
            keyword: formData.get('keyword'),
            location: formData.get('location'),
            maxResults: parseInt(formData.get('maxResults')),
            outputFormat: formData.get('outputFormat'),
            outputDirectory: formData.get('outputDirectory'),
            enableWebScraping: formData.has('enableWebScraping')
        };

        // Validate required fields
        if (!searchParams.keyword.trim() || !searchParams.location.trim()) {
            this.showError('Please enter both keyword and location');
            return;
        }

        if (!searchParams.outputDirectory) {
            this.showError('Please select an output directory');
            return;
        }

        this.startSearch(searchParams);
    }

    async startSearch(searchParams) {
        this.isSearching = true;
        this.updateSearchButton(true);
        this.clearStatus();
        this.clearResults();

        this.setStatusState('searching');
        document.getElementById('search-stage').textContent = 'Initializing search...';
        document.getElementById('search-details').textContent = 'Preparing to search for businesses';

        try {
            const result = await window.electronAPI.searchBusinesses(searchParams);

            if (result.success) {
                this.showResults(result);
            } else {
                // Provide more helpful error messages for config-related issues
                let errorMessage = result.error;
                if (errorMessage.includes('Configuration file not found')) {
                    errorMessage = `Configuration file not found. This can happen with MSI installations when permissions are restricted.
                    
                    Please try:
                    • Set your API key using the configuration button (⚙️)
                    • If that fails, try running the app as administrator
                    • Check that your Documents folder is writable
                    
                    Technical details: ${result.error}`;
                }
                
                this.showError(errorMessage);
                if (result.output) {
                    // Still try to parse any partial output for status updates
                    const lines = result.output.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.updateStatus(line.trim());
                        }
                    });
                }
            }
        } catch (error) {
            this.showError('Search failed: ' + error.message);
        } finally {
            this.isSearching = false;
            this.updateSearchButton(false);
        }
    }

    updateSearchButton(searching) {
        const button = document.getElementById('search-btn');
        const buttonText = button.querySelector('.button-text');
        const buttonSpinner = button.querySelector('.button-spinner');

        if (searching) {
            button.disabled = true;
            buttonText.textContent = 'Searching...';
            buttonSpinner.style.display = 'block';
        } else {
            button.disabled = false;
            buttonText.textContent = 'Start Search';
            buttonSpinner.style.display = 'none';
        }
    }

    updateStatus(message) {
        console.log('Status update:', message);

        // Parse different types of status messages from C++ backend
        if (message.includes('Searching for') && message.includes('in')) {
            this.setStatusState('searching');
            document.getElementById('search-stage').textContent = 'Map Search';
            // Simple message instead of detailed request info
            document.getElementById('search-details').textContent = 'searching google maps';
        }
        else if (message.includes('Max results:') || message.includes('Web scraping:')) {
            // Skip configuration display messages during map search
            // Don't update the details to keep the simple "searching google maps" text
        }
        else if (message.includes('Found') && message.includes('businesses')) {
            // Extract number of businesses found from "Found X businesses."
            const match = message.match(/Found (\d+) businesses/);
            if (match) {
                const count = parseInt(match[1]);
                this.scrapingProgress.total = count;
                this.scrapingProgress.current = 0;

                console.log('Set scraping progress total to:', count);

                this.setStatusState('searching');
                document.getElementById('search-stage').textContent = 'Map Search Complete';
                document.getElementById('search-details').textContent = `Found ${count} businesses - starting enhancement`;
            }
        }
        else if (message.includes('Enhanced') && message.includes('businesses with website data')) {
            // Handle "Enhanced X businesses with website data."
            const match = message.match(/Enhanced (\d+) businesses/);
            if (match) {
                const enhanced = parseInt(match[1]);
                this.setStatusState('searching');
                document.getElementById('search-stage').textContent = 'Web Scraping Complete';
                document.getElementById('search-details').innerHTML = `
                    <div>Successfully enhanced ${enhanced} business${enhanced !== 1 ? 'es' : ''}</div>
                    <div class="scraping-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 100%"></div>
                        </div>
                    </div>
                `;
            }
        }
        else if (message.includes('Enhancing') || message.includes('Scraping') || message.includes('Processing:')) {
            // Handle individual business enhancement messages
            console.log('Web scraping message detected:', message);
            this.setStatusState('searching');
            document.getElementById('search-stage').textContent = 'Web Scraping';

            // Try to extract business name from different message formats
            let businessName = '';

            // Check for "Processing: BusinessName..." format (from WebScraper)
            const processingMatch = message.match(/Processing:\s*(.+?)\.{3}/);
            if (processingMatch) {
                businessName = processingMatch[1].trim();
                console.log('Extracted business name from Processing message:', businessName);
                this.addScrapingProgress(businessName);
            }
            // Check for "Enhancing BusinessName" or "Scraping BusinessName" format
            else {
                const businessMatch = message.match(/(?:Enhancing|Scraping)\s+["']?([^"'\.]+?)["']?\s*(?:\.\.\.|\.+|$)/);
                if (businessMatch) {
                    businessName = businessMatch[1].trim();
                    console.log('Extracted business name from Enhancing/Scraping message:', businessName);
                    this.addScrapingProgress(businessName);
                } else {
                    // Fallback if we can't extract the business name
                    console.log('Could not extract business name from message:', message);
                    // Still increment progress even if we can't get the name
                    if (this.scrapingProgress.total > 0) {
                        this.scrapingProgress.current++;
                        this.updateScrapingProgress(); // Call without business name
                    } else {
                        document.getElementById('search-details').textContent = 'Collecting additional business information...';
                    }
                }
            }
        }
        else if (message.includes('Results saved to:')) {
            // Handle completion message
            if (this.currentStage === 'searching') {
                document.getElementById('search-details').textContent = 'Finalizing results...';
            }
        }
        else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            this.setStatusState('error');
            document.getElementById('error-details').textContent = message;
        }
        else if (message.includes('No businesses found')) {
            this.setStatusState('complete');
            document.getElementById('completion-details').textContent = 'No businesses found for this search';
        }
        else {
            // General status update during search
            if (this.currentStage === 'searching') {
                const detailsEl = document.getElementById('search-details');
                if (detailsEl && !detailsEl.innerHTML.includes('progress-bar')) {
                    detailsEl.textContent = message;
                }
            }
        }
    }

    setStatusState(state) {
        if (this.currentStage === state) return;

        // Hide all status states
        document.querySelectorAll('.status-state').forEach(el => {
            el.classList.remove('active');
        });

        // Show the requested state
        const targetState = document.getElementById(`status-${state}`);
        if (targetState) {
            targetState.classList.add('active');
            this.currentStage = state;
        }
    }

    addScrapingProgress(businessName) {
        this.scrapingProgress.current++;
        console.log('Adding scraping progress for:', businessName, `(${this.scrapingProgress.current}/${this.scrapingProgress.total})`);

        const stageEl = document.getElementById('search-stage');
        stageEl.textContent = 'Web Scraping';

        // Use the improved progress update method
        this.updateScrapingProgress(businessName);
    }

    updateScrapingProgress(businessName = null) {
        console.log('Updating scraping progress:', this.scrapingProgress.current, '/', this.scrapingProgress.total);

        const detailsEl = document.getElementById('search-details');

        if (this.scrapingProgress.total > 0) {
            const percentage = (this.scrapingProgress.current / this.scrapingProgress.total * 100);

            let progressHtml;
            if (businessName) {
                progressHtml = `
                    <div>Scraping business ${this.scrapingProgress.current} of ${this.scrapingProgress.total}</div>
                    <div class="business-name">${this.escapeHtml(businessName)}</div>
                    <div class="scraping-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            } else {
                progressHtml = `
                    <div>Scraping business ${this.scrapingProgress.current} of ${this.scrapingProgress.total}</div>
                    <div class="scraping-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            }

            detailsEl.innerHTML = progressHtml;
        }
    }

    clearStatus() {
        this.setStatusState('idle');
        this.scrapingProgress = { current: 0, total: 0 };
    }

    showResults(result) {
        this.lastOutputFile = result.outputFile;

        // Set status to complete
        this.showSuccess('Search completed successfully!');

        // Parse the results to extract business data
        this.parseAndDisplayResults(result);

        // Show action buttons
        const exportBtn = document.getElementById('export-btn');
        const openFileBtn = document.getElementById('open-file-btn');
        const showInFolderBtn = document.getElementById('show-in-folder-btn');
        const clearResultsBtn = document.getElementById('clear-results-btn');

        exportBtn.style.display = 'flex';
        openFileBtn.style.display = 'flex';
        showInFolderBtn.style.display = 'flex';
        clearResultsBtn.style.display = 'flex';
    }

    async parseAndDisplayResults(result) {
        try {
            // First try to use CSV data from stdout (preferred method)
            if (result.csvData && result.csvData.length > 0) {
                console.log('Using CSV data from stdout:', result.csvData.length, 'rows');

                const businesses = result.csvData.map(row => {
                    console.log('Processing CSV row from stdout:', row);
                    return {
                        name: row.name || 'Unknown Business',
                        address: row.address || '',
                        phone: row.phone_number || row.phonenumber || row.phone || '',
                        email: row.email || '',
                        website: row.website || '',
                        rating: row.rating || '',
                        reviews: row.total_ratings || row.totalratings || row.reviews || '',
                        additional_numbers: row.additional_numbers || row.additionalnumbers || '',
                        additional_emails: row.additional_emails || row.additionalemails || '',
                        social_media_links: row.social_media_links || row.socialmedialinks || ''
                    };
                });

                console.log('Parsed businesses from stdout:', businesses);
                this.displayResultsInTable(businesses);
                return;
            }

            // Fallback: try to read CSV file if stdout parsing failed
            if (result.outputFile && result.outputFile.endsWith('.csv')) {
                console.log('Fallback: attempting to read CSV file:', result.outputFile);

                let csvResult = null;
                for (let attempt = 0; attempt < 3; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));

                    csvResult = await window.electronAPI.readCSVFile(result.outputFile);
                    console.log(`CSV file read attempt ${attempt + 1}:`, csvResult);

                    if (csvResult.success && csvResult.data.length > 0) {
                        const businesses = csvResult.data.map(row => ({
                            name: row.name || 'Unknown Business',
                            address: row.address || '',
                            phone: row.phone_number || row.phonenumber || row.phone || '',
                            email: row.email || '',
                            website: row.website || '',
                            rating: row.rating || '',
                            reviews: row.total_ratings || row.totalratings || row.reviews || ''
                        }));

                        this.displayResultsInTable(businesses);
                        return;
                    }
                }
            }

            // Final fallback: show message that no data was found
            console.log('No CSV data found, showing no results message');
            this.displayNoResults('Search completed but no business data could be loaded.');

        } catch (error) {
            console.error('Error parsing results:', error);
            this.displayNoResults('Error loading search results: ' + error.message);
        }
    }

    displayNoResults(message = 'No business data found.') {
        this.lastSearchResults = [];

        // Show no results message
        const noResults = document.getElementById('no-results');
        const tableContainer = document.getElementById('results-table-container');

        noResults.style.display = 'block';
        noResults.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <div style="font-size: 1.1em; margin-bottom: 0.5rem;">📋</div>
                <div>${message}</div>
            </div>
        `;
        tableContainer.style.display = 'none';
    }

    displayResultsInTable(businesses) {
        this.lastSearchResults = businesses;

        // Hide no results message
        const noResults = document.getElementById('no-results');
        const tableContainer = document.getElementById('results-table-container');

        noResults.style.display = 'none';
        tableContainer.style.display = 'block';

        // Update results count
        const resultsCount = document.getElementById('results-count');
        resultsCount.textContent = `${businesses.length} result${businesses.length !== 1 ? 's' : ''}`;

        // Populate table
        const tbody = document.getElementById('results-tbody');
        tbody.innerHTML = '';

        businesses.forEach((business, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="cell-name">${this.escapeHtml(business.name)}</td>
                <td class="cell-address">${this.escapeHtml(business.address)}</td>
                <td class="cell-phone">${this.escapeHtml(business.phone)}</td>
                <td class="cell-email">${business.email ? `<a href="mailto:${business.email}">${this.escapeHtml(business.email)}</a>` : '-'}</td>
                <td class="cell-website">${business.website ? `<a href="${business.website}" target="_blank" title="${business.website}">${this.escapeHtml(business.website)}</a>` : '-'}</td>
                <td class="cell-rating">${business.rating ? business.rating + '★' : '-'}</td>
                <td class="cell-reviews">${business.reviews || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    displayBasicResults(result) {
        // Fallback to basic display if we can't parse detailed results
        const noResults = document.getElementById('no-results');
        const tableContainer = document.getElementById('results-table-container');

        noResults.style.display = 'flex';
        tableContainer.style.display = 'none';

        // Update the no results message to show basic info
        const noResultsContent = noResults.querySelector('.no-results-content');
        noResultsContent.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
            <h3>Search Completed</h3>
            <p>Results saved to file. Use the buttons above to view the output file.</p>
        `;

        const resultsCount = document.getElementById('results-count');
        resultsCount.textContent = 'Search completed';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearResults() {
        this.lastSearchResults = [];

        const noResults = document.getElementById('no-results');
        const tableContainer = document.getElementById('results-table-container');

        noResults.style.display = 'flex';
        tableContainer.style.display = 'none';

        // Reset no results message
        const noResultsContent = noResults.querySelector('.no-results-content');
        noResultsContent.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
            </svg>
            <h3>No Results Yet</h3>
            <p>Run a search to see business results here</p>
        `;

        const resultsCount = document.getElementById('results-count');
        resultsCount.textContent = '0 results';

        // Hide action buttons
        this.hideActionButtons();
    }

    hideActionButtons() {
        const exportBtn = document.getElementById('export-btn');
        const openFileBtn = document.getElementById('open-file-btn');
        const showInFolderBtn = document.getElementById('show-in-folder-btn');
        const clearResultsBtn = document.getElementById('clear-results-btn');

        exportBtn.style.display = 'none';
        openFileBtn.style.display = 'none';
        showInFolderBtn.style.display = 'none';
        clearResultsBtn.style.display = 'none';
    }

    exportResults() {
        if (this.lastOutputFile) {
            this.openResultFile();
        } else {
            this.showError('No export file available');
        }
    }

    async openResultFile() {
        if (!this.lastOutputFile) {
            this.showError('No output file available');
            return;
        }

        try {
            const result = await window.electronAPI.openFile(this.lastOutputFile);
            if (!result.success) {
                this.showError('Failed to open file: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to open file: ' + error.message);
        }
    }

    async showResultInFolder() {
        if (!this.lastOutputFile) {
            this.showError('No output file available');
            return;
        }

        try {
            const result = await window.electronAPI.showItemInFolder(this.lastOutputFile);
            if (!result.success) {
                this.showError('Failed to show file in folder: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to show file in folder: ' + error.message);
        }
    }

    showError(message) {
        this.setStatusState('error');
        document.getElementById('error-details').textContent = message;
        console.error(message);
    }

    showSuccess(message) {
        this.setStatusState('complete');
        document.getElementById('completion-details').textContent = message || 'Results are ready for review';
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BusinessScraperApp();
});
