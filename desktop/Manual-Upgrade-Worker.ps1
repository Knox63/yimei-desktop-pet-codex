[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'manual-upgrade-core.ps1')
try{[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'}catch{}
$result=Invoke-YimeiManualUpgrade $root $RunDirectory
$result | ConvertTo-Json -Depth 6 -Compress
if(-not $result.ok){if($result.action -eq 'busy'){exit 2};exit 1}
