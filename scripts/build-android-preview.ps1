<#
.SYNOPSIS
Build an arm64 Android preview APK locally from the Expo configuration.
.DESCRIPTION
Uses the development application ID and the generated Android debug keystore
for a local preview. This is not a store-signing or publishing command.
Expo dotenv loading is disabled. Supply public build configuration through the
process environment or -ApiUrl; otherwise app.config.ts keeps its own default.
Dependencies and Android SDK/JDK tools must already be installed.
Prebuild uses --no-clean so existing Android files and build intermediates are
preserved while config plugins are synchronized. It does not recreate Android.
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-preview.ps1
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-preview.ps1 -ApiUrl https://your-staging-host.example
#>
[CmdletBinding()]
param(
  [string]$ApiUrl,
  [string]$AndroidSdkPath,
  [string]$JdkPath
)

$previewMobileRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$previewArtifactDir = Join-Path $previewMobileRoot '.data/native-mobile'
$previewLogPath = Join-Path $previewArtifactDir 'android-preview-build.log'
$previewApkPath = Join-Path $previewArtifactDir 'souq-hamad-android-preview.apk'
$previewPreviousErrorPreference = $ErrorActionPreference
$previewEnvironmentKeys = @(
  'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'PATH', 'CI',
  'APP_VARIANT', 'NODE_ENV', 'EXPO_NO_DOTENV', 'EXPO_PUBLIC_API_URL'
)
$previewPreviousEnvironment = @{}
foreach ($key in $previewEnvironmentKeys) {
  $previewPreviousEnvironment[$key] = [System.Environment]::GetEnvironmentVariable($key, 'Process')
}
$previewLocationChanged = $false
$previewExitCode = 1

function Invoke-PreviewLoggedCommand {
  param([string]$Executable, [string[]]$ArgumentList)
  $commandErrorPreference = $ErrorActionPreference
  try {
    # Java/Gradle emit normal diagnostics to stderr; use the exit code.
    $ErrorActionPreference = 'Continue'
    & $Executable @ArgumentList 2>&1 | Tee-Object -FilePath $previewLogPath -Append
    $commandExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $commandErrorPreference
  }
  if ($commandExitCode -ne 0) {
    throw "Build command failed with exit code $commandExitCode. See $previewLogPath"
  }
}

