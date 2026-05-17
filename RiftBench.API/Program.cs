using System.Security.Claims;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Serialization;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

using OpenIddict.Abstractions;
using OpenIddict.Client.AspNetCore;
using OpenIddict.Client.WebIntegration;

using RiftBench.API;
using RiftBench.API.BadDesign;
using RiftBench.API.Models;
using RiftBench.API.Models.Auth;
using RiftBench.API.Services;
using RiftBench.Data;
using RiftBench.Data.Entities;

using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var githubClientId = builder.Configuration["Authentication:GitHub:ClientId"];
var githubClientSecret = builder.Configuration["Authentication:GitHub:ClientSecret"];
var discordClientId = builder.Configuration["Authentication:Discord:ClientId"];
var discordClientSecret = builder.Configuration["Authentication:Discord:ClientSecret"];
var openIddictClientEncryptionCertificatePath =
    builder.Configuration["OpenIddict:Client:EncryptionCertificatePath"];
var openIddictClientEncryptionCertificatePassword =
    builder.Configuration["OpenIddict:Client:EncryptionCertificatePassword"];
var openIddictClientSigningCertificatePath =
    builder.Configuration["OpenIddict:Client:SigningCertificatePath"];
var openIddictClientSigningCertificatePassword =
    builder.Configuration["OpenIddict:Client:SigningCertificatePassword"];
var hasGitHubAuth = !string.IsNullOrWhiteSpace(githubClientId) &&
                    !string.IsNullOrWhiteSpace(githubClientSecret);
var hasDiscordAuth = !string.IsNullOrWhiteSpace(discordClientId) &&
                     !string.IsNullOrWhiteSpace(discordClientSecret);

static X509Certificate2 LoadRequiredCertificate(string? path, string? password, string configurationKey)
{
    if (string.IsNullOrWhiteSpace(path))
        throw new InvalidOperationException($"Missing configuration value '{configurationKey}'.");

    if (!File.Exists(path))
        throw new InvalidOperationException(
            $"Configured certificate file for '{configurationKey}' was not found at '{path}'.");

    return X509CertificateLoader.LoadPkcs12FromFile(path, password);
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(builder.Configuration["WebBase"] ?? "http://localhost:xxxx")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddDistributedMemoryCache();
builder.Services.AddScoped<IOneTimeLoginCodeStore, OneTimeLoginCodeStore>();
builder.Services.AddScoped<CardSearchService>();
builder.Services.AddScoped<DeckService>();
builder.Services.AddSingleton<IEmailSender<ApplicationUser>, NoOpEmailSender<ApplicationUser>>();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.UseOpenIddict();
});

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = IdentityConstants.BearerScheme;
    options.DefaultSignInScheme = IdentityConstants.BearerScheme;
}).AddBearerToken(IdentityConstants.BearerScheme);

var openIddict = builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
            .UseDbContext<AppDbContext>();
    });

if (hasGitHubAuth || hasDiscordAuth)
{
    openIddict.AddClient(options =>
    {
        options.AllowAuthorizationCodeFlow();

        if (builder.Environment.IsDevelopment())
        {
            options.AddDevelopmentEncryptionCertificate()
                .AddDevelopmentSigningCertificate();

            options.UseAspNetCore()
                .EnableRedirectionEndpointPassthrough().DisableTransportSecurityRequirement();
        }
        else
        {
            options.AddEncryptionCertificate(
                    LoadRequiredCertificate(
                        openIddictClientEncryptionCertificatePath,
                        openIddictClientEncryptionCertificatePassword,
                        "OpenIddict:Client:EncryptionCertificatePath"))
                .AddSigningCertificate(
                    LoadRequiredCertificate(
                        openIddictClientSigningCertificatePath,
                        openIddictClientSigningCertificatePassword,
                        "OpenIddict:Client:SigningCertificatePath"));

            options.UseAspNetCore()
                .EnableRedirectionEndpointPassthrough();
        }

        options.UseSystemNetHttp();

        var providers = options.UseWebProviders();

        if (hasGitHubAuth)
        {
            providers.AddGitHub(ghOptions =>
            {
                ghOptions.SetClientId(githubClientId!)
                    .SetClientSecret(githubClientSecret!)
                    .AddScopes("user:email")
                    .SetRedirectUri("auth/callback/github");
            });
        }

        if (hasDiscordAuth)
        {
            providers.AddDiscord(dcOptions =>
            {
                dcOptions.SetClientId(discordClientId!)
                    .SetClientSecret(discordClientSecret!)
                    .AddScopes("email")
                    .SetRedirectUri("auth/callback/discord");
            });
        }
    });
}

builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddOpenApi();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;

    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();
var webBase = app.Configuration["WebBase"] ?? "/";

static bool IsLocalRedirectPath(string? value)
{
    return value is { Length: > 0 } &&
           value.StartsWith('/') &&
           !value.StartsWith("//", StringComparison.Ordinal);
}

