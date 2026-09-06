@echo off
rem `deck` — render an approved slide deck to .pptx, and with --pdf to PDF too.
rem
rem   bin\deck --course-version CSS-4007-2026-FALL --document DOC-DECK-01 --pdf
rem   bin\deck --course-version … --document … --root "C:\path\to\workspace" --pdf
rem
rem This launcher exists because the renderer did not have one. `render-deck.ts`
rem has worked since it was ported and LibreOffice has been installed the whole
rem time, but reaching either meant knowing the file was there and spelling out
rem `node --experimental-strip-types <checkout>\ainar-node\bin\render-deck.ts`.
rem So the decks for weeks 1 to 7 were converted by calling soffice by hand — a
rem step with code behind it and no command in front of it, which is the same
rem shape of problem as reading a formula instead of running it.
rem
rem Node is located the way bin\ainar.cmd locates it, and for the same reason:
rem the shell an agent gets does not carry the login profile's PATH.
setlocal EnableExtensions
set "NODE_EXE="

if defined AINAR_NODE if exist "%AINAR_NODE%" set "NODE_EXE=%AINAR_NODE%"

if not defined NODE_EXE for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"

if not defined NODE_EXE call :pick "%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE call :pick "%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE call :pick "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE call :pick "%APPDATA%\nvm\node.exe"
if not defined NODE_EXE call :pick "C:\nvm4w\nodejs\node.exe"

if not defined NODE_EXE (
  echo deck: cannot find node.exe. It is not on PATH and not in the usual 1>&2
  echo   places. Set AINAR_NODE to its full path and run this again. 1>&2
  exit /b 127
)

rem LibreOffice does the PDF conversion and is found the same way — see SOFFICE
rem in render-deck.ts. Setting it here means the renderer does not have to guess
rem when the professor installed it somewhere unusual.
if not defined SOFFICE_PATH call :soffice "%ProgramFiles%\LibreOffice\program\soffice.exe"
if not defined SOFFICE_PATH call :soffice "%ProgramFiles(x86)%\LibreOffice\program\soffice.exe"

"%NODE_EXE%" --experimental-strip-types "%~dp0..\ainar-node\bin\render-deck.ts" %*
exit /b %ERRORLEVEL%

:pick
if exist "%~1" set "NODE_EXE=%~1"
goto :eof

:soffice
if exist "%~1" set "SOFFICE_PATH=%~1"
goto :eof
