# ────────────────────────────────────────────────────────────
#  Ouvre l'éditeur du livret « Le Refuge Éclatant »
#  (aperçu + édition + bouton Publier, tout au même endroit)
# ────────────────────────────────────────────────────────────
$ErrorActionPreference = 'SilentlyContinue'
Set-Location -Path $PSScriptRoot

$port = 4003
$env:EDITOR_PORT = "$port"
$env:APP_NAME = "Le Refuge Éclatant"

Write-Host ""
Write-Host "  Arret d'un eventuel ancien editeur sur le port $port..." -ForegroundColor Yellow
$p = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
if ($p) { Stop-Process -Id $p -Force; Start-Sleep 1 }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Editeur du livret : Le Refuge Éclatant" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Interface : http://localhost:$port" -ForegroundColor White
Write-Host "   Ne fermez pas cette fenetre pendant l'edition." -ForegroundColor Yellow
Write-Host ""

Start-Sleep 1
Start-Process "http://localhost:$port"
& 'C:\Program Files\nodejs\node.exe' editor/server.js