app.UseForwardedHeaders();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.UseExceptionHandler(exceptionApp =>
    exceptionApp.Run(async context => await Results.Problem().ExecuteAsync(context)));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs");
}

app.MapGet("/auth/login/github", (HttpContext http, string? returnUrl) =>
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = IsLocalRedirectPath(returnUrl) ? returnUrl : "/",
    };

    return Results.Challenge(properties, [OpenIddictClientWebIntegrationConstants.Providers.GitHub]);
});
app.MapGet("/auth/login/discord", (HttpContext http, string? returnUrl) =>
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = IsLocalRedirectPath(returnUrl) ? returnUrl : "/"
    };

    return Results.Challenge(properties, [OpenIddictClientWebIntegrationConstants.Providers.Discord]);
});

app.MapMethods(
    "/auth/callback/{provider}",
    ["GET", "POST"],
    async (
        HttpContext http,
        UserManager<ApplicationUser> userManager,
        IOneTimeLoginCodeStore codeStore) =>
    {
        var result = await http.AuthenticateAsync(
            OpenIddictClientAspNetCoreDefaults.AuthenticationScheme);

        if (!result.Succeeded || result.Principal is null || result.Principal.Identity?.IsAuthenticated != true)
            return Results.Unauthorized();

        var provider =
            result.Principal.GetClaim(OpenIddictConstants.Claims.Private.RegistrationId);

        var providerUserId =
            result.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? result.Principal.GetClaim(OpenIddictConstants.Claims.Subject);

        var email = result.Principal.FindFirstValue(ClaimTypes.Email);
        var name = result.Principal.FindFirstValue(ClaimTypes.Name);

        if (provider is null || providerUserId is null)
            return Results.BadRequest("External provider did not return a user id.");

        ApplicationUser? user = null;
        var existingLogin = await userManager.FindByLoginAsync(provider, providerUserId);

        if (existingLogin is not null)
        {
            user = existingLogin;
        }
        else
        {
            if (email is null)
            {
                return Results.BadRequest("Email Required");
            }

            user = await userManager.FindByEmailAsync(email);

            if (user is null)
            {
                user = new ApplicationUser { UserName = name ?? email, Email = email, EmailConfirmed = true };

                var createResult = await userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                    return Results.BadRequest(createResult.Errors);
            }

            var loginInfo = new UserLoginInfo(
                provider,
                providerUserId,
                provider);

            var addLoginResult = await userManager.AddLoginAsync(user, loginInfo);
            if (!addLoginResult.Succeeded)
                return Results.BadRequest(addLoginResult.Errors);
        }

        var loginCode = await codeStore.CreateAsync(user.Id);

        var redirectUrl = result.Properties?.RedirectUri ?? "/";
        return Results.Redirect(
            $"{webBase}/auth?redirect_url={Uri.EscapeDataString(redirectUrl)}&auth_code={Uri.EscapeDataString(loginCode)}");
    });

app.MapPost("/auth/exchange", async (
    ExchangeExternalLoginRequest request,
    IOneTimeLoginCodeStore codeStore,
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager) =>
{
    var userId = await codeStore.RedeemAsync(request.Code);

    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var user = await userManager.FindByIdAsync(userId);

    if (user is null)
    {
        return Results.Unauthorized();
    }

    signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;

    await signInManager.SignInAsync(
        user,
        isPersistent: false,
        authenticationMethod: "external");

    return Results.Empty;
}).Produces<AccessTokenResponse>();

app.MapPost("/auth/logout", async ([FromBody] object empty, [FromServices] SignInManager<ApplicationUser> signInManager) =>
    {
        if (empty == null)
        {
            return Results.Unauthorized();
        }

        await signInManager.SignOutAsync();
        return Results.Ok();
    })
    .RequireAuthorization();

app.MapGet("/me",
        (HttpContext context, ClaimsPrincipal user) => Results.Ok(
            new UserInfoDto(Username: user.FindFirstValue(ClaimTypes.Name),
                Email: user.FindFirstValue(ClaimTypes.Email), UserId: user.FindFirstValue(ClaimTypes.NameIdentifier))))
    .Produces<UserInfoDto>()
    .RequireAuthorization();
var identityAuthGroup = app.MapGroup("/auth");
identityAuthGroup.AddEndpointFilter(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.HttpContext.Request.Method) ||
        !context.HttpContext.Request.Path.Equals("/auth/refresh", StringComparison.OrdinalIgnoreCase))
    {
        return Results.NotFound();
    }

    return await next(context);
});
identityAuthGroup.MapIdentityApi<ApplicationUser>()
    .Add(endpointBuilder =>
    {
        if (endpointBuilder is RouteEndpointBuilder routeEndpointBuilder &&
            routeEndpointBuilder.RoutePattern.RawText is not ("/auth/refresh" or "/refresh"))
        {
            endpointBuilder.Metadata.Add(new ExcludeFromDescriptionAttribute());
        }
    });
app.MapControllers();
app.Run();
