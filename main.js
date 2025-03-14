import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Main class to handle the application
class BodyTrackingApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.skeleton = null;
        this.bones = {};
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.controls = null;
        this.isTracking = false;
        this.videoVisible = true;
        this.poseDetector = null;
        this.loadingElement = document.getElementById('loading');
        
        this.init();
    }

    async init() {
        // Set up Three.js scene
        this.initScene();
        
        // Initialize webcam
        await this.initWebcam();
        
        // Load 3D model
        await this.loadModel();
        
        // Initialize pose detector
        await this.initPoseDetector();
        
        // Add event listeners
        this.addEventListeners();
        
        // Start animation loop
        this.animate();
        
        // Hide loading screen
        this.loadingElement.style.display = 'none';
    }

    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Add fog for atmosphere
        this.scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(
            50, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 1.6, 4);
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('scene-container').appendChild(this.renderer.domElement);
        
        // Add orbit controls
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
        this.scene.add(directionalLight);
        
        // Add grid for reference
        const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
        this.scene.add(grid);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async initWebcam() {
        try {
            const videoElement = document.getElementById('webcam');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user' 
                }
            });
            videoElement.srcObject = stream;
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error initializing webcam:', error);
            alert('Unable to access webcam. Please ensure you have a webcam connected and have granted permission to use it.');
        }
    }

    async loadModel() {
        return new Promise((resolve) => {
            const loader = new GLTFLoader();
            // Using a free rigged human model from Google's Poly
            loader.load(
                'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/models/gltf/Xbot.glb',
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.traverse((object) => {
                        if (object.isMesh) {
                            object.castShadow = true;
                            object.receiveShadow = true;
                        }
                    });
                    
                    // Scale and position the model
                    this.model.scale.set(1, 1, 1);
                    this.model.position.set(0, 0, 0);
                    this.scene.add(this.model);
                    
                    // Setup animation mixer
                    this.mixer = new THREE.AnimationMixer(this.model);
                    
                    // Map bones for pose tracking
                    this.mapModelBones(this.model);
                    
                    resolve();
                },
                (xhr) => {
                    console.log(`Model loading: ${(xhr.loaded / xhr.total) * 100}% loaded`);
                },
                (error) => {
                    console.error('Error loading model:', error);
                    alert('Failed to load 3D model. Please check your internet connection and try again.');
                }
            );
        });
    }

    mapModelBones(model) {
        this.skeleton = null;
        
        // Find the skeleton in the model
        model.traverse((object) => {
            if (object.isSkinnedMesh && !this.skeleton) {
                this.skeleton = object.skeleton;
            }
        });
        
        if (!this.skeleton) {
            console.error('No skeleton found in the model');
            return;
        }
        
        // Map bone names for easier access
        this.skeleton.bones.forEach(bone => {
            this.bones[bone.name.toLowerCase()] = bone;
        });
        
        console.log('Mapped bones:', Object.keys(this.bones));
    }

    async initPoseDetector() {
        try {
            // Use the correct MediaPipe Pose API initialization
            this.poseDetector = new window.Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });
            
            this.poseDetector.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            this.poseDetector.onResults((results) => {
                if (results.poseLandmarks) {
                    this.updateModelPose(results.poseLandmarks);
                }
            });
        } catch (error) {
            console.error('Error initializing pose detector:', error);
            alert('Failed to initialize pose tracking. Please make sure you have a compatible browser and try again.');
        }
    }

    addEventListeners() {
        document.getElementById('start-tracking').addEventListener('click', () => {
            this.toggleTracking();
        });
        
        document.getElementById('toggle-video').addEventListener('click', () => {
            this.toggleVideo();
        });
    }

    toggleTracking() {
        this.isTracking = !this.isTracking;
        const button = document.getElementById('start-tracking');
        
        if (this.isTracking) {
            button.textContent = 'Stop Tracking';
            this.startPoseDetection();
        } else {
            button.textContent = 'Start Tracking';
        }
    }

    toggleVideo() {
        this.videoVisible = !this.videoVisible;
        const videoContainer = document.getElementById('video-container');
        videoContainer.style.display = this.videoVisible ? 'block' : 'none';
    }

    async startPoseDetection() {
        if (!this.isTracking) return;
        
        const videoElement = document.getElementById('webcam');
        
        try {
            // Use the correct method to process frames
            await this.poseDetector.send({image: videoElement});
        } catch (error) {
            console.error('Error in pose detection:', error);
        }
        
        if (this.isTracking) {
            requestAnimationFrame(() => this.startPoseDetection());
        }
    }

    updateModelPose(landmarks) {
        if (!this.skeleton || !landmarks) return;
        
        // Enhanced mapping between MediaPipe landmarks and model bones
        
        // Calculate torso orientation
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (leftShoulder && rightShoulder && leftHip && rightHip) {
            // Calculate mid points
            const shoulderCenter = {
                x: (leftShoulder.x + rightShoulder.x) / 2,
                y: (leftShoulder.y + rightShoulder.y) / 2,
                z: (leftShoulder.z + rightShoulder.z) / 2
            };
            
            const hipCenter = {
                x: (leftHip.x + rightHip.x) / 2,
                y: (leftHip.y + rightHip.y) / 2,
                z: (leftHip.z + rightHip.z) / 2
            };
            
            // Debug visualization
            console.log("Tracking active, landmarks detected:", landmarks.length);
            
            // Update root bone position based on hip center
            if (this.bones['hips']) {
                // Adjust the scaling factor as needed for your model
                const positionScaleFactor = 2;
                this.bones['hips'].position.x = (hipCenter.x - 0.5) * positionScaleFactor;
                // Y is up in Three.js, but MediaPipe y increases downward
                this.bones['hips'].position.y = (0.5 - hipCenter.y) * positionScaleFactor;
            }
            
            // Handle spine and neck rotation
            const spineAngleX = Math.atan2(
                shoulderCenter.z - hipCenter.z,
                shoulderCenter.y - hipCenter.y
            );
            
            const spineAngleZ = Math.atan2(
                shoulderCenter.x - hipCenter.x,
                shoulderCenter.y - hipCenter.y
            );
            
            ['spine', 'spine1', 'spine2'].forEach(boneName => {
                if (this.bones[boneName]) {
                    this.bones[boneName].rotation.x = spineAngleX;
                    this.bones[boneName].rotation.z = spineAngleZ;
                }
            });
            
            // Enhanced shoulder rotation
            if (this.bones['leftshoulder'] && leftShoulder) {
                const leftElbow = landmarks[13];
                if (leftElbow) {
                    this.bones['leftshoulder'].rotation.x = 
                        Math.atan2(leftElbow.z - leftShoulder.z, leftElbow.y - leftShoulder.y);
                    this.bones['leftshoulder'].rotation.y = 
                        Math.atan2(leftElbow.x - leftShoulder.x, leftElbow.z - leftShoulder.z);
                    this.bones['leftshoulder'].rotation.z = 
                        Math.atan2(leftElbow.y - leftShoulder.y, leftElbow.x - leftShoulder.x) - Math.PI/2;
                }
            }
            
            if (this.bones['rightshoulder'] && rightShoulder) {
                const rightElbow = landmarks[14];
                if (rightElbow) {
                    this.bones['rightshoulder'].rotation.x = 
                        Math.atan2(rightElbow.z - rightShoulder.z, rightElbow.y - rightShoulder.y);
                    this.bones['rightshoulder'].rotation.y = 
                        -Math.atan2(rightElbow.x - rightShoulder.x, rightElbow.z - rightShoulder.z);
                    this.bones['rightshoulder'].rotation.z = 
                        -Math.atan2(rightElbow.y - rightShoulder.y, rightElbow.x - rightShoulder.x) + Math.PI/2;
                }
            }
            
            // Enhanced elbow rotation
            if (this.bones['leftelbow'] || this.bones['leftforearm']) {
                const leftElbow = landmarks[13];
                const leftWrist = landmarks[15];
                if (leftElbow && leftWrist) {
                    const targetBone = this.bones['leftelbow'] || this.bones['leftforearm'];
                    // Calculate angle between upper arm and forearm
                    const angle = Math.atan2(
                        leftWrist.y - leftElbow.y,
                        leftWrist.x - leftElbow.x
                    ) - Math.atan2(
                        leftElbow.y - leftShoulder.y,
                        leftElbow.x - leftShoulder.x
                    );
                    targetBone.rotation.z = angle;
                }
            }
            
            if (this.bones['rightelbow'] || this.bones['rightforearm']) {
                const rightElbow = landmarks[14];
                const rightWrist = landmarks[16];
                if (rightElbow && rightWrist) {
                    const targetBone = this.bones['rightelbow'] || this.bones['rightforearm'];
                    // Calculate angle between upper arm and forearm
                    const angle = Math.atan2(
                        rightWrist.y - rightElbow.y,
                        rightWrist.x - rightElbow.x
                    ) - Math.atan2(
                        rightElbow.y - rightShoulder.y,
                        rightElbow.x - rightShoulder.x
                    );
                    targetBone.rotation.z = -angle;
                }
            }
            
            // Enhanced hip rotation with better leg tracking
            const legRotationScaleFactor = 1.5; // Adjust for better visual results
            
            if (this.bones['leftupleg']) {
                const leftKnee = landmarks[25];
                if (leftHip && leftKnee) {
                    const hipToKnee = {
                        x: leftKnee.x - leftHip.x,
                        y: leftKnee.y - leftHip.y,
                        z: leftKnee.z - leftHip.z
                    };
                    
                    this.bones['leftupleg'].rotation.x = 
                        Math.atan2(hipToKnee.z, hipToKnee.y) * legRotationScaleFactor;
                    this.bones['leftupleg'].rotation.z = 
                        Math.atan2(hipToKnee.x, hipToKnee.y) * legRotationScaleFactor;
                }
            }
            
            if (this.bones['rightupleg']) {
                const rightKnee = landmarks[26];
                if (rightHip && rightKnee) {
                    const hipToKnee = {
                        x: rightKnee.x - rightHip.x,
                        y: rightKnee.y - rightHip.y,
                        z: rightKnee.z - rightHip.z
                    };
                    
                    this.bones['rightupleg'].rotation.x = 
                        Math.atan2(hipToKnee.z, hipToKnee.y) * legRotationScaleFactor;
                    this.bones['rightupleg'].rotation.z = 
                        -Math.atan2(hipToKnee.x, hipToKnee.y) * legRotationScaleFactor;
                }
            }
            
            // Enhanced knee rotation
            if (this.bones['leftleg']) {
                const leftKnee = landmarks[25];
                const leftAnkle = landmarks[27];
                if (leftKnee && leftAnkle) {
                    const kneeAngle = Math.atan2(
                        leftAnkle.y - leftKnee.y,
                        leftAnkle.z - leftKnee.z
                    );
                    this.bones['leftleg'].rotation.x = -Math.abs(kneeAngle) * 2;
                }
            }
            
            if (this.bones['rightleg']) {
                const rightKnee = landmarks[26];
                const rightAnkle = landmarks[28];
                if (rightKnee && rightAnkle) {
                    const kneeAngle = Math.atan2(
                        rightAnkle.y - rightKnee.y,
                        rightAnkle.z - rightKnee.z
                    );
                    this.bones['rightleg'].rotation.x = -Math.abs(kneeAngle) * 2;
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update controls
        this.controls.update();
        
        // Update animations
        if (this.mixer) {
            this.mixer.update(delta);
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BodyTrackingApp();
});