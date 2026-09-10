@echo off
REM Starts Lumina LMS in the background and returns your prompt immediately.
REM Companion to stop.bat. Safe to double-click or run from any directory.
setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Every Windows tool below is invoked by its full System32 path rather than by
REM bare name. Reason: find shares a name with a different GNU/coreutils tool
REM that Git for Windows also installs, and on a machine where that Git install
REM has been added to PATH ahead of System32 — which is common, and true of the
REM shell this script was actually developed and tested in — the bare name
REM silently resolves to the wrong program. Caught by hitting it directly rather
REM than by inspection: GNU find prints "No such file or directory" and exits at
REM the "already running?" check instead of doing a text search. A fully-qualified
REM path resolves the same way regardless of what else is on PATH.
set "SYS=%SystemRoot%\System32"
set "FIND=%SYS%\find.exe"
set "FINDSTR=%SYS%\findstr.exe"
set "TASKLIST=%SYS%\tasklist.exe"
set "NETSTAT=%SYS%\netstat.exe"
set "POWERSHELL=%SYS%\WindowsPowerShell\v1.0\powershell.exe"

set "PIDFILE=.lumina.pid"
set "LOGFILE=lumina-server.log"
set "ERRLOGFILE=lumina-server.err.log"
set "PORT=4400"

REM Pick up a custom PORT from .env if one is set there, same as the app itself
REM does (scripts\lib\env.mjs). Values are written as PORT="4400"; strip the
REM quotes so the number below is bare.
REM
REM %FINDSTR% is deliberately NOT quoted on the next line even though the path
REM itself is stored quoted-safe above. A quoted path inside a for/f command
REM substitution (the backtick form) breaks here — cmd.exe reports "The
REM directory name is invalid." and the loop body never runs. Confirmed this by
REM testing the quoted and unquoted forms side by side; System32 has no spaces
REM in it, so leaving it unquoted in this one spot is safe.
if exist ".env" (
  for /f "usebackq tokens=1,2 delims==" %%A in (`%FINDSTR% /b "PORT=" .env`) do set "RAWPORT=%%B"
  if defined RAWPORT (
    set "RAWPORT=!RAWPORT:"=!"
    if not "!RAWPORT!"=="" set "PORT=!RAWPORT!"
  )
)

REM Already running? Don't start a second copy on top of it.
if exist "%PIDFILE%" (
  set /p EXISTING_PID=<"%PIDFILE%"
  if defined EXISTING_PID (
    "%TASKLIST%" /FI "PID eq !EXISTING_PID!" 2>NUL | "%FIND%" "!EXISTING_PID!" >NUL
    if !ERRORLEVEL! EQU 0 (
      echo Lumina LMS is already running ^(PID !EXISTING_PID!^).
      echo   http://localhost:!PORT!
      echo Run stop.bat first if you want to restart it.
      exit /b 0
    )
  )
  REM Stale pidfile from a process that is no longer alive.
  del "%PIDFILE%" >NUL 2>&1
)

if not exist ".next\BUILD_ID" (
  echo No production build found. Building first — this takes a few minutes...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Build failed. See the output above.
    exit /b 1
  )
)

REM Fresh log each run, so lumina-server.log always reflects the current process.
del "%LOGFILE%" >NUL 2>&1
del "%ERRLOGFILE%" >NUL 2>&1

echo Starting Lumina LMS...

REM Launched via PowerShell so we get a real PID back for stop.bat to target —
REM plain "start" cannot report one. Runs hidden (no window), and its stdout and
REM stderr are captured to lumina-server.log for troubleshooting.
"%POWERSHELL%" -NoProfile -Command "$p = Start-Process cmd.exe -ArgumentList '/c','npm start' -WindowStyle Hidden -RedirectStandardOutput '%LOGFILE%' -RedirectStandardError '%ERRLOGFILE%' -PassThru; Set-Content -Path '%PIDFILE%' -Value $p.Id -NoNewline"

if not exist "%PIDFILE%" (
  echo.
  echo Could not start the server — no PID was captured. Check %ERRLOGFILE%.
  exit /b 1
)

REM Poll /api/health rather than declaring victory immediately: the process
REM exists as soon as it is launched, but the app needs a moment to come up.
set /a ATTEMPTS=0
:waitloop
set /a ATTEMPTS+=1
"%POWERSHELL%" -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:!PORT!/api/health' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >NUL 2>&1
if !ERRORLEVEL! EQU 0 goto healthy
if !ATTEMPTS! GEQ 40 goto timeout
REM Paced with PowerShell rather than timeout.exe on purpose. timeout.exe insists
REM on a real console and aborts with "ERROR: Input redirection is not supported,
REM exiting the process immediately." the moment stdin is redirected — which is
REM what happens when up.bat runs from a CI job, a scheduled task, or another
REM script rather than an interactive window. The loop still finished in that
REM case, but printed that error on every pass and span with no pacing at all.
REM Start-Sleep needs no console, so the wait behaves the same either way.
"%POWERSHELL%" -NoProfile -Command "Start-Sleep -Seconds 2"
goto waitloop

:healthy
echo.
echo Lumina LMS is running.
echo   http://localhost:!PORT!
echo   Logs: %LOGFILE%
echo   Stop it with: stop.bat
exit /b 0

:timeout
echo.
echo The server did not answer within about 80 seconds. It may still be starting —
echo check %LOGFILE% and %ERRLOGFILE% for what is actually happening, and run
echo stop.bat before trying again if it looks stuck.
exit /b 1
