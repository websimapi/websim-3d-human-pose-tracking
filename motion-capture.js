/**
 * MotionCapture class handles all pose and hand tracking
 * using MediaPipe Pose and Hands models
 */
export class MotionCapture {
    constructor(logger) {
        this.logger = logger;
        this.isTracking = false;
        this.lastPoseLandmarks = null;
        this.lastHandLandmarks = { left: null, right: null };
        this.modelController = null;
        
        // Tracking flags
        this.trackingStatus = {
            pose: false,
            leftHand: false,
            rightHand: false
        };
        
        // Tracking config
        this.config = {
            pose: {
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            },
            hands: {
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            }
        };
        
        // Landmark tracking confidence thresholds
        this.visibilityThreshold = 0.7;
        
        // Smoothing settings
        this.smoothingSettings = {
            enabled: true,
            factor: 0.7,
            history: {
                pose: [],
                leftHand: [],
                rightHand: []
            },
            historyLength: 10
        };
        
        // Tracking toggles
        this.trackingToggles = {
            head: true,
            torso: true,
            arms: true,
            hands: true,
            fingers: true,
            legs: true
        };
        
        // Default poses to fall back to when landmarks not visible
        this.defaultPoses = {
            pose: null,
            leftHand: null,
            rightHand: null
        };
        
        // Stream processing variables
        this.camera = null;
        this.videoElement = null;
    }
    
    async init() {
        try {
            this.logger.info('Initializing motion capture systems...');
            
            // Initialize MediaPipe Pose
            this.pose = new window.Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });
            
            // Set pose options
            this.pose.setOptions(this.config.pose);
            
            // Set up pose result handling
            this.pose.onResults((results) => this.onPoseResults(results));
            
            // Initialize MediaPipe Hands
            this.hands = new window.Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            // Set hands options
            this.hands.setOptions(this.config.hands);
            
            // Set up hands result handling
            this.hands.onResults((results) => this.onHandsResults(results));
            
