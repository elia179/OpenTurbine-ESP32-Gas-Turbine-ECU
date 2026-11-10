@echo off
setlocal
rem Probe harmless --version calls before selecting a launcher. Managed PCs
rem may permit pio.exe but block platformio.exe from the same installation.
rem Run the requested operation only once; never retry a failed flash command.
set "OT_PATH_PIO="
for /f "delims=" %%P in ('where pio.exe 2^>nul') do call :probe "%%P"
for /f "delims=" %%P in ('where platformio.exe 2^>nul') do call :probe "%%P"
if defined OT_PATH_PIO goto launch
call :probe "%USERPROFILE%\.platformio\penv\Scripts\platformio.exe"
call :probe "%~dp0..\..\.pio-core\penv\Scripts\platformio.exe"
if defined OT_PATH_PIO goto launch
echo No working PlatformIO launcher was found on PATH or in the configured environments. 1>&2
exit /b 1

:launch
"%OT_PATH_PIO%" %*
exit /b %ERRORLEVEL%

:probe
if defined OT_PATH_PIO exit /b 0
if not exist "%~1" exit /b 0
"%~1" --version >nul 2>&1
if not "%ERRORLEVEL%"=="0" exit /b 0
set "OT_PATH_PIO=%~1"
exit /b 0
