using Microsoft.Extensions.Configuration;

using RiftBench.Data;

using Riftcodex.Client;

namespace RiftBench.Ingest;

public class CardSetIngestionService
{
    private readonly RiftcodexClient _client;
    private readonly AppDbContext _dbContext;

    public CardSetIngestionService(RiftcodexClient client, AppDbContext dbContext)
    {
        _client = client;
        _dbContext = dbContext;
    }
    
    public async Task ImportMissingSetsAsync()
    {
        throw new NotImplementedException();
    }
    
    public async Task ImportSetAsync(string setCode)
    {
        throw new NotImplementedException();
    }
}