# Daily backup on the owner's computer

`WaznAutoBackup.ps1` runs once a day from Windows Task Scheduler. It asks the
server for a complete backup (every table, every photo), waits, downloads it
into the backup folder, checks it is whole, and only then deletes the older
copies on this computer and the server's copy. A download that is not whole
never replaces the last good one.

Set up once, after the server has a key:

1. Backups page → **بەکاپی خۆکاری ڕۆژانە** → **دروستکردنی کلیل**, copy the key.
2. Run `Wazn - auto backup.cmd` (the desktop shortcut), paste the key, Enter.

Files beside the scripts: `config.json` (server, folder, `keepDays` = 30, `maxFolderGB` = 30,
time), `key.dat` (the key, encrypted to this Windows user with DPAPI),
`auto-backup.log`.

The key can only make, fetch and delete the backups it made itself
(`server/_core/autoBackupRoute.ts`). A new key ends the old one; the page can
switch it off.
