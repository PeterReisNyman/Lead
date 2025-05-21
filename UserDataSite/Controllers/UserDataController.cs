using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using MySql.Data.MySqlClient;
using System.Text.Json;
using System.Threading.Tasks;
using UserDataSite.Models;
using System.Collections.Generic;

namespace UserDataSite.Controllers
{
    public class UserDataController : Controller
    {
        private readonly string _password;
        private readonly string _connectionString;

        public UserDataController(IConfiguration configuration)
        {
            _password = configuration["UserDataPassword"];
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        [HttpGet("UserData/{phone}")]
        public IActionResult Index(string phone)
        {
            ViewBag.Phone = phone;
            return View("Index");
        }

        [HttpPost("UserData/generate")]
        public async Task<IActionResult> Generate(string phone, string password)
        {
            if (password != _password)
            {
                ModelState.AddModelError(string.Empty, "Invalid password");
                ViewBag.Phone = phone;
                return View("Index");
            }

            var model = new UserDataViewModel();
            using var connection = new MySqlConnection(_connectionString);
            await connection.OpenAsync();

            var leadSql = @"
                SELECT phone, first_name, last_name, address,
                       lead_state, home_type, home_built, home_worth,
                       sell_time, home_condition, working_with_agent,
                       looking_to_buy, ad_id, tracking_parameters
                FROM Leads
                WHERE phone = @phone";

            using var cmd = new MySqlCommand(leadSql, connection);
            cmd.Parameters.AddWithValue("@phone", phone);
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return NotFound();

            model.Phone = reader["phone"].ToString();
            model.FirstName = reader["first_name"].ToString();
            model.LastName = reader["last_name"].ToString();
            model.Address = reader["address"].ToString();
            model.LeadState = reader["lead_state"].ToString();
            model.HomeType = reader["home_type"].ToString();
            model.HomeBuilt = reader["home_built"].ToString();
            model.HomeWorth = reader["home_worth"].ToString();
            model.SellTime = reader["sell_time"].ToString();
            model.HomeCondition = reader["home_condition"].ToString();
            model.WorkingWithAgent = reader["working_with_agent"].ToString();
            model.LookingToBuy = reader["looking_to_buy"].ToString();
            model.AdId = reader["ad_id"].ToString();
            model.TrackingParameters = reader["tracking_parameters"].ToString();
            reader.Close();

            var msgSql = "SELECT messages_conversation FROM Messages WHERE phone = @phone";
            using var cmd2 = new MySqlCommand(msgSql, connection);
            cmd2.Parameters.AddWithValue("@phone", phone);
            using var reader2 = await cmd2.ExecuteReaderAsync();
            if (await reader2.ReadAsync() && !reader2.IsDBNull(0))
            {
                var json = reader2.GetString(0);
                model.Messages = JsonSerializer.Deserialize<List<ConversationMessage>>(json);
            }
            reader2.Close();

            return View("Details", model);
        }
    }
}
