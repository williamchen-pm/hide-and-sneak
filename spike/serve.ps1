# Minimal local web server for the spike probe (no Python or Node needed).
# Serves this folder (or -Root <folder>) at http://localhost:8000/ . Close the window to stop.
# Demo: powershell -ExecutionPolicy Bypass -File .\spike\serve.ps1 -Root .   then open http://localhost:8000/demo/job-application.html
param([string]$Root = $PSScriptRoot)
$root = (Resolve-Path $Root).Path.TrimEnd('\')
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8000/')
$listener.Start()
Write-Host "Serving $root at http://localhost:8000/  (Ctrl+C to stop)"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.css'='text/css'; '.png'='image/png'; '.json'='application/json' }
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'probe.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($path.StartsWith($root) -and (Test-Path $path -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($path)
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.Close()
    Write-Host "$($ctx.Request.HttpMethod) /$rel -> $($ctx.Response.StatusCode)"
  }
} finally { $listener.Stop() }
