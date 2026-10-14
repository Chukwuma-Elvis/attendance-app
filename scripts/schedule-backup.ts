import { execSync } from "child_process";
import path from "path";

const TASK_NAME = "AttendanceApp-WeeklyBackup";
const batPath = path.resolve(process.cwd(), "scripts", "run-backup.bat");

const action = process.argv[2]?.toLowerCase();

if (action === "remove" || action === "delete" || action === "uninstall") {
  try {
    execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, { stdio: "inherit" });
    console.log(`\n✅ Scheduled backup task "${TASK_NAME}" removed successfully.\n`);
  } catch (e: any) {
    console.error(`\nFailed to remove task (it might not exist).\n`);
  }
  process.exit(0);
}

try {
  // Schedules every Sunday at 23:59 (11:59 PM)
  const cmd = `schtasks /Create /SC WEEKLY /D SUN /TN "${TASK_NAME}" /TR "\\"${batPath}\\"" /ST 23:59 /F`;
  console.log(`\nRegistering weekly backup task in Windows Task Scheduler...`);
  execSync(cmd, { stdio: "inherit" });

  console.log(`\n🎉 Weekly Backup Automation successfully configured!`);
  console.log(`- Task Name:    ${TASK_NAME}`);
  console.log(`- Schedule:     Every Sunday at 11:59 PM`);
  console.log(`- Action:       Runs ${batPath}`);
  console.log(`- Retention:    Keeps the 3 most recent backups, auto-deleting older ones.`);
  console.log(`- Logs:         Saved to backups/backup-scheduler.log\n`);
  console.log(`To uninstall anytime, run:`);
  console.log(`  npm run backup:unschedule\n`);
} catch (e: any) {
  console.error(`\n⚠️ Could not register task automatically:`, e.message);
  console.log(`\nTo register manually, open PowerShell and run:`);
  console.log(`schtasks /Create /SC WEEKLY /D SUN /TN "${TASK_NAME}" /TR "\\"${batPath}\\"" /ST 23:59 /F\n`);
}
