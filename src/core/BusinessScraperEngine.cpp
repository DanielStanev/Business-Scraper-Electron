#include "core/BusinessScraperEngine.h"
#include "scrapers/MapScraper.h"
#include "scrapers/WebScraper.h"
#include "output/Formatter.h"
#include <iostream>

BusinessScraperEngine::BusinessScraperEngine() {
    // Default empty callback
    m_status_callback = [](const std::string&) {};
}

BusinessScraperEngine::~BusinessScraperEngine() {}

bool BusinessScraperEngine::set_api_key(const std::string& api_key) {
    if (api_key.empty()) {
        return false;
    }
    m_api_key = api_key;
    return true;
}

SearchResults BusinessScraperEngine::search_businesses(const SearchOptions& options) {
    SearchResults results;

    // Validate inputs
    if (m_api_key.empty()) {
        results.error_message = "API key not set";
        return results;
    }

    if (options.keyword.empty() || options.location.empty()) {
        results.error_message = "Keyword and location are required";
        return results;
    }

    try {
        notify_status("Initializing search...");

        // Create and configure MapScraper
        MapScraper scraper(m_api_key, options.keyword, options.location,
                          options.max_results);

        notify_status("Searching for businesses...");

        // Search for businesses
        results.businesses = scraper.search_businesses();
        results.total_found = static_cast<int>(results.businesses.size());

        if (results.businesses.empty()) {
            notify_status("No businesses found");
            results.success = true;
            return results;
        }

        notify_status("Found " + std::to_string(results.total_found) + " businesses");

        // Enhance businesses with web scraping if requested
        if (options.enhance_with_web_scraping) {
            notify_status("Enhancing business data from websites...");

            WebScraper web_scraper;
            web_scraper.enhance_businesses(results.businesses);

            // Count how many were enhanced (have websites)
            results.enhanced_count = 0;
            for (const auto& business : results.businesses) {
                if (!business.website().empty()) {
                    results.enhanced_count++;
                }
            }

            notify_status("Enhanced " + std::to_string(results.enhanced_count) + " businesses with website data");
        }

        notify_status("Search completed successfully");
        results.success = true;

    } catch (const std::exception& e) {
        results.error_message = "Search failed: " + std::string(e.what());
        notify_status("Search failed: " + results.error_message);
    }

    return results;
}

void BusinessScraperEngine::set_status_callback(std::function<void(const std::string&)> callback) {
    m_status_callback = callback ? callback : [](const std::string&) {};
}

std::string BusinessScraperEngine::format_results(const SearchResults& results, OutputFormat format) const {
    if (!results.success || results.businesses.empty()) {
        return "";
    }

    Formatter formatter(format);
    return formatter.format_businesses(results.businesses);
}

void BusinessScraperEngine::notify_status(const std::string& message) {
    if (m_status_callback) {
        m_status_callback(message);
    }
}
