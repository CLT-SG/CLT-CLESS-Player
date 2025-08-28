// Global variables
let localIP = 'localhost'
let ipcRenderer, remote, convert, datetime, path, os, config, macaddress, QRCode
let hostserver, dsid, mode

// Initialize Electron modules and configuration
function initializeElectronModules() {
  try {
    ipcRenderer = window.ipcRenderer
    remote = window.remote
    convert = window.xmljs
    datetime = window.datetime
    path = window.path
    os = window.os
    config = window.config
    macaddress = window.macaddress
    QRCode = window.QRCode
    
    // Enhanced configuration variables
    // Wait for config to load
    window.addEventListener('configLoaded', function(event) {
      hostserver = config.hostserver
      dsid = config.id
      mode = config.mode
      console.log('eCLESS: Configuration loaded for activation window -', event.detail.source)
    })
    
    // Fallback for immediate access
    hostserver = config.hostserver
    dsid = config.id
    mode = config.mode
    
  } catch (e) {
    console.warn('error loading configuration: ' + e)
    // Fallback to require if window objects not available
    try {
      os = require('os')
      remote = require('electron').remote
    } catch (err) {
      console.error('Failed to load electron modules:', err)
    }
  }
}

// Set window to maximize/fit screen
function setupWindow() {
  try {
    if (remote && remote.getCurrentWindow) {
      const currentWindow = remote.getCurrentWindow()
      currentWindow.setBounds({
        width: screen.width,
        height: screen.height
      })
      currentWindow.center()
      console.log('Window maximized and centered')
    }
  } catch (error) {
    console.warn('Could not set window bounds:', error)
  }
}

// Get local IP address
function getLocalIP() {
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
    return 'localhost'
  } catch (error) {
    console.warn('Failed to get local IP:', error)
    return 'localhost'
  }
}

// Get MAC address
async function getMacAddress() {
  try {
    // Try using electron's macaddress module first
    if (window.macaddress && window.macaddress.one) {
      const mac = await window.macaddress.one()
      return mac
    }
    
    // Fallback to os.networkInterfaces()
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac
        }
      }
    }
    return 'Not Available'
  } catch (error) {
    console.error('Failed to get MAC address:', error)
    return 'Error'
  }
}

// Generate QR code
function generateQRCode() {
  const canvas = document.getElementById('qr-canvas')
  
  // Wait for MAC address to be available
  const macElement = document.getElementById('macaddress')
  const macAddress = macElement.textContent
  
  if (macAddress === 'Loading...' || macAddress === 'Error') {
    // Retry after a short delay
    setTimeout(generateQRCode, 500)
    return
  }
  
  // Create WhatsApp URL with MAC address
  const whatsappMessage = `Hello, pls generate my eCLESS key. Mac address = ${macAddress} Thanks.`
  const whatsappUrl = `https://api.whatsapp.com/send?phone=6588995538&text=${encodeURIComponent(whatsappMessage)}`

  try {
    // Try using QRCode library if available
    if (window.QRCode && canvas) {
      QRCode.toCanvas(canvas, whatsappUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, function (error) {
        if (error) {
          console.error('QR Code generation failed:', error)
          generateSimpleQRCode(canvas, whatsappUrl)
        } else {
          console.log('WhatsApp QR Code generated successfully!')
        }
      })
    } else {
      generateSimpleQRCode(canvas, whatsappUrl)
    }
  } catch (error) {
    console.error('QR Code generation error:', error)
    generateSimpleQRCode(canvas, whatsappUrl)
  }
}

// Fallback simple QR code representation
function generateSimpleQRCode(canvas, whatsappUrl) {
  const ctx = canvas.getContext('2d')

  // Clear canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 200, 200)

  // Draw border
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 180, 180)

  // Draw QR code pattern (simplified)
  ctx.fillStyle = '#000000'
  
  // Corner squares
  ctx.fillRect(20, 20, 30, 30)
  ctx.fillRect(150, 20, 30, 30)
  ctx.fillRect(20, 150, 30, 30)

  // Center text
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('WhatsApp QR', 100, 85)
  ctx.font = '10px Arial'
  ctx.fillText('Scan to request', 100, 105)
  ctx.fillText('license key', 100, 120)
  
  // Make canvas clickable to open WhatsApp
  canvas.style.cursor = 'pointer'
  canvas.onclick = () => {
    try {
      if (window.require) {
        // In Electron, use shell to open external URL
        require('electron').shell.openExternal(whatsappUrl)
      } else {
        // In browser, use window.open
        window.open(whatsappUrl, '_blank')
      }
    } catch (error) {
      console.error('Failed to open WhatsApp:', error)
    }
  }
}

