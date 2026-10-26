$ErrorActionPreference = "Stop"

$projects = @(
  @{ Name = "LONDO Site"; Directory = Join-Path $PSScriptRoot "londo-site-main"; Port = 3000 },
  @{ Name = "LONDO Bot"; Directory = Join-Path $PSScriptRoot "londo-bot-main"; Port = 3101 }
)

foreach ($project in $projects) {
  if (-not (Test-Path (Join-Path $project.Directory "package.json"))) {
    throw "Не найден package.json проекта: $($project.Directory)"
  }
  if (-not (Test-Path (Join-Path $project.Directory "node_modules"))) {
    throw "Зависимости не установлены в $($project.Directory). Сначала выполните там npm install."
  }
}

$busyPorts = foreach ($project in $projects) {
  Get-NetTCPConnection -State Listen -LocalPort $project.Port -ErrorAction SilentlyContinue |
    Select-Object @{ Name = "Project"; Expression = { $project.Name } }, LocalPort, OwningProcess
}

if ($busyPorts) {
  $details = ($busyPorts | ForEach-Object { "$($_.Project): порт $($_.LocalPort), PID $($_.OwningProcess)" }) -join [Environment]::NewLine
  throw "Не удалось запустить LONDO: нужные порты уже заняты.`n$details`nОстановите старые процессы (Ctrl+C в их окнах) и повторите npm run dev."
}

foreach ($project in $projects) {
  $directory = $project.Directory.Replace("'", "''")
  $title = $project.Name.Replace("'", "''")
  $command = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$directory'; npm run dev"
  $arguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -Command `"$command`""
  Start-Process -FilePath "powershell.exe" -ArgumentList $arguments | Out-Null
}

Write-Host "Открыты окна сайта (http://localhost:3000) и бота (порт 3101). Закройте каждое сочетанием Ctrl+C, чтобы остановить соответствующий процесс." -ForegroundColor Green
