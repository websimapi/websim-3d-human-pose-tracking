import * as THREE from 'three';
import { SkeletonHelper } from 'three/addons/helpers/SkeletonHelper.js';

/**
 * Handles the 3D model and all its animations, poses, and bone manipulations
 */
export class ModelController {
    constructor(model, logger) {
        this.model = model;
        this.logger = logger;
        this.mixer = new THREE.AnimationMixer(model);
        this.clock = new THREE.Clock();
        this.animations = {};
        this.currentAction = null;
        
        // Bone mapping cache
        this.bones = {};
        this.boneNames = {};
        this.skeleton = null;
        
        // Debug visualization
        this.skeletonHelper = null;
        this.axesHelpers = [];
        
        // Smooth rotation transitions
        this.rotationHistory = {
            head: [],
            leftArm: [],
            rightArm: [],
            torso: [],
            leftLeg: [],
            rightLeg: [],
            leftHand: [],
            rightHand: []
        };
        
        // Smoothing settings
        this.smoothing = {
            enabled: true,
            positionFactor: 0.5,
            rotationFactor: 0.5,
            historyLength: 10
        };
        
        // Calibration settings
        this.calibration = null;
        
        // Initialize
        this.findSkeleton();
        this.mapStandardBones();
        this.setupSkeletonHelper();
    }
    
    findSkeleton() {
        this.skeleton = null;
        
        this.model.traverse((object) => {
            if (object.isSkinnedMesh && !this.skeleton) {
                this.skeleton = object.skeleton;
            }
        });
        
        if (!this.skeleton) {
            this.logger.error('No skeleton found in the model');
        } else {
            this.logger.info(`Found skeleton with ${this.skeleton.bones.length} bones`);
        }
    }
    
