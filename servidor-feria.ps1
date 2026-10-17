$ErrorActionPreference = 'Stop'
$rootPrefix = [System.IO.Path]::GetFullPath($PSScriptRoot) + [System.IO.Path]::DirectorySeparatorChar
$listener = $null
$port = 0
foreach ($candidate in 8765..8785) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $candidate)
    try {
        $probe.Server.ExclusiveAddressUse = $true
        $probe.Start()
        $listener = $probe
        $port = $candidate
        break
    } catch [System.Net.Sockets.SocketException] {
        $probe.Stop()
    }
}
if (-not $listener) { throw 'No hay puertos libres entre 8765 y 8785. Cierra otro servidor local y vuelve a intentarlo.' }
$lanAddresses = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object { $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up } |
    ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
    Where-Object { $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        -not [System.Net.IPAddress]::IsLoopback($_.Address) -and
        $_.Address.ToString() -notlike '169.254.*' } |
    ForEach-Object { $_.Address.ToString() }
Write-Host "Feria Empresarial disponible en http://localhost:$port/"
Write-Host "Tambien puedes abrir http://127.0.0.1:$port/"
foreach ($address in $lanAddresses) {
    Write-Host "Prueba desde un celular conectado a la misma red: http://${address}:$port/"
}
Write-Host 'Cierra esta ventana para detener el servidor.'
Start-Process "http://localhost:$port/"
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 2500
            $client.SendTimeout = 2500
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            $headersComplete = $false
            while ($true) {
                $headerLine = $reader.ReadLine()
                if ($null -eq $headerLine) { break }
                if ($headerLine -eq '') {
                    $headersComplete = $true
                    break
                }
            }
            if (-not $headersComplete) { continue }
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
