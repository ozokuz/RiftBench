using RiftBench.API.Models.Cards;
using RiftBench.Data.Entities.App;

namespace RiftBench.API.Models.Decks;

public sealed record DeckListItemDto(
    Guid Id,
    Guid UserId,
    string? Username,
    Guid? FolderId,
    string Name,
    string? Description,
    DeckVisibility Visibility,
    bool IsArchived,
    int CardCount,
    int TotalQuantity,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record DeckTreeDto(
    IReadOnlyList<DeckFolderNodeDto> Folders,
    IReadOnlyList<DeckListItemDto> Decks);

public sealed record DeckFolderNodeDto(
    Guid Id,
    Guid? ParentFolderId,
    string Name,
    int SortOrder,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<DeckFolderNodeDto> Children,
    IReadOnlyList<DeckListItemDto> Decks);

public sealed record DeckDetailDto(
    Guid Id,
    Guid UserId,
    string? Username,
    Guid? FolderId,
    string Name,
    string? Description,
    DeckVisibility Visibility,
    bool IsArchived,
    IReadOnlyList<DeckCategoryDto> Categories,
    IReadOnlyList<DeckCardDto> Cards,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record DeckCategoryDto(
    Guid Id,
    string Name,
    int SortOrder,
    DateTimeOffset CreatedAt);

public sealed record DeckCardDto(
    Guid CardId,
    Guid? CategoryId,
    int Quantity,
    int SortOrder,
    string? Notes,
    CardSummaryDto Card);

public sealed record DeckFolderDto(
    Guid Id,
    Guid UserId,
    Guid? ParentFolderId,
    string Name,
    int SortOrder,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
