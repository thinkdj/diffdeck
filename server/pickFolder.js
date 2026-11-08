// The OS's own "choose folder" dialog, opened on the machine running diffdeck (browsers never reveal real paths).
// Resolves to the chosen path, or '' when cancelled.
import { execFile } from 'node:child_process'

// Windows: the regular Explorer file dialog. Pick any file in the folder (package.json, say), or open the
// folder and press Open on the placeholder name; either way the folder is what we keep.
const PS = `[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Open your repo folder, or pick a file in it such as package.json'
$d.CheckFileExists = $false
$d.ValidateNames = $false
$d.FileName = 'Use this folder'
$top = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }
if ($d.ShowDialog($top) -eq 'OK') { [Console]::Out.Write((Split-Path -Parent $d.FileName)) }`

const DIALOGS = {
  win32: ['powershell.exe', ['-NoProfile', '-STA', '-Command', PS]],
  darwin: ['osascript', ['-e', 'POSIX path of (choose folder with prompt "Add a repo, or a folder of repos, to diffdeck")']],
  // ponytail: zenity only; add kdialog if a KDE user hits the error below
  linux: ['zenity', ['--file-selection', '--directory', '--title=Add a repo, or a folder of repos, to diffdeck']],
}

export function pickFolder() {
  const [cmd, args] = DIALOGS[process.platform] ?? DIALOGS.linux
  return new Promise((resolve, reject) =>
    // no windowsHide: it would hide the dialog itself, not just a console
    execFile(cmd, args, (err, out) => {
      if (err?.code === 'ENOENT') reject(new Error(`No folder dialog on this system (${cmd} not found). Paste the path instead.`))
      else resolve(err ? '' : out.trim()) // cancel exits non-zero on macOS and Linux
    }))
}
