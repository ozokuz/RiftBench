using System.Security.Claims;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.EntityFrameworkCore;

using OpenIddict.Abstractions;
using OpenIddict.Client.AspNetCore;
using OpenIddict.Client.WebIntegration;

using RiftBench.API.BadDesign;
using RiftBench.API.Data;
using RiftBench.API.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IEmailSender<ApplicationUser>, NoOpEmailSender<ApplicationUser>>();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("appdata"));
    options.UseOpenIddict();
});

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = IdentityConstants.ApplicationScheme;
    options.DefaultSignInScheme = IdentityConstants.ExternalScheme;
});

builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
            .UseDbContext<AppDbContext>();
    })
    .AddClient(options =>
    {
        options.AllowAuthorizationCodeFlow();

        options.AddDevelopmentEncryptionCertificate()
            .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
            .EnableRedirectionEndpointPassthrough();

        options.UseSystemNetHttp();

        options.UseWebProviders()
            .AddGitHub(options =>
            {
                options.SetClientId(builder.Configuration["Authentication:GitHub:ClientId"]!)
                    .SetClientSecret(builder.Configuration["Authentication:GitHub:ClientSecret"]!)
                    .SetRedirectUri("api/callback/login/github");
            })
            .AddDiscord(options =>
            {
                options.SetClientId(builder.Configuration["Authentication:Discord:ClientId"]!)
                    .SetClientSecret(builder.Configuration["Authentication:Discord:ClientSecret"]!)
                    .SetRedirectUri("api/callback/login/discord");
            });
    });

builder.Services.AddAuthorization();

builder.Services.AddControllers(options =>
{
    options.Conventions.Insert(0, new RoutePrefixConvention("api"));
});
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler(exceptionApp =>
    exceptionApp.Run(async context => await Results.Problem().ExecuteAsync(context)));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "v1");
    });
}

app.UseAuthorization();

var api = app.MapGroup("/api");

api.MapGet("/auth/login/github", (HttpContext http, string? returnUrl) =>
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = returnUrl is { Length: > 0 } && returnUrl.StartsWith("/")
            ? returnUrl
            : "/"
    };

    return Results.Challenge(properties, [OpenIddictClientWebIntegrationConstants.Providers.GitHub]);
});
api.MapGet("/auth/login/discord", (HttpContext http, string? returnUrl) =>
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = returnUrl is { Length: > 0 } && returnUrl.StartsWith("/")
            ? returnUrl
            : "/"
    };

    return Results.Challenge(properties, [OpenIddictClientWebIntegrationConstants.Providers.Discord]);
});

api.MapMethods(
    "/callback/login/{provider}",
    ["GET", "POST"],
    async (
        HttpContext http,
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager) =>
    {
        var result = await http.AuthenticateAsync(
            OpenIddictClientAspNetCoreDefaults.AuthenticationScheme);

        if (!result.Succeeded || result.Principal is null)
            return Results.Unauthorized();

        var provider =
            result.Principal.GetClaim(OpenIddictConstants.Claims.Private.RegistrationId)
            ?? "unknown";

        var providerUserId =
            result.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? result.Principal.GetClaim(OpenIddictConstants.Claims.Subject);

        var email = result.Principal.FindFirstValue(ClaimTypes.Email);
        var name = result.Principal.FindFirstValue(ClaimTypes.Name);

        if (providerUserId is null)
            return Results.BadRequest("External provider did not return a user id.");

        var user = await userManager.FindByLoginAsync(provider, providerUserId);

        if (user is null)
        {
            user = new ApplicationUser { UserName = email ?? $"{provider}:{providerUserId}", Email = email };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return Results.BadRequest(createResult.Errors);

            var loginInfo = new UserLoginInfo(
                provider,
                providerUserId,
                provider);

            var addLoginResult = await userManager.AddLoginAsync(user, loginInfo);
            if (!addLoginResult.Succeeded)
                return Results.BadRequest(addLoginResult.Errors);
        }

        await signInManager.SignInAsync(user, isPersistent: true);

        var redirectUrl = result.Properties?.RedirectUri ?? "/";
        return Results.Redirect(redirectUrl);
    });

api.MapGet("/me",
        (HttpContext context, ClaimsPrincipal user) => Results.Ok(
            $"It is me {user.FindFirstValue(ClaimTypes.Name)}, with email: {user.FindFirstValue(ClaimTypes.Email)}"))
    .RequireAuthorization();

api.MapGroup("/auth").MapIdentityApi<ApplicationUser>();

app.MapControllers();

app.Run();