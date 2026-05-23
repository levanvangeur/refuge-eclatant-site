Set-Location $PSScriptRoot

Write-Host ''
Write-Host '  Clair-Obscur - Demarrage local' -ForegroundColor Cyan
Write-Host ''

# Libere le port 3000 si occupe
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn) {
    $pid3000 = $conn.OwningProcess | Select-Object -First 1
    Write-Host "  Port 3000 occupe (PID $pid3000) - arret en cours..." -ForegroundColor Yellow
    Stop-Process -Id $pid3000 -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
    Write-Host '  Port 3000 libere.' -ForegroundColor Green
}

Write-Host '  Adresse : http://localhost:3000' -ForegroundColor White
Write-Host '  Ne fermez pas cette fenetre !' -ForegroundColor Yellow
Write-Host ''

Start-Sleep 2
Start-Process 'http://localhost:3000'
& 'C:\Program Files\nodejs\node.exe' backend/server.js
