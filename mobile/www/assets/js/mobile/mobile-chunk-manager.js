/**
 * eCLESS Player Mobile - Chunk Manager
 * 
 * This module provides a simplified wrapper around capacitor-file-chunk plugin
 * for efficient chunked reading and writing of large media files.
 * 
 * Features:
 * - Start/stop local HTTP server for chunked operations
 * - Write files in chunks without memory issues
 * - Read files in chunks for streaming
 * - Progress tracking for downloads/uploads
 * - Automatic fallback to standard Filesystem API for small files
 * 
 * @module mobile-chunk-manager
 */

console.log('=== MOBILE CHUNK MANAGER: Initializing ===');

/**
 * Mobile Chunk Manager Class
 * Simplified version of FileChunkManager from capacitor-file-chunk demo
 * NOTE: Encryption features removed for simplicity - can be added later if needed
 */
class MobileChunkManager {
    constructor() {
        this.serverInfo = null;
        this.isServerReady = false;
        this.defaultConfig = {
            encryption: false,  // Disabled by default (requires libsodium-wrappers)
            port: null,         // Auto-select port
            portMin: 8080,
            portMax: 8100,
            retries: 5,
            chunkSize: 10 * 1024 * 1024  // 10MB default chunk size
        };
        
        // Statistics
        this.stats = {
            serverStarts: 0,
            serverStops: 0,
            chunksWritten: 0,
            chunksRead: 0,
            bytesWritten: 0,
            bytesRead: 0
        };
    }

    /**
     * Start the local HTTP server for chunked operations
     * @param {Object} config - Server configuration
     * @returns {Promise<Object>} Server information
     */
    async startServer(config = {}) {
        try {
            console.log('[ChunkManager] Starting chunk server...');
            
            if (!window.capacitorAPI || !window.capacitorAPI.FileChunk) {
                throw new Error('FileChunk plugin not available');
            }

            // Merge with defaults
            const finalConfig = { ...this.defaultConfig, ...config };

            // Validate Capacitor plugin
            if (!window.capacitorAPI.FileChunk.startServer) {
                throw new Error('FileChunk.startServer not available');
            }

            // Start the server
            this.serverInfo = await window.capacitorAPI.FileChunk.startServer({
                encryption: finalConfig.encryption,
                key: '',  // No encryption key needed when encryption is false
                port: finalConfig.port,
                portMin: finalConfig.portMin,
                portMax: finalConfig.portMax,
                retries: finalConfig.retries,
                chunkSize: finalConfig.chunkSize
            });

            if (!this.serverInfo || !this.serverInfo.ready) {
                throw new Error('Server failed to start');
            }

            this.isServerReady = true;
            this.stats.serverStarts++;

            console.log('[ChunkManager] ✓ Server started successfully:', {
                platform: this.serverInfo.platform,
                baseUrl: this.serverInfo.baseUrl,
                chunkSize: this.serverInfo.chunkSize,
                ready: this.serverInfo.ready
            });

            return this.serverInfo;

        } catch (error) {
            console.error('[ChunkManager] Failed to start server:', error);
            this.isServerReady = false;
            this.serverInfo = null;
            throw error;
        }
    }

    /**
     * Stop the local HTTP server
     */
    async stopServer() {
        try {
            if (!this.isServerReady) {
                console.log('[ChunkManager] Server not running, nothing to stop');
                return;
            }

            console.log('[ChunkManager] Stopping chunk server...');

            if (window.capacitorAPI && window.capacitorAPI.FileChunk) {
                await window.capacitorAPI.FileChunk.stopServer();
            }

            this.isServerReady = false;
            this.serverInfo = null;
            this.stats.serverStops++;

            console.log('[ChunkManager] ✓ Server stopped');

        } catch (error) {
            console.error('[ChunkManager] Failed to stop server:', error);
            throw error;
        }
    }

    /**
     * Ensure server is running (auto-start if needed)
     */
    async ensureServerReady(config = {}) {
        if (this.isServerReady && this.serverInfo && this.serverInfo.ready) {
            return this.serverInfo;
        }

        console.log('[ChunkManager] Server not ready, starting...');
        return await this.startServer(config);
    }

    /**
     * Create an empty file at the specified path
     * @param {string} path - File path (relative or absolute)
     * @param {string} directory - Capacitor Directory (optional)
     * @returns {Promise<string>} File URI
     */
    async createEmptyFile(path, directory = null) {
        try {
            console.log('[ChunkManager] Creating empty file:', path);

            if (!window.capacitorAPI || !window.capacitorAPI.writeFile) {
                throw new Error('Capacitor Filesystem not available');
            }

            const writeOptions = {
                path: path,
                data: '',
                recursive: true
            };

            if (directory) {
                writeOptions.directory = directory;
            }

            const result = await window.capacitorAPI.writeFile(path, new Blob(['']));

            if (!result || !result.success) {
                throw new Error('Failed to create empty file');
            }

            // Return the file URI without 'file://' prefix
            const uri = result.uri || result.path || path;
            const cleanUri = uri.replace('file://', '');

            console.log('[ChunkManager] ✓ Empty file created:', cleanUri);
            return cleanUri;

        } catch (error) {
            console.error('[ChunkManager] Failed to create empty file:', error);
            throw error;
        }
    }

