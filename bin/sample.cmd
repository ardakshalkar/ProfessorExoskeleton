@echo off
setlocal EnableDelayedExpansion

rem The front door.
rem
rem   bin\sample              boot the harness on the `sample` profile
rem   bin\sample --help       everything after the script name goes to dsh
rem
rem One thing has to be true before dsh boots, and it is a silent failure if it
rem is not: DSH_HOME must point at THIS project's .dsh, so the profile that
rem mounts the sample plugin is the one found rather than whatever is in the
rem user's home directory. Set it here and nowhere else.
rem
rem `setlocal` keeps DSH_HOME and SAMPLE_HOME out of the calling shell, so
rem running this script does not change the environment of the window it was
rem run from.

set "SAMPLE_HOME=%~dp0.."
pushd "%SAMPLE_HOME%" || exit /b 1
for %%I in (.) do set "SAMPLE_HOME=%%~fI"

set "DSH_HOME=%SAMPLE_HOME%\.dsh"

rem The pass-through list, and why it is a list rather than "load .env".
rem
rem The process environment is the TOP layer of dsh's credential resolution and
rem the one layer that is read-only by design. A key exported here would be
rem reported on the Models page as `source: env, writable: false`, and the UI
rem would refuse to change it. dsh reads this same .env itself as its own
rem `project-env` layer, where the managed store CAN override it — so the key is
rem better left in the file and never promoted.
rem
rem What is promoted is only what is not a secret: the model selection the
rem profile patch reads through !!js process.env. A value already set in the
rem environment wins, because a one-run override is intent.
for %%F in (".env.local" ".env") do (
  if exist "%SAMPLE_HOME%\%%~F" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%SAMPLE_HOME%\%%~F") do (
      if not "%%~B"=="" (
        if /i "%%A"=="SAMPLE_PROVIDER" if not defined SAMPLE_PROVIDER set "SAMPLE_PROVIDER=%%~B"
        if /i "%%A"=="SAMPLE_MODEL" if not defined SAMPLE_MODEL set "SAMPLE_MODEL=%%~B"
      )
    )
  )
)

set "DSH_BIN=%SAMPLE_HOME%\node_modules\@deepseek-ai\dsh\lib\bin.js"
if not exist "%DSH_BIN%" (
  echo sample: the harness is not installed in this checkout.
  echo   npm install --legacy-peer-deps
  echo The flag is required. See package.json's comments for why.
  popd & exit /b 1
)

node "%DSH_BIN%" --profile sample %*
set "CODE=!ERRORLEVEL!"
popd
exit /b %CODE%
