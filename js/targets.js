import * as THREE from 'three';

export class TargetManager {
    constructor(scene) {
        this.scene = scene;
        this.targets = [];
        this.pool = [];
        this.targetRadius = 0.4;
        
        // Upgrade to StandardMaterial for better graphics (lighting/shadows)
        this.matNormal = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 0.6,
            roughness: 0.05, // Very glossy
            metalness: 0.9,  // Very metallic
        });
        this.matTracking = new THREE.MeshStandardMaterial({ 
            color: 0xff00ff, 
            emissive: 0xff00ff, 
            emissiveIntensity: 0.6,
            roughness: 0.05, // Very glossy
            metalness: 0.9,  // Very metallic
        });
        
        // High quality geometry
        this.geometry = new THREE.SphereGeometry(this.targetRadius, 32, 32);
    }

    spawn(mode) {
        let target;
        if (this.pool.length > 0) {
            target = this.pool.pop();
        } else {
            target = new THREE.Mesh(this.geometry, this.matNormal);
        }

        target.material = mode === 'normal' ? this.matNormal : this.matTracking;
        
        // Spawn Animation: Start tiny and scale up
        target.scale.setScalar(0.01);
        target.userData.animating = true;
        target.userData.scale = 0.01;
        
        // Random position in front of player
        target.position.set(
            (Math.random() - 0.5) * 10,
            1 + Math.random() * 4,
            -10 - Math.random() * 5
        );

        if (mode === 'tracing') {
            target.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.15,
                (Math.random() - 0.5) * 0.1,
                0
            );
            target.userData.health = 100;
        }

        this.scene.add(target);
        this.targets.push(target);
        return target;
    }

    remove(target) {
        const index = this.targets.indexOf(target);
        if (index > -1) {
            this.targets.splice(index, 1);
            this.scene.remove(target);
            this.pool.push(target);
        }
    }

    reset() {
        // Clear all active targets back to pool
        while(this.targets.length > 0) {
            this.remove(this.targets[0]);
        }
    }

    update(mode) {
        const count = this.targets.length;
        for (let i = 0; i < count; i++) {
            const t = this.targets[i];
            
            // Handle Scale-up Animation
            if (t.userData.animating) {
                t.userData.scale += 0.15;
                if (t.userData.scale >= 1.0) {
                    t.userData.scale = 1.0;
                    t.userData.animating = false;
                }
                t.scale.setScalar(t.userData.scale);
            }

            // Handle Movement (Tracing)
            if (mode === 'tracing' && t.userData.velocity) {
                t.position.x += t.userData.velocity.x;
                t.position.y += t.userData.velocity.y;
                if (Math.abs(t.position.x) > 8) t.userData.velocity.x *= -1;
                if (t.position.y > 6 || t.position.y < 1) t.userData.velocity.y *= -1;
            }
        }
    }
}
