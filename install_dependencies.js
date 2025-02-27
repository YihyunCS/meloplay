const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('Installing Python dependencies...');

// Determine the correct pip command based on OS
const pipCommand = os.platform() === 'win32' ? 'pip' : 'pip3';

// Function to install a Python package
function installPackage(packageName) {
  return new Promise((resolve, reject) => {
    console.log(`Installing ${packageName}...`);
    
    const installProcess = spawn(pipCommand, ['install', '--user', packageName]);
    
    let stdout = '';
    let stderr = '';
    
    installProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`${packageName} stdout: ${output}`);
    });
    
    installProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`${packageName} stderr: ${output}`);
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Successfully installed ${packageName}`);
        resolve({ success: true, package: packageName });
      } else {
        console.error(`Failed to install ${packageName} with exit code ${code}`);
        // Try alternative installation method for scdl if it fails
        if (packageName === 'scdl' && os.platform() === 'win32') {
          console.log('Trying alternative installation method for scdl...');
          const altInstallProcess = spawn('python', ['-m', 'pip', 'install', '--user', 'scdl']);
          
          altInstallProcess.stdout.on('data', (data) => {
            console.log(`Alt ${packageName} stdout: ${data}`);
          });
          
          altInstallProcess.stderr.on('data', (data) => {
            console.error(`Alt ${packageName} stderr: ${data}`);
          });
          
          altInstallProcess.on('close', (altCode) => {
            if (altCode === 0) {
              console.log(`Successfully installed ${packageName} using alternative method`);
              resolve({ success: true, package: packageName });
            } else {
              console.error(`Failed to install ${packageName} using alternative method with exit code ${altCode}`);
              resolve({ success: false, package: packageName, error: stderr });
            }
          });
        } else {
          resolve({ success: false, package: packageName, error: stderr });
        }
      }
    });
    
    installProcess.on('error', (error) => {
      console.error(`Error spawning process for ${packageName}:`, error);
      reject(error);
    });
  });
}

// Install both packages
Promise.all([
  installPackage('yt-dlp'),
  installPackage('scdl')
])
.then(results => {
  const allSuccessful = results.every(result => result.success);
  if (allSuccessful) {
    console.log('All Python dependencies installed successfully!');
  } else {
    const failed = results.filter(result => !result.success);
    console.error(`Failed to install the following packages: ${failed.map(f => f.package).join(', ')}`);
    console.error('You may need to install them manually.');
  }
})
.catch(error => {
  console.error('Error installing Python dependencies:', error);
}); 