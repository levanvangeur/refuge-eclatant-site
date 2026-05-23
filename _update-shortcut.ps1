$scriptCmd = @'
Set-Location 'C:\Users\Admin\Code\Site_accueil_courte_duree\clair-obscur-site'
Write-Host 'Arret ancien serveur sur port 3000...' -ForegroundColor Yellow
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
if ($pid3000) {
    Stop-Process -Id $pid3000 -Force
    Start-Sleep 1
    Write-Host 'Port 3000 libere.' -ForegroundColor Green
}
Write-Host ''
Write-Host 'Demarrage Clair-Obscur LOCAL...' -ForegroundColor Cyan
Write-Host 'Adresse : http://localhost:3000' -ForegroundColor White
Write-Host 'Ne fermez pas cette fenetre !' -ForegroundColor Yellow
Write-Host ''
Start-Sleep 2
Start-Process 'http://localhost:3000'
& 'C:\Program Files\nodejs\node.exe' backend/server.js
'@

$ws = New-Object -COM WScript.Shell
$sc = $ws.CreateShortcut('C:\Users\Admin\Desktop\Clair-Obscur LOCAL.lnk')
$sc.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$sc.Arguments = "-NoExit -Command `"$scriptCmd`""
$sc.WorkingDirectory = 'C:\Users\Admin\Code\Site_accueil_courte_duree\clair-obscur-site'
$sc.IconLocation = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe,0'
$sc.Save()
Write-Host 'Raccourci mis a jour avec succes !' -ForegroundColor Green
