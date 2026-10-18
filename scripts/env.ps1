$envFile = Join-Path $PSScriptRoot '..\.env'
if (!(Test-Path -LiteralPath $envFile)) { throw 'Copy .env.example to .env and configure it first.' }
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
