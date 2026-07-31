# Reusable PowerShell helper for the Gemini art-generation pipeline (see
# gemini-sprite-pipeline memory doc). After clicking a download button in
# Chrome, the native "Save As" dialog needs a keystroke to confirm — a blind
# SendKeys right after the click is unreliable because Windows can leave
# keyboard focus on whatever app issued the PowerShell command instead of
# the new dialog. This finds the "Save As" window by title, focuses it
# explicitly, retries for a couple seconds if the dialog hasn't appeared
# yet, then confirms with Enter.
#
# Usage: powershell -File tools/confirm-save-dialog.ps1
# (or dot-source / copy inline into an ad-hoc PowerShell call)
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class WConfirm { public delegate bool E(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(E cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); }
"@
$target = [IntPtr]::Zero
$attempts = 0
while ($target -eq [IntPtr]::Zero -and $attempts -lt 6) {
  $cb = { param($h,$l) $sb=New-Object System.Text.StringBuilder 256; [WConfirm]::GetWindowText($h,$sb,256)|Out-Null
          if ($sb.ToString() -eq "Save As") { $script:target = $h }; return $true }
  [WConfirm]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
  if ($target -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 500; $attempts++ }
}
if ($target -ne [IntPtr]::Zero) {
  [WConfirm]::ShowWindow($target, 9) | Out-Null; [WConfirm]::SetForegroundWindow($target) | Out-Null
  Start-Sleep -Milliseconds 400
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Seconds 1
  "confirmed"
} else { "no dialog found after retries" }
