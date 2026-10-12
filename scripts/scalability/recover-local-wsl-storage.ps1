param([switch]$Execute)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Owner-approved backup/managed relocation only. No repair, prune, unregister,
# manual AppData move, arbitrary path selection or original application change.
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$taskExpectedRoot = 'E:\4.1\WEB +PROJECT\University-project'
if (-not [string]::Equals($taskRoot, $taskExpectedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Run only from the approved repository.' }
$taskDistroName = 'Ubuntu-24.04'
$taskRecords = @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | ForEach-Object {
  $taskRecord = Get-ItemProperty -LiteralPath $_.PSPath
  if ($taskRecord.DistributionName -eq $taskDistroName) { $taskRecord }
})
if ($taskRecords.Count -ne 1) { throw 'Exactly one approved distribution registration is required.' }
$taskBasePath = [IO.Path]::GetFullPath($taskRecords[0].BasePath)
$taskSource = (Resolve-Path -LiteralPath (Join-Path $taskBasePath 'ext4.vhdx')).Path
if ([IO.Path]::GetPathRoot($taskSource) -ne 'C:\' -or (Get-Item -LiteralPath $taskSource).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw 'Source must be the registered regular C-drive VHD.' }
$taskLength = (Get-Item -LiteralPath $taskSource).Length
$taskFree = (Get-PSDrive -Name E).Free
if ($taskFree -lt (3 * $taskLength + 16GB)) { throw 'E requires backup, relocation and verified growth headroom.' }
$taskRun = Join-Path $taskRoot ('.cache\scalability\wsl-recovery-' + [Guid]::NewGuid().ToString('N'))
$taskBackup = Join-Path $taskRun 'Ubuntu-24.04-backup.vhdx'
$taskTarget = Join-Path $taskRun 'runtime'
$taskRelative = $taskRun.Substring($taskRoot.Length)
if (-not $taskRelative.StartsWith('\.cache\scalability\wsl-recovery-') -or (Test-Path -LiteralPath $taskRun)) { throw 'Recovery directory must be fresh and inside the approved ignored workspace.' }
$taskCache = (Resolve-Path -LiteralPath (Join-Path $taskRoot '.cache\scalability')).Path
if (-not [string]::Equals($taskCache, (Join-Path $taskRoot '.cache\scalability'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Cache ancestor must not redirect the recovery target.' }
$taskAncestor = Get-Item -LiteralPath $taskCache
while ($null -ne $taskAncestor) {
  if ($taskAncestor.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw 'Recovery ancestors cannot redirect through a junction or symbolic link.' }
  $taskAncestor = $taskAncestor.Parent
}

if (-not $Execute) {
  @{ stage = 'review_only'; distribution = $taskDistroName; sourceBytes = $taskLength; destinationFreeBytes = $taskFree; changesPerformed = $false; proposal = 'docs/scalability/host-storage-recovery-proposal.md' } | ConvertTo-Json -Compress
  return
}

New-Item -ItemType Directory -Path $taskRun -ErrorAction Stop | Out-Null
$taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$taskSystem = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$taskAcl = [Security.AccessControl.DirectorySecurity]::new()
$taskAcl.SetAccessRuleProtection($true, $false)
$taskAcl.SetOwner($taskSid)
foreach ($taskIdentity in @($taskSid, $taskSystem)) {
  $taskAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($taskIdentity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
Set-Acl -LiteralPath $taskRun -AclObject $taskAcl
$taskActualAcl = Get-Acl -LiteralPath $taskRun
$taskAllowed = @($taskSid.Value, $taskSystem.Value)
if ($taskActualAcl.Access.Count -ne 2 -or @($taskActualAcl.Access | Where-Object {
  $_.AccessControlType -ne 'Allow' -or $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $taskAllowed
}).Count -ne 0) { throw 'Private owner/SYSTEM-only recovery ACL verification failed.' }

@{ stage = 'terminating_only_approved_distribution'; distribution = $taskDistroName } | ConvertTo-Json -Compress
& wsl.exe --terminate $taskDistroName
if ($LASTEXITCODE -ne 0) { throw 'Termination failed; preserve all existing data and inspect.' }
@{ stage = 'exporting_private_vhd_backup'; destination = $taskRun; sourceBytes = $taskLength } | ConvertTo-Json -Compress
& wsl.exe --export $taskDistroName $taskBackup --format vhd
if ($LASTEXITCODE -ne 0) { throw 'Export failed; preserve source and any partial backup. No relocation attempted.' }
if ((Get-Item -LiteralPath $taskBackup).Length -ne (Get-Item -LiteralPath $taskSource).Length) { throw 'Backup/source length mismatch; relocation blocked.' }
$taskOriginalHash = (Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
$taskBackupHash = (Get-FileHash -LiteralPath $taskBackup -Algorithm SHA256).Hash
if ($taskOriginalHash -ne $taskBackupHash) { throw 'Backup/source digest mismatch; relocation blocked.' }
@{ stage = 'backup_verified'; byteIdentity = $true; sourceBytes = (Get-Item -LiteralPath $taskSource).Length } | ConvertTo-Json -Compress
if (Test-Path -LiteralPath $taskTarget) { throw 'Relocation target must remain fresh.' }
& wsl.exe --manage $taskDistroName --move $taskTarget
if ($LASTEXITCODE -ne 0) { throw 'Managed move failed; retain backup and inspect registration. No manual fallback.' }
$taskNewRecords = @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | ForEach-Object {
  $taskRecord = Get-ItemProperty -LiteralPath $_.PSPath
  if ($taskRecord.DistributionName -eq $taskDistroName) { $taskRecord }
})
if ($taskNewRecords.Count -ne 1 -or -not [string]::Equals([IO.Path]::GetFullPath($taskNewRecords[0].BasePath).TrimEnd('\'), $taskTarget.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Post-move registered path mismatch; retain backup.' }
$taskMovedVhd = Join-Path $taskTarget 'ext4.vhdx'
if ((Get-Item -LiteralPath $taskMovedVhd).Length -ne (Get-Item -LiteralPath $taskBackup).Length -or (Get-FileHash -LiteralPath $taskMovedVhd -Algorithm SHA256).Hash -ne $taskBackupHash) { throw 'Post-move byte identity failed; do not start Linux.' }
$taskResult = @{ stage = 'relocated_verified_not_repaired'; distribution = $taskDistroName; backup = $taskBackup; runtime = $taskTarget; byteIdentity = $true; sourceBytes = (Get-Item -LiteralPath $taskMovedVhd).Length; cFreeBytes = (Get-PSDrive -Name C).Free; filesystemRepairPerformed = $false; dataPruned = $false }
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRun 'evidence.json') -Encoding UTF8
$taskResult | ConvertTo-Json -Compress
# Read-only restart/health inspection is a separate step. Never silently fsck,
# remount writable, delete the backup or restart an owner Windows application.
