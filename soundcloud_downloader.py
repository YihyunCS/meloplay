#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import re
import shutil
from urllib.parse import urlparse
import tempfile
import traceback

def sanitize_filename(filename):
    """Remove invalid characters from filename"""
    # Replace invalid characters with underscore
    return re.sub(r'[\\/*?:"<>|]', '_', filename)

def download_soundcloud(url, output_dir):
    """Download audio from SoundCloud URL using yt-dlp"""
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Check if yt-dlp is installed - we'll try multiple methods
        ytdlp_path = None
        use_module = False
        
        # Method 1: Check if yt-dlp is in PATH
        ytdlp_path = shutil.which('yt-dlp')
        
        # Method 2: Try common script locations
        if not ytdlp_path:
            possible_paths = [
                os.path.join(sys.prefix, 'bin', 'yt-dlp'),
                os.path.join(sys.prefix, 'bin', 'yt-dlp.exe'),
                os.path.join(sys.prefix, 'Scripts', 'yt-dlp'),
                os.path.join(sys.prefix, 'Scripts', 'yt-dlp.exe'),
                os.path.join(os.path.expanduser('~'), '.local', 'bin', 'yt-dlp'),
                os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
                os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
                os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
                os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'Python', 'Python39', 'Scripts', 'yt-dlp.exe')
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    ytdlp_path = path
                    print(f"Found yt-dlp at: {ytdlp_path}")
                    break
        
        # Method 3: Check if the module can be imported (we'll use the Python module directly)
        if not ytdlp_path:
            try:
                # Try to import yt_dlp to see if it's installed
                import importlib.util
                if importlib.util.find_spec("yt_dlp") is not None:
                    print("yt-dlp module is installed, using it directly")
                    use_module = True
                else:
                    # Try to install it
                    print("yt-dlp not found, attempting to install...")
                    subprocess.run([sys.executable, '-m', 'pip', 'install', 'yt-dlp'], 
                                  check=True, capture_output=True)
                    # Check again after installation
                    if importlib.util.find_spec("yt_dlp") is not None:
                        use_module = True
                    else:
                        return {
                            "success": False,
                            "error": "Failed to install yt-dlp module."
                        }
            except Exception as e:
                print(f"Error checking for yt-dlp module: {str(e)}")
                # Continue to see if we can find it elsewhere
        
        if not ytdlp_path and not use_module:
            return {
                "success": False,
                "error": "yt-dlp is not installed or not in PATH. Please install it with 'pip install yt-dlp'."
            }
        
        if ytdlp_path:
            print(f"Using yt-dlp from: {ytdlp_path}")
        elif use_module:
            print("Using yt-dlp Python module")
        
        # Parse URL to validate it's a SoundCloud URL
        parsed_url = urlparse(url)
        if not parsed_url.netloc.endswith('soundcloud.com'):
            return {
                "success": False,
                "error": "Not a valid SoundCloud URL"
            }
        
        # Format the output template to be in the output directory
        output_template = os.path.join(output_dir, '%(title)s.%(ext)s')
        
        # Download the track
        print(f"Downloading track from: {url}")
        
        # First, get the track info to extract metadata
        if use_module:
            # Use Python module
            try:
                import yt_dlp
                
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True
                }
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    track_title = sanitize_filename(info.get('title', 'Unknown Title'))
                    track_artist = sanitize_filename(info.get('uploader', 'Unknown Artist'))
                    track_duration = info.get('duration', 0)
            except Exception as e:
                print(f"Error getting track info via module: {str(e)}")
                return {
                    "success": False,
                    "error": f"Failed to get track info: {str(e)}"
                }
        else:
            # Use command line
            info_cmd = [
                ytdlp_path, 
                '--dump-json',
                url
            ]
            
            info_process = subprocess.run(info_cmd, capture_output=True, text=True)
            
            if info_process.returncode != 0:
                return {
                    "success": False,
                    "error": f"Failed to get track info: {info_process.stderr}"
                }
            
            # Parse the track info
            try:
                track_info = json.loads(info_process.stdout)
                track_title = sanitize_filename(track_info.get('title', 'Unknown Title'))
                track_artist = sanitize_filename(track_info.get('uploader', 'Unknown Artist'))
                track_duration = track_info.get('duration', 0)
            except json.JSONDecodeError:
                # If we can't parse the JSON, just use placeholders
                track_title = 'Unknown Title'
                track_artist = 'Unknown Artist'
                track_duration = 0
        
        # Now download the track as MP3
        if use_module:
            # Use Python module
            try:
                import yt_dlp
                
                ydl_opts = {
                    'format': 'bestaudio/best',
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': '192',
                    }],
                    'outtmpl': output_template,
                }
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
            except Exception as e:
                print(f"Error downloading track via module: {str(e)}")
                return {
                    "success": False,
                    "error": f"Download failed: {str(e)}"
                }
        else:
            # Use command line
            download_cmd = [
                ytdlp_path, 
                '-x',  # Extract audio
                '--audio-format', 'mp3',  # Convert to MP3
                '--audio-quality', '0',  # Best quality
                '-o', output_template,  # Output template
                url
            ]
            
            process = subprocess.run(download_cmd, capture_output=True, text=True)
            
            print(f"Download command output: {process.stdout}")
            print(f"Download command error: {process.stderr}")
            
            if process.returncode != 0:
                return {
                    "success": False,
                    "error": f"Download failed: {process.stderr}"
                }
        
        # Find the downloaded file
        mp3_files = [f for f in os.listdir(output_dir) if f.endswith('.mp3')]
        if not mp3_files:
            return {
                "success": False,
                "error": "Download completed but couldn't find the downloaded file"
            }
        
        # Sort by creation time, newest first
        mp3_files.sort(key=lambda f: os.path.getctime(os.path.join(output_dir, f)), reverse=True)
        filename = mp3_files[0]
        
        # Get file metadata
        file_path = os.path.join(output_dir, filename)
        file_size = os.path.getsize(file_path)
        
        # Create a formatted filename that includes artist - title
        new_filename = f"{track_artist} - {track_title}.mp3"
        new_file_path = os.path.join(output_dir, new_filename)
        
        # Rename the file to include artist if it doesn't already
        if not filename.startswith(f"{track_artist} - "):
            try:
                os.rename(file_path, new_file_path)
                filename = new_filename
                file_path = new_file_path
            except Exception as e:
                print(f"Warning: Failed to rename file: {str(e)}")
        
        return {
            "success": True,
            "filename": filename,
            "title": track_title,
            "artist": track_artist,
            "duration": int(track_duration),
            "file_size": file_size
        }
        
    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"Error: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return {
            "success": False,
            "error": f"Error: {str(e)}",
            "traceback": error_traceback
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python soundcloud_downloader.py <soundcloud_url> <output_directory>"
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    print(f"Starting SoundCloud download for URL: {url}")
    print(f"Output directory: {output_dir}")
    
    result = download_soundcloud(url, output_dir)
    print(json.dumps(result)) 