import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TargetManager } from './targets.js';
import { EffectManager, SoundManager } from './effects.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.NoToneMapping; // Faster
        document.body.appendChild(this.renderer.domElement);

        // Performance Optimization: Disabled expensive Bloom post-processing
        this.composer = null; 

        this.targetMgr = new TargetManager(this.scene);
        this.effectMgr = new EffectManager(this.scene);
        this.soundMgr = new SoundManager();
        
        // Performance & Input: Accumulate movement for smoother rotation
        this.raycaster = new THREE.Raycaster();
        this.centerPoint = new THREE.Vector2(0, 0);
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.tempVec3 = new THREE.Vector3();
        
        this.pitch = 0;
        this.yaw = 0;

        this.mode = 'normal';
        this.isGameRunning = false;
        this.score = 0;
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.timeLeft = 60;
        this.timerInterval = null;
        this.sensitivity = localStorage.getItem('aimProSens') ? parseFloat(localStorage.getItem('aimProSens')) : 1.0;

        this.setupScene();
        this.setupControls();
        this.setupGun();
        this.bindUI();
        this.animate();
    }

    setupScene() {
        // --- PRO GRADIENT SKY ---
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `;

        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize( vWorldPosition + offset ).y;
                gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
            }
        `;

        const skyGeo = new THREE.SphereGeometry( 500, 32, 15 );
        const skyMat = new THREE.ShaderMaterial( {
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                topColor: { value: new THREE.Color( 0x1a1a2e ) },    // Deep Pro Blue
                bottomColor: { value: new THREE.Color( 0x7dd3fc ) }, // Light Horizon Blue
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            side: THREE.BackSide
        } );

        const sky = new THREE.Mesh( skyGeo, skyMat );
        this.scene.add( sky );

        // Aimlabs Pro Gray Theme
        this.scene.background = new THREE.Color(0x1a1a2e); 
        this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 150);

        // Professional Training Facility Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xffffff, 0.4);
        sun.position.set(10, 30, 10);
        sun.castShadow = true;
        this.scene.add(sun);

        // Blue Accent Lights (Pro Facility Feel)
        const blueLight1 = new THREE.PointLight(0x3b82f6, 100, 50);
        blueLight1.position.set(-20, 10, -30);
        this.scene.add(blueLight1);

        const blueLight2 = new THREE.PointLight(0x3b82f6, 100, 50);
        blueLight2.position.set(20, 10, -30);
        this.scene.add(blueLight2);

        // Create Checkerboard Texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2d2d44'; // Darker pro square
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#252538'; // Darkest pro square
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillRect(64, 64, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.repeat.set(40, 20);

        const roomMat = new THREE.MeshBasicMaterial({ 
            map: texture
        });

        // Floor (Checkerboard)
        const floorGeom = new THREE.PlaneGeometry(100, 100);
        const floor = new THREE.Mesh(floorGeom, roomMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Walls (Open to Sky)
        const wallGeom = new THREE.PlaneGeometry(100, 30);
        
        // Back Wall
        const backWall = new THREE.Mesh(wallGeom, roomMat);
        backWall.position.set(0, 15, -50);
        this.scene.add(backWall);

        // Left/Right Walls
        const sideWallGeom = new THREE.PlaneGeometry(100, 30);
        const leftWall = new THREE.Mesh(sideWallGeom, roomMat);
        leftWall.position.set(-50, 15, 0);
        leftWall.rotation.y = Math.PI / 2;
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeom, roomMat);
        rightWall.position.set(50, 15, 0);
        rightWall.rotation.y = -Math.PI / 2;
        this.scene.add(rightWall);

        // Target wall blocks for depth
        const boxGeom = new THREE.BoxGeometry(4, 4, 4);
        const boxMat = new THREE.MeshBasicMaterial({ map: texture, color: 0x444466 });
        for (let i = 0; i < 6; i++) {
            const box = new THREE.Mesh(boxGeom, boxMat);
            box.position.set((Math.random() - 0.5) * 40, 2, -20 - Math.random() * 5);
            this.scene.add(box);
        }
    }

    setupGun() {
        this.gun = new THREE.Group();
        
        // Materials: Optimized Standard Materials
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.2 });
        const slideMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
        const sightMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac9a, roughness: 0.8 });

        // Glock Frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.55), frameMat);
        
        // Glock Slide (Slightly wider and defined)
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.56), slideMat);
        slide.position.y = 0.12;
        
        // Rear Sights (Per image)
        const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.04), sightMat);
        rearSightBase.position.set(0, 0.18, 0.25);
        
        const rearSightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), sightMat);
        rearSightLeft.position.set(-0.03, 0.2, 0.25);
        const rearSightRight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), sightMat);
        rearSightRight.position.set(0.03, 0.2, 0.25);

        // Front Sight
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.03), sightMat);
        frontSight.position.set(0, 0.18, -0.2);

        // Grip & Trigger Guard
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.4, 0.2), frameMat);
        grip.position.set(0, -0.25, 0.18);
        grip.rotation.x = 0.3;

        // Hand (Positioned to grip the gun as in image)
        const handMain = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.3), skinMat);
        handMain.position.set(0, -0.3, 0.2);
        
        const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.8), skinMat);
        forearm.position.set(0.1, -0.5, 0.6);
        forearm.rotation.x = -0.1;
        forearm.rotation.z = 0.1;

        this.gun.add(frame, slide, rearSightBase, rearSightLeft, rearSightRight, frontSight, grip, handMain, forearm);
        
        // Position it to match the ADS-style first person view in the image
        this.gun.position.set(0.15, -0.45, -0.5);
        this.gun.rotation.y = -0.05; // Slight tilt
        
        this.camera.add(this.gun);
        this.scene.add(this.camera);
    }

    setupControls() {
        this.controls = new PointerLockControls(this.camera, document.body);
        
        const onMouseMove = (e) => {
            if (!this.isGameRunning) return;
            
            // Raw movement accumulation for higher precision
            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;

            // Sensitivity scale (0.001 is a more standard base than 0.002)
            this.yaw -= movementX * 0.001 * this.sensitivity;
            this.pitch -= movementY * 0.001 * this.sensitivity;

            // Clamp pitch to avoid flipping
            this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

            // Apply directly with quaternions for maximum smoothness
            this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ'));
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('click', () => this.shoot());
        
        this.controls.addEventListener('lock', () => {
            document.getElementById('main-menu').classList.add('hidden');
            this.isGameRunning = true;
        });

        this.controls.addEventListener('unlock', () => {
            document.getElementById('main-menu').classList.remove('hidden');
            this.isGameRunning = false;
        });
    }

    bindUI() {
        const slider = document.getElementById('sens-slider');
        const display = document.getElementById('sens-display');
        
        slider.value = this.sensitivity;
        display.innerText = this.sensitivity.toFixed(1);

        slider.addEventListener('input', (e) => {
            this.sensitivity = parseFloat(e.target.value);
            display.innerText = this.sensitivity.toFixed(1);
            localStorage.setItem('aimProSens', this.sensitivity);
        });

        document.getElementById('start-gridshot').addEventListener('click', () => this.startGame('normal'));
        document.getElementById('start-tracking').addEventListener('click', () => this.startGame('tracing'));
        
        // Summary screen buttons
        document.getElementById('btn-restart').addEventListener('click', () => {
            document.getElementById('summary-screen').classList.add('hidden');
            this.startGame(this.mode);
        });
        document.getElementById('btn-main-menu').addEventListener('click', () => {
            document.getElementById('summary-screen').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        });
    }

    startGame(mode) {
        this.mode = mode;
        this.score = 0;
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.timeLeft = 60;
        
        // Reset rotation state on start to prevent "snapping"
        this.yaw = 0;
        this.pitch = 0;
        this.camera.quaternion.set(0, 0, 0, 1);
        
        this.targetMgr.reset();
        this.updateUI();
        this.startTimer();
        
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('summary-screen').classList.add('hidden');
        this.controls.lock();
        
        // Spawn initial targets (1 for tracking, 3 for gridshot)
        const initialCount = this.mode === 'tracing' ? 1 : 3;
        for(let i=0; i<initialCount; i++) this.targetMgr.spawn(this.mode);
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.updateTimerUI();
        
        const startTime = Date.now();

        this.timerInterval = setInterval(() => {
            if (!this.isGameRunning) return;
            
            this.timeLeft--;
            this.updateTimerUI();
            
            // Calculate KPS
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const kps = (this.shotsHit / elapsedSeconds).toFixed(1);
            const kpsVal = document.getElementById('kps-val');
            kpsVal.innerText = kps;
            kpsVal.classList.add('pop-animation');
            setTimeout(() => kpsVal.classList.remove('pop-animation'), 100);

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    updateTimerUI() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timer-val').innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Timer pop animation
        const timerEl = document.getElementById('timer-val');
        timerEl.classList.add('pop-animation');
        setTimeout(() => timerEl.classList.remove('pop-animation'), 100);
    }

    endGame() {
        clearInterval(this.timerInterval);
        this.isGameRunning = false;
        this.controls.unlock();
        this.showSummary();
    }

    showSummary() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('summary-screen').classList.remove('hidden');
        
        document.getElementById('summary-mode').innerText = this.mode === 'normal' ? 'GRIDSHOT' : 'TRACKING';
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('final-hits').innerText = this.shotsHit;
        
        const acc = this.shotsFired === 0 ? 0 : Math.round((this.shotsHit / this.shotsFired) * 100);
        document.getElementById('final-accuracy').innerText = `${acc}%`;
    }

    showHitmarker() {
        const hm = document.getElementById('hitmarker');
        hm.style.opacity = '1';
        setTimeout(() => hm.style.opacity = '0', 50);
    }

    shoot() {
        if (!this.isGameRunning) return;
        this.shotsFired++;
        
        // Sound
        this.soundMgr.playShot();
        
        // Snappy Recoil
        this.gun.position.z += 0.1;
        this.gun.rotation.x -= 0.12;
        
        // Muzzle Flash & Smoke
        this.tempVec3.setFromMatrixPosition(this.gun.matrixWorld);
        this.effectMgr.triggerFlash(this.tempVec3);

        this.raycaster.setFromCamera(this.centerPoint, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.targetMgr.targets);
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            this.shotsHit++;
            this.score += 100; // Aimlabs style score
            
            this.soundMgr.playHit();
            this.showHitmarker();
            this.effectMgr.createShatter(hit.position, hit.material.color);
            this.targetMgr.remove(hit);
            this.targetMgr.spawn(this.mode);
        }
        this.updateUI();
    }

    updateUI() {
        const acc = this.shotsFired === 0 ? 100 : Math.round((this.shotsHit / this.shotsFired) * 100);
        const accVal = document.getElementById('accuracy-val');
        accVal.innerText = acc;
        accVal.classList.add('pop-animation');
        setTimeout(() => accVal.classList.remove('pop-animation'), 100);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isGameRunning) {
            // Gun return
            this.gun.position.z += (-0.7 - this.gun.position.z) * 0.15;
            this.gun.rotation.x += (0 - this.gun.rotation.x) * 0.15;
            
            this.targetMgr.update(this.mode);
            this.effectMgr.update();

            // Handle Tracking Mode Focus Logic
            if (this.mode === 'tracing' && this.targetMgr.targets.length > 0) {
                const target = this.targetMgr.targets[0];
                this.raycaster.setFromCamera(this.centerPoint, this.camera);
                
                const intersects = this.raycaster.intersectObject(target);
                if (intersects.length > 0) {
                    // Reduce health over time (100 health / 60 fps = ~1.67 per frame for 1 second)
                    target.userData.health -= 1.67; 
                    
                    // Visual feedback: Brighten target as it's being tracked
                    target.material.color.setRGB(1, 1, 1); 
                    
                    if (target.userData.health <= 0) {
                        this.score += 10;
                        this.shotsHit++; // Count as a "hit" for accuracy
                        this.shotsFired++; // Count as a "shot" for accuracy
                        
                        this.soundMgr.playHit();
                        this.effectMgr.createShatter(target.position, new THREE.Color(0xff00ff));
                        this.targetMgr.remove(target);
                        this.targetMgr.spawn(this.mode);
                        this.updateUI();
                    }
                } else {
                    // Reset visual feedback if crosshair leaves target
                    target.material.color.setHex(0xff00ff);
                }
            }
        }
        
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

new Game();
