param([ValidateSet('2026-10-26','2026-10-26-detail')][string]$WorkName='2026-10-26')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $root 'manual-upgrade-core.ps1')
function Assert-SR([bool]$ok,[string]$message){if(-not $ok){throw $message}}
$work=Join-Path $PSScriptRoot $WorkName
$detail=$WorkName.EndsWith('-detail');$expectedRevision=if($detail){8}else{7}
$runtime=([IO.File]::ReadAllText((Join-Path $work 'candidate-runtime.txt'))).Trim()
$artwork=Join-Path $work 'artwork'
$fingerprint=(Get-FileHash -LiteralPath (Join-Path $artwork 'animation-dense.json')).Hash.ToLowerInvariant()
$fidelity=Read-YimeiManualJson (Join-Path $work 'fidelity-report.json')
$ready=Read-YimeiManualJson (Join-Path $runtime 'ready.json')
$sr=Read-YimeiManualJson (Join-Path $artwork 'super-resolution-report.json')
Assert-YimeiManualPath $root $runtime
Assert-SR ($fidelity.ok -and $fidelity.runtime -eq $runtime -and $fidelity.holdMs -eq 1500 -and $ready.engineRevision -eq $expectedRevision) 'Candidate fidelity not verified'
Assert-SR ($sr.ok -and $sr.visualQA -eq 'pass' -and $sr.frames -eq 144) 'Source artwork not inspected'
$policyPath=Join-Path $root 'update-policy.json';$currentPath=Join-Path $root 'current.json'
$canonical=Join-Path $root 'artwork'
$policy=Read-YimeiManualJson $policyPath
Assert-SR ($policy.runtime -eq $fidelity.originalRuntime) 'Fixed runtime changed; do not replace another user selection'
$expectedSource=if($detail){$sr.detailRefinement.previousManifestSha256}else{$sr.sourceManifestSha256}
Assert-SR ((Get-FileHash -LiteralPath (Join-Path $canonical 'animation-dense.json')).Hash.ToLowerInvariant() -eq $expectedSource) 'Source artwork changed'
$package=Get-YimeiInstalledPackage
Assert-SR ([string]$package.Version -eq $ready.version) 'Official package changed; do not upgrade as part of SR'
$official=$ready.officialApp
$sourceHash=Get-YimeiManualSourceHash $official
$null=Test-YimeiManualCandidate $runtime $ready.version $fingerprint $expectedRevision $sourceHash
$run=Join-Path $work 'publication';New-Item -ItemType Directory -Path $run -Force | Out-Null
$policyHash=(Get-FileHash -LiteralPath $policyPath).Hash;$currentHash=(Get-FileHash -LiteralPath $currentPath).Hash
$startupKey='HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\OpenAI.Codex_2p2nqsd0c76g0\App'
$desktopDirectory=[Environment]::GetFolderPath('Desktop')
$links=@((Join-Path $desktopDirectory 'Codex - 快捷方式.lnk'),(Join-Path $desktopDirectory 'Codex - 新版16帧逸美.lnk'))
function Get-SRMainProcesses {return @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.CommandLine -notmatch '--type='} | Select-Object ProcessId,ExecutablePath,CreationDate)}
$before=[ordered]@{officialHeader=$sourceHash;officialExe=(Get-FileHash -LiteralPath (Join-Path $official 'ChatGPT.exe')).Hash;processes=@(Get-SRMainProcesses);startup=(Get-ItemProperty -LiteralPath $startupKey).State;shortcuts=@($links | ForEach-Object { @{path=$_;hash=(Get-FileHash -LiteralPath $_).Hash} })}
Write-YimeiManualJson (Join-Path $run 'before.json') $before
$mutex=New-Object Threading.Mutex($false,(Get-YimeiManualMutexName $root));$acquired=$false;$oldMoved=$false;$committed=$false
$temp=Join-Path $root ('.artwork-sr-'+[guid]::NewGuid().ToString('N'))
$backup=Join-Path $root ('backups\before-local-sr-'+(Get-Date -Format yyyyMMdd-HHmmss))
$oldArtwork=Join-Path $backup 'artwork'
foreach($path in @($temp,$canonical,$backup,$oldArtwork)){Assert-YimeiManualPath $root $path}
try {
 try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
 Assert-SR $acquired 'Another manual upgrade is running'
 Copy-Item -LiteralPath $artwork -Destination $temp -Recurse
 foreach($file in Get-ChildItem -LiteralPath $artwork -File){Assert-SR ((Get-FileHash -LiteralPath $file.FullName).Hash -eq (Get-FileHash -LiteralPath (Join-Path $temp $file.Name)).Hash) ('Staged artwork mismatch: '+$file.Name)}
 Assert-SR ((Get-FileHash -LiteralPath $policyPath).Hash -eq $policyHash -and (Get-FileHash -LiteralPath $currentPath).Hash -eq $currentHash) 'Configuration changed during staging'
 New-Item -ItemType Directory -Path $backup -Force | Out-Null
 [IO.Directory]::Move($canonical,$oldArtwork);$oldMoved=$true
 [IO.Directory]::Move($temp,$canonical)
 Publish-YimeiManualCandidate $root $runtime $ready $policyHash $currentHash $run
 $committed=$true
}catch{
 if($oldMoved -and -not $committed){
  if(Test-Path -LiteralPath $canonical){[IO.Directory]::Move($canonical,(Join-Path $backup 'unpublished-candidate'))}
  if(Test-Path -LiteralPath $oldArtwork){[IO.Directory]::Move($oldArtwork,$canonical)}
 }
 throw
}finally{
 if(Test-Path -LiteralPath $temp){Assert-YimeiManualPath $root $temp;Assert-SR ((Split-Path -Leaf $temp) -match '^\.artwork-sr-[a-f0-9]{32}$') 'Unsafe temporary path';Remove-Item -LiteralPath $temp -Recurse -Force}
 if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()
}
$after=Read-YimeiManualJson $policyPath
Assert-SR ($after.runtime -eq $runtime -and $after.mode -eq 'fixed' -and -not $after.autoFollowOfficialPackage -and -not $after.backgroundPreparationEnabled -and -not $after.automaticRestartAllowed) 'Fixed publication mismatch'
Assert-SR ((Get-YimeiManualSourceHash $official) -eq $before.officialHeader -and (Get-FileHash -LiteralPath (Join-Path $official 'ChatGPT.exe')).Hash -eq $before.officialExe) 'Official package changed'
Assert-SR ((Get-ItemProperty -LiteralPath $startupKey).State -eq $before.startup -and $before.startup -eq 1) 'Startup must remain disabled'
foreach($link in $before.shortcuts){Assert-SR ((Get-FileHash -LiteralPath $link.path).Hash -eq $link.hash) 'Shortcut changed'}
$now=@(Get-SRMainProcesses)
Assert-SR ($now.Count -eq @($before.processes).Count) 'Codex main process count changed'
foreach($p in $before.processes){Assert-SR (@($now | Where-Object {$_.ProcessId -eq $p.ProcessId -and $_.ExecutablePath -eq $p.ExecutablePath -and ([datetime]$_.CreationDate).ToUniversalTime() -eq ([datetime]$p.CreationDate).ToUniversalTime()}).Count -eq 1) 'Codex process identity changed'}
$report=[ordered]@{ok=$true;at=(Get-Date).ToString('o');runtime=$runtime;engineRevision=$expectedRevision;cellWidth=576;cellHeight=624;actions=8;lookDirections=16;sourceFrames=144;optimizedFrames=$fidelity.optimizedFrames;referenceStatesUnchanged=@($fidelity.referenceStatesUnchanged);localSuperResolution=$true;noGeneratedPoses=$true;originalTimingAndPlayerExact=$fidelity.playerTimingAndFrameOrderByteIdentical;holdMs=1500;officialUnchanged=$true;shortcutsUnchanged=$true;startupDisabled=$true;autoFollowEnabled=$false;codexStarted=$false;codexStopped=$false;processesUnchanged=$now;currentSessionNotRestarted=$true;originalArtworkBackup=$oldArtwork;previousRuntime=$after.previousRuntime;fidelityReport=(Join-Path $work 'fidelity-report.json');preview=(Join-Path $work $(if($detail){'detail-before-after.png'}else{'comparison-all.png'}))}
$reportName=if($detail){'other-motion-detail-installation-report.json'}else{'all-motion-resolution-installation-report.json'}
Write-YimeiManualJson (Join-Path $root $reportName) $report
$report | ConvertTo-Json -Depth 5
