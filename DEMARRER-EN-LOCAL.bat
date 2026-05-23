@echo off
cd /d "%~dp0"
echo Demarrage de Clair-Obscur...
echo.
echo Adresse voyageurs : http://localhost:3000
echo Adresse admin     : http://localhost:3000/admin
echo.
echo Ne fermez pas cette fenetre !
echo Pour arreter : CTRL+C
echo.
"C:\Program Files\nodejs\node.exe" backend\server.js
echo.
echo Serveur arrete.
pause