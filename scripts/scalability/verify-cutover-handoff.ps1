$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskDocument = Get-Content -LiteralPath (Join-Path $taskRoot 'docs/security-operator-handoff.md') -Raw
$taskSection = [regex]::Match($taskDocument, '(?s)## 2\. Separate runtime and migration privileges(.*?)## 3\.')
if (-not $taskSection.Success) { throw 'Handoff section missing' }
$taskBlock = [regex]::Match($taskSection.Groups[1].Value, '(?s)```powershell\r?\n(.*?)```').Groups[1].Value
$taskTokens = $null; $taskErrors = $null
$taskAst = [Management.Automation.Language.Parser]::ParseInput($taskBlock, [ref]$taskTokens, [ref]$taskErrors)
if ($taskErrors.Count -ne 0) { throw 'Handoff PowerShell syntax failed' }
$taskExecutable = 'C:/Program Files/PostgreSQL/16/bin/psql.exe'
$taskCommands = @($taskAst.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq $taskExecutable }, $true))
if ($taskCommands.Count -ne 2) { throw 'Both exact psql command seams are required' }
$taskTry = @($taskAst.FindAll({ param($node) $node -is [Management.Automation.Language.TryStatementAst] }, $true))
if ($taskTry.Count -ne 1 -or -not $taskTry[0].Finally) { throw 'One scoped try/finally is required' }
foreach ($taskCommand in $taskCommands) {
    if ($taskCommand.Extent.StartOffset -le $taskTry[0].Body.Extent.StartOffset -or $taskCommand.Extent.EndOffset -ge $taskTry[0].Body.Extent.EndOffset) { throw 'Both psql commands must remain inside the scoped environment' }
}
if ([regex]::Matches($taskBlock, '\$LASTEXITCODE -ne 0').Count -ne 2) { throw 'Each psql result must stop on failure' }
$taskDirectory = Join-Path $taskRoot ('.cache/scalability/handoff-env-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskDirectory | Out-Null
$taskFakePath = Join-Path $taskDirectory 'fake-psql.ps1'
$taskCmdPath = Join-Path $taskDirectory 'fake-psql.cmd'
$taskWorkerPath = Join-Path $taskDirectory 'worker.ps1'
$taskSnippetPath = Join-Path $taskDirectory 'snippet.ps1'
$taskPowerShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
if (-not (Test-Path -LiteralPath $taskPowerShell -PathType Leaf)) { throw 'Reviewed Windows PowerShell required' }
$taskFake = @'
$ErrorActionPreference = 'Stop'
$call = @(Get-ChildItem -LiteralPath $env:CUTOVER_TEST_DIRECTORY -Filter 'call-*.json').Count + 1
$valid = $true
$pg = @(Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' })
if ($pg.Count -ne 2 -or $env:PGHOSTADDR -cne '127.0.0.1' -or $env:PGCONNECT_TIMEOUT -cne '5') { $valid = $false }
foreach ($flag in @('-X', '-W', '-h', '-p', '-U', '-d', '-v')) { if ($args -cnotcontains $flag) { $valid = $false } }
foreach ($value in @('127.0.0.1', '15432', 'synthetic_operator', 'synthetic_database', 'ON_ERROR_STOP=1')) { if ($args -cnotcontains $value) { $valid = $false } }
if ($call -eq 1 -and ($args -cnotcontains '-f' -or $args -cnotcontains 'reviewed_policy=2026-10-12-column-grants-v1')) { $valid = $false }
if ($call -eq 2 -and ($args -cnotcontains '-c' -or $args -cnotcontains '\password synthetic_runtime')) { $valid = $false }
$status = if (-not $valid) { 97 } elseif ([int]$env:CUTOVER_TEST_FAIL_CALL -eq $call) { 3 } else { 0 }
@{ call = $call; valid = $valid; status = $status } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $env:CUTOVER_TEST_DIRECTORY "call-$call.json")
exit $status
'@
Set-Content -LiteralPath $taskFakePath -Value $taskFake
Set-Content -LiteralPath $taskCmdPath -Value ('@echo off' + "`r`n" + '"' + $taskPowerShell + '" -NoProfile -NonInteractive -File "' + $taskFakePath + '" %*' + "`r`n" + 'exit /b %errorlevel%')
$taskReplaced = $taskBlock.Replace("'" + $taskExecutable + "'", "'" + $taskCmdPath.Replace("'", "''") + "'")
if ($taskReplaced -eq $taskBlock -or $taskReplaced.Contains($taskExecutable)) { throw 'Only the reviewed executable seam may be replaced' }
Set-Content -LiteralPath $taskSnippetPath -Value $taskReplaced
$taskWorker = @'
$ErrorActionPreference = 'Stop'
try {
    # The parent launches this worker with no inherited PG variables. Every
    # value below is synthetic; no owner settings or credentials are read.
    $env:PGHOSTADDR = '203.0.113.1'
    $env:PGSERVICE = 'synthetic-service'
    $env:PGSERVICEFILE = 'synthetic-service-file'
    $env:PGOPTIONS = '-c synthetic=canary'
    $env:PGPASSWORD = 'synthetic-not-a-real-password'
    $env:PGPASSFILE = 'synthetic-password-file'
    $env:PGCONNECT_TIMEOUT = '91'
    $env:PGUNREVIEWED_CANARY = 'synthetic-future-variable'
    $before = @{}; Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' } | ForEach-Object { $before[$_.Name] = $_.Value }
    $answers = New-Object 'Collections.Generic.Queue[string]'
    foreach ($answer in @('synthetic_database', '15432', 'synthetic_operator', 'synthetic_migrator', 'synthetic_runtime')) { $answers.Enqueue($answer) }
    function Read-Host { param($Prompt) return $answers.Dequeue() }
    $failure = $null
    try { . $env:CUTOVER_TEST_SNIPPET } catch { $failure = $_.Exception.Message }
    $after = @{}; Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' } | ForEach-Object { $after[$_.Name] = $_.Value }
    if ($after.Count -ne $before.Count) { throw 'Original PG environment count was not restored' }
    foreach ($name in $before.Keys) { if (-not $after.ContainsKey($name) -or $after[$name] -cne $before[$name]) { throw 'Original PG environment was not restored' } }
    $expectedCalls = if ($env:CUTOVER_TEST_FAIL_CALL -eq '1') { 1 } else { 2 }
    $calls = @(Get-ChildItem -LiteralPath $env:CUTOVER_TEST_DIRECTORY -Filter 'call-*.json' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json })
    if ($calls.Count -ne $expectedCalls -or @($calls | Where-Object { -not $_.valid }).Count -ne 0) { throw 'Fake psql invocation environment or argument boundary failed' }
    if ($env:CUTOVER_TEST_FAIL_CALL -eq '0' -and $null -ne $failure) { throw 'Success unexpectedly failed' }
    if ($env:CUTOVER_TEST_FAIL_CALL -eq '1' -and $failure -cne 'Grant transaction failed; do not change runtime credentials or configuration') { throw 'Grant failure did not stop password setup' }
    if ($env:CUTOVER_TEST_FAIL_CALL -eq '2' -and $failure -cne 'Password setup failed; do not change runtime configuration') { throw 'Password failure did not stop the sequence' }
    @{ status = 'passed'; scenario = [int]$env:CUTOVER_TEST_FAIL_CALL; calls = $calls.Count; checks = 3 + $calls.Count } | ConvertTo-Json -Compress
    exit 0
} catch {
    # Never emit caught diagnostics or any process environment values.
    Write-Output '{"status":"failed","details":"Synthetic handoff boundary failed; no actual psql executed"}'
    exit 1
}
'@
Set-Content -LiteralPath $taskWorkerPath -Value $taskWorker
$taskResults = @()
foreach ($taskFailCall in @('0', '1', '2')) {
    $taskCaseDirectory = Join-Path $taskDirectory ('scenario-' + $taskFailCall)
    New-Item -ItemType Directory -Path $taskCaseDirectory | Out-Null
    $taskStart = New-Object Diagnostics.ProcessStartInfo
    $taskStart.FileName = $taskPowerShell
    $taskStart.Arguments = '-NoProfile -NonInteractive -File "' + $taskWorkerPath + '"'
    $taskStart.UseShellExecute = $false; $taskStart.CreateNoWindow = $true
    $taskStart.RedirectStandardOutput = $true; $taskStart.RedirectStandardError = $true
    $taskStart.EnvironmentVariables.Clear()
    foreach ($taskName in @('SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP')) {
        $taskValue = [Environment]::GetEnvironmentVariable($taskName, 'Process')
        if ($null -ne $taskValue) { $taskStart.EnvironmentVariables[$taskName] = $taskValue }
    }
    $taskStart.EnvironmentVariables['CUTOVER_TEST_DIRECTORY'] = $taskCaseDirectory
    $taskStart.EnvironmentVariables['CUTOVER_TEST_SNIPPET'] = $taskSnippetPath
    $taskStart.EnvironmentVariables['CUTOVER_TEST_FAIL_CALL'] = $taskFailCall
    $taskProcess = [Diagnostics.Process]::Start($taskStart)
    if (-not $taskProcess.WaitForExit(30000)) { $taskProcess.Kill(); throw 'Synthetic handoff deadline exceeded' }
    $taskOutput = $taskProcess.StandardOutput.ReadToEnd()
    $null = $taskProcess.StandardError.ReadToEnd()
    if ($taskProcess.ExitCode -ne 0) { throw 'Synthetic handoff process failed; private diagnostics suppressed' }
    $taskResult = $taskOutput | ConvertFrom-Json
    if ($taskResult.status -ne 'passed') { throw 'Synthetic handoff result failed' }
    $taskResults += $taskResult
}
$taskChecks = 4 + ($taskResults | Measure-Object -Property checks -Sum).Sum
$taskReport = @{ status = 'passed'; checks = $taskChecks; scenarios = $taskResults; actualPsqlExecutions = 0; actualDatabaseConnections = 0; inheritedParentPgValuesRead = 0; scope = 'Actual documented PowerShell block, fake psql children, clean environment and restoration on success/grant failure/password failure' }
$taskReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskDirectory 'report.json')
$taskReport | ConvertTo-Json -Depth 5
