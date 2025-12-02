Param(
    [string]$Optimization = "Os"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
    Write-Error "emcc was not found. Run emsdk_env.ps1 in this terminal before running the build script."
}

$scriptPath = Join-Path $PSScriptRoot "scripts\build-wasm.mjs"
$args = @($scriptPath, "--opt", $Optimization)

& node @args
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
