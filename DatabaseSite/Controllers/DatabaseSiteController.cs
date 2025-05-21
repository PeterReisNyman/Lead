using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MySql.Data.MySqlClient;
using System.Data;
using System.Collections.Generic;
using System;

namespace DatabaseSite.Controllers
{
    public class DatabaseSiteController : Controller
    {
        private readonly ILogger<DatabaseSiteController> _logger;
        private readonly HttpClient _httpClient;
        private const string OpenAIEndpoint = "https://api.openai.com/v1/chat/completions";

        public DatabaseSiteController(ILogger<DatabaseSiteController> logger)
        {
            _logger = logger;
            _httpClient = new HttpClient();
        }

        // Handle the root URL and /database routes
        [HttpGet]
        [Route("/")]
        public IActionResult Index()
        {
            // Try with an absolute path to the view
            return View("~/Views/Home/Index.cshtml");
        }


        [HttpPost("generate")]
        public async Task<IActionResult> Generate([FromBody] JsonElement data)
        {

            string username = data.TryGetProperty("username", out JsonElement userProp) ? userProp.GetString() ?? "" : "";
            string password = data.TryGetProperty("password", out JsonElement passProp) ? passProp.GetString() ?? "" : "";
            string prompt = data.TryGetProperty("prompt", out JsonElement promptProp) ? promptProp.GetString() ?? "" : "";


            _logger.LogInformation("Received SQL generation request");
            
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) || string.IsNullOrEmpty(prompt))
            {
                return new JsonResult(new { success = false, error = "Username, password, and prompt are required." });
            }


