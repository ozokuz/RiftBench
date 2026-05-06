using Microsoft.EntityFrameworkCore;

using RiftBench.API.Models.Cards;
using RiftBench.API.Models.Common;
using RiftBench.API.Models.Decks;
using RiftBench.Data;
using RiftBench.Data.Entities.App;
using RiftBench.Data.Entities.Cards;

namespace RiftBench.API.Services;

public sealed class DeckService
{
    private const int NameMaxLength = 256;
    private const int DescriptionMaxLength = 4000;
    private const int CategoryNameMaxLength = 128;
    private const int NotesMaxLength = 4000;

    private readonly AppDbContext _db;

    public DeckService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResultDto<DeckListItemDto>> GetPublicDecksAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Decks
            .AsNoTracking()
            .Where(deck => deck.Visibility == DeckVisibility.Public && !deck.IsArchived);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(deck => deck.UpdatedAt)
            .ThenBy(deck => deck.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(deck => new DeckListItemDto(
                deck.Id,
                deck.UserId,
                deck.User.UserName,
                deck.FolderId,
                deck.Name,
                deck.Description,
                deck.Visibility,
                deck.IsArchived,
                deck.Cards.Count,
                deck.Cards.Sum(card => (int?)card.Quantity) ?? 0,
                deck.CreatedAt,
                deck.UpdatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResultDto<DeckListItemDto>(
            items,
            page,
            pageSize,
            totalCount);
    }

    public async Task<ServiceResult<DeckTreeDto>> GetPublicUserDeckTreeAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var userExists = await _db.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == userId, cancellationToken);

        if (!userExists)
            return ServiceResult<DeckTreeDto>.NotFound();

        var folders = await _db.DeckFolders
            .AsNoTracking()
            .Where(folder => folder.UserId == userId)
            .OrderBy(folder => folder.SortOrder)
            .ThenBy(folder => folder.Name)
            .ToListAsync(cancellationToken);

        var decks = await _db.Decks
            .AsNoTracking()
            .Include(deck => deck.User)
            .Include(deck => deck.Cards)
            .Where(deck =>
                deck.UserId == userId &&
                deck.Visibility == DeckVisibility.Public &&
                !deck.IsArchived)
            .OrderByDescending(deck => deck.UpdatedAt)
            .ThenBy(deck => deck.Name)
            .ToListAsync(cancellationToken);

        var includedFolderIds = GetFoldersContainingDecks(folders, decks);
        var prunedFolders = folders
            .Where(folder => includedFolderIds.Contains(folder.Id))
            .ToList();

        return ServiceResult<DeckTreeDto>.Ok(BuildDeckTree(prunedFolders, decks));
    }

    public async Task<DeckTreeDto> GetCurrentUserDeckTreeAsync(
        Guid userId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var folders = await _db.DeckFolders
            .AsNoTracking()
            .Where(folder => folder.UserId == userId)
            .OrderBy(folder => folder.SortOrder)
            .ThenBy(folder => folder.Name)
            .ToListAsync(cancellationToken);

        var deckQuery = _db.Decks
            .AsNoTracking()
            .Include(deck => deck.User)
            .Include(deck => deck.Cards)
            .Where(deck => deck.UserId == userId);

        if (!includeArchived)
            deckQuery = deckQuery.Where(deck => !deck.IsArchived);

        var decks = await deckQuery
            .OrderByDescending(deck => deck.UpdatedAt)
            .ThenBy(deck => deck.Name)
            .ToListAsync(cancellationToken);

        return BuildDeckTree(folders, decks);
    }

    public async Task<ServiceResult<DeckDetailDto>> GetDeckAsync(
        Guid deckId,
        Guid? currentUserId,
        CancellationToken cancellationToken)
    {
        var deck = await LoadDeckDetailQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(deck => deck.Id == deckId, cancellationToken);

        if (deck is null || !CanViewDeck(deck, currentUserId))
            return ServiceResult<DeckDetailDto>.NotFound();

        return ServiceResult<DeckDetailDto>.Ok(ToDeckDetailDto(deck));
    }

