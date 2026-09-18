param([ValidateSet('Repair','Diagnose','Apps','View')] [string]$Mode = 'Repair')
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Core.psm1') -Force
$root = Split-Path $PSScriptRoot
if ($env:OS -ne 'Windows_NT') { throw 'Este programa executa reparos apenas no Windows.' }
if (-not [Environment]::Is64BitProcess -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Use Windows x64 e PowerShell de 64 bits. Windows ARM e 32 bits nao sao suportados nesta versao.' }
$powershell = Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Get-IsAdministrator)) {
    try {
        $args = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-NativeArgument $PSCommandPath) + ' -Mode ' + $Mode
        Start-Process -FilePath $powershell -ArgumentList $args -Verb RunAs -ErrorAction Stop | Out-Null
        exit
    } catch { throw 'A permissao de administrador nao foi concedida. Nenhum reparo foi iniciado.' }
}
$mutex = New-Object Threading.Mutex($false, 'Global\DillResgate-v01')
$acquired = $false
try {
    try { $acquired = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired = $true }
    if (-not $acquired) { throw 'Ja existe um atendimento/painel aberto. Use a janela existente.' }
    $pe = Get-IsWinPE
    if ($pe) {
        $base = Join-Path $root 'atendimentos'
        New-Item -ItemType Directory -Path $base -Force | Out-Null
        $runRoot = $root
        if ($Mode -ne 'Diagnose') { $Mode = 'Recovery' }
    } else {
        $base = Join-Path $env:ProgramData 'DillResgate'
        if ((Test-Path -LiteralPath $base) -and ((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'A pasta de trabalho e um link. Use uma pasta real.' }
        New-Item -ItemType Directory -Path $base -Force | Out-Null
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true,$false)
        foreach ($pair in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@('S-1-5-32-545','ReadAndExecute'))) {
            $sid = New-Object Security.Principal.SecurityIdentifier($pair[0])
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid,$pair[1],'ContainerInherit,ObjectInherit','None','Allow')
            $acl.AddAccessRule($rule)
        }
        $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
        Set-Acl -LiteralPath $base -AclObject $acl
        $runRoot = Join-Path $base ('app-' + [guid]::NewGuid().ToString('N'))
        if ($Mode -ne 'View') {
            New-Item -ItemType Directory -Path $runRoot | Out-Null
            foreach ($item in @('src','web','config.json')) { Copy-Item -LiteralPath (Join-Path $root $item) -Destination $runRoot -Recurse -Force }
        }
    }
    $latest = Join-Path $base 'latest-session.txt'
    if ($Mode -eq 'View') {
        if (-not (Test-Path -LiteralPath $latest)) { throw 'Ainda nao existe um atendimento salvo neste computador.' }
        $session = [IO.File]::ReadAllText($latest).Trim()
        if (-not [IO.Path]::GetFullPath($session).StartsWith([IO.Path]::GetFullPath($base) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho de atendimento invalido.' }
        $previous = Read-JsonFile (Join-Path $session 'state.json')
        if ($null -eq $previous) { throw 'Relatorio nao encontrado.' }
        $runRoot = $root
    } else {
        $id = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
        $session = Join-Path $base ('sessao-' + $id)
        New-Item -ItemType Directory -Path (Join-Path $session 'logs') -Force | Out-Null
        $s = [ordered]@{
            version='0.2.0'; id=$id; mode=$Mode; recovery=$pe; status='starting'; outcome='running';
            startedAt=(Get-Date).ToString('o'); updatedAt=(Get-Date).ToString('o'); currentStep='Preparando atendimento';
            machine=@{name=$env:COMPUTERNAME;windowsDrive='';freeGB=$null;diskHealth='unknown';diskNumber=$null};
            checks=@(); actions=@(); events=@(); notes=@(); changed=$false; reboots=0; aiComment=''
        }
        Write-JsonAtomic (Join-Path $session 'state.json') $s
        [IO.File]::WriteAllText($latest,$session)
        $worker = Join-Path $runRoot 'src\Worker.ps1'
        $args = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-NativeArgument $worker) + ' -Session ' + (ConvertTo-NativeArgument $session) + ' -Mode ' + $Mode
        Start-Process -FilePath $powershell -ArgumentList $args -WindowStyle Minimized -PassThru | Out-Null
    }
    & (Join-Path $runRoot 'src\Server.ps1') -Session $session -AppRoot $runRoot
} catch {
    Write-Host ('Nao foi possivel iniciar: ' + $_.Exception.Message) -ForegroundColor Red
    Read-Host 'Pressione Enter para fechar' | Out-Null
    exit 1
} finally { if ($acquired) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
