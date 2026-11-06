$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'launcher-core.ps1')

function Read-YimeiManualJson($path){return ([IO.File]::ReadAllText($path,[Text.Encoding]::UTF8) | ConvertFrom-Json)}
function Assert-YimeiManualPath($root,$path) {
 $base=[IO.Path]::GetFullPath($root).TrimEnd('\')+'\'
 $full=[IO.Path]::GetFullPath($path)
 if(-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'Manual upgrade path is outside its workspace'}
 $parent=$full
 while($parent -and $parent.Length -ge $base.Length){
  if((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Manual upgrade path contains a directory link'}
  $parent=[IO.Path]::GetDirectoryName($parent)
 }
}
function Write-YimeiManualBytes($path,[byte[]]$bytes,$backupPath) {
 $temp=$path+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
 $temporaryBackup=-not $backupPath
 if($temporaryBackup){$backupPath=$temp+'.previous'}
 try {
  [IO.File]::WriteAllBytes($temp,$bytes)
  if(Test-Path -LiteralPath $path){[IO.File]::Replace($temp,$path,$backupPath)}else{[IO.File]::Move($temp,$path)}
 }finally{
  if(Test-Path -LiteralPath $temp){[IO.File]::Delete($temp)}
  if($temporaryBackup -and (Test-Path -LiteralPath $backupPath)){[IO.File]::Delete($backupPath)}
 }
}
function Write-YimeiManualJson($path,$data,$backupPath) {
 $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes(($data | ConvertTo-Json -Depth 12))
 Write-YimeiManualBytes $path $bytes $backupPath
}
function Set-YimeiManualStatus($run,$state,$phase,$message) {
 Write-YimeiManualJson (Join-Path $run 'status.json') ([ordered]@{state=$state;phase=$phase;message=$message;at=(Get-Date).ToString('o');log=(Join-Path $run 'upgrade.log')})
 Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value ((Get-Date).ToString('HH:mm:ss')+' '+$message) -Encoding UTF8
}
function Get-YimeiManualMutexName($root) {
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($root).ToLowerInvariant())))).Replace('-','')}finally{$sha.Dispose()}
 return 'Local\Codex-Yimei-Manual-'+$key.Substring(0,20)
}
function Get-YimeiManualAdapterInfo($root) {
 $output=& (Join-Path $root 'tools\node.exe') (Join-Path $root 'engine.mjs') info
 if($LASTEXITCODE -ne 0){throw '无法读取适配器版本'}
 return ($output | Out-String | ConvertFrom-Json)
}
function Get-YimeiManualSourceHash($app) {
 $stream=[IO.File]::OpenRead((Join-Path $app 'resources\app.asar'))
 try {
  $prefix=New-Object byte[] 16
  if($stream.Read($prefix,0,16) -ne 16){throw 'Invalid official archive prefix'}
  $length=[BitConverter]::ToUInt32($prefix,12)
  if($length -eq 0 -or $length -gt 64MB){throw 'Invalid official archive header'}
  $bytes=New-Object byte[] $length;$read=0
  while($read -lt $length){$n=$stream.Read($bytes,$read,$length-$read);if($n -eq 0){throw 'Incomplete official archive header'};$read+=$n}
  $sha=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 }finally{$stream.Dispose()}
}
function Test-YimeiManualCandidate($runtime,$version,$fingerprint,$revision,$sourceHash) {
 $ready=Read-YimeiManualJson (Join-Path $runtime 'ready.json')
 if(-not $ready.ok -or $ready.version -ne $version -or $ready.engineRevision -ne $revision -or $ready.artworkFingerprint -ne $fingerprint -or $ready.sourceHeaderHash -ne $sourceHash){throw '适配副本的版本、素材或来源不匹配'}
 if(-not (Test-YimeiRuntime $runtime)){throw '适配副本完整性未通过'}
 foreach($name in @('look-test-report.json','working-test-report.json')){$test=Read-YimeiManualJson (Join-Path $runtime $name);if(-not $test.ok -or $test.version -ne $version){throw ('动作检查未通过：'+$name)}}
 $look=Read-YimeiManualJson (Join-Path $runtime 'look-test-report.json')
 $browser=Read-YimeiManualJson (Join-Path $runtime 'browser-test-report.json')
 foreach($set in @(@($look.allDirections),@($browser.workingWithHoverAndNativeLook.actualVisited))){
  if((@($set | Sort-Object -Unique) -join ',') -ne ((0..15 | Sort-Object) -join ',')){throw '16 帧或 16 向检查记录不完整'}
 }
 return $ready
}
function Invoke-YimeiManualBuild($root,$app,$version,$stage,$run) {
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=Join-Path $root 'tools\node.exe'
 $info.Arguments='"'+(Join-Path $root 'engine.mjs')+'" build "'+$app+'" "'+$version+'" "'+$stage+'"'
 $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 $process=New-Object Diagnostics.Process;$process.StartInfo=$info
 try {
  if(-not $process.Start()){throw '无法启动适配器'}
  try{$process.PriorityClass='BelowNormal'}catch{}
  $errors=$process.StandardError.ReadToEndAsync()
  while(-not $process.StandardOutput.EndOfStream){
   $line=$process.StandardOutput.ReadLine();Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value $line -Encoding UTF8
   if($line -match '^Compatible'){Set-YimeiManualStatus $run 'running' 'copy' '兼容结构检查通过，正在复制独立副本…'}
   elseif($line -match '^Copy complete'){Set-YimeiManualStatus $run 'running' 'patch' '正在加入逸美素材并适配播放器…'}
   elseif($line -match '^Verifying native'){Set-YimeiManualStatus $run 'running' 'behavior' '正在验证资源完整性和动作行为…'}
   elseif($line -match '^Verifying actual'){Set-YimeiManualStatus $run 'running' 'playback' '正在验证 working 全 16 帧、16 向及任务优先级…'}
  }
  $process.WaitForExit();$errorText=$errors.Result
  if($errorText){Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value $errorText -Encoding UTF8}
  if($process.ExitCode -ne 0){
   if($errorText -match 'Unsupported Codex structure|Version anchor|structural patch|Template anchor'){throw '此版 Codex 的结构尚不兼容。已保留旧版，请查看日志；需要更新适配器后再试。'}
   throw ('新版适配或播放验证失败，已保留旧版。'+$errorText.Substring([Math]::Max(0,$errorText.Length-1200)))
  }
 }finally{$process.Dispose()}
}
function Remove-YimeiManualStage($root,$stage,$run) {
 Assert-YimeiManagedPath $root $stage
 if((Split-Path -Leaf $stage) -notlike '.building-manual-*'){throw 'Refusing to remove a non-manual build stage'}
 & (Join-Path $root 'tools\node.exe') (Join-Path $root 'engine.mjs') clean $stage | Out-Null
 if($LASTEXITCODE -ne 0){throw '临时副本清理失败；未影响固定版本'}
}
function Publish-YimeiManualCandidate($root,$runtime,$ready,$policyHash,$currentHash,$run) {
 $policyPath=Join-Path $root 'update-policy.json';$currentPath=Join-Path $root 'current.json'
 if((Get-FileHash -LiteralPath $policyPath).Hash -ne $policyHash -or (Get-FileHash -LiteralPath $currentPath).Hash -ne $currentHash){throw '适配期间配置已变化，本次不覆盖新配置；已验证副本仍保留'}
 $oldPolicyBytes=[IO.File]::ReadAllBytes($policyPath);$oldCurrentBytes=[IO.File]::ReadAllBytes($currentPath)
 [IO.File]::WriteAllBytes((Join-Path $run 'policy-before.json'),$oldPolicyBytes)
 [IO.File]::WriteAllBytes((Join-Path $run 'current-before.json'),$oldCurrentBytes)
 $policy=Read-YimeiManualJson $policyPath
 $policy | Add-Member -NotePropertyName previousRuntime -NotePropertyValue $policy.runtime -Force
 $policy | Add-Member -NotePropertyName previousVersion -NotePropertyValue $policy.version -Force
 $policy.version=$ready.version;$policy.runtime=$runtime;$policy.changedAt=(Get-Date).ToString('o')
 $policy.mode='fixed';$policy.autoFollowOfficialPackage=$false;$policy.backgroundPreparationEnabled=$false;$policy.automaticRestartAllowed=$false
 $policy.reason='Explicit desktop manual upgrade; no background following or process switching'
 $current=[ordered]@{version=$ready.version;internalVersion=$ready.internalVersion;runtime=$runtime;officialApp=$ready.officialApp;artworkRevision=$ready.artworkRevision;updatedAt=(Get-Date).ToString('o');autoFollowOfficialPackage=$false;restartPerformed=$false}
 try {
  Write-YimeiManualJson $currentPath $current (Join-Path $run 'current-replaced.json')
  Write-YimeiManualJson $policyPath $policy (Join-Path $run 'policy-replaced.json')
 }catch{
  Write-YimeiManualBytes $currentPath $oldCurrentBytes (Join-Path $run 'current-rollback.json')
  throw
 }
}
function Invoke-YimeiManualUpgrade($root,$run) {
 Assert-YimeiManualPath $root $run
 $expected=[IO.Path]::GetFullPath((Join-Path $root 'manual-updates')).TrimEnd('\')+'\'
 if(-not ([IO.Path]::GetFullPath($run)).StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid manual run directory'}
 New-Item -ItemType Directory -Path $run -Force | Out-Null
 $mutex=New-Object Threading.Mutex($false,(Get-YimeiManualMutexName $root));$acquired=$false;$stage=$null
 try {
  try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
  if(-not $acquired){Set-YimeiManualStatus $run 'busy' 'busy' '已有一个手动适配任务正在进行，请等待它完成。';return [pscustomobject]@{ok=$false;action='busy'}}
  Set-YimeiManualStatus $run 'running' 'discover' '正在查找本机已安装的最新版官方 Codex…'
  $policyPath=Join-Path $root 'update-policy.json';$currentPath=Join-Path $root 'current.json'
  $policy=Read-YimeiManualJson $policyPath
  if($policy.mode -ne 'fixed' -or $policy.autoFollowOfficialPackage -ne $false){throw '此工具只用于固定版手动升级，不会启用自动跟随'}
  $policyHash=(Get-FileHash -LiteralPath $policyPath).Hash;$currentHash=(Get-FileHash -LiteralPath $currentPath).Hash
  $package=Get-YimeiInstalledPackage;$version=[string]$package.Version
  if($version -notmatch '^\d+\.\d+\.\d+\.\d+$'){throw '官方版本号格式不正确'}
  if([version]$version -lt [version]$policy.version){throw '本机官方版本比当前固定版更旧，本次不会自动降级'}
  $app=Join-Path $package.InstallLocation 'app';$adapter=Get-YimeiManualAdapterInfo $root
  if([int]$adapter.engineRevision -lt 1){throw '无效的适配器版本'}
  $fingerprint=(Get-FileHash -LiteralPath (Join-Path $root 'artwork\animation-dense.json')).Hash.ToLowerInvariant()
  $sourceHash=Get-YimeiManualSourceHash $app
  $runtime=Join-Path $root ('versions\'+$version+'-'+$fingerprint.Substring(0,12)+'-r'+$adapter.engineRevision)
  Assert-YimeiManagedPath $root $runtime
  Set-YimeiManualStatus $run 'running' 'verify-cache' ('检测到 '+$version+'，正在检查已有适配副本…')
  $ready=$null;$built=$false
  if(Test-Path -LiteralPath (Join-Path $runtime 'ready.json')){try{$ready=Test-YimeiManualCandidate $runtime $version $fingerprint $adapter.engineRevision $sourceHash}catch{Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value ($_ | Out-String) -Encoding UTF8}}
  if(-not $ready){
   if(Test-Path -LiteralPath $runtime){$runtime+='-manual-'+[guid]::NewGuid().ToString('N').Substring(0,8)}
   $stage=Join-Path $root ('versions\.building-manual-'+$version+'-'+[guid]::NewGuid().ToString('N'))
   Assert-YimeiManagedPath $root $stage;Assert-YimeiManagedPath $root $runtime
   Set-YimeiManualStatus $run 'running' 'build' ('正在为 '+$version+' 制作独立逸美副本；不改官方版…')
   Invoke-YimeiManualBuild $root $app $version $stage $run
   $ready=Test-YimeiManualCandidate $stage $version $fingerprint $adapter.engineRevision $sourceHash
   if((Get-YimeiManualSourceHash $app) -ne $sourceHash){throw '官方安装包在适配期间发生变化，本次不发布，请稍后重试'}
   Assert-YimeiManagedPath $root $stage;Assert-YimeiManagedPath $root $runtime
   [IO.Directory]::Move($stage,$runtime);$stage=$null;$built=$true
   foreach($name in @('patch-report.json','look-test-report.json','working-test-report.json')){
    $file=Join-Path $runtime $name;$data=Read-YimeiManualJson $file
    if($name -eq 'patch-report.json'){$data.app=Join-Path $runtime 'app'}else{$data.runtime=$runtime}
    Write-YimeiManualJson $file $data
   }
  }
  if($policy.runtime -eq $runtime -and $policy.version -eq $version){$action='up-to-date';$message=('当前逸美已适配本机最新版 '+$version+'，无需重复构建。')}
  else {
   Set-YimeiManualStatus $run 'running' 'publish' '全部检查通过，正在保存新的固定版本；旧副本保留…'
   Publish-YimeiManualCandidate $root $runtime $ready $policyHash $currentHash $run
   $action='updated';$message=('已适配 '+$version+'。下次打开逸美时使用新版；本次没有启动或重启 Codex。')
  }
  $result=[ordered]@{ok=$true;action=$action;version=$version;runtime=$runtime;built=$built;engineRevision=$adapter.engineRevision;at=(Get-Date).ToString('o');autoFollowEnabled=$false;codexStarted=$false;codexStopped=$false;log=(Join-Path $run 'upgrade.log')}
  Write-YimeiManualJson (Join-Path $run 'result.json') $result
  Set-YimeiManualStatus $run 'success' $action $message
  return [pscustomobject]$result
 }catch{
  $message=$_.Exception.Message
  Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value ($_ | Out-String) -Encoding UTF8
  $result=[ordered]@{ok=$false;action='failed';error=$message;at=(Get-Date).ToString('o');previousFixedVersionRetained=$true;codexStarted=$false;codexStopped=$false;log=(Join-Path $run 'upgrade.log')}
  Write-YimeiManualJson (Join-Path $run 'result.json') $result
  Set-YimeiManualStatus $run 'failed' 'failed' ('适配未完成，旧版保留。'+$message)
  return [pscustomobject]$result
 }finally{
  if($stage -and (Test-Path -LiteralPath $stage)){try{Remove-YimeiManualStage $root $stage $run}catch{Add-Content -LiteralPath (Join-Path $run 'upgrade.log') -Value ($_ | Out-String) -Encoding UTF8}}
  if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()
 }
}
