namespace RiftBench.API.Services;

public enum ServiceResultStatus
{
    Ok,
    Created,
    NoContent,
    BadRequest,
    NotFound,
    Conflict
}

public sealed record ServiceResult<T>(
    ServiceResultStatus Status,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? Errors = null,
    string? Message = null)
{
    public static ServiceResult<T> Ok(T value) => new(ServiceResultStatus.Ok, value);

    public static ServiceResult<T> Created(T value) => new(ServiceResultStatus.Created, value);

    public static ServiceResult<T> BadRequest(
        IReadOnlyDictionary<string, string[]> errors) =>
        new(ServiceResultStatus.BadRequest, default, errors);

    public static ServiceResult<T> NotFound() => new(ServiceResultStatus.NotFound);

    public static ServiceResult<T> Conflict(string message) =>
        new(ServiceResultStatus.Conflict, default, null, message);
}

public sealed record ServiceResult(
    ServiceResultStatus Status,
    IReadOnlyDictionary<string, string[]>? Errors = null,
    string? Message = null)
{
    public static ServiceResult NoContent() => new(ServiceResultStatus.NoContent);

    public static ServiceResult BadRequest(
        IReadOnlyDictionary<string, string[]> errors) =>
        new(ServiceResultStatus.BadRequest, errors);

    public static ServiceResult NotFound() => new(ServiceResultStatus.NotFound);

    public static ServiceResult Conflict(string message) =>
        new(ServiceResultStatus.Conflict, null, message);
}
