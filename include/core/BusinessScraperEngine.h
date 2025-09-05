#ifndef BUSINESS_SCRAPER_ENGINE_H
#define BUSINESS_SCRAPER_ENGINE_H

#include <vector>
#include <string>
#include <functional>
#include "core/Business.h"
#include "output/Formatter.h"

// Structure to hold search parameters
struct SearchOptions {
    std::string keyword;
    std::string location;
    int max_results = 20;
    bool enhance_with_web_scraping = true;
};

// Structure to hold results
struct SearchResults {
    std::vector<Business> businesses;
    bool success = false;
    std::string error_message;
    int total_found = 0;
    int enhanced_count = 0;
};

class BusinessScraperEngine {
public:
    BusinessScraperEngine();
    ~BusinessScraperEngine();

    // Configuration
    bool set_api_key(const std::string& api_key);
    std::string api_key() const { return m_api_key; }

    // Main functionality
    SearchResults search_businesses(const SearchOptions& options);

    // Status callbacks (for GUI status updates)
    void set_status_callback(std::function<void(const std::string&)> callback);

    // Output generation
    std::string format_results(const SearchResults& results, OutputFormat format) const;

private:
    std::string m_api_key;
    std::function<void(const std::string&)> m_status_callback;

    // Helper methods
    void notify_status(const std::string& message);
};

#endif
