#include <iostream>
#include <string>
#include <getopt.h>
#include <cstdlib>
#include <algorithm>

#include "core/BusinessScraperEngine.h"
#include "utils/ConfigManager.h"
#include "utils/FileUtils.h"

// Structure to hold program options
struct ProgramOptions {
    SearchOptions search_options;
    OutputFormat output_format = OutputFormat::CSV;
    std::string output_filename;  // Custom output filename
    bool show_help = false;
};

// Function declarations
void print_usage(const char* program_name);
bool parse_command_line(int argc, char** argv, ProgramOptions& options);

int main(int argc, char** argv) {
    ProgramOptions options;

    // Parse command line arguments
    if (!parse_command_line(argc, argv, options)) {
        return 1;
    }

    // Show help if requested
    if (options.show_help) {
        return 0;
    }

    // Load configuration
    ConfigManager config_manager;
    if (!config_manager.load_config()) {
        std::cerr << "Error: Could not load config.ini file. Please create it from config.template.ini" << std::endl;
        std::cerr << "Config error: " << config_manager.last_error() << std::endl;
        return 1;
    }

    std::string api_key = config_manager.get_api_key();
    if (api_key.empty()) {
        std::cerr << "Error: google_maps_api_key not found in config.ini" << std::endl;
        return 1;
    }

    // Create and configure the scraper engine
    BusinessScraperEngine engine;
    if (!engine.set_api_key(api_key)) {
        std::cerr << "Error: Invalid API key" << std::endl;
        return 1;
    }

    // Set up console output callbacks
    engine.set_status_callback([](const std::string& message) {
        std::cout << message << std::endl;
    });

    // Display search parameters
    std::cout << "Searching for '" << options.search_options.keyword
              << "' in '" << options.search_options.location << "'..." << std::endl;
    std::cout << "Max results: " << options.search_options.max_results << std::endl;
    std::cout << "Web scraping: " << (options.search_options.enhance_with_web_scraping ? "enabled" : "disabled") << std::endl << std::endl;

    // Perform the search
    SearchResults results = engine.search_businesses(options.search_options);

    if (!results.success) {
        std::cerr << "Search failed: " << results.error_message << std::endl;
        return 1;
    }

    if (results.businesses.empty()) {
        std::cout << "No businesses found." << std::endl;
        return 0;
    }

    // Format and save results
    std::string formatted_output = engine.format_results(results, options.output_format);
    if (formatted_output.empty()) {
        std::cerr << "Error: Failed to format results" << std::endl;
        return 1;
    }

    // Generate output filename and save
    std::string filename;
    if (!options.output_filename.empty()) {
        // Use custom filename provided by user
        filename = options.output_filename;
    } else {
        // Generate timestamped filename
        filename = FileUtils::generate_output_filename(options.output_format);
    }

    if (FileUtils::write_to_file(formatted_output, filename)) {
        std::cout << "\nFound " << results.total_found << " businesses." << std::endl;
        if (results.enhanced_count > 0) {
            std::cout << "Enhanced " << results.enhanced_count << " businesses with website data." << std::endl;
        }
        std::cout << "Results saved to: " << filename << std::endl;

        // Output CSV data for Electron app to parse, regardless of file format
        std::cout << "\n--- CSV_DATA_START ---" << std::endl;
        std::cout << engine.format_results(results, OutputFormat::CSV) << std::endl;
        std::cout << "--- CSV_DATA_END ---" << std::endl;
    } else {
        std::cout << "Error saving results to file: " << FileUtils::last_error() << std::endl;
        std::cout << "Printing to console instead:" << std::endl;
        std::cout << formatted_output << std::endl;

        // Still output CSV data for parsing even if file save failed
        std::cout << "\n--- CSV_DATA_START ---" << std::endl;
        std::cout << engine.format_results(results, OutputFormat::CSV) << std::endl;
        std::cout << "--- CSV_DATA_END ---" << std::endl;
    }

    return 0;
}

// Function definitions
void print_usage(const char* program_name) {
    std::cout << "Usage: " << program_name << " [OPTIONS]\n\n"
              << "Required options:\n"
              << "  -k, --keyword KEYWORD     Search keyword (e.g., 'restaurants', 'coffee shops')\n"
              << "  -l, --location LOCATION   Location to search (e.g., 'New York, NY')\n\n"
              << "Optional options:\n"
              << "  -r, --results NUMBER      Max number of results (default: 20)\n"
              << "  -f, --format FORMAT       Output format: csv, json, yaml, xml (default: csv)\n"
              << "  -o, --output FILENAME     Output filename (default: auto-generated with timestamp)\n"
              << "  --no-web-scraping        Disable web scraping enhancement (faster but less data)\n"
              << "  -h, --help               Show this help message\n\n"
              << "The Google Maps API key should be configured in config.ini file.\n"
              << "Web scraping is enabled by default to gather additional contact information.\n"
              << std::endl;
}

bool parse_command_line(int argc, char** argv, ProgramOptions& options) {
    // Define command line options
    static struct option long_options[] = {
        {"keyword",         required_argument, 0, 'k'},
        {"location",        required_argument, 0, 'l'},
        {"results",         required_argument, 0, 'r'},
        {"format",          required_argument, 0, 'f'},
        {"output",          required_argument, 0, 'o'},
        {"no-web-scraping", no_argument,       0, 'n'},
        {"help",            no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };

    int option_index = 0;
    int c;

    // Parse command line arguments
    while ((c = getopt_long(argc, argv, "k:l:r:f:o:nh", long_options, &option_index)) != -1) {
        switch (c) {
            case 'k':
                options.search_options.keyword = optarg;
                break;
            case 'l':
                options.search_options.location = optarg;
                break;
            case 'r':
                options.search_options.max_results = std::atoi(optarg);
                if (options.search_options.max_results <= 0) {
                    std::cerr << "Error: Results must be a positive number" << std::endl;
                    return false;
                }
                break;
            case 'f': {
                std::string format_str = optarg;
                std::transform(format_str.begin(), format_str.end(), format_str.begin(), ::tolower);

                if (format_str == "csv") {
                    options.output_format = OutputFormat::CSV;
                } else if (format_str == "json") {
                    options.output_format = OutputFormat::JSON;
                } else if (format_str == "yaml") {
                    options.output_format = OutputFormat::YAML;
                } else if (format_str == "xml") {
                    options.output_format = OutputFormat::XML;
                } else {
                    std::cerr << "Error: Invalid format '" << optarg << "'. Valid formats are: csv, json, yaml, xml" << std::endl;
                    return false;
                }
                break;
            }
            case 'o':
                options.output_filename = optarg;
                break;
            case 'n':
                options.search_options.enhance_with_web_scraping = false;
                break;
            case 'h':
                print_usage(argv[0]);
                options.show_help = true;
                return true;
            case '?':
                print_usage(argv[0]);
                return false;
            default:
                break;
        }
    }

    // Check required arguments
    if (options.search_options.keyword.empty() || options.search_options.location.empty()) {
        std::cerr << "Error: Both --keyword and --location are required\n" << std::endl;
        print_usage(argv[0]);
        return false;
    }

    return true;
}