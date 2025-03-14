/**
 * Manages the debug panel and visualization tools
 */
export class DebugView {
    constructor(logger) {
        this.logger = logger;
        this.debugPanel = null;
        this.calibrationManager = null;
        this.motionCapture = null;
        this.modelController = null;
        
        // Debug panel tabs
        this.activeTab = 'calibration';
        
        // Performance tracking
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
    }
    
    setupDebugPanel(calibrationManager, motionCapture, modelController) {
        this.calibrationManager = calibrationManager;
        this.motionCapture = motionCapture;
        this.modelController = modelController;
        
        // Create debug panel if it doesn't exist
        if (!document.querySelector('.debug-panel')) {
            this.createDebugPanel();
        } else {
            this.debugPanel = document.querySelector('.debug-panel');
        }
        
        // Create tab interface
        this.createTabInterface();
        
        // Create calibration controls
        this.createCalibrationControls();
        
        // Create tracking controls
        this.createTrackingControls();
        
        // Create advanced settings
        this.createAdvancedSettings();
        
        // Create presets section
        this.createPresetsSection();
        
        // Populate logs area
        this.createLogsArea();
    }
    
    createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.className = 'debug-panel';
        document.body.appendChild(this.debugPanel);
        
        const title = document.createElement('h3');
        title.textContent = 'Motion Tracking Control Panel';
        this.debugPanel.appendChild(title);
    }
    
    createTabInterface() {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container';
        
        const tabs = [
            { id: 'calibration', name: 'Calibration' },
            { id: 'tracking', name: 'Tracking' },
            { id: 'advanced', name: 'Advanced' },
            { id: 'presets', name: 'Presets' },
            { id: 'logs', name: 'Logs' }
        ];
        
        tabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = `tab ${tab.id === this.activeTab ? 'active' : ''}`;
            tabElement.textContent = tab.name;
            tabElement.dataset.tabId = tab.id;
            
            tabElement.addEventListener('click', () => {
                this.setActiveTab(tab.id);
            });
            
            tabContainer.appendChild(tabElement);
        });
        
        this.debugPanel.appendChild(tabContainer);
        
        // Create containers for each tab
        tabs.forEach(tab => {
            const contentElement = document.createElement('div');
            contentElement.className = `tab-content ${tab.id === this.activeTab ? 'active' : ''}`;
            contentElement.id = `tab-${tab.id}`;
            this.debugPanel.appendChild(contentElement);
        });
    }
    
    setActiveTab(tabId) {
        this.activeTab = tabId;
        
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tabId === tabId);
        });
        
        // Update content visibility
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }
    
    createCalibrationControls() {
        const container = document.getElementById('tab-calibration');
        
        // Head calibration section
        const headSection = document.createElement('div');
        headSection.className = 'debug-section';
        
        const headTitle = document.createElement('h4');
        headTitle.textContent = 'Head Tracking Calibration';
        headSection.appendChild(headTitle);
        
        // Head rotation calibration
        ['x', 'y', 'z'].forEach(axis => {
            const control = this.createCalibrationControl(
                `Head Rotation ${axis.toUpperCase()}`,
                -5, 5, 0.1,
                axis === 'x' ? -3.0 : 0,
                `Looking ${axis === 'x' ? 'Down' : (axis === 'y' ? 'Right' : 'Left')}`,
                `Looking ${axis === 'x' ? 'Up' : (axis === 'y' ? 'Left' : 'Right')}`,
                (value) => {
                    this.calibrationManager.updateHeadCalibration('rotationOffset', axis, value);
                }
            );
            headSection.appendChild(control);
        });
        
        container.appendChild(headSection);
        
        // Torso calibration section
        const torsoSection = document.createElement('div');
        torsoSection.className = 'debug-section';
        
        const torsoTitle = document.createElement('h4');
        torsoTitle.textContent = 'Torso Tracking Calibration';
        torsoSection.appendChild(torsoTitle);
        
        // Torso rotation calibration
        ['x', 'y', 'z'].forEach(axis => {
            const control = this.createCalibrationControl(
                `Torso Rotation ${axis.toUpperCase()}`,
                -5, 5, 0.1,
                0,
                `Negative`,
                `Positive`,
                (value) => {
                    this.calibrationManager.updateTorsoCalibration('rotationOffset', axis, value);
                }
            );
            torsoSection.appendChild(control);
        });
        
        container.appendChild(torsoSection);
        
        // Arms calibration section
        const armsSection = document.createElement('div');
        armsSection.className = 'debug-section';
        
        const armsTitle = document.createElement('h4');
        armsTitle.textContent = 'Arms Tracking Calibration';
        armsSection.appendChild(armsTitle);
        
        // Arm rotation calibration (left and right)
        ['left', 'right'].forEach(side => {
            const sideTitle = document.createElement('h4');
            sideTitle.style.fontSize = '14px';
            sideTitle.textContent = `${side.charAt(0).toUpperCase() + side.slice(1)} Arm`;
            armsSection.appendChild(sideTitle);
            
            ['x', 'y', 'z'].forEach(axis => {
                const control = this.createCalibrationControl(
                    `Rotation ${axis.toUpperCase()}`,
                    -5, 5, 0.1,
                    0,
                    `Negative`,
                    `Positive`,
                    (value) => {
                        this.calibrationManager.updateLimbCalibration(`${side}Arm`, 'rotationOffset', axis, value);
                    }
                );
                armsSection.appendChild(control);
            });
        });
        
        container.appendChild(armsSection);
        
        // Legs calibration section
        const legsSection = document.createElement('div');
        legsSection.className = 'debug-section';
        
        const legsTitle = document.createElement('h4');
        legsTitle.textContent = 'Legs Tracking Calibration';
        legsSection.appendChild(legsTitle);
        
        // Leg rotation calibration (left and right)
        ['left', 'right'].forEach(side => {
            const sideTitle = document.createElement('h4');
            sideTitle.style.fontSize = '14px';
            sideTitle.textContent = `${side.charAt(0).toUpperCase() + side.slice(1)} Leg`;
            legsSection.appendChild(sideTitle);
            
            ['x', 'y', 'z'].forEach(axis => {
                const control = this.createCalibrationControl(
                    `Rotation ${axis.toUpperCase()}`,
                    -5, 5, 0.1,
                    0,
                    `Negative`,
                    `Positive`,
                    (value) => {
                        this.calibrationManager.updateLimbCalibration(`${side}Leg`, 'rotationOffset', axis, value);
                    }
                );
                legsSection.appendChild(control);
            });
        });
        
        container.appendChild(legsSection);
        
        // Global smoothing
        const smoothingSection = document.createElement('div');
        smoothingSection.className = 'debug-section';
        
        const smoothingTitle = document.createElement('h4');
        smoothingTitle.textContent = 'Motion Smoothing';
        smoothingSection.appendChild(smoothingTitle);
        
        // Smoothing factors
        const smoothingTypes = [
            { name: 'Overall Smoothing', key: 'smoothingFactor', min: 0, max: 1, default: 0.7 },
            { name: 'Position Smoothing', key: 'positionSmoothing', min: 0, max: 1, default: 0.5 },
            { name: 'Rotation Smoothing', key: 'rotationSmoothing', min: 0, max: 1, default: 0.5 }
        ];
        
        smoothingTypes.forEach(type => {
            const control = this.createCalibrationControl(
                type.name,
                type.min, type.max, 0.05,
                type.default,
                'Less Smoothing',
                'More Smoothing',
                (value) => {
                    this.calibrationManager.updateGlobalSmoothing(type.key, value);
                }
            );
            smoothingSection.appendChild(control);
        });
        
        container.appendChild(smoothingSection);
    }
    
    createCalibrationControl(label, min, max, step, defaultValue, leftLabel, rightLabel, onChange) {
        const control = document.createElement('div');
        control.className = 'calibration-control';
        
        const controlLabel = document.createElement('label');
        controlLabel.textContent = label;
        control.appendChild(controlLabel);
        
        const rangeInfo = document.createElement('div');
        rangeInfo.className = 'range-info';
        rangeInfo.innerHTML = `<span>${leftLabel}</span><span>${rightLabel}</span>`;
        control.appendChild(rangeInfo);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = defaultValue.toString();
        
        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'calibration-value';
        valueDisplay.textContent = `Value: ${defaultValue}`;
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = `Value: ${value.toFixed(2)}`;
            
            if (onChange) {
                onChange(value);
            }
        });
        
        control.appendChild(slider);
        control.appendChild(valueDisplay);
        
        return control;
    }
    
    createTrackingControls() {
        const container = document.getElementById('tab-tracking');
        
        // Body part toggles section
        const togglesSection = document.createElement('div');
        togglesSection.className = 'debug-section';
        
        const togglesTitle = document.createElement('h4');
        togglesTitle.textContent = 'Tracking Toggles';
        togglesSection.appendChild(togglesTitle);
        
        // Create toggles for each body part
        const bodyParts = [
            { id: 'head', label: 'Head Tracking' },
            { id: 'torso', label: 'Torso Tracking' },
            { id: 'arms', label: 'Arms Tracking' },
            { id: 'hands', label: 'Hands Tracking' },
            { id: 'fingers', label: 'Fingers Tracking' },
            { id: 'legs', label: 'Legs Tracking' }
        ];
        
        bodyParts.forEach(part => {
            const toggle = this.createToggle(
                part.label,
                true,
                (checked) => {
                    if (this.motionCapture) {
                        this.motionCapture.toggleBodyPart(part.id, checked);
                    }
                }
            );
            togglesSection.appendChild(toggle);
        });
        
        container.appendChild(togglesSection);
        
        // Status section
        const statusSection = document.createElement('div');
        statusSection.className = 'debug-section';
        
        const statusTitle = document.createElement('h4');
        statusTitle.textContent = 'Tracking Status';
        statusSection.appendChild(statusTitle);
        
        // Status indicators
        const statuses = [
            { id: 'pose', label: 'Pose Tracking' },
            { id: 'leftHand', label: 'Left Hand' },
            { id: 'rightHand', label: 'Right Hand' }
        ];
        
        const statusContainer = document.createElement('div');
        
        statuses.forEach(status => {
            const indicator = document.createElement('div');
            indicator.className = 'toggle-container';
            
            const statusDot = document.createElement('span');
            statusDot.className = 'status-indicator inactive';
            statusDot.id = `status-${status.id}`;
            
            const statusLabel = document.createElement('span');
            statusLabel.textContent = status.label;
            
            indicator.appendChild(statusDot);
            indicator.appendChild(statusLabel);
            statusContainer.appendChild(indicator);
        });
        
        statusSection.appendChild(statusContainer);
        
        // Update status indicators every second
        setInterval(() => this.updateTrackingStatus(), 1000);
        
        container.appendChild(statusSection);
        
        // Capture buttons section
        const captureSection = document.createElement('div');
        captureSection.className = 'debug-section';
        
        const captureTitle = document.createElement('h4');
        captureTitle.textContent = 'Default Pose Capture';
        captureSection.appendChild(captureTitle);
        
        const captureHelp = document.createElement('div');
        captureHelp.className = 'help-text';
        captureHelp.textContent = 'Capture your current pose as the default position when body parts are out of view';
        captureSection.appendChild(captureHelp);
        
        const captureButton = document.createElement('button');
        captureButton.className = 'debug-button';
        captureButton.textContent = 'Capture Default Pose';
        captureButton.addEventListener('click', () => {
            if (this.motionCapture) {
                this.motionCapture.captureDefaultPose();
            }
        });
        captureSection.appendChild(captureButton);
        
        container.appendChild(captureSection);
        
        // Debug visualizations
        const visualSection = document.createElement('div');
        visualSection.className = 'debug-section';
        
        const visualTitle = document.createElement('h4');
        visualTitle.textContent = 'Debug Visualization';
        visualSection.appendChild(visualTitle);
        
        // Toggle skeleton helper
        const skeletonToggle = this.createToggle(
            'Show Skeleton',
            false,
            (checked) => {
                if (this.modelController) {
                    this.modelController.toggleSkeletonHelper();
                }
            }
        );
        visualSection.appendChild(skeletonToggle);
        
        // Toggle axes helpers
        const axesToggle = this.createToggle(
            'Show Bone Axes',
            false,
            (checked) => {
                if (this.modelController) {
                    this.modelController.showAxesHelpers(checked);
                }
            }
        );
        visualSection.appendChild(axesToggle);
        
        container.appendChild(visualSection);
    }
    
    updateTrackingStatus() {
        if (!this.motionCapture) return;
        
        const status = this.motionCapture.getTrackingStatus();
        
        Object.keys(status).forEach(key => {
            const indicator = document.getElementById(`status-${key}`);
            if (indicator) {
                indicator.className = `status-indicator ${status[key] ? 'active' : 'inactive'}`;
            }
        });
    }
    
    createToggle(label, initialState, onChange) {
        const toggle = document.createElement('div');
        toggle.className = 'toggle-container';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = initialState;
        checkbox.id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
        
        const toggleLabel = document.createElement('label');
        toggleLabel.textContent = label;
        toggleLabel.htmlFor = checkbox.id;
        
        checkbox.addEventListener('change', (e) => {
            if (onChange) {
                onChange(e.target.checked);
            }
        });
        
        toggle.appendChild(checkbox);
        toggle.appendChild(toggleLabel);
        
        return toggle;
    }
    
    createAdvancedSettings() {
        const container = document.getElementById('tab-advanced');
        
        // Visibility threshold section
        const visibilitySection = document.createElement('div');
        visibilitySection.className = 'debug-section';
        
        const visibilityTitle = document.createElement('h4');
        visibilityTitle.textContent = 'Tracking Sensitivity';
        visibilitySection.appendChild(visibilityTitle);
        
        // Visibility threshold control
        const visibilityControl = this.createCalibrationControl(
            'Landmark Visibility Threshold',
            0.1, 0.9, 0.05,
            0.7,
            'Less Strict',
            'More Strict',
            (value) => {
                if (this.motionCapture) {
                    this.motionCapture.setVisibilityThreshold(value);
                }
            }
        );
        visibilitySection.appendChild(visibilityControl);
        
        container.appendChild(visibilitySection);
        
        // History length section
        const historySection = document.createElement('div');
        historySection.className = 'debug-section';
        
        const historyTitle = document.createElement('h4');
        historyTitle.textContent = 'Smoothing Buffer Length';
        historySection.appendChild(historyTitle);
        
        // History length control
        const historyControl = this.createCalibrationControl(
            'Smoothing History Length',
            1, 30, 1,
            10,
            'Shorter (More Responsive)',
            'Longer (Smoother)',
            (value) => {
                if (this.motionCapture) {
                    this.motionCapture.setHistoryLength(Math.round(value));
                }
            }
        );
        historySection.appendChild(historyControl);
        
        container.appendChild(historySection);
        
        // Reset section
        const resetSection = document.createElement('div');
        resetSection.className = 'debug-section';
        
        const resetTitle = document.createElement('h4');
        resetTitle.textContent = 'Reset Functions';
        resetSection.appendChild(resetTitle);
        
        const resetButton = document.createElement('button');
        resetButton.className = 'debug-button reset';
        resetButton.textContent = 'Reset All Settings';
        resetButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all calibration and tracking settings?')) {
                if (this.calibrationManager) {
                    this.calibrationManager.resetToDefault();
                }
                if (this.motionCapture) {
                    this.motionCapture.resetToDefault();
                }
                
                // Reset all sliders to default values
                document.querySelectorAll('.calibration-control input[type="range"]').forEach(slider => {
                    const defaultValue = slider.defaultValue;
                    slider.value = defaultValue;
                    const valueDisplay = slider.parentElement.querySelector('.calibration-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = `Value: ${defaultValue}`;
                    }
                });
                
                this.logger.info('All settings reset to defaults');
            }
        });
        resetSection.appendChild(resetButton);
        
        container.appendChild(resetSection);
    }
    
    createPresetsSection() {
        const container = document.getElementById('tab-presets');
        
        // Presets list section
        const presetListSection = document.createElement('div');
        presetListSection.className = 'debug-section';
        
        const presetListTitle = document.createElement('h4');
        presetListTitle.textContent = 'Saved Calibration Presets';
        presetListSection.appendChild(presetListTitle);
        
        // Presets list container
        const presetList = document.createElement('div');
        presetList.id = 'preset-list';
        presetList.innerHTML = '<div>Default system preset</div>';
        presetListSection.appendChild(presetList);
        
        // Load preset button
        const loadButton = document.createElement('button');
        loadButton.className = 'debug-button';
        loadButton.textContent = 'Load Default Preset';
        loadButton.addEventListener('click', () => {
            if (this.calibrationManager) {
                this.calibrationManager.loadPreset('default');
                this.logger.info('Loaded default preset');
            }
        });
        presetListSection.appendChild(loadButton);
        
        container.appendChild(presetListSection);
        
        // Save preset section
        const savePresetSection = document.createElement('div');
        savePresetSection.className = 'debug-section';
        
        const savePresetTitle = document.createElement('h4');
        savePresetTitle.textContent = 'Save Current Calibration';
        savePresetSection.appendChild(savePresetTitle);
        
        // Preset name input
        const presetNameInput = document.createElement('input');
        presetNameInput.type = 'text';
        presetNameInput.placeholder = 'Preset Name';
        presetNameInput.style.width = '100%';
        presetNameInput.style.padding = '8px';
        presetNameInput.style.marginBottom = '10px';
        presetNameInput.style.backgroundColor = '#222';
        presetNameInput.style.color = 'white';
        presetNameInput.style.border = '1px solid #444';
        presetNameInput.style.borderRadius = '4px';
        savePresetSection.appendChild(presetNameInput);
        
        // Save button
        const saveButton = document.createElement('button');
        saveButton.className = 'debug-button save';
        saveButton.textContent = 'Save Current Settings';
        saveButton.addEventListener('click', () => {
            if (this.calibrationManager) {
                const name = presetNameInput.value.trim() || `Preset ${new Date().toLocaleTimeString()}`;
                this.calibrationManager.savePreset(name);
                presetNameInput.value = '';
                
                // Update preset list
                this.updatePresetList();
            }
        });
        savePresetSection.appendChild(saveButton);
        
        container.appendChild(savePresetSection);
        
        // Export/Import section
        const exportSection = document.createElement('div');
        exportSection.className = 'debug-section';
        
        const exportTitle = document.createElement('h4');
        exportTitle.textContent = 'Export/Import Calibration';
        exportSection.appendChild(exportTitle);
        
        // Export button
        const exportButton = document.createElement('button');
        exportButton.className = 'debug-button';
        exportButton.textContent = 'Export Current Calibration';
        exportButton.addEventListener('click', () => {
            if (this.calibrationManager) {
                const exportData = this.calibrationManager.exportCalibration();
                navigator.clipboard.writeText(exportData)
                    .then(() => {
                        alert('Calibration settings copied to clipboard!');
                        this.logger.info('Calibration exported to clipboard');
                    })
                    .catch(err => {
                        console.error('Failed to copy calibration', err);
                        alert('Failed to copy. See console for details.');
                    });
            }
        });
        exportSection.appendChild(exportButton);
        
        // Import area
        const importArea = document.createElement('textarea');
        importArea.placeholder = 'Paste calibration data here...';
        importArea.style.width = '100%';
        importArea.style.height = '80px';
        importArea.style.padding = '8px';
        importArea.style.marginTop = '10px';
        importArea.style.backgroundColor = '#222';
        importArea.style.color = 'white';
        importArea.style.border = '1px solid #444';
        importArea.style.borderRadius = '4px';
        importArea.style.resize = 'vertical';
        exportSection.appendChild(importArea);
        
        // Import button
        const importButton = document.createElement('button');
        importButton.className = 'debug-button';
        importButton.textContent = 'Import Calibration';
        importButton.addEventListener('click', () => {
            if (this.calibrationManager && importArea.value.trim()) {
                const success = this.calibrationManager.importCalibration(importArea.value);
                if (success) {
                    alert('Calibration imported successfully!');
                    importArea.value = '';
                } else {
                    alert('Failed to import calibration. Check format and try again.');
                }
            } else {
                alert('Please paste calibration data first.');
            }
        });
        exportSection.appendChild(importButton);
        
        container.appendChild(exportSection);
    }
    
    updatePresetList() {
        if (!this.calibrationManager) return;
        
        const presetList = document.getElementById('preset-list');
        if (!presetList) return;
        
        const presets = this.calibrationManager.getPresetList();
        
        presetList.innerHTML = '';
        
        presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'toggle-container';
            presetItem.style.justifyContent = 'space-between';
            
            const presetName = document.createElement('span');
            presetName.textContent = preset;
            presetItem.appendChild(presetName);
            
            if (preset !== 'default') {
                const loadButton = document.createElement('button');
                loadButton.textContent = 'Load';
                loadButton.style.padding = '2px 8px';
                loadButton.style.backgroundColor = '#355e35';
                loadButton.style.border = 'none';
                loadButton.style.borderRadius = '3px';
                loadButton.style.color = 'white';
                loadButton.style.cursor = 'pointer';
                loadButton.style.marginLeft = '10px';
                
                loadButton.addEventListener('click', () => {
                    if (this.calibrationManager) {
                        this.calibrationManager.loadPreset(preset);
                        this.logger.info(`Loaded preset: ${preset}`);
                    }
                });
                
                presetItem.appendChild(loadButton);
            }
            
            presetList.appendChild(presetItem);
        });
    }
    
    createLogsArea() {
        const container = document.getElementById('tab-logs');
        
        // Log controls
        const logControls = document.createElement('div');
        logControls.className = 'debug-section';
        
        const clearButton = document.createElement('button');
        clearButton.className = 'debug-button';
        clearButton.textContent = 'Clear Logs';
        clearButton.addEventListener('click', () => {
            if (this.logger) {
                this.logger.clear();
            }
        });
        logControls.appendChild(clearButton);
        
        container.appendChild(logControls);
        
        // Create log container if not already present
        if (!document.getElementById('debug-logs')) {
            const logContainer = document.createElement('div');
            logContainer.id = 'debug-logs';
            logContainer.className = 'debug-logs';
            container.appendChild(logContainer);
        }
    }
}