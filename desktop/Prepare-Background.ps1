[CmdletBinding()]
param([ValidateRange(0,120)][int]$DelaySeconds=15)
$ErrorActionPreference='Stop'
$managerRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$mutex=$null;$acquired=$false
try {
 . (Join-Path $managerRoot 'launcher-core.ps1')
 if(-not (Test-YimeiAutoFollow $managerRoot)){exit 0}
 try{[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'}catch{}
 $mutex=New-Object Threading.Mutex($false,('Local\Codex-Yimei-Background-'+(Get-FileHash -LiteralPath (Join-Path $managerRoot 'engine.mjs')).Hash.Substring(0,16)))
 try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
 if(-not $acquired){exit 0}
 if($DelaySeconds){Start-Sleep -Seconds $DelaySeconds}
 if(-not (Test-YimeiAutoFollow $managerRoot)){exit 0}
 $resolved=Resolve-YimeiRuntime $managerRoot -Interactive:$false
 [ordered]@{ok=$true;at=(Get-Date).ToString('o');version=$resolved.version;built=$resolved.built;runtime=$resolved.runtime;availableOnNextLaunch=$true;codexStarted=$false;codexStopped=$false;codexRestarted=$false;progressWindowShown=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $managerRoot 'background-update-result.json') -Encoding UTF8
}catch{
 [ordered]@{ok=$false;at=(Get-Date).ToString('o');error=($_ | Out-String);currentRuntimeRetained=$true;codexStarted=$false;codexStopped=$false;codexRestarted=$false;progressWindowShown=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $managerRoot 'background-update-result.json') -Encoding UTF8
 exit 1
}finally{if($acquired){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}}
