using RiftBench.Data.Entities.App;

namespace RiftBench.Data.Entities.Cards;

using NpgsqlTypes;

public sealed class Card
{
    public Guid Id { get; set; }

    public string RiftCodexId { get; set; } = null!;
    public string RiftboundId { get; set; } = null!;
    public string RiftboundIdNormalized { get; set; } = null!;

    public string? TcgPlayerId { get; set; }

    public Guid? CardSetId { get; set; }
    public CardSet? CardSet { get; set; }

    public string SetCode { get; set; } = null!;
    public string SetLabel { get; set; } = null!;

    public string Name { get; set; } = null!;
    public string CleanName { get; set; } = null!;

    public int CollectorNumber { get; set; }

    public CardType Type { get; set; }
    public CardSupertype Supertype { get; set; } = CardSupertype.None;
    public CardRarity Rarity { get; set; }

    public int? Energy { get; set; }
    public int? Might { get; set; }
    public int? Power { get; set; }

    public string? RichText { get; set; }
    public string? PlainText { get; set; }
    public string? FlavourText { get; set; }

    public string? ImageUrl { get; set; }
    public string? Artist { get; set; }
    public string? AccessibilityText { get; set; }

    public bool AlternateArt { get; set; }
    public bool Overnumbered { get; set; }
    public bool Signature { get; set; }

    public DateTimeOffset? ExternalUpdatedOn { get; set; }

    /// <summary>
    /// PostgreSQL generated full-text search vector.
    /// </summary>
    public NpgsqlTsVector? SearchVector { get; set; }

    /// <summary>
    /// Raw API payload from the external card API.
    /// Stored as jsonb in PostgreSQL.
    /// </summary>
    public string RawApiData { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<CardDomainValue> Domains { get; set; } = new List<CardDomainValue>();

    public ICollection<DeckCard> DeckCards { get; set; } = new List<DeckCard>();
    // public ICollection<UserCardCollection> UserCollections { get; set; } = new List<UserCardCollection>(); TODO: Future feature - Collections
}