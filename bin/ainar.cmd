@echo off
rem `ainar` — the AINAR course model CLI, in TypeScript, run straight from
rem source. See bin/ainar for the full note.
rem
rem   bin\ainar validate CSS-4008
rem   bin\ainar inbox CSS-4008-2026-FALL --root C:\path\to\workspace
setlocal
node --experimental-strip-types "%~dp0..\ainar-node\bin\ainar.ts" %*
exit /b %ERRORLEVEL%
