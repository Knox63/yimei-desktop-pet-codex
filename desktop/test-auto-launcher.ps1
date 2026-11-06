# Compatibility test entry. Automatic-follow/switch contracts are retired.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $root 'Test-Fixed-Version.ps1')
& (Join-Path $root 'Test-Official-Protection.ps1')
[ordered]@{ok=$true;mode='fixed-no-process-switch';automaticOfficialFollowing=$false;automaticProcessClosing=$false;realCodexStarted=$false;realCodexStopped=$false;tests=@('Test-Fixed-Version.ps1','Test-Official-Protection.ps1')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'auto-launcher-test-report.json') -Encoding UTF8