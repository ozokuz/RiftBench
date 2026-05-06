using RiftBench.Data.Entities.App;

namespace RiftBench.API.Models.Decks;

public sealed record CreateDeckRequest(
    string Name,
    string? Description,
    Guid? FolderId,
    DeckVisibility Visibility);

public sealed record UpdateDeckSettingsRequest(
    string Name,
    string? Description,
    Guid? FolderId,
    DeckVisibility Visibility,
    bool IsArchived);

public sealed record ReplaceDeckContentsRequest(
    IReadOnlyList<UpsertDeckCategoryRequest> Categories,
    IReadOnlyList<UpsertDeckCardRequest> Cards);

public sealed record UpsertDeckCategoryRequest(
    Guid Id,
    string Name,
    int SortOrder);

public sealed record UpsertDeckCardRequest(
    Guid CardId,
    Guid? CategoryId,
    int Quantity,
    int SortOrder,
    string? Notes);

public sealed record CreateDeckFolderRequest(
    string Name,
    Guid? ParentFolderId,
    int SortOrder);

public sealed record UpdateDeckFolderRequest(
    string Name,
    Guid? ParentFolderId,
    int SortOrder);
