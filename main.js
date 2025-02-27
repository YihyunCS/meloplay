const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const NodeID3 = require('node-id3');
const https = require('https');

// Path to the songs directory
const songsDir = path.join(os.homedir(), 'Documents', 'songs');

// Create songs directory if it doesn't exist
if (!fs.existsSync(songsDir)) {
  fs.mkdirSync(songsDir, { recursive: true });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false, // Remove default frame for custom title bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle window control events from renderer
ipcMain.on('window-control', (event, command) => {
  if (!mainWindow) return;
  
  switch (command) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.close();
      break;
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-songs', async () => {
  try {
    if (!fs.existsSync(songsDir)) {
      return { error: 'Songs directory does not exist' };
    }
    
    const files = fs.readdirSync(songsDir);
    const songs = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.mp3' || ext === '.wav';
    }).map(file => {
      // Remove the file extension for display
      const nameWithoutExt = path.basename(file, path.extname(file));
      return {
        name: nameWithoutExt,
        path: path.join(songsDir, file),
        originalName: file
      };
    });
    
    return { songs };
  } catch (error) {
    console.error('Error getting songs:', error);
    return { error: error.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav'] }
    ]
  });
  
  if (!result.canceled) {
    // Copy selected files to songs directory
    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      const destPath = path.join(songsDir, fileName);
      
      fs.copyFileSync(filePath, destPath);
    }
    
    return { success: true, files: result.filePaths };
  }
  
  return { canceled: true };
});