    public async Task<ServiceResult<DeckDetailDto>> CreateDeckAsync(
        Guid userId,
        CreateDeckRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        var name = ValidateRequiredText(errors, nameof(request.Name), request.Name, NameMaxLength);
        var description = ValidateOptionalText(errors, nameof(request.Description), request.Description, DescriptionMaxLength);

        if (request.FolderId is not null)
            await ValidateFolderBelongsToUserAsync(errors, nameof(request.FolderId), request.FolderId.Value, userId, cancellationToken);

        if (errors.HasErrors)
            return ServiceResult<DeckDetailDto>.BadRequest(errors.ToDictionary());

        var now = DateTimeOffset.UtcNow;
        var deck = new Deck
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FolderId = request.FolderId,
            Name = name!,
            Description = description,
            Visibility = request.Visibility,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Decks.Add(deck);
        await _db.SaveChangesAsync(cancellationToken);

        var detail = await LoadOwnedDeckDetailAsync(deck.Id, userId, cancellationToken);
        return ServiceResult<DeckDetailDto>.Created(ToDeckDetailDto(detail!));
    }

    public async Task<ServiceResult<DeckDetailDto>> UpdateDeckSettingsAsync(
        Guid deckId,
        Guid userId,
        UpdateDeckSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var deck = await _db.Decks
            .FirstOrDefaultAsync(deck => deck.Id == deckId && deck.UserId == userId, cancellationToken);

        if (deck is null)
            return ServiceResult<DeckDetailDto>.NotFound();

        var errors = new ValidationErrors();
        var name = ValidateRequiredText(errors, nameof(request.Name), request.Name, NameMaxLength);
        var description = ValidateOptionalText(errors, nameof(request.Description), request.Description, DescriptionMaxLength);

        if (request.FolderId is not null)
            await ValidateFolderBelongsToUserAsync(errors, nameof(request.FolderId), request.FolderId.Value, userId, cancellationToken);

        if (errors.HasErrors)
            return ServiceResult<DeckDetailDto>.BadRequest(errors.ToDictionary());

        deck.Name = name!;
        deck.Description = description;
        deck.FolderId = request.FolderId;
        deck.Visibility = request.Visibility;
        deck.IsArchived = request.IsArchived;
        deck.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var detail = await LoadOwnedDeckDetailAsync(deck.Id, userId, cancellationToken);
        return ServiceResult<DeckDetailDto>.Ok(ToDeckDetailDto(detail!));
    }

    public async Task<ServiceResult<DeckDetailDto>> ReplaceDeckContentsAsync(
        Guid deckId,
        Guid userId,
        ReplaceDeckContentsRequest request,
        CancellationToken cancellationToken)
    {
        var deck = await _db.Decks
            .Include(deck => deck.Categories)
            .Include(deck => deck.Cards)
            .FirstOrDefaultAsync(deck => deck.Id == deckId && deck.UserId == userId, cancellationToken);

        if (deck is null)
            return ServiceResult<DeckDetailDto>.NotFound();

        var errors = await ValidateDeckContentsAsync(deck, request, cancellationToken);

        if (errors.HasErrors)
            return ServiceResult<DeckDetailDto>.BadRequest(errors.ToDictionary());

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var requestedCategoryIds = request.Categories
            .Select(category => category.Id)
            .ToHashSet();

        var categoriesById = deck.Categories.ToDictionary(category => category.Id);
        foreach (var requestedCategory in request.Categories)
        {
            var name = requestedCategory.Name.Trim();
            if (categoriesById.TryGetValue(requestedCategory.Id, out var category))
            {
                category.Name = name;
                category.SortOrder = requestedCategory.SortOrder;
            }
            else
            {
                category = new DeckCategory
                {
                    Id = requestedCategory.Id,
                    DeckId = deck.Id,
                    Name = name,
                    SortOrder = requestedCategory.SortOrder,
                    CreatedAt = now
                };
                _db.DeckCategories.Add(category);
                categoriesById[category.Id] = category;
            }
        }

        var requestedCardIds = request.Cards
            .Select(card => card.CardId)
            .ToHashSet();

        foreach (var deckCard in deck.Cards.Where(card => !requestedCardIds.Contains(card.CardId)).ToList())
        {
            _db.DeckCards.Remove(deckCard);
        }

        var deckCardsByCardId = deck.Cards.ToDictionary(card => card.CardId);
        foreach (var requestedCard in request.Cards)
        {
            var notes = NormalizeOptionalText(requestedCard.Notes);
            if (deckCardsByCardId.TryGetValue(requestedCard.CardId, out var deckCard))
            {
                deckCard.CategoryId = requestedCard.CategoryId;
                deckCard.Quantity = requestedCard.Quantity;
                deckCard.SortOrder = requestedCard.SortOrder;
                deckCard.Notes = notes;
            }
            else
            {
                _db.DeckCards.Add(new DeckCard
                {
                    DeckId = deck.Id,
                    CardId = requestedCard.CardId,
                    CategoryId = requestedCard.CategoryId,
                    Quantity = requestedCard.Quantity,
                    SortOrder = requestedCard.SortOrder,
                    Notes = notes
                });
            }
        }

        foreach (var category in deck.Categories.Where(category => !requestedCategoryIds.Contains(category.Id)).ToList())
        {
            _db.DeckCategories.Remove(category);
        }

        deck.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var detail = await LoadOwnedDeckDetailAsync(deck.Id, userId, cancellationToken);
        return ServiceResult<DeckDetailDto>.Ok(ToDeckDetailDto(detail!));
    }

