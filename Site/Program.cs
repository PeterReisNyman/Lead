using Site.Services;
using Site.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddSignalR();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", 
        builder => builder
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// Add database connection
builder.Services.AddTransient<IDatabaseService, DatabaseService>();

// Add connection string to configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Configuration.AddInMemoryCollection(new Dictionary<string, string>
{
    {"ConnectionStrings:DefaultConnection", connectionString}
});

// Configure logging
builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(LogLevel.Information);

// Configure the HTTP request pipeline.
builder.WebHost.UseKestrel(options =>
{
    options.ListenAnyIP(80); 
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}
else
{
    app.UseDeveloperExceptionPage();
}

app.UseStaticFiles();
app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthorization();


// IMPORTANT: Order matters for route registration
// Register specific routes first, then the more general ones

// The UUID route is now more specific with the guid constraint defined in the controller attribute
app.MapControllerRoute(
    name: "realtor",
    pattern: "{uuid}",
    defaults: new { controller = "Realtor", action = "Index" });

// Default route (comes after the custom routes)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Map SignalR hub
app.MapHub<CalendarHub>("/calendarHub");

// Run the application
app.Run();







