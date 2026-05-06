namespace RiftBench.Data.Entities.Cards;

public sealed class CardSet
{
    public Guid Id { get; set; }

    public string RiftCodexId { get; set; } = null!;
    public string SetId { get; set; } = null!;

    public string Name { get; set; } = null!;
    public int? CardCount { get; set; }
    public DateTimeOffset? PublishedOn { get; set; }

    public string? TcgPlayerId { get; set; }

    /// <summary>
    /// Raw API payload from the external card API.
    /// Stored as jsonb in PostgreSQL.
    /// </summary>
    public string RawApiData { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Card> Cards { get; set; } = new List<Card>();
}
