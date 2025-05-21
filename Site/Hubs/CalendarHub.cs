using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Site.Hubs
{
    public class CalendarHub : Hub
    {
        public async Task NotifyCalendarUpdate()
        {
            await Clients.All.SendAsync("CalendarUpdated");
        }
    }
}