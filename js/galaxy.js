/**
 * Galaxy - 3D Spiral Galaxy Animation
 * Generates a multi-component galaxy with spiral arms, core, halo and nebulae.
 */
class Galaxy {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.time = 0;
        this.shootingStars = [];
        this.shootingStarTimer = 0;
        this.shockwaves = [];
    }

    // ── Textures ────────────────────────────────────────────────────────────
    _createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0,    'rgba(255,255,255,1)');
        grad.addColorStop(0.08, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.5)');
        grad.addColorStop(0.6,  'rgba(255,255,255,0.1)');
        grad.addColorStop(1,    'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    _createNebulaTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0,    'rgba(255,255,255,0.6)');
        grad.addColorStop(0.3,  'rgba(255,255,255,0.3)');
        grad.addColorStop(0.7,  'rgba(255,255,255,0.08)');
        grad.addColorStop(1,    'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _gauss() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    _makePoints(positions, colors, sizes, tex, sizePx, opacity) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
        if (sizes) geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        const mat = new THREE.PointsMaterial({
            size: sizePx,
            map: tex,
            vertexColors: true,
            transparent: true,
            opacity: opacity !== undefined ? opacity : 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });
        return new THREE.Points(geo, mat);
    }

    // ── Background star field ────────────────────────────────────────────────
    _createBackground(tex) {
        const n = GALAXY_CONFIG.particles.background;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r   = 2500 + Math.random() * 2500;
            const th  = Math.random() * Math.PI * 2;
            const ph  = Math.acos(2 * Math.random() - 1);
            pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
            pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
            pos[i*3+2] = r * Math.cos(ph);
            const b = 0.3 + Math.random() * 0.5;
            col[i*3]   = b * (0.85 + Math.random() * 0.15);
            col[i*3+1] = b * (0.85 + Math.random() * 0.15);
            col[i*3+2] = b;
        }
        const pts = this._makePoints(pos, col, null, tex, 1.2);
        this.scene.add(pts);
    }

    // ── Galactic disk (spiral arms) ──────────────────────────────────────────
    _createDisk(tex) {
        const n = GALAXY_CONFIG.particles.disk;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const cfg = GALAXY_CONFIG;
        const numArms = cfg.arms.count;
        const winding = cfg.arms.windingFactor;
        const spread  = cfg.arms.spread;
        const DR = cfg.size.diskRadius;
        const CR = cfg.size.coreRadius;

        for (let i = 0; i < n; i++) {
            const u = Math.random();
            let r;
            if (u < 0.18) { r = Math.random() * CR; } else { r = CR + Math.pow(Math.random(), 1.1) * (DR - CR); }

            const arm   = i % numArms;
            const baseA = (Math.PI * 2 / numArms) * arm;
            const spiralA = baseA + winding * Math.log(r / CR + 1);
            const scatterMag = spread * (0.15 + (1 - r / DR) * 0.5);
            const theta = spiralA + this._gauss() * scatterMag;

            pos[i*3]   = Math.cos(theta) * r;
            pos[i*3+2] = Math.sin(theta) * r;
            const hScale = Math.max(2, (1 - r / DR) * 40 + 4);
            pos[i*3+1] = this._gauss() * hScale * 0.4;

            const t = Math.random();
            let cr, cg, cb;
            if (r < CR) {
                cr = 0.8 + Math.random() * 0.2; cg = 0.2 + Math.random() * 0.4; cb = 0.8 + Math.random() * 0.2;
            } else if (t < 0.32) {
                cr = 0.1 + Math.random() * 0.3; cg = 0.6 + Math.random() * 0.4; cb = 1.0;
            } else if (t < 0.58) {
                cr = 0.6 + Math.random() * 0.4; cg = 0.1 + Math.random() * 0.2; cb = 0.9 + Math.random() * 0.1;
            } else {
                const w = 0.7 + Math.random() * 0.3;
                cr = w * 0.8; cg = w * 0.9; cb = w;
            }
            const br = 0.55 + (1 - r / DR) * 0.45;
            col[i*3]   = cr * br; col[i*3+1] = cg * br; col[i*3+2] = cb * br;
        }

        this.diskPoints = this._makePoints(pos, col, null, tex, 2.2);
        this.group.add(this.diskPoints);
    }

    // ── Core bulge ───────────────────────────────────────────────────────────
    _createCore(tex) {
        const n  = GALAXY_CONFIG.particles.core;
        const CR = GALAXY_CONFIG.size.coreRadius;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);

        for (let i = 0; i < n; i++) {
            const r  = Math.abs(this._gauss()) * CR * 0.45;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
            pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.55;
            pos[i*3+2] = r * Math.cos(ph);

            const br = 0.7 + Math.random() * 0.3;
            if (Math.random() < 0.6) {
                col[i*3] = br; col[i*3+1] = br * 0.4; col[i*3+2] = br * 0.9;
            } else {
                col[i*3] = br * 0.2; col[i*3+1] = br * 0.8; col[i*3+2] = br;
            }
        }
        this.corePoints = this._makePoints(pos, col, null, tex, 3.5);
        this.group.add(this.corePoints);
    }

    // ── Stellar halo ─────────────────────────────────────────────────────────
    _createHalo(tex) {
        const n  = GALAXY_CONFIG.particles.halo;
        const DR = GALAXY_CONFIG.size.diskRadius;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r  = DR * (0.6 + Math.random() * 1.1);
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
            pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.45;
            pos[i*3+2] = r * Math.cos(ph);
            const br = 0.15 + Math.random() * 0.25;
            col[i*3] = br * 0.9; col[i*3+1] = br * 0.5; col[i*3+2] = br * 0.9;
        }
        this.haloPoints = this._makePoints(pos, col, null, tex, 1.5);
        this.group.add(this.haloPoints);
    }

    // ── Nebula clouds ────────────────────────────────────────────────────────
    _createNebula(tex) {
        const n = GALAXY_CONFIG.particles.nebula;
        const cfg = GALAXY_CONFIG;
        const DR = cfg.size.diskRadius;
        const CR = cfg.size.coreRadius;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);

        for (let i = 0; i < n; i++) {
            const arm   = Math.floor(Math.random() * cfg.arms.count);
            const r     = CR * 1.5 + Math.random() * (DR * 0.85 - CR);
            const baseA = (Math.PI * 2 / cfg.arms.count) * arm;
            const th    = baseA + cfg.arms.windingFactor * Math.log(r / CR + 1) + this._gauss() * 0.14;
            pos[i*3]   = Math.cos(th) * r + this._gauss() * 18;
            pos[i*3+1] = this._gauss() * 8;
            pos[i*3+2] = Math.sin(th) * r + this._gauss() * 18;

            const type = Math.random();
            const br = 0.15 + Math.random() * 0.20;
            if (type < 0.4) {
                col[i*3] = br * 0.1; col[i*3+1] = br * 0.8; col[i*3+2] = br * 1.0;
            } else if (type < 0.7) {
                col[i*3] = br * 1.0; col[i*3+1] = br * 0.2; col[i*3+2] = br * 0.8;
            } else {
                col[i*3] = br * 0.4; col[i*3+1] = br * 0.1; col[i*3+2] = br * 0.9;
            }
        }
        this.nebulaPoints = this._makePoints(pos, col, null, tex, 36, 0.65);
        this.group.add(this.nebulaPoints);
    }

    // ── Central glow sprite ──────────────────────────────────────────────────
    _createCentralGlow() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0,    'rgba(200, 100, 255, 0.45)');
        grad.addColorStop(0.04, 'rgba(160, 80,  255, 0.38)');
        grad.addColorStop(0.12, 'rgba(100, 50,  255, 0.25)');
        grad.addColorStop(0.30, 'rgba(50,  150, 255, 0.1)');
        grad.addColorStop(0.65, 'rgba(20,  100, 200, 0.03)');
        grad.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.coreSprite = new THREE.Sprite(spriteMat);
        this.coreSprite.scale.set(160, 160, 1);
        this.group.add(this.coreSprite);
        const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
        haze.scale.set(520, 520, 1);
        this.group.add(haze);
    }

    // ── Public API ───────────────────────────────────────────────────────────
    init() {
        const starTex   = this._createStarTexture();
        const nebulaTex = this._createNebulaTexture();
        this._createBackground(starTex);
        this._createHalo(starTex);
        this._createDisk(starTex);
        this._createNebula(nebulaTex);
        this._createCore(starTex);
        this._createCentralGlow();
        this.group.rotation.x = -0.22;
    }

    _spawnShootingStar() {
        const start = new THREE.Vector3((Math.random() - 0.5) * 2400, (Math.random() - 0.5) * 600, (Math.random() - 0.5) * 2400);
        const length = 80 + Math.random() * 150;
        const dir = new THREE.Vector3((Math.random() - 0.5) * 0.6 - start.x * 0.001, (Math.random() - 0.5) * 0.2 - start.y * 0.001, (Math.random() - 0.5) * 0.6 - start.z * 0.001).normalize();
        const end = start.clone().sub(dir.clone().multiplyScalar(length));
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.6 + Math.random() * 0.4, 0.7 + Math.random() * 0.3, 1.0), transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.shootingStars.push({ line, geo, mat, dir: dir.clone().multiplyScalar(12 + Math.random() * 18), life: 1.0 });
    }

    _updateShootingStars() {
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            s.life -= 0.022 + Math.random() * 0.008;
            s.mat.opacity = Math.max(0, s.life);
            const positions = s.geo.attributes.position.array;
            for (let j = 0; j < 6; j += 3) { positions[j] += s.dir.x; positions[j+1] += s.dir.y; positions[j+2] += s.dir.z; }
            s.geo.attributes.position.needsUpdate = true;
            if (s.life <= 0) { this.scene.remove(s.line); s.geo.dispose(); s.mat.dispose(); this.shootingStars.splice(i, 1); }
        }
    }

    _spawnShockwave() {
        const geo = new THREE.RingGeometry(1, 15, 64);
        const mat = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = Math.PI / 2;
        this.group.add(mesh);
        this.shockwaves.push({ mesh, life: 1.0 });
    }

    _updateShockwaves() {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.life -= 0.02;
            sw.mesh.scale.addScalar(20);
            sw.mesh.material.opacity = Math.max(0, sw.life * 0.8);
            if (sw.life <= 0) { this.group.remove(sw.mesh); sw.mesh.geometry.dispose(); sw.mesh.material.dispose(); this.shockwaves.splice(i, 1); }
        }
    }

    update() {
        this.time += 0.016;
        this.group.rotation.y += GALAXY_CONFIG.rotation.disk;
        if (this.coreSprite) {
            const pulse = 1 + Math.sin(this.time * 1.4) * 0.06;
            this.coreSprite.scale.set(160 * pulse, 160 * pulse, 1);
        }
        this.shootingStarTimer += 0.016;
        if (this.shootingStarTimer > 4 + Math.random() * 4) { this.shootingStarTimer = 0; this._spawnShootingStar(); }
        this._updateShootingStars();
        this._updateShockwaves();
    }

    dispose() {
        this.group.children.forEach(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        this.scene.remove(this.group);
    }
}
