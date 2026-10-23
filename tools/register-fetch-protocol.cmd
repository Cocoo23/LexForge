@echo off
rem ============================================================
rem  register-fetch-protocol.cmd
rem  Run me ONCE. I register a lexforge-fetch:// protocol so the
rem  LexForge page can open the fetch window with one click
rem  (Import -> Open fetch tool), no folder hunting needed.
rem
rem  - HKCU only: no admin rights needed
rem  - If you move the LexForge folder, run me again
rem  - To undo: register-fetch-protocol.cmd -u
rem ============================================================
setlocal
rem %~dp0 is already ...\tools\ - the fetch cmd sits right here
set "TARGET=%~dp0fetch-words.cmd"

if /i "%~1"=="-u" goto unregister

reg add "HKCU\Software\Classes\lexforge-fetch" /ve /d "URL:LexForge Fetch" /f >nul
reg add "HKCU\Software\Classes\lexforge-fetch" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\lexforge-fetch\shell\open\command" /ve /t REG_SZ /d "\"%TARGET%\" \"%%1\"" /f

echo.
echo  Done. The lexforge-fetch:// protocol now points to:
echo    %TARGET%
echo.
echo  In LexForge: Import -^> "Open fetch tool". The browser will
echo  ask for permission the first time - tick "always allow".
echo  If you move the LexForge folder, run this script again.
echo.
pause
exit /b 0

:unregister
reg delete "HKCU\Software\Classes\lexforge-fetch" /f >nul 2>nul
echo  lexforge-fetch:// protocol removed.
pause
exit /b 0
