#include "output/Formatter.h"
#include <sstream>
#include <iomanip>
#include <algorithm>

Formatter::Formatter()
    : m_format(OutputFormat::CSV)
{}

Formatter::Formatter(OutputFormat format)
    : m_format(format)
{}

Formatter::~Formatter() {}

std::string Formatter::format_businesses(const std::vector<Business>& businesses) const {
    switch (m_format) {
        case OutputFormat::CSV:
            return format_as_csv(businesses);
        case OutputFormat::JSON:
            return format_as_json(businesses);
        case OutputFormat::YAML:
            return format_as_yaml(businesses);
        case OutputFormat::XML:
            return format_as_xml(businesses);
        default:
            return format_as_csv(businesses);
    }
}

std::string Formatter::format_as_csv(const std::vector<Business>& businesses) const {
    std::ostringstream oss;

    // CSV Header
    oss << "Name,Address,Phone Number,Email,Website,Rating,Total Ratings,Additional Numbers,Additional Emails,Social Media Links\n";

    // CSV Data
    for (const auto& business : businesses) {
        oss << escape_csv_field(business.name()) << ","
            << escape_csv_field(business.address()) << ","
            << escape_csv_field(business.phone_number()) << ","
            << escape_csv_field(business.email()) << ","
            << escape_csv_field(business.website()) << ","
            << std::fixed << std::setprecision(1) << business.rating() << ","
            << business.total_ratings() << ","
            << escape_csv_field(vector_to_string(business.additional_numbers())) << ","
            << escape_csv_field(vector_to_string(business.additional_emails())) << ","
            << escape_csv_field(vector_to_string(business.social_media_links())) << "\n";
    }

    return oss.str();
}

std::string Formatter::format_as_json(const std::vector<Business>& businesses) const {
    std::ostringstream oss;

    oss << "{\n  \"businesses\": [\n";

    for (size_t i = 0; i < businesses.size(); ++i) {
        const auto& business = businesses[i];

        oss << "    {\n"
            << "      \"name\": \"" << escape_json_string(business.name()) << "\",\n"
            << "      \"address\": \"" << escape_json_string(business.address()) << "\",\n"
            << "      \"phone_number\": \"" << escape_json_string(business.phone_number()) << "\",\n"
            << "      \"email\": \"" << escape_json_string(business.email()) << "\",\n"
            << "      \"website\": \"" << escape_json_string(business.website()) << "\",\n"
            << "      \"rating\": " << std::fixed << std::setprecision(1) << business.rating() << ",\n"
            << "      \"total_ratings\": " << business.total_ratings() << ",\n"
            << "      \"additional_numbers\": [";

        const auto& numbers = business.additional_numbers();
        for (size_t j = 0; j < numbers.size(); ++j) {
            oss << "\"" << escape_json_string(numbers[j]) << "\"";
            if (j < numbers.size() - 1) oss << ", ";
        }

        oss << "],\n      \"additional_emails\": [";

        const auto& emails = business.additional_emails();
        for (size_t j = 0; j < emails.size(); ++j) {
            oss << "\"" << escape_json_string(emails[j]) << "\"";
            if (j < emails.size() - 1) oss << ", ";
        }

        oss << "],\n      \"social_media_links\": [";

        const auto& social = business.social_media_links();
        for (size_t j = 0; j < social.size(); ++j) {
            oss << "\"" << escape_json_string(social[j]) << "\"";
            if (j < social.size() - 1) oss << ", ";
        }

        oss << "]\n    }";
        if (i < businesses.size() - 1) oss << ",";
        oss << "\n";
    }

    oss << "  ]\n}";

    return oss.str();
}

