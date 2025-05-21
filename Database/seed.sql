-- Sample data for development

-- Insert sample leads referencing the realtors inserted in postgres.sql
INSERT INTO Leads (
    phone, realtor_id, first_name, last_name, address,
    lead_state, home_type, home_built, home_worth, sell_time,
    home_condition, working_with_agent, looking_to_buy,
    ad_id, tracking_parameters
) VALUES
    ('555-0001', 1, 'Eve', 'Example', '123 Main St',
     'Hot', 'Single Family', '2000 or later', '$300K - $600K', '1-3 months',
     'Needs a little work', 'No', 'Yes', 'ad_123', 'utm_source=test'),
    ('555-0002', 2, 'John', 'Doe', '456 Oak Ave',
     'Warm', 'Condo', '1990s', '$300K or less', '6-12 months',
     'Needs nothing', 'No', 'No', 'ad_456', 'utm_source=test');

-- A booked appointment for one of the leads
INSERT INTO Booked (phone, full_name, booked_date, booked_time, time_zone, realtor_id)
VALUES ('555-0001', 'Eve Example', CURRENT_DATE, '10:00', 'UTC', 1);

