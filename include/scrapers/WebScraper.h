#ifndef WEBSCRAPER_H
#define WEBSCRAPER_H

#include <string>
#include <vector>
#include <regex>
#include "core/Business.h"

class WebScraper {
public:
    WebScraper();
    ~WebScraper();

    // Main functionality
    void enhance_businesses(std::vector<Business>& businesses);

    // Configuration
    void set_timeout(int timeout_seconds) { m_timeout = timeout_seconds; }
    int timeout() const { return m_timeout; }

    void set_max_retries(int retries) { m_max_retries = retries; }
    int max_retries() const { return m_max_retries; }

private:
    int m_timeout;
    int m_max_retries;

    // Core scraping methods
    std::string fetch_website_content(const std::string& url) const;
    void extract_contact_info(Business& business, const std::string& html_content) const;

    // Extraction methods
    std::vector<std::string> extract_emails(const std::string& content) const;
    std::vector<std::string> extract_phone_numbers(const std::string& content) const;
    std::vector<std::string> extract_social_links(const std::string& content) const;

    // Regex patterns
    std::regex m_email_regex;
    std::regex m_phone_regex;
    std::regex m_social_regex;
};

#endif