    public async Task<ServiceResult> DeleteDeckAsync(
        Guid deckId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var deck = await _db.Decks
            .FirstOrDefaultAsync(deck => deck.Id == deckId && deck.UserId == userId, cancellationToken);

        if (deck is null)
            return ServiceResult.NotFound();

        _db.Decks.Remove(deck);
        await _db.SaveChangesAsync(cancellationToken);

        return ServiceResult.NoContent();
    }

    public async Task<ServiceResult<DeckFolderDto>> CreateFolderAsync(
        Guid userId,
        CreateDeckFolderRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        var name = ValidateRequiredText(errors, nameof(request.Name), request.Name, NameMaxLength);

        if (request.ParentFolderId is not null)
            await ValidateFolderBelongsToUserAsync(errors, nameof(request.ParentFolderId), request.ParentFolderId.Value, userId, cancellationToken);

        if (errors.HasErrors)
            return ServiceResult<DeckFolderDto>.BadRequest(errors.ToDictionary());

        var now = DateTimeOffset.UtcNow;
        var folder = new DeckFolder
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ParentFolderId = request.ParentFolderId,
            Name = name!,
            SortOrder = request.SortOrder,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.DeckFolders.Add(folder);
        await _db.SaveChangesAsync(cancellationToken);

        return ServiceResult<DeckFolderDto>.Created(ToDeckFolderDto(folder));
    }

    public async Task<ServiceResult<DeckFolderDto>> UpdateFolderAsync(
        Guid folderId,
        Guid userId,
        UpdateDeckFolderRequest request,
        CancellationToken cancellationToken)
    {
        var folder = await _db.DeckFolders
            .FirstOrDefaultAsync(folder => folder.Id == folderId && folder.UserId == userId, cancellationToken);

        if (folder is null)
            return ServiceResult<DeckFolderDto>.NotFound();

        var errors = new ValidationErrors();
        var name = ValidateRequiredText(errors, nameof(request.Name), request.Name, NameMaxLength);

        if (request.ParentFolderId == folderId)
        {
            errors.Add(nameof(request.ParentFolderId), "A folder cannot be its own parent.");
        }
        else if (request.ParentFolderId is not null)
        {
            await ValidateFolderParentAsync(errors, request.ParentFolderId.Value, folderId, userId, cancellationToken);
        }

        if (errors.HasErrors)
            return ServiceResult<DeckFolderDto>.BadRequest(errors.ToDictionary());

        folder.Name = name!;
        folder.ParentFolderId = request.ParentFolderId;
        folder.SortOrder = request.SortOrder;
        folder.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        return ServiceResult<DeckFolderDto>.Ok(ToDeckFolderDto(folder));
    }

