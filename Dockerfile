# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the .NET API
# ──────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-api
WORKDIR /src

# Copy project files first so layer cache benefits from unchanged dependencies
COPY ZynkEdu.Domain/ZynkEdu.Domain.csproj          ZynkEdu.Domain/
COPY ZynkEdu.Application/ZynkEdu.Application.csproj ZynkEdu.Application/
COPY ZynkEdu.Infrastructure/ZynkEdu.Infrastructure.csproj ZynkEdu.Infrastructure/
COPY ZynkEdu.Api/ZynkEdu.Api.csproj                 ZynkEdu.Api/
COPY ZynkEdu.slnx .

RUN dotnet restore ZynkEdu.Api/ZynkEdu.Api.csproj

COPY ZynkEdu.Domain/      ZynkEdu.Domain/
COPY ZynkEdu.Application/ ZynkEdu.Application/
COPY ZynkEdu.Infrastructure/ ZynkEdu.Infrastructure/
COPY ZynkEdu.Api/         ZynkEdu.Api/

RUN dotnet publish ZynkEdu.Api/ZynkEdu.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/api

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Build the Angular SPA
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build-spa
WORKDIR /spa

COPY ZynkEdu.Web/package.json ZynkEdu.Web/package-lock.json ./
RUN npm ci

COPY ZynkEdu.Web/ .
RUN npx ng build --configuration production

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3 — Runtime image
# ──────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy the published API
COPY --from=build-api /app/api .

# Serve the Angular SPA as static files from wwwroot
COPY --from=build-spa /spa/dist/sakai-ng/browser ./wwwroot

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

ENTRYPOINT ["dotnet", "ZynkEdu.Api.dll"]
