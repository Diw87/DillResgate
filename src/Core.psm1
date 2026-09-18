# Compatibilidade: Windows PowerShell 5.1 / WinPE com PowerShell.
Set-StrictMode -Version 2.0

function Write-JsonAtomic {
    param([Parameter(Mandatory)] [string]$Path, [Parameter(Mandatory)] $Value)
    $json = ConvertTo-Json -InputObject $Value -Depth 15
    $tmp = $Path + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
    [IO.File]::WriteAllText($tmp, $json, (New-Object Text.UTF8Encoding($false)))
    try {
        for ($attempt=0; $attempt -lt 12; $attempt++) {
            try {
                if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($tmp, $Path, [NullString]::Value) }
                else { [IO.File]::Move($tmp, $Path) }
                break
            } catch [IO.IOException] {
                if ($attempt -eq 11) { throw }
                Start-Sleep -Milliseconds 30
            }
        }
    } finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json)
}

function ConvertTo-NativeArgument {
    param([AllowEmptyString()] [string]$Value)
    # Quoting de argv do Windows. Nenhum comando passa por cmd /c.
    $v = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $v = [regex]::Replace($v, '(\\+)$', '$1$1')
    return ('"' + $v + '"')
}

function Read-NativeText {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -eq 0) { return '' }
    $limit = [Math]::Min(1000, $bytes.Length)
    $zeros = 0
    for ($i = 1; $i -lt $limit; $i += 2) { if ($bytes[$i] -eq 0) { $zeros++ } }
    if (($bytes.Length -gt 1 -and $bytes[0] -eq 255 -and $bytes[1] -eq 254) -or $zeros -gt ($limit / 6)) {
        return [Text.Encoding]::Unicode.GetString($bytes).Trim([char]0xFEFF)
    }
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
        return [Text.Encoding]::UTF8.GetString($bytes).Trim([char]0xFEFF)
    }
    $cp = [Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage
    return [Text.Encoding]::GetEncoding($cp).GetString($bytes)
}

function ConvertTo-PlainText {
    param([AllowEmptyString()] [string]$Text)
    $s = $Text.Normalize([Text.NormalizationForm]::FormD)
    $s = [regex]::Replace($s, '\p{Mn}', '')
    return ([regex]::Replace($s.ToLowerInvariant(), '\s+', ' ')).Trim()
}

function Get-SfcFinding {
    param([AllowEmptyString()] [string]$Text, [int]$ExitCode = 0)
    $s = ConvertTo-PlainText $Text
    if ($ExitCode -ne 0) { return 'unknown' }
    if ($s -match 'did not find any integrity violations|nao encontrou (nenhuma |qualquer )?violac(ao|oes) de integridade') { return 'healthy' }
    if ($s -match 'found corrupt files and successfully repaired|encontrou arquivos corrompidos e os reparou|encontrou arquivos corrompidos e reparou') { return 'repaired' }
    if ($s -match 'found integrity violations|found corrupt files|encontrou violac(ao|oes) de integridade|encontrou arquivos corrompidos') { return 'corrupt' }
    return 'unknown'
}

function Get-DismFinding {
    param([AllowEmptyString()] [string]$Text, [int]$ExitCode = 0)
    if ($ExitCode -notin @(0, 3010)) { return 'unknown' }
    $s = ConvertTo-PlainText $Text
    if ($s -match 'no component store corruption detected') { return 'healthy' }
    if ($s -match 'component store is repairable') { return 'repairable' }
    if ($s -match 'component store cannot be repaired|component store is not repairable') { return 'unrepairable' }
    return 'unknown'
}

function Get-RepairDecision {
    param([string]$Mode, [string]$Finding, [string]$Kind, [bool]$DiskRisk, [bool]$LowSpace, [int]$TargetCount = 1)
    if ($TargetCount -ne 1) { return 'block_target' }
    if ($DiskRisk) { return 'block_disk' }
    if ($Mode -eq 'Diagnose') { return 'observe' }
    if ($LowSpace) { return 'block_space' }
    if ($Kind -eq 'dism' -and $Finding -eq 'repairable') { return 'repair' }
    if ($Kind -eq 'sfc' -and $Finding -eq 'corrupt') { return 'repair' }
    if ($Kind -eq 'bcd' -and $Finding -in @('missing', 'unreadable')) { return 'repair' }
    return 'observe'
}

