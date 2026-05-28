const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless window to achieve the custom Win11 UI look
    transparent: false,
    backgroundColor: '#1e1e1e', // Fallback background color
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false // Show only when ready to avoid flashing
  });

  mainWindow.loadFile('index.html');

  // Redirect renderer console messages to main process CLI
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] [Level:${level}] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  // Smooth fade-in
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Window state event listeners to notify renderer of maximized states
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state', 'maximized');
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state', 'windowed');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Window Frame Control IPCs ---
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// --- Native Dialog IPCs ---
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择待刻录的文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  
  if (result.canceled) return [];
  
  // Format file paths with size and stats
  const fs = require('fs');
  return result.filePaths.map(filePath => {
    try {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        type: path.extname(filePath).toUpperCase().substring(1) || 'FILE'
      };
    } catch (e) {
      return {
        path: filePath,
        name: path.basename(filePath),
        size: 0,
        type: 'FILE'
      };
    }
  });
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择待刻录的文件夹',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const targetFolder = result.filePaths[0];
  const fs = require('fs');
  const path = require('path');
  
  // Calculate folder size recursively
  let folderSize = 0;
  const getFolderSize = (dir) => {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          getFolderSize(filePath);
        } else {
          folderSize += stats.size;
        }
      });
    } catch (e) {
      // Ignore errors for inaccessible files
    }
  };

  try {
    const stats = fs.statSync(targetFolder);
    if (stats.isDirectory()) {
      getFolderSize(targetFolder);
      return [{
        path: targetFolder,
        name: path.basename(targetFolder),
        size: folderSize,
        type: 'FOLDER'
      }];
    }
  } catch (e) {
    console.error('Error calculating folder size', e);
  }

  return [];
});

ipcMain.handle('process-paths', async (event, paths) => {
  const fs = require('fs');
  const path = require('path');
  const results = [];
  
  for (const filePath of paths) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        let folderSize = 0;
        const getFolderSize = (dir) => {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const fp = path.join(dir, file);
            const s = fs.statSync(fp);
            if (s.isDirectory()) {
              getFolderSize(fp);
            } else {
              folderSize += s.size;
            }
          });
        };
        try {
          getFolderSize(filePath);
        } catch (e) {}
        
        results.push({
          path: filePath,
          name: path.basename(filePath),
          size: folderSize,
          type: 'FOLDER'
        });
      } else {
        results.push({
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          type: path.extname(filePath).toUpperCase().substring(1) || 'FILE'
        });
      }
    } catch (e) {
      // Skip invalid paths
    }
  }
  return results;
});

// --- PowerShell Hardware Integration IPCs ---

// Detect physical CD/DVD drives on Windows using PowerShell
ipcMain.handle('detect-optical-drives', () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve([]); // Fallback for macOS/Linux
    }

    const scriptPath = path.join(__dirname, 'detect_drives.ps1');
    const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action Detect`;
    
    exec(psCommand, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        console.error('PowerShell drive detection failed:', error);
        return resolve([]);
      }
      
      try {
        if (!stdout || stdout.trim() === '') {
          return resolve([]);
        }
        
        let rawJson = stdout.trim();
        const base64Match = rawJson.match(/__BASE64_START__(.*?)__BASE64_END__/s);
        if (base64Match) {
          const content = base64Match[1].trim();
          if (content === '') {
            rawJson = '[]';
          } else {
            const buffer = Buffer.from(content, 'base64');
            rawJson = buffer.toString('utf8');
          }
        } else if (!rawJson.startsWith('[') && !rawJson.startsWith('{')) {
          const content = rawJson.trim();
          if (content === '') {
            rawJson = '[]';
          } else {
            // Fallback if delimiters are somehow missing
            const buffer = Buffer.from(content, 'base64');
            rawJson = buffer.toString('utf8');
          }
        }
        
        let drives = JSON.parse(rawJson);
        // Normalize if single object instead of array
        if (!Array.isArray(drives)) {
          drives = [drives];
        }
        
        // Map to standard object format with advanced media info
        const formattedDrives = drives
          .filter(d => d.letter) // Ensure drive letter exists
          .map(d => ({
            letter: d.letter,
            name: d.name || 'CD/DVD Optical Drive',
            id: d.id,
            mediaLoaded: d.mediaLoaded || false,
            mediaType: d.mediaType || 'no-disc',
            capacity: d.capacity || 0,
            used: d.used || 0,
            free: d.free || 0,
            label: d.label || '',
            status: d.status || '未检测到光盘',
            appendable: d.appendable || false
          }));
          
        resolve(formattedDrives);
      } catch (e) {
        console.error('Error parsing drive detection JSON:', e, 'Raw output:', stdout);
        resolve([]);
      }
    });
  });
});

// Erase physical CD-RW/DVD-RW media using PowerShell COM Automation
ipcMain.handle('erase-optical-drive', (event, driveLetter) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !driveLetter) {
      return resolve({ success: false, message: 'Platform not supported or invalid drive letter' });
    }

    const scriptPath = path.join(__dirname, 'detect_drives.ps1');
    const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action Erase -Drive "${driveLetter}"`;
    
    exec(psCommand, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        console.error('PowerShell drive erase failed:', error);
        return resolve({ success: false, message: error.message });
      }
      
      try {
        const res = JSON.parse(stdout);
        resolve(res);
      } catch (e) {
        console.error('Error parsing drive erase JSON:', e, 'Raw output:', stdout);
        resolve({ success: false, message: '无法解析擦除操作的返回状态' });
      }
    });
  });
});