    public async Task<ServiceResult> DeleteFolderAsync(
        Guid folderId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var folder = await _db.DeckFolders
            .FirstOrDefaultAsync(folder => folder.Id == folderId && folder.UserId == userId, cancellationToken);

        if (folder is null)
            return ServiceResult.NotFound();

        var hasChildren = await _db.DeckFolders
            .AnyAsync(child => child.ParentFolderId == folderId && child.UserId == userId, cancellationToken);

        var hasDecks = await _db.Decks
            .AnyAsync(deck => deck.FolderId == folderId && deck.UserId == userId, cancellationToken);

        if (hasChildren || hasDecks)
            return ServiceResult.Conflict("Folder must be empty before it can be deleted.");

        _db.DeckFolders.Remove(folder);
        await _db.SaveChangesAsync(cancellationToken);

        return ServiceResult.NoContent();
    }

    private IQueryable<Deck> LoadDeckDetailQuery()
    {
        return _db.Decks
            .Include(deck => deck.User)
            .Include(deck => deck.Categories)
            .Include(deck => deck.Cards)
            .ThenInclude(deckCard => deckCard.Card)
            .ThenInclude(card => card.Domains);
    }

    private Task<Deck?> LoadOwnedDeckDetailAsync(
        Guid deckId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        return LoadDeckDetailQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(deck => deck.Id == deckId && deck.UserId == userId, cancellationToken);
    }

    private static bool CanViewDeck(Deck deck, Guid? currentUserId)
    {
        return currentUserId == deck.UserId ||
               deck.Visibility is DeckVisibility.Public or DeckVisibility.Unlisted;
    }

    private async Task<ValidationErrors> ValidateDeckContentsAsync(
        Deck deck,
        ReplaceDeckContentsRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();

        if (request.Categories is null)
        {
            errors.Add(nameof(request.Categories), "Categories are required.");
            return errors;
        }

        if (request.Cards is null)
        {
            errors.Add(nameof(request.Cards), "Cards are required.");
            return errors;
        }

        var duplicateCategoryIds = request.Categories
            .GroupBy(category => category.Id)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (duplicateCategoryIds.Count > 0)
            errors.Add(nameof(request.Categories), "Category ids must be unique.");

        foreach (var category in request.Categories)
        {
            if (category.Id == Guid.Empty)
                errors.Add(nameof(category.Id), "Category id cannot be empty.");

            ValidateRequiredText(errors, nameof(category.Name), category.Name, CategoryNameMaxLength);
        }

        var requestCategoryIds = request.Categories
            .Select(category => category.Id)
            .ToHashSet();

        var cardCategoryIds = request.Cards
            .Where(card => card.CategoryId is not null)
            .Select(card => card.CategoryId!.Value)
            .ToHashSet();

        if (cardCategoryIds.Except(requestCategoryIds).Any())
            errors.Add(nameof(request.Cards), "Every card category id must be present in the categories request.");

        var duplicateCardIds = request.Cards
            .GroupBy(card => card.CardId)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (duplicateCardIds.Count > 0)
            errors.Add(nameof(request.Cards), "Card ids must be unique within a deck.");

        foreach (var card in request.Cards)
        {
            if (card.CardId == Guid.Empty)
                errors.Add(nameof(card.CardId), "Card id cannot be empty.");

            if (card.Quantity <= 0)
                errors.Add(nameof(card.Quantity), "Quantity must be greater than zero.");

            ValidateOptionalText(errors, nameof(card.Notes), card.Notes, NotesMaxLength);
        }

        if (errors.HasErrors)
            return errors;

        var requestCardIds = request.Cards
            .Select(card => card.CardId)
            .ToHashSet();

        var existingCardCount = await _db.Cards
            .CountAsync(card => requestCardIds.Contains(card.Id), cancellationToken);

        if (existingCardCount != requestCardIds.Count)
            errors.Add(nameof(request.Cards), "One or more card ids do not exist.");

        var existingDeckCategoryIds = deck.Categories
            .Select(category => category.Id)
            .ToHashSet();

        var newOrExistingRequestCategoryIds = requestCategoryIds
            .Where(categoryId => !existingDeckCategoryIds.Contains(categoryId))
            .ToHashSet();

        var conflictingCategoryExists = await _db.DeckCategories
            .AnyAsync(category =>
                newOrExistingRequestCategoryIds.Contains(category.Id) &&
                category.DeckId != deck.Id,
                cancellationToken);

        if (conflictingCategoryExists)
            errors.Add(nameof(request.Categories), "One or more category ids belong to another deck.");

        return errors;
    }

