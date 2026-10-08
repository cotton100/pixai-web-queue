@echo off
setlocal
set "task_node=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%task_node%" set "task_node=node.exe"
"%task_node%" "%~dp0tools\api-probe.cjs"
echo.
pause
