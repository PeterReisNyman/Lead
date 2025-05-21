document.addEventListener('DOMContentLoaded', function() {
    // Load testimonials
    loadTestimonials();
    
    // Initialize Google Calendar
    initGoogleCalendar();
    
    // Set up real-time updates
    setupRealTimeUpdates();

    // Wait for the iframe to load
  const vimeoIframe = document.getElementById('vimeo-player');
  
  if (!vimeoIframe) {
    console.error('Vimeo iframe not found');
    return;
  }
  
  // Load the Vimeo API if needed
  if (typeof Vimeo === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.onload = initializeVimeoPlayer;
    document.body.appendChild(script);
  } else {
    initializeVimeoPlayer();
  }
  
  function initializeVimeoPlayer() {
    console.log('Initializing Vimeo player');
    
    const player = new Vimeo.Player(vimeoIframe);
    
    // First attempt - ensure autoplay with muted initially
    player.ready().then(() => {
      console.log('Vimeo player ready');
      
      // Start muted to comply with autoplay policies
      player.setMuted(true);
      
      // Attempt to play the video
      player.play().then(() => {
        console.log('Video playing successfully');
        
        // After 1 second, try to unmute
        setTimeout(() => {
          player.setMuted(false).catch(e => {
            console.log('Could not unmute automatically due to browser policy', e);
          });
        }, 1000);
      }).catch(playError => {
        console.warn('Autoplay failed:', playError);
      });
      
      // Check play state after a delay
      setTimeout(() => {
        player.getPaused().then(paused => {
          if (paused) {
            console.log('Video is still paused - browser blocked autoplay');
            // Could show a play button here if needed
          }
        });
      }, 2000);
    });
    
    // Set up event listeners
    player.on('play', function() {
      console.log('Video is playing');
    });
    
    player.on('pause', function() {
      console.log('Video was paused');
    });
  }
});



// Testimonials data
const testimonials = [
    {
        name: "Sarah J.",
        rating: 5,
        text: "Absolutely incredible service! I was able to achieve results I never thought possible. Highly recommend!"
    },
    {
        name: "Michael T.",
        rating: 5,
        text: "The consultation changed everything for me. Clear, actionable advice that actually works."
    },
    {
        name: "Jessica R.",
        rating: 4,
        text: "Very professional and knowledgeable. I've seen great improvement since following the recommendations."
    },
    {
        name: "Robert K.",
        rating: 5,
        text: "Top-notch expertise and incredibly responsive. Worth every penny!"
    },
    {
        name: "Emily W.",
        rating: 5,
        text: "I've tried many services before, but this one truly delivered results. Can't recommend enough!"
    }
];

function loadTestimonials() {
    const container = document.querySelector('.testimonials-container');
    
    testimonials.forEach(testimonial => {
        const card = document.createElement('div');
        card.className = 'testimonial-card';
        
        const header = document.createElement('div');
        header.className = 'testimonial-header';
        
        const avatar = document.createElement('div');
        avatar.className = 'testimonial-avatar';
        
        const info = document.createElement('div');
        
        const name = document.createElement('div');
        name.className = 'testimonial-name';
        name.textContent = testimonial.name;
        
        const rating = document.createElement('div');
        rating.className = 'testimonial-rating';
        rating.textContent = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
        
        const text = document.createElement('div');
        text.className = 'testimonial-text';
        text.textContent = testimonial.text;
        
        info.appendChild(name);
        info.appendChild(rating);
        
        header.appendChild(avatar);
        header.appendChild(info);
        
        card.appendChild(header);
        card.appendChild(text);
        
        container.appendChild(card);
    });
}

// Google Calendar API integration
function initGoogleCalendar() {
    gapi.load('client:auth2', () => {
        gapi.client.init({
            apiKey: 'YOUR_API_KEY',
            clientId: 'YOUR_CLIENT_ID',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scope: 'https://www.googleapis.com/auth/calendar'
        }).then(() => {
            loadCalendar();
        });
    });
}

function loadCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    const now = new Date();
    
    // Create calendar header
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header';
    
    const monthDisplay = document.createElement('div');
    monthDisplay.textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const navButtons = document.createElement('div');
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.onclick = () => changeMonth(-1);
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.onclick = () => changeMonth(1);
    
    navButtons.appendChild(prevBtn);
    navButtons.appendChild(nextBtn);
    
    calendarHeader.appendChild(monthDisplay);
    calendarHeader.appendChild(navButtons);
    
    // Create weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayHeader = document.createElement('div');
    weekdayHeader.className = 'calendar-grid';
    
    weekdays.forEach(day => {
        const dayElem = document.createElement('div');
        dayElem.textContent = day;
        dayElem.style.textAlign = 'center';
        dayElem.style.fontWeight = 'bold';
        weekdayHeader.appendChild(dayElem);
    });
    
    // Create calendar grid
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';
    
    // Get first day of month and last day of month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Fill in leading empty days
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        calendarGrid.appendChild(emptyDay);
    }
    
    // Fill in days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayElem = document.createElement('div');
        dayElem.className = 'calendar-day';
        dayElem.textContent = i;
        
        // Randomly mark some days as available for demo purposes
        if (Math.random() > 0.3 && i >= now.getDate()) {
            dayElem.classList.add('available');
            dayElem.onclick = () => selectDay(i);
        } else if (i < now.getDate()) {
            dayElem.classList.add('unavailable');
        }
        
        calendarGrid.appendChild(dayElem);
    }
    
    // Create time slot container
    const timeSlotContainer = document.createElement('div');
    timeSlotContainer.className = 'time-slot-container';
    timeSlotContainer.id = 'time-slots';
    
    // Append all elements
    calendarContainer.appendChild(calendarHeader);
    calendarContainer.appendChild(weekdayHeader);
    calendarContainer.appendChild(calendarGrid);
    calendarContainer.appendChild(timeSlotContainer);
}

function selectDay(day) {
    // Clear previously selected days
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Mark selected day
    event.target.classList.add('selected');
    
    // Show time slots
    const timeSlotContainer = document.getElementById('time-slots');
    timeSlotContainer.style.display = 'block';
    timeSlotContainer.innerHTML = '';
    
    // Generate time slots from 9 AM to 5 PM
    const timeSlots = [
        '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
    ];
    
    timeSlots.forEach(time => {
        // Randomly make some slots unavailable
        if (Math.random() > 0.3) {
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.textContent = time;
            slot.onclick = () => selectTimeSlot(day, time);
            timeSlotContainer.appendChild(slot);
        }
    });
}

function selectTimeSlot(day, time) {
    // Clear previously selected time slots
    document.querySelectorAll('.time-slot.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Mark selected time slot
    event.target.classList.add('selected');
    
    // Here you would handle the actual booking
    console.log(`Booking for day ${day} at ${time}`);
    
    // In a real app, you would send this to your backend
    // and create the Google Calendar event
}

function changeMonth(delta) {
    // This would update the calendar to show the previous/next month
    // For a complete implementation, you would need to regenerate the calendar
    console.log(`Changing month by ${delta}`);
}

// Setup real-time updates using WebSockets
function setupRealTimeUpdates() {
    // In a real application, you would connect to a WebSocket server
    // For demonstration purposes, we'll just log a message
    console.log('Setting up real-time updates');
    
    // Mock implementation of WebSocket connection
    /*
    const socket = new WebSocket('wss://your-websocket-server.com');
    
    socket.onopen = () => {
        console.log('WebSocket connection established');
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'calendar_update') {
            // Refresh the calendar
            loadCalendar();
        }
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };
    */
}