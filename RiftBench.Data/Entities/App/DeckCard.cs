using RiftBench.Data.Entities.Cards;

namespace RiftBench.Data.Entities.App;

public sealed class DeckCard
{
    public Guid DeckId { get; set; }
    public Deck Deck { get; set; } = null!;

    public Guid CardId { get; set; }
    public Card Card { get; set; } = null!;

    public Guid? CategoryId { get; set; }
    public DeckCategory? Category { get; set; }

    public int Quantity { get; set; }
    public int SortOrder { get; set; }

    public string? Notes { get; set; }
}
