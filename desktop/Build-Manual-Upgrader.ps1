$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw 'The built-in .NET Framework C# compiler was not found'}
$source=Join-Path $root 'manual-upgrader\Program.cs'
$output=Join-Path $root 'Yimei-Manual-Upgrade.exe'
& $compiler /nologo /target:winexe /optimize+ ('/out:'+$output) ('/win32icon:'+(Join-Path $root 'icon.ico')) /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll $source
if($LASTEXITCODE -ne 0){throw 'Failed to build the manual upgrade window'}
Get-Item -LiteralPath $output | Select-Object FullName,Length
