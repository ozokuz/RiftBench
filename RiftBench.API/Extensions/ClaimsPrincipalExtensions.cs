using System.Security.Claims;

namespace RiftBench.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetRequiredUserId(this ClaimsPrincipal user)
    {
        var userId = user.GetUserIdOrNull();

        if (userId is null)
            throw new InvalidOperationException("Authenticated user id claim is missing or invalid.");

        return userId.Value;
    }

    public static Guid? GetUserIdOrNull(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }
}
