param(
  [string]$Destination = $env:BELACICLO_BACKUP_DIR
)
$ErrorActionPreference = "Stop"
if (-not $env:DATABASE_URL) { throw "Defina DATABASE_URL no ambiente." }
if (-not $Destination) { throw "Defina BELACICLO_BACKUP_DIR para uma pasta de backup protegida." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "Instale os utilitários oficiais do PostgreSQL (pg_dump)." }
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $Destination "belaciclo-$stamp.dump"
pg_dump --no-password --format=custom --file=$target --dbname=$env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue; throw "pg_dump falhou; nenhum backup válido foi confirmado." }
Get-ChildItem -LiteralPath $Destination -Filter "belaciclo-*.dump" -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
Write-Output "Backup criado: $target"
