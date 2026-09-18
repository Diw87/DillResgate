param(
    [Parameter(Mandatory)] [string]$Session,
    [ValidateSet('Repair','Diagnose','Apps','Recovery')] [string]$Mode = 'Repair',
    [switch]$Resume
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Core.psm1') -Force

$root = Split-Path $PSScriptRoot
$config = Read-JsonFile (Join-Path $root 'config.json')
$statePath = Join-Path $Session 'state.json'
$state = Read-JsonFile $statePath
$logs = Join-Path $Session 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$changed = $false
$needReboot = $false
$commandNumber = 0

function Save-State {
    $state.updatedAt = (Get-Date).ToString('o')
    Write-JsonAtomic $statePath $state
}
function Set-Step([string]$Text) {
    $state.currentStep = $Text
    $state.status = 'running'
    Save-State
}
function Add-Note([string]$Text) {
    $state.notes = @($state.notes) + @($Text)
    Save-State
}
function Add-Check([string]$Id,[string]$Name,[string]$Status,[string]$Detail,[bool]$Essential=$true) {
    $state.checks = @($state.checks | Where-Object { $_.id -ne $Id })
    $state.checks = @($state.checks) + @([pscustomobject]@{id=$Id;name=$Name;status=$Status;detail=$Detail;essential=$Essential})
    Save-State
}
function Run-Native([string]$Exe,[string[]]$Arguments,[string]$Label,[bool]$Writes=$false) {
    $script:commandNumber++
    $base = Join-Path $logs (('{0:D2}-' -f $script:commandNumber) + ($Label -replace '[^a-zA-Z0-9_-]','_'))
    $result = Invoke-NativeLogged -File $Exe -Arguments $Arguments -LogBase $base -TimeoutSeconds ([int]$config.readOnlyCommandTimeoutSeconds) -MayWrite:$Writes
    $state.actions = @($state.actions) + @([pscustomobject]@{
        id=$Label; exitCode=$result.exitCode; seconds=$result.seconds; timedOut=$result.timedOut; log=$result.log
    })
    Save-State
    return $result
}
function System32([string]$Name) { Join-Path ($env:windir + '\System32') $Name }

function Inspect-Storage {
    Set-Step 'Verificando armazenamento'
    $drive = Get-PSDrive -Name $env:SystemDrive.Substring(0,1) -ErrorAction Stop
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    $state.machine.windowsDrive = $env:SystemDrive
    $state.machine.freeGB = $freeGB
    $min = [double]$config.minimumFreeGB
    if ($freeGB -lt $min) {
        Add-Check 'space' 'Espaco livre' 'attention' ("Somente $freeGB GB livres. Recomendado pelo menos $min GB.")
    } else {
        Add-Check 'space' 'Espaco livre' 'healthy' ("$freeGB GB livres.")
    }
    try {
        $partition = Get-Partition -DriveLetter $env:SystemDrive.Substring(0,1) -ErrorAction Stop
        $disk = $partition | Get-Disk -ErrorAction Stop
        $state.machine.diskNumber = $disk.Number
        $health = [string]$disk.HealthStatus
        $state.machine.diskHealth = $health
        if ($health -and $health -notmatch 'Healthy|Saud') {
            Add-Check 'disk' 'Saude do disco' 'attention' ("Windows informa: $health")
        } else {
            Add-Check 'disk' 'Saude do disco' 'healthy' 'Sem alerta de saude reportado pelo Windows.'
        }
    } catch {
        Add-Check 'disk' 'Saude do disco' 'unknown' 'Nao foi possivel consultar a saude fisica do disco.' $false
    }
}

function Inspect-Events {
    Set-Step 'Analisando eventos recentes'
    try {
        $since = (Get-Date).AddDays(-3)
        $critical = @(Get-WinEvent -FilterHashtable @{LogName='System';StartTime=$since;Level=1,2} -ErrorAction Stop |
            Select-Object -First 80)
        $kp = @($critical | Where-Object { $_.Id -eq 41 }).Count
        $diskErrors = @($critical | Where-Object { $_.ProviderName -match 'disk|stor|nvme|ntfs' }).Count
        if ($kp -gt 0 -or $diskErrors -gt 0) {
            Add-Check 'events' 'Eventos do sistema' 'attention' ("Ultimos 3 dias: $kp Kernel-Power 41; $diskErrors eventos de disco/armazenamento.")
        } else {
            Add-Check 'events' 'Eventos do sistema' 'healthy' 'Nenhum alerta critico selecionado nos ultimos 3 dias.' $false
        }
    } catch {
        Add-Check 'events' 'Eventos do sistema' 'unknown' 'Nao foi possivel ler o log do Sistema.' $false
    }
}

function Inspect-Dism {
    Set-Step 'Verificando imagem do Windows'
    $dism = System32 'dism.exe'
    $check = Run-Native $dism @('/Online','/Cleanup-Image','/CheckHealth','/English') 'dism-check'
    $finding = Get-DismFinding $check.text $check.exitCode
    if ($finding -eq 'healthy') {
        Add-Check 'dism' 'Imagem do Windows (DISM)' 'healthy' 'Armazenamento de componentes sem corrupcao detectada.'
        return
    }
    if ($Mode -eq 'Diagnose') {
        Add-Check 'dism' 'Imagem do Windows (DISM)' 'attention' ("Resultado: $finding. Modo diagnostico nao altera o sistema.")
        return
    }
    Set-Step 'Reparando imagem do Windows'
    $repair = Run-Native $dism @('/Online','/Cleanup-Image','/RestoreHealth','/English') 'dism-restore' $true
    if ($repair.exitCode -in @(0,3010)) {
        $script:changed = $true
        if ($repair.exitCode -eq 3010) { $script:needReboot = $true }
        Add-Check 'dism' 'Imagem do Windows (DISM)' 'healthy' 'DISM concluiu o reparo sem erro fatal.'
    } else {
        Add-Check 'dism' 'Imagem do Windows (DISM)' 'attention' ("DISM retornou codigo $($repair.exitCode). Consulte o log.")
    }
}

function Inspect-Sfc {
    Set-Step 'Verificando arquivos protegidos do Windows'
    $sfc = System32 'sfc.exe'
    if ($Mode -eq 'Diagnose') {
        $result = Run-Native $sfc @('/verifyonly') 'sfc-verify'
    } else {
        $result = Run-Native $sfc @('/scannow') 'sfc-scan' $true
    }
    $finding = Get-SfcFinding $result.text $result.exitCode
    if ($finding -in @('healthy','repaired')) {
        if ($finding -eq 'repaired') { $script:changed = $true }
        Add-Check 'sfc' 'Arquivos protegidos (SFC)' 'healthy' ("Resultado: $finding.")
    } elseif ($result.exitCode -eq 0 -and $Mode -eq 'Diagnose') {
        Add-Check 'sfc' 'Arquivos protegidos (SFC)' 'attention' 'O SFC encontrou algo que precisa de revisao; nenhum reparo foi aplicado.'
    } else {
        Add-Check 'sfc' 'Arquivos protegidos (SFC)' 'attention' ("Resultado: $finding; codigo $($result.exitCode).")
    }
}

function Update-Apps {
    Set-Step 'Atualizando aplicativos'
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        Add-Check 'apps' 'Atualizacao de aplicativos' 'unknown' 'winget nao esta instalado.' $false
        return
    }
    $result = Run-Native $winget.Source @('upgrade','--all','--silent','--accept-package-agreements','--accept-source-agreements','--disable-interactivity') 'winget-upgrade' $true
    if ($result.exitCode -eq 0) {
        Add-Check 'apps' 'Atualizacao de aplicativos' 'healthy' 'winget concluiu a rotina de atualizacao.' $false
    } else {
        Add-Check 'apps' 'Atualizacao de aplicativos' 'attention' ("winget retornou codigo $($result.exitCode).") $false
    }
}

