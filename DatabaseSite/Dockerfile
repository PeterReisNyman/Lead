FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["DatabaseSite.csproj", "."]
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore "DatabaseSite.csproj"
COPY . .
RUN dotnet build "DatabaseSite.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "DatabaseSite.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "DatabaseSite.dll"]