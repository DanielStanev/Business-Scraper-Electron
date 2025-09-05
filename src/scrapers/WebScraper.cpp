#include "scrapers/WebScraper.h"
#include <iostream>
#include <curl/curl.h>
#include <algorithm>
#include <set>
#include <sstream>

namespace {
    // Callback function for curl to write response data
    size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* s) {
        size_t newLength = size * nmemb;
        try {
            s->append((char*)contents, newLength);
        } catch (std::bad_alloc& e) {
            return 0;
        }
        return newLength;
    }

    // Helper functions for URL and data validation/formatting
    std::string clean_url(const std::string& url) {
        std::string cleaned = url;

        // Add protocol if missing
        if (cleaned.find("http://") != 0 && cleaned.find("https://") != 0) {
            cleaned = "https://" + cleaned;
        }

        return cleaned;
    }

    bool is_valid_email(const std::string& email) {
        // Basic validation - regex already does most of the work
        return !email.empty() &&
               email.find("@") != std::string::npos &&
               email.find(".") != std::string::npos &&
               email.length() > 5 &&
               email.find("..") == std::string::npos && // No consecutive dots
               email.find("@.") == std::string::npos && // No @ followed by dot
               email.find(".@") == std::string::npos;   // No dot followed by @
    }

    bool is_valid_phone(const std::string& phone) {
        // Check if normalized phone has reasonable length
        std::string digits_only;
        for (char c : phone) {
            if (std::isdigit(c)) {
                digits_only += c;
            }
        }

        return digits_only.length() >= 10 && digits_only.length() <= 15;
    }

    std::string normalize_phone(const std::string& phone) {
        // Extract only digits
        std::string digits;
        for (char c : phone) {
            if (std::isdigit(c)) {
                digits += c;
            }
        }

        // Format as (XXX) XXX-XXXX for US numbers
        if (digits.length() == 10) {
            return "(" + digits.substr(0, 3) + ") " + digits.substr(3, 3) + "-" + digits.substr(6, 4);
        } else if (digits.length() == 11 && digits[0] == '1') {
            return "+1 (" + digits.substr(1, 3) + ") " + digits.substr(4, 3) + "-" + digits.substr(7, 4);
        }

        // Return original if can't normalize
        return phone;
    }
}

WebScraper::WebScraper()
    : m_timeout(10)
    , m_max_retries(3)
    , m_email_regex(R"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")
    , m_phone_regex(R"(\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4}))")
    , m_social_regex(R"(https?://(www\.)?(facebook|twitter|instagram|linkedin|youtube|tiktok)\.com/[^\s<>"']+)")
{}

WebScraper::~WebScraper() {}

void WebScraper::enhance_businesses(std::vector<Business>& businesses) {
    std::cout << "Enhancing business data from websites..." << std::endl;

    int processed = 0;
    for (auto& business : businesses) {
        if (!business.website().empty()) {
            std::cout << "Processing: " << business.name() << "..." << std::endl;

            std::string content = fetch_website_content(business.website());
            if (!content.empty()) {
                extract_contact_info(business, content);
            }
            processed++;
        }
    }

    std::cout << "Enhanced " << processed << " businesses with website data." << std::endl;
}

std::string WebScraper::fetch_website_content(const std::string& url) const {
    CURL* curl;
    CURLcode res;
    std::string response_string;

    std::string clean_url_str = clean_url(url);

    curl = curl_easy_init();
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, clean_url_str.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_string);
        curl_easy_setopt(curl, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, m_timeout);
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_MAXREDIRS, 5L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

        res = curl_easy_perform(curl);
        curl_easy_cleanup(curl);

        if (res != CURLE_OK) {
            std::cerr << "Failed to fetch " << clean_url_str << ": " << curl_easy_strerror(res) << std::endl;
            return "";
        }
    }

    return response_string;
}

void WebScraper::extract_contact_info(Business& business, const std::string& html_content) const {
    // Extract emails
    std::vector<std::string> emails = extract_emails(html_content);
    for (const auto& email : emails) {
        if (business.email().empty()) {
            business.set_email(email);
        } else {
            // Add to additional emails if it's different from primary
            if (email != business.email()) {
                auto additional = business.additional_emails();
                if (std::find(additional.begin(), additional.end(), email) == additional.end()) {
                    additional.push_back(email);
                    business.set_additional_emails(additional);
                }
            }
        }
    }

    // Extract phone numbers
    std::vector<std::string> phones = extract_phone_numbers(html_content);
    for (const auto& phone : phones) {
        std::string normalized = normalize_phone(phone);
        if (business.phone_number().empty()) {
            business.set_phone_number(normalized);
        } else {
            // Add to additional phones if it's different from primary
            if (normalized != business.phone_number()) {
                auto additional = business.additional_numbers();
                if (std::find(additional.begin(), additional.end(), normalized) == additional.end()) {
                    additional.push_back(normalized);
                    business.set_additional_numbers(additional);
                }
            }
        }
    }

    // Extract social media links
    std::vector<std::string> social_links = extract_social_links(html_content);
    auto current_social = business.social_media_links();
    for (const auto& link : social_links) {
        if (std::find(current_social.begin(), current_social.end(), link) == current_social.end()) {
            current_social.push_back(link);
        }
    }
    business.set_social_media_links(current_social);
}

std::vector<std::string> WebScraper::extract_emails(const std::string& content) const {
    std::vector<std::string> emails;
    std::set<std::string> unique_emails; // Prevent duplicates

    std::sregex_iterator start(content.begin(), content.end(), m_email_regex);
    std::sregex_iterator end;

    for (std::sregex_iterator i = start; i != end; ++i) {
        std::string email = (*i).str();
        std::transform(email.begin(), email.end(), email.begin(), ::tolower);

        if (is_valid_email(email) && unique_emails.find(email) == unique_emails.end()) {
            unique_emails.insert(email);
            emails.push_back(email);
        }
    }

    return emails;
}

std::vector<std::string> WebScraper::extract_phone_numbers(const std::string& content) const {
    std::vector<std::string> phones;
    std::set<std::string> unique_phones; // Prevent duplicates

    std::sregex_iterator start(content.begin(), content.end(), m_phone_regex);
    std::sregex_iterator end;

    for (std::sregex_iterator i = start; i != end; ++i) {
        std::string phone = (*i).str();
        std::string normalized = normalize_phone(phone);

        if (is_valid_phone(normalized) && unique_phones.find(normalized) == unique_phones.end()) {
            unique_phones.insert(normalized);
            phones.push_back(normalized);
        }
    }

    return phones;
}

std::vector<std::string> WebScraper::extract_social_links(const std::string& content) const {
    std::vector<std::string> social_links;
    std::set<std::string> unique_links; // Prevent duplicates

    std::sregex_iterator start(content.begin(), content.end(), m_social_regex);
    std::sregex_iterator end;

    for (std::sregex_iterator i = start; i != end; ++i) {
        std::string link = (*i).str();

        if (unique_links.find(link) == unique_links.end()) {
            unique_links.insert(link);
            social_links.push_back(link);
        }
    }

    return social_links;
}
