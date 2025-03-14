/**
 * Monitors and displays performance statistics
 */
export class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.frameTimes = [];
        this.maxFrameTimes = 60; // Store the last 60 frame times for stats
        
        // Create stats element
        this.statsElement = document.createElement('div');
        this.statsElement.className = 'performance-stats';
        document.body.appendChild(this.statsElement);
        
        // Update interval
        this.lastStatsUpdate = 0;
        this.statsUpdateInterval = 500; // Update stats every 500ms
    }
    
    beginFrame() {
        this.frameStartTime = performance.now();
    }
    
    endFrame() {
        const now = performance.now();
        const frameTime = now - this.frameStartTime;
        
        // Store frame time
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.maxFrameTimes) {
            this.frameTimes.shift();
        }
        
        this.frameCount++;
        
        // Calculate FPS every second
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
        }
    }
    
    shouldUpdateStats() {
        const now = performance.now();
        if (now - this.lastStatsUpdate >= this.statsUpdateInterval) {
            this.lastStatsUpdate = now;
            return true;
        }
        return false;
    }
    
    displayStats() {
        // Calculate average and max frame times
        let sum = 0;
        let max = 0;
        
        this.frameTimes.forEach(time => {
            sum += time;
            max = Math.max(max, time);
        });
        
        const avgFrameTime = sum / this.frameTimes.length || 0;
        
        // Update stats display
        this.statsElement.innerHTML = `
            FPS: ${this.fps} | 
            Avg: ${avgFrameTime.toFixed(1)}ms | 
            Max: ${max.toFixed(1)}ms
        `;
        
        // Color code based on performance
        if (this.fps >= 45) {
            this.statsElement.style.color = '#4CAF50'; // Green
        } else if (this.fps >= 30) {
            this.statsElement.style.color = '#FFC107'; // Yellow
        } else {
            this.statsElement.style.color = '#F44336'; // Red
        }
    }
    
    reset() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.frameTimes = [];
    }
}