    private static DeckTreeDto BuildDeckTree(
        IReadOnlyList<DeckFolder> folders,
        IReadOnlyList<Deck> decks)
    {
        var rootFolderEntities = folders
            .Where(folder => folder.ParentFolderId is null)
            .OrderBy(folder => folder.SortOrder)
            .ThenBy(folder => folder.Name)
            .ToList();

        var foldersByParentId = folders
            .Where(folder => folder.ParentFolderId is not null)
            .GroupBy(folder => folder.ParentFolderId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        var decksByFolderId = decks
            .Where(deck => deck.FolderId is not null)
            .GroupBy(deck => deck.FolderId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        var rootFolders = BuildFolderNodes(rootFolderEntities, foldersByParentId, decksByFolderId);
        var rootDecks = decks
            .Where(deck => deck.FolderId is null)
            .OrderByDescending(deck => deck.UpdatedAt)
            .ThenBy(deck => deck.Name)
            .Select(ToDeckListItemDto)
            .ToList();

        return new DeckTreeDto(rootFolders, rootDecks);
    }

    private static List<DeckFolderNodeDto> BuildFolderNodes(
        IReadOnlyList<DeckFolder> folders,
        IReadOnlyDictionary<Guid, List<DeckFolder>> foldersByParentId,
        IReadOnlyDictionary<Guid, List<Deck>> decksByFolderId)
    {
        return folders
            .OrderBy(folder => folder.SortOrder)
            .ThenBy(folder => folder.Name)
            .Select(folder =>
            {
                var childFolders = foldersByParentId.TryGetValue(folder.Id, out var children)
                    ? children
                    : new List<DeckFolder>();

                var childNodes = BuildFolderNodes(childFolders, foldersByParentId, decksByFolderId);
                var decks = decksByFolderId.TryGetValue(folder.Id, out var folderDecks)
                    ? folderDecks
                        .OrderByDescending(deck => deck.UpdatedAt)
                        .ThenBy(deck => deck.Name)
                        .Select(ToDeckListItemDto)
                        .ToList()
                    : new List<DeckListItemDto>();

                return new DeckFolderNodeDto(
                    folder.Id,
                    folder.ParentFolderId,
                    folder.Name,
                    folder.SortOrder,
                    folder.CreatedAt,
                    folder.UpdatedAt,
                    childNodes,
                    decks);
            })
            .ToList();
    }

    private static HashSet<Guid> GetFoldersContainingDecks(
        IReadOnlyList<DeckFolder> folders,
        IReadOnlyList<Deck> decks)
    {
        var foldersById = folders.ToDictionary(folder => folder.Id);
        var includedFolderIds = new HashSet<Guid>();

        foreach (var folderId in decks.Select(deck => deck.FolderId).Where(folderId => folderId is not null))
        {
            var currentFolderId = folderId;
            while (currentFolderId is not null &&
                   foldersById.TryGetValue(currentFolderId.Value, out var folder) &&
                   includedFolderIds.Add(folder.Id))
            {
                currentFolderId = folder.ParentFolderId;
            }
        }

        return includedFolderIds;
    }

    private async Task ValidateFolderBelongsToUserAsync(
        ValidationErrors errors,
        string field,
        Guid folderId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var exists = await _db.DeckFolders
            .AnyAsync(folder => folder.Id == folderId && folder.UserId == userId, cancellationToken);

        if (!exists)
            errors.Add(field, "Folder does not exist.");
    }

    private async Task ValidateFolderParentAsync(
        ValidationErrors errors,
        Guid parentFolderId,
        Guid folderId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var folders = await _db.DeckFolders
            .AsNoTracking()
            .Where(folder => folder.UserId == userId)
            .ToListAsync(cancellationToken);

        var foldersById = folders.ToDictionary(folder => folder.Id);

        if (!foldersById.TryGetValue(parentFolderId, out var parent))
        {
            errors.Add("ParentFolderId", "Parent folder does not exist.");
            return;
        }

        while (parent is not null)
        {
            if (parent.Id == folderId)
            {
                errors.Add("ParentFolderId", "Folder parent would create a cycle.");
                return;
            }

            parent = parent.ParentFolderId is null
                ? null
                : foldersById.GetValueOrDefault(parent.ParentFolderId.Value);
        }
    }

    private static DeckListItemDto ToDeckListItemDto(Deck deck)
    {
        return new DeckListItemDto(
            deck.Id,
            deck.UserId,
            deck.User.UserName,
            deck.FolderId,
            deck.Name,
            deck.Description,
            deck.Visibility,
            deck.IsArchived,
            deck.Cards.Count,
            deck.Cards.Sum(card => card.Quantity),
            deck.CreatedAt,
            deck.UpdatedAt);
    }

    private static DeckDetailDto ToDeckDetailDto(Deck deck)
    {
        var categorySortOrders = deck.Categories
            .ToDictionary(category => category.Id, category => category.SortOrder);

        var categories = deck.Categories
            .OrderBy(category => category.SortOrder)
            .ThenBy(category => category.Name)
            .Select(category => new DeckCategoryDto(
                category.Id,
                category.Name,
                category.SortOrder,
                category.CreatedAt))
            .ToList();

        var cards = deck.Cards
            .OrderBy(deckCard => deckCard.CategoryId is null)
            .ThenBy(deckCard => deckCard.CategoryId is null
                ? int.MaxValue
                : categorySortOrders.GetValueOrDefault(deckCard.CategoryId.Value, int.MaxValue))
            .ThenBy(deckCard => deckCard.SortOrder)
            .ThenBy(deckCard => deckCard.Card.Name)
            .Select(deckCard => new DeckCardDto(
                deckCard.CardId,
                deckCard.CategoryId,
                deckCard.Quantity,
                deckCard.SortOrder,
                deckCard.Notes,
                ToCardSummaryDto(deckCard.Card)))
            .ToList();

        return new DeckDetailDto(
            deck.Id,
            deck.UserId,
            deck.User.UserName,
            deck.FolderId,
            deck.Name,
            deck.Description,
            deck.Visibility,
            deck.IsArchived,
            categories,
            cards,
            deck.CreatedAt,
            deck.UpdatedAt);
    }

    private static DeckFolderDto ToDeckFolderDto(DeckFolder folder)
    {
        return new DeckFolderDto(
            folder.Id,
            folder.UserId,
            folder.ParentFolderId,
            folder.Name,
            folder.SortOrder,
            folder.CreatedAt,
            folder.UpdatedAt);
    }

    private static CardSummaryDto ToCardSummaryDto(Card card)
    {
        return new CardSummaryDto(
            card.Id,
            card.RiftboundId,
            card.SetCode,
            card.SetLabel,
            card.Name,
            card.CleanName,
            card.CollectorNumber,
            card.Type,
            card.Supertype,
            card.Rarity,
            card.Energy,
            card.Might,
            card.Power,
            card.Domains
                .OrderBy(domain => domain.Domain)
                .Select(domain => domain.Domain)
                .ToList(),
            card.ImageUrl,
            card.AlternateArt,
            card.Overnumbered,
            card.Signature);
    }

    private static string? ValidateRequiredText(
        ValidationErrors errors,
        string field,
        string? value,
        int maxLength)
    {
        var normalized = NormalizeOptionalText(value);

        if (normalized is null)
        {
            errors.Add(field, "Value is required.");
            return null;
        }

        if (normalized.Length > maxLength)
            errors.Add(field, $"Value must be {maxLength} characters or fewer.");

        return normalized;
    }

    private static string? ValidateOptionalText(
        ValidationErrors errors,
        string field,
        string? value,
        int maxLength)
    {
        var normalized = NormalizeOptionalText(value);

        if (normalized is not null && normalized.Length > maxLength)
            errors.Add(field, $"Value must be {maxLength} characters or fewer.");

        return normalized;
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim();
    }

    private sealed class ValidationErrors
    {
        private readonly Dictionary<string, List<string>> _errors = new();

        public bool HasErrors => _errors.Count > 0;

        public void Add(string field, string error)
        {
            if (!_errors.TryGetValue(field, out var fieldErrors))
            {
                fieldErrors = new List<string>();
                _errors[field] = fieldErrors;
            }

            fieldErrors.Add(error);
        }

        public IReadOnlyDictionary<string, string[]> ToDictionary()
        {
            return _errors.ToDictionary(
                pair => pair.Key,
                pair => pair.Value.ToArray());
        }
    }
}
