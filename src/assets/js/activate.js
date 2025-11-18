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

// Get all network interface MAC addresses (multi-NIC support)
async function getAllMacAddresses() {
  try {
    const nets = os.networkInterfaces()
    const macAddresses = []

    for (const [interfaceName, interfaces] of Object.entries(nets)) {
      if (!interfaces || interfaces.length === 0) continue

      for (const iface of interfaces) {
        // Filter valid physical network interfaces
        if (!iface.internal && 
            iface.mac && 
            iface.mac !== '00:00:00:00:00:00' &&
            !isVirtualInterface(interfaceName)) {
          
          macAddresses.push({
            interface: interfaceName,
            mac: iface.mac,
            type: detectInterfaceType(interfaceName),
            family: iface.family,
            address: iface.address
          })
        }
      }
    }

    // Remove duplicates based on MAC address
    const uniqueMACs = []
    const seen = new Set()
    for (const macInfo of macAddresses) {
      if (!seen.has(macInfo.mac)) {
        seen.add(macInfo.mac)
        uniqueMACs.push(macInfo)
      }
    }

    console.log(`Detected ${uniqueMACs.length} network interface(s):`, uniqueMACs)
    return uniqueMACs

  } catch (error) {
    console.error('Failed to get MAC addresses:', error)
    return []
  }
}

// Check if interface is virtual
function isVirtualInterface(interfaceName) {
  const virtualPatterns = [
    /^veth/i, /^docker/i, /^br-/i, /^virbr/i, /^vmnet/i,
    /^vbox/i, /^tun/i, /^tap/i, /^lo/i, /^dummy/i,
    /virtual/i, /loopback/i, /^wsl/i, /^hyper-v/i
  ]
  
  for (const pattern of virtualPatterns) {
    if (pattern.test(interfaceName)) {
      return true
    }
  }
  return false
}

// Detect interface type
function detectInterfaceType(interfaceName) {
  const name = interfaceName.toLowerCase()
  if (name.includes('eth') || (name.includes('en') && !name.includes('wl'))) {
    return 'Ethernet'
  } else if (name.includes('wlan') || name.includes('wl') || name.includes('wi-fi') || name.includes('wifi')) {
    return 'WiFi'
  } else if (name.includes('usb')) {
    return 'USB Network'
  } else if (name.includes('bluetooth') || name.includes('bt')) {
    return 'Bluetooth'
  }
  return 'Other'
}

// Get MAC address (legacy function for backward compatibility)
async function getMacAddress() {
  try {
    const allMACs = await getAllMacAddresses()
    if (allMACs.length > 0) {
      // Return primary MAC (first one)
      return allMACs[0].mac
    }
    return 'Not Available'
  } catch (error) {
    console.error('Failed to get MAC address:', error)
    return 'Error'
  }
}

