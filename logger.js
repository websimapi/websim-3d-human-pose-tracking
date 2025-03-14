/**
 * Advanced logging system with levels and timestamp support
 */
export class Logger {
    constructor(containerID = null) {
        this.containerElement = containerID ? document.getElementById(containerID) : null;
        this.logs = [];
        this.maxLogs = 100; // Maximum number of log entries to keep
        this.enabled = true;
        
        // Create log container if not provided
        if (!this.containerElement && containerID) {
            this.containerElement = document.createElement('div');
            this.containerElement.id = containerID;
            this.containerElement.className = 'debug-logs';
            document.body.appendChild(this.containerElement);
        }
    }
    
    log(level, ...args) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm format
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        const logEntry = {
            timestamp,
            level,
            message
        };
        
        // Add to logs array, keeping only the most recent
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Output to console with appropriate level
        console[level](`[${timestamp}]`, ...args);
        
        // Update UI if container exists
        this.updateLogDisplay(logEntry);
        
        return logEntry;
    }
    
    updateLogDisplay(logEntry) {
        if (!this.containerElement) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${logEntry.level}`;
        entry.textContent = `[${logEntry.timestamp}] ${logEntry.message}`;
        
        this.containerElement.appendChild(entry);
        this.containerElement.scrollTop = this.containerElement.scrollHeight;
        
        // Clean up old entries if too many in DOM
        const entries = this.containerElement.getElementsByClassName('log-entry');
        while (entries.length > this.maxLogs) {
            this.containerElement.removeChild(entries[0]);
        }
    }
    
    clear() {
        this.logs = [];
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
    }
    
    info(...args) {
        return this.log('info', ...args);
    }
    
    warn(...args) {
        return this.log('warn', ...args);
    }
    
    error(...args) {
        return this.log('error', ...args);
    }
    
    debug(...args) {
        return this.log('debug', ...args);
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
    
    export() {
        return JSON.stringify(this.logs);
    }
}