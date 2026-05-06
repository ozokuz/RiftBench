using RiftBench.Data.Entities.Cards;

namespace RiftBench.API.Models.Cards;

public enum DomainFilterMode
{
    Or,
    And
}

public sealed class CardSearchRequest
{
    public string? Search { get; init; }

    public IReadOnlyCollection<CardDomain> Domains { get; init; } = [];
    public DomainFilterMode DomainMode { get; init; } = DomainFilterMode.Or;

    public IReadOnlyCollection<CardRarity> Rarities { get; init; } = [];
    public IReadOnlyCollection<CardType> Types { get; init; } = [];
    public IReadOnlyCollection<CardSupertype> Supertypes { get; init; } = [];

    /// <summary>
    /// Examples: "3", ">3", ">=3", "<2", "<=2", "2-5"
    /// </summary>
    public string? Energy { get; init; }

    /// <summary>
    /// Examples: "3", ">3", ">=3", "<2", "<=2", "2-5"
    /// </summary>
    public string? Might { get; init; }

    public string? SortBy { get; init; }
    public bool SortDescending { get; init; }

    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
}
