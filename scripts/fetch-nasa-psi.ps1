param(
  [string[]]$InvestigationIds = @('PSI-25', 'PSI-26', 'PSI-69', 'PSI-98', 'PSI-99', 'PSI-100', 'PSI-101', 'PSI-102')
)

# Public metadata, experimental CSV tables and one bounded telemetry workbook. Existing
# downloaded files are retained; no credentials, agreements or private endpoints.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$datasetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/data/nasa-psi'))
New-Item -ItemType Directory -Path $datasetRoot -Force | Out-Null
$investigations = @()

foreach ($investigationId in $InvestigationIds) {
  if ($investigationId -notmatch '^PSI-[0-9]+$') { throw 'Expected a NASA PSI accession.' }
  $record = [ordered]@{
    id = $investigationId
    sourceUrl = "https://psi.nasa.gov/physci/repo/data/investigations/$investigationId"
    metadataUrl = "https://psi.nasa.gov/geode-py/ws/repo/investigations/$investigationId"
    tables = @()
    workbooks = @()
    accessNotes = @()
  }
  try {
    $metadataFile = Join-Path $datasetRoot "$investigationId-metadata.json"
    if (-not (Test-Path -LiteralPath $metadataFile)) {
      Invoke-WebRequest -UseBasicParsing -Uri $record.metadataUrl -OutFile $metadataFile -TimeoutSec 30
    }
    $metadata = Get-Content -Encoding utf8 -Raw -LiteralPath $metadataFile | ConvertFrom-Json
    if ($metadata.restricted -or -not $metadata.public) { throw 'The record is not marked public.' }
    $record.title = $metadata.title
    $record.acronym = $metadata.investigationAcronym
    $record.doi = $metadata.doi
    $record.version = $metadata.version
    $record.license = $metadata.licenseIdentifier
    $record.metadataPath = "/data/nasa-psi/$investigationId-metadata.json"
    $record.metadataSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $metadataFile).Hash.ToLowerInvariant()

    foreach ($table in $metadata.experimentalTable) {
      if ($table.restricted -or -not $table.visible -or $table.file_name -notmatch '[.]csv$') { continue }
      if ($table.file_size -gt 2MB) { $record.accessNotes += 'Experimental table exceeds the 2 MB import limit.'; continue }
      $tableName = [IO.Path]::GetFileName($table.file_name)
      if ($tableName -ne $table.file_name) { throw 'Unexpected path in NASA table name.' }
      $tableFile = Join-Path $datasetRoot $tableName
      $downloadUrl = "https://psi.nasa.gov/geode-py/ws/studies/$investigationId/download?file=$([uri]::EscapeDataString($table.file_name))&version=$($table.version)&redirect=false"
      try {
        if (-not (Test-Path -LiteralPath $tableFile)) {
          $downloadResponse = Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -TimeoutSec 30
          $publicFileUrl = $downloadResponse.Content.Trim()
          if ($publicFileUrl.StartsWith('"')) { $publicFileUrl = $publicFileUrl | ConvertFrom-Json }
          if ($publicFileUrl -notmatch '^https://') { throw 'NASA did not return a public HTTPS download.' }
          # The temporary download URL remains in memory and is never stored.
          Invoke-WebRequest -UseBasicParsing -Uri $publicFileUrl -OutFile $tableFile -TimeoutSec 30
        }
        $record.tables += [ordered]@{
          fileName = $tableName
          version = $table.version
          bytes = (Get-Item -LiteralPath $tableFile).Length
          sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $tableFile).Hash.ToLowerInvariant()
          path = "/data/nasa-psi/$tableName"
          downloadEndpoint = $downloadUrl
          dataClass = 'NASA experimental table; column semantics retained from source'
        }
      } catch {
        $record.accessNotes += "Public download unavailable for $tableName. HTTP or access failure; no authentication was attempted."
      }
    }
    if ($investigationId -eq 'PSI-98') {
      $workbook = $metadata.added | Where-Object { $_.file_name -eq 'PSI-98_Raw Data_Saffire-I Telemetry Data Good Process Version.xlsx' }
      if ($workbook -and -not $workbook.restricted -and $workbook.file_size -lt 10MB) {
        $workbookPath = Join-Path $datasetRoot ([IO.Path]::GetFileName($workbook.file_name))
        $workbookEndpoint = "https://psi.nasa.gov/geode-py/ws/studies/PSI-98/download?file=$([uri]::EscapeDataString($workbook.file_name))&version=$($workbook.version)&redirect=false"
        try {
          if (-not (Test-Path -LiteralPath $workbookPath)) {
            $workbookResponse = Invoke-WebRequest -UseBasicParsing -Uri $workbookEndpoint -TimeoutSec 30
            $workbookUrl = $workbookResponse.Content.Trim()
            if ($workbookUrl.StartsWith('"')) { $workbookUrl = $workbookUrl | ConvertFrom-Json }
            if ($workbookUrl -notmatch '^https://') { throw 'No public HTTPS workbook download.' }
            Invoke-WebRequest -UseBasicParsing -Uri $workbookUrl -OutFile $workbookPath -TimeoutSec 30
          }
          $record.workbooks += [ordered]@{
            fileName = $workbook.file_name
            version = $workbook.version
            bytes = (Get-Item -LiteralPath $workbookPath).Length
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $workbookPath).Hash.ToLowerInvariant()
            path = "/data/nasa-psi/$($workbook.file_name)"
            downloadEndpoint = $workbookEndpoint
            dataClass = 'NASA Saffire-I telemetry workbook; original bytes'
          }
        } catch { $record.accessNotes += 'Public telemetry workbook download unavailable.' }
      }
    }
    Write-Host "$investigationId : public metadata, $($record.tables.Count) experimental CSV table(s), $($record.workbooks.Count) telemetry workbook(s)."
  } catch {
    $record.accessNotes += 'Metadata retrieval unavailable or record not public.'
    Write-Host "$investigationId : metadata retrieval unavailable."
  }
  $investigations += $record
}

$manifest = [ordered]@{
  schemaVersion = 1
  retrievedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  purpose = 'Public NASA PSI records and experimental tables; no measurements inferred from citation abstracts.'
  investigations = $investigations
}
$manifestFile = Join-Path $datasetRoot 'manifest.json'
# Merge prior investigations so a targeted refresh cannot remove earlier data.
if (Test-Path -LiteralPath $manifestFile) {
  $previous = Get-Content -Encoding utf8 -Raw -LiteralPath $manifestFile | ConvertFrom-Json
  $retained = @($previous.investigations | Where-Object { $_.id -notin $InvestigationIds })
  $manifest.investigations = @($retained) + @($investigations)
}
$manifest | ConvertTo-Json -Depth 15 | Set-Content -Encoding utf8 -LiteralPath $manifestFile