            try
            {
                // Process the OpenAI query
                var openAIResponse = await ProcessOpenAIRequest(prompt);
                
                // Extract SQL queries from the response
                var processedResponse = await ProcessOpenAIResponse(openAIResponse, username, password);
                
                return Json(new { success = true, result = processedResponse });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating SQL response");
                return Json(new { success = false, error = ex.Message });
            }
        }

        private async Task<string> ProcessOpenAIRequest(string prompt)
        {
            string db_Text = @"
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (uuid)
            );


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
            );";

            prompt = prompt + db_Text;
            Console.WriteLine(prompt);
            // Get OpenAI API key from environment variables
            string apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");

            // Create request to OpenAI
            var requestBody = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = "You are a helpful SQL assistant. When asked to write SQL queries, respond with an explanations and the SQL code. Use markdown formatting for SQL code blocks. Keep the conversation warm, also write other SQL code that shows intresting relation based on the user prompt." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.7
            };

            var content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.PostAsync(OpenAIEndpoint, content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                _logger.LogError($"OpenAI API error: {errorText}");
                throw new Exception($"OpenAI API error: {response.StatusCode}");
            }

            var responseText = await response.Content.ReadAsStringAsync();
            
            // Parse JSON response to extract the completion text
            var responseObject = JsonSerializer.Deserialize<JsonElement>(responseText);
            var messageContent = responseObject
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return messageContent ?? "No response generated";
        }

        private async Task<List<ResponseSegment>> ProcessOpenAIResponse(string openAIResponse, string username, string password)
        {
            var result = new List<ResponseSegment>();
            
            // Pattern to find SQL code blocks in markdown
            var codeBlockRegex = new Regex(@"```sql\s*([\s\S]*?)\s*```", RegexOptions.IgnoreCase);
            var matches = codeBlockRegex.Matches(openAIResponse);
            
            if (matches.Count == 0)
            {
                // No SQL code blocks found, return the entire text as a single segment
                result.Add(new ResponseSegment { Type = "text", Content = openAIResponse });
                return result;
            }

            int currentIndex = 0;
            foreach (Match match in matches)
            {
                // Add text before SQL block if any
                if (match.Index > currentIndex)
                {
                    var textBefore = openAIResponse.Substring(currentIndex, match.Index - currentIndex);
                    if (!string.IsNullOrWhiteSpace(textBefore))
                    {
                        result.Add(new ResponseSegment { Type = "text", Content = textBefore });
                    }
                }

                // Extract SQL query and execute it
                string sqlQuery = match.Groups[1].Value.Trim();
                string tableHtml = "";
                
                try
                {
                    tableHtml = await ExecuteQueryWithRetry(sqlQuery, username, password);
                    result.Add(new ResponseSegment { Type = "table", Content = tableHtml });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error executing SQL query: {sqlQuery}");
                    result.Add(new ResponseSegment
                    {
                        Type = "error",
                        Content = $"Error executing query: {ex.Message}\n\nQuery: {sqlQuery}"
                    });
                }

                currentIndex = match.Index + match.Length;
            }

            // Add any remaining text after the last SQL block
            if (currentIndex < openAIResponse.Length)
            {
                var textAfter = openAIResponse.Substring(currentIndex);
                if (!string.IsNullOrWhiteSpace(textAfter))
                {
                    result.Add(new ResponseSegment { Type = "text", Content = textAfter });
                }
            }

            return result;
        }


        private async Task<string> ExecuteQueryWithRetry(string sqlQuery, string username, string password)
        {
            const int maxRetries = 3;
            int retryCount = 0;
            int retryDelayMs = 1000; // Start with 1 second delay
            
            while (retryCount < maxRetries)
            {
                try
                {
                    // Adjust the connection string for cloud deployment
                    string connectionString = $"server=database;port=3306;database=lead_db;user={username};password={password};AllowZeroDateTime=True;ConvertZeroDateTime=True";
                    
                    // If we're in cloud environment, try using mysql as the hostname
                    if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Development")
                    {
                        connectionString = $"server=mysql;port=3306;database=lead_db;user={username};password={password};AllowZeroDateTime=True;ConvertZeroDateTime=True";
                    }
                    
                    using var connection = new MySqlConnection(connectionString);
                    await connection.OpenAsync();
                    
                    using var command = new MySqlCommand(sqlQuery, connection);
                    using var reader = await command.ExecuteReaderAsync();
                    
                    var table = new StringBuilder();
                    table.Append("<table class='sql-result'>");
                    
                    // Add header row
                    table.Append("<thead><tr>");
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        table.Append($"<th>{reader.GetName(i)}</th>");
                    }
                    table.Append("</tr></thead>");
                    
                    // Add data rows
                    table.Append("<tbody>");
                    int rowCount = 0;
                    while (await reader.ReadAsync())
                    {
                        rowCount++;
                        table.Append("<tr>");
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var value = reader.IsDBNull(i) ? "NULL" : reader.GetValue(i).ToString();
                            table.Append($"<td>{value}</td>");
                        }
                        table.Append("</tr>");
                        
                        // Limit to 100 rows for safety
                        if (rowCount >= 100)
                        {
                            table.Append("<tr><td colspan='" + reader.FieldCount + "'>Results limited to 100 rows</td></tr>");
                            break;
                        }
                    }
                    table.Append("</tbody>");
                    table.Append("</table>");
                    
                    return table.ToString();
                }
                catch (Exception ex)
                {
                    retryCount++;
                    _logger.LogWarning($"Database connection attempt {retryCount} failed: {ex.Message}");
                    
                    if (retryCount >= maxRetries)
                    {
                        _logger.LogError($"All database connection attempts failed. Last error: {ex.Message}");
                        throw new Exception($"Error executing query after {maxRetries} attempts: {ex.Message}\n\nQuery: {sqlQuery}");
                    }
                    
                    // Exponential backoff
                    await Task.Delay(retryDelayMs);
                    retryDelayMs *= 2; // Double the delay for next retry
                }
            }
            
            throw new Exception("Unexpected error in retry loop");
        }

        private async Task<string> ExecuteQuery(string sqlQuery, string username, string password)
        {
            string connectionString = $"server=database;port=3306;database=lead_db;user={username};password={password};AllowZeroDateTime=True;ConvertZeroDateTime=True";
            
            using var connection = new MySqlConnection(connectionString);
            await connection.OpenAsync();
            
            using var command = new MySqlCommand(sqlQuery, connection);
            using var reader = await command.ExecuteReaderAsync();
            
            var table = new StringBuilder();
            table.Append("<table class='sql-result'>");
            
            // Add header row
            table.Append("<thead><tr>");
            for (int i = 0; i < reader.FieldCount; i++)
            {
                table.Append($"<th>{reader.GetName(i)}</th>");
            }
            table.Append("</tr></thead>");
            
            // Add data rows
            table.Append("<tbody>");
            int rowCount = 0;
            while (await reader.ReadAsync())
            {
                rowCount++;
                table.Append("<tr>");
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.IsDBNull(i) ? "NULL" : reader.GetValue(i).ToString();
                    table.Append($"<td>{value}</td>");
                }
                table.Append("</tr>");
                
                // Limit to 100 rows for safety
                if (rowCount >= 100)
                {
                    table.Append("<tr><td colspan='" + reader.FieldCount + "'>Results limited to 100 rows</td></tr>");
                    break;
                }
            }
            table.Append("</tbody>");
            table.Append("</table>");
            
            return table.ToString();
        }
    }

    public class ResponseSegment
    {
        public string Type { get; set; } = "text"; // "text", "table", or "error"
        public string Content { get; set; } = string.Empty;
    }
}