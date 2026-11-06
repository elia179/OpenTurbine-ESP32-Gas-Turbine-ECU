param([Parameter(Mandatory=$true)][string]$ExePath)
$ErrorActionPreference = 'Stop'
$taskExecutable = (Resolve-Path -LiteralPath $ExePath).Path
# Run this fresh-process check on the Windows release runner. It only checks
# the initial window/message loop; it never clicks an install or update action.
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class OpenTurbineWindowProbe {
    public delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wparam, IntPtr lparam, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
    public static IntPtr Find(uint process) {
        IntPtr found=IntPtr.Zero;
        EnumWindows((window, parameter)=> { uint owner; GetWindowThreadProcessId(window,out owner);
            if(owner!=process)return true;
            var title=new StringBuilder(256); GetWindowText(window,title,title.Capacity);
            if(title.ToString().IndexOf("OpenTurbine",StringComparison.OrdinalIgnoreCase)<0)return true;
            found=window;return false;
        },IntPtr.Zero);
        return found;
    }
}
"@
$taskProcess = $null
$taskWindow = [IntPtr]::Zero
try {
    $taskProcess = Start-Process -FilePath $taskExecutable -WindowStyle Hidden -PassThru
    $taskDeadline = (Get-Date).AddSeconds(30)
    do {
        if ($taskProcess.HasExited) { throw "Flasher exited before its window was ready: $($taskProcess.ExitCode)" }
        $taskWindow = [OpenTurbineWindowProbe]::Find([uint32]$taskProcess.Id)
        if ($taskWindow -ne [IntPtr]::Zero) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $taskDeadline)
    if ($taskWindow -eq [IntPtr]::Zero) { throw 'Flasher did not create its initial window within 30 seconds' }
    $taskRect = New-Object OpenTurbineWindowProbe+Rect
    if (-not [OpenTurbineWindowProbe]::GetWindowRect($taskWindow,[ref]$taskRect)) { throw 'Could not read flasher window dimensions' }
    if (($taskRect.Right-$taskRect.Left) -lt 600 -or ($taskRect.Bottom-$taskRect.Top) -lt 400) { throw 'Flasher window has invalid initial dimensions' }
    $taskReply = [IntPtr]::Zero
    if ([OpenTurbineWindowProbe]::SendMessageTimeout($taskWindow,0,[IntPtr]::Zero,[IntPtr]::Zero,2,2000,[ref]$taskReply) -eq [IntPtr]::Zero) { throw 'Flasher window message loop did not respond' }
    Write-Output "PASS: release flasher created its initial window and responded; no install/update action invoked."
} finally {
    if ($taskWindow -ne [IntPtr]::Zero) { [void][OpenTurbineWindowProbe]::PostMessage($taskWindow,0x10,[IntPtr]::Zero,[IntPtr]::Zero) }
    if ($null -ne $taskProcess -and -not $taskProcess.HasExited -and -not $taskProcess.WaitForExit(5000)) { Stop-Process -Id $taskProcess.Id -Force }
}
