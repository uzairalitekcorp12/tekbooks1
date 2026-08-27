$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ''
  Write-Host 'TekBooks network setup needs an Administrator PowerShell.' -ForegroundColor Yellow
  Write-Host 'Open PowerShell as Administrator, go to the TekBooks project, then run:'
  Write-Host '  npm run network:windows' -ForegroundColor Cyan
  exit 1
}

$rules = @(
  @{ Name = 'TekBooks Expo Metro 8081'; Port = 8081 },
  @{ Name = 'TekBooks API 4000'; Port = 4000 }
)

foreach ($rule in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $rule.Port -Profile Private | Out-Null
    Write-Host "Added Windows Firewall rule: $($rule.Name)" -ForegroundColor Green
  } else {
    Set-NetFirewallRule -DisplayName $rule.Name -Enabled True -Profile Private -Action Allow | Out-Null
    Write-Host "Firewall rule already exists and is enabled: $($rule.Name)" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Current network profiles:' -ForegroundColor Cyan
Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity | Format-Table -AutoSize
Write-Host 'If the active Wi-Fi profile is Public, switch it to Private in Windows Settings before testing Expo LAN.' -ForegroundColor Yellow