    mapStandardBones() {
        if (!this.skeleton) return;
        
        // Clear previous mappings
        this.bones = {};
        this.boneNames = {};
        
        // Common bone name patterns
        const bonePatterns = {
            hips: ['hips', 'hip', 'pelvis', 'mixamorighips'],
            spine: ['spine', 'spine1', 'spine2', 'spine_01', 'spine_02', 'spine_03', 'mixamorigspine', 'mixamorigspine1', 'mixamorigspine2'],
            neck: ['neck', 'mixamorigneck'],
            head: ['head', 'mixamorighead'],
            leftShoulder: ['leftshoulder', 'mixamorigleftshoulder', 'left_shoulder', 'shoulder.l'],
            rightShoulder: ['rightshoulder', 'mixamorigrightshoulder', 'right_shoulder', 'shoulder.r'],
            leftArm: ['leftarm', 'mixamorigleftarm', 'left_arm', 'arm.l'],
            rightArm: ['rightarm', 'mixamorigrightarm', 'right_arm', 'arm.r'],
            leftForeArm: ['leftforearm', 'mixamorigleftforearm', 'left_forearm', 'forearm.l'],
            rightForeArm: ['rightforearm', 'mixamorigrightforearm', 'right_forearm', 'forearm.r'],
            leftHand: ['lefthand', 'mixamoriglefthand', 'left_hand', 'hand.l'],
            rightHand: ['righthand', 'mixamorigrighthand', 'right_hand', 'hand.r'],
            leftUpLeg: ['leftupleg', 'mixamorigleftupleg', 'left_upleg', 'thigh.l'],
            rightUpLeg: ['rightupleg', 'mixamorigrightupleg', 'right_upleg', 'thigh.r'],
            leftLeg: ['leftleg', 'mixamorigleftleg', 'left_leg', 'shin.l'],
            rightLeg: ['rightleg', 'mixamorigrightleg', 'right_leg', 'shin.r'],
            leftFoot: ['leftfoot', 'mixamorigleftfoot', 'left_foot', 'foot.l'],
            rightFoot: ['rightfoot', 'mixamorigrightfoot', 'right_foot', 'foot.r'],
            // Finger bones
            leftHandThumb1: ['lefthandthumb1', 'mixamoriglefthandthumb1', 'thumb1_l', 'thumb.01.l'],
            leftHandThumb2: ['lefthandthumb2', 'mixamoriglefthandthumb2', 'thumb2_l', 'thumb.02.l'],
            leftHandThumb3: ['lefthandthumb3', 'mixamoriglefthandthumb3', 'thumb3_l', 'thumb.03.l'],
            leftHandIndex1: ['lefthandindex1', 'mixamoriglefthandindex1', 'index1_l', 'f_index.01.l'],
            leftHandIndex2: ['lefthandindex2', 'mixamoriglefthandindex2', 'index2_l', 'f_index.02.l'],
            leftHandIndex3: ['lefthandindex3', 'mixamoriglefthandindex3', 'index3_l', 'f_index.03.l'],
            leftHandMiddle1: ['lefthandmiddle1', 'mixamoriglefthandmiddle1', 'middle1_l', 'f_middle.01.l'],
            leftHandMiddle2: ['lefthandmiddle2', 'mixamoriglefthandmiddle2', 'middle2_l', 'f_middle.02.l'],
            leftHandMiddle3: ['lefthandmiddle3', 'mixamoriglefthandmiddle3', 'middle3_l', 'f_middle.03.l'],
            leftHandRing1: ['lefthandring1', 'mixamoriglefthandring1', 'ring1_l', 'f_ring.01.l'],
            leftHandRing2: ['lefthandring2', 'mixamoriglefthandring2', 'ring2_l', 'f_ring.02.l'],
            leftHandRing3: ['lefthandring3', 'mixamoriglefthandring3', 'ring3_l', 'f_ring.03.l'],
            leftHandPinky1: ['lefthandpinky1', 'mixamoriglefthandpinky1', 'pinky1_l', 'f_pinky.01.l'],
            leftHandPinky2: ['lefthandpinky2', 'mixamoriglefthandpinky2', 'pinky2_l', 'f_pinky.02.l'],
            leftHandPinky3: ['lefthandpinky3', 'mixamoriglefthandpinky3', 'pinky3_l', 'f_pinky.03.l'],
            rightHandThumb1: ['righthandthumb1', 'mixamorigrighthandthumb1', 'thumb1_r', 'thumb.01.r'],
            rightHandThumb2: ['righthandthumb2', 'mixamorigrighthandthumb2', 'thumb2_r', 'thumb.02.r'],
            rightHandThumb3: ['righthandthumb3', 'mixamorigrighthandthumb3', 'thumb3_r', 'thumb.03.r'],
            rightHandIndex1: ['righthandindex1', 'mixamorigrighthandindex1', 'index1_r', 'f_index.01.r'],
            rightHandIndex2: ['righthandindex2', 'mixamorigrighthandindex2', 'index2_r', 'f_index.02.r'],
            rightHandIndex3: ['righthandindex3', 'mixamorigrighthandindex3', 'index3_r', 'f_index.03.r'],
            rightHandMiddle1: ['righthandmiddle1', 'mixamorigrighthandmiddle1', 'middle1_r', 'f_middle.01.r'],
            rightHandMiddle2: ['righthandmiddle2', 'mixamorigrighthandmiddle2', 'middle2_r', 'f_middle.02.r'],
            rightHandMiddle3: ['righthandmiddle3', 'mixamorigrighthandmiddle3', 'middle3_r', 'f_middle.03.r'],
            rightHandRing1: ['righthandring1', 'mixamorigrighthandring1', 'ring1_r', 'f_ring.01.r'],
            rightHandRing2: ['righthandring2', 'mixamorigrighthandring2', 'ring2_r', 'f_ring.02.r'],
            rightHandRing3: ['righthandring3', 'mixamorigrighthandring3', 'ring3_r', 'f_ring.03.r'],
            rightHandPinky1: ['righthandpinky1', 'mixamorigrighthandpinky1', 'pinky1_r', 'f_pinky.01.r'],
            rightHandPinky2: ['righthandpinky2', 'mixamorigrighthandpinky2', 'pinky2_r', 'f_pinky.02.r'],
            rightHandPinky3: ['righthandpinky3', 'mixamorigrighthandpinky3', 'pinky3_r', 'f_pinky.03.r']
        };
        
        // Map bones by checking patterns
        this.skeleton.bones.forEach(bone => {
            const lowerName = bone.name.toLowerCase();
            
            // Store bone by its original name
            this.bones[lowerName] = bone;
            
            // Try to match with standard bone names
            for (const [key, patterns] of Object.entries(bonePatterns)) {
                if (patterns.some(pattern => lowerName.includes(pattern))) {
                    this.boneNames[key] = lowerName;
                    break;
                }
            }
        });
        
        // Log found and missing bones
        const foundBones = Object.keys(this.boneNames);
        const missingBones = Object.keys(bonePatterns).filter(key => !this.boneNames[key]);
        
        this.logger.info(`Mapped ${foundBones.length} bones to standard names`);
        if (missingBones.length > 0) {
            this.logger.warn(`Missing bone mappings: ${missingBones.join(', ')}`);
        }
    }
    
