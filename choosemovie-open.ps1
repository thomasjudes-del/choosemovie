param([Parameter(Position=0)][string]$Uri)

$ErrorActionPreference = 'Stop'

function Show-ChooseMovieMessage([string]$message) {
    try {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, 'ChooseMovie') | Out-Null
    } catch {
        Write-Host $message
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($Uri)) {
        throw 'Aucun chemin reçu.'
    }

    $prefix = 'choosemovie://open?path='
    if (-not $Uri.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Lien ChooseMovie invalide.'
    }

    $encoded = $Uri.Substring($prefix.Length)
    $path = [System.Uri]::UnescapeDataString($encoded)

    if ($path -match '^[A-Za-z]:/') {
        $path = $path.Replace('/', '\')
    }

    if (Test-Path -LiteralPath $path -PathType Container) {
        & explorer.exe $path
        exit 0
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        & explorer.exe "/select,$path"
        exit 0
    }

    $root = [System.IO.Path]::GetPathRoot($path)
    if ($root -and -not (Test-Path -LiteralPath $root)) {
        Show-ChooseMovieMessage "Le disque $root n'est pas disponible. Branche-le puis réessaie.\n\n$path"
        exit 2
    }

    Show-ChooseMovieMessage "Ce chemin n'existe plus ou n'est pas assez précis :\n\n$path"
    exit 3
}
catch {
    Show-ChooseMovieMessage ("Impossible d'ouvrir cet emplacement :\n\n" + $_.Exception.Message)
    exit 1
}
