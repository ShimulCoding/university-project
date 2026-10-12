$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskChecks = 0
$taskFile = Join-Path $PSScriptRoot 'recover-local-wsl-storage.ps1'
$taskSource = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8

function Assert-RecoverySource([string]$taskText) {
  $taskTokens = $null; $taskErrors = $null
  $taskAst = [System.Management.Automation.Language.Parser]::ParseInput($taskText, [ref]$taskTokens, [ref]$taskErrors)
  if ($taskErrors.Count -ne 0) { throw 'Recovery source syntax must parse.' }
  $taskCommands = @($taskAst.FindAll({ param($taskNode) $taskNode -is [System.Management.Automation.Language.CommandAst] }, $true))
  $taskAllowedCommands = @('Set-StrictMode','Join-Path','Resolve-Path','Get-ChildItem','ForEach-Object','Get-ItemProperty','Get-Item','Get-PSDrive','Test-Path','ConvertTo-Json','New-Item','Out-Null','Set-Acl','Get-Acl','Where-Object','wsl.exe','Get-FileHash','Set-Content')
  foreach ($taskCommand in $taskCommands) {
    if ($taskCommand.GetCommandName() -notin $taskAllowedCommands) { throw 'Unreviewed command in recovery source.' }
  }
  $taskAllowedTypes = @('Guid','IO.FileAttributes','IO.Path','Security.AccessControl.DirectorySecurity','Security.AccessControl.FileSystemAccessRule','Security.Principal.SecurityIdentifier','Security.Principal.WindowsIdentity','string','StringComparison')
  foreach ($taskType in @($taskAst.FindAll({ param($taskNode) $taskNode -is [System.Management.Automation.Language.TypeExpressionAst] }, $true))) {
    if ($taskType.TypeName.FullName -notin $taskAllowedTypes) { throw 'Unreviewed static type in recovery source.' }
  }
  $taskAllowedMethods = @('AddAccessRule','Equals','GetCurrent','GetFullPath','GetPathRoot','HasFlag','new','NewGuid','SetAccessRuleProtection','SetOwner','StartsWith','Substring','ToString','Translate','TrimEnd')
  foreach ($taskMethod in @($taskAst.FindAll({ param($taskNode) $taskNode -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, $true))) {
    if ($taskMethod.Member.Value -notin $taskAllowedMethods -or ($taskMethod.Member.Value -eq 'new' -and $taskMethod.Expression -isnot [System.Management.Automation.Language.TypeExpressionAst])) { throw 'Unreviewed method or dynamic constructor in recovery source.' }
  }
  $taskWsl = @($taskCommands | Where-Object { $_.GetCommandName() -eq 'wsl.exe' })
  $taskExpected = @('& wsl.exe --terminate $taskDistroName','& wsl.exe --export $taskDistroName $taskBackup --format vhd','& wsl.exe --manage $taskDistroName --move $taskTarget')
  if ($taskWsl.Count -ne 3) { throw 'Only three reviewed WSL operations are permitted.' }
  for ($taskIndex = 0; $taskIndex -lt 3; $taskIndex++) {
    if ($taskWsl[$taskIndex].Extent.Text -ne $taskExpected[$taskIndex]) { throw 'WSL arguments must match the approved operations.' }
    $taskFollowing = $taskText.Substring($taskWsl[$taskIndex].Extent.EndOffset).TrimStart()
    if (-not $taskFollowing.StartsWith('if ($LASTEXITCODE -ne 0) { throw ')) { throw 'Each WSL exit must be checked immediately.' }
  }
  foreach ($taskRequired in @(
    'param([switch]$Execute)',
    '$taskExpectedRoot = ''E:\4.1\WEB +PROJECT\University-project''',
    '$taskDistroName = ''Ubuntu-24.04''',
    '$taskRecords.Count -ne 1',
    '[IO.Path]::GetPathRoot($taskSource) -ne ''C:\''',
    '$taskFree -lt (3 * $taskLength + 16GB)',
    '[Guid]::NewGuid().ToString(''N'')',
    '$taskRelative.StartsWith(''\.cache\scalability\wsl-recovery-'')',
    '(Test-Path -LiteralPath $taskRun)',
    'while ($null -ne $taskAncestor)',
    '$taskAncestor.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)',
    'if (-not $Execute)',
    '$taskAcl.SetAccessRuleProtection($true, $false)',
    '$taskAcl.SetOwner($taskSid)',
    '''S-1-5-18''',
    '''FullControl'', ''ContainerInherit,ObjectInherit'', ''None'', ''Allow''',
    '$taskActualAcl.Access.Count -ne 2',
    '$_.AccessControlType -ne ''Allow''',
    '$taskBackup).Length -ne (Get-Item -LiteralPath $taskSource).Length',
    '$taskOriginalHash = (Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash',
    '$taskBackupHash = (Get-FileHash -LiteralPath $taskBackup -Algorithm SHA256).Hash',
    'if ($taskOriginalHash -ne $taskBackupHash) { throw ',
    'if (Test-Path -LiteralPath $taskTarget) { throw ',
    '$taskNewRecords.Count -ne 1',
    '$taskMovedVhd -Algorithm SHA256).Hash -ne $taskBackupHash',
    'filesystemRepairPerformed = $false; dataPruned = $false'
  )) { if (-not $taskText.Contains($taskRequired)) { throw 'Required immutable recovery guard missing.' } }
  $taskNewDirectory = $taskText.IndexOf('New-Item -ItemType Directory -Path $taskRun')
  $taskReturn = $taskText.IndexOf('  return', $taskText.IndexOf('if (-not $Execute)'))
  $taskAclReady = $taskText.IndexOf('Private owner/SYSTEM-only recovery ACL verification failed.')
  $taskBackupCheck = $taskText.IndexOf('if ($taskOriginalHash -ne $taskBackupHash)')
  $taskMovedCheck = $taskText.IndexOf('$taskMovedVhd -Algorithm SHA256).Hash -ne $taskBackupHash')
  $taskResult = $taskText.IndexOf('$taskResult = @{')
  if (@($taskNewDirectory,$taskReturn,$taskAclReady,$taskBackupCheck,$taskMovedCheck,$taskResult | Where-Object { $_ -lt 0 }).Count -ne 0) { throw 'All ordered guard locations must exist.' }
  if (-not ($taskReturn -lt $taskNewDirectory -and $taskNewDirectory -lt $taskAclReady -and $taskAclReady -lt $taskWsl[0].Extent.StartOffset -and $taskWsl[1].Extent.EndOffset -lt $taskBackupCheck -and $taskBackupCheck -lt $taskWsl[2].Extent.StartOffset -and $taskWsl[2].Extent.EndOffset -lt $taskMovedCheck -and $taskMovedCheck -lt $taskResult)) { throw 'Recovery guard/ACL/hash sequencing must remain fail closed.' }
  if (@($taskCommands | Where-Object { $_.GetCommandName() -eq 'Get-FileHash' }).Count -ne 3) { throw 'All three VHD digest checks must remain present.' }
  if ($taskText -match 'byteIdentity\s*=\s*\$task(?:OriginalHash|BackupHash)' -or $taskText -match 'Write-(?:Output|Host)\s+\$task(?:OriginalHash|BackupHash)' -or $taskText -match 'Get-Content\s+-LiteralPath\s+\$task(?:Source|Backup|MovedVhd)') { throw 'Never emit disk contents or digest values.' }
}

Assert-RecoverySource $taskSource
$taskChecks++
$taskMutations = @(
  @('param([switch]$Execute)','param([switch]$Execute = $true)'),
  @('Ubuntu-24.04','AnotherDistribution'),
  @('E:\4.1\WEB +PROJECT\University-project','C:\Unreviewed'),
  @('--terminate $taskDistroName','--shutdown'),
  @('--export $taskDistroName $taskBackup --format vhd','--export $taskDistroName $taskBackup --format tar'),
  @('--manage $taskDistroName --move $taskTarget','--unregister $taskDistroName'),
  @('if ($LASTEXITCODE -ne 0) { throw ','if ($false) { throw '),
  @('if ($taskOriginalHash -ne $taskBackupHash) { throw ','if ($false) { throw '),
  @('$taskMovedVhd -Algorithm SHA256).Hash -ne $taskBackupHash','$taskMovedVhd -Algorithm SHA256).Hash -ne $taskOriginalHash'),
  @('$taskRelative.StartsWith(''\.cache\scalability\wsl-recovery-'')','$taskRelative.StartsWith(''C:\'')'),
  @('$taskAncestor.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)','$false'),
  @('$taskAcl.SetAccessRuleProtection($true, $false)','$taskAcl.SetAccessRuleProtection($false, $true)'),
  @('''S-1-5-18''','''S-1-1-0'''),
  @('$taskActualAcl.Access.Count -ne 2','$taskActualAcl.Access.Count -ne 3'),
  @('$taskFree -lt (3 * $taskLength + 16GB)','$taskFree -lt 1'),
  @('  return','  # bypass return')
)
foreach ($taskMutation in $taskMutations) {
  if (-not $taskSource.Contains($taskMutation[0])) { throw 'Negative control must change the real source.' }
  $taskRejected = $false
  try { Assert-RecoverySource $taskSource.Replace($taskMutation[0], $taskMutation[1]) } catch { $taskRejected = $true }
  if (-not $taskRejected) { throw 'Unsafe source mutation was accepted.' }
  $taskChecks++
}
foreach ($taskAdded in @('Remove-Item -LiteralPath $taskSource','& wsl.exe --unregister Ubuntu-24.04','& $taskArbitraryExecutable','[IO.File]::Delete($taskSource)','$taskType::new()')) {
  $taskRejected = $false
  try { Assert-RecoverySource ($taskSource + "`n" + $taskAdded) } catch { $taskRejected = $true }
  if (-not $taskRejected) { throw 'Unreviewed extra action was accepted.' }
  $taskChecks++
}
@{ status = 'passed'; checks = $taskChecks; scope = 'PS source AST/order/mutation contracts only'; recoveryScriptEvaluated = $false; registryOrDiskDataRead = $false; hostChanges = $false } | ConvertTo-Json -Compress
