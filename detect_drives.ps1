[CmdletBinding()]
param (
    [string]$Action = "Detect",
    [string]$Drive = "",
    [string]$ConfigFile = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($Action -eq "Eject") {
    if (!$Drive) {
        ConvertTo-Json @{ success = $false; error = "Missing drive letter" }
        exit
    }
    $letter = $Drive.Substring(0, 1).ToUpper() + ":"
    try {
        $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
        $targetIndex = -1
        for ($i = 0; $i -lt $dm.Count; $i++) {
            $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
            $rec.InitializeDiscRecorder($dm.Item($i))
            if ($rec.VolumePathNames -contains "$letter\") {
                $targetIndex = $i
                break
            }
        }
        if ($targetIndex -eq -1) {
            ConvertTo-Json @{ success = $false; error = "Drive not found by IMAPI2" }
            exit
        }
        $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $recorder.InitializeDiscRecorder($dm.Item($targetIndex))
        $recorder.EjectMedia()
        ConvertTo-Json @{ success = $true }
    } catch {
        ConvertTo-Json @{ success = $false; error = $_.Exception.Message }
    }
    exit
}

if ($Action -eq "Erase") {
    if (!$Drive) {
        ConvertTo-Json @{ success = $false; error = "Missing drive letter" }
        exit
    }
    
    $letter = $Drive.Substring(0, 1).ToUpper() + ":"
    try {
        $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
        $targetIndex = -1
        for ($i = 0; $i -lt $dm.Count; $i++) {
            $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
            $rec.InitializeDiscRecorder($dm.Item($i))
            if ($rec.VolumePathNames -contains "$letter\") {
                $targetIndex = $i
                break
            }
        }
        
        if ($targetIndex -eq -1) {
            ConvertTo-Json @{ success = $false; error = "Drive not found by IMAPI2" }
            exit
        }
        
        $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $recorder.InitializeDiscRecorder($dm.Item($targetIndex))
        
        $eraser = New-Object -ComObject IMAPI2.MsftDiscFormat2Erase
        $eraser.Recorder = $recorder
        $eraser.FullErase = $false # Quick Erase
        $eraser.ClientName = "FlashBurn"
        
        $eraser.EraseMedia()
        
        ConvertTo-Json @{ success = $true }
    } catch {
        ConvertTo-Json @{ success = $false; error = $_.Exception.Message }
    }
    exit
}

if ($Action -eq "Rip") {
    if (!$Drive) {
        Write-Output "ERROR: Missing source drive letter."
        exit 1
    }
    if (!$ConfigFile) {
        Write-Output "ERROR: Missing output ISO destination file path."
        exit 1
    }

    $letter = $Drive.Substring(0, 1).ToUpper() + ":"
    $outputFile = $ConfigFile
    
    Write-Output "SYSTEM: Initializing MsftDiscMaster2 controller..."
    try {
        $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
        $targetIndex = -1
        for ($i = 0; $i -lt $dm.Count; $i++) {
            $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
            $rec.InitializeDiscRecorder($dm.Item($i))
            if ($rec.VolumePathNames -contains "$letter\") {
                $targetIndex = $i
                break
            }
        }
        
        if ($targetIndex -eq -1) {
            Write-Output "ERROR: Drive $letter not found by IMAPI2."
            exit 1
        }
        
        $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $recorder.InitializeDiscRecorder($dm.Item($targetIndex))
        
        Write-Output "DEVICE: Recorder found: $($recorder.VendorId) $($recorder.ProductId)"
        Write-Output "DEVICE: Claiming exclusive drive control (SPTI lock)..."
        try {
            $recorder.AcquireExclusiveAccess($true, "FlashBurn")
            Write-Output "DEVICE: Exclusive drive lock successfully acquired."
        } catch {
            Write-Output "WARN: Could not acquire exclusive drive lock: $($_.Exception.Message)"
        }
        
        Write-Output "SYSTEM: Querying media sector count..."
        $formatData = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
        $formatData.Recorder = $recorder
        $totalSectors = $formatData.TotalSectorsOnMedia
        
        if ($totalSectors -le 0) {
            Write-Output "ERROR: Disc is blank or contains no sectors to read."
            try { $recorder.ReleaseExclusiveAccess() } catch {}
            exit 1
        }
        
        Write-Output "SYSTEM: Disc has $totalSectors sectors (approx. $([math]::Round($totalSectors * 2048 / 1024 / 1024, 2)) MB)."
        Write-Output "RIP: Opening raw block stream for volume $letter..."
        
        # Read from raw disk volume e.g. \\.\D:
        $drivePath = "\\.\$letter"
        $inStream = New-Object System.IO.FileStream($drivePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $outStream = New-Object System.IO.FileStream($outputFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        
        $buffer = New-Object Byte[] 65536 # 64KB chunk (32 sectors per read)
        $bytesRead = 0
        $totalBytes = [double]$totalSectors * 2048
        $copiedBytes = 0
        $lastPercent = 0
        
        Write-Output "RIP: Active track streaming block-by-block. Please wait..."
        
        while (($bytesRead = $inStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $outStream.Write($buffer, 0, $bytesRead)
            $copiedBytes += $bytesRead
            
            $percent = [math]::Floor(($copiedBytes / $totalBytes) * 100)
            if ($percent -gt $lastPercent) {
                $lastPercent = $percent
                Write-Output "PERCENT: $percent% (Read LBA: $([math]::Round($copiedBytes/2048)) of $totalSectors sectors)"
            }
            
            if ($copiedBytes -ge $totalBytes) {
                break
            }
        }
        
        $inStream.Close()
        $outStream.Close()
        
        # Release lock
        try { $recorder.ReleaseExclusiveAccess() } catch {}
        
        Write-Output "SUCCESS: Optical disc extraction complete! Saved to: $outputFile"
        exit 0
    } catch {
        Write-Output "ERROR: Critical failure during rip process: $($_.Exception.Message)"
        if ($inStream) { $inStream.Close() }
        if ($outStream) { $outStream.Close() }
        try { if ($recorder) { $recorder.ReleaseExclusiveAccess() } } catch {}
        exit 1
    }
}

if ($Action -eq "Burn") {
    if (!$ConfigFile -or !(Test-Path $ConfigFile)) {
        Write-Output "ERROR: Missing or invalid burn configuration file."
        exit 1
    }
    
    Write-Output "SYSTEM: Loading burn session parameters..."
    try {
        $config = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Output "ERROR: Failed to parse burn configuration file: $($_.Exception.Message)"
        exit 1
    }
    
    # Debug: dump raw config
    Write-Output "DEBUG: Raw config file contents:"
    Write-Output (Get-Content $ConfigFile -Raw -Encoding UTF8)
    Write-Output "DEBUG: Parsed drive=$($config.drive), isISO=$($config.isISO), files count=$($config.files.Count)"
    
    $driveLetter = $config.drive
    $volumeLabel = $config.volumeLabel
    $isISO = $config.isISO
    $isoPath = $config.isoPath
    $isAppending = $config.isAppending
    $files = $config.files
    $folders = $config.folders
    
    if (!$driveLetter) {
        Write-Output "ERROR: Target drive letter is missing in the configuration."
        exit 1
    }
    
    $letter = $driveLetter.Substring(0, 1).ToUpper() + ":"
    Write-Output "SYSTEM: Initializing IMAPI2 (Image Mastering API) COM Subsystem..."
    
    try {
        $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
        $targetIndex = -1
        for ($i = 0; $i -lt $dm.Count; $i++) {
            $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
            $rec.InitializeDiscRecorder($dm.Item($i))
            if ($rec.VolumePathNames -contains "$letter\") {
                $targetIndex = $i
                break
            }
        }
        
        if ($targetIndex -eq -1) {
            Write-Output "ERROR: Target drive $letter was not found by IMAPI2 master controller."
            exit 1
        }
        
        $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $recorder.InitializeDiscRecorder($dm.Item($targetIndex))
        Write-Output "DEVICE: Recorder found: $($recorder.VendorId) $($recorder.ProductId) (Volume $letter)"
        
        if ($isISO -eq $true -or $isISO -eq "True") {
            if (!$isoPath -or !(Test-Path $isoPath)) {
                Write-Output "ERROR: ISO image file path is missing or invalid: $isoPath"
                exit 1
            }
            
            Write-Output "SYSTEM: Staging native ISO-9660 Sector Burn..."
            Write-Output "DEVICE: Locking disc drawer and calibrating writing laser..."
            Write-Output "BURN: Starting direct ISO block-to-block write using native Windows ISOBURN utility..."
            
            # Using isoburn.exe which is native to Windows 7/8/10/11
            $p = Start-Process -FilePath "isoburn.exe" -ArgumentList "/Q", $letter, "`"$isoPath`"" -NoNewWindow -PassThru -Wait
            
            if ($p.ExitCode -eq 0) {
                Write-Output "SUCCESS: ISO Image block write operation successfully completed!"
                exit 0
            } else {
                Write-Output "ERROR: Windows Native ISOBURN exit failure. Error Code: $($p.ExitCode)"
                exit 1
            }
        } else {
            # -- Create a temporary staging directory and copy all files into it --
            $stagingDir = Join-Path $env:TEMP "FlashBurn_Staging_$(Get-Random)"
            New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
            Write-Output "SYSTEM: Created staging directory: $stagingDir"
            
            $stagedCount = 0
            
            # Debug: Show what we received
            Write-Output "DEBUG: files type = $($files.GetType().Name), count = $($files.Count)"
            
            # Ensure $files is always an array (PowerShell may deserialize single-item arrays as scalars)
            if ($files -and $files -isnot [System.Array]) {
                $files = @($files)
            }
            
            # Copy individual files into staging root
            if ($files -and $files.Count -gt 0) {
                foreach ($f in $files) {
                    Write-Output "DEBUG: Checking file path: [$f]"
                    if (Test-Path $f -PathType Leaf) {
                        $name = Split-Path $f -Leaf
                        Write-Output "STAGING: Staging file -> $name"
                        try {
                            Copy-Item -Path $f -Destination (Join-Path $stagingDir $name) -Force
                            $stagedCount++
                        } catch {
                            Write-Output "WARN: Failed to stage file ${name}: $($_.Exception.Message)"
                        }
                    } else {
                        Write-Output "WARN: File path does not exist or is not a file: [$f]"
                    }
                }
            } else {
                Write-Output "WARN: No files array received in burn config."
            }
            # Ensure $folders is always an array
            if ($folders -and $folders -isnot [System.Array]) {
                $folders = @($folders)
            }
            
            # Copy entire folder contents into staging
            if ($folders -and $folders.Count -gt 0) {
                foreach ($fd in $folders) {
                    if (Test-Path $fd -PathType Container) {
                        $name = Split-Path $fd -Leaf
                        Write-Output "STAGING: Staging folder directory -> $name"
                        try {
                            Copy-Item -Path $fd -Destination (Join-Path $stagingDir $name) -Recurse -Force
                            $stagedCount++
                        } catch {
                            Write-Output "WARN: Failed to stage folder ${name}: $($_.Exception.Message)"
                        }
                    }
                }
            }
            
            if ($stagedCount -eq 0) {
                Write-Output "ERROR: No files were successfully staged. Nothing to burn."
                Remove-Item -Path $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
                exit 1
            }
            
            Write-Output "SYSTEM: $stagedCount item(s) staged. Building ISO9660/Joliet filesystem image..."
            
            $fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
            $fsi.ChooseImageDefaults($recorder)
            
            # Explicitly enable ISO9660, Joliet, and UDF filesystems for maximum compatibility with all Windows Explorer versions!
            try {
                $fsi.FileSystemsToCreate = 7 # 1 (ISO9660) + 2 (Joliet) + 4 (UDF)
            } catch {
                Write-Output "WARN: Failed to set FileSystemsToCreate to 7: $($_.Exception.Message)"
            }
            
            if ($volumeLabel) {
                $fsi.VolumeName = $volumeLabel
            } else {
                $fsi.VolumeName = "FLASHBURN"
            }
            
            # If appending (multisession), import the previous filesystem image!
            if ($isAppending -eq $true -or $isAppending -eq "True") {
                Write-Output "SYSTEM: Multisession append requested. Loading existing session from disc..."
                try {
                    $formatData = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
                    $formatData.Recorder = $recorder
                    $multisessionInterfaces = $formatData.MultisessionInterfaces
                    if ($multisessionInterfaces -and $multisessionInterfaces.Count -gt 0) {
                        $fsi.MultisessionInterfaces = $multisessionInterfaces
                        $fsi.ImportFileSystem() | Out-Null
                        Write-Output "SYSTEM: Existing session directory tree successfully imported!"
                    } else {
                        Write-Output "WARN: No previous multisession interfaces found. Performing fresh write."
                    }
                } catch {
                    Write-Output "WARN: Failed to import previous session: $($_.Exception.Message). Performing fresh write."
                }
            }
            
            # Use AddTree on the staging directory - this is the reliable IMAPI2 approach
            Write-Output "SYSTEM: Loading staging directory into IMAPI2 filesystem image (AddTree)..."
            $fsi.Root.AddTree($stagingDir, $false)
            
            Write-Output "SYSTEM: Compiling ISO9660/Joliet sector layout structure..."
            $resultImage = $fsi.CreateResultImage()
            $stream = $resultImage.ImageStream
            
            Write-Output "DEVICE: Initializing MsftDiscFormat2Data writer interface..."
            $formatData = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
            $formatData.Recorder = $recorder
            $formatData.ClientName = "FlashBurn"
            
            Write-Output "DEVICE: Claiming exclusive drive control (SPTI lock)..."
            try {
                $recorder.AcquireExclusiveAccess($true, "FlashBurn")
                Write-Output "DEVICE: Exclusive drive lock successfully acquired."
            } catch {
                Write-Output "WARN: Could not acquire exclusive drive lock: $($_.Exception.Message)"
            }
            
            Write-Output "DEVICE: Arming laser write session and locking disc tray..."
            Write-Output "BURN: Performing active track burn session. Please wait..."
            
            $formatData.Write($stream)
            
            try { $recorder.ReleaseExclusiveAccess() } catch {}
            
            # Autoeject media if requested in config
            if ($config.ejectDisc -eq $true -or $config.ejectDisc -eq "True") {
                try {
                    Write-Output "DEVICE: Launching IMAPI2 hardware-level auto-eject sequence..."
                    $recorder.EjectMedia()
                } catch {
                    Write-Output "WARN: Native auto-eject failed: $($_.Exception.Message)"
                }
            }
            
            Write-Output "SUCCESS: Burning operation completed successfully!"
            
            # Cleanup staging directory
            Remove-Item -Path $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "SYSTEM: Staging directory cleaned up."
            exit 0
        }
    } catch {
        Write-Output "ERROR: Critical failure during burn process: $($_.Exception.Message)"
        # Cleanup staging directory if exists
        if ($stagingDir -and (Test-Path $stagingDir)) {
            Remove-Item -Path $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        exit 1
    }
}

# Default: Detect
$strNoDisc = -join ([char]0x672a, [char]0x68c0, [char]0x6d4b, [char]0x5230, [char]0x5149, [char]0x76d8) # "未检测到光盘"
$strBlank = -join ([char]0x7a7a, [char]0x767d) # "空白"
$strDisc = -join ([char]0x5149, [char]0x76d8) # "光盘"
$strContainsOld = -join ([char]0x5305, [char]0x542b, [char]0x65e7, [char]0x6570, [char]0x636e, [char]0x7684) # "包含旧数据的"
$strRewritable = -join ([char]0x0028, [char]0x53ef, [char]0x91cd, [char]0x5199, [char]0x0029) # "(可重写)"
$strWritten = -join ([char]0x5df2, [char]0x5199, [char]0x5165, [char]0x6570, [char]0x636e, [char]0x7684) # "已写入数据的"
$strNoAppend = -join ([char]0x0028, [char]0x4e0d, [char]0x53ef, [char]0x8ffd, [char]0x52a0, [char]0x0029) # "(不可追加)"
$strAppendable = -join ([char]0x0028, [char]0x53ef, [char]0x8ffd, [char]0x52a0, [char]0x0029) # "(可追加)"

$drives = @()
try {
    $cdroms = Get-CimInstance -ClassName Win32_CDROMDrive
    foreach ($cd in $cdroms) {
        $letter = $cd.Drive
        if (!$letter) { continue }
        
        $imapiLoaded = $false
        $blank = $false
        $imapiMediaType = 0
        $totalSectors = 0
        $freeSectors = 0
        
        # Check IMAPI2 first because WMI's MediaLoaded is notoriously unreliable for blank discs!
        try {
            $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
            $targetIndex = -1
            for ($i = 0; $i -lt $dm.Count; $i++) {
                $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
                $rec.InitializeDiscRecorder($dm.Item($i))
                if ($rec.VolumePathNames -contains "$letter\") {
                    $targetIndex = $i
                    break
                }
            }
            
            if ($targetIndex -ne -1) {
                $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
                $recorder.InitializeDiscRecorder($dm.Item($targetIndex))
                $formatData = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
                $formatData.Recorder = $recorder
                
                # Query physical media properties
                $imapiMediaType = $formatData.CurrentPhysicalMediaType
                if ($imapiMediaType -ne 0) {
                    $imapiLoaded = $true
                    try { $blank = $formatData.MediaPhysicallyBlank } catch {}
                    try { $totalSectors = $formatData.TotalSectorsOnMedia } catch {}
                    try { $freeSectors = $formatData.FreeSectorsOnMedia } catch {}
                }
            }
        } catch {}
        
        $mediaLoadedFinal = $cd.MediaLoaded -or $imapiLoaded
        
        $driveInfo = @{
            letter = $letter
            name = $cd.Name
            id = $cd.DeviceID
            mediaLoaded = $mediaLoadedFinal
            mediaType = 'no-disc'
            capacity = [double]0
            used = [double]0
            free = [double]0
            label = ''
            status = $strNoDisc
            appendable = $false
        }
        
        if ($mediaLoadedFinal) {
            $typeStr = 'CD/DVD Optical Disc'
            $isDVD = $false
            $isRewritable = $false
            
            switch ($imapiMediaType) {
                1 { $typeStr = 'CD-ROM' }
                2 { $typeStr = 'CD-R' }
                3 { $typeStr = 'CD-RW'; $isRewritable = $true }
                4 { $typeStr = 'DVD-ROM'; $isDVD = $true }
                5 { $typeStr = 'DVD-RAM'; $isDVD = $true; $isRewritable = $true }
                6 { $typeStr = 'DVD+R'; $isDVD = $true }
                7 { $typeStr = 'DVD+RW'; $isDVD = $true; $isRewritable = $true }
                8 { $typeStr = 'DVD+R DL'; $isDVD = $true }
                9 { $typeStr = 'DVD-R'; $isDVD = $true }
                10 { $typeStr = 'DVD-RW'; $isDVD = $true; $isRewritable = $true }
                11 { $typeStr = 'DVD-R DL'; $isDVD = $true }
                12 { $typeStr = 'DVD-RW DL'; $isDVD = $true; $isRewritable = $true }
                13 { $typeStr = 'BD-ROM' }
                14 { $typeStr = 'BD-R' }
                15 { $typeStr = 'BD-RE'; $isRewritable = $true }
                default {
                    if ($cd.MediaType -like '*DVD*') {
                        $typeStr = 'DVD'
                        $isDVD = $true
                    } elseif ($cd.MediaType -like '*CD*') {
                        $typeStr = 'CD'
                    }
                }
            }
            
            $capacity = [double]0
            $free = [double]0
            $used = [double]0
            $label = ''
            
            $logicalDisk = $null
            try {
                $logicalDisk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$letter'"
            } catch {}
            
            if ($logicalDisk) {
                $label = $logicalDisk.VolumeName
            }
            
            # Prefer IMAPI2 physical properties to bypass Windows 0-freeSpace bug on optical drives
            if ($imapiLoaded -and $totalSectors -gt 0) {
                $capacity = [double]$totalSectors * 2048
                if ($blank) {
                    $free = $capacity
                    $used = 0
                } else {
                    $free = [double]$freeSectors * 2048
                    $used = $capacity - $free
                }
            } elseif ($logicalDisk -and $logicalDisk.Size -gt 0) {
                $capacity = [double]$logicalDisk.Size
                $free = [double]$logicalDisk.FreeSpace
                $used = $capacity - $free
            } else {
                if ($isDVD) {
                    $capacity = [double]4700000000
                } else {
                    $capacity = [double]734003200
                }
                $free = $capacity
                $used = 0
            }
            
            # Final fallback check: ensure capacity is NEVER 0 when loaded
            if ($capacity -le 0) {
                if ($isDVD) {
                    $capacity = [double]4700000000
                } else {
                    $capacity = [double]734003200
                }
            }
            
            if ($blank) {
                $free = $capacity
                $used = 0
            }
            
            $typeKey = ''
            if ($blank) {
                $typeKey = if ($isDVD) { 'dvd-empty' } else { 'cd-empty' }
                $statusStr = $strBlank + ' ' + $typeStr + ' ' + $strDisc
            } else {
                if ($isRewritable) {
                    $typeKey = if ($isDVD) { 'dvd-rw-written' } else { 'cd-rw-written' }
                    $statusStr = $strContainsOld + ' ' + $typeStr + ' ' + $strRewritable
                } else {
                    $typeKey = if ($isDVD) { 'dvd-r-written' } else { 'cd-r-written' }
                    if ($freeSectors -gt 0) {
                        $statusStr = $strWritten + ' ' + $typeStr + ' ' + $strAppendable
                    } else {
                        $statusStr = $strWritten + ' ' + $typeStr + ' ' + $strNoAppend
                    }
                }
            }
            
            $driveInfo.mediaType = $typeKey
            $driveInfo.capacity = $capacity
            $driveInfo.used = $used
            $driveInfo.free = $free
            $driveInfo.label = $label
            $driveInfo.status = $statusStr
            $driveInfo.appendable = (!$blank -and $freeSectors -gt 0)
        }
        
        $drives += $driveInfo
    }
} catch {
    # Keep output silent on error
}

if ($drives.Count -eq 0) {
    $json = "[]"
} else {
    $json = $drives | ConvertTo-Json
}
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Output "__BASE64_START__${base64}__BASE64_END__"