// Generate QR code with multi-NIC support
function generateQRCode(macAddresses = []) {
  const canvas = document.getElementById('qr-canvas')
  
  // Wait for MAC address to be available
  const macElement = document.getElementById('macaddress')
  const macAddress = macElement.textContent
  
  if (macAddress === 'Loading...' || macAddress === 'Error') {
    // Retry after a short delay
    setTimeout(() => generateQRCode(macAddresses), 500)
    return
  }
  
  // Create WhatsApp message with all detected MAC addresses
  let whatsappMessage
  if (macAddresses.length > 1) {
    const macList = macAddresses.map((m, i) => `${i + 1}. ${m.interface} (${m.type}): ${m.mac}`).join('%0A')
    whatsappMessage = `Hello, pls generate my eCLESS key.%0A%0ADetected ${macAddresses.length} network interface(s):%0A${macList}%0A%0AThanks.`
  } else if (macAddresses.length === 1) {
    whatsappMessage = `Hello, pls generate my eCLESS key. Mac address = ${macAddress} Thanks.`
  } else {
    whatsappMessage = `Hello, pls generate my eCLESS key. Thanks.`
  }
  
  const whatsappUrl = `https://api.whatsapp.com/send?phone=6588995538&text=${whatsappMessage}`

  try {
    // Try using QRCode library if available
    if (window.QRCode && canvas) {
      QRCode.toCanvas(canvas, whatsappUrl, {
        width: 150,
        margin: 1,
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
  ctx.fillRect(0, 0, 150, 150)

  // Draw border
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 2
  ctx.strokeRect(8, 8, 134, 134)

  // Draw QR code pattern (simplified)
  ctx.fillStyle = '#000000'
  
  // Corner squares
  ctx.fillRect(15, 15, 25, 25)
  ctx.fillRect(110, 15, 25, 25)
  ctx.fillRect(15, 110, 25, 25)

  // Center text
  ctx.font = '11px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('WhatsApp QR', 75, 65)
  ctx.font = '9px Arial'
  ctx.fillText('Scan to request', 75, 80)
  ctx.fillText('license key', 75, 92)
  
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

// Initialize page with multi-NIC support
async function initializePage() {
  // Get system information
  localIP = getLocalIP()
  
  // Update displays
  document.getElementById('configUrl').textContent = `https://${localIP}:9000`

  // Get all MAC addresses asynchronously
  try {
    const allMACs = await getAllMacAddresses()
    
    if (allMACs.length === 0) {
      document.getElementById('macaddress').textContent = 'No network interfaces detected'
      displayAllMacAddresses([])
    } else {
      // Display primary MAC in the main display
      document.getElementById('macaddress').textContent = allMACs[0].mac
      
      // Display all detected MACs in the list
      displayAllMacAddresses(allMACs)
    }
    
    // Generate QR code after MAC addresses are loaded
    generateQRCode(allMACs)
  } catch (error) {
    console.error('Error getting MAC addresses:', error)
    document.getElementById('macaddress').textContent = 'Error'
    displayAllMacAddresses([])
    
    // Still generate QR code even if MAC address failed
    generateQRCode([])
  }

  console.log('Activation page initialized:', { localIP })
}

// Display all detected MAC addresses
function displayAllMacAddresses(macAddresses) {
  const container = document.getElementById('all-mac-addresses')
  
  if (!container) {
    console.warn('All MAC addresses container not found')
    return
  }

  if (macAddresses.length === 0) {
    container.innerHTML = '<div class="mac-item error">No network interfaces detected</div>'
    return
  }

  let html = '<div class="mac-list-header">Detected Network Interfaces:</div>'
  
  macAddresses.forEach((macInfo, index) => {
    const isPrimary = index === 0
    const priorityLabel = isPrimary ? '<span class="primary-badge">Primary</span>' : ''
    
    html += `
      <div class="mac-item ${isPrimary ? 'primary' : ''}">
        <div class="mac-interface-name">
          <strong>${macInfo.interface}</strong> ${priorityLabel}
        </div>
        <div class="mac-interface-type">${macInfo.type}</div>
        <div class="mac-address-value">
          <code>${macInfo.mac}</code>
          <button class="copy-mac-btn" onclick="copyIndividualMac('${macInfo.mac}')" title="Copy MAC Address">
            📋
          </button>
        </div>
      </div>
    `
  })
  
  html += `
    <div class="mac-list-footer">
      <small>License key can be generated for any of the above MAC addresses</small>
    </div>
  `
  
  container.innerHTML = html
}

// Get icon for interface type
function getInterfaceIcon(type) {
  switch (type) {
    case 'Ethernet': return '🔌'
    case 'WiFi': return '📶'
    case 'USB Network': return '🔗'
    case 'Bluetooth': return '📱'
    default: return '💻'
  }
}

// Copy individual MAC address
function copyIndividualMac(mac) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mac).then(() => {
        showCopySuccess(`Copied: ${mac}`)
      }).catch(() => {
        fallbackCopyToClipboard(mac)
      })
    } else {
      fallbackCopyToClipboard(mac)
    }
  } catch (error) {
    console.error('Failed to copy MAC address:', error)
    alert('Failed to copy MAC address')
  }
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
  
  // Save the serial key to configuration and restart the application
  const configData = {
    serialkey: key,
    timestamp: new Date().toISOString()
  }
  
  // First, save the configuration
  fetch('https://localhost:9000/api/config/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(configData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert(`License key submitted: ${key}\n\nThe application will now restart to apply the new license.`)
      
      // Then restart the application
      fetch('https://localhost:9000/api/restartapp')
        .then(() => {
          console.log('Application restart initiated')
          // Close the activation window after a short delay
          setTimeout(() => {
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
          }, 1000)
        })
        .catch(error => {
          console.error('Error restarting application:', error)
          alert('License key saved, but failed to restart application. Please restart manually.')
        })
    } else {
      alert('Failed to save license key. Please try again.')
    }
  })
  .catch(error => {
    console.error('Error saving license key:', error)
    alert('Failed to save license key. Please check your connection and try again.')
  })
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

// Show copy success feedback for button or message
function showCopySuccess(buttonOrMessage) {
  // If it's a button element (backward compatibility)
  if (buttonOrMessage && typeof buttonOrMessage === 'object' && buttonOrMessage.innerHTML !== undefined) {
    const button = buttonOrMessage
    const originalHTML = button.innerHTML
    const originalClass = button.className
    
    button.innerHTML = '✅'
    button.className = originalClass + ' copied'
    
    setTimeout(() => {
      button.innerHTML = originalHTML
      button.className = originalClass
    }, 1500)
    
    console.log('MAC address copied to clipboard')
  } else {
    // Show toast notification for text messages
    const message = buttonOrMessage || 'Copied to clipboard!'
    const toast = document.createElement('div')
    toast.className = 'copy-success-toast'
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
    `
    
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transition = 'opacity 0.3s ease-in'
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast)
        }
      }, 300)
    }, 2000)
  }
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
