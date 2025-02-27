const { ipcRenderer, shell } = require('electron');
const path = require('path');
const mm = require('music-metadata');

// DOM Elements
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const importBtn = document.getElementById('import-btn');
const refreshBtn = document.getElementById('refresh-btn');
const repeatBtn = document.getElementById('repeatBtn');
const volumeSlider = document.getElementById('volumeSlider');
const progressBar = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const currentSongEl = document.getElementById('current-song-title');
const albumArtEl = document.getElementById('albumArt');
const songsList = document.getElementById('song-list');
const noSongsEl = document.getElementById('no-songs');
const searchInput = document.getElementById('searchInput');

// Window control buttons
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

// Download elements
const downloadUrlInput = document.getElementById('download-url');
const downloadBtn = document.getElementById('download-btn');
const downloadStatus = document.getElementById('download-status');
const downloadProgress = document.getElementById('download-progress');

// App state
let songs = [];
let filteredSongs = [];
let currentSongIndex = -1;
let isPlaying = false;
let isDownloading = false;
let repeatMode = 'none'; // 'none', 'one', 'all'

// Initialize the app
async function init() {
  await loadSongs();
  setupEventListeners();
  setupWindowControls();
  
  // Initialize repeat button with correct icon
  repeatBtn.querySelector('i').className = 'fas fa-redo';
}

// Setup window control buttons
function setupWindowControls() {
  minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-control', 'minimize');
  });
  
  maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-control', 'maximize');
  });
  
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-control', 'close');
  });
}

// Load songs from the songs directory
async function loadSongs() {
  try {
    const result = await ipcRenderer.invoke('get-songs');
    
    if (result.error) {
      console.error('Error loading songs:', result.error);
      return;
    }
    
    songs = result.songs || [];
    filteredSongs = [...songs];
    displaySongs();
  } catch (error) {
    console.error('Error loading songs:', error);
  }
}

// Display songs in the UI
function displaySongs() {
  songsList.innerHTML = '';
  
  if (filteredSongs.length === 0) {
    noSongsEl.style.display = 'block';
    return;
  }
  
  noSongsEl.style.display = 'none';
  
  filteredSongs.forEach((song, index) => {
    const songItem = document.createElement('li');
    
    // Create song info div
    const songInfoDiv = document.createElement('div');
    songInfoDiv.className = 'song-info';
    
    // Create song title
    const songTitle = document.createElement('div');
    songTitle.className = 'song-title';
    songTitle.textContent = path.basename(song.name, path.extname(song.name));
    
    // Add title to song info div
    songInfoDiv.appendChild(songTitle);
    
    // Add song info to song item
    songItem.appendChild(songInfoDiv);
    
    // Check if this filtered song is the currently playing song
    const originalIndex = songs.findIndex(s => s.path === song.path);
    if (originalIndex === currentSongIndex) {
      songItem.classList.add('active');
    }
    
    songItem.addEventListener('click', () => {
      playSong(originalIndex);
    });
    
    songsList.appendChild(songItem);
  });
}

// Filter songs based on search input
function filterSongs(query) {
  if (!query) {
    filteredSongs = [...songs];
  } else {
    query = query.toLowerCase();
    filteredSongs = songs.filter(song => {
      const fileName = path.basename(song.name, path.extname(song.name)).toLowerCase();
      return fileName.includes(query);
    });
  }
  displaySongs();
}

// Play a song by index
async function playSong(index) {
  if (index < 0 || index >= songs.length) return;
  
  currentSongIndex = index;
  const song = songs[currentSongIndex];
  
  // Update UI
  audioPlayer.src = song.path;
  audioPlayer.play();
  isPlaying = true;
  updatePlayPauseIcon();
  
  // Update active song in list
  displaySongs();
  
  // Extract and display metadata
  try {
    const metadata = await mm.parseFile(song.path);
    const songTitle = metadata.common.title || path.basename(song.name, path.extname(song.name));
    
    currentSongEl.textContent = songTitle;
    
    // Display album art if available
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      const url = URL.createObjectURL(new Blob([picture.data], { type: picture.format }));
      albumArtEl.src = url;
    } else {
      albumArtEl.src = 'assets/default-album.png';
    }
  } catch (error) {
    console.error('Error parsing metadata:', error);
    currentSongEl.textContent = path.basename(song.name, path.extname(song.name));
    albumArtEl.src = 'assets/default-album.png';
  }
}