    /**
     * Append a chunk of data to an existing file
     * @param {string} path - File path
     * @param {Uint8Array} data - Chunk data
     * @returns {Promise<boolean>} Success status
     */
    async appendChunk(path, data) {
        try {
            if (!this.isServerReady || !this.serverInfo) {
                throw new Error('Server not ready');
            }

            // Ensure path doesn't have file:// prefix for server URL
            const cleanPath = path.replace('file://', '');

            // Build URL
            const url = this.serverInfo.baseUrl + cleanPath;

            // Send PUT request with chunk data
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': this.serverInfo.authToken
                },
                body: new Blob([data])
            });

            const success = response.status === 204;

            if (success) {
                this.stats.chunksWritten++;
                this.stats.bytesWritten += data.length;
            }

            return success;

        } catch (error) {
            console.error('[ChunkManager] Failed to append chunk:', error);
            return false;
        }
    }

    /**
     * Read a chunk of data from a file
     * @param {string} path - File path
     * @param {number} offset - Byte offset to start reading
     * @param {number} length - Number of bytes to read
     * @returns {Promise<Uint8Array|null>} Chunk data or null if failed
     */
    async readChunk(path, offset, length) {
        try {
            if (!this.isServerReady || !this.serverInfo) {
                throw new Error('Server not ready');
            }

            // Ensure path doesn't have file:// prefix
            const cleanPath = path.replace('file://', '');

            // Build URL with query parameters
            const url = `${this.serverInfo.baseUrl}${cleanPath}?o=${offset}&l=${length}`;

            // Send GET request
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.serverInfo.authToken
                }
            });

            if (response.status === 200) {
                const arrayBuffer = await response.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);

                this.stats.chunksRead++;
                this.stats.bytesRead += data.length;

                return data;
            } else {
                console.warn('[ChunkManager] Failed to read chunk, status:', response.status);
                return null;
            }

        } catch (error) {
            console.error('[ChunkManager] Failed to read chunk:', error);
            return null;
        }
    }

    /**
     * Get file size using Capacitor Filesystem
     * @param {string} path - File path
     * @returns {Promise<number>} File size in bytes, or -1 if failed
     */
    async getFileSize(path) {
        try {
            // Ensure path has file:// prefix for stat
            if (!path.startsWith('file://')) {
                path = 'file://' + path;
            }

            if (!window.capacitorAPI || !window.capacitorAPI.plugins || !window.capacitorAPI.plugins.Filesystem) {
                throw new Error('Capacitor Filesystem not available');
            }

            const stat = await window.capacitorAPI.plugins.Filesystem.stat({ path });

            return stat && stat.size ? stat.size : -1;

        } catch (error) {
            console.error('[ChunkManager] Failed to get file size:', error);
            return -1;
        }
    }

    /**
     * Download a file from URL in chunks
     * @param {string} url - Remote URL to download from
     * @param {string} destPath - Destination file path
     * @param {Function} onProgress - Progress callback (optional)
     * @returns {Promise<Object>} Download result
     */
    async downloadFileChunked(url, destPath, onProgress = null) {
        try {
            console.log('[ChunkManager] Starting chunked download:', url, '->', destPath);

            // Ensure server is ready
            await this.ensureServerReady();

            // Get file size from server (HEAD request)
            const fileSize = await this._getRemoteFileSize(url);
            console.log('[ChunkManager] Remote file size:', fileSize, 'bytes');

            // Create empty file
            const filePath = await this.createEmptyFile(destPath);

            // Download in chunks
            const chunkSize = this.serverInfo.chunkSize || (10 * 1024 * 1024);
            let offset = 0;
            let downloadedBytes = 0;

            while (offset < fileSize) {
                const bytesToRead = Math.min(chunkSize, fileSize - offset);

                // Download chunk with range header
                const chunk = await this._downloadChunk(url, offset, bytesToRead);

                if (!chunk || chunk.length === 0) {
                    throw new Error(`Failed to download chunk at offset ${offset}`);
                }

                // Append chunk to file
                const success = await this.appendChunk(filePath, chunk);

                if (!success) {
                    throw new Error(`Failed to write chunk at offset ${offset}`);
                }

                offset += chunk.length;
                downloadedBytes += chunk.length;

                // Report progress
                if (onProgress) {
                    const progress = Math.round((downloadedBytes / fileSize) * 100);
                    onProgress({
                        downloaded: downloadedBytes,
                        total: fileSize,
                        progress: progress
                    });
                }

                console.log(`[ChunkManager] Progress: ${downloadedBytes}/${fileSize} (${Math.round((downloadedBytes / fileSize) * 100)}%)`);
            }

            console.log('[ChunkManager] ✓ Chunked download completed:', filePath);

            return {
                success: true,
                filePath: filePath,
                fileSize: fileSize,
                bytesDownloaded: downloadedBytes
            };

        } catch (error) {
            console.error('[ChunkManager] Chunked download failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get remote file size using HEAD request
     * @private
     */
    async _getRemoteFileSize(url) {
        try {
            // Use CapacitorHttp for mobile to avoid CORS issues
            if (window.capacitorAPI && window.capacitorAPI.isNative && window.capacitorAPI.plugins.CapacitorHttp) {
                console.log('[ChunkManager] Using CapacitorHttp for HEAD request:', url);
                
                try {
                    const response = await window.capacitorAPI.plugins.CapacitorHttp.head({
                        url: url,
                        connectTimeout: 10000
                    });
                    
                    if (response.status === 200 && response.headers && response.headers['content-length']) {
                        return parseInt(response.headers['content-length'], 10);
                    }
                } catch (headError) {
                    console.warn('[ChunkManager] HEAD request failed, trying GET');
                }
                
                // Fallback: GET request to determine size
                console.warn('[ChunkManager] Using GET to estimate size');
                const getResponse = await window.capacitorAPI.plugins.CapacitorHttp.get({
                    url: url,
                    responseType: 'blob',
                    connectTimeout: 30000
                });
                
                if (getResponse.status === 200 && getResponse.data) {
                    const blob = getResponse.data instanceof Blob ? getResponse.data : new Blob([getResponse.data]);
                    return blob.size;
                }
            } else {
                // Web fallback
                // Try HEAD request first
                const response = await fetch(url, { method: 'HEAD' });

                if (response.ok && response.headers.has('content-length')) {
                    return parseInt(response.headers.get('content-length'), 10);
                }

                // Fallback: GET request and check response size
                console.warn('[ChunkManager] HEAD request failed, using GET to estimate size');
                const getResponse = await fetch(url);

                if (getResponse.ok) {
                    const blob = await getResponse.blob();
                    return blob.size;
                }
            }

            throw new Error('Cannot determine file size');

        } catch (error) {
            console.error('[ChunkManager] Failed to get remote file size:', error);
            throw error;
        }
    }

    /**
     * Download a specific chunk from remote URL using range header
     * @private
     */
    async _downloadChunk(url, offset, length) {
        try {
            const rangeHeader = `bytes=${offset}-${offset + length - 1}`;

            // Use CapacitorHttp for mobile to avoid CORS issues
            if (window.capacitorAPI && window.capacitorAPI.isNative && window.capacitorAPI.plugins.CapacitorHttp) {
                console.log('[ChunkManager] Using CapacitorHttp for range request:', rangeHeader);
                
                const response = await window.capacitorAPI.plugins.CapacitorHttp.get({
                    url: url,
                    headers: { 'Range': rangeHeader },
                    responseType: 'arraybuffer',
                    connectTimeout: 30000,
                    readTimeout: 60000
                });

                // Accept 200 (full response) or 206 (partial content)
                if (response.status === 200 || response.status === 206) {
                    const arrayBuffer = response.data instanceof ArrayBuffer ? response.data : 
                                       (response.data && response.data.arrayBuffer instanceof ArrayBuffer ? response.data.arrayBuffer : response.data);
                    return new Uint8Array(arrayBuffer);
                } else {
                    throw new Error(`Unexpected response status: ${response.status}`);
                }
            } else {
                // Web fallback
                const response = await fetch(url, {
                    headers: {
                        'Range': rangeHeader
                    }
                });

                // Accept 200 (full response) or 206 (partial content)
                if (response.status === 200 || response.status === 206) {
                    const arrayBuffer = await response.arrayBuffer();
                    return new Uint8Array(arrayBuffer);
                } else {
                    throw new Error(`Unexpected response status: ${response.status}`);
                }
            }

        } catch (error) {
            console.error('[ChunkManager] Failed to download chunk:', error);
            throw error;
        }
    }

    /**
     * Get server information
     */
    getServerInfo() {
        return this.serverInfo ? { ...this.serverInfo } : null;
    }

    /**
     * Check if server is ready
     */
    isReady() {
        return this.isServerReady && this.serverInfo && this.serverInfo.ready;
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
}

// Create global instance
const chunkManager = new MobileChunkManager();

// Make it globally accessible
window.chunkManager = chunkManager;

console.log('=== MOBILE CHUNK MANAGER: Module loaded ===');
