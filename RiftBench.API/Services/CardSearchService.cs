using System.Linq.Expressions;

using RiftBench.API.Models.Cards;
using RiftBench.API.Models.Common;
using RiftBench.Data;
using RiftBench.Data.Entities.Cards;

namespace RiftBench.API.Services;

using Microsoft.EntityFrameworkCore;

public sealed class CardSearchService
{
    private readonly AppDbContext _db;

    public CardSearchService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResultDto<CardSummaryDto>> SearchAsync(
        CardSearchRequest request,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Cards
            .AsNoTracking()
            .Include(x => x.Domains)
            .AsQueryable();

        query = ApplyTextSearch(query, request.Search);

        query = ApplyDomainFilter(
            query,
            request.Domains,
            request.DomainMode);

        query = ApplyEnumFilters(query, request);

        query = ApplyNumericFilter(
            query,
            x => x.Energy,
            NumericFilterParser.Parse(request.Energy));

        query = ApplyNumericFilter(
            query,
            x => x.Might,
            NumericFilterParser.Parse(request.Might));

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var totalCount = await query.CountAsync(cancellationToken);

        query = ApplySorting(query, request);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(card => new CardSummaryDto(
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
                card.Signature))
            .ToListAsync(cancellationToken);

        return new PagedResultDto<CardSummaryDto>(
            items,
            page,
            pageSize,
            totalCount);
    }

    public async Task<ServiceResult<CardDetailDto>> GetCardAsync(
        Guid cardId,
        CancellationToken cancellationToken = default)
    {
        var card = await _db.Cards
            .AsNoTracking()
            .Include(x => x.Domains)
            .Where(x => x.Id == cardId)
            .Select(card => new CardDetailDto(
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
                card.RichText,
                card.PlainText,
                card.FlavourText,
                card.Artist,
                card.AlternateArt,
                card.Overnumbered,
                card.Signature))
            .FirstOrDefaultAsync(cancellationToken);

        return card is null
            ? ServiceResult<CardDetailDto>.NotFound()
            : ServiceResult<CardDetailDto>.Ok(card);
    }

    private static IQueryable<Card> ApplyTextSearch(
        IQueryable<Card> query,
        string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return query;

        var normalizedSearch = search.Trim();

        return query.Where(card =>
            card.SearchVector != null &&
            card.SearchVector.Matches(
                EF.Functions.PlainToTsQuery("simple", normalizedSearch)));
    }

    private static IQueryable<Card> ApplyDomainFilter(
        IQueryable<Card> query,
        IReadOnlyCollection<CardDomain> domains,
        DomainFilterMode mode)
    {
        if (domains.Count == 0)
            return query;

        if (mode == DomainFilterMode.Or)
        {
            return query.Where(card =>
                card.Domains.Any(domain => domains.Contains(domain.Domain)));
        }

        foreach (var domain in domains)
        {
            var capturedDomain = domain;

            query = query.Where(card =>
                card.Domains.Any(cardDomain => cardDomain.Domain == capturedDomain));
        }

        return query;
    }

    private static IQueryable<Card> ApplyEnumFilters(
        IQueryable<Card> query,
        CardSearchRequest request)
    {
        if (request.Rarities.Count > 0)
        {
            query = query.Where(card => request.Rarities.Contains(card.Rarity));
        }

        if (request.Types.Count > 0)
        {
            query = query.Where(card => request.Types.Contains(card.Type));
        }

        if (request.Supertypes.Count > 0)
        {
            query = query.Where(card => request.Supertypes.Contains(card.Supertype));
        }

        return query;
    }

    private static IQueryable<Card> ApplyNumericFilter(
        IQueryable<Card> query,
        Expression<Func<Card, int?>> selector,
        NumericFilter? filter)
    {
        if (filter is null)
            return query;

        var parameter = selector.Parameters[0];
        var property = selector.Body;

        var hasValue = Expression.Property(property, nameof(Nullable<int>.HasValue));
        var value = Expression.Property(property, nameof(Nullable<int>.Value));

        Expression comparison = filter.Operator switch
        {
            NumericFilterOperator.Equal =>
                Expression.Equal(value, Expression.Constant(filter.Value)),

            NumericFilterOperator.GreaterThan =>
                Expression.GreaterThan(value, Expression.Constant(filter.Value)),

            NumericFilterOperator.GreaterThanOrEqual =>
                Expression.GreaterThanOrEqual(value, Expression.Constant(filter.Value)),

            NumericFilterOperator.LessThan =>
                Expression.LessThan(value, Expression.Constant(filter.Value)),

            NumericFilterOperator.LessThanOrEqual =>
                Expression.LessThanOrEqual(value, Expression.Constant(filter.Value)),

            NumericFilterOperator.Between =>
                Expression.AndAlso(
                    Expression.GreaterThanOrEqual(value, Expression.Constant(filter.Value)),
                    Expression.LessThanOrEqual(value, Expression.Constant(filter.SecondValue!.Value))),

            _ => throw new InvalidOperationException("Unsupported numeric filter operator.")
        };

        var body = Expression.AndAlso(hasValue, comparison);

        var lambda = Expression.Lambda<Func<Card, bool>>(body, parameter);

        return query.Where(lambda);
    }

    private static IQueryable<Card> ApplySorting(
        IQueryable<Card> query,
        CardSearchRequest request)
    {
        var sortBy = request.SortBy?.Trim().ToLowerInvariant();

        return sortBy switch
        {
            "name" => request.SortDescending
                ? query.OrderByDescending(x => x.Name)
                : query.OrderBy(x => x.Name),

            "energy" => request.SortDescending
                ? query.OrderByDescending(x => x.Energy).ThenBy(x => x.Name)
                : query.OrderBy(x => x.Energy).ThenBy(x => x.Name),

            "might" => request.SortDescending
                ? query.OrderByDescending(x => x.Might).ThenBy(x => x.Name)
                : query.OrderBy(x => x.Might).ThenBy(x => x.Name),

            "power" => request.SortDescending
                ? query.OrderByDescending(x => x.Power).ThenBy(x => x.Name)
                : query.OrderBy(x => x.Power).ThenBy(x => x.Name),

            "rarity" => request.SortDescending
                ? query.OrderByDescending(x => x.Rarity).ThenBy(x => x.Name)
                : query.OrderBy(x => x.Rarity).ThenBy(x => x.Name),

            "type" => request.SortDescending
                ? query.OrderByDescending(x => x.Type).ThenBy(x => x.Name)
                : query.OrderBy(x => x.Type).ThenBy(x => x.Name),

            "collectorNumber" or "collector_number" => request.SortDescending
                ? query.OrderByDescending(x => x.SetCode).ThenByDescending(x => x.CollectorNumber)
                : query.OrderBy(x => x.SetCode).ThenBy(x => x.CollectorNumber),

            _ => query.OrderBy(x => x.SetCode).ThenBy(x => x.CollectorNumber)
        };
    }
}
