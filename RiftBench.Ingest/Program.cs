using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Kiota.Abstractions;
using Microsoft.Kiota.Abstractions.Authentication;
using Microsoft.Kiota.Http.HttpClientLibrary;

using RiftBench.Data;
using RiftBench.Ingest;

using Riftcodex.Client;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration
    .AddEnvironmentVariables()
    .AddCommandLine(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
    
builder.Services.AddHttpClient("Riftcodex", client =>
{
    client.BaseAddress = new Uri("https://api.riftcodex.com");
});

builder.Services.AddSingleton<IAuthenticationProvider>(new AnonymousAuthenticationProvider());

builder.Services.AddScoped<IRequestAdapter>(sp =>
{
    var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
    var authProvider = sp.GetRequiredService<IAuthenticationProvider>();
    
    var httpClient = httpClientFactory.CreateClient("Riftcodex");
    
    return new HttpClientRequestAdapter(
        authProvider,
        httpClient: httpClient);
});

builder.Services.AddScoped<RiftcodexClient>(sp =>
{
    var adapter = sp.GetRequiredService<IRequestAdapter>();
    adapter.BaseUrl = "https://api.riftcodex.com";
    return new RiftcodexClient(adapter);
});

builder.Services.AddTransient<CardSetIngestionService>();

using var host = builder.Build();

var ingestion = host.Services.GetRequiredService<CardSetIngestionService>();

var refetch = args.Any(arg => string.Equals(arg, "--refetch", StringComparison.OrdinalIgnoreCase));
var setCode = args.FirstOrDefault(arg => !arg.StartsWith("--", StringComparison.Ordinal));

if (string.IsNullOrWhiteSpace(setCode))
{
    await ingestion.ImportMissingSetsAsync(refetch);
    return;
}

await ingestion.ImportSetAsync(setCode, refetch);
