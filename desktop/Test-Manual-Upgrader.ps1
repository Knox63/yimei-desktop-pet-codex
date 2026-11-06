$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'manual-upgrade-core.ps1')
$fixture=Join-Path $root ('manual-test-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path (Join-Path $fixture 'artwork') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'artwork\animation-dense.json') -Destination (Join-Path $fixture 'artwork\animation-dense.json')
$global:ManualProbe=@{version='99.0.0.0';queries=0;builds=0;failBuild=$false;badCandidate=$false;changePolicy=$false;changeSource=$false;sourceChanged=$false;failPolicyWrite=$false;mutex=$null}
$global:OriginalManualJson=(Get-Command Write-YimeiManualJson).ScriptBlock
$global:OriginalManualMutex=(Get-Command Get-YimeiManualMutexName).ScriptBlock
function Write-YimeiManualJson($path,$data,$backupPath){if($global:ManualProbe.failPolicyWrite -and (Split-Path -Leaf $path) -eq 'update-policy.json'){throw 'Simulated policy publication failure'};& $global:OriginalManualJson $path $data $backupPath}
function Get-YimeiManualMutexName($path){if($global:ManualProbe.mutex){return $global:ManualProbe.mutex};& $global:OriginalManualMutex $path}
function Get-YimeiInstalledPackage {$global:ManualProbe.queries++;return [pscustomobject]@{Version=$global:ManualProbe.version;InstallLocation='C:\fake-official'}}
function Get-YimeiManualAdapterInfo($path){return [pscustomobject]@{engineRevision=4}}
function Get-YimeiManualSourceHash($app){if($global:ManualProbe.sourceChanged){return ('b'*64)};return ('a'*64)}
function Test-YimeiRuntime($path){return (Test-Path -LiteralPath (Join-Path $path 'integrity.ok'))}
function Start-Process {throw 'No application may be started by an upgrade test'}
function Stop-Process {throw 'No application may be stopped'}
function Invoke-YimeiLaunch {throw 'Upgrade must not invoke launch'}
function Get-YimeiForeignProcesses {throw 'Upgrade must not inspect or control Codex processes'}
function Start-YimeiBackgroundUpdate {throw 'Upgrade must not enable background following'}
function Assert($condition,$message){if(-not $condition){throw $message}}
$fingerprint=(Get-FileHash -LiteralPath (Join-Path $fixture 'artwork\animation-dense.json')).Hash.ToLowerInvariant()
function Make-Candidate($path,$version){
 New-Item -ItemType Directory -Path $path -Force | Out-Null
 Write-YimeiManualJson (Join-Path $path 'ready.json') ([ordered]@{ok=$true;version=$version;internalVersion=$version;engineRevision=4;artworkFingerprint=$fingerprint;sourceHeaderHash=('a'*64);officialApp='C:\fake-official\app';artworkRevision='approved';started=$false})
 Write-YimeiManualJson (Join-Path $path 'browser-test-report.json') @{ok=$true;version=$version;workingWithHoverAndNativeLook=@{actualVisited=@(0..15)}}
 Write-YimeiManualJson (Join-Path $path 'look-test-report.json') @{ok=$true;version=$version;allDirections=@(0..15);runtime=$path}
 Write-YimeiManualJson (Join-Path $path 'working-test-report.json') @{ok=$true;version=$version;runtime=$path}
 Write-YimeiManualJson (Join-Path $path 'patch-report.json') @{ok=$true;version=$version;app=(Join-Path $path 'app')}
 [IO.File]::WriteAllText((Join-Path $path 'integrity.ok'),'test fixture only')
}
function Invoke-YimeiManualBuild($managerRoot,$app,$version,$stage,$run){
 $global:ManualProbe.builds++;New-Item -ItemType Directory -Path $stage -Force | Out-Null
 if($global:ManualProbe.failBuild){throw 'Simulated unsupported future structure'}
 Make-Candidate $stage $version
 if($global:ManualProbe.badCandidate){Write-YimeiManualJson (Join-Path $stage 'look-test-report.json') @{ok=$true;version=$version;allDirections=@(0..14)}}
 if($global:ManualProbe.changePolicy){$p=Read-YimeiManualJson (Join-Path $managerRoot 'update-policy.json');$p.reason='changed by user during upgrade';Write-YimeiManualJson (Join-Path $managerRoot 'update-policy.json') $p}
 if($global:ManualProbe.changeSource){$global:ManualProbe.sourceChanged=$true}
}
function Remove-YimeiManualStage($managerRoot,$stage,$run){Assert-YimeiManagedPath $managerRoot $stage;Assert ((Split-Path -Leaf $stage) -like '.building-manual-*') 'Unsafe stage cleanup';Remove-Item -LiteralPath $stage -Recurse -Force}
function Run-Case {return (Invoke-YimeiManualUpgrade $fixture (Join-Path $fixture ('manual-updates\case-'+[guid]::NewGuid().ToString('N'))))}
$lockProcess=$null
try {
 $old=Join-Path $fixture ('versions\99.0.0.0-'+$fingerprint.Substring(0,12)+'-r4');Make-Candidate $old '99.0.0.0'
 Write-YimeiManualJson (Join-Path $fixture 'update-policy.json') @{mode='fixed';version='99.0.0.0';runtime=$old;changedAt='initial';reason='test';autoFollowOfficialPackage=$false;backgroundPreparationEnabled=$false;automaticRestartAllowed=$false}
 Write-YimeiManualJson (Join-Path $fixture 'current.json') @{version='99.0.0.0';runtime=$old;autoFollowOfficialPackage=$false}
 $before=(Get-FileHash -LiteralPath (Join-Path $fixture 'update-policy.json')).Hash
 $cached=Run-Case
 Assert ($cached.ok -and $cached.action -eq 'up-to-date' -and $global:ManualProbe.builds -eq 0) 'Current ready version must be reused'
 Assert ((Get-FileHash -LiteralPath (Join-Path $fixture 'update-policy.json')).Hash -eq $before) 'No-op must not rewrite fixed policy'
 $global:ManualProbe.version='99.1.0.0';$built=Run-Case
 Assert ($built.ok -and $built.built -and $built.action -eq 'updated') 'New version must build and publish'
 $p=Read-YimeiManualJson (Join-Path $fixture 'update-policy.json')
 Assert ($p.version -eq '99.1.0.0' -and -not $p.autoFollowOfficialPackage -and -not $p.backgroundPreparationEnabled -and (Test-Path -LiteralPath $old)) 'Publish must stay manual and preserve old runtime'
 $again=Run-Case;Assert ($again.ok -and $global:ManualProbe.builds -eq 1) 'Repeat click must use cache'
 $beforePolicy=[IO.File]::ReadAllText((Join-Path $fixture 'update-policy.json'));$beforeCurrent=[IO.File]::ReadAllText((Join-Path $fixture 'current.json'))
 $global:ManualProbe.version='99.2.0.0';$global:ManualProbe.failBuild=$true;$failed=Run-Case;$global:ManualProbe.failBuild=$false
 Assert (-not $failed.ok -and [IO.File]::ReadAllText((Join-Path $fixture 'update-policy.json')) -eq $beforePolicy) 'Build failure must preserve fixed version'
 $global:ManualProbe.version='99.3.0.0';$global:ManualProbe.badCandidate=$true;$bad=Run-Case;$global:ManualProbe.badCandidate=$false
 Assert (-not $bad.ok -and [IO.File]::ReadAllText((Join-Path $fixture 'update-policy.json')) -eq $beforePolicy) 'Invalid look tests must not publish'
 $global:ManualProbe.version='99.4.0.0';$global:ManualProbe.failPolicyWrite=$true;$rollback=Run-Case;$global:ManualProbe.failPolicyWrite=$false
 Assert (-not $rollback.ok -and [IO.File]::ReadAllText((Join-Path $fixture 'update-policy.json')) -eq $beforePolicy -and [IO.File]::ReadAllText((Join-Path $fixture 'current.json')) -eq $beforeCurrent) 'Policy commit failure must restore current pointer exactly'
 $global:ManualProbe.version='99.5.0.0';$global:ManualProbe.changePolicy=$true;$conflict=Run-Case;$global:ManualProbe.changePolicy=$false
 $p=Read-YimeiManualJson (Join-Path $fixture 'update-policy.json')
 Assert (-not $conflict.ok -and $p.version -eq '99.1.0.0' -and $p.reason -eq 'changed by user during upgrade') 'Concurrent configuration change must be respected'
 $global:ManualProbe.version='99.6.0.0';$global:ManualProbe.changeSource=$true;$changed=Run-Case;$global:ManualProbe.changeSource=$false;$global:ManualProbe.sourceChanged=$false
 Assert (-not $changed.ok -and (Read-YimeiManualJson (Join-Path $fixture 'update-policy.json')).version -eq '99.1.0.0') 'Changing official source must not publish'
 $global:ManualProbe.version='99.7.0.0';$badCache=Join-Path $fixture ('versions\99.7.0.0-'+$fingerprint.Substring(0,12)+'-r4');Make-Candidate $badCache '99.7.0.0';[IO.File]::Delete((Join-Path $badCache 'integrity.ok'))
 $repaired=Run-Case
 Assert ($repaired.ok -and $repaired.runtime -ne $badCache -and (Test-Path -LiteralPath $badCache)) 'Invalid existing cache must never be overwritten'
 $global:ManualProbe.version='99.0.0.0';$downgrade=Run-Case;Assert (-not $downgrade.ok) 'Do not automatically downgrade'
 $global:ManualProbe.mutex='Local\Yimei-Test-'+[guid]::NewGuid().ToString('N')
 $holder=Join-Path $fixture 'hold-lock.ps1';$signal=Join-Path $fixture 'lock-ready'
 [IO.File]::WriteAllText($holder,'param($Name,$Signal); $m=New-Object Threading.Mutex($false,$Name); $null=$m.WaitOne(); [IO.File]::WriteAllText($Signal,"ready"); Start-Sleep -Seconds 3; $m.ReleaseMutex(); $m.Dispose()')
 $info=New-Object Diagnostics.ProcessStartInfo;$info.FileName='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $info.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$holder+'" -Name "'+$global:ManualProbe.mutex+'" -Signal "'+$signal+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $lockProcess=New-Object Diagnostics.Process;$lockProcess.StartInfo=$info;$null=$lockProcess.Start()
 $deadline=[DateTime]::UtcNow.AddSeconds(4);while(-not (Test-Path -LiteralPath $signal)){if([DateTime]::UtcNow -ge $deadline){throw 'Lock holder failed'};Start-Sleep -Milliseconds 50}
 $queries=$global:ManualProbe.queries;$busy=Run-Case
 Assert ($busy.action -eq 'busy' -and $global:ManualProbe.queries -eq $queries) 'Concurrent click must not discover or build'
 $null=$lockProcess.WaitForExit(5000)
 Assert (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'versions') -Directory -Filter '.building-manual-*').Count -eq 0) 'Failed stages must be cleaned'
 $source=Get-Content -LiteralPath (Join-Path $root 'manual-upgrade-core.ps1') -Raw
 if($source -match 'Stop-Process|RmShutdown|Invoke-YimeiLaunch|Get-YimeiForeignProcesses|Start-YimeiBackgroundUpdate'){throw 'Upgrade core must not contain application lifecycle control'}
 $report=[ordered]@{ok=$true;cacheHit=$true;newVersionBuildAndPublish=$true;failurePreservesOld=$true;invalidCandidateRejected=$true;atomicPolicyFailureRollback=$true;configurationConflictPreserved=$true;changingOfficialSourceRejected=$true;invalidCacheNotOverwritten=$true;downgradeBlocked=$true;duplicateClickLock=$true;temporaryStagesCleaned=$true;autoFollowRemainsDisabled=$true;realCodexStarted=$false;realCodexStopped=$false;test='Actual manual coordinator, atomic file publication and cross-process mutex; package/builder/integrity boundaries mocked'}
 Write-YimeiManualJson (Join-Path $root 'manual-upgrader-unit-test-report.json') $report
 $report | ConvertTo-Json -Depth 5
}finally{
 if($lockProcess){$null=$lockProcess.WaitForExit(5000);$lockProcess.Dispose()}
 $expected=[IO.Path]::GetFullPath($root).TrimEnd('\')+'\manual-test-'
 if(-not ([IO.Path]::GetFullPath($fixture)).StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe fixture cleanup'}
 if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