    setupAnimations(animationClips) {
        if (!animationClips || animationClips.length === 0) {
            this.logger.warn('No animation clips provided');
            return;
        }
        
        this.logger.info(`Setting up ${animationClips.length} animation clips`);
        
        animationClips.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = {
                clip: clip,
                action: action
            };
        });
        
        // Set up default animation
        if (this.animations['idle'] || this.animations['Idle']) {
            const idleClip = this.animations['idle'] || this.animations['Idle'];
            this.playAnimation(idleClip.clip.name);
        }
    }
    
    playAnimation(name, fadeTime = 0.5) {
        if (!this.animations[name]) {
            this.logger.warn(`Animation not found: ${name}`);
            return false;
        }
        
        const action = this.animations[name].action;
        
        if (this.currentAction) {
            this.currentAction.fadeOut(fadeTime);
        }
        
        action.reset()
             .setEffectiveTimeScale(1)
             .setEffectiveWeight(1)
             .fadeIn(fadeTime)
             .play();
        
        this.currentAction = action;
        this.logger.info(`Playing animation: ${name}`);
        return true;
    }
    
    stopAllAnimations() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.currentAction = null;
        }
    }
    
    update(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }
    
    getBone(standardName) {
        const boneName = this.boneNames[standardName];
        return boneName ? this.bones[boneName] : null;
    }
    
    setupSkeletonHelper() {
        if (this.model && this.skeleton) {
            this.skeletonHelper = new SkeletonHelper(this.model);
            this.skeletonHelper.visible = false;
            this.model.parent?.add(this.skeletonHelper);
        }
    }
    
    toggleSkeletonHelper() {
        if (this.skeletonHelper) {
            this.skeletonHelper.visible = !this.skeletonHelper.visible;
            this.logger.info(`Skeleton helper ${this.skeletonHelper.visible ? 'shown' : 'hidden'}`);
        }
    }
    
    showAxesHelpers(show = true) {
        // Remove existing helpers
        this.axesHelpers.forEach(helper => {
            this.model.remove(helper);
        });
        this.axesHelpers = [];
        
        if (!show || !this.skeleton) return;
        
        // Add new helpers to key bones
        const keyBones = [
            'head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot',
            'hips', 'leftShoulder', 'rightShoulder'
        ];
        
        keyBones.forEach(boneName => {
            const bone = this.getBone(boneName);
            if (bone) {
                const helper = new THREE.AxesHelper(0.1);
                bone.add(helper);
                this.axesHelpers.push(helper);
            }
        });
        
        this.logger.info(`Axes helpers ${show ? 'shown' : 'hidden'}`);
    }
    
    resetToTPose() {
        if (!this.skeleton) return;
        
        // Stop any running animations
        this.stopAllAnimations();
        
        // Reset all bone rotations to identity
        this.skeleton.bones.forEach(bone => {
            bone.rotation.set(0, 0, 0);
        });
        
        // Clear rotation history
        Object.keys(this.rotationHistory).forEach(key => {
            this.rotationHistory[key] = [];
        });
        
        this.logger.info('Model reset to T-pose');
    }
    
    setCalibration(calibration) {
        this.calibration = calibration;
        
        // Update smoothing from calibration
        if (calibration.global) {
            this.smoothing.positionFactor = calibration.global.positionSmoothing;
            this.smoothing.rotationFactor = calibration.global.rotationSmoothing;
        }
    }
    
    updateFromPoseLandmarks(landmarks, trackingToggles) {
        if (!this.skeleton || !landmarks) return;
        
        // Extract head tracking
        if (trackingToggles.head) {
            this.updateHead(landmarks);
        }
        
        // Extract torso tracking
        if (trackingToggles.torso) {
            this.updateTorso(landmarks);
        }
        
        // Extract arm tracking
        if (trackingToggles.arms) {
            this.updateArms(landmarks);
        }
        
        // Extract leg tracking
        if (trackingToggles.legs) {
            this.updateLegs(landmarks);
        }
    }
    
    updateFromHandLandmarks(landmarks, handedness) {
        if (!this.skeleton || !landmarks || !landmarks.length) return;
        
        const isLeft = handedness === 'left';
        const prefix = isLeft ? 'left' : 'right';
        
        // Find wrist and hand bone
        const handBone = this.getBone(`${prefix}Hand`);
        
        if (!handBone) return;
        
        // Map landmarks to finger rotations and positions
        this.updateHandFingers(landmarks, handedness);
    }
    
    updateHead(landmarks) {
        const headBone = this.getBone('head');
        const neckBone = this.getBone('neck');
        
        if (!headBone) return;
        
        // Get relevant landmarks for head tracking
        const nose = landmarks[0];
        const leftEye = landmarks[2];
        const rightEye = landmarks[5];
        const leftEar = landmarks[7];
        const rightEar = landmarks[8];
        
        if (nose && leftEye && rightEye && nose.visibility > 0.5) {
            // Calculate face center and direction vector
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
            
            // Calculate ear-to-ear vector for roll
            let rollVector = { x: 0, y: 0, z: 0 };
            if (leftEar && rightEar && leftEar.visibility > 0.5 && rightEar.visibility > 0.5) {
                rollVector = {
                    x: rightEar.x - leftEar.x,
                    y: rightEar.y - leftEar.y,
                    z: rightEar.z - leftEar.z
                };
            }
            
            // Calculate head rotations with constraints to prevent 360° flips
            // Y axis - looking left/right
            let rotY = Math.atan2(faceDirection.x, faceDirection.z) * 2;
            rotY = Math.max(Math.min(rotY, Math.PI/2), -Math.PI/2);
            
            // X axis - looking up/down
            const headTiltCalibration = this.calibration?.head?.rotationOffset?.x || -3.0;
            let rotX = (Math.atan2(faceDirection.y, Math.sqrt(faceDirection.x**2 + faceDirection.z**2)) * 2) + headTiltCalibration;
            rotX = Math.max(Math.min(rotX, Math.PI/3), -Math.PI/3);
            
            // Z axis - head tilt (roll)
            let rotZ = Math.atan2(rollVector.y, rollVector.x);
            rotZ = Math.max(Math.min(rotZ, Math.PI/6), -Math.PI/6);
            
            // Apply calibration offsets
            if (this.calibration?.head?.rotationOffset) {
                rotY += this.calibration.head.rotationOffset.y;
                rotZ += this.calibration.head.rotationOffset.z;
            }
            
            // Apply scale factors
            if (this.calibration?.head?.scaleFactor) {
                rotX *= this.calibration.head.scaleFactor.x;
                rotY *= this.calibration.head.scaleFactor.y;
                rotZ *= this.calibration.head.scaleFactor.z;
            }
            
            // Apply smoothing
            const rotation = this.smoothRotation(
                { x: rotX, y: rotY, z: rotZ },
                'head',
                this.smoothing.rotationFactor
            );
            
            // Apply rotation to head bone
            headBone.rotation.x = rotation.x;
            headBone.rotation.y = rotation.y;
            headBone.rotation.z = rotation.z;
            
            // Apply slight rotation to neck if available
            if (neckBone) {
                neckBone.rotation.x = rotation.x * 0.5;
                neckBone.rotation.y = rotation.y * 0.5;
                neckBone.rotation.z = rotation.z * 0.5;
            }
        }
    }
    
    updateTorso(landmarks) {
        const hipsBone = this.getBone('hips');
        const spineBones = ['spine', 'spine1', 'spine2'].map(name => this.getBone(name)).filter(Boolean);
        
        if (!hipsBone || spineBones.length === 0) return;
        
        // Get torso landmarks
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (leftShoulder && rightShoulder && leftHip && rightHip &&
            leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5 &&
            leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
            
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
            
            // Calculate torso direction
            const torsoDirection = {
                x: shoulderCenter.x - hipCenter.x,
                y: shoulderCenter.y - hipCenter.y,
                z: shoulderCenter.z - hipCenter.z
            };
            
            // Calculate hip width vector for roll
            const hipWidth = {
                x: rightHip.x - leftHip.x,
                y: rightHip.y - leftHip.y,
                z: rightHip.z - leftHip.z
            };
            
            // Calculate torso rotation
            const spineAngleX = Math.atan2(torsoDirection.z, torsoDirection.y);
            const spineAngleZ = Math.atan2(torsoDirection.x, torsoDirection.y);
            const spineAngleY = Math.atan2(hipWidth.z, hipWidth.x);
            
            // Apply calibration adjustments
            let rotX = spineAngleX;
            let rotY = spineAngleY;
            let rotZ = spineAngleZ;
            
            if (this.calibration?.torso?.rotationOffset) {
                rotX += this.calibration.torso.rotationOffset.x;
                rotY += this.calibration.torso.rotationOffset.y;
                rotZ += this.calibration.torso.rotationOffset.z;
            }
            
            // Apply scale factors
            if (this.calibration?.torso?.scaleFactor) {
                rotX *= this.calibration.torso.scaleFactor.x;
                rotY *= this.calibration.torso.scaleFactor.y;
                rotZ *= this.calibration.torso.scaleFactor.z;
            }
            
            // Apply smoothing
            const rotation = this.smoothRotation(
                { x: rotX, y: rotY, z: rotZ },
                'torso',
                this.smoothing.rotationFactor
            );
            
            // Update hips position
            const positionScaleFactor = 2;
            const hipsPosX = (hipCenter.x - 0.5) * positionScaleFactor;
            const hipsPosY = (0.5 - hipCenter.y) * positionScaleFactor;
            const hipsPosZ = -hipCenter.z * positionScaleFactor;
            
            // Apply calibration to position
            let posX = hipsPosX;
            let posY = hipsPosY;
            let posZ = hipsPosZ;
            
            if (this.calibration?.torso?.positionOffset) {
                posX += this.calibration.torso.positionOffset.x;
                posY += this.calibration.torso.positionOffset.y;
                posZ += this.calibration.torso.positionOffset.z;
            }
            
            // Apply position smoothing
            const smoothPos = this.smoothPosition(
                { x: posX, y: posY, z: posZ },
                'torso',
                this.smoothing.positionFactor
            );
            
            // Apply to hips
            hipsBone.position.x = smoothPos.x;
            hipsBone.position.y = smoothPos.y;
            hipsBone.position.z = smoothPos.z;
            
            // Apply progressive rotation up the spine
            spineBones.forEach((bone, index) => {
                const factor = 1 + (index * 0.2); // Increase rotation as we go up
                bone.rotation.x = rotation.x * factor;
                bone.rotation.y = rotation.y * factor;
                bone.rotation.z = rotation.z * factor;
            });
        }
    }
    
    updateArms(landmarks) {
        // Update left arm
        this.updateArm(landmarks, 'left');
        
        // Update right arm
        this.updateArm(landmarks, 'right');
    }
    
    updateArm(landmarks, side) {
        const isLeft = side === 'left';
        const prefix = isLeft ? 'left' : 'right';
        
        // Get arm bones
        const shoulderBone = this.getBone(`${prefix}Shoulder`);
        const armBone = this.getBone(`${prefix}Arm`);
        const forearmBone = this.getBone(`${prefix}ForeArm`);
        
        if (!shoulderBone || !armBone || !forearmBone) return;
        
        // Get arm landmarks
        const shoulderLm = landmarks[isLeft ? 11 : 12];
        const elbowLm = landmarks[isLeft ? 13 : 14];
        const wristLm = landmarks[isLeft ? 15 : 16];
        
        if (shoulderLm && elbowLm && wristLm &&
            shoulderLm.visibility > 0.5 && elbowLm.visibility > 0.5 && wristLm.visibility > 0.5) {
            
            // Calculate arm vectors
            const upperArmVector = {
                x: elbowLm.x - shoulderLm.x,
                y: elbowLm.y - shoulderLm.y,
                z: elbowLm.z - shoulderLm.z
            };
            
            const forearmVector = {
                x: wristLm.x - elbowLm.x,
                y: wristLm.y - elbowLm.y,
                z: wristLm.z - elbowLm.z
            };
            
            // Calculate cross product for rotation axis
            const crossProduct = {
                x: upperArmVector.y * forearmVector.z - upperArmVector.z * forearmVector.y,
                y: upperArmVector.z * forearmVector.x - upperArmVector.x * forearmVector.z,
                z: upperArmVector.x * forearmVector.y - upperArmVector.y * forearmVector.x
            };
            
            // Calculate shoulder rotation
            let shoulderRotX = Math.atan2(upperArmVector.z, upperArmVector.y) * 2;
            let shoulderRotY = (isLeft ? 1 : -1) * Math.atan2(upperArmVector.x, upperArmVector.z) * 2;
            let shoulderRotZ = (isLeft ? 1 : -1) * Math.atan2(upperArmVector.y, upperArmVector.x) * 2 + (isLeft ? -Math.PI/2 : Math.PI/2);
            
            // Apply calibration
            const calibKey = isLeft ? 'leftArm' : 'rightArm';
            if (this.calibration?.[calibKey]?.rotationOffset) {
                shoulderRotX += this.calibration[calibKey].rotationOffset.x;
                shoulderRotY += this.calibration[calibKey].rotationOffset.y;
                shoulderRotZ += this.calibration[calibKey].rotationOffset.z;
            }
            
            // Apply scale factors
            if (this.calibration?.[calibKey]?.scaleFactor) {
                shoulderRotX *= this.calibration[calibKey].scaleFactor.x;
                shoulderRotY *= this.calibration[calibKey].scaleFactor.y;
                shoulderRotZ *= this.calibration[calibKey].scaleFactor.z;
            }
            
            // Apply smoothing
            const shoulderRot = this.smoothRotation(
                { x: shoulderRotX, y: shoulderRotY, z: shoulderRotZ },
                `${prefix}Arm`,
                this.smoothing.rotationFactor
            );
            
            // Apply shoulder rotation
            shoulderBone.rotation.x = shoulderRot.x;
            shoulderBone.rotation.y = shoulderRot.y;
            shoulderBone.rotation.z = shoulderRot.z;
            
            // Calculate elbow rotation (mainly bend angle)
            const elbowAngle = Math.PI - Math.acos(
                Math.min(1, Math.max(-1, 
                    (upperArmVector.x * forearmVector.x + 
                     upperArmVector.y * forearmVector.y + 
                     upperArmVector.z * forearmVector.z) /
                    (Math.sqrt(upperArmVector.x**2 + upperArmVector.y**2 + upperArmVector.z**2) * 
                     Math.sqrt(forearmVector.x**2 + forearmVector.y**2 + forearmVector.z**2))
                ))
            );
            
            // Apply elbow rotation
            forearmBone.rotation.z = (isLeft ? 1 : -1) * elbowAngle;
            
            // Add some twist based on wrist orientation
            forearmBone.rotation.y = Math.atan2(
                crossProduct.y,
                Math.sqrt(crossProduct.x**2 + crossProduct.z**2)
            ) * 0.5;
        }
    }
    
    updateLegs(landmarks) {
        // Update left leg
        this.updateLeg(landmarks, 'left');
        
        // Update right leg
        this.updateLeg(landmarks, 'right');
    }
    
    updateLeg(landmarks, side) {
        const isLeft = side === 'left';
        const prefix = isLeft ? 'left' : 'right';
        
        // Get leg bones
        const upLegBone = this.getBone(`${prefix}UpLeg`);
        const legBone = this.getBone(`${prefix}Leg`);
        const footBone = this.getBone(`${prefix}Foot`);
        
        if (!upLegBone || !legBone) return;
        
        // Get leg landmarks
        const hipLm = landmarks[isLeft ? 23 : 24];
        const kneeLm = landmarks[isLeft ? 25 : 26];
        const ankleLm = landmarks[isLeft ? 27 : 28];
        
        if (hipLm && kneeLm && ankleLm &&
            hipLm.visibility > 0.5 && kneeLm.visibility > 0.5 && ankleLm.visibility > 0.5) {
            
            // Calculate leg vectors
            const thighVector = {
                x: kneeLm.x - hipLm.x,
                y: kneeLm.y - hipLm.y,
                z: kneeLm.z - hipLm.z
            };
            
            const calfVector = {
                x: ankleLm.x - kneeLm.x,
                y: ankleLm.y - kneeLm.y,
                z: ankleLm.z - kneeLm.z
            };
            
            // Calculate hip rotation
            const legRotationScaleFactor = 2.5;
            let hipRotX = Math.atan2(thighVector.z, thighVector.y) * legRotationScaleFactor;
            let hipRotZ = (isLeft ? 1 : -1) * Math.atan2(thighVector.x, thighVector.y) * legRotationScaleFactor;
            let hipRotY = (isLeft ? 1 : -1) * Math.atan2(thighVector.x, thighVector.z) * legRotationScaleFactor * 0.5;
            
            // Apply calibration
            const calibKey = isLeft ? 'leftLeg' : 'rightLeg';
            if (this.calibration?.[calibKey]?.rotationOffset) {
                hipRotX += this.calibration[calibKey].rotationOffset.x;
                hipRotY += this.calibration[calibKey].rotationOffset.y;
                hipRotZ += this.calibration[calibKey].rotationOffset.z;
            }
            
            // Apply scale factors
            if (this.calibration?.[calibKey]?.scaleFactor) {
                hipRotX *= this.calibration[calibKey].scaleFactor.x;
                hipRotY *= this.calibration[calibKey].scaleFactor.y;
                hipRotZ *= this.calibration[calibKey].scaleFactor.z;
            }
            
            // Apply smoothing
            const hipRot = this.smoothRotation(
                { x: hipRotX, y: hipRotY, z: hipRotZ },
                `${prefix}Leg`,
                this.smoothing.rotationFactor
            );
            
            // Apply hip rotation
            upLegBone.rotation.x = hipRot.x;
            upLegBone.rotation.y = hipRot.y;
            upLegBone.rotation.z = hipRot.z;
            
            // Calculate knee bend angle
            const kneeAngle = Math.PI - Math.acos(
                Math.min(1, Math.max(-1, 
                    (thighVector.x * calfVector.x + 
                     thighVector.y * calfVector.y + 
                     thighVector.z * calfVector.z) /
                    (Math.sqrt(thighVector.x**2 + thighVector.y**2 + thighVector.z**2) * 
                     Math.sqrt(calfVector.x**2 + calfVector.y**2 + calfVector.z**2))
                ))
            );
            
            // Apply knee rotation
            const kneeRotationFactor = 3.0;
            legBone.rotation.x = -Math.abs(kneeAngle) * kneeRotationFactor;
            
            // Set foot angle if foot bone exists
            if (footBone && ankleLm) {
                const footLm = landmarks[isLeft ? 31 : 32]; // Foot index
                if (footLm && footLm.visibility > 0.5) {
                    const footVector = {
                        x: footLm.x - ankleLm.x,
                        y: footLm.y - ankleLm.y,
                        z: footLm.z - ankleLm.z
                    };
                    
                    // Calculate foot angles
                    const footAngleX = Math.atan2(footVector.z, footVector.y);
                    
                    // Apply foot rotation
                    footBone.rotation.x = footAngleX;
                }
            }
        }
    }
    
    updateHandFingers(landmarks, handedness) {
        const isLeft = handedness === 'left';
        const prefix = isLeft ? 'left' : 'right';
        
        // Map from MediaPipe hand landmarks to finger bone indices
        const fingerBones = {
            thumb: [
                `${prefix}HandThumb1`,
                `${prefix}HandThumb2`,
                `${prefix}HandThumb3`
            ],
            index: [
                `${prefix}HandIndex1`,
                `${prefix}HandIndex2`,
                `${prefix}HandIndex3`
            ],
            middle: [
                `${prefix}HandMiddle1`,
                `${prefix}HandMiddle2`,
                `${prefix}HandMiddle3`
            ],
            ring: [
                `${prefix}HandRing1`,
                `${prefix}HandRing2`,
                `${prefix}HandRing3`
            ],
            pinky: [
                `${prefix}HandPinky1`,
                `${prefix}HandPinky2`,
                `${prefix}HandPinky3`
            ]
        };
        
        // Map MediaPipe landmarks to finger joints
        const fingerLandmarkSets = {
            // Landmark indices for MediaPipe hand model
            thumb: isLeft ? [1, 2, 3, 4] : [1, 2, 3, 4],
            index: isLeft ? [5, 6, 7, 8] : [5, 6, 7, 8],
            middle: isLeft ? [9, 10, 11, 12] : [9, 10, 11, 12],
            ring: isLeft ? [13, 14, 15, 16] : [13, 14, 15, 16],
            pinky: isLeft ? [17, 18, 19, 20] : [17, 18, 19, 20]
        };
        
        // Update each finger
        Object.keys(fingerBones).forEach(finger => {
            const bones = fingerBones[finger].map(name => this.getBone(name)).filter(Boolean);
            const lms = fingerLandmarkSets[finger].map(idx => landmarks[idx]).filter(Boolean);
            
            if (bones.length === 0 || lms.length < 2) return;
            
            // Calculate bend angles between segments
            for (let i = 0; i < bones.length && i + 1 < lms.length; i++) {
                const bone = bones[i];
                
                // Calculate vectors between landmarks
                const v1 = {
                    x: lms[i].x - lms[i+1].x,
                    y: lms[i].y - lms[i+1].y,
                    z: lms[i].z - lms[i+1].z
                };
                
                const v2 = {
                    x: lms[i+1].x - (lms[i+2] ? lms[i+2].x : lms[i+1].x),
                    y: lms[i+1].y - (lms[i+2] ? lms[i+2].y : lms[i+1].y),
                    z: lms[i+1].z - (lms[i+2] ? lms[i+2].z : lms[i+1].z)
                };
                
                // Calculate bend angle
                const cosAngle = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / 
                               (Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2) * 
                                Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2));
                
                const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
                
                // Apply finger rotations based on finger type
                if (finger === 'thumb') {
                    // Thumb has unique rotation patterns
                    if (i === 0) {
                        // Base joint (CMC)
                        bone.rotation.z = (isLeft ? -1 : 1) * angle * 1.5;
                        bone.rotation.x = angle * 0.5;
                    } else {
                        // Other thumb joints
                        bone.rotation.z = (isLeft ? -1 : 1) * angle;
                    }
                } else {
                    // Fingers flex primarily around z-axis
                    bone.rotation.z = (isLeft ? -1 : 1) * angle * (i === 0 ? 1.2 : 1.5);
                    
                    // Add slight sideways tilt based on finger
                    if (i === 0) {
                        // Angle fingers slightly away from middle finger
                        const sideAngle = (finger === 'pinky' || finger === 'ring') ? 0.15 : 
                                         (finger === 'index') ? -0.15 : 0;
                        bone.rotation.y = (isLeft ? -1 : 1) * sideAngle;
                    }
                }
            }
        });
        
        // Apply calibration
        const calibKey = isLeft ? 'leftHand' : 'rightHand';
        const handBone = this.getBone(`${prefix}Hand`);
        
        if (handBone && this.calibration?.[calibKey]) {
            if (this.calibration[calibKey].rotationOffset) {
                handBone.rotation.x += this.calibration[calibKey].rotationOffset.x;
                handBone.rotation.y += this.calibration[calibKey].rotationOffset.y;
                handBone.rotation.z += this.calibration[calibKey].rotationOffset.z;
            }
        }
    }
    
    smoothRotation(rotation, bodyPart, factor) {
        if (!this.smoothing.enabled) return rotation;
        
        // Add to history
        this.rotationHistory[bodyPart].push(rotation);
        if (this.rotationHistory[bodyPart].length > this.smoothing.historyLength) {
            this.rotationHistory[bodyPart].shift();
        }
        
        // If no history, return original rotation
        if (this.rotationHistory[bodyPart].length <= 1) return rotation;
        
        // Apply exponential moving average
        const result = { x: 0, y: 0, z: 0 };
        let totalWeight = 0;
        
        for (let i = 0; i < this.rotationHistory[bodyPart].length; i++) {
            const weight = Math.pow(factor, this.rotationHistory[bodyPart].length - i - 1);
            totalWeight += weight;
            
            result.x += this.rotationHistory[bodyPart][i].x * weight;
            result.y += this.rotationHistory[bodyPart][i].y * weight;
            result.z += this.rotationHistory[bodyPart][i].z * weight;
        }
        
        result.x /= totalWeight;
        result.y /= totalWeight;
        result.z /= totalWeight;
        
        return result;
    }
    
    smoothPosition(position, bodyPart, factor) {
        if (!this.smoothing.enabled) return position;
        
        // We'll reuse the same history mechanism for simplicity
        // In a more complex implementation, we might want separate position history
        const key = `${bodyPart}Pos`;
        
        if (!this.rotationHistory[key]) {
            this.rotationHistory[key] = [];
        }
        
        // Add to history
        this.rotationHistory[key].push(position);
        if (this.rotationHistory[key].length > this.smoothing.historyLength) {
            this.rotationHistory[key].shift();
        }
        
        // If no history, return original position
        if (this.rotationHistory[key].length <= 1) return position;
        
        // Apply exponential moving average
        const result = { x: 0, y: 0, z: 0 };
        let totalWeight = 0;
        
        for (let i = 0; i < this.rotationHistory[key].length; i++) {
            const weight = Math.pow(factor, this.rotationHistory[key].length - i - 1);
            totalWeight += weight;
            
            result.x += this.rotationHistory[key][i].x * weight;
            result.y += this.rotationHistory[key][i].y * weight;
            result.z += this.rotationHistory[key][i].z * weight;
        }
        
        result.x /= totalWeight;
        result.y /= totalWeight;
        result.z /= totalWeight;
        
        return result;
    }
}