@echo off
setlocal
pushd "%~sdp0.."
if /I "%1"=="dev" (
  node .\node_modules\next\dist\bin\next dev --webpack
) else if /I "%1"=="build" (
  node .\node_modules\next\dist\bin\next build
) else if /I "%1"=="start" (
  node .\node_modules\next\dist\bin\next start
) else (
  node .\node_modules\next\dist\bin\next %*
)
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
