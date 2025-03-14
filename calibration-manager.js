/**
 * Manages calibration settings for all body parts
 * Provides centralized control over tracking calibration
 */
export class CalibrationManager {
    constructor(logger) {
        this.logger = logger;
        this.modelController = null;
        this.motionCapture = null;
        
        // Calibration settings for each body part
        this.calibration = {
            head: {
                rotationOffset: { x: -3.0, y: 0, z: 0 },
                positionOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            torso: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                positionOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            leftArm: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            rightArm: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            leftLeg: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            rightLeg: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            leftHand: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            rightHand: {
                rotationOffset: { x: 0, y: 0, z: 0 },
                scaleFactor: { x: 1.0, y: 1.0, z: 1.0 }
            },
            global: {
                smoothingFactor: 0.7,
                positionSmoothing: 0.5,
                rotationSmoothing: 0.5
            }
        };
        
        // Range limits for calibration values
        this.ranges = {
            rotation: { min: -5, max: 5 },
            position: { min: -5, max: 5 },
            scale: { min: 0.1, max: 3.0 },
            smoothing: { min: 0, max: 1 }
        };
        
        // Saved presets for quick switching
        this.presets = {
            default: JSON.parse(JSON.stringify(this.calibration))
        };
    }
    
    setModelController(modelController) {
        this.modelController = modelController;
        
        // Apply initial calibration settings
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
        }
    }
    
    setMotionCapture(motionCapture) {
        this.motionCapture = motionCapture;
        
        // Apply initial smoothing settings
        if (this.motionCapture) {
            this.motionCapture.updateSmoothing(this.calibration.global.smoothingFactor);
        }
    }
    
    updateHeadCalibration(type, axis, value) {
        if (!this.calibration.head[type] || !this.calibration.head[type][axis]) {
            this.logger.warn(`Invalid head calibration: ${type}.${axis}`);
            return false;
        }
        
        // Apply range limits
        const range = this.ranges[type] || this.ranges.rotation;
        value = Math.max(range.min, Math.min(range.max, value));
        
        this.calibration.head[type][axis] = value;
        
        // Apply to model controller
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
            this.logger.info(`Head ${type}.${axis} calibration set to ${value}`);
            return true;
        }
        
        return false;
    }
    
    updateTorsoCalibration(type, axis, value) {
        if (!this.calibration.torso[type] || !this.calibration.torso[type][axis]) {
            this.logger.warn(`Invalid torso calibration: ${type}.${axis}`);
            return false;
        }
        
        // Apply range limits
        const range = this.ranges[type] || this.ranges.rotation;
        value = Math.max(range.min, Math.min(range.max, value));
        
        this.calibration.torso[type][axis] = value;
        
        // Apply to model controller
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
            this.logger.info(`Torso ${type}.${axis} calibration set to ${value}`);
            return true;
        }
        
        return false;
    }
    
    updateLimbCalibration(limb, type, axis, value) {
        const limbKey = `${limb}${limb.includes('Hand') ? '' : (limb.includes('Arm') ? 'Arm' : 'Leg')}`;
        
        if (!this.calibration[limbKey] || !this.calibration[limbKey][type] || !this.calibration[limbKey][type][axis]) {
            this.logger.warn(`Invalid ${limbKey} calibration: ${type}.${axis}`);
            return false;
        }
        
        // Apply range limits
        const range = this.ranges[type] || this.ranges.rotation;
        value = Math.max(range.min, Math.min(range.max, value));
        
        this.calibration[limbKey][type][axis] = value;
        
        // Apply to model controller
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
            this.logger.info(`${limbKey} ${type}.${axis} calibration set to ${value}`);
            return true;
        }
        
        return false;
    }
    
    updateGlobalSmoothing(type, value) {
        if (!this.calibration.global[type]) {
            this.logger.warn(`Invalid global smoothing type: ${type}`);
            return false;
        }
        
        // Apply range limits
        value = Math.max(this.ranges.smoothing.min, Math.min(this.ranges.smoothing.max, value));
        
        this.calibration.global[type] = value;
        
        // Apply to model controller and motion capture
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
        }
        
        if (this.motionCapture && type === 'smoothingFactor') {
            this.motionCapture.updateSmoothing(value);
        }
        
        this.logger.info(`Global ${type} set to ${value}`);
        return true;
    }
    
    savePreset(name) {
        if (!name) {
            name = 'preset_' + Date.now();
        }
        
        this.presets[name] = JSON.parse(JSON.stringify(this.calibration));
        this.logger.info(`Saved calibration preset: ${name}`);
        return name;
    }
    
    loadPreset(name) {
        if (!this.presets[name]) {
            this.logger.warn(`Preset not found: ${name}`);
            return false;
        }
        
        this.calibration = JSON.parse(JSON.stringify(this.presets[name]));
        
        // Apply to model controller
        if (this.modelController) {
            this.modelController.setCalibration(this.calibration);
        }
        
        // Apply to motion capture
        if (this.motionCapture) {
            this.motionCapture.updateSmoothing(this.calibration.global.smoothingFactor);
        }
        
        this.logger.info(`Loaded calibration preset: ${name}`);
        return true;
    }
    
    resetToDefault() {
        return this.loadPreset('default');
    }
    
    getCurrentCalibration() {
        return this.calibration;
    }
    
    getPresetList() {
        return Object.keys(this.presets);
    }
    
    exportCalibration() {
        return JSON.stringify(this.calibration);
    }
    
    importCalibration(json) {
        try {
            const imported = JSON.parse(json);
            
            // Validate structure
            if (!imported.head || !imported.torso || !imported.global) {
                throw new Error('Invalid calibration data structure');
            }
            
            this.calibration = imported;
            
            // Apply to connected components
            if (this.modelController) {
                this.modelController.setCalibration(this.calibration);
            }
            
            if (this.motionCapture) {
                this.motionCapture.updateSmoothing(this.calibration.global.smoothingFactor);
            }
            
            this.logger.info('Calibration imported successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to import calibration:', error);
            return false;
        }
    }
}