using System.Globalization;

using Microsoft.EntityFrameworkCore;
using Microsoft.Kiota.Abstractions.Serialization;

using RiftBench.Data;
using RiftBench.Data.Entities.Cards;

using Riftcodex.Client;
using RiftcodexCard = Riftcodex.Client.Models.Card;
using RiftcodexSet = Riftcodex.Client.Models.Set;

namespace RiftBench.Ingest;

public class CardSetIngestionService
{
    private const int PageSize = 100;

    private readonly RiftcodexClient _client;
    private readonly AppDbContext _dbContext;

    public CardSetIngestionService(RiftcodexClient client, AppDbContext dbContext)
    {
        _client = client;
        _dbContext = dbContext;
    }
    
    public async Task ImportMissingSetsAsync(bool refetch = false)
    {
        var sets = await FetchAllSetsAsync();
        var existingSetCodes = refetch
            ? new HashSet<string>()
            : (await _dbContext.CardSets
                .Select(set => set.SetId)
                .ToListAsync())
                .Select(NormalizeSetCode)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var set in sets)
        {
            var setCode = NormalizeSetCode(Require(set.SetId, "set_id"));

            if (!refetch && existingSetCodes.Contains(setCode))
            {
                continue;
            }

            await ImportSetAsync(setCode, set, refetch);
        }
    }
    
    public async Task ImportSetAsync(string setCode, bool refetch = false)
    {
        if (string.IsNullOrWhiteSpace(setCode))
        {
            throw new ArgumentException("Set code is required.", nameof(setCode));
        }

        var normalizedSetCode = NormalizeSetCode(setCode);
        var existingSet = await _dbContext.CardSets
            .AnyAsync(set => set.SetId == normalizedSetCode);

        if (!refetch && existingSet)
        {
            return;
        }

        var externalSet = await _client.Sets.SetId[setCode].GetAsync()
            ?? throw new InvalidOperationException($"Riftcodex returned no set for '{setCode}'.");

        await ImportSetAsync(normalizedSetCode, externalSet, refetch);
    }

    private async Task ImportSetAsync(string setCode, RiftcodexSet externalSet, bool refetch)
    {
        var normalizedSetCode = NormalizeSetCode(setCode);
        var cards = await FetchAllCardsAsync(normalizedSetCode);
        var now = DateTimeOffset.UtcNow;

        var cardSet = await UpsertCardSetAsync(externalSet, now);

        var riftCodexIds = cards
            .Select(card => card.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Cast<string>()
            .ToArray();

        var existingCards = await _dbContext.Cards
            .Include(card => card.Domains)
            .Where(card => riftCodexIds.Contains(card.RiftCodexId))
            .ToDictionaryAsync(card => card.RiftCodexId);

        foreach (var externalCard in cards)
        {
            if (!refetch &&
                externalCard.Id is { } externalCardId &&
                existingCards.ContainsKey(externalCardId))
            {
                continue;
            }

            UpsertCard(externalCard, cardSet, existingCards, now);
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<List<RiftcodexSet>> FetchAllSetsAsync()
    {
        var sets = new List<RiftcodexSet>();

        for (var pageNumber = 1;; pageNumber++)
        {
            var page = await _client.Sets.GetAsync(config =>
            {
                config.QueryParameters.Page = pageNumber;
                config.QueryParameters.Size = PageSize;
            });

            var items = page?.Items ?? [];
            sets.AddRange(items);

            if (items.Count == 0 || page?.Pages is null || pageNumber >= page.Pages)
            {
                return sets;
            }
        }
    }

    private async Task<List<RiftcodexCard>> FetchAllCardsAsync(string setCode)
    {
        var cards = new List<RiftcodexCard>();

        for (var pageNumber = 1;; pageNumber++)
        {
            var page = await _client.Cards.GetAsync(config =>
            {
                config.QueryParameters.Page = pageNumber;
                config.QueryParameters.Size = PageSize;
                config.QueryParameters.SetId = setCode;
                config.QueryParameters.Sort = "collector_number";
            });

            var items = page?.Items ?? [];
            cards.AddRange(items);

            if (items.Count == 0 || page?.Pages is null || pageNumber >= page.Pages)
            {
                return cards;
            }
        }
    }

    private async Task<CardSet> UpsertCardSetAsync(RiftcodexSet externalSet, DateTimeOffset now)
    {
        var riftCodexId = Require(externalSet.Id, "set.id");
        var setCode = NormalizeSetCode(Require(externalSet.SetId, "set.set_id"));

        var cardSet = await _dbContext.CardSets
            .FirstOrDefaultAsync(set => set.RiftCodexId == riftCodexId || set.SetId == setCode);

        if (cardSet is null)
        {
            cardSet = new CardSet
            {
                Id = Guid.NewGuid(),
                CreatedAt = now,
            };

            _dbContext.CardSets.Add(cardSet);
        }

        cardSet.RiftCodexId = riftCodexId;
        cardSet.SetId = setCode;
        cardSet.Name = Require(externalSet.Name, "set.name");
        cardSet.CardCount = externalSet.CardCount;
        cardSet.PublishedOn = ParseDateTimeOffset(externalSet.PublishedOn);
        cardSet.TcgPlayerId = externalSet.TcgplayerId?.String;
        cardSet.RawApiData = SerializeParsable(externalSet);
        cardSet.UpdatedAt = now;

        return cardSet;
    }

    private void UpsertCard(
        RiftcodexCard externalCard,
        CardSet cardSet,
        IReadOnlyDictionary<string, Card> existingCards,
        DateTimeOffset now)
    {
        var riftCodexId = Require(externalCard.Id, "card.id");

        if (!existingCards.TryGetValue(riftCodexId, out var card))
        {
            card = new Card
            {
                Id = Guid.NewGuid(),
                RiftCodexId = riftCodexId,
                CreatedAt = now,
            };

            _dbContext.Cards.Add(card);
        }

        var riftboundId = Require(externalCard.RiftboundId, "card.riftbound_id");
        var setCode = NormalizeSetCode(Require(externalCard.Set?.SetId, "card.set.set_id"));
        var domains = ParseDomains(externalCard.Classification?.Domain);

        card.RiftCodexId = riftCodexId;
        card.RiftboundId = riftboundId;
        card.RiftboundIdNormalized = NormalizeRiftboundId(riftboundId);
        card.TcgPlayerId = externalCard.TcgplayerId?.String;
        card.CardSetId = cardSet.Id;
        card.CardSet = cardSet;
        card.SetCode = setCode;
        card.SetLabel = Require(externalCard.Set?.Label, "card.set.label");
        card.Name = Require(externalCard.Name, "card.name");
        card.CleanName = externalCard.Metadata?.CleanName ?? card.Name;
        card.CollectorNumber = externalCard.CollectorNumber
            ?? throw new InvalidOperationException($"Card '{riftCodexId}' is missing collector_number.");
        card.Type = ParseEnum<CardType>(Require(externalCard.Classification?.Type, "card.classification.type"));
        card.Supertype = ParseSupertype(externalCard.Classification?.Supertype?.String);
        card.Rarity = ParseEnum<CardRarity>(Require(externalCard.Classification?.Rarity, "card.classification.rarity"));
        card.Energy = externalCard.Attributes?.Energy?.Integer;
        card.Might = externalCard.Attributes?.Might?.Integer;
        card.Power = externalCard.Attributes?.Power?.Integer;
        card.RichText = externalCard.Text?.Rich;
        card.PlainText = externalCard.Text?.Plain;
        card.FlavourText = externalCard.Text?.Flavour?.String;
        card.ImageUrl = externalCard.Media?.ImageUrl;
        card.Artist = externalCard.Media?.Artist;
        card.AccessibilityText = externalCard.Media?.AccessibilityText;
        card.AlternateArt = externalCard.Metadata?.AlternateArt ?? false;
        card.Overnumbered = externalCard.Metadata?.Overnumbered ?? false;
        card.Signature = externalCard.Metadata?.Signature ?? false;
        card.ExternalUpdatedOn = ParseDateTimeOffset(externalCard.Metadata?.UpdatedOn?.String);
        card.RawApiData = SerializeParsable(externalCard);
        card.UpdatedAt = now;

        if (card.Domains.Count > 0)
        {
            _dbContext.CardDomains.RemoveRange(card.Domains);
            card.Domains.Clear();
        }

        foreach (var domain in domains)
        {
            card.Domains.Add(new CardDomainValue
            {
                CardId = card.Id,
                Card = card,
                Domain = domain,
            });
        }
    }

    private static IReadOnlyCollection<CardDomain> ParseDomains(IEnumerable<string>? values)
    {
        if (values is null)
        {
            return [];
        }

        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(ParseEnum<CardDomain>)
            .Distinct()
            .ToArray();
    }

    private static CardSupertype ParseSupertype(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? CardSupertype.None
            : ParseEnum<CardSupertype>(value);
    }

    private static TEnum ParseEnum<TEnum>(string value)
        where TEnum : struct, Enum
    {
        var normalized = value.Replace(" ", string.Empty, StringComparison.Ordinal);

        if (Enum.TryParse<TEnum>(normalized, ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        throw new InvalidOperationException($"Unsupported {typeof(TEnum).Name} value '{value}'.");
    }

    private static string NormalizeSetCode(string setCode)
    {
        return setCode.Trim().ToUpperInvariant();
    }

    private static string NormalizeRiftboundId(string riftboundId)
    {
        return riftboundId.Trim().ToUpperInvariant();
    }

    private static DateTimeOffset? ParseDateTimeOffset(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateTimeOffset.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsed)
            ? parsed
            : null;
    }

    private static string Require(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Riftcodex response is missing required field '{fieldName}'.");
        }

        return value;
    }

    private static string SerializeParsable<T>(T value)
        where T : IParsable
    {
        var writer = SerializationWriterFactoryRegistry.DefaultInstance.GetSerializationWriter("application/json");
        writer.WriteObjectValue(null, value);

        using var stream = writer.GetSerializedContent();
        using var reader = new StreamReader(stream);

        return reader.ReadToEnd();
    }
}
