[CmdletBinding()]
param([switch]$PrepareOnly,[switch]$VerifyOnly,[switch]$FixedVersion)
$ErrorActionPreference='Stop'
$managerRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
try {
 . (Join-Path $managerRoot 'launcher-core.ps1')
 if($FixedVersion -and (Test-YimeiAutoFollow $managerRoot)){throw '固定版配置缺失或已改变；已停止启动，不会自动跟随官方更新。'}
 $result=Invoke-YimeiLaunch $managerRoot -PrepareOnly:$PrepareOnly -VerifyOnly:$VerifyOnly
 if($result.action -eq 'other-instance-running'){
  Add-Type -AssemblyName PresentationFramework
  [Windows.MessageBox]::Show('官方版或其他版本 Codex 正在运行，已保持它不变。逸美不会退出或替换它。本次不启动逸美；需要使用逸美时，请先自行正常退出另一个版本。','Codex · 不自动切换版本','OK','Information') | Out-Null
  exit 0
 }
 $result | ConvertTo-Json -Compress
}catch{
 $_ | Out-String | Set-Content -LiteralPath (Join-Path $managerRoot 'last-launch-error.log') -Encoding UTF8
 if($PrepareOnly -or $VerifyOnly){Write-Error $_.Exception.Message;exit 1}
 Add-Type -AssemblyName PresentationFramework
 [Windows.MessageBox]::Show($_.Exception.Message,'Codex · 逸美启动失败','OK','Error') | Out-Null
 exit 1
}
