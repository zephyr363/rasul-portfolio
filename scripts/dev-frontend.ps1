. (Join-Path $PSScriptRoot 'env.ps1')
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
if (Test-Path -LiteralPath (Join-Path $bundledNode 'node.exe')) { $env:PATH = "$bundledNode;$env:PATH" }
Push-Location (Join-Path $PSScriptRoot '..\frontend')
try { npm run dev } finally { Pop-Location }
