[CmdletBinding()]
param([ValidateRange(0,30)][int]$DelaySeconds=10)
$ErrorActionPreference='Stop'
$managerRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
if($DelaySeconds){Start-Sleep -Seconds $DelaySeconds}
try {
 . (Join-Path $managerRoot 'launcher-core.ps1')
 if(-not (Test-YimeiDirectSwitchConsent $managerRoot)){throw 'No human authorization for this switch'}
 $result=Invoke-YimeiLaunch $managerRoot -ConfirmedSwitch
 if($result.action -ne 'launched'){throw ('Switch did not launch: '+$result.action)}
 $target=Join-Path $result.runtime 'app\ChatGPT.exe'
 $deadline=[DateTime]::UtcNow.AddSeconds(45)
 $main=$null
 do {
  $main=Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -eq $target -and $_.CommandLine -notmatch '--type='} | Select-Object -First 1
  if($main){break}
  Start-Sleep -Milliseconds 300
 }while([DateTime]::UtcNow -lt $deadline)
 if(-not $main){throw 'The expected Yimei process did not stay running'}
 Start-Sleep -Seconds 3
 $alive=Get-Process -Id $main.ProcessId -ErrorAction Stop
 $report=[ordered]@{ok=$true;at=(Get-Date).ToString('o');version=$result.version;runtime=$result.runtime;processId=$main.ProcessId;executablePath=$main.ExecutablePath;responding=$alive.Responding;mainWindowStyle='Normal';restartPerformed=$result.restartPerformed;authorization='human confirmed now and future explicit shortcut clicks';futureOneClickSwitch=$true}
 $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $managerRoot 'active-switch-report.json') -Encoding UTF8
 $installedFile=Join-Path $managerRoot 'installation-report.json'
 $installed=Get-Content -LiteralPath $installedFile -Raw | ConvertFrom-Json
 $installed.restartPerformed=$result.restartPerformed;$installed.currentAppSwitched=$true;$installed.activation='Yimei runtime running after authorized switch'
 $installed | Add-Member -NotePropertyName directSwitchOnShortcutClick -NotePropertyValue $true -Force
 $installed | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $installedFile -Encoding UTF8
}catch{
 [ordered]@{ok=$false;at=(Get-Date).ToString('o');error=($_ | Out-String);authorization='human requested immediate switch'} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $managerRoot 'active-switch-report.json') -Encoding UTF8
 exit 1
}