try {
  $ErrorActionPreference = 'Stop'
  if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'This local runner requires Windows PowerShell and Android SDK tools.'
  }
  New-Item -ItemType Directory -Force -Path $previewArtifactDir | Out-Null
  @(
    ('Android preview build started: ' + [DateTime]::UtcNow.ToString('o'))
    'Application variant: development; architecture: arm64-v8a.'
    'Signing: generated Android debug keystore, for local preview only.'
    'Expo dotenv loading is disabled; no environment files are read by this runner.'
  ) | Set-Content -LiteralPath $previewLogPath -Encoding UTF8

  $previewNode = Get-Command node.exe -CommandType Application -ErrorAction Stop
  $previewPnpm = Get-Command pnpm.cmd -CommandType Application -ErrorAction Stop
  $previewNodeVersion = (& $previewNode.Source --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $previewNodeVersion -notmatch '^v(22|23|24)\.') {
    throw 'Node.js >=22 <25 is required by this repository.'
  }
  $previewPnpmVersion = (& $previewPnpm.Source --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $previewPnpmVersion -ne '10.32.1') {
    throw 'Install the pinned pnpm 10.32.1 before building.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $previewMobileRoot 'node_modules/expo/package.json') -PathType Leaf)) {
    throw 'Install mobile dependencies with pnpm install --frozen-lockfile before building.'
  }

  if (-not $AndroidSdkPath) { $AndroidSdkPath = $env:ANDROID_HOME }
  if (-not $AndroidSdkPath) { $AndroidSdkPath = $env:ANDROID_SDK_ROOT }
  if (-not $AndroidSdkPath -and $env:LOCALAPPDATA) { $AndroidSdkPath = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
  if (-not $AndroidSdkPath -or -not (Test-Path -LiteralPath $AndroidSdkPath -PathType Container)) {
    throw 'Set ANDROID_HOME or pass -AndroidSdkPath for an installed Android SDK.'
  }
  $AndroidSdkPath = (Resolve-Path -LiteralPath $AndroidSdkPath).Path
  foreach ($relativePath in @('platforms', 'build-tools', 'ndk/27.1.12297006', 'cmake/3.31.6/bin/cmake.exe', 'cmake/3.31.6/bin/ninja.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $AndroidSdkPath $relativePath))) {
      throw "Missing Android SDK component: $relativePath. Install it with Android SDK Manager."
    }
  }

  if (-not $JdkPath) { $JdkPath = $env:JAVA_HOME }
  if (-not $JdkPath) {
    $previewJavaCommand = Get-Command java.exe -CommandType Application -ErrorAction Stop
    $JdkPath = Split-Path -Parent (Split-Path -Parent $previewJavaCommand.Source)
  }
  $JdkPath = (Resolve-Path -LiteralPath $JdkPath).Path
  $previewJavaExe = Join-Path $JdkPath 'bin/java.exe'
  if (-not (Test-Path -LiteralPath $previewJavaExe -PathType Leaf) -or
      -not (Test-Path -LiteralPath (Join-Path $JdkPath 'bin/javac.exe') -PathType Leaf)) {
    throw 'A full JDK is required. Set JAVA_HOME or pass -JdkPath to its root directory.'
  }
  $previewJavaErrorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $previewJavaVersion = (& $previewJavaExe -version 2>&1 | Out-String)
    $previewJavaExitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previewJavaErrorPreference }
  if ($previewJavaExitCode -ne 0 -or $previewJavaVersion -notmatch 'version\s+"(?<major>\d+)(?:\.|\")' -or [int]$Matches.major -lt 17) {
    throw 'JDK 17 or later is required by the Android Gradle plugin.'
  }
  $previewJavaMajor = [int]$Matches.major

  if ($ApiUrl) { $env:EXPO_PUBLIC_API_URL = $ApiUrl }
  if ($env:EXPO_PUBLIC_API_URL) {
    $previewApiUri = $null
    if (-not [Uri]::TryCreate($env:EXPO_PUBLIC_API_URL, [UriKind]::Absolute, [ref]$previewApiUri) -or
        $previewApiUri.Scheme -ne 'https' -or $previewApiUri.UserInfo -or $previewApiUri.Query -or $previewApiUri.Fragment) {
      throw 'EXPO_PUBLIC_API_URL must be an HTTPS API base URL without credentials, query or fragment.'
    }
  }
  $env:JAVA_HOME = $JdkPath
  $env:ANDROID_HOME = $AndroidSdkPath
  $env:ANDROID_SDK_ROOT = $AndroidSdkPath
  $env:PATH = (Join-Path $JdkPath 'bin') + [System.IO.Path]::PathSeparator + $env:PATH
  $env:CI = '1'
  $env:APP_VARIANT = 'development'
  $env:NODE_ENV = 'production'
  $env:EXPO_NO_DOTENV = '1'

  Push-Location -LiteralPath $previewMobileRoot
  $previewLocationChanged = $true
  ('Tools: Node ' + $previewNodeVersion + '; pnpm ' + $previewPnpmVersion + '; JDK ' + $previewJavaMajor) | Tee-Object -FilePath $previewLogPath -Append
  'Synchronizing Android from app.config.ts without cleaning existing native files.' | Tee-Object -FilePath $previewLogPath -Append
  # Expo SDK 58 cleans by default. Opt out explicitly to retain incremental
  # Gradle/CMake outputs and avoid deleting the generated Android directory.
  Invoke-PreviewLoggedCommand -Executable $previewPnpm.Source -ArgumentList @('exec', 'expo', 'prebuild', '--platform', 'android', '--no-install', '--no-clean')

  $previewAndroidRoot = Join-Path $previewMobileRoot 'android'
  $previewGradleWrapper = Join-Path $previewAndroidRoot 'gradlew.bat'
  $previewAppBuildFile = Join-Path $previewAndroidRoot 'app/build.gradle'
  if (-not (Test-Path -LiteralPath $previewGradleWrapper -PathType Leaf) -or
      -not (Test-Path -LiteralPath $previewAppBuildFile -PathType Leaf)) {
    throw 'Expo did not generate the expected Android Gradle project.'
  }
  $previewAppBuildContents = Get-Content -LiteralPath $previewAppBuildFile -Raw
  if ($previewAppBuildContents -notmatch '(?s)release\s*\{[^}]*signingConfig\s+signingConfigs\.debug' -or
      -not (Test-Path -LiteralPath (Join-Path $previewAndroidRoot 'app/debug.keystore') -PathType Leaf)) {
    throw 'This runner expects the generated local debug signing configuration for release previews.'
  }
  Set-Location -LiteralPath $previewAndroidRoot
  $previewGradleArguments = @(
    ':app:assembleRelease'
    '-PreactNativeArchitectures=arm64-v8a'
    '-Pkotlin.compiler.execution.strategy=in-process'
    '--max-workers=2'
    '--no-daemon'
    '--console=plain'
  )
  'Building arm64 release preview with two workers and in-process Kotlin.' | Tee-Object -FilePath $previewLogPath -Append
  Invoke-PreviewLoggedCommand -Executable $previewGradleWrapper -ArgumentList $previewGradleArguments

  $previewBuiltApk = Join-Path $previewAndroidRoot 'app/build/outputs/apk/release/app-release.apk'
  if (-not (Test-Path -LiteralPath $previewBuiltApk -PathType Leaf)) {
    throw 'Gradle succeeded but the expected release APK was not found.'
  }
  Copy-Item -LiteralPath $previewBuiltApk -Destination $previewApkPath -Force
  $previewHash = (Get-FileHash -LiteralPath $previewApkPath -Algorithm SHA256).Hash.ToLowerInvariant()
  ($previewHash + '  souq-hamad-android-preview.apk') | Set-Content -LiteralPath ($previewApkPath + '.sha256') -Encoding ASCII
  ('APK: ' + $previewApkPath) | Tee-Object -FilePath $previewLogPath -Append
  ('SHA256: ' + $previewHash) | Tee-Object -FilePath $previewLogPath -Append
  $previewExitCode = 0
} catch {
  $previewFailure = 'Android preview build failed: ' + $_.Exception.Message
  Write-Output $previewFailure
  if (Test-Path -LiteralPath $previewArtifactDir -PathType Container) {
    Add-Content -LiteralPath $previewLogPath -Value $previewFailure -Encoding UTF8
  }
} finally {
  if ($previewLocationChanged) { Pop-Location }
  foreach ($key in $previewPreviousEnvironment.Keys) {
    [System.Environment]::SetEnvironmentVariable($key, $previewPreviousEnvironment[$key], 'Process')
  }
  $ErrorActionPreference = $previewPreviousErrorPreference
}

$global:LASTEXITCODE = $previewExitCode
if ($MyInvocation.InvocationName -ne '.') { exit $previewExitCode }
