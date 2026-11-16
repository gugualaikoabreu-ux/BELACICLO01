param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
if (-not $env:DATABASE_URL_RESTORE_TEST) { throw "Defina DATABASE_URL_RESTORE_TEST para um banco descartável de teste." }
if (-not $env:RESTORE_CONFIRM -or $env:RESTORE_CONFIRM -cne "RESTORE_TO_TEST_DATABASE") { throw "Para autorizar a restauração destrutiva no banco de teste, defina RESTORE_CONFIRM=RESTORE_TO_TEST_DATABASE." }
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw "Arquivo de backup não encontrado." }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "Instale os utilitários oficiais do PostgreSQL (pg_restore)." }
pg_restore --no-password --clean --if-exists --no-owner --dbname=$env:DATABASE_URL_RESTORE_TEST $BackupFile
if ($LASTEXITCODE -ne 0) { throw "Restauração de teste falhou." }
Write-Output "Restauração concluída apenas no banco de teste configurado. Execute verificações de integridade antes de aprovar o backup."
