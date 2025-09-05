cmake_minimum_required(VERSION 3.16)
project(business_scraper VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set output directory
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build)

# Include directories
include_directories(include)

# Find required packages
find_package(PkgConfig REQUIRED)

# Find libcurl
find_package(CURL REQUIRED)
if(NOT CURL_FOUND)
    message(FATAL_ERROR "libcurl not found. Please install libcurl development package.")
endif()

# Find jsoncpp
pkg_check_modules(JSONCPP REQUIRED jsoncpp)
if(NOT JSONCPP_FOUND)
    # Fallback for Windows - try to find jsoncpp differently
    find_package(jsoncpp CONFIG)
    if(jsoncpp_FOUND)
        set(JSONCPP_LIBRARIES jsoncpp_lib)
        set(JSONCPP_INCLUDE_DIRS "")
    else()
        message(FATAL_ERROR "jsoncpp not found. Please install jsoncpp development package.")
    endif()
endif()

# Source files
set(SOURCES
    src/core/Business.cpp
    src/core/BusinessScraperEngine.cpp
    src/scrapers/MapScraper.cpp
    src/scrapers/WebScraper.cpp
    src/output/Formatter.cpp
    src/utils/ConfigManager.cpp
    src/utils/FileUtils.cpp
    src/main_cli.cpp
)

# Create executable
add_executable(business_scraper ${SOURCES})

# Link libraries
target_link_libraries(business_scraper
    PRIVATE
    ${CURL_LIBRARIES}
    ${JSONCPP_LIBRARIES}
)

# Include directories for libraries
target_include_directories(business_scraper
    PRIVATE
    ${CURL_INCLUDE_DIRS}
    ${JSONCPP_INCLUDE_DIRS}
)

# Compiler flags
target_compile_options(business_scraper PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra>
    $<$<CXX_COMPILER_ID:MSVC>:/W4>
)

# Windows-specific settings
if(WIN32)
    # Link Winsock for Windows
    target_link_libraries(business_scraper PRIVATE ws2_32)

    # Set console application
    set_target_properties(business_scraper PROPERTIES
        WIN32_EXECUTABLE FALSE
    )
endif()

# Installation
install(TARGETS business_scraper
    RUNTIME DESTINATION bin
)

# Print configuration summary
message(STATUS "")
message(STATUS "Configuration Summary:")
message(STATUS "  Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  C++ compiler: ${CMAKE_CXX_COMPILER}")
message(STATUS "  C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  CURL found: ${CURL_FOUND}")
message(STATUS "  CURL libraries: ${CURL_LIBRARIES}")
message(STATUS "  jsoncpp found: ${JSONCPP_FOUND}")
message(STATUS "  jsoncpp libraries: ${JSONCPP_LIBRARIES}")
message(STATUS "  Output directory: ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}")
message(STATUS "")
