@echo off
rem The `pres` CLI for Windows shells that are not Git Bash.
rem See the sibling `pres` script for the reasoning; how TypeScript actually
rem gets run is node\bin\pres.mjs's problem, not this file's.

setlocal
set "ENTRY=%~dp0..\node\bin\pres.mjs"

if not "%PRES_NODE%"=="" (
    "%PRES_NODE%" "%ENTRY%" %*
    exit /b %errorlevel%
)

where node >nul 2>&1 && (
    node "%ENTRY%" %*
    exit /b %errorlevel%
)

1>&2 echo pres: no Node on PATH.
1>&2 echo This plugin runs TypeScript directly, which needs Node 22.6 or later.
1>&2 echo Install a current Node, or set PRES_NODE to one.
exit /b 127
