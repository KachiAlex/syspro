$lines = Get-Content "d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx"
$output = @($lines[0..5068]) + @($lines[6448..($lines.Count-1)])
$output | Set-Content "d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx"
Write-Host "Cleanup complete. Removed $($lines.Count - $output.Count) lines"
