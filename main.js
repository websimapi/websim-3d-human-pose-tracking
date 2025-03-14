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
        this.debugElement = document.getElementById('debug-info');
        this.lastValidLandmarks = null;
        this.trackingTolerance = 0.5; // Tolerance for landmark visibility
        
        // Add skeleton visualization
        this.skeletonHelper = null;
        this.poseVisualization = null;
        
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
        
        // Toggle visibility of skeleton helper using 'S' key
        window.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 's') {
                if (this.skeletonHelper) {
                    this.skeletonHelper.visible = !this.skeletonHelper.visible;
                }
                if (this.poseVisualization) {
                    this.poseVisualization.visible = !this.poseVisualization.visible;
                }
            }
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
            
            // Create canvas overlay for webcam
            const videoContainer = document.getElementById('video-container');
            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.id = 'webcam-overlay';
            overlayCanvas.width = 640;
            overlayCanvas.height = 480;
            overlayCanvas.style.position = 'absolute';
            overlayCanvas.style.top = '0';
            overlayCanvas.style.left = '0';
            overlayCanvas.style.width = '100%';
            overlayCanvas.style.height = '100%';
            overlayCanvas.style.pointerEvents = 'none';
            videoContainer.appendChild(overlayCanvas);
            
            this.webcamOverlayContext = overlayCanvas.getContext('2d');
            
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
                    
                    // Add skeleton helper
                    this.addSkeletonHelper();
                    
                    // Create pose visualization
                    this.createPoseVisualization();
                    
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
            // Create a proper MediaPipe Pose detector
            const pose = new window.Pose({
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
            
            this.poseDetector = pose;
            
            this.poseDetector.onResults((results) => {
                if (results.poseLandmarks) {
                    this.updateDebugInfo('Tracking status: Active');
                    this.lastValidLandmarks = this.processLandmarks(results.poseLandmarks);
                    this.updateModelPose(this.lastValidLandmarks);
                } else {
                    this.updateDebugInfo('Tracking status: No landmarks detected');
                    if (this.lastValidLandmarks) {
                        // Use last known positions with slight decay for natural movement
                        this.updateModelPose(this.lastValidLandmarks);
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing pose detector:', error);
            this.updateDebugInfo('Tracking status: Error initializing pose detector');
            alert('Failed to initialize pose tracking. Please make sure you have a compatible browser and try again.');
        }
    }

    updateDebugInfo(message) {
        if (this.debugElement) {
            this.debugElement.textContent = message;
        }
    }

    processLandmarks(landmarks) {
        // Deep copy the landmarks to avoid reference issues
        const processedLandmarks = JSON.parse(JSON.stringify(landmarks));
        
        // Process landmarks to handle visibility and improve tracking
        for (let i = 0; i < processedLandmarks.length; i++) {
            const landmark = processedLandmarks[i];
            
            // If a landmark has low visibility but we have previous data
            if (landmark.visibility < this.trackingTolerance && this.lastValidLandmarks && this.lastValidLandmarks[i]) {
                // Blend with the last known position for smooth transition
                const blendFactor = 0.85; // How much we rely on previous position
                landmark.x = landmark.x * (1 - blendFactor) + this.lastValidLandmarks[i].x * blendFactor;
                landmark.y = landmark.y * (1 - blendFactor) + this.lastValidLandmarks[i].y * blendFactor;
                landmark.z = landmark.z * (1 - blendFactor) + this.lastValidLandmarks[i].z * blendFactor;
                // Increase visibility artificially for pose calculations
                landmark.visibility = Math.min(this.trackingTolerance, landmark.visibility + 0.2);
            }
        }
        
        return processedLandmarks;
    }

    async startPoseDetection() {
        if (!this.isTracking) return;
        
        const videoElement = document.getElementById('webcam');
        
        try {
            // Correctly process frames with MediaPipe
            await this.poseDetector.send({image: videoElement});
        } catch (error) {
            console.error('Error in pose detection:', error);
            this.updateDebugInfo('Tracking status: Error during detection');
        }
        
        if (this.isTracking) {
            requestAnimationFrame(() => this.startPoseDetection());
        }
    }

    updateModelPose(landmarks) {
        if (!this.skeleton || !landmarks) return;
        
        // Update pose visualization
        this.updatePoseVisualization(landmarks);
        
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
            
            // Update root bone position based on hip center
            if (this.bones['hips']) {
                // Adjust the scaling factor as needed for your model
                const positionScaleFactor = 2;
                this.bones['hips'].position.x = (hipCenter.x - 0.5) * positionScaleFactor;
                // Y is up in Three.js, but MediaPipe y increases downward
                this.bones['hips'].position.y = (0.5 - hipCenter.y) * positionScaleFactor;
                // Add z-axis movement
                this.bones['hips'].position.z = -hipCenter.z * positionScaleFactor;
            }
            
            // Find the correct spine bones
            const possibleSpineBones = [
                ['spine', 'spine1', 'spine2'],
                ['mixamorigspine', 'mixamorigspine1', 'mixamorigspine2'],
                ['spine_01', 'spine_02', 'spine_03']
            ];
            
            let spineBones = [];
            for (const boneSet of possibleSpineBones) {
                if (this.bones[boneSet[0]]) {
                    spineBones = boneSet;
                    break;
                }
            }
            
            // Improved spine and neck rotation with more precise angles
            const spineAngleX = Math.atan2(
                shoulderCenter.z - hipCenter.z,
                shoulderCenter.y - hipCenter.y
            );
            
            const spineAngleZ = Math.atan2(
                shoulderCenter.x - hipCenter.x,
                shoulderCenter.y - hipCenter.y
            );
            
            // Apply more aggressive spine rotation for better visual effect
            spineBones.forEach((boneName, index) => {
                if (this.bones[boneName]) {
                    // Apply progressive rotation up the spine
                    const factor = 1 + (index * 0.2); // Increase rotation as we go up
                    this.bones[boneName].rotation.x = spineAngleX * factor;
                    this.bones[boneName].rotation.z = spineAngleZ * factor;
                }
            });
            
            // Find shoulder bones
            const possibleLeftShoulderBones = ['leftshoulder', 'mixamorigleftshoulder', 'left_shoulder', 'shoulder.l'];
            const possibleRightShoulderBones = ['rightshoulder', 'mixamorigrightshoulder', 'right_shoulder', 'shoulder.r'];
            
            const leftShoulderBone = this.findBone(possibleLeftShoulderBones);
            const rightShoulderBone = this.findBone(possibleRightShoulderBones);
            
            // Enhanced shoulder rotation with broader range of motion
            if (leftShoulderBone && leftShoulder) {
                const leftElbow = landmarks[13];
                if (leftElbow && leftElbow.visibility > 0.3) {
                    // Calculate vectors for better angle calculation
                    const shoulderToElbow = {
                        x: leftElbow.x - leftShoulder.x,
                        y: leftElbow.y - leftShoulder.y,
                        z: leftElbow.z - leftShoulder.z
                    };
                    
                    // Calculate rotation angles with enhanced range
                    const rotationX = Math.atan2(shoulderToElbow.z, shoulderToElbow.y) * 2;
                    const rotationY = Math.atan2(shoulderToElbow.x, shoulderToElbow.z) * 2;
                    const rotationZ = Math.atan2(shoulderToElbow.y, shoulderToElbow.x) * 2 - Math.PI/2;
                    
                    leftShoulderBone.rotation.x = rotationX;
                    leftShoulderBone.rotation.y = rotationY;
                    leftShoulderBone.rotation.z = rotationZ;
                }
            }
            
            if (rightShoulderBone && rightShoulder) {
                const rightElbow = landmarks[14];
                if (rightElbow && rightElbow.visibility > 0.3) {
                    // Calculate vectors for better angle calculation
                    const shoulderToElbow = {
                        x: rightElbow.x - rightShoulder.x,
                        y: rightElbow.y - rightShoulder.y,
                        z: rightElbow.z - rightShoulder.z
                    };
                    
                    // Calculate rotation angles with enhanced range
                    const rotationX = Math.atan2(shoulderToElbow.z, shoulderToElbow.y) * 2;
                    const rotationY = -Math.atan2(shoulderToElbow.x, shoulderToElbow.z) * 2;
                    const rotationZ = -Math.atan2(shoulderToElbow.y, shoulderToElbow.x) * 2 + Math.PI/2;
                    
                    rightShoulderBone.rotation.x = rotationX;
                    rightShoulderBone.rotation.y = rotationY;
                    rightShoulderBone.rotation.z = rotationZ;
                }
            }
            
            // Enhanced elbow rotation with improved bend mechanics
            // Look for possible alternative bone names in the model
            const leftElbowBones = ['leftelbow', 'leftforearm', 'leftarm', 'mixamorigleftarm', 'left_arm', 'arm.l'];
            const rightElbowBones = ['rightelbow', 'rightforearm', 'rightarm', 'mixamorigrightarm', 'right_arm', 'arm.r'];
            
            const leftElbowBone = this.findBone(leftElbowBones);
            const leftElbow = landmarks[13];
            const leftWrist = landmarks[15];
            
            if (leftElbowBone && leftElbow && leftWrist && leftElbow.visibility > 0.3) {
                // Calculate arm bend angle with improved mechanics
                const upperArmVector = {
                    x: leftElbow.x - leftShoulder.x,
                    y: leftElbow.y - leftShoulder.y,
                    z: leftElbow.z - leftShoulder.z
                };
                
                const forearmVector = {
                    x: leftWrist.x - leftElbow.x,
                    y: leftWrist.y - leftElbow.y,
                    z: leftWrist.z - leftElbow.z
                };
                
                // Calculate cross product for rotation axis
                const crossProduct = {
                    x: upperArmVector.y * forearmVector.z - upperArmVector.z * forearmVector.y,
                    y: upperArmVector.z * forearmVector.x - upperArmVector.x * forearmVector.z,
                    z: upperArmVector.x * forearmVector.y - upperArmVector.y * forearmVector.x
                };
                
                // Apply elbow rotation
                leftElbowBone.rotation.z = Math.atan2(
                    forearmVector.y, forearmVector.x
                ) - Math.atan2(
                    upperArmVector.y, upperArmVector.x
                );
                
                // Add some twist based on wrist orientation
                leftElbowBone.rotation.y = Math.atan2(
                    crossProduct.y, 
                    Math.sqrt(crossProduct.x * crossProduct.x + crossProduct.z * crossProduct.z)
                ) * 0.5;
            }
            
            const rightElbowBone = this.findBone(rightElbowBones);
            const rightElbow = landmarks[14];
            const rightWrist = landmarks[16];
            
            if (rightElbowBone && rightElbow && rightWrist && rightElbow.visibility > 0.3) {
                // Calculate arm bend angle with improved mechanics
                const upperArmVector = {
                    x: rightElbow.x - rightShoulder.x,
                    y: rightElbow.y - rightShoulder.y,
                    z: rightElbow.z - rightShoulder.z
                };
                
                const forearmVector = {
                    x: rightWrist.x - rightElbow.x,
                    y: rightWrist.y - rightElbow.y,
                    z: rightWrist.z - rightElbow.z
                };
                
                // Calculate cross product for rotation axis
                const crossProduct = {
                    x: upperArmVector.y * forearmVector.z - upperArmVector.z * forearmVector.y,
                    y: upperArmVector.z * forearmVector.x - upperArmVector.x * forearmVector.z,
                    z: upperArmVector.x * forearmVector.y - upperArmVector.y * forearmVector.x
                };
                
                // Apply elbow rotation
                rightElbowBone.rotation.z = -(Math.atan2(
                    forearmVector.y, forearmVector.x
                ) - Math.atan2(
                    upperArmVector.y, upperArmVector.x
                ));
                
                // Add some twist based on wrist orientation
                rightElbowBone.rotation.y = Math.atan2(
                    crossProduct.y, 
                    Math.sqrt(crossProduct.x * crossProduct.x + crossProduct.z * crossProduct.z)
                ) * 0.5;
            }
            
            // Enhanced hip and leg rotation with more accurate joint angles
            const legRotationScaleFactor = 2.5; // Increased for better visual results
            
            // Find possible leg bone names
            const leftLegBones = ['leftupleg', 'mixamorigleftupleg', 'left_upleg', 'thigh.l'];
            const rightLegBones = ['rightupleg', 'mixamorigrightupleg', 'right_upleg', 'thigh.r'];
            
            const leftUpLegBone = this.findBone(leftLegBones);
            const rightUpLegBone = this.findBone(rightLegBones);
            
            if (leftUpLegBone) {
                const leftKnee = landmarks[25];
                if (leftHip && leftKnee && leftHip.visibility > 0.3) {
                    const hipToKnee = {
                        x: leftKnee.x - leftHip.x,
                        y: leftKnee.y - leftHip.y,
                        z: leftKnee.z - leftHip.z
                    };
                    
                    // Apply comprehensive leg rotation
                    leftUpLegBone.rotation.x = 
                        Math.atan2(hipToKnee.z, hipToKnee.y) * legRotationScaleFactor;
                    leftUpLegBone.rotation.z = 
                        Math.atan2(hipToKnee.x, hipToKnee.y) * legRotationScaleFactor;
                    // Add some hip rotation for better stance
                    leftUpLegBone.rotation.y = 
                        Math.atan2(hipToKnee.x, hipToKnee.z) * legRotationScaleFactor * 0.5;
                }
            }
            
            if (rightUpLegBone) {
                const rightKnee = landmarks[26];
                if (rightHip && rightKnee && rightHip.visibility > 0.3) {
                    const hipToKnee = {
                        x: rightKnee.x - rightHip.x,
                        y: rightKnee.y - rightHip.y,
                        z: rightKnee.z - rightHip.z
                    };
                    
                    // Apply comprehensive leg rotation
                    rightUpLegBone.rotation.x = 
                        Math.atan2(hipToKnee.z, hipToKnee.y) * legRotationScaleFactor;
                    rightUpLegBone.rotation.z = 
                        -Math.atan2(hipToKnee.x, hipToKnee.y) * legRotationScaleFactor;
                    // Add some hip rotation for better stance
                    rightUpLegBone.rotation.y = 
                        -Math.atan2(hipToKnee.x, hipToKnee.z) * legRotationScaleFactor * 0.5;
                }
            }
            
            // Enhanced knee rotation with better bend mechanics
            const kneeRotationFactor = 3.0; // Increased for more visible effect
            
            // Find knee bones
            const leftKneeBones = ['leftleg', 'mixamorigleftleg', 'left_leg', 'shin.l'];
            const rightKneeBones = ['rightleg', 'mixamorigrightleg', 'right_leg', 'shin.r'];
            
            const leftKneeBone = this.findBone(leftKneeBones);
            const rightKneeBone = this.findBone(rightKneeBones);
            
            if (leftKneeBone) {
                const leftKnee = landmarks[25];
                const leftAnkle = landmarks[27];
                if (leftKnee && leftAnkle && leftKnee.visibility > 0.3) {
                    // Calculate knee bend angle
                    const kneeAngle = Math.PI - Math.acos(
                        Math.min(1, Math.max(-1, 
                            Math.cos(Math.atan2(leftAnkle.y - leftKnee.y, leftAnkle.z - leftKnee.z)) *
                            Math.cos(Math.atan2(leftKnee.y - leftHip.y, leftKnee.z - leftHip.z))
                        ))
                    );
                    leftKneeBone.rotation.x = -Math.abs(kneeAngle) * kneeRotationFactor;
                }
            }
            
            if (rightKneeBone) {
                const rightKnee = landmarks[26];
                const rightAnkle = landmarks[28];
                if (rightKnee && rightAnkle && rightKnee.visibility > 0.3) {
                    // Calculate knee bend angle
                    const kneeAngle = Math.PI - Math.acos(
                        Math.min(1, Math.max(-1, 
                            Math.cos(Math.atan2(rightAnkle.y - rightKnee.y, rightAnkle.z - rightKnee.z)) *
                            Math.cos(Math.atan2(rightKnee.y - rightHip.y, rightKnee.z - rightHip.z))
                        ))
                    );
                    rightKneeBone.rotation.x = -Math.abs(kneeAngle) * kneeRotationFactor;
                }
            }
            
            // Head tracking
            const possibleHeadBones = ['head', 'mixamorighead', 'neck', 'mixamorigneck', 'neck1', 'mixamorigneck1'];
            const headBone = this.findBone(possibleHeadBones);
            
            if (headBone) {
                const nose = landmarks[0];
                const leftEye = landmarks[2];
                const rightEye = landmarks[5];
                
                if (nose && leftEye && rightEye && nose.visibility > 0.5) {
                    // Calculate face direction vector
                    const faceCenter = {
                        x: (leftEye.x + rightEye.x) / 2,
                        y: (leftEye.y + rightEye.y) / 2,
                        z: (leftEye.z + rightEye.z) / 2
                    };
                    
                    const faceDirection = {
                        x: nose.x - faceCenter.x,
                        y: nose.y - faceCenter.y,
                        z: nose.z - faceCenter.z
                    };
                    
                    // Apply head rotation
                    headBone.rotation.y = Math.atan2(faceDirection.x, faceDirection.z) * 2;
                    headBone.rotation.x = Math.atan2(faceDirection.y, Math.sqrt(faceDirection.x ** 2 + faceDirection.z ** 2)) * 2;
                }
            }
        }
        
        // Update webcam overlay
        this.updateWebcamOverlay(landmarks);
    }
    
    findBone(boneNames) {
        for (const name of boneNames) {
            if (this.bones[name.toLowerCase()]) {
                return this.bones[name.toLowerCase()];
            }
        }
        return null;
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
            this.updateDebugInfo('Tracking status: Starting...');
            // Create fresh pose visualization when tracking starts
            this.createPoseVisualization();
            this.startPoseDetection();
        } else {
            button.textContent = 'Start Tracking';
            this.updateDebugInfo('Tracking status: Inactive');
        }
    }

    toggleVideo() {
        this.videoVisible = !this.videoVisible;
        const videoContainer = document.getElementById('video-container');
        videoContainer.style.display = this.videoVisible ? 'block' : 'none';
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

    createPoseVisualization() {
        // Remove existing visualization if present
        if (this.poseVisualization) {
            this.scene.remove(this.poseVisualization);
        }
        
        // Create a group to hold all the pose visualization elements
        this.poseVisualization = new THREE.Group();
        this.scene.add(this.poseVisualization);
    }

    updatePoseVisualization(landmarks) {
        if (!landmarks || !this.poseVisualization) return;
        
        // Clear previous visualization
        while (this.poseVisualization.children.length > 0) {
            const object = this.poseVisualization.children[0];
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
            this.poseVisualization.remove(object);
        }
        
        // Define the connections between landmarks for skeleton visualization
        const connections = [
            // Face
            [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
            // Torso
            [11, 12], [11, 23], [12, 24], [23, 24],
            // Arms
            [11, 13], [13, 15], [12, 14], [14, 16],
            // Legs
            [23, 25], [25, 27], [24, 26], [26, 28],
            // Hands (simplified)
            [15, 17], [17, 19], [16, 18], [18, 20],
            // Feet (simplified)
            [27, 31], [28, 32]
        ];
        
        // Scale factor for visualization
        const scaleFactor = 2;
        const positionOffset = new THREE.Vector3(0, 0, 0);
        
        // Create markers for each landmark
        for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            if (landmark.visibility > 0.2) {
                const geometry = new THREE.SphereGeometry(0.025, 16, 16);
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const sphere = new THREE.Mesh(geometry, material);
                
                // Position the sphere (adjust mapping to match Three.js coordinate system)
                sphere.position.x = (landmark.x - 0.5) * scaleFactor + positionOffset.x;
                sphere.position.y = (0.5 - landmark.y) * scaleFactor + positionOffset.y;
                sphere.position.z = -landmark.z * scaleFactor + positionOffset.z;
                
                this.poseVisualization.add(sphere);
            }
        }
        
        // Create lines connecting the landmarks
        for (const [i, j] of connections) {
            if (landmarks[i] && landmarks[j] && 
                landmarks[i].visibility > 0.2 && landmarks[j].visibility > 0.2) {
                
                const geometry = new THREE.BufferGeometry();
                const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
                
                const positionArray = new Float32Array(6);
                // Start point
                positionArray[0] = (landmarks[i].x - 0.5) * scaleFactor + positionOffset.x;
                positionArray[1] = (0.5 - landmarks[i].y) * scaleFactor + positionOffset.y;
                positionArray[2] = -landmarks[i].z * scaleFactor + positionOffset.z;
                // End point
                positionArray[3] = (landmarks[j].x - 0.5) * scaleFactor + positionOffset.x;
                positionArray[4] = (0.5 - landmarks[j].y) * scaleFactor + positionOffset.y;
                positionArray[5] = -landmarks[j].z * scaleFactor + positionOffset.z;
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
                const line = new THREE.Line(geometry, material);
                this.poseVisualization.add(line);
            }
        }
    }

    addSkeletonHelper() {
        if (this.skeleton) {
            if (this.skeletonHelper) this.scene.remove(this.skeletonHelper);
            this.skeletonHelper = new THREE.SkeletonHelper(this.model);
            this.skeletonHelper.visible = true;
            this.scene.add(this.skeletonHelper);
        }
    }

    updateWebcamOverlay(landmarks) {
        if (!landmarks || !this.webcamOverlayContext) return;
        
        const canvas = this.webcamOverlayContext.canvas;
        this.webcamOverlayContext.clearRect(0, 0, canvas.width, canvas.height);
        
        // Define connections for drawing skeleton
        const connections = [
            // Face
            [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
            // Torso
            [11, 12], [11, 23], [12, 24], [23, 24],
            // Arms
            [11, 13], [13, 15], [12, 14], [14, 16],
            // Legs
            [23, 25], [25, 27], [24, 26], [26, 28],
            // Hands (simplified)
            [15, 17], [17, 19], [16, 18], [18, 20],
            // Feet (simplified)
            [27, 31], [28, 32]
        ];
        
        // Draw landmarks
        this.webcamOverlayContext.fillStyle = '#00ff00';
        for (const landmark of landmarks) {
            if (landmark.visibility > 0.2) {
                this.webcamOverlayContext.beginPath();
                this.webcamOverlayContext.arc(
                    landmark.x * canvas.width,
                    landmark.y * canvas.height,
                    4, 0, 2 * Math.PI
                );
                this.webcamOverlayContext.fill();
            }
        }
        
        // Draw connections
        this.webcamOverlayContext.strokeStyle = '#ff0000';
        this.webcamOverlayContext.lineWidth = 2;
        for (const [i, j] of connections) {
            if (landmarks[i] && landmarks[j] && 
                landmarks[i].visibility > 0.2 && landmarks[j].visibility > 0.2) {
                this.webcamOverlayContext.beginPath();
                this.webcamOverlayContext.moveTo(
                    landmarks[i].x * canvas.width,
                    landmarks[i].y * canvas.height
                );
                this.webcamOverlayContext.lineTo(
                    landmarks[j].x * canvas.width,
                    landmarks[j].y * canvas.height
                );
                this.webcamOverlayContext.stroke();
            }
        }
    }

}

// Initialize the application when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BodyTrackingApp();
});