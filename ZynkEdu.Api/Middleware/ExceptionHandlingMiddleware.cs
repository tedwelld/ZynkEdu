using Microsoft.AspNetCore.Mvc;

namespace ZynkEdu.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await WriteProblemDetailsAsync(context, ex);
        }
    }

    private static Task WriteProblemDetailsAsync(HttpContext context, Exception ex)
    {
        var statusCode = ex switch
        {
            UnauthorizedAccessException => StatusCodes.Status403Forbidden,
            InvalidOperationException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = statusCode == StatusCodes.Status500InternalServerError ? "An unexpected error occurred." : ex.Message,
            Detail = statusCode == StatusCodes.Status500InternalServerError ? null : ex.Message
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        return context.Response.WriteAsJsonAsync(problem);
    }
}
