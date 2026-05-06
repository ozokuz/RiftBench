namespace RiftBench.Data.Entities.App;

public sealed class DeckFolder
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public Guid? ParentFolderId { get; set; }
    public DeckFolder? ParentFolder { get; set; }

    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<DeckFolder> Children { get; set; } = new List<DeckFolder>();
    public ICollection<Deck> Decks { get; set; } = new List<Deck>();
}
