import * as THREE from 'three';

export class SoundManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playShot() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Deep punchy shot
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playHit() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // High-end tactical "ding"
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
}

export class EffectManager {
    constructor(scene) {
        this.scene = scene;
        this.shatters = [];
        this.muzzleFlash = null;
        this.smoke = [];
        
        // Optimize: Reuse geometry and material
        this.shatterGeom = new THREE.IcosahedronGeometry(0.1, 0);
        this.shatterMat = new THREE.MeshStandardMaterial({
            roughness: 0.1,
            metalness: 0.8,
            emissiveIntensity: 0.5
        });

        this.smokeGeom = new THREE.SphereGeometry(0.05, 8, 8);
        this.smokeMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
        
        this.createMuzzleFlash();
    }

    createMuzzleFlash() {
        const light = new THREE.PointLight(0xffaa00, 0, 5);
        this.muzzleFlash = light;
        this.scene.add(light);
    }

    triggerFlash(position) {
        this.muzzleFlash.position.copy(position);
        this.muzzleFlash.intensity = 15;
        setTimeout(() => {
            this.muzzleFlash.intensity = 0;
        }, 40);

        // Add smoke
        for(let i=0; i<3; i++) {
            const s = new THREE.Mesh(this.smokeGeom, this.smokeMat.clone());
            s.position.copy(position);
            s.userData.velocity = new THREE.Vector3((Math.random()-0.5)*0.02, 0.05+Math.random()*0.05, (Math.random()-0.5)*0.02);
            s.userData.life = 1.0;
            this.scene.add(s);
            this.smoke.push(s);
        }
    }

    createShatter(position, color) {
        const count = 6; // Reduce particle count
        const pieces = [];
        this.shatterMat.color.copy(color);

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.shatterGeom, this.shatterMat);
            mesh.position.copy(position);
            mesh.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            mesh.userData.life = 1.0;
            this.scene.add(mesh);
            pieces.push(mesh);
        }
        this.shatters.push(...pieces);
    }

    update() {
        const count = this.shatters.length;
        for (let i = count - 1; i >= 0; i--) {
            const p = this.shatters[i];
            p.position.x += p.userData.velocity.x;
            p.position.y += p.userData.velocity.y;
            p.position.z += p.userData.velocity.z;
            p.userData.life -= 0.08; // Fade out faster
            p.scale.setScalar(p.userData.life);
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.shatters.splice(i, 1);
            }
        }

        for (let i = this.smoke.length - 1; i >= 0; i--) {
            const s = this.smoke[i];
            s.position.add(s.userData.velocity);
            s.userData.life -= 0.02;
            s.material.opacity = s.userData.life * 0.5;
            s.scale.setScalar(1 + (1-s.userData.life)*2);
            if(s.userData.life <= 0) {
                this.scene.remove(s);
                this.smoke.splice(i, 1);
            }
        }
    }
}
