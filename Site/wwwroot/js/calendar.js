class AppointmentCalendar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentMonth: new Date(),
      selectedDate: null,
      timeSlots: [],
      selectedTime: null,
      bookedSlots: [],
      userTimezone: null,
      userInfo: {
        firstName: '',
        lastName: '',
        phone: ''
      },
      showUserForm: false,
      isSubmitting: false,
      error: '',
      success: '',
      existingBooking: null,
      view: 'calendar',
      isLoadingTimeSlots: false,
      realtorId: 0 // Add this field
    };
  }
  
  
  componentDidMount() {
    // Get realtorId from URL path
    const pathArray = window.location.pathname.split('/');
    const uuid = pathArray[pathArray.length - 1];
    
    // Detect and set user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('Detected user timezone:', timezone);
    
    this.setState({ 
      userTimezone: timezone 
    });
    
    // Fetch the realtor data
    this.fetchRealtorData(uuid);
    
    // Check for tracking parameter
    const urlParams = new URLSearchParams(window.location.search);
    const trackingParam = urlParams.get('utm_source');
    
    if (trackingParam) {
      this.fetchUserData(trackingParam);
    }
    
    
  
    // Initialize SignalR connection
    this.initializeSignalR();
    
    // Expose refresh method for SignalR updates
    window.refreshCalendar = (date, time) => {
      if (this.state.selectedDate) {
        const selectedDateStr = this.state.selectedDate.toISOString().split('T')[0];
        
        if (selectedDateStr === date) {
          // Update the booked slots if the date matches
          this.setState(prevState => ({
            bookedSlots: [...prevState.bookedSlots, time]
          }));
          
          // If the user had selected this time slot, clear it
          if (this.state.selectedTime === time) {
            this.setState({
              selectedTime: null,
              showUserForm: false,
              view: 'timeSlots',
              error: 'This time slot was just booked by someone else. Please select another time.'
            });
          }
        }
      }
    };
  }
  

  // Initialize SignalR connection
  initializeSignalR = () => {
    try {
      const connection = new signalR.HubConnectionBuilder()
        .withUrl("/calendarHub")
        .configureLogging(signalR.LogLevel.Information)
        .build();

      connection.on("BookingUpdated", (date, time) => {
        console.log(`Received booking update for ${date} at ${time}`);
        if (window.refreshCalendar) {
          window.refreshCalendar(date, time);
        }
      });

      connection.start()
        .then(() => console.log("SignalR Connected"))
        .catch(err => console.error("SignalR Connection Error: ", err));

      this.hubConnection = connection;
    } catch (error) {
      console.error("Error initializing SignalR: ", error);
    }
  }

  fetchUserData = async (trackingParam) => {
    try {
      console.log("Fetching user data with tracking param:", trackingParam);
      const response = await fetch(`/api/user?tracking=${trackingParam}`);
      const data = await response.json();
      
      console.log("User data response:", data);
      
      if (response.ok && data.user) {
        // Get first and last name
        const nameParts = data.user.full_name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        this.setState({
          userInfo: {
            firstName,
            lastName,
            phone: data.user.phone || ''
          }
        }, () => {
          // After setting user info, check if they already have a booking
          if (this.state.userInfo.phone) {
            this.checkExistingBooking(this.state.userInfo.phone);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }

  // New method to check for existing booking
  checkExistingBooking = async (phone) => {
    try {
      console.log("Checking existing booking for phone:", phone);
      
      const response = await fetch(`/api/existing-booking?phone=${phone}`);
      const data = await response.json();
      
      if (response.ok && data.existingBooking) {
        console.log("Existing booking found:", data.existingBooking);
        this.setState({
          existingBooking: data.existingBooking
        });
      }
    } catch (error) {
      console.error('Error checking existing booking:', error);
    }
  }

  fetchBookedSlots = async (date) => {
    try {
      // Format date as YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0];
      console.log("Fetching booked slots for date:", formattedDate);
      
      // Check if we have a realtorId
      if (!this.state.realtorId) {
        console.error('No realtor ID available for fetching booked slots');
        return;
      }
      
      const response = await fetch(`/api/bookedslots?date=${formattedDate}&realtorId=${this.state.realtorId}`);
      const data = await response.json();
      
      console.log("Booked slots response:", data);
      
      if (response.ok) {
        this.setState({
          bookedSlots: data.bookedSlots || []
        });
      } else {
        console.error('Failed to fetch booked slots:', data.error);
      }
    } catch (error) {
      console.error('Error fetching booked slots:', error);
    }
  }

  handlePrevMonth = () => {
    this.setState({
      currentMonth: new Date(this.state.currentMonth.getFullYear(), this.state.currentMonth.getMonth() - 1, 1)
    });
  }

  handleNextMonth = () => {
    this.setState({
      currentMonth: new Date(this.state.currentMonth.getFullYear(), this.state.currentMonth.getMonth() + 1, 1)
    });
  }

  handleDateClick = (day) => {
    const selectedDate = new Date(
      this.state.currentMonth.getFullYear(),
      this.state.currentMonth.getMonth(),
      day
    );
    
    // Clear existing time slots and set loading state
    this.setState({
      selectedDate,
      selectedTime: null,
      showUserForm: false,
      error: '',
      view: 'timeSlots',
      timeSlots: [], // Clear the time slots
      isLoadingTimeSlots: true, // Add loading indicator
      bookedSlots: [] // Clear booked slots
    }, async () => {
      try {
        // Fetch booked slots first - we need to wait for this to complete
        await this.fetchBookedSlots(selectedDate);
        
        // Then generate time slots
        const slots = [];
        for (let hour = 15; hour < 24; hour++) {
          for (let minute = 0; minute < 60; minute += 15) {
            // Skip 11:45 PM as the last slot is 11:30 PM
            if (hour === 23 && minute > 30) continue;
            
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            slots.push(timeString);
          }
        }
        
        this.setState({ 
          timeSlots: slots,
          isLoadingTimeSlots: false 
        });
  
        // Check if user already has a booking
        if (this.state.userInfo.phone) {
          this.checkExistingBooking(this.state.userInfo.phone);
        }
      } catch (error) {
        console.error('Error loading time slots:', error);
        this.setState({ 
          error: 'Failed to load available time slots. Please try again.',
          isLoadingTimeSlots: false 
        });
      }
    });
  }
  

  handleTimeClick = (time) => {
    this.setState({
      selectedTime: time,
      showUserForm: true,
      error: '',
      view: 'userForm'
    });
  }

  handleInputChange = (e) => {
    const { name, value } = e.target;
    this.setState(prevState => ({
      userInfo: {
        ...prevState.userInfo,
        [name]: value
      }
    }));
  }

  // Method to handle closing modals and returning to previous view
  handleCloseModal = () => {
    // Determine which view to return to
    if (this.state.view === 'userForm') {
      this.setState({ view: 'timeSlots', showUserForm: false });
    } else if (this.state.view === 'success') {
      this.setState({ view: 'calendar', success: '' });
    } else {
      this.setState({ view: 'calendar' });
    }
  }

  
  fetchRealtorData = async (uuid) => {
    try {
      const response = await fetch(`/api/realtor?uuid=${uuid}`);
      const data = await response.json();
      
      if (response.ok && data.realtorId) {
        this.setState({
          realtorId: data.realtorId
        });
        console.log('Realtor ID set to:', data.realtorId);
      } else {
        console.error('Failed to fetch realtor data');
      }
    } catch (error) {
      console.error('Error fetching realtor data:', error);
    }
  }
  
  
  handleSubmit = async () => {
    const { userInfo, selectedDate, selectedTime, existingBooking, userTimezone, realtorId } = this.state;
    
    // Basic validation
    if (!userInfo.firstName || !userInfo.lastName || !userInfo.phone) {
      this.setState({ error: 'Please fill in all fields' });
      return;
    }

    // Phone validation - simple check for now
    if (!/^\d{10}$/.test(userInfo.phone.replace(/\D/g, ''))) {
      this.setState({ error: 'Please enter a valid phone number' });
      return;
    }

    // Realtor validation
    if (!realtorId) {
      this.setState({ error: 'Unable to determine realtor information' });
      return;
    }

    
    this.setState({ isSubmitting: true, error: '' });

    try {
      // Format date as YYYY-MM-DD
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      // Format the time for display (e.g., "15:30" to "3:30 PM")
      const [hour, minute] = selectedTime.split(':');
      const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;
      
      // Get user's timezone or fallback to browser detection
      const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('Using timezone for booking:', timezone);
      
      // Create booking payload
      const bookingData = {
        date: formattedDate,
        time: selectedTime,
        fullName: `${userInfo.firstName} ${userInfo.lastName}`,
        phone: userInfo.phone,
        isRebooking: !!existingBooking,
        timeZone: timezone,
        realtorId: realtorId
      };
      
      console.log("Submitting booking with data:", bookingData);
      
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      console.log("Booking response status:", response.status);
      const data = await response.json();
      console.log("Booking response data:", data);

      if (response.ok) {
        // Generate success message based on whether this is a new booking or rebooking
        let successMessage = 'Your appointment has been successfully booked!';
        
        if (existingBooking) {
          // Format the existing booking date/time for display
          const [existingHour, existingMinute] = existingBooking.time.split(':');
          const existingFormattedTime = `${parseInt(existingHour) % 12 || 12}:${existingMinute} ${parseInt(existingHour) >= 12 ? 'PM' : 'AM'}`;
          
          successMessage = `Your appointment has been changed from ${existingBooking.date} at ${existingFormattedTime} to ${formattedDate} at ${formattedTime}.`;
        }
        
        this.setState({
          success: successMessage,
          bookedSlots: [...this.state.bookedSlots, selectedTime],
          selectedTime: null,
          showUserForm: false,
          isSubmitting: false,
          view: 'success',
          existingBooking: {
            date: formattedDate,
            time: selectedTime,
            timeZone: timezone
          }
        });
      } else {
        // Handle specific error cases
        if (data.error === 'slot_taken') {
          this.setState({
            error: 'This time slot was just booked by someone else. Please select another time.',
            selectedTime: null,
            showUserForm: false,
            isSubmitting: false,
            view: 'timeSlots'
          }, () => {
            // Refresh booked slots
            this.fetchBookedSlots(selectedDate);
          });
        } else {
          this.setState({
            error: data.error || 'Failed to book appointment',
            isSubmitting: false
          });
        }
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      this.setState({
        error: 'An error occurred. Please try again.',
        isSubmitting: false
      });
    }
  }


  renderHeader() {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    return (
      React.createElement("div", { className: "mb-4" },
        // Add timezone display
        React.createElement("div", { 
          className: "text-sm text-gray-500 mb-2", 
          style: { textAlign: 'left' }
        }, 
          `Timezone: ${this.state.userTimezone || 'Detecting...'}`,
          React.createElement("span", { 
            className: "text-xs text-blue-500 ml-2 cursor-pointer"
          })
        ),
        // Existing header content
        React.createElement("div", { className: "flex justify-between items-center" },
          React.createElement("button", { 
            onClick: this.handlePrevMonth, 
            className: "p-2 bg-blue-100 rounded-full text-blue-500"
          }, "←"),
          React.createElement("h2", { className: "text-xl font-semibold" },
            `${monthNames[this.state.currentMonth.getMonth()]} ${this.state.currentMonth.getFullYear()}`
          ),
          React.createElement("button", { 
            onClick: this.handleNextMonth, 
            className: "p-2 bg-blue-100 rounded-full text-blue-500"
          }, "→")
        )
      )
    );
  }

  renderDays() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return (
      React.createElement("div", { className: "grid grid-cols-7 gap-2 mb-2" },
        days.map((day, i) => (
          React.createElement("div", { key: i, className: "text-center font-medium text-gray-500" }, day)
        ))
      )
    );
  }

  renderCells() {
    const { currentMonth, selectedDate } = this.state;
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const endDate = new Date(monthEnd);
    const rows = [];
    let days = [];
    let day = startDate;
    
    // Fill in days until we reach the end of the month plus any additional days to complete the week
    while (day <= monthEnd || day.getDay() !== 0) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = new Date(day);
        const formattedDate = day.getDate();
        
        // Check if the day is in the current month
        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
        // Check if the day is in the past
        const isPastDay = day < today;
        
        // Check if this day is the selected date
        const isSelected = selectedDate && 
                          day.getDate() === selectedDate.getDate() && 
                          day.getMonth() === selectedDate.getMonth() && 
                          day.getFullYear() === selectedDate.getFullYear();
                          
        days.push(
          React.createElement("div", {
            key: day.toString(),
            className: `py-3 text-center rounded-full cursor-pointer ${
              isCurrentMonth ? 'hover:bg-blue-50' : 'text-gray-300'
            } ${
              isSelected ? 'bg-blue-500 text-white' : 
              isPastDay && isCurrentMonth ? 'text-gray-400 cursor-not-allowed' : ''
            }`,
            onClick: () => {
              if (!isPastDay && isCurrentMonth) {
                this.handleDateClick(formattedDate);
              }
            }
          }, formattedDate)
        );
        
        day = new Date(day);
        day.setDate(day.getDate() + 1);
      }
      
      rows.push(
        React.createElement("div", { key: day.toString(), className: "grid grid-cols-7 gap-2 mb-2" }, days)
      );
      
      days = [];
    }
    
    return React.createElement("div", { className: "mb-4" }, rows);
  }

  
  renderTimeSlots() {
  const { selectedDate, timeSlots, bookedSlots, selectedTime, isLoadingTimeSlots } = this.state;
  
  if (!selectedDate || this.state.view !== 'timeSlots') return null;
  
  return (
    React.createElement("div", { className: "mt-6 p-4 border rounded-lg bg-white shadow-md" },
      React.createElement("div", { className: "flex justify-between items-center mb-3" },
        React.createElement("h3", { className: "text-lg font-semibold" }, "Select a Time"),
        React.createElement("button", { 
          onClick: this.handleCloseModal,
          className: "text-gray-500 hover:text-gray-700"
        }, "×")
      ),
      isLoadingTimeSlots ? 
        React.createElement("div", { className: "text-center py-4" },
          React.createElement("div", { className: "inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" }),
          React.createElement("p", { className: "mt-2" }, "Loading available times...")
        ) :
        React.createElement("div", { className: "grid grid-cols-3 gap-2" },
          timeSlots.map((time) => {
            const isBooked = bookedSlots.includes(time);
            const [hour, minute] = time.split(':');
            const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;
            
            return React.createElement("button", {
              key: time,
              className: `p-2 border rounded ${
                selectedTime === time 
                  ? 'bg-blue-500 text-white' 
                  : isBooked 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'hover:bg-blue-50'
              }`,
              onClick: () => !isBooked && this.handleTimeClick(time),
              disabled: isBooked
            }, formattedTime);
          })
        )
    )
  );
}

  renderUserForm() {
    const { showUserForm, userInfo, isSubmitting, existingBooking, selectedDate, selectedTime } = this.state;
    
    if (!showUserForm || this.state.view !== 'userForm') return null;
    
    // Format the selected date for display
    const formattedDate = selectedDate ? selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : '';
    
    // Format the selected time for display
    let formattedTime = '';
    if (selectedTime) {
      const [hour, minute] = selectedTime.split(':');
      formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;
    }
    
    return (
      React.createElement("div", { className: "mt-6 p-4 border rounded-lg bg-white shadow-md" },
        React.createElement("div", { className: "flex justify-between items-center mb-3" },
          React.createElement("h3", { className: "text-lg font-semibold" }, "Your Information"),
          React.createElement("button", { 
            onClick: this.handleCloseModal,
            className: "text-gray-500 hover:text-gray-700"
          }, "×")
        ),
        
        // Add the selected date and time information
        React.createElement("div", { 
          className: "mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded"
        }, 
          React.createElement("p", { className: "font-medium" }, "Selected Appointment:"),
          React.createElement("p", null, `Date: ${formattedDate}`),
          React.createElement("p", null, `Time: ${formattedTime}`)
        ),
        
        existingBooking && React.createElement("div", { 
          className: "mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded"
        }, `You already have an appointment on ${existingBooking.date} at ${this.formatTimeForDisplay(existingBooking.time)}. This will reschedule your appointment.`),
        
        React.createElement("div", { className: "space-y-4" },
          React.createElement("div", null,
            React.createElement("label", { className: "block text-sm font-medium text-gray-700" }, "First Name"),
            React.createElement("input", {
              type: "text",
              name: "firstName",
              value: userInfo.firstName,
              onChange: this.handleInputChange,
              className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500",
              required: true
            })
          ),
          React.createElement("div", null,
            React.createElement("label", { className: "block text-sm font-medium text-gray-700" }, "Last Name"),
            React.createElement("input", {
              type: "text",
              name: "lastName",
              value: userInfo.lastName,
              onChange: this.handleInputChange,
              className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500",
              required: true
            })
          ),
          React.createElement("div", null,
            React.createElement("label", { className: "block text-sm font-medium text-gray-700" }, "Phone Number"),
            React.createElement("input", {
              type: "tel",
              name: "phone",
              value: userInfo.phone,
              onChange: this.handleInputChange,
              className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500",
              required: true
            })
          ),
          React.createElement("button", {
            onClick: this.handleSubmit,
            disabled: isSubmitting,
            className: `w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`
          }, isSubmitting ? 'Booking...' : existingBooking ? 'Reschedule Appointment' : 'Book Appointment')
        )
      )
    );
  }

  renderSuccessMessage() {
    const { success } = this.state;
    
    if (!success || this.state.view !== 'success') return null;
    
    return (
      React.createElement("div", { 
        className: "mt-6 p-4 border rounded-lg bg-white shadow-md"
      },
        React.createElement("div", { className: "flex justify-between items-center mb-3" },
          React.createElement("h3", { className: "text-lg font-semibold text-green-600" }, "Success"),
          React.createElement("button", { 
            onClick: this.handleCloseModal,
            className: "text-gray-500 hover:text-gray-700"
          }, "×")
        ),
        React.createElement("div", {
          className: "p-3 bg-green-50 border border-green-200 text-green-700 rounded"
        }, success)
      )
    );
  }

  // Helper method to format time for display
  formatTimeForDisplay(time) {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    return `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;
  }

  render() {
    const { error, success, view } = this.state;
    
    return (
      React.createElement("div", { className: "p-6 bg-white rounded-lg shadow max-w-md mx-auto" },
        error && React.createElement("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded" }, error),
        
        this.renderHeader(),
        this.renderDays(),
        this.renderCells(),
        
        // Render views based on state
        this.renderTimeSlots(),
        this.renderUserForm(),
        this.renderSuccessMessage()
      )
    );
  }
}

// Render the calendar component when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const calendarContainer = document.getElementById('appointment-calendar-root');
  if (calendarContainer) {
    ReactDOM.render(React.createElement(AppointmentCalendar), calendarContainer);
  }
});