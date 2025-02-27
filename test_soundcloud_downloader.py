#!/usr/bin/env python3
import os
import sys
import json
import tempfile
import subprocess
import shutil

def test_soundcloud_downloader():
    """Test the SoundCloud downloader script with a sample URL"""
    print("Testing SoundCloud downloader...")
    
    # Path to the downloader script
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'soundcloud_downloader.py')
    
    # Create a temporary directory for the test
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Using temporary directory: {temp_dir}")
        
        # Sample SoundCloud URL (a popular track that should be available)
        test_url = "https://soundcloud.com/flume/flume-never-be-like-you-feat-kai"
        
        # Run the downloader script
        print(f"Running downloader with URL: {test_url}")
        
        # Get Python executable
        python_exe = sys.executable
        
        # Run the script
        process = subprocess.run(
            [python_exe, script_path, test_url, temp_dir],
            capture_output=True,
            text=True
        )
        
        # Print the output
        print("\nSTDOUT:")
        print(process.stdout)
        
        print("\nSTDERR:")
        print(process.stderr)
        
        print(f"\nExit code: {process.returncode}")
        
        # Check if the process was successful
        if process.returncode == 0:
            # Check if any MP3 files were created
            mp3_files = [f for f in os.listdir(temp_dir) if f.endswith('.mp3')]
            
            if mp3_files:
                print(f"\nSuccess! Downloaded {len(mp3_files)} files:")
                for file in mp3_files:
                    file_path = os.path.join(temp_dir, file)
                    file_size = os.path.getsize(file_path)
                    print(f"  - {file} ({file_size} bytes)")
            else:
                print("\nError: No MP3 files were downloaded.")
                return False
            
            # Try to parse the JSON output
            try:
                # Find JSON in the output
                json_match = process.stdout.strip().split('\n')[-1]
                result = json.loads(json_match)
                
                print("\nJSON output:")
                print(json.dumps(result, indent=2))
                
                if result.get('success'):
                    print("\nTest PASSED!")
                    return True
                else:
                    print(f"\nTest FAILED: {result.get('error', 'Unknown error')}")
                    return False
            except json.JSONDecodeError:
                print("\nWarning: Could not parse JSON output.")
                # If we found MP3 files, consider it a success anyway
                if mp3_files:
                    print("But MP3 files were downloaded, so considering it a success.")
                    return True
                return False
        else:
            print("\nTest FAILED: Process returned non-zero exit code.")
            return False

if __name__ == "__main__":
    success = test_soundcloud_downloader()
    sys.exit(0 if success else 1) 