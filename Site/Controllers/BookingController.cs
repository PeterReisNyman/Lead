using Microsoft.AspNetCore.Mvc;
using System;
using System.Data;
using System.Threading.Tasks;
using MySql.Data.MySqlClient;
using Microsoft.Extensions.Configuration;
using Site.Models;
using Microsoft.AspNetCore.SignalR;
using Site.Hubs;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace Site.Controllers
{
    [Route("api")]
    [ApiController]
    public class BookingController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IHubContext<CalendarHub> _hubContext;
        private readonly ILogger<BookingController> _logger;
        private readonly HttpClient _httpClient;

        public BookingController(IConfiguration configuration, IHubContext<CalendarHub> hubContext, ILogger<BookingController> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _hubContext = hubContext;
            _logger = logger;
            _httpClient = new HttpClient();
        }

        [HttpGet("bookedslots")]
        public async Task<IActionResult> GetBookedSlots([FromQuery] DateTime date, [FromQuery] int realtorId)
        {
            _logger.LogInformation($"Getting booked slots for {date:yyyy-MM-dd} and realtor ID {realtorId}");
            
            if (realtorId <= 0)
            {
                return BadRequest(new { error = "Realtor ID is required" });
            }
            
            try
            {
                var bookedSlots = await GetBookedTimeSlotsAsync(date, realtorId);
                _logger.LogInformation($"Found {bookedSlots.Length} booked slots for {date:yyyy-MM-dd} and realtor ID {realtorId}");
                return Ok(new { bookedSlots });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve booked slots");
                return StatusCode(500, new { error = "Failed to retrieve booked slots", details = ex.Message });
            }
        }


        [HttpGet("existing-booking")]
        public async Task<IActionResult> GetExistingBooking([FromQuery] string phone)
        {
            if (string.IsNullOrEmpty(phone))
            {
                return BadRequest(new { error = "Phone number is required" });
            }

            _logger.LogInformation($"Checking existing booking for phone: {phone}");
            try
            {
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Ensure the Booked table exists
                await EnsureBookedTableExistsAsync(connection);

                var query = @"
                    SELECT booked_date, TIME_FORMAT(booked_time, '%H:%i') as time 
                    FROM Booked 
                    WHERE phone = @phone";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@phone", phone);

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var existingBooking = new
                    {
                        date = reader["booked_date"].ToString(),
                        time = reader["time"].ToString()
                    };
                    
                    _logger.LogInformation($"Found existing booking for {phone}: {existingBooking.date} at {existingBooking.time}");
                    return Ok(new { existingBooking });
                }

                _logger.LogInformation($"No existing booking found for {phone}");
                return Ok(new { existingBooking = (object)null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check existing booking");
                return StatusCode(500, new { error = "Failed to check existing booking", details = ex.Message });
            }
        }

        [HttpGet("user")]
        public async Task<IActionResult> GetUserByTracking([FromQuery] string tracking)
        {
            if (string.IsNullOrEmpty(tracking))
            {
                return BadRequest(new { error = "Tracking parameter is required" });
            }

            _logger.LogInformation($"Getting user data for tracking parameter: {tracking}");
            try
            {
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT first_name, last_name, phone 
                    FROM Leads 
                    WHERE tracking_parameters LIKE @tracking 
                    ORDER BY created_at DESC 
                    LIMIT 1";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@tracking", $"%{tracking}%");

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var user = new
                    {
                        full_name = $"{reader["first_name"]} {reader["last_name"]}",
                        phone = reader["phone"].ToString()
                    };
                    _logger.LogInformation($"Found user data: {user.full_name}, {user.phone}");
                    return Ok(new { user });
                }

                _logger.LogInformation("No user found for tracking parameter");
                return Ok(new { user = (object)null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve user data");
                return StatusCode(500, new { error = "Failed to retrieve user data", details = ex.Message });
            }
        }

        [HttpPost("book")]
        public async Task<IActionResult> BookAppointment([FromBody] BookingModel booking)
        {
            if (booking == null)
            {
                _logger.LogWarning("Booking data is null");
                return BadRequest(new { error = "Booking data is required" });
            }

            _logger.LogInformation($"Attempting to book appointment: {booking.FullName}, {booking.Phone}, {booking.Date}, {booking.Time}");

            if (string.IsNullOrEmpty(booking.FullName) || 
                string.IsNullOrEmpty(booking.Phone) || 
                string.IsNullOrEmpty(booking.Date) ||
                string.IsNullOrEmpty(booking.Time))
            {
                return BadRequest(new { error = "All fields are required" });
            }

            try
            {
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Check if Booked table exists, create if not
                await EnsureBookedTableExistsAsync(connection);

                // Begin transaction to ensure all operations succeed or fail together
                using var transaction = await connection.BeginTransactionAsync();

                try
                {
                    // Check if user already has a booking
                    string? existingDate = null;
                    string? existingTime = null;
                    
                    using (var checkExistingCommand = new MySqlCommand(
                        "SELECT booked_date, TIME_FORMAT(booked_time, '%H:%i') as time FROM Booked WHERE phone = @phone", 
                        connection, 
                        transaction as MySqlTransaction))
                    {
                        checkExistingCommand.Parameters.AddWithValue("@phone", booking.Phone);
                        using var existingReader = await checkExistingCommand.ExecuteReaderAsync();
                        
                        if (await existingReader.ReadAsync())
                        {
                            existingDate = existingReader["booked_date"].ToString();
                            existingTime = existingReader["time"].ToString();
                            _logger.LogInformation($"Found existing booking for {booking.Phone}: {existingDate} at {existingTime}");
                        }
                    }
                    
                    // Check if the selected slot is already booked by someone else
                    using (var checkSlotCommand = new MySqlCommand(
                        "SELECT COUNT(*) FROM Booked WHERE booked_date = @date AND booked_time = @time AND phone != @phone", 
                        connection, 
                        transaction as MySqlTransaction))
                    {
                        checkSlotCommand.Parameters.AddWithValue("@date", booking.Date);
                        checkSlotCommand.Parameters.AddWithValue("@time", booking.Time);
                        checkSlotCommand.Parameters.AddWithValue("@phone", booking.Phone);
                        
                        var count = Convert.ToInt32(await checkSlotCommand.ExecuteScalarAsync());
                        if (count > 0)
                        {
                            _logger.LogWarning($"Slot already booked: {booking.Date} {booking.Time}");
                            return Conflict(new { error = "slot_taken" });
                        }
                    }
                    
                    // If user already has a booking, delete it
                    if (existingDate != null && existingTime != null)
                    {
                        using var deleteCommand = new MySqlCommand(
                            "DELETE FROM Booked WHERE phone = @phone", 
                            connection, 
                            transaction as MySqlTransaction);
                        
                        deleteCommand.Parameters.AddWithValue("@phone", booking.Phone);
                        await deleteCommand.ExecuteNonQueryAsync();
                        _logger.LogInformation($"Deleted existing booking for {booking.Phone}");
                    }
                    
                    // Insert new booking
                    var bookQuery = @"
                        INSERT INTO Booked (full_name, phone, booked_date, booked_time, time_zone, realtor_id) 
                        VALUES (@fullName, @phone, @date, @time, @timeZone, @realtorId)
                        ON DUPLICATE KEY UPDATE booked_date = @date, booked_time = @time, time_zone = @timeZone, realtor_id = @realtorId";

                    using (var bookCommand = new MySqlCommand(bookQuery, connection, transaction as MySqlTransaction))
                    {
                        bookCommand.Parameters.AddWithValue("@fullName", booking.FullName);
                        bookCommand.Parameters.AddWithValue("@phone", booking.Phone);
                        bookCommand.Parameters.AddWithValue("@date", booking.Date);
                        bookCommand.Parameters.AddWithValue("@time", booking.Time);
                        bookCommand.Parameters.AddWithValue("@timeZone", booking.TimeZone);
                        bookCommand.Parameters.AddWithValue("@realtorId", booking.RealtorId);
                        
                        var rowsAffected = await bookCommand.ExecuteNonQueryAsync();
                        _logger.LogInformation($"Inserted/updated booking for {booking.Phone}");
                    }

                    await transaction.CommitAsync();

                    // Cancel any scheduled follow-up messages for this phone number
                    await CancelScheduledMessages(booking.Phone);

                    // Notify all clients of the booking
                    await _hubContext.Clients.All.SendAsync("BookingUpdated", booking.Date, booking.Time);
                    _logger.LogInformation($"Sent SignalR notification for booking: {booking.Date} {booking.Time}");

                    // calendar integration code
                    try
                    {
                        // Get realtor name from the database
                        string realtorName = await GetRealtorNameAsync(booking.RealtorId);
                        
                        // Format the time to ensure it's in the correct format (HH:MM)
                        var timeElements = booking.Time.Split(':');
                        string formattedTime = timeElements.Length >= 2 
                            ? $"{timeElements[0].PadLeft(2, '0')}:{timeElements[1]}" 
                            : booking.Time;
                        
                        // Call the calendar service to create an event
                        var calendarPayload = new
                        {
                            fullName = booking.FullName,
                            phone = booking.Phone,
                            date = booking.Date,
                            time = formattedTime,
                            realtorName = realtorName,
                            timeZone = booking.TimeZone
                        };
                        
                        _logger.LogInformation($"Sending calendar event request for {booking.FullName} on {booking.Date} at {formattedTime}");
                        
                        var calendarContent = new StringContent(
                            JsonSerializer.Serialize(calendarPayload),
                            Encoding.UTF8,
                            "application/json");
                        
                        var calendarResponse = await _httpClient.PostAsync("http://calendar:3002/create-event", calendarContent);
                        
                        if (calendarResponse.IsSuccessStatusCode)
                        {
                            var calendarResult = await calendarResponse.Content.ReadAsStringAsync();
                            _logger.LogInformation($"Calendar event created: {calendarResult}");
                        }
                        else
                        {
                            var errorContent = await calendarResponse.Content.ReadAsStringAsync();
                            _logger.LogWarning($"Failed to create calendar event: {calendarResponse.StatusCode}, {errorContent}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error creating calendar event");
                        // We don't want to fail the booking if calendar creation fails
                    }

                    // Return information about whether this was a rebooking
                    return Ok(new { 
                        success = true, 
                        message = existingDate != null ? 
                            $"Appointment rescheduled from {existingDate} {existingTime}" : 
                            "Appointment booked successfully",
                        wasRebooking = existingDate != null
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Transaction failed");
                    throw new Exception("Transaction failed", ex);
                }
            }
            catch (MySqlException ex) when (ex.Number == 1062) // Duplicate entry error
            {
                _logger.LogWarning(ex, "Duplicate entry error");
                return Conflict(new { error = "slot_taken" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to book appointment");
                return StatusCode(500, new { error = "Failed to book appointment", details = ex.Message });
            }
        }

        private async Task<string> GetRealtorNameAsync(int realtorId)
        {
            try
            {
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();
                
                var query = "SELECT CONCAT(f_name, ' ', e_name) as name FROM Realtor WHERE realtor_id = @realtorId";
                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@realtorId", realtorId);
                
                var result = await command.ExecuteScalarAsync();
                return result?.ToString() ?? "Unknown Realtor";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting realtor name for ID {realtorId}");
                return "Unknown Realtor";
            }
        }

        private async Task CancelScheduledMessages(string phone)
        {
            try
            {
                _logger.LogInformation($"Canceling scheduled messages for {phone}");
                
                // Call the Scheduler service to cancel scheduled messages
                var content = new StringContent(
                    JsonSerializer.Serialize(new { phone }), 
                    Encoding.UTF8, 
                    "application/json");
                
                var response = await _httpClient.PostAsync("http://scheduler:3001/cancel", content);
                
                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation($"Successfully canceled scheduled messages: {responseContent}");
                }
                else
                {
                    _logger.LogWarning($"Failed to cancel scheduled messages: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error canceling scheduled messages");
            }
        }

        private async Task<string[]> GetBookedTimeSlotsAsync(DateTime date, int realtorId)
        {
            using var connection = new MySqlConnection(_connectionString);
            await connection.OpenAsync();

            // Ensure the Booked table exists with realtor_id column
            await EnsureBookedTableExistsAsync(connection);

            var query = @"
                SELECT TIME_FORMAT(booked_time, '%H:%i') as time 
                FROM Booked 
                WHERE booked_date = @date AND realtor_id = @realtorId";

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd"));
            command.Parameters.AddWithValue("@realtorId", realtorId);

            using var reader = await command.ExecuteReaderAsync();
            var slots = new List<string>();
            
            while (await reader.ReadAsync())
            {
                slots.Add(reader["time"].ToString() ?? string.Empty);
            }

            return slots.ToArray();
        }

        private async Task EnsureBookedTableExistsAsync(MySqlConnection connection)
        {
            // Check if the Booked table exists
            var checkTableQuery = @"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'lead_db' 
                AND table_name = 'Booked'";

            using var checkCommand = new MySqlCommand(checkTableQuery, connection);
            var tableExists = Convert.ToInt32(await checkCommand.ExecuteScalarAsync()) > 0;

            if (!tableExists)
            {
                _logger.LogWarning("Booked table does not exist, creating it now");
                // Create the Booked table
                var createTableQuery = @"
                    CREATE TABLE Booked (
                        phone VARCHAR(50) PRIMARY KEY,
                        full_name VARCHAR(255) NOT NULL,
                        booked_date DATE,
                        booked_time TIME,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )";

                using var createCommand = new MySqlCommand(createTableQuery, connection);
                await createCommand.ExecuteNonQueryAsync();
                _logger.LogInformation("Booked table created successfully");
            }
        }


        // Add a new endpoint to get realtor information by UUID
        [HttpGet("realtor")]
        public async Task<IActionResult> GetRealtorByUuid([FromQuery] string uuid)
        {
            if (string.IsNullOrEmpty(uuid))
            {
                return BadRequest(new { error = "Realtor UUID is required" });
            }

            try
            {
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT realtor_id, f_name, e_name 
                    FROM Realtor 
                    WHERE uuid = @uuid";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@uuid", uuid);

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var realtor = new
                    {
                        realtorId = Convert.ToInt32(reader["realtor_id"]),
                        name = $"{reader["f_name"]} {reader["e_name"]}".Trim()
                    };
                    
                    return Ok(realtor);
                }

                return NotFound(new { error = "Realtor not found" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve realtor information");
                return StatusCode(500, new { error = "Failed to retrieve realtor information", details = ex.Message });
            }
        }
    }

public class BookingModel
{
    public string Date { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsRebooking { get; set; } = false;
    public string TimeZone { get; set; } = string.Empty;
    public int RealtorId { get; set; } = 0;
}

}