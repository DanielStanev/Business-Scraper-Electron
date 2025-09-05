#ifndef BUSINESS_H
#define BUSINESS_H

#include <string>
#include <vector>


class Business {
private:

    int m_total_ratings;
    double m_rating;

    std::string m_name;
    std::string m_address;
    std::string m_phone_number;
    std::string m_email;
    std::string m_website;
    std::vector<std::string> m_additional_numbers;
    std::vector<std::string> m_additional_emails;
    std::vector<std::string> m_social_media_links;

public:

    Business();
    ~Business();

    // Name
    std::string name() const { return m_name; }
    void set_name(const std::string& name) { m_name = name; }

    // Address
    std::string address() const { return m_address; }
    void set_address(const std::string& address) { m_address = address; }

    // Phone Number
    std::string phone_number() const { return m_phone_number; }
    void set_phone_number(const std::string& phone_number) { m_phone_number = phone_number; }

    // Email
    std::string email() const { return m_email; }
    void set_email(const std::string& email) { m_email = email; }

    // Website
    std::string website() const { return m_website; }
    void set_website(const std::string& website) { m_website = website; }

    // Additional Numbers
    std::vector<std::string> additional_numbers() const { return m_additional_numbers; }
    void set_additional_numbers(const std::vector<std::string>& numbers) { m_additional_numbers = numbers; }

    // Additional Emails
    std::vector<std::string> additional_emails() const { return m_additional_emails; }
    void set_additional_emails(const std::vector<std::string>& emails) { m_additional_emails = emails; }

    // Social Media Links
    std::vector<std::string> social_media_links() const { return m_social_media_links; }
    void set_social_media_links(const std::vector<std::string>& links) { m_social_media_links = links; }

    // Total Ratings
    int total_ratings() const { return m_total_ratings; }
    void set_total_ratings(int total_ratings) { m_total_ratings = total_ratings; }

    // Rating
    double rating() const { return m_rating; }
    void set_rating(double rating) { m_rating = rating; }

    // Utilities
    void add_additional_number(std::string& phone_number) { m_additional_numbers.push_back(phone_number); }
    void add_additional_email (std::string& email) { m_additional_emails.push_back(email); }
    void add_social_link (std::string& social_link) { m_social_media_links.push_back(social_link); }
};

#endif