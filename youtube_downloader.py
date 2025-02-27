#!/usr/bin/env python3
import sys
import os
import json
import re
import traceback
from datetime import datetime

try:
    import yt_dlp
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "yt-dlp is not installed. Please run 'pip install yt-dlp'"
    }))
    sys.exit(1)

def sanitize_filename(filename):
    """Remove invalid characters from filename"""
    if not isinstance(filename, str):
        filename = str(filename)
    # Remove characters that are not allowed in filenames
    sanitized = re.sub(r'[\\/*?:"<>|]', "", filename)
    # Replace multiple spaces with a single space
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized

def download_youtube(url, output_dir):
    """Download a YouTube video as MP3"""
    try:
        # Ensure output directory exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Use a simpler approach with direct download
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'noplaylist': True,  # Only download single video, not playlist
            'quiet': False,
            'no_warnings': False,
        }
        
        # Download directly without separate info extraction
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Download and get info in one step
            info_dict = ydl.extract_info(url, download=True)
            
            # Handle playlists
            if 'entries' in info_dict:
                # Get the first video in playlist
                info = info_dict['entries'][0]
            else:
                # Not a playlist
                info = info_dict
            
            # Get the filename from info
            if '_filename' in info:
                # This is the actual filename after download
                file_path = info['_filename']
                filename = os.path.basename(file_path)
                
                # If it's not an mp3 yet (could be temp file), get the expected mp3 name
                if not filename.endswith('.mp3'):
                    title = info.get('title', 'unknown_title')
                    safe_title = sanitize_filename(title)
                    filename = f"{safe_title}.mp3"
            else:
                # Fallback if _filename is not available
                title = info.get('title', f'youtube_{datetime.now().strftime("%Y%m%d%H%M%S")}')
                safe_title = sanitize_filename(title)
                filename = f"{safe_title}.mp3"
            
            # Get other metadata
            title = info.get('title', 'Unknown Title')
            artist = info.get('uploader', info.get('channel', 'Unknown Artist'))
            duration = info.get('duration', 0)
            
            return {
                "success": True,
                "filename": filename,
                "title": title,
                "artist": artist,
                "duration": duration
            }
    
    except Exception as e:
        error_msg = str(e)
        tb = traceback.format_exc()
        print(f"Error: {error_msg}", file=sys.stderr)
        print(f"Traceback: {tb}", file=sys.stderr)
        
        return {
            "success": False,
            "error": f"Error downloading: {error_msg}"
        }

if __name__ == "__main__":
    # Check if URL and output directory are provided
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python youtube_downloader.py <youtube_url> <output_directory>"
        }))
        sys.exit(1)
    
    # Get URL and output directory from command line arguments
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Download the video and print the result as JSON
    result = download_youtube(url, output_dir)
    print(json.dumps(result)) 