function Get-SessionOutcome {
    param([object[]]$Checks, [bool]$Changed, [bool]$PendingReboot = $false, [bool]$Recovery = $false)
    $relevant = @($Checks | Where-Object { $_.essential })
    if ($relevant.Count -eq 0) { return 'inconclusive' }
    if (@($relevant | Where-Object { $_.status -ne 'healthy' }).Count -gt 0) { return 'attention' }
    if ($PendingReboot -or ($Recovery -and $Changed)) { return 'pending_verification' }
    if ($Changed) { return 'repaired_checks_verified' }
    return 'checks_healthy'
}

function Get-IsWinPE {
    return (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Control\MiniNT')
}

function Get-IsAdministrator {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-TargetWindows {
    param([bool]$Recovery)
    if (-not $Recovery) { return @($env:SystemDrive + '\') }
    $found = @()
    foreach ($drive in [IO.DriveInfo]::GetDrives()) {
        if (-not $drive.IsReady -or $drive.Name -eq ($env:SystemDrive + '\')) { continue }
        if ((Test-Path -LiteralPath ($drive.Name + 'Windows\System32\Config\SYSTEM')) -and
            (Test-Path -LiteralPath ($drive.Name + 'Windows\System32\Config\SOFTWARE'))) {
            try {
                $disk = Get-Partition -DriveLetter $drive.Name.Substring(0,1) -ErrorAction Stop | Get-Disk -ErrorAction Stop
                if ($disk.BusType -eq 'USB') { continue }
            } catch { continue }
            $found += $drive.Name
        }
    }
    return $found
}

function Get-PendingReboot {
    foreach ($path in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) {
        if (Test-Path $path) { return $true }
    }
    return $false
}

function Invoke-NativeLogged {
    param([string]$File, [string[]]$Arguments, [string]$LogBase, [int]$TimeoutSeconds = 3600, [switch]$MayWrite)
    if (-not (Test-Path -LiteralPath $File)) { throw "Ferramenta nao encontrada: $File" }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File
    $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $p = New-Object Diagnostics.Process
    $p.StartInfo = $info
    $out = [IO.File]::Open($LogBase + '.out.log', 'Create', 'Write', 'ReadWrite')
    $err = [IO.File]::Open($LogBase + '.err.log', 'Create', 'Write', 'ReadWrite')
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $timedOut = $false
    try {
        if (-not $p.Start()) { throw 'Falha ao iniciar ferramenta.' }
        $t1 = $p.StandardOutput.BaseStream.CopyToAsync($out)
        $t2 = $p.StandardError.BaseStream.CopyToAsync($err)
        if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
            if (-not $MayWrite) { $timedOut = $true; $p.Kill(); $p.WaitForExit() }
            else {
                # Nunca interromper servicing/instalador no meio de uma gravacao.
                [IO.File]::WriteAllText($LogBase + '.long-running.txt', 'A ferramenta ultrapassou o tempo previsto. Aguardando finalizacao para evitar interromper gravacao.')
                $p.WaitForExit()
            }
        }
        [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($t1, $t2))
        $exit = $p.ExitCode
    } finally { $out.Dispose(); $err.Dispose(); $p.Dispose(); $watch.Stop() }
    $text = (Read-NativeText ($LogBase + '.out.log')) + "`n" + (Read-NativeText ($LogBase + '.err.log'))
    return [pscustomobject]@{ exitCode = $exit; timedOut = $timedOut; text = $text; seconds = [math]::Round($watch.Elapsed.TotalSeconds); log = [IO.Path]::GetFileName($LogBase) }
}

function Get-SafeAiSummary {
    param($State)
    # Nenhum log bruto, serial, nome de usuario ou arquivo pessoal sai do computador.
    return [ordered]@{ mode = $State.mode; recovery = $State.recovery; outcome = $State.outcome;
        checks = @($State.checks | ForEach-Object { @{ id = $_.id; status = $_.status } });
        actions = @($State.actions | ForEach-Object { @{ id = $_.id; exitCode = $_.exitCode } }) }
}

Export-ModuleMember -Function *
