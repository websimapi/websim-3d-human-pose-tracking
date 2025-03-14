import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';
import { Logger } from './logger.js';
import { MotionCapture } from './motion-capture.js';
import { CalibrationManager } from './calibration-manager.js';
import { ModelController } from './model-controller.js';
import { DebugView } from './debug-view.js';
import { PerformanceMonitor } from './performance-monitor.js';

class BodyTrackingApp {
    constructor() {
        // Initialize logger first for early debugging
        this.logger = new Logger('debug-logs');
        this.logger.info('Application initializing...');
        
        // Core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        
        // DOM elements
        this.loadingElement = document.getElementById('loading');
        this.debugInfoElement = document.getElementById('debug-info');
        
        // State management
        this.isInitialized = false;
        this.isTracking = false;
        this.videoVisible = true;
        this.debugVisible = false;
        
        // Create specialized subsystems
        this.performanceMonitor = new PerformanceMonitor();
        this.motionCapture = new MotionCapture(this.logger);
        this.modelController = null; // Will be initialized after model loading
        this.debugView = new DebugView(this.logger);
        this.calibrationManager = new CalibrationManager(this.logger);
        
        // Initialize the application
        this.init().catch(error => {
            this.logger.error('Initialization failed:', error);
            this.showErrorMessage('Failed to initialize the application. Please check console for details.');
        });
    }

    async init() {
        try {
            this.logger.info('Setting up scene...');
            await this.initScene();
            
            this.logger.info('Initializing webcam...');
            await this.initWebcam();
            
            this.logger.info('Loading 3D model...');
            await this.loadModel();
            
            this.logger.info('Setting up tracking systems...');
            await this.motionCapture.init();
            
            this.logger.info('Setting up event listeners...');
            this.setupEventListeners();
            
            this.logger.info('Setting up debug panel...');
            this.debugView.setupDebugPanel(
                this.calibrationManager,
                this.motionCapture,
                this.modelController
            );
            
            // Start animation loop
            this.animate();
            
            // Hide loading screen
            this.loadingElement.style.display = 'none';
            
            this.isInitialized = true;
            this.logger.info('Initialization complete!');
            this.updateStatusMessage('System ready. Click "Start Tracking" to begin.');
        } catch (error) {
            this.logger.error('Initialization error:', error);
            throw error;
        }
    }
    
    async initScene() {
        // Create scene with improved error handling
        try {
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x1a1a1a);
            this.scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);
            
            // Setup camera
            this.camera = new THREE.PerspectiveCamera(
                50, 
                window.innerWidth / window.innerHeight, 
                0.1, 
                1000
            );
            this.camera.position.set(0, 1.6, 4);
            
