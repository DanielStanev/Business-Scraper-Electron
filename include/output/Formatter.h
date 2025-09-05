#ifndef FORMATTER_H
#define FORMATTER_H

#include <string>
#include <vector>
#include "core/Business.h"

enum class OutputFormat {
    CSV,
    JSON,
    YAML,
    XML
};

class Formatter {
public:
    Formatter();
    explicit Formatter(OutputFormat format);
    ~Formatter();

    // Output Format
    OutputFormat format() const { return m_format; }
    void set_format(OutputFormat format) { m_format = format; }

    // Main functionality
    std::string format_businesses(const std::vector<Business>& businesses) const;

private:
    OutputFormat m_format;

    // Format-specific methods
    std::string format_as_csv(const std::vector<Business>& businesses) const;
    std::string format_as_json(const std::vector<Business>& businesses) const;
    std::string format_as_yaml(const std::vector<Business>& businesses) const;
    std::string format_as_xml(const std::vector<Business>& businesses) const;

    // Helper methods
    std::string escape_csv_field(const std::string& field) const;
    std::string escape_json_string(const std::string& str) const;
    std::string escape_xml_string(const std::string& str) const;
    std::string vector_to_string(const std::vector<std::string>& vec, const std::string& delimiter = ", ") const;
};

#endif
