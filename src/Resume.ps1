param([Parameter(Mandatory)] [string]$Session)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Core.psm1') -Force
$state = Read-JsonFile (Join-Path $Session 'state.json')
$taskName = 'DillResgate-' + $state.id
try {
    if ([int]$state.reboots -ge 1) { throw 'A verificacao automatica apos reinicio ja foi executada.' }
    & (Join-Path $PSScriptRoot 'Worker.ps1') -Session $Session -Mode Diagnose -Resume
} finally { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue }
