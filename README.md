# MeloPlay

A modern, cross-platform desktop music player built with Electron.

![MeloPlay Screenshot](screenshot.png)

## Features

- 🎵 Play local music files
- 🔄 Repeat modes (none, all, one)
- 🔍 Search functionality
- ⬇️ Download music from YouTube and SoundCloud
- 🎨 Modern, responsive UI
- 🌙 Dark mode interface
- 📱 Cross-platform (Windows, macOS, Linux)

## Installation

### Download Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/meloplay/releases) page.

### Build from Source

```bash
# Clone the repository
git clone https://github.com/meloplay/meloplay.git
cd meloplay

# Install dependencies
npm install

# Run the app
npm start
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for all platforms
npm run build

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

## Usage

### Playing Music

1. Click the "Import" button to add music to your library
2. Click on a song to play it
3. Use the playback controls to navigate between songs

### Repeat Modes

Click the repeat button to cycle through repeat modes:
- No repeat (default)
- Repeat all songs
- Repeat current song (displays "1" indicator)

### Downloading Music

1. Paste a YouTube or SoundCloud URL in the download field
2. Click "Download"
3. Wait for the download to complete
4. The song will appear in your library

## Technologies

- Electron
- Node.js
- HTML/CSS/JavaScript
- music-metadata (for metadata extraction)
- youtube-dl (for downloading)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Font Awesome for icons
- All open-source libraries used in this project 