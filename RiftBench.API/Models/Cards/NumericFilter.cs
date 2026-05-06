using System.Globalization;
using System.Text.RegularExpressions;

namespace RiftBench.API.Models.Cards;

public enum NumericFilterOperator
{
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Between
}

public sealed record NumericFilter(
    NumericFilterOperator Operator,
    int Value,
    int? SecondValue = null
);

public static class NumericFilterParser
{
    private static readonly Regex BetweenRegex = new(
        @"^\s*(\d+)\s*-\s*(\d+)\s*$",
        RegexOptions.Compiled);

    private static readonly Regex ComparatorRegex = new(
        @"^\s*(<=|>=|<|>|=)?\s*(\d+)\s*$",
        RegexOptions.Compiled);

    public static NumericFilter? Parse(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        var betweenMatch = BetweenRegex.Match(input);
        if (betweenMatch.Success)
        {
            var first = int.Parse(betweenMatch.Groups[1].Value, CultureInfo.InvariantCulture);
            var second = int.Parse(betweenMatch.Groups[2].Value, CultureInfo.InvariantCulture);

            var min = Math.Min(first, second);
            var max = Math.Max(first, second);

            return new NumericFilter(NumericFilterOperator.Between, min, max);
        }

        var comparatorMatch = ComparatorRegex.Match(input);
        if (!comparatorMatch.Success)
            return null;

        var op = comparatorMatch.Groups[1].Value;
        var value = int.Parse(comparatorMatch.Groups[2].Value, CultureInfo.InvariantCulture);

        return op switch
        {
            ">" => new NumericFilter(NumericFilterOperator.GreaterThan, value),
            ">=" => new NumericFilter(NumericFilterOperator.GreaterThanOrEqual, value),
            "<" => new NumericFilter(NumericFilterOperator.LessThan, value),
            "<=" => new NumericFilter(NumericFilterOperator.LessThanOrEqual, value),
            "=" or "" => new NumericFilter(NumericFilterOperator.Equal, value),
            _ => null
        };
    }
}