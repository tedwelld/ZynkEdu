param(
    [string]$Environment = "Development"
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot

Push-Location $repoRoot
try {
    $env:ASPNETCORE_ENVIRONMENT = $Environment
    $env:DOTNET_ENVIRONMENT = $Environment

    dotnet ef database update --project .\ZynkEdu.Infrastructure\ZynkEdu.Infrastructure.csproj
}
finally {
    Pop-Location
}
