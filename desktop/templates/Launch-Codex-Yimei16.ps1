[CmdletBinding()]
param([switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir=Join-Path $root 'app'
$appExe=Join-Path $appDir 'ChatGPT.exe'
try {
 $report=Get-Content -LiteralPath (Join-Path $root 'patch-report.json') -Raw | ConvertFrom-Json
 foreach($testName in @('browser-test-report.json','behavior-test-report.json')) {
  $test=Get-Content -LiteralPath (Join-Path $root $testName) -Raw | ConvertFrom-Json
  if(-not $test.ok -or $test.version -ne $report.version){throw "Unverified build: $testName"}
 }
 # Check both halves of Electron's archive integrity before launching.
 $archive=Join-Path $appDir 'resources\app.asar'
 $stream=[IO.File]::OpenRead($archive)
 try {
  $prefix=New-Object byte[] 16
  if($stream.Read($prefix,0,16) -ne 16){throw 'Invalid archive prefix'}
  $length=[BitConverter]::ToUInt32($prefix,12)
  if($length -le 0 -or $length -gt 64MB){throw 'Invalid archive header size'}
  $bytes=New-Object byte[] $length
  if($stream.Read($bytes,0,$length) -ne $length){throw 'Incomplete archive header'}
  $sha=[Security.Cryptography.SHA256]::Create()
  try {$actual=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 }finally {$stream.Dispose()}
 if($actual -ne $report.patchedHeaderHash){throw 'Archive changed since verification'}
 $exeText=[Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes($appExe))
 if(-not $exeText.Contains($report.patchedHeaderHash)){throw 'Executable integrity resource does not match archive'}
 if($VerifyOnly){Write-Output ('Verified Codex '+$report.version+' / '+$report.artworkRevision);exit 0}
 $foreign=@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction Stop | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath -ne $appExe -and
  $_.ExecutablePath -match 'OpenAI\.Codex_|codex_app_copy|codex-yimei16'
 })
 if($foreign.Count -gt 0) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('16 帧新版已经准备好。请先从 Codex 菜单退出当前版本，再双击此快捷方式。此启动器不会自动关闭或重启 Codex。','Codex · 新版 16 帧逸美','OK','Information') | Out-Null
  exit 2
 }
 Start-Process -FilePath $appExe -WorkingDirectory $appDir -WindowStyle Normal | Out-Null
} catch {
 $_ | Out-String | Set-Content -LiteralPath (Join-Path $root 'last-launch-error.log') -Encoding UTF8
 if($VerifyOnly){Write-Error $_.Exception.Message;exit 1}
 Add-Type -AssemblyName PresentationFramework
 [System.Windows.MessageBox]::Show($_.Exception.Message,'Codex · 16 帧逸美启动失败','OK','Error') | Out-Null
 exit 1
}