// Update play/pause button icon
function updatePlayPauseIcon() {
  const icon = playBtn.querySelector('i');
  if (isPlaying) {
    icon.className = 'fas fa-pause';
  } else {
    icon.className = 'fas fa-play';
  }
}

// Toggle play/pause
function togglePlay() {
  if (currentSongIndex === -1 && songs.length > 0) {
    playSong(0);
    return;
  }
  
  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play();
  }
  
  isPlaying = !isPlaying;
  updatePlayPauseIcon();
}

// Play previous song
function playPrevious() {
  let index = currentSongIndex - 1;
  if (index < 0) index = songs.length - 1;
  playSong(index);
}

// Play next song
function playNext() {
  if (repeatMode === 'one') {
    // Restart the current song
    audioPlayer.currentTime = 0;
    audioPlayer.play();
    return;
  }
  
  let index = currentSongIndex + 1;
  if (index >= songs.length) {
    if (repeatMode === 'all') {
      index = 0; // Loop back to the first song
    } else {
      audioPlayer.pause(); // Stop playing at the end if no repeat
      isPlaying = false;
      updatePlayPauseIcon();
      return;
    }
  }
  playSong(index);
}

// Toggle repeat mode
function toggleRepeat() {
  const icon = repeatBtn.querySelector('i');
  
  switch (repeatMode) {
    case 'none':
      repeatMode = 'all';
      repeatBtn.classList.add('active');
      repeatBtn.classList.remove('repeat-one');
      icon.className = 'fas fa-redo';
      repeatBtn.title = 'Repeat All';
      break;
    case 'all':
      repeatMode = 'one';
      repeatBtn.classList.add('active');
      repeatBtn.classList.add('repeat-one');
      icon.className = 'fas fa-redo';
      repeatBtn.title = 'Repeat One';
      break;
    case 'one':
      repeatMode = 'none';
      repeatBtn.classList.remove('active');
      repeatBtn.classList.remove('repeat-one');
      icon.className = 'fas fa-redo';
      repeatBtn.title = 'Repeat';
      break;
  }
}

// Format time in seconds to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Handle download from URL
async function handleDownload() {
  if (isDownloading) return;
  
  const url = downloadUrlInput.value.trim();
  if (!url) {
    updateDownloadStatus('Please enter a valid URL', 'error');
    return;
  }
  
  isDownloading = true;
  updateDownloadStatus('Checking URL...', 'info');
  updateDownloadProgress(-1);
  
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      await downloadFromYouTube(url);
    } else if (url.includes('soundcloud.com')) {
      await downloadFromSoundCloud(url);
    } else {
      updateDownloadStatus('Unsupported URL. Please use YouTube or SoundCloud links only.', 'error');
      isDownloading = false;
    }
  } catch (error) {
    console.error('Download error:', error);
    updateDownloadStatus(`Error: ${error.message}`, 'error');
    isDownloading = false;
  }
}

// Download from YouTube
async function downloadFromYouTube(url) {
  updateDownloadStatus('Downloading audio from YouTube...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('download-from-youtube', url);
    
    if (result.error) {
      updateDownloadStatus(`Error: ${result.error}`, 'error');
      isDownloading = false;
      return;
    }
    
    // The download is now handled by the Python script
    // The completion will be handled by the download-complete event
  } catch (error) {
    console.error('YouTube download error:', error);
    updateDownloadStatus(`Error: ${error.message}`, 'error');
    isDownloading = false;
  }
}

// Download from SoundCloud
async function downloadFromSoundCloud(url) {
  updateDownloadStatus('Downloading audio from SoundCloud...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('download-from-soundcloud', url);
    
    if (result.error) {
      updateDownloadStatus(`Error: ${result.error}`, 'error');
      isDownloading = false;
      return;
    }
    
    // The download is now handled by the Python script
    // The completion will be handled by the download-complete event
  } catch (error) {
    console.error('SoundCloud download error:', error);
    updateDownloadStatus(`Error: ${error.message}`, 'error');
    isDownloading = false;
  }
}

