#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <string>
#include <map>

class ConfigManager {
public:
    ConfigManager();
    ~ConfigManager();

    // Configuration file operations
    bool load_config(const std::string& filename = "config.ini");
    bool save_config(const std::string& filename = "config.ini") const;

    // Key-value operations
    std::string get_value(const std::string& key) const;
    void set_value(const std::string& key, const std::string& value);
    bool has_key(const std::string& key) const;

    // Convenience methods for common config values
    std::string get_api_key() const;
    void set_api_key(const std::string& api_key);

    // Error handling
    std::string last_error() const { return m_last_error; }
    bool has_error() const { return !m_last_error.empty(); }

private:
    std::map<std::string, std::string> m_config_values;
    std::string m_last_error;

    // Helper methods
    void clear_error();
    void set_error(const std::string& error);
    std::string trim_whitespace(const std::string& str) const;
};

#endif
