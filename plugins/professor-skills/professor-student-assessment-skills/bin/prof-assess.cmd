@echo off
setlocal
set "ENTRY=%~dp0..\node\bin\prof-assess.mjs"
if not "%PROF_ASSESS_NODE%"=="" (
  "%PROF_ASSESS_NODE%" "%ENTRY%" %*
  exit /b %errorlevel%
)
where node >nul 2>&1 && (
  node "%ENTRY%" %*
  exit /b %errorlevel%
)
1>&2 echo prof-assess: Node 22.6 or later is required.
exit /b 127