function Write-Report {
    $report = Join-Path $Session 'RELATORIO.txt'
    $lines = New-Object Collections.Generic.List[string]
    $lines.Add('DILL RESGATE v0.2')
    $lines.Add('Atendimento: ' + $state.id)
    $lines.Add('Inicio: ' + $state.startedAt)
    $lines.Add('Fim: ' + (Get-Date).ToString('o'))
    $lines.Add('Modo: ' + $state.mode)
    $lines.Add('Resultado: ' + $state.outcome)
    $lines.Add('')
    $lines.Add('VERIFICACOES')
    foreach ($c in @($state.checks)) { $lines.Add(('[{0}] {1} - {2}' -f $c.status,$c.name,$c.detail)) }
    $lines.Add('')
    $lines.Add('OBSERVACOES')
    foreach ($n in @($state.notes)) { $lines.Add([string]$n) }
    [IO.File]::WriteAllLines($report,$lines,(New-Object Text.UTF8Encoding($false)))
}

try {
    Set-Step 'Iniciando diagnostico'
    if ($Mode -eq 'Apps') {
        Update-Apps
    } else {
        Inspect-Storage
        Inspect-Events
        if (-not [bool]$state.recovery) {
            Inspect-Dism
            Inspect-Sfc
        } else {
            Add-Note 'Modo WinPE detectado. Esta versao preserva o sistema offline e evita reparos ambiguos automaticamente.'
            Add-Check 'recovery' 'Ambiente de resgate' 'healthy' 'WinPE detectado; diagnostico seguro ativo.' $false
        }
    }
    $state.changed = $changed
    $state.outcome = Get-SessionOutcome @($state.checks) $changed $needReboot ([bool]$state.recovery)
    $state.status = 'completed'
    $state.currentStep = if ($needReboot) { 'Concluido - reinicio recomendado' } else { 'Concluido' }
    if ($needReboot) { Add-Note 'O Windows solicitou reinicio para concluir uma operacao.' }
} catch {
    $state.status = 'failed'
    $state.outcome = 'attention'
    $state.currentStep = 'Falha controlada'
    $state.notes = @($state.notes) + @('Erro: ' + $_.Exception.Message)
} finally {
    Save-State
    Write-Report
}
