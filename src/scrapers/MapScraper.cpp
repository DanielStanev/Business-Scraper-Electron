#include "scrapers/MapScraper.h"
#include <iostream>
#include <curl/curl.h>
#include <json/json.h>
#include <sstream>
#include <thread>
#include <chrono>

MapScraper::MapScraper()
    : m_max_results(20)
{}

MapScraper::MapScraper(const std::string& api_key)
    : m_api_key(api_key)
    , m_max_results(20)
{}

MapScraper::MapScraper(const std::string& api_key, const std::string& keyword, const std::string& location,
                       int max_results)
    : m_api_key(api_key)
    , m_keyword(keyword)
    , m_location(location)
    , m_max_results(max_results)
{}

MapScraper::~MapScraper() {}

namespace {
    // URL encoding function
    std::string url_encode(const std::string& value) {
        CURL* curl = curl_easy_init();
        if (curl) {
            char* encoded = curl_easy_escape(curl, value.c_str(), value.length());
            if (encoded) {
                std::string result(encoded);
                curl_free(encoded);
                curl_easy_cleanup(curl);
                return result;
            }
            curl_easy_cleanup(curl);
        }
        return value; // fallback to original if encoding fails
    }

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
} // end anonymous namespace

std::string MapScraper::build_search_url() const {
    std::string base_url = "https://maps.googleapis.com/maps/api/place/textsearch/json?";

    // Build the query string properly encoded
    std::string search_query = m_keyword + " in " + m_location;
    std::string encoded_query = url_encode(search_query);

    std::string query = "query=" + encoded_query;
    std::string key = "&key=" + m_api_key;

    return base_url + query + key;
}std::string MapScraper::make_http_request(const std::string& url) const {
    CURL* curl;
    CURLcode res;
    std::string response_string;

    curl = curl_easy_init();
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_string);
        curl_easy_setopt(curl, CURLOPT_USERAGENT, "business-scraper/1.0");

        res = curl_easy_perform(curl);
        curl_easy_cleanup(curl);

        if (res != CURLE_OK) {
            std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;
            return "";
        }
    }

    return response_string;
}

Business MapScraper::parse_business_details(const std::string& place_id) const {
    std::string details_url = "https://maps.googleapis.com/maps/api/place/details/json?";
    details_url += "place_id=" + place_id;
    details_url += "&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total";
    details_url += "&key=" + m_api_key;

    std::string response = make_http_request(details_url);
    Business business;

    if (response.empty()) {
        return business;
    }

    Json::Value root;
    Json::Reader reader;

    if (reader.parse(response, root)) {
        const Json::Value& result = root["result"];

        if (!result.isNull()) {
            if (!result["name"].isNull()) {
                business.set_name(result["name"].asString());
            }
            if (!result["formatted_address"].isNull()) {
                business.set_address(result["formatted_address"].asString());
            }
            if (!result["formatted_phone_number"].isNull()) {
                business.set_phone_number(result["formatted_phone_number"].asString());
            }
            if (!result["website"].isNull()) {
                business.set_website(result["website"].asString());
            }
            if (!result["rating"].isNull()) {
                business.set_rating(result["rating"].asDouble());
            }
            if (!result["user_ratings_total"].isNull()) {
                business.set_total_ratings(result["user_ratings_total"].asInt());
            }
        }
    }

    return business;
}

std::vector<Business> MapScraper::parse_response(const std::string& json_response) const {
    std::vector<Business> businesses;
    Json::Value root;
    Json::Reader reader;

    if (!reader.parse(json_response, root)) {
        std::cerr << "Failed to parse JSON response" << std::endl;
        return businesses;
    }

    const Json::Value& results = root["results"];
    if (results.isNull() || !results.isArray()) {
        std::cerr << "No results found in response" << std::endl;
        return businesses;
    }

    int count = 0;
    for (const auto& result : results) {
        if (count >= m_max_results) break;

        std::string place_id = result["place_id"].asString();
        if (!place_id.empty()) {
            Business business = parse_business_details(place_id);
            if (!business.name().empty()) {
                businesses.push_back(business);
                count++;
            }
        }
    }

    return businesses;
}

std::vector<Business> MapScraper::parse_response_with_pagination(const std::string& json_response, std::string& next_page_token, int& current_count) const {
    std::vector<Business> businesses;
    Json::Value root;
    Json::Reader reader;

    if (!reader.parse(json_response, root)) {
        std::cerr << "Failed to parse JSON response" << std::endl;
        return businesses;
    }

    // Check for next_page_token
    if (!root["next_page_token"].isNull()) {
        next_page_token = root["next_page_token"].asString();
    } else {
        next_page_token.clear();
    }

    const Json::Value& results = root["results"];
    if (results.isNull() || !results.isArray()) {
        std::cerr << "No results found in response" << std::endl;
        return businesses;
    }

    for (const auto& result : results) {
        if (current_count >= m_max_results) break;

        std::string place_id = result["place_id"].asString();
        if (!place_id.empty()) {
            Business business = parse_business_details(place_id);
            if (!business.name().empty()) {
                businesses.push_back(business);
            }
        }
    }

    return businesses;
}

std::vector<Business> MapScraper::search_businesses() {
    if (m_api_key.empty() || m_keyword.empty() || m_location.empty()) {
        std::cerr << "API key, keyword, and location must be set before searching" << std::endl;
        return std::vector<Business>();
    }

    std::vector<Business> all_businesses;
    std::string next_page_token;
    int total_fetched = 0;

    do {
        std::string url = build_search_url();
        if (!next_page_token.empty()) {
            url += "&pagetoken=" + next_page_token;

            // Google API requires a delay between page requests
            std::cout << "Waiting for next page..." << std::endl;
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }

        std::cout << "Querying Google Maps" << std::endl;

        std::string response = make_http_request(url);
        if (response.empty()) {
            std::cerr << "Failed to get response from Google Maps API" << std::endl;
            break;
        }

        // Parse this page and get next_page_token
        auto page_result = parse_response_with_pagination(response, next_page_token, total_fetched);

        // Add businesses from this page
        for (const auto& business : page_result) {
            if (total_fetched >= m_max_results) break;
            all_businesses.push_back(business);
            total_fetched++;
        }

        // Stop if we have enough results or no more pages
    } while (!next_page_token.empty() && total_fetched < m_max_results);

    return all_businesses;
}