// Eject physical tray drawer using PowerShell COM Automation
ipcMain.handle('eject-optical-drive', (event, driveLetter) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !driveLetter) {
      return resolve({ success: false, message: 'Platform not supported or invalid drive letter' });
    }

    const scriptPath = path.join(__dirname, 'detect_drives.ps1');
    const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action Eject -Drive "${driveLetter}"`;
    
    exec(psCommand, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        console.error('PowerShell drive eject failed:', error);
        return resolve({ success: false, message: error.message });
      }
      
      try {
        const res = JSON.parse(stdout.trim());
        resolve(res);
      } catch (e) {
        // Fallback to Shell COM Eject if JSON parse fails
        const formattedLetter = driveLetter.substring(0, 1).toUpperCase() + ':';
        const fallbackCommand = `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).Namespace(17).ParseName('${formattedLetter}').InvokeVerb('Eject')"`;
        exec(fallbackCommand, (err) => {
          resolve({ success: !err, message: err ? err.message : '' });
        });
      }
    });
  });
});

// Streamed Physical Burning using PowerShell & IMAPI2 COM
ipcMain.handle('start-optical-burn', async (event, config) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ success: false, error: 'Platform not supported' });
    }

    try {
      const fs = require('fs');
      const debugLogPath = path.join(__dirname, 'burn_debug.log');
      const logDebug = (msg) => {
        const ts = new Date().toISOString();
        fs.appendFileSync(debugLogPath, `[${ts}] ${msg}\n`, 'utf8');
      };

      // Clear previous debug log
      fs.writeFileSync(debugLogPath, '', 'utf8');
      logDebug('=== FlashBurn Physical Burn Session Started ===');
      logDebug('Burn config received from renderer:');
      logDebug(JSON.stringify(config, null, 2));

      // Create temporary configuration file to bypass command line quoting and length limits
      const configPath = path.join(app.getPath('temp'), 'flashburn_burn_config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      logDebug(`Config file written to: ${configPath}`);

      const { spawn } = require('child_process');
      const scriptPath = path.join(__dirname, 'detect_drives.ps1');
      logDebug(`Script path: ${scriptPath}`);

      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Action', 'Burn',
        '-ConfigFile', configPath
      ]);

      // Stream stdout and stderr logs line-by-line to the frontend
      child.stdout.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        lines.forEach(line => {
          if (line.trim()) {
            logDebug(`[STDOUT] ${line.trim()}`);
            if (mainWindow) {
              mainWindow.webContents.send('burn-log', line.trim());
            }
          }
        });
      });

      child.stderr.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        lines.forEach(line => {
          if (line.trim()) {
            logDebug(`[STDERR] ${line.trim()}`);
            if (mainWindow) {
              mainWindow.webContents.send('burn-log', `STDERR: ${line.trim()}`);
            }
          }
        });
      });

      child.on('close', (code) => {
        logDebug(`PowerShell process exited with code: ${code}`);

        // Clean up temp config file
        try {
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
          }
        } catch (e) {
          console.error('Failed to clean up burn config file:', e);
        }

        if (mainWindow) {
          mainWindow.webContents.send('burn-complete', { success: code === 0, code });
        }
        resolve({ success: code === 0, code });
      });

    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// IPC Handler to open local folder or html files in native default browser securely
ipcMain.handle('open-path', async (event, filePath) => {
  const { shell } = require('electron');
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || '保存映像文件',
    defaultPath: options.defaultPath || 'disc_image.iso',
    filters: [
      { name: 'ISO 映像文件 (*.iso)', extensions: ['iso'] },
      { name: '所有文件 (*.*)', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('start-optical-rip', async (event, config) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ success: false, error: 'Platform not supported' });
    }

    try {
      const { spawn } = require('child_process');
      const scriptPath = path.join(__dirname, 'detect_drives.ps1');

      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Action', 'Rip',
        '-Drive', config.drive,
        '-ConfigFile', config.outputPath
      ]);

      child.stdout.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        lines.forEach(line => {
          if (line.trim()) {
            if (mainWindow) {
              mainWindow.webContents.send('rip-log', line.trim());
            }
          }
        });
      });

      child.stderr.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        lines.forEach(line => {
          if (line.trim()) {
            if (mainWindow) {
              mainWindow.webContents.send('rip-log', `STDERR: ${line.trim()}`);
            }
          }
        });
      });

      child.on('close', (code) => {
        if (mainWindow) {
          mainWindow.webContents.send('rip-complete', { success: code === 0, code });
        }
        resolve({ success: code === 0, code });
      });

    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});
