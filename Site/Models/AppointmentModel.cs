using System;

namespace Site.Models
{
    public class AppointmentModel
    {
        public DateTime Date { get; set; }
        public required string Time { get; set; }
        public required string Name { get; set; }
        public required string Email { get; set; }
        public required string Phone { get; set; }
    }
}
