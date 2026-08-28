$ErrorActionPreference = 'Stop'

function New-RandomSecret {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

Write-Host ''
Write-Host 'Generated three different TekBooks production secrets.' -ForegroundColor Green
Write-Host 'Paste them into Vercel Production environment variables. Do not commit them.' -ForegroundColor Yellow
Write-Host ''
Write-Output "JWT_SECRET=$(New-RandomSecret)"
Write-Output "MEDIA_SIGNING_SECRET=$(New-RandomSecret)"
Write-Output "ADMIN_API_KEY=$(New-RandomSecret)"

