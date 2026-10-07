param(
  [string]$SourceIconPath = "C:\Users\maher\Desktop\Souq-Hamad-icon.png",
  [string]$AndroidResPath = "C:\Users\maher\Desktop\app\mobile-app\android\app\src\main\res",
  [string]$IosIconPath = "C:\Users\maher\Desktop\app\mobile-app\ios\App\App\Assets.xcassets\AppIcon.appiconset"
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($SourceIconPath)

function New-IconImage {
  param(
    [string]$OutputPath,
    [int]$Size,
    [double]$InsetRatio = 0
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $inset = [int]($Size * $InsetRatio)
  $targetSize = $Size - ($inset * 2)
  $graphics.DrawImage($source, $inset, $inset, $targetSize, $targetSize)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-IosAppIconSet {
  param(
    [string]$OutputPath
  )

  if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
  }

  Get-ChildItem -Path $OutputPath -Filter "AppIcon-*.png" -ErrorAction SilentlyContinue |
    Remove-Item -Force

  $icons = @(
    @{ idiom = "iphone"; size = "20x20"; scale = "2x"; pixels = 40 },
    @{ idiom = "iphone"; size = "20x20"; scale = "3x"; pixels = 60 },
    @{ idiom = "iphone"; size = "29x29"; scale = "2x"; pixels = 58 },
    @{ idiom = "iphone"; size = "29x29"; scale = "3x"; pixels = 87 },
    @{ idiom = "iphone"; size = "40x40"; scale = "2x"; pixels = 80 },
    @{ idiom = "iphone"; size = "40x40"; scale = "3x"; pixels = 120 },
    @{ idiom = "iphone"; size = "60x60"; scale = "2x"; pixels = 120 },
    @{ idiom = "iphone"; size = "60x60"; scale = "3x"; pixels = 180 },
    @{ idiom = "ipad"; size = "20x20"; scale = "1x"; pixels = 20 },
    @{ idiom = "ipad"; size = "20x20"; scale = "2x"; pixels = 40 },
    @{ idiom = "ipad"; size = "29x29"; scale = "1x"; pixels = 29 },
    @{ idiom = "ipad"; size = "29x29"; scale = "2x"; pixels = 58 },
    @{ idiom = "ipad"; size = "40x40"; scale = "1x"; pixels = 40 },
    @{ idiom = "ipad"; size = "40x40"; scale = "2x"; pixels = 80 },
    @{ idiom = "ipad"; size = "76x76"; scale = "1x"; pixels = 76 },
    @{ idiom = "ipad"; size = "76x76"; scale = "2x"; pixels = 152 },
    @{ idiom = "ipad"; size = "83.5x83.5"; scale = "2x"; pixels = 167 },
    @{ idiom = "ios-marketing"; size = "1024x1024"; scale = "1x"; pixels = 1024 }
  )

  $contentsImages = @()

  foreach ($icon in $icons) {
    $filename = "AppIcon-$($icon.idiom)-$($icon.size.Replace('.', '_'))@$($icon.scale).png"
    New-IconImage -OutputPath (Join-Path $OutputPath $filename) -Size $icon.pixels
    $contentsImages += [ordered]@{
      filename = $filename
      idiom = $icon.idiom
      scale = $icon.scale
      size = $icon.size
    }
  }

  $contents = [ordered]@{
    images = $contentsImages
    info = [ordered]@{
      author = "xcode"
      version = 1
    }
  }

  $contents |
    ConvertTo-Json -Depth 5 |
    Set-Content -Path (Join-Path $OutputPath "Contents.json") -Encoding UTF8
}

function New-AndroidIconImage {
  param(
    [string]$OutputPath,
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $graphics.DrawImage($source, 0, 0, $Size, $Size)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-AndroidBackgroundLayer {
  param(
    [string]$OutputPath,
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($source, 0, 0, $Size, $Size)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-AndroidForegroundLayer {
  param(
    [string]$OutputPath,
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $graphics.Dispose()

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$androidIcons = @(
  @{ Dir = "mipmap-mdpi"; Size = 48 },
  @{ Dir = "mipmap-hdpi"; Size = 72 },
  @{ Dir = "mipmap-xhdpi"; Size = 96 },
  @{ Dir = "mipmap-xxhdpi"; Size = 144 },
  @{ Dir = "mipmap-xxxhdpi"; Size = 192 }
)

foreach ($icon in $androidIcons) {
  $dir = Join-Path $AndroidResPath $icon.Dir
  New-AndroidIconImage -OutputPath (Join-Path $dir "ic_launcher.png") -Size $icon.Size
  New-AndroidIconImage -OutputPath (Join-Path $dir "ic_launcher_round.png") -Size $icon.Size
  New-AndroidBackgroundLayer -OutputPath (Join-Path $dir "ic_launcher_background.png") -Size $icon.Size
  New-AndroidForegroundLayer -OutputPath (Join-Path $dir "ic_launcher_foreground.png") -Size $icon.Size
}

New-IosAppIconSet -OutputPath $IosIconPath

$source.Dispose()
