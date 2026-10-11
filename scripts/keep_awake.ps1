<#
.SYNOPSIS
    Prevents Windows from entering sleep mode while your movie streaming server is running.
.DESCRIPTION
    Calls Windows Win32 SetThreadExecutionState with ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED.
    This keeps the server alive and streaming even if you close the laptop lid (when configured in Windows Power Options),
    while still allowing the display to turn off to conserve battery and avoid heat.
#>

$signature = @'
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
'@

$type = Add-Type -MemberDefinition $signature -Name "SleepUtil" -Namespace "Win32" -PassThru

$ES_CONTINUOUS = [uint32]0x80000000
$ES_SYSTEM_REQUIRED = [uint32]0x00000001
$ES_AWAYMODE_REQUIRED = [uint32]0x00000040

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Family Cinema] Laptop Sleep Prevention Active" -ForegroundColor Green
Write-Host " Windows system sleep is DISABLED while this window stays open." -ForegroundColor Yellow
Write-Host " Press Ctrl + C to exit and restore standard sleep settings." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Set keep awake
$result = $type::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED)

try {
    while ($true) {
        Start-Sleep -Seconds 60
        # Reassert every minute
        $null = $type::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED)
    }
}
finally {
    # Restore normal state on exit
    $null = $type::SetThreadExecutionState($ES_CONTINUOUS)
    Write-Host "Restored standard Windows sleep settings." -ForegroundColor Cyan
}