std::string Formatter::format_as_yaml(const std::vector<Business>& businesses) const {
    std::ostringstream oss;

    oss << "businesses:\n";

    for (const auto& business : businesses) {
        oss << "  - name: \"" << business.name() << "\"\n"
            << "    address: \"" << business.address() << "\"\n"
            << "    phone_number: \"" << business.phone_number() << "\"\n"
            << "    email: \"" << business.email() << "\"\n"
            << "    website: \"" << business.website() << "\"\n"
            << "    rating: " << std::fixed << std::setprecision(1) << business.rating() << "\n"
            << "    total_ratings: " << business.total_ratings() << "\n";

        const auto& numbers = business.additional_numbers();
        if (!numbers.empty()) {
            oss << "    additional_numbers:\n";
            for (const auto& number : numbers) {
                oss << "      - \"" << number << "\"\n";
            }
        } else {
            oss << "    additional_numbers: []\n";
        }

        const auto& emails = business.additional_emails();
        if (!emails.empty()) {
            oss << "    additional_emails:\n";
            for (const auto& email : emails) {
                oss << "      - \"" << email << "\"\n";
            }
        } else {
            oss << "    additional_emails: []\n";
        }

        const auto& social = business.social_media_links();
        if (!social.empty()) {
            oss << "    social_media_links:\n";
            for (const auto& link : social) {
                oss << "      - \"" << link << "\"\n";
            }
        } else {
            oss << "    social_media_links: []\n";
        }
        oss << '\n';
    }

    return oss.str();
}

std::string Formatter::format_as_xml(const std::vector<Business>& businesses) const {
    std::ostringstream oss;

    oss << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        << "<businesses>\n";

    for (const auto& business : businesses) {
        oss << "  <business>\n"
            << "    <name>" << escape_xml_string(business.name()) << "</name>\n"
            << "    <address>" << escape_xml_string(business.address()) << "</address>\n"
            << "    <phone_number>" << escape_xml_string(business.phone_number()) << "</phone_number>\n"
            << "    <email>" << escape_xml_string(business.email()) << "</email>\n"
            << "    <website>" << escape_xml_string(business.website()) << "</website>\n"
            << "    <rating>" << std::fixed << std::setprecision(1) << business.rating() << "</rating>\n"
            << "    <total_ratings>" << business.total_ratings() << "</total_ratings>\n";

        oss << "    <additional_numbers>\n";
        for (const auto& number : business.additional_numbers()) {
            oss << "      <number>" << escape_xml_string(number) << "</number>\n";
        }
        oss << "    </additional_numbers>\n";

        oss << "    <additional_emails>\n";
        for (const auto& email : business.additional_emails()) {
            oss << "      <email>" << escape_xml_string(email) << "</email>\n";
        }
        oss << "    </additional_emails>\n";

        oss << "    <social_media_links>\n";
        for (const auto& link : business.social_media_links()) {
            oss << "      <link>" << escape_xml_string(link) << "</link>\n";
        }
        oss << "    </social_media_links>\n";

        oss << "  </business>\n";
    }

    oss << "</businesses>";

    return oss.str();
}

std::string Formatter::escape_csv_field(const std::string& field) const {
    if (field.empty()) return "";

    bool needs_quotes = (field.find(',') != std::string::npos ||
                        field.find('"') != std::string::npos ||
                        field.find('\n') != std::string::npos);

    if (!needs_quotes) return field;

    std::string escaped = field;
    // Escape quotes by doubling them
    size_t pos = 0;
    while ((pos = escaped.find('"', pos)) != std::string::npos) {
        escaped.insert(pos, "\"");
        pos += 2;
    }

    return "\"" + escaped + "\"";
}

std::string Formatter::escape_json_string(const std::string& str) const {
    std::string escaped;
    for (char c : str) {
        switch (c) {
            case '"': escaped += "\\\""; break;
            case '\\': escaped += "\\\\"; break;
            case '\b': escaped += "\\b"; break;
            case '\f': escaped += "\\f"; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default: escaped += c; break;
        }
    }
    return escaped;
}

std::string Formatter::escape_xml_string(const std::string& str) const {
    std::string escaped;
    for (char c : str) {
        switch (c) {
            case '<': escaped += "&lt;"; break;
            case '>': escaped += "&gt;"; break;
            case '&': escaped += "&amp;"; break;
            case '"': escaped += "&quot;"; break;
            case '\'': escaped += "&apos;"; break;
            default: escaped += c; break;
        }
    }
    return escaped;
}

std::string Formatter::vector_to_string(const std::vector<std::string>& vec, const std::string& delimiter) const {
    if (vec.empty()) return "";

    std::ostringstream oss;
    for (size_t i = 0; i < vec.size(); ++i) {
        oss << vec[i];
        if (i < vec.size() - 1) oss << delimiter;
    }
    return oss.str();
}