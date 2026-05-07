using RiftBench.Data.Entities.Cards;

namespace RiftBench.API.Models.Cards;

public sealed record CardSummaryDto(
    Guid Id,
    string RiftboundId,
    string SetCode,
    string SetLabel,
    string Name,
    string CleanName,
    int CollectorNumber,
    CardType Type,
    CardSupertype Supertype,
    CardRarity Rarity,
    int? Energy,
    int? Might,
    int? Power,
    IReadOnlyList<CardDomain> Domains,
    string? ImageUrl,
    bool AlternateArt,
    bool Overnumbered,
    bool Signature);

public sealed record CardDetailDto(
    Guid Id,
    string RiftboundId,
    string SetCode,
    string SetLabel,
    string Name,
    string CleanName,
    int CollectorNumber,
    CardType Type,
    CardSupertype Supertype,
    CardRarity Rarity,
    int? Energy,
    int? Might,
    int? Power,
    IReadOnlyList<CardDomain> Domains,
    string? ImageUrl,
    string? RichText,
    string? PlainText,
    string? FlavourText,
    string? Artist,
    bool AlternateArt,
    bool Overnumbered,
    bool Signature);
