@echo off
cd /d "%~dp0\.."
echo [%DATE% %TIME%] Starting scheduled weekly backup... >> backups\backup-scheduler.log
call npm.cmd run db:backup >> backups\backup-scheduler.log 2>&1
echo [%DATE% %TIME%] Finished scheduled backup with exit code %ERRORLEVEL%. >> backups\backup-scheduler.log