            this.logger.info('Motion capture systems initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize motion capture:', error);
            throw new Error('Failed to initialize tracking systems: ' + error.message);
        }
    }
    
    setModelController(modelController) {
        this.modelController = modelController;
    }
    
    async startTracking(videoElement) {
        if (this.isTracking) return;
        
        try {
            this.videoElement = videoElement;
            this.isTracking = true;
            
            this.camera = new window.Camera(this.videoElement, {
                onFrame: async () => {
                    if (!this.isTracking) return;
                    
                    try {
                        // Process frame with pose detector
                        if (this.pose) {
                            await this.pose.send({image: this.videoElement});
                        }
                        
                        // Process frame with hand detector
                        if (this.hands) {
                            await this.hands.send({image: this.videoElement});
                        }
                    } catch (error) {
                        this.logger.error('Frame processing error:', error);
                    }
                },
                width: 640,
                height: 480
            });
            
            await this.camera.start();
            this.logger.info('Tracking started');
            
        } catch (error) {
            this.isTracking = false;
            this.logger.error('Failed to start tracking:', error);
            throw error;
        }
    }
    
    stopTracking() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        
        this.logger.info('Tracking stopped');
    }
    
    onPoseResults(results) {
        this.trackingStatus.pose = results.poseLandmarks ? true : false;
        
        if (results.poseLandmarks) {
            // Process landmarks to improve tracking quality
            const processedLandmarks = this.processLandmarks(results.poseLandmarks, 'pose');
            this.lastPoseLandmarks = processedLandmarks;
            
            // Save as default pose if requested
            if (this.shouldCaptureDefaultPose) {
                this.defaultPoses.pose = JSON.parse(JSON.stringify(processedLandmarks));
                this.shouldCaptureDefaultPose = false;
                this.logger.info('Default pose captured');
            }
            
            // Update the model if connected
            if (this.modelController) {
                this.modelController.updateFromPoseLandmarks(processedLandmarks, this.trackingToggles);
            }
        } else {
            // Use default pose if available
            if (this.defaultPoses.pose && this.modelController) {
                this.modelController.updateFromPoseLandmarks(this.defaultPoses.pose, this.trackingToggles);
            }
        }
    }
    
    onHandsResults(results) {
        this.trackingStatus.leftHand = false;
        this.trackingStatus.rightHand = false;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach((landmarks, index) => {
                const handedness = results.multiHandedness[index].label.toLowerCase();
                const isLeft = handedness.includes('left');
                
                // Process hand landmarks
                const processedLandmarks = this.processLandmarks(landmarks, isLeft ? 'leftHand' : 'rightHand');
                
                if (isLeft) {
                    this.lastHandLandmarks.left = processedLandmarks;
                    this.trackingStatus.leftHand = true;
                    
                    // Save as default if requested
                    if (this.shouldCaptureDefaultLeftHand) {
                        this.defaultPoses.leftHand = JSON.parse(JSON.stringify(processedLandmarks));
                        this.shouldCaptureDefaultLeftHand = false;
                        this.logger.info('Default left hand pose captured');
                    }
                } else {
                    this.lastHandLandmarks.right = processedLandmarks;
                    this.trackingStatus.rightHand = true;
                    
                    // Save as default if requested
                    if (this.shouldCaptureDefaultRightHand) {
                        this.defaultPoses.rightHand = JSON.parse(JSON.stringify(processedLandmarks));
                        this.shouldCaptureDefaultRightHand = false;
                        this.logger.info('Default right hand pose captured');
                    }
                }
                
                // Update the model if connected and hand tracking is enabled
                if (this.modelController && this.trackingToggles.hands && this.trackingToggles.fingers) {
                    this.modelController.updateFromHandLandmarks(
                        processedLandmarks, 
                        isLeft ? 'left' : 'right'
                    );
                }
            });
        } else {
            // Use default hand poses if available
            if (this.trackingToggles.hands && this.trackingToggles.fingers && this.modelController) {
                if (this.defaultPoses.leftHand) {
                    this.modelController.updateFromHandLandmarks(this.defaultPoses.leftHand, 'left');
                }
                if (this.defaultPoses.rightHand) {
                    this.modelController.updateFromHandLandmarks(this.defaultPoses.rightHand, 'right');
                }
            }
        }
    }
    
    processLandmarks(landmarks, type) {
        // Deep copy the landmarks to avoid reference issues
        const processedLandmarks = JSON.parse(JSON.stringify(landmarks));
        
        // Apply smoothing if enabled
        if (this.smoothingSettings.enabled) {
            // Add to history
            this.smoothingSettings.history[type].push(processedLandmarks);
            if (this.smoothingSettings.history[type].length > this.smoothingSettings.historyLength) {
                this.smoothingSettings.history[type].shift();
            }
            
            // Apply exponential smoothing
            if (this.smoothingSettings.history[type].length > 1) {
                const historyLength = this.smoothingSettings.history[type].length;
                const factor = this.smoothingSettings.factor;
                
                for (let i = 0; i < processedLandmarks.length; i++) {
                    // Skip if current landmark doesn't exist
                    if (!processedLandmarks[i]) continue;
                    
                    // For pose landmarks, check visibility threshold
                    if (type === 'pose' && processedLandmarks[i].visibility < this.visibilityThreshold) {
                        // Use previous good data or default pose if available
                        const previousFrames = this.smoothingSettings.history[type].slice(0, -1);
                        const validPrevious = previousFrames.filter(frame => 
                            frame[i] && (type !== 'pose' || frame[i].visibility >= this.visibilityThreshold)
                        );
                        
                        if (validPrevious.length > 0) {
                            // Average previous valid positions
                            const avg = { x: 0, y: 0, z: 0 };
                            validPrevious.forEach(frame => {
                                avg.x += frame[i].x;
                                avg.y += frame[i].y;
                                avg.z += frame[i].z;
                            });
                            
                            processedLandmarks[i].x = avg.x / validPrevious.length;
                            processedLandmarks[i].y = avg.y / validPrevious.length;
                            processedLandmarks[i].z = avg.z / validPrevious.length;
                            // Slightly boost visibility for smoother transitions
                            if (type === 'pose') {
                                processedLandmarks[i].visibility = Math.min(
                                    this.visibilityThreshold, 
                                    processedLandmarks[i].visibility + 0.1
                                );
                            }
                        } else if (type === 'pose' && this.defaultPoses.pose && this.defaultPoses.pose[i]) {
                            // Use default pose as fallback
                            const blendFactor = 0.6;
                            processedLandmarks[i].x = processedLandmarks[i].x * (1 - blendFactor) + this.defaultPoses.pose[i].x * blendFactor;
                            processedLandmarks[i].y = processedLandmarks[i].y * (1 - blendFactor) + this.defaultPoses.pose[i].y * blendFactor;
                            processedLandmarks[i].z = processedLandmarks[i].z * (1 - blendFactor) + this.defaultPoses.pose[i].z * blendFactor;
                            // Keep low visibility to indicate it's inferred
                            processedLandmarks[i].visibility = Math.min(0.3, processedLandmarks[i].visibility);
                        }
                    } else {
                        // Apply standard exponential smoothing for visible landmarks
                        for (let j = historyLength - 2; j >= 0; j--) {
                            if (!this.smoothingSettings.history[type][j] || !this.smoothingSettings.history[type][j][i]) continue;
                            
                            const weight = factor * Math.pow(1 - factor, historyLength - j - 2);
                            
                            processedLandmarks[i].x = (1 - weight) * processedLandmarks[i].x + 
                                                    weight * this.smoothingSettings.history[type][j][i].x;
                            processedLandmarks[i].y = (1 - weight) * processedLandmarks[i].y + 
                                                    weight * this.smoothingSettings.history[type][j][i].y;
                            processedLandmarks[i].z = (1 - weight) * processedLandmarks[i].z + 
                                                    weight * this.smoothingSettings.history[type][j][i].z;
                        }
                    }
                }
            }
        }
        
        return processedLandmarks;
    }
    
    updateSmoothing(factor) {
        this.smoothingSettings.factor = factor;
        // Clear history when changing smoothing factor
        this.smoothingSettings.history.pose = [];
        this.smoothingSettings.history.leftHand = [];
        this.smoothingSettings.history.rightHand = [];
        this.logger.info(`Smoothing factor updated to ${factor}`);
    }
    
    toggleBodyPart(part, enabled) {
        this.trackingToggles[part] = enabled;
        this.logger.info(`${part} tracking ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    captureDefaultPose() {
        this.shouldCaptureDefaultPose = true;
        this.shouldCaptureDefaultLeftHand = true;
        this.shouldCaptureDefaultRightHand = true;
        this.logger.info('Capturing default pose...');
    }
    
    resetToDefault() {
        // Clear tracking history
        this.smoothingSettings.history.pose = [];
        this.smoothingSettings.history.leftHand = [];
        this.smoothingSettings.history.rightHand = [];
        
        this.logger.info('Motion tracking reset to defaults');
    }
    
    hasValidLandmarks() {
        return this.lastPoseLandmarks !== null;
    }
    
    getTrackingStatus() {
        return this.trackingStatus;
    }
    
    drawOverlay(context) {
        if (!context || (!this.lastPoseLandmarks && !this.lastHandLandmarks.left && !this.lastHandLandmarks.right)) {
            return;
        }
        
        const canvas = context.canvas;
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw pose landmarks
        if (this.lastPoseLandmarks) {
            this.drawPoseLandmarks(context, this.lastPoseLandmarks);
        }
        
        // Draw hand landmarks
        if (this.lastHandLandmarks.left) {
            this.drawHandLandmarks(context, this.lastHandLandmarks.left, 'left');
        }
        if (this.lastHandLandmarks.right) {
            this.drawHandLandmarks(context, this.lastHandLandmarks.right, 'right');
        }
    }
    
    drawPoseLandmarks(context, landmarks) {
        // Define connections for drawing skeleton
        const poseConnections = [
            // Face
            [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
            // Torso
            [11, 12], [11, 23], [12, 24], [23, 24],
            // Arms
            [11, 13], [13, 15], [12, 14], [14, 16],
            // Legs
            [23, 25], [25, 27], [24, 26], [26, 28],
            // Feet
            [27, 31], [28, 32]
        ];
        
        const canvas = context.canvas;
        
        // Draw skeleton connections first
        context.strokeStyle = '#00afff';
        context.lineWidth = 3;
        
        poseConnections.forEach(([i, j]) => {
            if (landmarks[i] && landmarks[j] && 
                landmarks[i].visibility > 0.2 && landmarks[j].visibility > 0.2) {
                
                context.beginPath();
                context.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
                context.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
                context.stroke();
            }
        });
        
        // Draw landmarks with color based on visibility
        landmarks.forEach((landmark, index) => {
            if (landmark.visibility > 0.2) {
                const radius = landmark.visibility > 0.8 ? 5 : 3;
                
                // Color gradient based on visibility
                const alpha = Math.max(0.3, landmark.visibility);
                context.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                
                context.beginPath();
                context.arc(
                    landmark.x * canvas.width,
                    landmark.y * canvas.height,
                    radius, 0, 2 * Math.PI
                );
                context.fill();
                
                // Add landmark number for debugging
                if (landmark.visibility > 0.8) {
                    context.fillStyle = '#ffffff';
                    context.font = '10px Arial';
                    context.fillText(
                        index.toString(),
                        landmark.x * canvas.width + 7,
                        landmark.y * canvas.height + 3
                    );
                }
            }
        });
    }
    
    drawHandLandmarks(context, landmarks, handedness) {
        // Hand connections for drawing
        const handConnections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring finger
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm
            [0, 5], [5, 9], [9, 13], [13, 17]
        ];
        
        const canvas = context.canvas;
        
        // Color based on handedness
        const color = handedness === 'left' ? '#ff6a00' : '#00ffff';
        
        // Draw connections
        context.strokeStyle = color;
        context.lineWidth = 2;
        
        handConnections.forEach(([i, j]) => {
            if (landmarks[i] && landmarks[j]) {
                context.beginPath();
                context.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
                context.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
                context.stroke();
            }
        });
        
        // Draw landmarks
        context.fillStyle = color;
        landmarks.forEach((landmark, index) => {
            if (landmark) {
                const radius = (index === 0) ? 5 : 3; // Wrist point larger
                
                context.beginPath();
                context.arc(
                    landmark.x * canvas.width,
                    landmark.y * canvas.height,
                    radius, 0, 2 * Math.PI
                );
                context.fill();
            }
        });
        
        // Label the hand
        context.fillStyle = color;
        context.font = 'bold 12px Arial';
        context.fillText(
            handedness.toUpperCase(),
            landmarks[0].x * canvas.width - 20,
            landmarks[0].y * canvas.height - 10
        );
    }
    
    setVisibilityThreshold(threshold) {
        this.visibilityThreshold = threshold;
        this.logger.info(`Visibility threshold set to ${threshold}`);
    }
    
    setHistoryLength(length) {
        this.smoothingSettings.historyLength = length;
        this.smoothingSettings.history.pose = this.smoothingSettings.history.pose.slice(-length);
        this.smoothingSettings.history.leftHand = this.smoothingSettings.history.leftHand.slice(-length);
        this.smoothingSettings.history.rightHand = this.smoothingSettings.history.rightHand.slice(-length);
        this.logger.info(`Smoothing history length set to ${length}`);
    }
}