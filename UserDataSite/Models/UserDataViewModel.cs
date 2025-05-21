using System.Collections.Generic;

namespace UserDataSite.Models
{
    public class ConversationMessage
    {
        public string Text { get; set; }
        public string Timestamp { get; set; }
        public string Direction { get; set; }
    }

    public class UserDataViewModel
    {
        // Lead info
        public string Phone { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Address { get; set; }
        public string LeadState { get; set; }
        public string HomeType { get; set; }
        public string HomeBuilt { get; set; }
        public string HomeWorth { get; set; }
        public string SellTime { get; set; }
        public string HomeCondition { get; set; }
        public string WorkingWithAgent { get; set; }
        public string LookingToBuy { get; set; }
        public string AdId { get; set; }
        public string TrackingParameters { get; set; }
        
        // Messages
        public List<ConversationMessage> Messages { get; set; } = new();
    }
}