            // Setup renderer with robust initialization
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                powerPreference: "high-performance",
                alpha: true
            });
            
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            const container = document.getElementById('scene-container');
            container.appendChild(this.renderer.domElement);
            
            // Add orbit controls with better damping
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(0, 1, 0);
            
            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 7.5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.bias = -0.0001;
            this.scene.add(directionalLight);
            
            // Add grid for reference
            const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
            this.scene.add(grid);
            
            // Handle window resize
            window.addEventListener('resize', () => this.onWindowResize());
            
            this.logger.info('Scene initialization successful');
        } catch (error) {
            this.logger.error('Failed to initialize scene:', error);
            this.showErrorMessage('Failed to initialize WebGL. Please try a different browser or device.');
            throw error;
        }
    }
    
    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    async initWebcam() {
        try {
            const videoElement = document.getElementById('webcam');
            const overlayCanvas = document.getElementById('webcam-overlay');
            
            // Request camera with specific constraints for better tracking
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                }
            });
            
            videoElement.srcObject = stream;
            
            // Set canvas dimensions to match video
            overlayCanvas.width = 640;
            overlayCanvas.height = 480;
            
            // Store context for drawing
            this.webcamOverlayContext = overlayCanvas.getContext('2d');
            
            // Wait for video to be ready
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    this.logger.info(`Webcam initialized: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                    resolve();
                };
            });
        } catch (error) {
            this.logger.error('Webcam initialization failed:', error);
            this.showErrorMessage('Unable to access webcam. Please ensure you have a webcam connected and have granted permission to use it.');
            throw error;
        }
    }

    async loadModel() {
        try {
            const loader = new GLTFLoader();
            
            return new Promise((resolve, reject) => {
                // Using a rigged human model
                loader.load(
                    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/models/gltf/Xbot.glb',
                    (gltf) => {
                        // Create a clone to prevent issues with potential reuse
                        const model = SkeletonUtils.clone(gltf.scene);
                        
                        model.traverse((object) => {
                            if (object.isMesh) {
                                object.castShadow = true;
                                object.receiveShadow = true;
                                
                                // Improve material quality
                                if (object.material) {
                                    object.material.metalness = 0.1;
                                    object.material.roughness = 0.8;
                                }
                            }
                        });
                        
                        // Scale and position the model
                        model.scale.set(1, 1, 1);
                        model.position.set(0, 0, 0);
                        this.scene.add(model);
                        
                        // Initialize model controller with the loaded model
                        this.modelController = new ModelController(model, this.logger);
                        
                        // Connect motion capture to model controller
                        this.motionCapture.setModelController(this.modelController);
                        
                        // Connect calibration manager to both systems
                        this.calibrationManager.setModelController(this.modelController);
                        this.calibrationManager.setMotionCapture(this.motionCapture);
                        
                        this.logger.info('Model loaded successfully');
                        
                        // Store original model animations
                        this.modelController.setupAnimations(gltf.animations);
                        
                        resolve();
                    },
                    (xhr) => {
                        const progress = Math.floor((xhr.loaded / xhr.total) * 100);
                        this.loadingElement.textContent = `Loading model: ${progress}%`;
                        this.logger.info(`Model loading: ${progress}%`);
                    },
                    (error) => {
                        this.logger.error('Error loading model:', error);
                        reject(error);
                    }
                );
            });
        } catch (error) {
            this.logger.error('Failed to load model:', error);
            this.showErrorMessage('Failed to load 3D model. Please check your internet connection and try again.');
            throw error;
        }
    }
    
    setupEventListeners() {
        // UI Controls
        document.getElementById('start-tracking').addEventListener('click', () => this.toggleTracking());
        document.getElementById('toggle-video').addEventListener('click', () => this.toggleVideo());
        document.getElementById('reset-pose').addEventListener('click', () => this.resetPose());
        document.getElementById('toggle-debug').addEventListener('click', () => this.toggleDebugPanel());
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (event) => {
            switch(event.key.toLowerCase()) {
                case 's':
                    this.modelController.toggleSkeletonHelper();
                    break;
                case 'd':
                    this.toggleDebugPanel();
                    break;
                case 'r':
                    this.resetPose();
                    break;
            }
        });
    }
    
    toggleTracking() {
        this.isTracking = !this.isTracking;
        const button = document.getElementById('start-tracking');
        
        if (this.isTracking) {
            button.textContent = 'Stop Tracking';
            button.classList.add('active');
            this.updateStatusMessage('Tracking active');
            this.logger.info('Tracking started');
            this.motionCapture.startTracking(document.getElementById('webcam'));
        } else {
            button.textContent = 'Start Tracking';
            button.classList.remove('active');
            this.updateStatusMessage('Tracking stopped');
            this.logger.info('Tracking stopped');
            this.motionCapture.stopTracking();
        }
    }
    
    toggleVideo() {
        this.videoVisible = !this.videoVisible;
        const videoContainer = document.getElementById('video-container');
        videoContainer.style.display = this.videoVisible ? 'block' : 'none';
        
        const button = document.getElementById('toggle-video');
        button.textContent = this.videoVisible ? 'Hide Video' : 'Show Video';
        button.classList.toggle('active', this.videoVisible);
        
        this.logger.info(`Video display ${this.videoVisible ? 'enabled' : 'disabled'}`);
    }
    
    resetPose() {
        if (this.modelController) {
            this.modelController.resetToTPose();
            this.logger.info('Model reset to T-pose');
            this.updateStatusMessage('Model reset to T-pose');
        }
    }
    
    toggleDebugPanel() {
        this.debugVisible = !this.debugVisible;
        const debugPanel = document.querySelector('.debug-panel');
        debugPanel.style.display = this.debugVisible ? 'block' : 'none';
        
        const button = document.getElementById('toggle-debug');
        button.textContent = this.debugVisible ? 'Hide Debug' : 'Show Debug';
        button.classList.toggle('active', this.debugVisible);
        
        this.logger.info(`Debug panel ${this.debugVisible ? 'shown' : 'hidden'}`);
    }
    
    animate() {
        this.performanceMonitor.beginFrame();
        
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Update model animations
        if (this.modelController) {
            this.modelController.update(delta);
        }
        
        // Update webcam overlay
        if (this.isTracking && this.motionCapture.hasValidLandmarks()) {
            this.motionCapture.drawOverlay(this.webcamOverlayContext);
        }
        
        // Render scene
        try {
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        } catch (error) {
            this.logger.error('Render error:', error);
            this.isTracking = false;
            this.updateStatusMessage('Rendering error occurred. Tracking stopped.');
        }
        
        this.performanceMonitor.endFrame();
        
        // Update performance stats occasionally
        if (this.performanceMonitor.shouldUpdateStats()) {
            this.performanceMonitor.displayStats();
        }
    }
    
    updateStatusMessage(message) {
        if (this.debugInfoElement) {
            this.debugInfoElement.textContent = message;
        }
    }
    
    showErrorMessage(message) {
        this.updateStatusMessage(`ERROR: ${message}`);
        alert(message);
    }
}

// Initialize the application when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BodyTrackingApp();
});