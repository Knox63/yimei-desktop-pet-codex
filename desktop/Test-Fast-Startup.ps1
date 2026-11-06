[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$timer=[Diagnostics.Stopwatch]::StartNew()
. (Join-Path $root 'launcher-core.ps1')
$global:YimeiFastProbe=@{launches=0;backgrounds=0;windowStyle=$null;path=$null;events=@()}
function Get-YimeiInstalledPackage {throw 'Appx lookup is forbidden on the interactive startup path'}
function Invoke-YimeiBuild {throw 'Build is forbidden on the interactive startup path'}
function Get-YimeiForeignProcesses($exe){return @()}
function Stop-YimeiConflictingInstances {throw 'The test must not close any process'}
function Start-Process {param($FilePath,$WorkingDirectory,$WindowStyle);$global:YimeiFastProbe.launches++;$global:YimeiFastProbe.windowStyle=$WindowStyle;$global:YimeiFastProbe.path=$FilePath;$global:YimeiFastProbe.events+='app-start'}
function Start-YimeiBackgroundUpdate($managerRoot){$global:YimeiFastProbe.backgrounds++;$global:YimeiFastProbe.events+='background-request'}
$result=Invoke-YimeiLaunch $root
$timer.Stop()
if($result.action -ne 'launched' -or $global:YimeiFastProbe.launches -ne 1 -or $global:YimeiFastProbe.windowStyle -ne 'Normal' -or $global:YimeiFastProbe.events[0] -ne 'app-start'){throw 'Fast launch routing failed'}
$source=Get-Content -LiteralPath (Join-Path $root 'launcher-core.ps1') -Raw
if($source -match '正在适配新版逸美|Windows\.Forms\.Form|ProgressBar'){throw 'The unwanted progress window is still present'}
$worker=Get-Content -LiteralPath (Join-Path $root 'Prepare-Background.ps1') -Raw
if($worker -match 'Invoke-YimeiLaunch|Stop-YimeiConflictingInstances|Start-Process'){throw 'Background worker must not stop or launch Codex'}
$fixture=Join-Path $root ('integrity-fixture-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$invalidRejected=$false
try {
 New-Item -ItemType Directory -Path (Join-Path $fixture 'app\resources') -Force | Out-Null
 foreach($name in @('ready.json','patch-report.json','browser-test-report.json','behavior-test-report.json')){Copy-Item -LiteralPath (Join-Path $result.runtime $name) -Destination (Join-Path $fixture $name)}
 $bad=New-Object byte[] 17;[BitConverter]::GetBytes([uint32]1).CopyTo($bad,12)
 [IO.File]::WriteAllBytes((Join-Path $fixture 'app\resources\app.asar'),$bad)
 [IO.File]::WriteAllBytes((Join-Path $fixture 'app\ChatGPT.exe'),[byte[]]@(0))
 try{Test-YimeiRuntime $fixture | Out-Null}catch{$invalidRejected=$true}
 if(-not $invalidRejected){throw 'Invalid archive must be rejected'}
}finally{
 $expected=[IO.Path]::GetFullPath($root).TrimEnd('\')+'\integrity-fixture-'
 if(-not ([IO.Path]::GetFullPath($fixture)).StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe fixture cleanup'}
 if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
$report=[ordered]@{ok=$true;version=$result.version;runtime=$result.runtime;actualReadyIntegrityVerified=$true;invalidArchiveRejected=$invalidRejected;startupDispatchMs=[Math]::Round($timer.Elapsed.TotalMilliseconds);timingScope='PowerShell core import + actual ready artifact validation + dispatch routing; not Codex window initialization';noBlockingAppxLookup=$true;noBlockingBuildOrPlaybackTests=$true;noProgressDialogCode=$true;backgroundOnlyPreparesForNextLaunch=$true;mainWindowStyle=$global:YimeiFastProbe.windowStyle;realCodexStarted=$false;realCodexStopped=$false}
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'fast-start-test-report.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 4