// Initialize page
async function initializePage() {
  // Get system information
  localIP = getLocalIP()
  
  // Update displays
  document.getElementById('configUrl').textContent = `https://${localIP}:9000`

  // Get MAC address asynchronously
  try {
    const macAddress = await getMacAddress()
    document.getElementById('macaddress').textContent = macAddress
    
    // Generate QR code after MAC address is loaded
    generateQRCode()
  } catch (error) {
    console.error('Error getting MAC address:', error)
    document.getElementById('macaddress').textContent = 'Error'
    
    // Still generate QR code even if MAC address failed
    generateQRCode()
  }

  console.log('Activation page initialized:', { localIP })
}

// Activation function
function activate() {
  const key = document.getElementById('userkey').value.trim()
  
  if (!key) {
    alert('Please enter a license key before activating.')
    document.getElementById('userkey').focus()
    return
  }

  if (key.length < 10) {
    alert('License key appears to be too short. Please check and try again.')
    return
  }

  console.log('Attempting activation with key:', key)
  
  // Here you would typically send the key to your activation service
  // For now, we'll just show a success message
  alert(`License key submitted: ${key}\n\nPlease ensure you've configured the key in the control panel at https://${localIP}:9000`)
}

// Cancel function
function cancel() {
  if (confirm('Are you sure you want to cancel the activation process?')) {
    console.log('Activation cancelled by user')
    try {
      if (remote && remote.getCurrentWindow) {
        remote.getCurrentWindow().close()
      } else {
        window.close()
      }
    } catch (error) {
      console.error('Error closing window:', error)
      window.close()
    }
  }
}

// Copy MAC address function
function copyMacAddress() {
  const macElement = document.getElementById('macaddress')
  const copyBtn = document.getElementById('copyMacBtn')
  const macAddress = macElement.textContent
  
  if (macAddress === 'Loading...' || macAddress === 'Error' || macAddress === 'Not Available') {
    alert('MAC address not available to copy')
    return
  }
  
  try {
    // Try using the modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(macAddress).then(() => {
        showCopySuccess(copyBtn)
      }).catch(() => {
        // Fallback to older method
        fallbackCopyToClipboard(macAddress, copyBtn)
      })
    } else {
      // Fallback for older browsers
      fallbackCopyToClipboard(macAddress, copyBtn)
    }
  } catch (error) {
    console.error('Failed to copy MAC address:', error)
    alert('Failed to copy MAC address')
  }
}

// Fallback copy method
function fallbackCopyToClipboard(text, button) {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      showCopySuccess(button)
    } else {
      alert('Failed to copy MAC address')
    }
  } catch (error) {
    console.error('Fallback copy failed:', error)
    alert('Failed to copy MAC address')
  }
}

// Show copy success feedback
function showCopySuccess(button) {
  const originalHTML = button.innerHTML
  const originalClass = button.className
  
  button.innerHTML = '✅'
  button.className = originalClass + ' copied'
  
  setTimeout(() => {
    button.innerHTML = originalHTML
    button.className = originalClass
  }, 1500)
  
  console.log('MAC address copied to clipboard')
}

// Handle window resize
function handleWindowResize() {
  generateQRCode()
}

// Handle Enter key in input
function handleKeyPress(e) {
  if (e.key === 'Enter') {
    activate()
  }
}

// Initialize when page loads
function onDOMContentLoaded() {
  initializeElectronModules()
  setupWindow()
  initializePage()
  
  // Focus on input field
  document.getElementById('userkey').focus()
}

// Event listeners
document.addEventListener('DOMContentLoaded', onDOMContentLoaded)
window.addEventListener('resize', handleWindowResize)

// Add event listener for Enter key when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const userKeyInput = document.getElementById('userkey')
  if (userKeyInput) {
    userKeyInput.addEventListener('keypress', handleKeyPress)
  }
})
