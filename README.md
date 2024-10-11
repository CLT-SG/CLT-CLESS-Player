# CLESS Player

Cless Player is a web desktop application built with ElectronJS, designed to provide a seamless experience for interacting with the Cless Server. This application wraps web functionality into a native desktop environment for improved usability and performance.

## Features
- Cross-platform support for Windows and Ubuntu
- Easy setup and configuration
- ElectronJS-based desktop application for enhanced web server interaction

## Requirements
- [Node.js](https://nodejs.org/) (v20.x or later)
- [Electron](https://www.electronjs.org/) (v22.x)

## Installation

Follow these steps to install and start the Cless Player:

1. Install Electron globally:
   ```bash
   npm install -g electron
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Building the Application

To build the application and compile it into an executable for different platforms, use the following commands.

### For Windows:
- **Windows x64:**
   ```bash
   npm run win64
   ```

- **Windows x86:**
   ```bash
   npm run win32
   ```

### For Ubuntu:
- **Ubuntu x64:**
   ```bash
   npm run ubuntu64
   ```

- **Ubuntu x86:**
   ```bash
   npm run ubuntu32
   ```

## Contributing
Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to create a pull request or open an issue in this repository.

## License
This project is licensed under the [MIT License](LICENSE).

## Contact
For any inquiries, reach out to us at www.closed-loop.biz
