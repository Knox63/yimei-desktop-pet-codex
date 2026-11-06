$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'launcher-core.ps1')
function Get-YimeiForeignProcesses($exe){return @([pscustomobject]@{ProcessId=123;ExecutablePath='C:\fake-official\ChatGPT.exe'})}
function Start-Process {throw 'Must not launch while another Codex is running'}
function Initialize-YimeiRestartManager {throw 'Restart Manager must not be called'}
function Stop-Process {throw 'Other processes must not be killed'}
$result=Invoke-YimeiLaunch $root -ConfirmedSwitch
if($result.action -ne 'other-instance-running' -or $result.restartPerformed){throw 'Official protection bypassed'}
$denied=$false
try{Stop-YimeiConflictingInstances $root 'C:\fake\ChatGPT.exe' @()}catch{if($_.Exception.Message -match 'switching was removed'){$denied=$true}else{throw}}
if(-not $denied){throw 'Legacy switch function bypassed protection'}
$core=Get-Content -LiteralPath (Join-Path $root 'launcher-core.ps1') -Raw
if($core -match 'RmShutdown|RequestExit|Stop-Process|Add-Type -TypeDefinition'){throw 'Process termination code must be removed'}
[ordered]@{ok=$true;oldSwitchAuthorizationRevoked=$true;confirmedSwitchCannotBypassProtection=$true;legacyExitFunctionDenied=$true;conflictingProfileLaunchBlocked=$true;processTerminationCodeRemoved=$true;realCodexStarted=$false;realCodexStopped=$false;isolationStatus='not enabled; user requested only removing automatic closing'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'official-protection-test-report.json') -Encoding UTF8
Get-Content -LiteralPath (Join-Path $root 'official-protection-test-report.json')
