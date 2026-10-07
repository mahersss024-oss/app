param(
  [string]$WordmarkPath = "C:\Users\maher\Desktop\AI\SmartStoreAI\public\hamad-market-wordmark.png",
  [string]$AndroidResPath = "C:\Users\maher\Desktop\app\mobile-app\android\app\src\main\res",
  [string]$IosSplashPath = "C:\Users\maher\Desktop\app\mobile-app\ios\App\App\Assets.xcassets\Splash.imageset",
  [string]$Tagline = ""
)

Add-Type -AssemblyName System.Drawing

$wordmark = [System.Drawing.Image]::FromFile($WordmarkPath)
$defaultTagline = -join ([int[]](
  0x0633, 0x0648, 0x0642, 0x0643, 0x0020,
  0x0627, 0x0644, 0x0630, 0x0643, 0x064A, 0x0020,
  0x0644, 0x0644, 0x0628, 0x064A, 0x0639, 0x0020,
  0x0648, 0x0627, 0x0644, 0x0634, 0x0631, 0x0627, 0x0621
) | ForEach-Object { [char]$_ })
if ([string]::IsNullOrWhiteSpace($Tagline)) {
  $Tagline = $defaultTagline
}

function New-SplashImage {
  param(
    [string]$OutputPath,
    [int]$Width,
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
  $topLeft = [System.Drawing.Color]::FromArgb(255, 8, 17, 29)
  $middle = [System.Drawing.Color]::FromArgb(255, 13, 43, 40)
  $bottomRight = [System.Drawing.Color]::FromArgb(255, 17, 124, 139)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    $topLeft,
    $bottomRight,
    150
  )
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend
  $blend.Positions = [single[]](0, 0.44, 1)
  $blend.Colors = [System.Drawing.Color[]]($topLeft, $middle, $bottomRight)
  $brush.InterpolationColors = $blend
  $graphics.FillRectangle($brush, $rect)

  $glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(72, 28, 194, 111))
  $graphics.FillEllipse($glowBrush1, [int]($Width * 0.24), [int]($Height * 0.08), [int]($Width * 0.52), [int]($Height * 0.38))
  $glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(64, 17, 124, 139))
  $graphics.FillEllipse($glowBrush2, [int]($Width * 0.52), [int]($Height * 0.28), [int]($Width * 0.52), [int]($Height * 0.44))

  $targetWidth = [Math]::Min($Width * 0.74, 980)
  $targetHeight = $targetWidth * $wordmark.Height / $wordmark.Width
  if ($targetHeight -gt $Height * 0.34) {
    $targetHeight = $Height * 0.34
    $targetWidth = $targetHeight * $wordmark.Width / $wordmark.Height
  }

  $x = ($Width - $targetWidth) / 2
  $y = ($Height * 0.42) - ($targetHeight / 2)
  $graphics.DrawImage($wordmark, [single]$x, [single]$y, [single]$targetWidth, [single]$targetHeight)

  $fontSize = [Math]::Max(14, [Math]::Min($Width, $Height) * 0.034)
  $taglineFont = New-Object System.Drawing.Font("Arial", [single]$fontSize, [System.Drawing.FontStyle]::Bold)
  $taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 244, 252, 255))
  $taglineFormat = New-Object System.Drawing.StringFormat
  $taglineFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $taglineFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $taglineFormat.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft

  $loaderWidth = [Math]::Min($Width * 0.54, 220 * ($Width / 390))
  $loaderHeight = [Math]::Max(4, [Math]::Min($Width, $Height) * 0.004)
  $contentBottom = $Height - [Math]::Max($Height * 0.085, 54)
  $loaderY = $contentBottom - $loaderHeight
  $taglineHeight = $fontSize * 1.55
  $taglineY = $loaderY - ($fontSize * 2.25)
  $taglineRect = New-Object System.Drawing.RectangleF(0, [single]$taglineY, [single]$Width, [single]$taglineHeight)
  $graphics.DrawString($Tagline, $taglineFont, $taglineBrush, $taglineRect, $taglineFormat)

  $loaderX = ($Width - $loaderWidth) / 2
  $loaderTrackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(61, 244, 252, 255))
  $loaderFillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF([single]$loaderX, [single]$loaderY, [single]($loaderWidth * 0.56), [single]$loaderHeight)),
    [System.Drawing.Color]::FromArgb(82, 90, 200, 255),
    [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
    0
  )
  $graphics.FillRectangle($loaderTrackBrush, [single]$loaderX, [single]$loaderY, [single]$loaderWidth, [single]$loaderHeight)
  $graphics.FillRectangle($loaderFillBrush, [single]$loaderX, [single]$loaderY, [single]($loaderWidth * 0.34), [single]$loaderHeight)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $brush.Dispose()
  $glowBrush1.Dispose()
  $glowBrush2.Dispose()
  $taglineFont.Dispose()
  $taglineBrush.Dispose()
  $taglineFormat.Dispose()
  $loaderTrackBrush.Dispose()
  $loaderFillBrush.Dispose()
  $bitmap.Dispose()
}

$androidTargets = @(
  @{ Path = "drawable\splash.png"; Width = 1366; Height = 1366 },
  @{ Path = "drawable-land-mdpi\splash.png"; Width = 480; Height = 320 },
  @{ Path = "drawable-land-hdpi\splash.png"; Width = 800; Height = 480 },
  @{ Path = "drawable-land-xhdpi\splash.png"; Width = 1280; Height = 720 },
  @{ Path = "drawable-land-xxhdpi\splash.png"; Width = 1600; Height = 960 },
  @{ Path = "drawable-land-xxxhdpi\splash.png"; Width = 1920; Height = 1280 },
  @{ Path = "drawable-port-mdpi\splash.png"; Width = 320; Height = 480 },
  @{ Path = "drawable-port-hdpi\splash.png"; Width = 480; Height = 800 },
  @{ Path = "drawable-port-xhdpi\splash.png"; Width = 720; Height = 1280 },
  @{ Path = "drawable-port-xxhdpi\splash.png"; Width = 960; Height = 1600 },
  @{ Path = "drawable-port-xxxhdpi\splash.png"; Width = 1280; Height = 1920 }
)

foreach ($target in $androidTargets) {
  New-SplashImage `
    -OutputPath (Join-Path $AndroidResPath $target.Path) `
    -Width $target.Width `
    -Height $target.Height
}

New-SplashImage -OutputPath (Join-Path $IosSplashPath "splash-2732x2732.png") -Width 2732 -Height 2732
New-SplashImage -OutputPath (Join-Path $IosSplashPath "splash-2732x2732-1.png") -Width 2732 -Height 2732
New-SplashImage -OutputPath (Join-Path $IosSplashPath "splash-2732x2732-2.png") -Width 2732 -Height 2732

$wordmark.Dispose()
