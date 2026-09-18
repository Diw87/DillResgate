param([switch]$WriteUsb)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path (Split-Path $PSScriptRoot) 'src\Core.psm1') -Force

$package = Split-Path $PSScriptRoot
$ps = Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Get-IsAdministrator)) {
    $args = '-NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-NativeArgument $PSCommandPath)
    if ($WriteUsb) { $args += ' -WriteUsb' }
    Start-Process $ps -ArgumentList $args -Verb RunAs | Out-Null
    exit
}

$programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
$adk = Join-Path $programFilesX86 'Windows Kits\10\Assessment and Deployment Kit'
$deploy = Join-Path $adk 'Deployment Tools\DandISetEnv.bat'
$peRoot = Join-Path $adk 'Windows Preinstallation Environment'
$copyPe = Join-Path $peRoot 'copype.cmd'
$makeMedia = Join-Path $peRoot 'MakeWinPEMedia.cmd'
$ocs = Join-Path $peRoot 'amd64\WinPE_OCs'
$base = Join-Path $env:SystemDrive 'DillResgate-WinPE'
$latest = Join-Path $base 'ultima-imagem.txt'
$dism = Join-Path $env:windir 'System32\dism.exe'
$mounted = $false
$mount = $null

function Run-Cmd([string]$Line) {
    $temp = Join-Path $base ('adk-' + [guid]::NewGuid().ToString('N') + '.cmd')
    [IO.File]::WriteAllLines($temp,@('@echo off',('call "'+$deploy+'"'),$Line,'exit /b %errorlevel%'),[Text.Encoding]::Default)
    try {
        & $env:ComSpec /d /c $temp
        if ($LASTEXITCODE -ne 0) { throw "Ferramenta ADK retornou $LASTEXITCODE." }
    } finally { Remove-Item $temp -Force -ErrorAction SilentlyContinue }
}
function Run-Dism([string[]]$Args) {
    & $dism @Args
    if ($LASTEXITCODE -notin @(0,3010)) { throw "DISM retornou $LASTEXITCODE." }
}

try {
    if (-not (Test-Path $deploy) -or -not (Test-Path $copyPe) -or -not (Test-Path $makeMedia)) {
        Write-Host 'Windows ADK/WinPE nao encontrado.' -ForegroundColor Yellow
        Write-Host 'Instale Deployment Tools e o Windows PE add-on da mesma versao.'
        Start-Process 'https://learn.microsoft.com/windows-hardware/get-started/adk-install'
        exit 2
    }
    New-Item -ItemType Directory -Path $base -Force | Out-Null

    if ($WriteUsb) {
        if (-not (Test-Path $latest)) { throw 'Primeiro execute 05_CRIAR_IMAGEM_RESGATE.cmd.' }
        $work = [IO.File]::ReadAllText($latest).Trim()
        if (-not (Test-Path (Join-Path $work 'media\sources\boot.wim'))) { throw 'Imagem WinPE nao encontrada.' }

        $choices = @()
        foreach ($disk in @(Get-Disk | Where-Object { $_.BusType -eq 'USB' -and -not $_.IsBoot -and -not $_.IsSystem })) {
            foreach ($part in @($disk | Get-Partition | Where-Object DriveLetter)) {
                $choices += [pscustomobject]@{
                    Letter=[string]$part.DriveLetter
                    Disk=$disk.Number
                    Name=$disk.FriendlyName
                    SizeGB=[math]::Round($disk.Size/1GB,1)
                }
            }
        }
        if ($choices.Count -eq 0) { throw 'Nenhum pendrive USB elegivel encontrado.' }
        $choices | Format-Table -AutoSize
        $letter = (Read-Host 'Digite a letra do pendrive que sera APAGADO').Trim().ToUpperInvariant()
        $selected = @($choices | Where-Object Letter -eq $letter)
        if ($selected.Count -ne 1 -or $selected[0].SizeGB -lt 7) { throw 'Unidade invalida ou pequena demais.' }
        $confirm = Read-Host ("Digite APAGAR $letter para confirmar")
        if ($confirm -cne ("APAGAR $letter")) { throw 'Operacao cancelada.' }
        $verify = Get-Partition -DriveLetter $letter | Get-Disk
        if ($verify.Number -ne $selected[0].Disk -or $verify.BusType -ne 'USB' -or $verify.IsSystem -or $verify.IsBoot) {
            throw 'A unidade mudou; operacao cancelada.'
        }
        Run-Cmd ('call "'+$makeMedia+'" /UFD /F "'+$work+'" '+$letter+':')
        Write-Host 'Pendrive de resgate criado.' -ForegroundColor Green
        exit
    }

    $work = Join-Path $base ('build-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Run-Cmd ('call "'+$copyPe+'" amd64 "'+$work+'"')
    $mount = Join-Path $work 'mount'
    $wim = Join-Path $work 'media\sources\boot.wim'
    Run-Dism @('/Mount-Image',('/ImageFile:'+$wim),'/Index:1',('/MountDir:'+$mount))
    $mounted = $true

    foreach ($component in @('WinPE-WMI','WinPE-NetFX','WinPE-Scripting','WinPE-PowerShell','WinPE-StorageWMI','WinPE-DismCmdlets')) {
        $cab = Join-Path $ocs ($component+'.cab')
        if (-not (Test-Path $cab)) { throw "Componente WinPE ausente: $component" }
        Run-Dism @(('/Image:'+$mount),'/Add-Package',('/PackagePath:'+$cab))
    }

    $start = @(
        '@echo off',
        'wpeinit',
        'echo Dill Resgate - procurando a midia...',
        'for %%D in (C D E F G H I J K L M N O P Q R S T U V W Y Z) do if exist %%D:\DILL-RESGATE-MIDIA.txt powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%%D:\DillResgate\src\Start.ps1" -Mode Repair',
        'pause'
    )
    [IO.File]::WriteAllLines((Join-Path $mount 'Windows\System32\startnet.cmd'),$start,[Text.Encoding]::ASCII)

    Run-Dism @('/Unmount-Image',('/MountDir:'+$mount),'/Commit')
    $mounted = $false
    $dest = Join-Path $work 'media\DillResgate'
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($item in @('src','web','config.json')) {
        Copy-Item (Join-Path $package $item) $dest -Recurse -Force
    }
    [IO.File]::WriteAllText((Join-Path $work 'media\DILL-RESGATE-MIDIA.txt'),'Dill Resgate v0.2')
    $iso = Join-Path $work 'DillResgate-Resgate-x64.iso'
    Run-Cmd ('call "'+$makeMedia+'" /ISO "'+$work+'" "'+$iso+'"')
    [IO.File]::WriteAllText($latest,$work)
    Write-Host ('Imagem criada: ' + $iso) -ForegroundColor Green
    Write-Host 'Depois execute 06_GRAVAR_PENDRIVE.cmd.'
} catch {
    Write-Host ('Nao foi possivel concluir: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    if ($mounted -and $mount) { & $dism /Unmount-Image ("/MountDir:$mount") /Discard | Out-Null }
    Read-Host 'Pressione Enter para fechar' | Out-Null
}
