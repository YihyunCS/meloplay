#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import tempfile

def test_youtube_downloader():
    """Test the YouTube downloader script with a short video"""
    
    # Test video URL (short Creative Commons video)
    test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    
    # Create a temporary directory for the test
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Testing download to temporary directory: {temp_dir}")
        
        # Get the path to the youtube_downloader.py script
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "youtube_downloader.py")
        
        # Run the downloader script
        try:
            result = subprocess.run(
                [sys.executable, script_path, test_url, temp_dir],
                capture_output=True,
                text=True,
                check=True
            )
            
            # Parse the JSON output
            output = json.loads(result.stdout)
            
            # Check if download was successful
            if output.get("success"):
                print("✅ Download successful!")
                print(f"Title: {output.get('title')}")
                print(f"Filename: {output.get('filename')}")
                
                # Check if the file exists
                file_path = os.path.join(temp_dir, output.get('filename'))
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"File size: {file_size} bytes")
                    
                    if file_size > 0:
                        print("✅ File was created successfully")
                    else:
                        print("❌ File was created but is empty")
                else:
                    print("❌ File was not created")
            else:
                print("❌ Download failed")
                print(f"Error: {output.get('error')}")
                
        except subprocess.CalledProcessError as e:
            print("❌ Script execution failed")
            print(f"Error: {e}")
            print(f"Stdout: {e.stdout}")
            print(f"Stderr: {e.stderr}")
        except json.JSONDecodeError:
            print("❌ Failed to parse JSON output")
            print(f"Output: {result.stdout}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_youtube_downloader() 