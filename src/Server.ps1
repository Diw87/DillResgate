param(
    [Parameter(Mandatory)] [string]$Session,
    [Parameter(Mandatory)] [string]$AppRoot
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Core.psm1') -Force

$config = Read-JsonFile (Join-Path $AppRoot 'config.json')
$port = [int]$config.port
if ($port -lt 1024 -or $port -gt 65535) { throw 'Porta invalida em config.json.' }
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$listener = New-Object Net.HttpListener
$web = Join-Path $AppRoot 'web'

function Send-Bytes($Context,[int]$Code,[string]$Type,[byte[]]$Bytes) {
    $Context.Response.StatusCode = $Code
    $Context.Response.ContentType = $Type
    $Context.Response.Headers['Cache-Control'] = 'no-store'
    $Context.Response.ContentLength64 = $Bytes.Length
    if ($Context.Request.HttpMethod -ne 'HEAD') {
        $Context.Response.OutputStream.Write($Bytes,0,$Bytes.Length)
    }
    $Context.Response.OutputStream.Close()
}
function Send-Text($Context,[int]$Code,[string]$Type,[string]$Text) {
    Send-Bytes $Context $Code $Type ([Text.Encoding]::UTF8.GetBytes($Text))
}
function Send-Json($Context,[int]$Code,$Value) {
    Send-Text $Context $Code 'application/json; charset=utf-8' (ConvertTo-Json $Value -Depth 15 -Compress)
}
function Is-Authorized($Request) {
    $candidate = [string]$Request.Headers['X-Dill-Token']
    if ([string]::IsNullOrWhiteSpace($candidate)) { $candidate = [string]$Request.QueryString['token'] }
    if ($candidate.Length -ne $token.Length) { return $false }
    $a = [Text.Encoding]::UTF8.GetBytes($candidate)
    $b = [Text.Encoding]::UTF8.GetBytes($token)
    $diff = 0
    for ($i=0; $i -lt $a.Length; $i++) { $diff = $diff -bor ($a[$i] -bxor $b[$i]) }
    return ($diff -eq 0)
}
function Mime([string]$Path) {
    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.css'  { 'text/css; charset=utf-8' }
        '.js'   { 'application/javascript; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.svg'  { 'image/svg+xml' }
        '.png'  { 'image/png' }
        default { 'application/octet-stream' }
    }
}

$prefix = "http://127.0.0.1:$port/"
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    if ($_.Exception.Message -match 'conflict|conflito|already') {
        throw "A porta $port ja esta em uso. Feche outra instancia do Dill Resgate."
    }
    throw
}

$url = $prefix + '?token=' + $token
Write-Host ''
Write-Host 'DILL RESGATE v0.2' -ForegroundColor Cyan
Write-Host ('Painel local: ' + $prefix) -ForegroundColor Green
Write-Host 'O painel abre automaticamente no navegador. Mantenha esta janela aberta.'
Write-Host ''
try { Start-Process $url | Out-Null } catch { Write-Host ('Abra manualmente: ' + $url) }

$running = $true
try {
    while ($running -and $listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)

            if ($path -eq '/health') {
                Send-Json $context 200 @{ok=$true;version='0.2.0'}
                continue
            }

            if ($path.StartsWith('/api/')) {
                if (-not (Is-Authorized $request)) {
                    Send-Json $context 401 @{error='nao autorizado'}
                    continue
                }
                if ($path -eq '/api/state') {
                    $state = Read-JsonFile (Join-Path $Session 'state.json')
                    Send-Json $context 200 $state
                    continue
                }
                if ($path -eq '/api/report') {
                    $report = Join-Path $Session 'RELATORIO.txt'
                    if (Test-Path -LiteralPath $report) {
                        Send-Text $context 200 'text/plain; charset=utf-8' ([IO.File]::ReadAllText($report))
                    } else {
                        Send-Text $context 200 'text/plain; charset=utf-8' 'Relatorio ainda nao concluido.'
                    }
                    continue
                }
                if ($path -eq '/api/stop' -and $request.HttpMethod -eq 'POST') {
                    Send-Json $context 200 @{ok=$true}
                    $running = $false
                    continue
                }
                Send-Json $context 404 @{error='endpoint nao encontrado'}
                continue
            }

            if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
            $relative = $path.TrimStart('/') -replace '/','\'
            if ($relative.Contains('..')) {
                Send-Text $context 400 'text/plain' 'Caminho invalido.'
                continue
            }
            $file = Join-Path $web $relative
            $fullWeb = [IO.Path]::GetFullPath($web)
            $fullFile = [IO.Path]::GetFullPath($file)
            if (-not $fullFile.StartsWith($fullWeb,[StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $fullFile -PathType Leaf)) {
                Send-Text $context 404 'text/plain; charset=utf-8' 'Arquivo nao encontrado.'
                continue
            }
            Send-Bytes $context 200 (Mime $fullFile) ([IO.File]::ReadAllBytes($fullFile))
        } catch {
            try { Send-Json $context 500 @{error='erro interno controlado'} } catch {}
        }
    }
} finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
