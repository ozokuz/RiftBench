using Microsoft.AspNetCore.Identity;

using RiftBench.Data.Entities.App;

namespace RiftBench.Data.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public ICollection<Deck> Decks { get; set; } = [];
    public ICollection<DeckFolder> DeckFolders { get; set; } = [];
    // public ICollection<UserCollectionCard> CollectionCards { get; set; } = []; TODO: Future feature - Collections
}