import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pose } from 'mediapipe';

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
        const pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        pose.onResults((results) => {
            if (results.poseLandmarks) {
                this.updateModelPose(results.poseLandmarks);
            }
        });
        
        this.poseDetector = pose;
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
            await this.poseDetector.send({ image: videoElement });
        } catch (error) {
            console.error('Error in pose detection:', error);
        }
        
        if (this.isTracking) {
            requestAnimationFrame(() => this.startPoseDetection());
        }
    }

    updateModelPose(landmarks) {
        if (!this.skeleton || !landmarks) return;
        
        // MediaPipe landmarks to Three.js bone mapping
        // This is a simplified mapping, adjust based on your model's skeleton
        
        // Calculate torso rotation (based on shoulders)
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (leftShoulder && rightShoulder && leftHip && rightHip) {
            // Calculate spine orientation
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
            
            // Map spine bones if they exist
            if (this.bones['spine'] || this.bones['spine1'] || this.bones['spine2']) {
                const spineAngle = Math.atan2(
                    shoulderCenter.z - hipCenter.z,
                    shoulderCenter.y - hipCenter.y
                );
                
                const spineBones = ['spine', 'spine1', 'spine2'].filter(name => this.bones[name]);
                spineBones.forEach(bone => {
                    if (this.bones[bone]) {
                        this.bones[bone].rotation.x = spineAngle - Math.PI/2;
                    }
                });
            }
            
            // Handle shoulder rotation
            if (this.bones['leftshoulder'] && leftShoulder) {
                const leftShoulderAngle = this.calculateJointAngle(leftShoulder, landmarks[13]); // left elbow
                this.bones['leftshoulder'].rotation.z = leftShoulderAngle.z;
                this.bones['leftshoulder'].rotation.y = leftShoulderAngle.y;
            }
            
            if (this.bones['rightshoulder'] && rightShoulder) {
                const rightShoulderAngle = this.calculateJointAngle(rightShoulder, landmarks[14]); // right elbow
                this.bones['rightshoulder'].rotation.z = -rightShoulderAngle.z;
                this.bones['rightshoulder'].rotation.y = -rightShoulderAngle.y;
            }
            
            // Handle elbow rotation
            if (this.bones['leftelbow'] || this.bones['leftforearm']) {
                const leftElbow = landmarks[13];
                const leftWrist = landmarks[15];
                if (leftElbow && leftWrist) {
                    const leftElbowAngle = this.calculateJointAngle(leftElbow, leftWrist);
                    const targetBone = this.bones['leftelbow'] || this.bones['leftforearm'];
                    targetBone.rotation.z = leftElbowAngle.z;
                }
            }
            
            if (this.bones['rightelbow'] || this.bones['rightforearm']) {
                const rightElbow = landmarks[14];
                const rightWrist = landmarks[16];
                if (rightElbow && rightWrist) {
                    const rightElbowAngle = this.calculateJointAngle(rightElbow, rightWrist);
                    const targetBone = this.bones['rightelbow'] || this.bones['rightforearm'];
                    targetBone.rotation.z = -rightElbowAngle.z;
                }
            }
            
            // Handle hip rotation
            if (this.bones['lefthip'] || this.bones['leftupleg']) {
                const leftHipBone = this.bones['lefthip'] || this.bones['leftupleg'];
                const leftKnee = landmarks[25];
                if (leftHip && leftKnee) {
                    const leftHipAngle = this.calculateJointAngle(leftHip, leftKnee);
                    leftHipBone.rotation.x = leftHipAngle.x;
                    leftHipBone.rotation.z = leftHipAngle.z;
                }
            }
            
            if (this.bones['righthip'] || this.bones['rightupleg']) {
                const rightHipBone = this.bones['righthip'] || this.bones['rightupleg'];
                const rightKnee = landmarks[26];
                if (rightHip && rightKnee) {
                    const rightHipAngle = this.calculateJointAngle(rightHip, rightKnee);
                    rightHipBone.rotation.x = rightHipAngle.x;
                    rightHipBone.rotation.z = -rightHipAngle.z;
                }
            }
            
            // Handle knee rotation
            if (this.bones['leftknee'] || this.bones['leftleg']) {
                const leftKnee = landmarks[25];
                const leftAnkle = landmarks[27];
                if (leftKnee && leftAnkle) {
                    const leftKneeAngle = this.calculateJointAngle(leftKnee, leftAnkle);
                    const targetBone = this.bones['leftknee'] || this.bones['leftleg'];
                    targetBone.rotation.x = -Math.abs(leftKneeAngle.x);
                }
            }
            
            if (this.bones['rightknee'] || this.bones['rightleg']) {
                const rightKnee = landmarks[26];
                const rightAnkle = landmarks[28];
                if (rightKnee && rightAnkle) {
                    const rightKneeAngle = this.calculateJointAngle(rightKnee, rightAnkle);
                    const targetBone = this.bones['rightknee'] || this.bones['rightleg'];
                    targetBone.rotation.x = -Math.abs(rightKneeAngle.x);
                }
            }
        }
    }

    calculateJointAngle(joint1, joint2) {
        // Convert MediaPipe coordinates to angles
        // This is a simplified calculation, adjust as needed for your model
        const deltaX = joint2.x - joint1.x;
        const deltaY = joint2.y - joint1.y;
        const deltaZ = joint2.z - joint1.z;
        
        return {
            x: Math.atan2(deltaY, deltaZ),
            y: Math.atan2(deltaX, deltaZ),
            z: Math.atan2(deltaY, deltaX)
        };
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

