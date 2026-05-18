using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using RiftBench.Data.Entities;
using RiftBench.Data.Entities.App;
using RiftBench.Data.Entities.Cards;

namespace RiftBench.Data;

public class AppDbContext(DbContextOptions options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<CardSet> CardSets => Set<CardSet>();
    public DbSet<Card> Cards => Set<Card>();
    public DbSet<CardDomainValue> CardDomains => Set<CardDomainValue>();

    public DbSet<DeckFolder> DeckFolders => Set<DeckFolder>();
    public DbSet<Deck> Decks => Set<Deck>();
    public DbSet<DeckCategory> DeckCategories => Set<DeckCategory>();
    public DbSet<DeckCard> DeckCards => Set<DeckCard>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        ConfigureCardSets(builder);
        ConfigureCards(builder);
        ConfigureCardDomains(builder);

        ConfigureDeckFolders(builder);
        ConfigureDecks(builder);
        ConfigureDeckCategories(builder);
        ConfigureDeckCards(builder);
    }

    private static void ConfigureCardSets(ModelBuilder builder)
    {
        builder.Entity<CardSet>(entity =>
        {
            entity.ToTable("card_sets");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.RiftCodexId)
                .HasColumnName("riftcodex_id")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.SetId)
                .HasColumnName("set_id")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.CardCount)
                .HasColumnName("card_count");

            entity.Property(x => x.PublishedOn)
                .HasColumnName("published_on");

            entity.Property(x => x.TcgPlayerId)
                .HasColumnName("tcgplayer_id")
                .HasMaxLength(128);

            entity.Property(x => x.RawApiData)
                .HasColumnName("raw_api_data")
                .HasColumnType("jsonb")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at");

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at");

            entity.HasIndex(x => x.RiftCodexId)
                .IsUnique();

            entity.HasIndex(x => x.SetId)
                .IsUnique();
        });
    }

    private static void ConfigureCards(ModelBuilder builder)
    {
        builder.Entity<Card>(entity =>
        {
            entity.ToTable("cards");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.RiftCodexId)
                .HasColumnName("riftcodex_id")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.RiftboundId)
                .HasColumnName("riftbound_id")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.RiftboundIdNormalized)
                .HasColumnName("riftbound_id_normalized")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.TcgPlayerId)
                .HasColumnName("tcgplayer_id")
                .HasMaxLength(128);

            entity.Property(x => x.CardSetId)
                .HasColumnName("card_set_id");

            entity.Property(x => x.SetCode)
                .HasColumnName("set_code")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.SetLabel)
                .HasColumnName("set_label")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.CleanName)
                .HasColumnName("clean_name")
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.CollectorNumber)
                .HasColumnName("collector_number");

            entity.Property(x => x.Type)
                .HasColumnName("type")
                .HasConversion<string>()
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Supertype)
                .HasColumnName("supertype")
                .HasConversion<string>()
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Rarity)
                .HasColumnName("rarity")
                .HasConversion<string>()
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Energy)
                .HasColumnName("energy");

            entity.Property(x => x.Might)
                .HasColumnName("might");

            entity.Property(x => x.Power)
                .HasColumnName("power");

            entity.Property(x => x.RichText)
                .HasColumnName("rich_text");

            entity.Property(x => x.PlainText)
                .HasColumnName("plain_text");

            entity.Property(x => x.FlavourText)
                .HasColumnName("flavour_text");

            entity.Property(x => x.ImageUrl)
                .HasColumnName("image_url")
                .HasMaxLength(2048);

            entity.Property(x => x.Artist)
                .HasColumnName("artist")
                .HasMaxLength(256);

            entity.Property(x => x.AccessibilityText)
                .HasColumnName("accessibility_text");

            entity.Property(x => x.AlternateArt)
                .HasColumnName("alternate_art");

            entity.Property(x => x.Overnumbered)
                .HasColumnName("overnumbered");

            entity.Property(x => x.Signature)
                .HasColumnName("signature");

            entity.Property(x => x.ExternalUpdatedOn)
                .HasColumnName("external_updated_on");

            entity.Property(x => x.RawApiData)
                .HasColumnName("raw_api_data")
                .HasColumnType("jsonb")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at");

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at");

            entity.HasOne(x => x.CardSet)
                .WithMany(x => x.Cards)
                .HasForeignKey(x => x.CardSetId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => x.RiftCodexId)
                .IsUnique();

            entity.HasIndex(x => x.RiftboundId);

            entity.HasIndex(x => x.RiftboundIdNormalized);

            entity.HasIndex(x => x.SetCode);

            entity.HasIndex(x => new { x.SetCode, x.CollectorNumber });

            entity.HasIndex(x => x.Type);

            entity.HasIndex(x => x.Supertype);

            entity.HasIndex(x => x.Rarity);

            entity.HasIndex(x => x.Energy);

            entity.HasIndex(x => x.Might);

            entity.HasIndex(x => x.Power);

            entity.HasIndex(x => x.Artist);

            entity.HasIndex(x => x.Name)
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops");

            entity.HasIndex(x => x.CleanName)
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops");

            entity
                .HasGeneratedTsVectorColumn(
                    x => x.SearchVector,
                    "simple",
                    x => new
                    {
                        x.Name,
                        x.CleanName,
                    })
                .HasIndex(x => x.SearchVector)
                .HasMethod("gin");
        });
    }

    private static void ConfigureCardDomains(ModelBuilder builder)
    {
        builder.Entity<CardDomainValue>(entity =>
        {
            entity.ToTable("card_domains");

            entity.HasKey(x => new { x.CardId, x.Domain });

            entity.Property(x => x.CardId)
                .HasColumnName("card_id");

            entity.Property(x => x.Domain)
                .HasColumnName("domain")
                .HasConversion<string>()
                .HasMaxLength(64)
                .IsRequired();

            entity.HasOne(x => x.Card)
                .WithMany(x => x.Domains)
                .HasForeignKey(x => x.CardId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.Domain);
        });
    }

    private static void ConfigureDeckFolders(ModelBuilder builder)
    {
        builder.Entity<DeckFolder>(entity =>
        {
            entity.ToTable("deck_folders");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.ParentFolderId)
                .HasColumnName("parent_folder_id");

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.SortOrder)
                .HasColumnName("sort_order");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at");

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at");

            entity.HasOne(x => x.User)
                .WithMany(x => x.DeckFolders)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.ParentFolder)
                .WithMany(x => x.Children)
                .HasForeignKey(x => x.ParentFolderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.UserId, x.ParentFolderId });
        });
    }

    private static void ConfigureDecks(ModelBuilder builder)
    {
        builder.Entity<Deck>(entity =>
        {
            entity.ToTable("decks");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.FolderId)
                .HasColumnName("folder_id");

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasColumnName("description");
            
            entity.Property(x => x.Visibility)
                .HasColumnName("visibility")
                .HasConversion<string>()
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.IsArchived)
                .HasColumnName("is_archived");

            entity.Property(x => x.IsLegal)
                .HasColumnName("is_legal");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at");

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at");

            entity.HasOne(x => x.User)
                .WithMany(x => x.Decks)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Folder)
                .WithMany(x => x.Decks)
                .HasForeignKey(x => x.FolderId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => new { x.UserId, x.FolderId });

            entity.HasIndex(x => new { x.UserId, x.IsArchived });
        });
    }

    private static void ConfigureDeckCategories(ModelBuilder builder)
    {
        builder.Entity<DeckCategory>(entity =>
        {
            entity.ToTable("deck_categories");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.DeckId)
                .HasColumnName("deck_id");

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.SortOrder)
                .HasColumnName("sort_order");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at");

            entity.HasOne(x => x.Deck)
                .WithMany(x => x.Categories)
                .HasForeignKey(x => x.DeckId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.DeckId, x.SortOrder });
        });
    }

    private static void ConfigureDeckCards(ModelBuilder builder)
    {
        builder.Entity<DeckCard>(entity =>
        {
            entity.ToTable("deck_cards");

            entity.HasKey(x => new { x.DeckId, x.CardId });

            entity.Property(x => x.DeckId)
                .HasColumnName("deck_id");

            entity.Property(x => x.CardId)
                .HasColumnName("card_id");

            entity.Property(x => x.CategoryId)
                .HasColumnName("category_id");

            entity.Property(x => x.Quantity)
                .HasColumnName("quantity");

            entity.Property(x => x.SortOrder)
                .HasColumnName("sort_order");

            entity.Property(x => x.Notes)
                .HasColumnName("notes");

            entity.HasOne(x => x.Deck)
                .WithMany(x => x.Cards)
                .HasForeignKey(x => x.DeckId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Card)
                .WithMany(x => x.DeckCards)
                .HasForeignKey(x => x.CardId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Cards)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasCheckConstraint("ck_deck_cards_quantity_positive", "quantity > 0");

            entity.HasIndex(x => x.DeckId);

            entity.HasIndex(x => x.CategoryId);
        });
    }
}
