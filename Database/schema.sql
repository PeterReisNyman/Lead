--   -e MYSQL_USER=user \
--   -e MYSQL_PASSWORD=password \
-- docker exec -it lead-database mysql -uuser -ppassword lead_db
-- Select * from Realtor;
-- Select * from Leads;

DROP DATABASE IF EXISTS lead_db;
CREATE DATABASE lead_db;
USE lead_db;


CREATE TABLE Realtor (
    realtor_id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    f_name VARCHAR(125) NOT NULL,
    e_name VARCHAR(125) NOT NULL,
    video_url VARCHAR(600),
    email VARCHAR(255),      
    website_url VARCHAR(600),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (uuid)
);


INSERT INTO Realtor (uuid, phone, f_name, e_name, video_url, email, website_url) VALUES 
    ('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', '123-456-7890', 'Alice', 'Johnson', NULL, NULL, NULL),
    ('b2c3d4e5-f6a7-5432-8765-2b3c4d5e6f7a', '123-456-7891', 'Bob', 'Smith', NULL, NULL, NULL),
    ('c3d4e5f6-a7b8-6543-8765-3c4d5e6f7a8b', '123-456-7892', 'Carol', 'Davis', '<iframe src="https://player.vimeo.com/video/1068770376?h=fb9b1d993b&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="IMG_5159"></iframe>', "sifontana1965@gmail.com", "https://www.audi.com/en/" ),
    ('f957761b-104e-416e-a550-25e010ca9302', '123-456-7893', 'Alfonso', 'Mac', '<iframe src="https://player.vimeo.com/video/1068770376?h=fb9b1d993b&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="IMG_5159"></iframe>', "skovdepeter@gmail.com", "https://www.ferrari.com/en-BR");


CREATE TABLE Leads (
    phone VARCHAR(50) PRIMARY KEY,
    realtor_id INT NOT NULL,
    first_name VARCHAR(127),
    last_name VARCHAR(127),
    address VARCHAR(255),
    lead_state ENUM('Booked', 'Hot', 'Warm', 'Cold'),
    home_type ENUM('Single Family', 'Condo', 'Townhouse', 'Mobile Home', 'Land'),
    home_built ENUM('2000 or later', '1990s', '1980s', '1970s', '1960s', 'Before 1960'),
    home_worth ENUM('$300K or less', '$300K - $600K', '$600K - $900K', '$900K - $1.2M', '$1.2M or more'),
    sell_time ENUM('ASAP', '1-3 months', '3-6 months', '6-12 months', '12+ months'),
    home_condition ENUM('Needs nothing', 'Needs a little work', 'Needs significant work', 'Tear down'),
    working_with_agent ENUM('No', 'Yes'),
    looking_to_buy ENUM('No', 'Yes'),
    ad_id VARCHAR(50),
    tracking_parameters VARCHAR(255),
    sent_schedule_reminder ENUM('No', 'Yes') DEFAULT 'No',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (realtor_id) REFERENCES Realtor(realtor_id)
);



CREATE TABLE Booked (
    phone VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    booked_date DATE,
    booked_time TIME,
    time_zone VARCHAR(100),
    realtor_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (realtor_id) REFERENCES Realtor(realtor_id)
);


CREATE TABLE Messages (
    phone VARCHAR(50) NOT NULL,
    messages_conversation JSON,
    FOREIGN KEY (phone) REFERENCES Leads(phone)
);

-- Tables for the messaging system
CREATE TABLE scheduled_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    message_status ENUM('pending', 'processing', 'sent', 'failed', 'canceled') DEFAULT 'pending',
    message_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (phone),
    INDEX (scheduled_time),
    INDEX (message_status)
);

CREATE TABLE message_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    message_text TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'sent',
    INDEX (phone)
);