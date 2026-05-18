namespace RiftBench.Data.Entities.App;

public enum DeckVisibility
{
    Private,
    Unlisted,
    Public
}

public sealed class Deck
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid? FolderId { get; set; }
    public DeckFolder? Folder { get; set; }

    public string Name { get; set; } = null!;
    public string? Description { get; set; }

    public DeckVisibility Visibility { get; set; } = DeckVisibility.Private;

    public bool IsArchived { get; set; }
    public bool IsLegal { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<DeckCategory> Categories { get; set; } = new List<DeckCategory>();
    public ICollection<DeckCard> Cards { get; set; } = new List<DeckCard>();
}
