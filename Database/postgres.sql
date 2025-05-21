-- PostgreSQL translation of the MySQL schema
-- Use this script to create the schema on Supabase or any PostgreSQL database.

-- Drop tables if they already exist
DROP TABLE IF EXISTS message_logs CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS Messages CASCADE;
DROP TABLE IF EXISTS Booked CASCADE;
DROP TABLE IF EXISTS Leads CASCADE;
DROP TABLE IF EXISTS Realtor CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS lead_state_enum;
CREATE TYPE lead_state_enum AS ENUM ('Booked', 'Hot', 'Warm', 'Cold');

DROP TYPE IF EXISTS home_type_enum;
CREATE TYPE home_type_enum AS ENUM ('Single Family', 'Condo', 'Townhouse', 'Mobile Home', 'Land');

DROP TYPE IF EXISTS home_built_enum;
CREATE TYPE home_built_enum AS ENUM ('2000 or later', '1990s', '1980s', '1970s', '1960s', 'Before 1960');

DROP TYPE IF EXISTS home_worth_enum;
CREATE TYPE home_worth_enum AS ENUM ('$300K or less', '$300K - $600K', '$600K - $900K', '$900K - $1.2M', '$1.2M or more');

DROP TYPE IF EXISTS sell_time_enum;
CREATE TYPE sell_time_enum AS ENUM ('ASAP', '1-3 months', '3-6 months', '6-12 months', '12+ months');

DROP TYPE IF EXISTS home_condition_enum;
CREATE TYPE home_condition_enum AS ENUM ('Needs nothing', 'Needs a little work', 'Needs significant work', 'Tear down');

DROP TYPE IF EXISTS yes_no_enum;
CREATE TYPE yes_no_enum AS ENUM ('No', 'Yes');

DROP TYPE IF EXISTS message_status_enum;
CREATE TYPE message_status_enum AS ENUM ('pending', 'processing', 'sent', 'failed', 'canceled');

-- Realtor table
CREATE TABLE Realtor (
    realtor_id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    f_name VARCHAR(125) NOT NULL,
    e_name VARCHAR(125) NOT NULL,
    video_url VARCHAR(600),
    email VARCHAR(255),
    website_url VARCHAR(600),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample data for realtors
INSERT INTO Realtor (uuid, phone, f_name, e_name, video_url, email, website_url) VALUES
    ('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', '123-456-7890', 'Alice', 'Johnson', NULL, NULL, NULL),
    ('b2c3d4e5-f6a7-5432-8765-2b3c4d5e6f7a', '123-456-7891', 'Bob', 'Smith', NULL, NULL, NULL),
    ('c3d4e5f6-a7b8-6543-8765-3c4d5e6f7a8b', '123-456-7892', 'Carol', 'Davis', '<iframe src="https://player.vimeo.com/video/1068770376?h=fb9b1d993b&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="IMG_5159"></iframe>', 'sifontana1965@gmail.com', 'https://www.audi.com/en/' ),
    ('f957761b-104e-416e-a550-25e010ca9302', '123-456-7893', 'Alfonso', 'Mac', '<iframe src="https://player.vimeo.com/video/1068770376?h=fb9b1d993b&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="IMG_5159"></iframe>', 'skovdepeter@gmail.com', 'https://www.ferrari.com/en-BR');

-- Leads table
CREATE TABLE Leads (
    phone VARCHAR(50) PRIMARY KEY,
    realtor_id INT NOT NULL REFERENCES Realtor(realtor_id),
    first_name VARCHAR(127),
    last_name VARCHAR(127),
    address VARCHAR(255),
    lead_state lead_state_enum,
    home_type home_type_enum,
    home_built home_built_enum,
    home_worth home_worth_enum,
    sell_time sell_time_enum,
    home_condition home_condition_enum,
    working_with_agent yes_no_enum,
    looking_to_buy yes_no_enum,
    ad_id VARCHAR(50),
    tracking_parameters VARCHAR(255),
    sent_schedule_reminder yes_no_enum DEFAULT 'No',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booked appointments
CREATE TABLE Booked (
    phone VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    booked_date DATE,
    booked_time TIME,
    time_zone VARCHAR(100),
    realtor_id INT NOT NULL REFERENCES Realtor(realtor_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message threads for each lead
CREATE TABLE Messages (
    phone VARCHAR(50) NOT NULL REFERENCES Leads(phone),
    messages_conversation JSONB
);

-- Messages scheduled to be sent later
CREATE TABLE scheduled_messages (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    message_status message_status_enum DEFAULT 'pending',
    message_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON scheduled_messages(phone);
CREATE INDEX ON scheduled_messages(scheduled_time);
CREATE INDEX ON scheduled_messages(message_status);

-- Log of sent messages
CREATE TABLE message_logs (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    message_text TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'sent'
);
CREATE INDEX ON message_logs(phone);