// Update download status
function updateDownloadStatus(message, type = 'info') {
  downloadStatus.textContent = message;
  
  // Remove all status classes
  downloadStatus.classList.remove('error', 'success', 'info');
  
  // Add the appropriate class
  downloadStatus.classList.add(type);
}

// Update download progress
function updateDownloadProgress(progress) {
  if (progress < 0) {
    // Indeterminate progress
    downloadProgress.removeAttribute('value');
  } else {
    downloadProgress.value = progress;
  }
}

// Refresh songs library
async function refreshLibrary() {
  if (refreshBtn.classList.contains('rotating')) return;
  
  // Add rotating animation
  refreshBtn.classList.add('rotating');
  
  try {
    // Update status to show refresh is happening
    updateDownloadStatus('Refreshing library...', 'info');
    
    // Reload songs
    await loadSongs();
    
    // Show success message
    updateDownloadStatus('Library refreshed successfully!', 'success');
    
    // Clear status after 3 seconds
    setTimeout(() => {
      updateDownloadStatus('');
    }, 3000);
  } catch (error) {
    console.error('Error refreshing library:', error);
    updateDownloadStatus('Error refreshing library', 'error');
  } finally {
    // Remove rotating animation after a short delay
    setTimeout(() => {
      refreshBtn.classList.remove('rotating');
    }, 1000);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Player controls
  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', playPrevious);
  nextBtn.addEventListener('click', playNext);
  repeatBtn.addEventListener('click', toggleRepeat);
  
  // Refresh button
  refreshBtn.addEventListener('click', refreshLibrary);
  
  // Volume control
  volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = volumeSlider.value;
  });
  
  // Progress bar
  audioPlayer.addEventListener('timeupdate', () => {
    const currentTime = audioPlayer.currentTime;
    const duration = audioPlayer.duration || 0;
    
    // Update progress bar
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
    
    // Update time displays
    currentTimeEl.textContent = formatTime(currentTime);
    totalTimeEl.textContent = formatTime(duration);
  });
  
  // Click on progress bar to seek
  document.querySelector('.progress-bar').addEventListener('click', (e) => {
    const progressBar = e.currentTarget;
    const clickPosition = e.offsetX;
    const width = progressBar.clientWidth;
    const duration = audioPlayer.duration;
    
    audioPlayer.currentTime = (clickPosition / width) * duration;
  });
  
  // When song ends, play next
  audioPlayer.addEventListener('ended', playNext);
  
  // Import button
  importBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('open-file-dialog');
    if (result.success) {
      await loadSongs();
    }
  });
  
  // Search functionality
  searchInput.addEventListener('input', (e) => {
    filterSongs(e.target.value);
  });
  
  // Download button
  downloadBtn.addEventListener('click', handleDownload);
  
  // Download URL input - allow Enter key to trigger download
  downloadUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleDownload();
    }
  });
  
  // Listen for download progress updates
  ipcRenderer.on('download-progress', (event, data) => {
    updateDownloadProgress(data.progress);
  });
  
  // Listen for download errors
  ipcRenderer.on('download-error', (event, data) => {
    updateDownloadStatus(`Error: ${data.error}`, 'error');
    updateDownloadProgress(0);
    isDownloading = false;
  });
  
  // Listen for download completion
  ipcRenderer.on('download-complete', async (event, data) => {
    if (data.success) {
      updateDownloadStatus(`Download complete: ${data.fileName}`, 'success');
      updateDownloadProgress(100);
      
      // Reload songs list
      await loadSongs();
      
      // Reset download state
      setTimeout(() => {
        downloadUrlInput.value = '';
        updateDownloadProgress(-1);
        isDownloading = false;
      }, 3000);
    } else {
      updateDownloadStatus(`Error: ${data.error}`, 'error');
      isDownloading = false;
    }
  });
}

// Create assets directory and default album art
function createAssetsDirectory() {
  const fs = require('fs');
  const assetsDir = path.join(__dirname, 'assets');
  
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
  }
}

// Initialize the app
createAssetsDirectory();
init(); 