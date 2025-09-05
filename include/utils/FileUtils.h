#ifndef FILE_UTILS_H
#define FILE_UTILS_H

#include <string>
#include "output/Formatter.h"

class FileUtils {
public:
    // File operations
    static bool write_to_file(const std::string& content, const std::string& filename);
    static bool create_directory(const std::string& directory_path);
    static bool file_exists(const std::string& filename);
    static bool directory_exists(const std::string& directory_path);

    // Filename generation
    static std::string get_timestamp_string();
    static std::string get_file_extension(OutputFormat format);
    static std::string generate_output_filename(OutputFormat format, const std::string& prefix = "");

    // Path utilities
    static std::string get_output_directory();
    static std::string join_paths(const std::string& path1, const std::string& path2);

    // Error handling
    static std::string last_error();

private:
    static std::string s_last_error;
    static void set_error(const std::string& error);
    static void clear_error();
};

#endif
