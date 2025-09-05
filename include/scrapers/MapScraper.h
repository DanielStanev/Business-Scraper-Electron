#ifndef MAPSCRAPER_H
#define MAPSCRAPER_H

#include <string>
#include <vector>
#include "core/Business.h"

class MapScraper {
private:
    std::string m_api_key;
    std::string m_keyword;
    std::string m_location;
    int m_max_results;

    // Helper methods
    std::string build_search_url() const;
    std::string make_http_request(const std::string& url) const;
    std::vector<Business> parse_response(const std::string& json_response) const;
    std::vector<Business> parse_response_with_pagination(const std::string& json_response, std::string& next_page_token, int& current_count) const;
    Business parse_business_details(const std::string& place_id) const;

public:
    MapScraper();
    MapScraper(const std::string& api_key);
    MapScraper(const std::string& api_key, const std::string& keyword, const std::string& location,
               int max_results = 20);
    ~MapScraper();

    // API Key
    std::string api_key() const { return m_api_key; }
    void set_api_key(const std::string& api_key) { m_api_key = api_key; }

    // Keyword
    std::string keyword() const { return m_keyword; }
    void set_keyword(const std::string& keyword) { m_keyword = keyword; }

    // Location
    std::string location() const { return m_location; }
    void set_location(const std::string& location) { m_location = location; }

    // Max Results
    int max_results() const { return m_max_results; }
    void set_max_results(int results) { m_max_results = results; }

    // Main functionality
    std::vector<Business> search_businesses();
};

#endif