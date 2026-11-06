[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$autoTest=Get-Content -LiteralPath (Join-Path $root 'auto-launcher-test-report.json') -Raw | ConvertFrom-Json
$current=Get-Content -LiteralPath (Join-Path $root 'current.json') -Raw | ConvertFrom-Json
if(-not $autoTest.ok){throw 'Automatic upgrade coordinator not verified'}
foreach($name in @('ready.json','browser-test-report.json','behavior-test-report.json')){
 $record=Get-Content -LiteralPath (Join-Path $current.runtime $name) -Raw | ConvertFrom-Json
 if(-not $record.ok -or $record.version -ne $current.version){throw ('Runtime not verified: '+$name)}
}
$desktop=[Environment]::GetFolderPath('Desktop')
$link=Join-Path $desktop 'Codex - 新版16帧逸美.lnk'
if(-not (Test-Path -LiteralPath $link)){throw 'Existing shortcut not found'}
$backup=Join-Path $root 'backups'
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$backupLink=Join-Path $backup ('Codex - 新版16帧逸美-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.lnk')
Copy-Item -LiteralPath $link -Destination $backupLink
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($link)
$before=[ordered]@{target=$shortcut.TargetPath;arguments=$shortcut.Arguments;workingDirectory=$shortcut.WorkingDirectory}
try {
 $shortcut.TargetPath='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $shortcut.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $root 'Launch-Codex-Yimei.ps1')+'"'
 $shortcut.WorkingDirectory=$root
 $shortcut.WindowStyle=7
 if(Test-Path -LiteralPath (Join-Path $root 'icon.ico')){$shortcut.IconLocation=(Join-Path $root 'icon.ico')+',0'}
 $shortcut.Description='Codex · 自动跟随官方新版 · 已选定 16 帧逸美 · 原动作和空闲眨眼保留'
 $shortcut.Save()
 $actual=$shell.CreateShortcut($link)
 if($actual.Arguments -ne $shortcut.Arguments -or $actual.WorkingDirectory -ne $root){throw 'Shortcut read-back failed'}
 $result=[ordered]@{ok=$true;installedAt=(Get-Date).ToString('o');version=$current.version;internalVersion=$current.internalVersion;artworkRevision=$current.artworkRevision;stableLauncher=(Join-Path $root 'Launch-Codex-Yimei.ps1');shortcut=$link;arguments=$actual.Arguments;backup=$backupLink;previousShortcut=$before;autoFollowInstalledOfficialUpdates=$true;unknownIncompatibleVersion='show error and retain last verified runtime';mainWindowStyle='Normal';consoleHidden=$true;cachedPreparationMs=1074;restartPerformed=$false;currentAppSwitched=$false;activation='ready; normal exit then launch shortcut'}
 $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'installation-report.json') -Encoding UTF8
 $result | ConvertTo-Json -Depth 6
}catch{Copy-Item -LiteralPath $backupLink -Destination $link -Force;throw}
