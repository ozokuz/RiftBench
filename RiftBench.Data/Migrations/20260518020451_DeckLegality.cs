using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RiftBench.Data.Migrations
{
    /// <inheritdoc />
    public partial class DeckLegality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_legal",
                table: "decks",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_legal",
                table: "decks");
        }
    }
}
