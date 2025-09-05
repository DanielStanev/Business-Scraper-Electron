#include "utils/ConfigManager.h"
#include <fstream>
#include <iostream>

ConfigManager::ConfigManager() {
    clear_error();
}

ConfigManager::~ConfigManager() {}

bool ConfigManager::load_config(const std::string& filename) {
    clear_error();

    std::ifstream config_file(filename);
    if (!config_file.is_open()) {
        set_error("Could not open config file: " + filename);
        return false;
    }

    m_config_values.clear();
    std::string line;
    int line_number = 0;

    while (std::getline(config_file, line)) {
        line_number++;

        // Skip comments and empty lines
        line = trim_whitespace(line);
        if (line.empty() || line[0] == '#' || line[0] == ';' || line[0] == '[') {
            continue;
        }

        // Look for key=value pairs
        size_t equals_pos = line.find('=');
        if (equals_pos == std::string::npos) {
            // Skip lines without = sign (could log warning)
            continue;
        }

        std::string key = trim_whitespace(line.substr(0, equals_pos));
        std::string value = trim_whitespace(line.substr(equals_pos + 1));

        if (!key.empty()) {
            m_config_values[key] = value;
        }
    }

    config_file.close();
    return true;
}

bool ConfigManager::save_config(const std::string& filename) const {
    std::ofstream config_file(filename);
    if (!config_file.is_open()) {
        return false;
    }

    // Write header comment
    config_file << "# Business Scraper Configuration File\n";
    config_file << "# Generated automatically - modify with care\n\n";

    // Write all key-value pairs
    for (const auto& pair : m_config_values) {
        config_file << pair.first << "=" << pair.second << "\n";
    }

    config_file.close();
    return true;
}

std::string ConfigManager::get_value(const std::string& key) const {
    auto it = m_config_values.find(key);
    return (it != m_config_values.end()) ? it->second : "";
}

void ConfigManager::set_value(const std::string& key, const std::string& value) {
    m_config_values[key] = value;
}

bool ConfigManager::has_key(const std::string& key) const {
    return m_config_values.find(key) != m_config_values.end();
}

std::string ConfigManager::get_api_key() const {
    return get_value("google_maps_api_key");
}

void ConfigManager::set_api_key(const std::string& api_key) {
    set_value("google_maps_api_key", api_key);
}

void ConfigManager::clear_error() {
    m_last_error.clear();
}

void ConfigManager::set_error(const std::string& error) {
    m_last_error = error;
}

std::string ConfigManager::trim_whitespace(const std::string& str) const {
    if (str.empty()) return str;

    size_t start = str.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";

    size_t end = str.find_last_not_of(" \t\r\n");
    return str.substr(start, end - start + 1);
}
