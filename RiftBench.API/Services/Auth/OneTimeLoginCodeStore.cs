using System.Security.Cryptography;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Distributed;

namespace RiftBench.API.Services;

public interface IOneTimeLoginCodeStore
{
    Task<string> CreateAsync(Guid userId);
    Task<string?> RedeemAsync(string code);
}

public sealed class OneTimeLoginCodeStore : IOneTimeLoginCodeStore
{
    private readonly IDistributedCache _cache;

    public OneTimeLoginCodeStore(IDistributedCache cache)
    {
        _cache = cache;
    }

    public async Task<string> CreateAsync(Guid userId)
    {
        var code = Base64UrlTextEncoder.Encode(RandomNumberGenerator.GetBytes(32));

        await _cache.SetStringAsync(
            Key(code),
            userId.ToString(),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
            });

        return code;
    }

    public async Task<string?> RedeemAsync(string code)
    {
        var key = Key(code);

        var userId = await _cache.GetStringAsync(key);

        if (userId is null)
        {
            return null;
        }

        await _cache.RemoveAsync(key);

        return userId;
    }

    private static string Key(string code)
    {
        return $"external-login-code:{code}";
    }
}
