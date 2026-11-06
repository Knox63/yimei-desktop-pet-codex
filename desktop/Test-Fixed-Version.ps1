[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'launcher-core.ps1')
$policy=Get-Content -LiteralPath (Join-Path $root 'update-policy.json') -Raw | ConvertFrom-Json
if(Test-YimeiAutoFollow $root){throw 'Automatic following must be disabled'}
$originalBackground=(Get-Command Start-YimeiBackgroundUpdate).ScriptBlock
$global:YimeiFixedProbe=@{starts=0;stops=0;backgrounds=0;foreign=$false;path=$null;style=$null}
function Get-YimeiInstalledPackage {throw 'Fixed mode must not query official packages'}
function Invoke-YimeiBuild {throw 'Fixed mode must not build'}
function Get-YimeiForeignProcesses($exe){if($global:YimeiFixedProbe.foreign){return @([pscustomobject]@{ProcessId=123;ExecutablePath='C:\fake-official\ChatGPT.exe'})};return @()}
function Stop-YimeiConflictingInstances($managerRoot,$appExe,$foreign){$global:YimeiFixedProbe.stops++;$global:YimeiFixedProbe.foreign=$false}
function Start-Process {param($FilePath,$WorkingDirectory,$WindowStyle);$global:YimeiFixedProbe.starts++;$global:YimeiFixedProbe.path=$FilePath;$global:YimeiFixedProbe.style=$WindowStyle}
function Start-YimeiBackgroundUpdate($managerRoot){$global:YimeiFixedProbe.backgrounds++;throw 'Fixed launch must not dispatch a worker'}
foreach($verify in @($false,$true)){
 $resolved=Resolve-YimeiRuntime $root -VerifyOnly:$verify
 if($resolved.runtime -ne $policy.runtime -or -not $resolved.verified){throw 'Explicit prepare/verify must stay pinned'}
}
$launched=Invoke-YimeiLaunch $root
if($launched.runtime -ne $policy.runtime -or $launched.updateMode -ne 'disabled-fixed-version' -or $global:YimeiFixedProbe.starts -ne 1 -or $global:YimeiFixedProbe.style -ne 'Normal'){throw 'Fixed launch route failed'}
& $originalBackground $root
if($global:YimeiFixedProbe.starts -ne 1 -or $global:YimeiFixedProbe.backgrounds -ne 0){throw 'Direct background entry was not disabled'}
$global:YimeiFixedProbe.foreign=$true
$switch=Invoke-YimeiLaunch $root -ConfirmedSwitch
if($global:YimeiFixedProbe.starts -ne 1 -or $global:YimeiFixedProbe.stops -ne 0 -or $switch.restartPerformed -or $switch.action -ne 'other-instance-running'){throw 'Other Codex must be preserved, even with legacy ConfirmedSwitch'}
# Real worker invocation, but never Codex. A 120 s delay must be skipped in fixed mode.
$psi=New-Object Diagnostics.ProcessStartInfo
$psi.FileName='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$psi.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $root 'Prepare-Background.ps1')+'" -DelaySeconds 120'
$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
$worker=New-Object Diagnostics.Process;$worker.StartInfo=$psi
$timer=[Diagnostics.Stopwatch]::StartNew()
try {
 if(-not $worker.Start()){throw 'Could not start worker exit test'}
 if(-not $worker.WaitForExit(5000)){$worker.Kill();throw 'Disabled worker did not exit immediately'}
 if($worker.ExitCode -ne 0){throw 'Disabled worker failed'}
}finally{$timer.Stop();$worker.Dispose()}
$report=[ordered]@{ok=$true;version=$resolved.version;runtime=$resolved.runtime;actualPinnedIntegrityVerified=$true;officialPackageQueryForbidden=$true;buildForbidden=$true;backgroundDispatches=$global:YimeiFixedProbe.backgrounds;directWorkerDispatchDisabled=$true;realDisabledWorkerExitMs=[Math]::Round($timer.Elapsed.TotalMilliseconds);otherCodexPreserved=$true;legacyConfirmedSwitchCannotCloseOtherCodex=$true;mainWindowStyle=$global:YimeiFixedProbe.style;realCodexStarted=$false;realCodexStopped=$false}
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'fixed-version-test-report.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 4
