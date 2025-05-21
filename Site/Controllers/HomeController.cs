using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using Site.Models;

namespace Site.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }
        public IActionResult Index(string utm_source)
        {
            ViewBag.UtmSource = utm_source;
            return View();
        }
        [HttpPost]
        public IActionResult BookAppointment(AppointmentModel appointment)
        {
            // Process appointment booking
            // In a real application, you would:
            // 1. Validate the appointment data
            // 2. Save to database
            // 3. Create Google Calendar event
            // 4. Notify other users of the update via WebSockets
            
            return Json(new { success = true });
        }
    }
}