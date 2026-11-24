# Baixa a versão mais nova do Bloqueador de Spoiler e troca os arquivos desta pasta.
# Rodado pelo atualizar.bat (dois cliques). Seus ajustes ficam salvos no navegador, não aqui.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$pasta = $PSScriptRoot
$api = 'https://api.github.com/repos/lucasbeezerra/bloqueador-de-spoiler/releases/latest'
$tmp = Join-Path $env:TEMP ('bloqueador-' + [guid]::NewGuid())
try {
  $antes = (Get-Content (Join-Path $pasta 'manifest.json') -Raw | ConvertFrom-Json).version
  Write-Host ''
  Write-Host '  Baixando a versão mais nova...' -ForegroundColor Cyan
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'nova.zip'
  $semCache = @{ 'Cache-Control' = 'no-cache'; 'Pragma' = 'no-cache' }
  $info = Invoke-RestMethod -Uri ($api + '?t=' + [DateTime]::Now.Ticks) -Headers $semCache -UseBasicParsing
  $url = ($info.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1).browser_download_url
  if (-not $url) { throw 'Não achei o arquivo da versão nova no GitHub.' }
  Invoke-WebRequest -Uri $url -OutFile $zip -Headers $semCache -UseBasicParsing
  Expand-Archive $zip (Join-Path $tmp 'nova') -Force
  $manifesto = Get-ChildItem (Join-Path $tmp 'nova') -Recurse -Filter manifest.json | Select-Object -First 1
  if (-not $manifesto) { throw 'O arquivo baixado não tem a extensão dentro.' }
  $origem = $manifesto.DirectoryName
  $depois = (Get-Content $manifesto.FullName -Raw | ConvertFrom-Json).version
  Get-ChildItem $origem -Force | Where-Object { $_.Name -ne 'atualizar.bat' } |
    ForEach-Object { Copy-Item $_.FullName $pasta -Recurse -Force }
  Get-ChildItem $pasta -Recurse -File | Unblock-File
  Write-Host ''
  if ($antes -eq $depois) {
    Write-Host "  Você já estava na versão mais nova ($depois)." -ForegroundColor Green
  } else {
    Write-Host "  Pronto! Atualizado da versão $antes para a $depois." -ForegroundColor Green
  }
  Write-Host '  Agora clique no botão da extensão no navegador e em "Já atualizei, recarregar".'
  Write-Host '  (Ou, em brave://extensions, no botão de recarregar do cartão da extensão.)'
} catch {
  Write-Host ''
  Write-Host '  Não deu para atualizar:' -ForegroundColor Red
  Write-Host ('  ' + $_.Exception.Message)
  Write-Host '  Confira a internet e tente de novo.'
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host ''
