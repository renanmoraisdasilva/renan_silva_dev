@echo off
rem Regenerates assets\output.css from src\input.css.
rem BROWSERSLIST_IGNORE_OLD_DATA silences the caniuse-lite staleness notice
rem the standalone binary prints on every run.
setlocal
set BROWSERSLIST_IGNORE_OLD_DATA=1
set ROOT=%~dp0..
pushd "%ROOT%" || exit /b 1

if not exist tools\tailwindcss.exe (
  echo.
  echo   tools\tailwindcss.exe is missing.
  echo   Download it from:
  echo   https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe
  echo   tools\ is gitignored, so a fresh clone will not have it.
  echo.
  popd
  exit /b 1
)

tools\tailwindcss.exe build -c tailwind.config.js -i src\input.css -o assets\output.css --minify
if errorlevel 1 (
  echo build failed
  popd
  exit /b 1
)
for %%f in (assets\output.css) do echo assets\output.css  %%~zf bytes
popd
