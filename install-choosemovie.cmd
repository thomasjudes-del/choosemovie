@echo off
setlocal
title ChooseMovie - Installation ouverture directe
set "APPDIR=%LOCALAPPDATA%\ChooseMovie"
set "BASEURL=https://thomasjudes-del.github.io/choosemovie"

echo.
echo Installation de l'ouverture directe ChooseMovie...
echo Aucun droit administrateur n'est necessaire.
echo.

if not exist "%APPDIR%" mkdir "%APPDIR%"

curl.exe -L --fail "%BASEURL%/choosemovie-open.ps1" -o "%APPDIR%\choosemovie-open.ps1"
if errorlevel 1 goto :error

curl.exe -L --fail "%BASEURL%/choosemovie-protocol.reg" -o "%TEMP%\choosemovie-protocol.reg"
if errorlevel 1 goto :error

reg.exe import "%TEMP%\choosemovie-protocol.reg" >nul
if errorlevel 1 goto :error

echo.
echo OK - ChooseMovie peut maintenant ouvrir directement les dossiers et fichiers.
echo Tu peux fermer cette fenetre et revenir au site.
echo.
pause
exit /b 0

:error
echo.
echo L'installation a echoue.
echo.
pause
exit /b 1
