$ErrorActionPreference = 'Stop'
$rootPrefix = [System.IO.Path]::GetFullPath($PSScriptRoot) + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8765)
$listener.Start()
Write-Host 'Feria Empresarial disponible en http://127.0.0.1:8765/'
Write-Host 'Cierra esta ventana para detener el servidor.'
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            while ($reader.ReadLine() -ne '') { }
            $parts = $requestLine -split ' '
            $method = $parts[0]
            $requestPath = if ($parts.Length -gt 1) { ($parts[1] -split '\?')[0] } else { '/' }
            $relativePath = [System.Uri]::UnescapeDataString($requestPath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
            $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, $relativePath))
            $found = $method -eq 'GET' -and $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($filePath)
            if ($found) {
                $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                $contentType = switch ($extension) {
                    '.html' { 'text/html; charset=utf-8' }
                    '.js' { 'text/javascript; charset=utf-8' }
                    '.mjs' { 'text/javascript; charset=utf-8' }
                    '.css' { 'text/css; charset=utf-8' }
                    '.svg' { 'image/svg+xml' }
                    '.png' { 'image/png' }
                    '.webp' { 'image/webp' }
                    '.wasm' { 'application/wasm' }
                    '.tflite' { 'application/octet-stream' }
                    '.md' { 'text/markdown; charset=utf-8' }
                    default { 'application/octet-stream' }
                }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $status = '200 OK'
            } else {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
                $contentType = 'text/plain; charset=utf-8'
                $status = '404 Not Found'
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush()
        } catch {
            Write-Warning $_
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}

