param(
    [ValidateSet('analise', 'llm')][string]$Modo = 'llm',
    [string]$Planilha = '',
    [string]$Modelo = 'qwen3:4b'
)
$ErrorActionPreference = 'Stop'
$projetoDiretorio = $PSScriptRoot
$pythonExecutavel = Join-Path $projetoDiretorio '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExecutavel)) {
    throw 'Ambiente Python ausente. Siga a instalação descrita no README.md.'
}
if (!$Planilha) {
    $arquivos = @(Get-ChildItem -LiteralPath $projetoDiretorio -Filter '*.xlsx' -File)
    if ($arquivos.Count -ne 1) { throw 'Informe -Planilha com o caminho do arquivo .xlsx.' }
    $Planilha = $arquivos[0].FullName
}
if ($Modo -eq 'llm') {
    $ollamaExecutavel = Join-Path $projetoDiretorio '.runtime\Ollama\ollama.exe'
    if (!(Test-Path -LiteralPath $ollamaExecutavel)) {
        $comando = Get-Command ollama -ErrorAction SilentlyContinue
        if (!$comando) { throw 'Ollama ausente. Siga a instalação descrita no README.md.' }
        $ollamaExecutavel = $comando.Source
    }
    # Configuração apenas deste processo e do servidor iniciado por ele.
    $env:OLLAMA_MODELS = Join-Path $projetoDiretorio '.runtime\models'
    $env:OLLAMA_NO_CLOUD = 'true'
    New-Item -ItemType Directory -Path $env:OLLAMA_MODELS -Force | Out-Null
    $ativo = $false
    try {
        $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 3
        $ativo = $true
    } catch { }
    if (!$ativo) {
        Start-Process -FilePath $ollamaExecutavel -ArgumentList 'serve' -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $projetoDiretorio 'ollama-servidor.log') `
            -RedirectStandardError (Join-Path $projetoDiretorio 'ollama-servidor-erro.log')
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Milliseconds 500
            try {
                $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 1
                $ativo = $true
                break
            } catch { }
        }
        if (!$ativo) { throw 'Ollama não iniciou. Consulte ollama-servidor-erro.log.' }
    }
    $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10
    if ($Modelo -notin @($tags.models.name)) {
        Write-Host "Baixando o modelo local $Modelo..."
        & $ollamaExecutavel pull $Modelo
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar o modelo.' }
    }
}
& $pythonExecutavel (Join-Path $projetoDiretorio 'recomendar.py') $Planilha --modo $Modo --modelo $Modelo --saida (Join-Path $projetoDiretorio 'resultados')
exit $LASTEXITCODE
