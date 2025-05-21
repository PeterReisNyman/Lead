using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading;
using System.Data;

namespace Site.Controllers
{
    public class RealtorController : Controller
    {
        private readonly string _connectionString;
        private readonly ILogger<RealtorController> _logger;
        private const int MaxRetries = 5;
        private const int RetryDelayMs = 1000; // 1 second initial delay

        public RealtorController(IConfiguration configuration, ILogger<RealtorController> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        // This will handle routes like /a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f
        [HttpGet]
        [Route("{uuid:guid}")]  // Add the GUID constraint to avoid conflicts with 'database' route
        public async Task<IActionResult> Index(string uuid)
        {
            _logger.LogInformation($"Received request for UUID: {uuid}");
            
            try
            {
                // Get realtor information by UUID with retry logic
                var realtor = await GetRealtorByUuidWithRetry(uuid);
                
                if (realtor == null)
                {
                    _logger.LogWarning($"No realtor found with UUID: {uuid}");
                    return NotFound($"No realtor found with UUID: {uuid}");
                }

                _logger.LogInformation($"Found realtor: {realtor.Name} with UUID: {uuid}");
                
                // Pass the realtor data to the default Index view
                return View("~/Views/Home/Index.cshtml", realtor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving realtor with UUID: {uuid}");
                
                // Return a more user-friendly error page
                ViewBag.ErrorMessage = "We're having trouble connecting to our database. The system will automatically retry.";
                ViewBag.RealtorUuid = uuid;
                
                // Return the error view with auto-refresh
                return View("~/Views/Home/ConnectionError.cshtml");
            }
        }

        // Enhanced version with retry logic
        private async Task<RealtorViewModel> GetRealtorByUuidWithRetry(string uuid)
        {
            int attempt = 0;
            while (true)
            {
                try
                {
                    attempt++;
                    _logger.LogInformation($"Attempt {attempt} to connect to database for UUID: {uuid}");
                    
                    // Try to get realtor data
                    return await GetRealtorByUuid(uuid);
                }
                catch (MySqlException ex)
                {
                    _logger.LogWarning(ex, $"MySQL error on attempt {attempt}/{MaxRetries} for UUID: {uuid}");
                    
                    // If we've reached max retries, throw the exception
                    if (attempt >= MaxRetries)
                    {
                        _logger.LogError(ex, $"Max retries ({MaxRetries}) reached. Giving up.");
                        throw;
                    }
                    
                    // Exponential backoff: delay increases with each attempt
                    int delay = RetryDelayMs * (int)Math.Pow(2, attempt - 1);
                    _logger.LogInformation($"Waiting {delay}ms before retry {attempt + 1}...");
                    await Task.Delay(delay);
                }
            }
        }

        // Original method, now called by the retry wrapper
        private async Task<RealtorViewModel> GetRealtorByUuid(string uuid)
        {
            using var connection = new MySqlConnection(_connectionString);
            try
            {
                await connection.OpenAsync();
                _logger.LogInformation("Database connection opened successfully");

                var query = @"
                    SELECT realtor_id, f_name, phone, video_url, website_url
                    FROM Realtor
                    WHERE uuid = @uuid";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@uuid", uuid);

                using var reader = await command.ExecuteReaderAsync();
                
                if (await reader.ReadAsync())
                {
                    _logger.LogInformation($"Found realtor record for UUID: {uuid}");
                    
                    // Get video URL and log it
                    string videoUrl = reader["video_url"]?.ToString();
                    _logger.LogInformation($"Retrieved video_url: {videoUrl}");
                    
                    // Ensure the URL is properly formatted
                    if (!string.IsNullOrEmpty(videoUrl)) 
                    {
                        // If the URL starts with http:// or https://, use it as is
                        if (!videoUrl.StartsWith("http://") && !videoUrl.StartsWith("https://")) 
                        {
                            // If it's a local file path, ensure it's properly formatted
                            if (videoUrl.StartsWith("~/")) 
                            {
                                videoUrl = videoUrl.Substring(2);
                            }
                            else if (videoUrl.StartsWith("/")) 
                            {
                                videoUrl = videoUrl.Substring(1);
                            }
                        }
                        
                        _logger.LogInformation($"Formatted video_url: {videoUrl}");
                    }
                    
                    string websiteUrl = reader["website_url"]?.ToString();
                    if (!string.IsNullOrEmpty(websiteUrl) && !(websiteUrl.StartsWith("http://") || websiteUrl.StartsWith("https://"))) {
                        websiteUrl = "http://" + websiteUrl;
                    }
                    _logger.LogInformation($"Retrieved website_url: {websiteUrl}");
                    
                    return new RealtorViewModel
                    {
                        RealtorId = Convert.ToInt32(reader["realtor_id"]),
                        Name = reader["f_name"].ToString(),
                        Phone = reader["phone"].ToString(),
                        Uuid = uuid,
                        VideoPath = videoUrl,
                        WebsiteUrl = websiteUrl
                    };
                }
                
                _logger.LogWarning($"No realtor record found for UUID: {uuid}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Database error when fetching realtor with UUID: {uuid}");
                throw; // Rethrow to be handled by the retry logic
            }
        }
    }

    public class RealtorViewModel
    {
        public int RealtorId { get; set; }
        public string Name { get; set; }
        public string Phone { get; set; }
        public string Uuid { get; set; }
        public string VideoPath { get; set; }
        public string WebsiteUrl { get; set; }
    }
}
