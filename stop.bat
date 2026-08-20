@echo off
REM Stops the Lumina LMS server started by up.bat.
REM Also cleans up anything still bound to the port even if the pidfile is
REM missing or stale, so it works as a "just make sure it's stopped" command
REM regardless of how the server was actually started.
setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Fully-qualified paths throughout — see the matching comment in up.bat.
REM Short version: on a machine where Git for Windows is on PATH ahead of
REM System32 (true of the shell this script was developed and tested in), the
REM bare name "find" silently resolves to GNU find instead of Windows'
REM find.exe, and fails with "No such file or directory" instead of doing a
REM text search. Hit this directly while testing, not by inspection.
set "SYS=%SystemRoot%\System32"
set "FIND=%SYS%\find.exe"
set "FINDSTR=%SYS%\findstr.exe"
set "TASKLIST=%SYS%\tasklist.exe"
set "TASKKILL=%SYS%\taskkill.exe"
set "NETSTAT=%SYS%\netstat.exe"

set "PIDFILE=.lumina.pid"
set "PORT=4400"

REM %FINDSTR% is deliberately unquoted here — see the matching comment in
REM up.bat. A quoted path inside a for/f command substitution (backticks)
REM breaks with "The directory name is invalid."; unquoted works, and
REM System32 has no spaces in it to worry about.
if exist ".env" (
  for /f "usebackq tokens=1,2 delims==" %%A in (`%FINDSTR% /b "PORT=" .env`) do set "RAWPORT=%%B"
  if defined RAWPORT (
    set "RAWPORT=!RAWPORT:"=!"
    if not "!RAWPORT!"=="" set "PORT=!RAWPORT!"
  )
)

set "STOPPED=0"

if exist "%PIDFILE%" (
  set /p SAVED_PID=<"%PIDFILE%"
  if defined SAVED_PID (
    "%TASKLIST%" /FI "PID eq !SAVED_PID!" 2>NUL | "%FIND%" "!SAVED_PID!" >NUL
    if !ERRORLEVEL! EQU 0 (
      echo Stopping Lumina LMS ^(PID !SAVED_PID!, and everything it started^)...
      REM /T kills the whole process tree — up.bat's launch chain is cmd -> npm
      REM -> node, and taskkill /T is what reaches the actual server at the
      REM bottom of that chain, not just the wrapper on top of it.
      "%TASKKILL%" /PID !SAVED_PID! /T /F >NUL 2>&1
      set "STOPPED=1"
    )
  )
  del "%PIDFILE%" >NUL 2>&1
)

REM Fallback: whatever is actually listening on the port, regardless of the
REM pidfile above — covers a stale/missing pidfile or a server started by hand.
REM %NETSTAT% and %FINDSTR% are unquoted for the same reason as the .env line
REM above: quoted paths break inside a for/f command substitution.
REM
REM The app binds "::" (see scripts\lib\port.mjs), which Windows reports as two
REM separate LISTENING lines for the one process — 0.0.0.0:PORT and [::]:PORT,
REM same PID — confirmed by checking netstat directly while testing, not
REM assumed. Deduplicated with a plain string comparison against the last PID
REM killed rather than a "seen list" checked via a nested findstr: that nested
REM form sits inside this loop's own body, which is itself already inside a
REM for/f reading a piped command, and that combination did not parse reliably
REM in testing (stray "FINDSTR: Bad command line" errors) — simpler won here.
REM A plain comparison is also all that is actually needed: netstat lists a
REM given PID's entries consecutively, so catching immediate repeats is enough.
set "KILLED_PID="
for /f "tokens=5" %%P in ('%NETSTAT% -ano ^| %FINDSTR% ":!PORT! " ^| %FINDSTR% "LISTENING"') do (
  if not "%%P"=="!KILLED_PID!" (
    echo Stopping process bound to port !PORT! ^(PID %%P^)...
    "%TASKKILL%" /PID %%P /F >NUL 2>&1
    set "STOPPED=1"
    set "KILLED_PID=%%P"
  )
)

if "!STOPPED!"=="1" (
  echo Lumina LMS stopped.
) else (
  echo Lumina LMS was not running on port !PORT!.
)
