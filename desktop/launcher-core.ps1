$ErrorActionPreference='Stop'
# A launcher started by another PowerShell can inherit its newer module search path.
# Load this interpreter's own system utilities instead of incompatible cached modules.
$nativeModuleRoot=Join-Path $PSHOME 'Modules'
$env:PSModulePath=$nativeModuleRoot+';'+$env:PSModulePath
Import-Module (Join-Path $nativeModuleRoot 'Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -Force -ErrorAction Stop
function Test-YimeiAutoFollow($managerRoot) {
 $file=Join-Path $managerRoot 'update-policy.json'
 if(-not (Test-Path -LiteralPath $file)){return $true}
 $policy=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
 return ($policy.autoFollowOfficialPackage -eq $true)
}
function Resolve-YimeiPinnedRuntime($managerRoot) {
 $policy=Get-Content -LiteralPath (Join-Path $managerRoot 'update-policy.json') -Raw | ConvertFrom-Json
 if($policy.mode -ne 'fixed' -or $policy.autoFollowOfficialPackage -ne $false -or -not $policy.runtime){throw 'Invalid fixed Yimei policy'}
 $runtime=[string]$policy.runtime
 Assert-YimeiManagedPath $managerRoot $runtime
 $ready=Get-Content -LiteralPath (Join-Path $runtime 'ready.json') -Raw | ConvertFrom-Json
 $fingerprint=(Get-FileHash -LiteralPath (Join-Path $managerRoot 'artwork\animation-dense.json')).Hash.ToLowerInvariant()
 if(-not $ready.ok -or $ready.version -ne $policy.version -or $ready.artworkFingerprint -ne $fingerprint -or -not (Test-YimeiRuntime $runtime)){throw 'Fixed Yimei runtime failed verification'}
 return [pscustomobject]@{version=$ready.version;runtime=$runtime;built=$false;verified=$true;startupMode='fixed-version'}
}
function Get-YimeiInstalledPackage {
 $packages=@(Get-AppxPackage -Name OpenAI.Codex -ErrorAction Stop | Where-Object {$_.Architecture -eq 'X64' -and (Test-Path -LiteralPath (Join-Path $_.InstallLocation 'app\resources\app.asar'))} | Sort-Object {[version]$_.Version} -Descending)
 if($packages.Count -eq 0){throw 'No installed x64 OpenAI.Codex package was found'}
 return $packages[0]
}
function Get-YimeiForeignProcesses($appExe) {
 return @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction Stop | Where-Object {$_.ExecutablePath -and $_.ExecutablePath -ne $appExe -and $_.ExecutablePath -match 'OpenAI\.Codex_|codex_app_copy|codex-yimei16' -and $_.CommandLine -notmatch '--type='})
}
function Test-YimeiDirectSwitchConsent($managerRoot) {
 # Compatibility for old helper scripts: the earlier human permission is revoked.
 return $false
}
function Stop-YimeiConflictingInstances($managerRoot,$appExe,$foreign) {
 throw 'Automatic process switching was removed; no Codex process may be closed by the Yimei launcher'
}
function Test-YimeiRuntime($runtime) {
 # Only check small immutable manifests, the ASAR header and executable resource.
 # Never run a browser, copy files, or start another PowerShell on the launch path.
 foreach($name in @('ready.json','patch-report.json','browser-test-report.json','behavior-test-report.json','app\ChatGPT.exe','app\resources\app.asar')){if(-not (Test-Path -LiteralPath (Join-Path $runtime $name))){return $false}}
 $ready=Get-Content -LiteralPath (Join-Path $runtime 'ready.json') -Raw | ConvertFrom-Json
 $report=Get-Content -LiteralPath (Join-Path $runtime 'patch-report.json') -Raw | ConvertFrom-Json
 if(-not $ready.ok -or -not $report.ok -or $ready.version -ne $report.version -or $report.patchedHeaderHash -notmatch '^[a-f0-9]{64}$' -or $ready.patchedHeaderHash -ne $report.patchedHeaderHash){throw 'Invalid ready runtime manifest'}
 foreach($name in @('browser-test-report.json','behavior-test-report.json')){
  $test=Get-Content -LiteralPath (Join-Path $runtime $name) -Raw | ConvertFrom-Json
  if(-not $test.ok -or $test.version -ne $ready.version){throw ('Unverified runtime: '+$name)}
 }
 $stream=[IO.File]::OpenRead((Join-Path $runtime 'app\resources\app.asar'))
 try {
  $prefix=New-Object byte[] 16
  if($stream.Read($prefix,0,16) -ne 16){throw 'Invalid archive prefix'}
  $length=[BitConverter]::ToUInt32($prefix,12)
  if($length -eq 0 -or $length -gt 64MB){throw 'Invalid archive header size'}
  $bytes=New-Object byte[] $length;$read=0
  while($read -lt $length){$count=$stream.Read($bytes,$read,$length-$read);if($count -eq 0){throw 'Incomplete archive header'};$read+=$count}
  $sha=[Security.Cryptography.SHA256]::Create()
  try{$actual=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 }finally{$stream.Dispose()}
 if($actual -ne $report.patchedHeaderHash){throw 'Archive changed since validation'}
 $text=[Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes((Join-Path $runtime 'app\ChatGPT.exe')))
 if(-not $text.Contains($report.patchedHeaderHash)){throw 'Executable integrity resource mismatch'}
 return $true
}
function Invoke-YimeiBuild($managerRoot,$app,$version,$stage,[switch]$Interactive) {
 # Compatibility parameter retained; preparing a runtime never displays UI.
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=Join-Path $managerRoot 'tools\node.exe'
  $info.Arguments='"'+(Join-Path $managerRoot 'engine.mjs')+'" build "'+$app+'" "'+$version+'" "'+$stage+'"'
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $process=New-Object Diagnostics.Process;$process.StartInfo=$info
  if(-not $process.Start()){throw 'Could not start the compatibility builder'}
  try{$process.PriorityClass='BelowNormal'}catch{}
  $out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $text=$out.Result+"`r`n"+$err.Result
  [IO.File]::WriteAllText((Join-Path $managerRoot 'last-build.log'),$text,(New-Object Text.UTF8Encoding($false)))
  if($process.ExitCode -ne 0){throw ('新版适配未通过检查，旧副本已保留。详情见 last-build.log。'+$err.Result)}
}
function Assert-YimeiManagedPath($managerRoot,$path) {
 $base=[IO.Path]::GetFullPath((Join-Path $managerRoot 'versions')).TrimEnd('\')+'\'
 $resolved=[IO.Path]::GetFullPath($path)
 if(-not $resolved.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw ('Outside managed cache: '+$resolved)}
 if(Test-Path -LiteralPath $resolved){if((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unexpected cache link'}}
}
function Resolve-YimeiFastRuntime($managerRoot) {
 if(-not (Test-YimeiAutoFollow $managerRoot)){return (Resolve-YimeiPinnedRuntime $managerRoot)}
 $fingerprint=(Get-FileHash -LiteralPath (Join-Path $managerRoot 'artwork\animation-dense.json')).Hash.ToLowerInvariant()
 $candidates=New-Object 'System.Collections.Generic.List[string]'
 $current=Join-Path $managerRoot 'current.json'
 if(Test-Path -LiteralPath $current){try{$pointer=Get-Content -LiteralPath $current -Raw | ConvertFrom-Json;if($pointer.runtime){$candidates.Add([string]$pointer.runtime)}}catch{}}
 $cache=Join-Path $managerRoot 'versions'
 if(Test-Path -LiteralPath $cache){
  Get-ChildItem -LiteralPath $cache -Directory | Where-Object {$_.Name -match '^\d+\.\d+\.\d+\.\d+-[a-f0-9]+-r[1234]$'} | Sort-Object {[version]($_.Name.Split('-')[0])},{$_.Name} -Descending | ForEach-Object {if(-not $candidates.Contains($_.FullName)){$candidates.Add($_.FullName)}}
 }
 foreach($runtime in $candidates){
  try {
   Assert-YimeiManagedPath $managerRoot $runtime
   $ready=Get-Content -LiteralPath (Join-Path $runtime 'ready.json') -Raw | ConvertFrom-Json
   if(-not $ready.ok -or $ready.artworkFingerprint -ne $fingerprint -or $ready.engineRevision -notin @(1,2,3,4)){continue}
   if(Test-YimeiRuntime $runtime){return [pscustomobject]@{version=$ready.version;runtime=$runtime;built=$false;verified=$true;startupMode='ready-first'}}
  }catch{continue}
 }
 throw 'No verified Yimei runtime is available. Use the explicit PrepareOnly command to prepare it; startup will not run a blocking build.'
}
function Start-YimeiBackgroundUpdate($managerRoot) {
 if(-not (Test-YimeiAutoFollow $managerRoot)){return}
 $script=Join-Path $managerRoot 'Prepare-Background.ps1'
 $args='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$script+'"'
 Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList $args -WorkingDirectory $managerRoot -WindowStyle Hidden | Out-Null
}
function Resolve-YimeiRuntime($managerRoot,[switch]$VerifyOnly,[switch]$Interactive) {
 if(-not (Test-YimeiAutoFollow $managerRoot)){return (Resolve-YimeiPinnedRuntime $managerRoot)}
 $package=Get-YimeiInstalledPackage
 $version=[string]$package.Version
 if($version -notmatch '^\d+\.\d+\.\d+\.\d+$'){throw 'Unexpected official version'}
 $app=Join-Path $package.InstallLocation 'app'
 $fingerprint=(Get-FileHash -LiteralPath (Join-Path $managerRoot 'artwork\animation-dense.json') -Algorithm SHA256).Hash.ToLowerInvariant()
 $runtime=Join-Path $managerRoot ('versions\'+$version+'-'+$fingerprint.Substring(0,12)+'-r4')
 Assert-YimeiManagedPath $managerRoot $runtime
 New-Item -ItemType Directory -Path (Join-Path $managerRoot 'versions') -Force | Out-Null
 $mutex=New-Object Threading.Mutex($false,('Local\Codex-Yimei-Auto-'+(Get-FileHash -LiteralPath (Join-Path $managerRoot 'engine.mjs')).Hash.Substring(0,16)))
 $acquired=$false
 try {
  try {$acquired=$mutex.WaitOne(180000)}catch [Threading.AbandonedMutexException]{$acquired=$true}
  if(-not $acquired){throw 'Another Yimei update is still in progress; please try again shortly'}
  $built=$false
  if(Test-Path -LiteralPath (Join-Path $runtime 'ready.json')){
   $ready=Get-Content -LiteralPath (Join-Path $runtime 'ready.json') -Raw | ConvertFrom-Json
   if(-not $ready.ok -or $ready.version -ne $version -or $ready.artworkFingerprint -ne $fingerprint -or $ready.engineRevision -ne 4){throw 'Cached manifest mismatch'}
   if(-not (Test-YimeiRuntime $runtime)){throw 'Cached runtime failed verification'}
  }else{
   if($VerifyOnly){throw 'This installed version has not been prepared yet'}
   if(Test-Path -LiteralPath $runtime){throw 'An incomplete cache exists; refusing to overwrite it'}
   $stage=Join-Path $managerRoot ('versions\.building-'+$version+'-'+[guid]::NewGuid().ToString('N'))
   Assert-YimeiManagedPath $managerRoot $stage
   try {
    Invoke-YimeiBuild $managerRoot $app $version $stage -Interactive:$Interactive
    $ready=Get-Content -LiteralPath (Join-Path $stage 'ready.json') -Raw | ConvertFrom-Json
    if(-not $ready.ok -or $ready.version -ne $version -or $ready.artworkFingerprint -ne $fingerprint){throw 'New runtime was not validated'}
    if(-not (Test-YimeiRuntime $stage)){throw 'New runtime verification failed'}
    Assert-YimeiManagedPath $managerRoot $stage;Assert-YimeiManagedPath $managerRoot $runtime
    Move-Item -LiteralPath $stage -Destination $runtime
    $reportFile=Join-Path $runtime 'patch-report.json'
    if(Test-Path -LiteralPath $reportFile){$report=Get-Content -LiteralPath $reportFile -Raw | ConvertFrom-Json;$report.app=Join-Path $runtime 'app';$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportFile -Encoding UTF8}
    $built=$true
   }catch{
    if(Test-Path -LiteralPath $stage){
     $failure=Join-Path $managerRoot ('failures\'+$version+'-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $failure -Force | Out-Null
     Get-ChildItem -LiteralPath $stage -File | Where-Object {$_.Extension -in @('.json','.log')} | Copy-Item -Destination $failure
     Assert-YimeiManagedPath $managerRoot $stage; & (Join-Path $managerRoot 'tools\node.exe') (Join-Path $managerRoot 'engine.mjs') clean $stage
    }
    throw
   }
  }
  $current=[ordered]@{version=$version;internalVersion=$ready.internalVersion;runtime=$runtime;officialApp=$app;artworkRevision=$ready.artworkRevision;updatedAt=(Get-Date).ToString('o');autoFollowOfficialPackage=$true;restartPerformed=$false}
  $temporary=Join-Path $managerRoot ('current-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $current | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination (Join-Path $managerRoot 'current.json') -Force
  return [pscustomobject]@{version=$version;runtime=$runtime;built=$built;verified=$true}
 } finally {if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()}
}
function Invoke-YimeiLaunch($managerRoot,[switch]$PrepareOnly,[switch]$VerifyOnly,[switch]$ConfirmedSwitch) {
 if($PrepareOnly -or $VerifyOnly){return (Resolve-YimeiRuntime $managerRoot -VerifyOnly:$VerifyOnly -Interactive:$false)}
 $resolved=Resolve-YimeiFastRuntime $managerRoot
 $exe=Join-Path $resolved.runtime 'app\ChatGPT.exe'
 $foreign=@(Get-YimeiForeignProcesses $exe)
 if($foreign.Count){
  return [pscustomobject]@{action='other-instance-running';version=$resolved.version;runtime=$resolved.runtime;restartPerformed=$false;otherInstancePreserved=$true}
 }
 Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) -WindowStyle Normal | Out-Null
 $follow=Test-YimeiAutoFollow $managerRoot
 if($follow){try{Start-YimeiBackgroundUpdate $managerRoot}catch{$_ | Out-String | Set-Content -LiteralPath (Join-Path $managerRoot 'background-update-error.log') -Encoding UTF8}}
 return [pscustomobject]@{action='launched';version=$resolved.version;runtime=$resolved.runtime;windowStyle='Normal';restartPerformed=$false;startupMode=$resolved.startupMode;updateMode=$(if($follow){'background-prepare-next-launch'}else{'disabled-fixed-version'})}
}
