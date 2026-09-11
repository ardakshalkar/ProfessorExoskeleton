@echo off
rem `ainar` — the AINAR course model CLI, in TypeScript, run straight from
rem source. See bin/ainar for the full note.
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
  echo ainar: cannot find node.exe. It is not on PATH and not in the usual 1>&2
  echo   places. Set AINAR_NODE to its full path and run this again. 1>&2
  exit /b 127
)

rem The same harness home bin\sample uses, so a token typed into the pane is
rem the token this CLI finds. The pane stores credentials in
rem %DSH_HOME%\.credentials.yaml; without this, ainar would read ~\.dsh and
rem report no token while the pane showed one saved. Only when unset - an
rem exported DSH_HOME is a deliberate choice about which home to read.
if not defined DSH_HOME if exist "%~dp0..\.dsh" set "DSH_HOME=%~dp0..\.dsh"

"%NODE_EXE%" --experimental-strip-types "%~dp0..\ainar-node\bin\ainar.ts" %*
exit /b %ERRORLEVEL%

:pick
if exist "%~1" set "NODE_EXE=%~1"
goto :eof
