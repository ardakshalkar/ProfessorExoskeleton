@echo off
rem `deck-build` — run a hand-built deck script over the shared kit.
rem
rem   bin\deck-build build-week5-deck.ts [--out DIR]
rem
rem The script draws its slides by coordinate and imports nothing: the kit is
rem handed to it, because the script lives in a course workspace and the kit
rem lives in this checkout. See ainar-node/bin/build-deck.ts.
rem
rem   bin\ainar validate CSS-4008
rem   bin\ainar inbox CSS-4008-2026-FALL --root C:\path\to\workspace
rem
rem This used to be one line: `node --experimental-strip-types ...`. That works
rem in a terminal a person opened and fails in the shell an agent gets, whose
rem PATH is the sandbox's rather than the login profile's — the session log for
rem 2026-09-06 has it failing with "'node' is not recognized", after which the
rem agent spent four tool calls and twenty-two seconds hunting for node.exe on
rem its own. Twenty-two seconds on every turn that runs a command is worth these
rem twenty lines.
rem
rem Order: an explicit override, then PATH, then where the three installers this
rem machine might have used put it. AINAR_NODE is the escape hatch for a node
rem living somewhere none of them looked.
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
  echo deck-build: cannot find node.exe. It is not on PATH and not in the usual 1>&2
  echo   places. Set AINAR_NODE to its full path and run this again. 1>&2
  exit /b 127
)

"%NODE_EXE%" --experimental-strip-types "%~dp0..\ainar-node\bin\build-deck.ts" %*
exit /b %ERRORLEVEL%

:pick
if exist "%~1" set "NODE_EXE=%~1"
goto :eof