// Download image from URL
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// YouTube download using Python script
ipcMain.handle('download-from-youtube', async (event, url) => {
  try {
    // Validate YouTube URL (basic validation)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return { error: 'Invalid YouTube URL' };
    }
    
    // Update status
    mainWindow.webContents.send('download-progress', { progress: -1 });
    
    // Call Python script to download the video
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'youtube_downloader.py');
      const pythonProcess = spawn('python', [pythonScript, url, songsDir]);
      
      let stdoutData = '';
      let stderrData = '';
      
      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`Python stderr: ${data}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error(`stderr: ${stderrData}`);
          
          mainWindow.webContents.send('download-error', { 
            error: stderrData || `Python process exited with code ${code}` 
          });
          
          resolve({ 
            error: stderrData || `Python process exited with code ${code}` 
          });
          return;
        }
        
        try {
          // Check if the output starts with YouTube log messages
          if (stdoutData.trim().startsWith('[youtube]')) {
            // This is a successful download but with log messages
            // Extract the filename from the log
            const filenameMatch = stdoutData.match(/Destination: .*[\/\\]([^\/\\]+\.mp3)/);
            const filename = filenameMatch ? filenameMatch[1] : 'downloaded-audio.mp3';
            
            // Notify about successful download
            mainWindow.webContents.send('download-complete', {
              success: true,
              filePath: path.join(songsDir, filename),
              fileName: filename
            });
            
            resolve({ success: true, message: 'Download completed' });
            return;
          }
          
          // Parse the JSON output from the Python script
          const result = JSON.parse(stdoutData);
          
          if (!result.success) {
            mainWindow.webContents.send('download-error', { error: result.error });
            resolve({ error: result.error });
            return;
          }
          
          // Download completed successfully
          mainWindow.webContents.send('download-complete', {
            success: true,
            filePath: path.join(songsDir, result.filename),
            fileName: result.filename
          });
          
          resolve({ success: true, message: 'Download completed' });
        } catch (error) {
          console.error('Error parsing Python output:', error);
          console.error('Python output:', stdoutData);
          
          // If we can't parse the output but the process completed successfully,
          // assume the download was successful
          if (stdoutData.includes('.mp3') && !stdoutData.includes('"success": false')) {
            const filenameMatch = stdoutData.match(/[\/\\]([^\/\\]+\.mp3)/);
            const filename = filenameMatch ? filenameMatch[1] : 'downloaded-audio.mp3';
            
            mainWindow.webContents.send('download-complete', {
              success: true,
              filePath: path.join(songsDir, filename),
              fileName: filename
            });
            
            resolve({ success: true, message: 'Download completed' });
          } else {
            mainWindow.webContents.send('download-error', { 
              error: `Error processing download output` 
            });
            
            resolve({ 
              error: `Error processing download output` 
            });
          }
        }
      });
      
      // Handle process error
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        
        mainWindow.webContents.send('download-error', { 
          error: `Failed to start Python process: ${error.message}` 
        });
        
        resolve({ 
          error: `Failed to start Python process: ${error.message}` 
        });
      });
    });
  } catch (error) {
    console.error('Error in download-from-youtube handler:', error);
    mainWindow.webContents.send('download-error', { error: error.message });
    return { error: error.message };
  }
});

// SoundCloud download using Python script
ipcMain.handle('download-from-soundcloud', async (event, url) => {
  try {
    // Validate SoundCloud URL (basic validation)
    if (!url.includes('soundcloud.com')) {
      return { error: 'Invalid SoundCloud URL' };
    }
    
    // Update status
    mainWindow.webContents.send('download-progress', { progress: -1 });
    
    // Call Python script to download the track
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'soundcloud_downloader.py');
      
      // Determine Python executable
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      console.log(`Using Python command: ${pythonCmd}`);
      console.log(`Executing script: ${pythonScript}`);
      console.log(`URL: ${url}`);
      console.log(`Output directory: ${songsDir}`);
      
      const pythonProcess = spawn(pythonCmd, [pythonScript, url, songsDir]);
      
      let stdoutData = '';
      let stderrData = '';
      
      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log(`Python stdout: ${output}`);
      });
      
      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrData += output;
        console.error(`Python stderr: ${output}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error(`stderr: ${stderrData}`);
          
          mainWindow.webContents.send('download-error', { 
            error: stderrData || `Python process exited with code ${code}` 
          });
          
          resolve({ 
            error: stderrData || `Python process exited with code ${code}` 
          });
          return;
        }
        
        try {
          // Try to find JSON in the output
          const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
          const jsonData = jsonMatch ? jsonMatch[0] : null;
          
          if (jsonData) {
            // Parse the JSON output from the Python script
            const result = JSON.parse(jsonData);
            
            if (!result.success) {
              mainWindow.webContents.send('download-error', { error: result.error });
              resolve({ error: result.error });
              return;
            }
            
            // Download completed successfully
            mainWindow.webContents.send('download-complete', {
              success: true,
              filePath: path.join(songsDir, result.filename),
              fileName: result.filename
            });
            
            resolve({ success: true, message: 'Download completed' });
          } else {
            // If we can't find JSON but the process completed successfully,
            // check if we can find an MP3 file mentioned in the output
            if (stdoutData.includes('.mp3')) {
              const filenameMatch = stdoutData.match(/[\/\\]([^\/\\]+\.mp3)/);
              const filename = filenameMatch ? filenameMatch[1] : 'downloaded-audio.mp3';
              
              mainWindow.webContents.send('download-complete', {
                success: true,
                filePath: path.join(songsDir, filename),
                fileName: filename
              });
              
              resolve({ success: true, message: 'Download completed' });
            } else {
              mainWindow.webContents.send('download-error', { 
                error: `Could not parse Python output` 
              });
              
              resolve({ 
                error: `Could not parse Python output` 
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Python output:', error);
          console.error('Python output:', stdoutData);
          
          // If we can't parse the output but the process completed successfully,
          // assume the download was successful if we can find an MP3 file mentioned
          if (stdoutData.includes('.mp3') && !stdoutData.includes('"success": false')) {
            const filenameMatch = stdoutData.match(/[\/\\]([^\/\\]+\.mp3)/);
            const filename = filenameMatch ? filenameMatch[1] : 'downloaded-audio.mp3';
            
            mainWindow.webContents.send('download-complete', {
              success: true,
              filePath: path.join(songsDir, filename),
              fileName: filename
            });
            
            resolve({ success: true, message: 'Download completed' });
          } else {
            mainWindow.webContents.send('download-error', { 
              error: `Error processing download output` 
            });
            
            resolve({ 
              error: `Error processing download output` 
            });
          }
        }
      });
      
      // Handle process error
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        
        mainWindow.webContents.send('download-error', { 
          error: `Failed to start Python process: ${error.message}` 
        });
        
        resolve({ 
          error: `Failed to start Python process: ${error.message}` 
        });
      });
    });
  } catch (error) {
    console.error('Error in download-from-soundcloud handler:', error);
    mainWindow.webContents.send('download-error', { error: error.message });
    return { error: error.message };
  }
}); 