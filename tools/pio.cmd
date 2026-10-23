@echo off
setlocal
rem Prefer an existing PATH installation; some managed workstations block
rem executables in virtual-environment directories while allowing this one.
set "OT_PATH_PIO="
for /f "delims=" %%P in ('where platformio.exe 2^>nul') do if not defined OT_PATH_PIO set "OT_PATH_PIO=%%P"
if defined OT_PATH_PIO goto path_pio
set "WORKSPACE_PIO=%~dp0..\..\.pio-core\penv\Scripts\platformio.exe"
set "USER_PIO=%USERPROFILE%\.platformio\penv\Scripts\platformio.exe"
if exist "%USER_PIO%" goto user_pio
if exist "%WORKSPACE_PIO%" goto workspace_pio
echo No healthy PlatformIO virtual-environment executable was found. 1>&2
exit /b 1

:path_pio
"%OT_PATH_PIO%" %*
exit /b %ERRORLEVEL%

:user_pio
"%USER_PIO%" %*
exit /b %ERRORLEVEL%

:workspace_pio
"%WORKSPACE_PIO%" %*
exit /b %ERRORLEVEL%
