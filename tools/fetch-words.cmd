@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0.."

rem ============================================================
rem  fetch-words.cmd - fetch words from Oxford / Collins
rem  Both are fetched straight from the official websites.
rem  Oxford is the recommended default (fast, plain requests).
rem  Collins needs playwright-core (npm package) and a local
rem  Chrome/Edge. This script installs playwright-core on the
rem  first run automatically.
rem  NOTE: keep this file pure ASCII - batch files are parsed
rem  with the OEM codepage and non-ASCII text corrupts parsing.
rem ============================================================

set NODE=node
where node >nul 2>nul
if errorlevel 1 set NODE="C:\Program Files\nodejs\node.exe"

rem --- first run: make sure playwright-core is available --------
rem (only needed for Collins; Oxford works without it)
if not exist "node_modules\playwright-core" (
  echo  First run: installing playwright-core, please wait...
  echo  ^(needed for Collins; Oxford works without it^)
  where npm >nul 2>nul
  if errorlevel 1 (
    echo  npm was not found - skipping. Collins will not work until
    echo  you install Node.js ^(https://nodejs.org^) and run:
    echo     npm install playwright-core
    echo  Oxford fetching works fine without it - choose dictionary 1.
  ) else (
    call npm install playwright-core --no-fund --no-audit
    if errorlevel 1 echo  npm install failed - Collins will not work; Oxford still will.
  )
  echo.
)

echo ============================================================
echo   LexForge - fetch words from Oxford / Collins
echo ============================================================
echo.
echo  Pulls senses, collocations and phonetics, then copies a JSON
echo  pack to your CLIPBOARD automatically. Paste that into the app:
echo  Import -^> Paste a word pack. It lands in your LIBRARY - not in
echo  a word bank. From there open the Library button, tick the words
echo  you want, and add them to a bank one card at a time.
echo.
echo  Mastery and weakness are NOT asked here - you set them
echo  while adding to a bank.
echo.
echo ------------------------------------------------------------
echo  Type ONE line: an optional dictionary number, then the words.
echo.
echo     [dict] ^<word^> ^<word^> ...
echo.
echo     dict   1 Oxford Learner's Dictionary (default - RECOMMENDED, fast)
echo            2 Collins official site (slower: ~10s per word, uses a
echo              hidden browser window)
echo.
echo  Examples
echo     1 book run              (Oxford)
echo     2 scout resilient       (Collins)
echo     mitigate                (no number = Oxford)
echo.
echo  Tip: start with Oxford - it is seconds per word. Use Collins
echo  when you want its definitions specifically.
echo.
echo  Type q and press Enter to quit.
echo ------------------------------------------------------------
echo.

set "LINE=%*"
rem Launched from the browser protocol (lexforge-fetch:...) -- the URL is not
rem a word line. Drop it and fall through to the normal prompt.
rem (checks position 0 and 1: some browsers wrap the URL in quotes)
if /i "!LINE:~0,15!"=="lexforge-fetch:" set "LINE="
if /i "!LINE:~1,15!"=="lexforge-fetch:" set "LINE="
if not "!LINE!"=="" (
  echo  Line: !LINE!
  goto fetch
)

set "LINE="
set /p "LINE=  > "
if "!LINE!"=="" goto nowords
if /i "!LINE!"=="q" goto nowords

:fetch
set OUT=wordpack-%RANDOM%%RANDOM%.json

echo.
echo Fetching, please wait...
echo.
%NODE% tools\fetch-words.js --line="!LINE!" --out="!OUT!"

echo.
echo ------------------------------------------------------------
if exist "!OUT!" (
  echo  Pack saved to:  %CD%\!OUT!
  echo  The pack is also on your CLIPBOARD -
  echo  just press Ctrl+V in the app:  Import -^> Paste a word pack
) else (
  echo  No pack was written - check the messages above.
)
echo ------------------------------------------------------------
echo.
echo Press any key to close.
pause >nul
goto :eof

:nowords
echo.
echo  Nothing entered - nothing to do.
echo.
pause >nul
