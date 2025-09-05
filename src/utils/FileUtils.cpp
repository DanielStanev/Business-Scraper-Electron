#include "utils/FileUtils.h"
#include <fstream>
#include <filesystem>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <iostream>

// Static member definition
std::string FileUtils::s_last_error;

bool FileUtils::write_to_file(const std::string& content, const std::string& filename) {
    clear_error();

    try {
        // Create directory if it doesn't exist
        std::filesystem::path file_path(filename);
        if (file_path.has_parent_path()) {
            std::filesystem::create_directories(file_path.parent_path());
        }

        // Write content to file
        std::ofstream file(filename);
        if (!file.is_open()) {
            set_error("Could not create output file: " + filename);
            return false;
        }

        file << content;
        file.close();

        return true;
    } catch (const std::exception& e) {
        set_error("Error writing to file: " + std::string(e.what()));
        return false;
    }
}

bool FileUtils::create_directory(const std::string& directory_path) {
    clear_error();

    try {
        std::filesystem::create_directories(directory_path);
        return true;
    } catch (const std::exception& e) {
        set_error("Error creating directory: " + std::string(e.what()));
        return false;
    }
}

bool FileUtils::file_exists(const std::string& filename) {
    return std::filesystem::exists(filename) && std::filesystem::is_regular_file(filename);
}

bool FileUtils::directory_exists(const std::string& directory_path) {
    return std::filesystem::exists(directory_path) && std::filesystem::is_directory(directory_path);
}

std::string FileUtils::get_timestamp_string() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);

    std::stringstream ss;
    ss << std::put_time(std::localtime(&time_t), "%Y%m%d_%H%M%S");
    return ss.str();
}

std::string FileUtils::get_file_extension(OutputFormat format) {
    switch (format) {
        case OutputFormat::CSV:
            return "csv";
        case OutputFormat::JSON:
            return "json";
        case OutputFormat::YAML:
            return "yml";
        case OutputFormat::XML:
            return "xml";
        default:
            return "csv";
    }
}

std::string FileUtils::generate_output_filename(OutputFormat format, const std::string& prefix) {
    std::string timestamp = get_timestamp_string();
    std::string extension = get_file_extension(format);
    std::string filename = timestamp + "." + extension;

    if (!prefix.empty()) {
        filename = prefix + "_" + filename;
    }

    return join_paths(get_output_directory(), filename);
}

std::string FileUtils::get_output_directory() {
    return "output";
}

std::string FileUtils::join_paths(const std::string& path1, const std::string& path2) {
    std::filesystem::path p1(path1);
    std::filesystem::path p2(path2);
    return (p1 / p2).string();
}

std::string FileUtils::last_error() {
    return s_last_error;
}

void FileUtils::set_error(const std::string& error) {
    s_last_error = error;
}

void FileUtils::clear_error() {
    s_last_error.clear();
}
