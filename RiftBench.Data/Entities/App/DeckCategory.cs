namespace RiftBench.Data.Entities.App;

public sealed class DeckCategory
{
    public Guid Id { get; set; }

    public Guid DeckId { get; set; }
    public Deck Deck { get; set; } = null!;

    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<DeckCard> Cards { get; set; } = new List<DeckCard>();
}
