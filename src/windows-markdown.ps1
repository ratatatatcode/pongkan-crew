$ErrorActionPreference = 'Stop'
# Node sends UTF-8 JSON through redirected stdin, independent of the console code page.
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    Add-Type -Path (Join-Path $PSScriptRoot 'windows-markdown.cs')
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    [PongkanMarkdownWriter]::Run($request.folder, $request.key, $request.content, $null, [string[]]$request.obsolete)
    [Console]::Out.Write('{"ok":true}')
} catch {
    [Console]::Out.Write((@{ error = $_.Exception.GetBaseException().Message } | ConvertTo-Json -Compress))
    exit 1
}
