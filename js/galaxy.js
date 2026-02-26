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
        // Box-Muller standard normal
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
            // Dim white with slight colour variation
            const b = 0.3 + Math.random() * 0.5;
            col[i*3]   = b * (0.85 + Math.random() * 0.15);
            col[i*3+1] = b * (0.85 + Math.random() * 0.15);
            col[i*3+2] = b;
        }
        const pts = this._makePoints(pos, col, null, tex, 1.2);
        this.scene.add(pts);   // NOT in group, so doesn't rotate with galaxy
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
            // Radius: bias toward inner disk
            const u = Math.random();
            let r;
            if (u < 0.18) {
                r = Math.random() * CR;
            } else {
                r = CR + Math.pow(Math.random(), 1.1) * (DR - CR);
            }

            // Spiral arm
            const arm   = i % numArms;
            const baseA = (Math.PI * 2 / numArms) * arm;
            const spiralA = baseA + winding * Math.log(r / CR + 1);

            // Scatter: tighter at edge, looser near core
            const scatterMag = spread * (0.15 + (1 - r / DR) * 0.5);
            const theta = spiralA + this._gauss() * scatterMag;

            pos[i*3]   = Math.cos(theta) * r;
            pos[i*3+2] = Math.sin(theta) * r;

            // Vertical (Gaussian disk, thicker near core)
            const hScale = Math.max(2, (1 - r / DR) * 40 + 4);
            pos[i*3+1] = this._gauss() * hScale * 0.4;

            // --- Color ---
            const t = Math.random();
            let cr, cg, cb;
            if (r < CR) {
                // Warm core transition
                cr = 1.0; cg = 0.80 + Math.random() * 0.15; cb = 0.40 + Math.random() * 0.30;
            } else if (t < 0.32) {
                // Blue-white (hot O/B stars)
                cr = 0.55 + Math.random() * 0.35; cg = 0.70 + Math.random() * 0.25; cb = 1.0;
            } else if (t < 0.58) {
                // Pure white (A-type)
                const w = 0.88 + Math.random() * 0.12;
                cr = w; cg = w; cb = 0.95 + Math.random() * 0.05;
            } else {
                // Yellow-orange (G/K-type)
                cr = 1.0; cg = 0.60 + Math.random() * 0.30; cb = 0.15 + Math.random() * 0.30;
            }
            // Brightness falloff with radius
            const br = 0.55 + (1 - r / DR) * 0.45;
            col[i*3]   = cr * br;
            col[i*3+1] = cg * br;
            col[i*3+2] = cb * br;
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
            // Exponential radial distribution
            const r  = Math.abs(this._gauss()) * CR * 0.45;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
            pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.55;
            pos[i*3+2] = r * Math.cos(ph);

            const br = 0.7 + Math.random() * 0.3;
            col[i*3]   = br;
            col[i*3+1] = br * (0.82 + Math.random() * 0.12);
            col[i*3+2] = br * (0.40 + Math.random() * 0.35);
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
            col[i*3]   = br * (0.9 + Math.random() * 0.1);
            col[i*3+1] = br * (0.45 + Math.random() * 0.25);
            col[i*3+2] = br * (0.15 + Math.random() * 0.2);
        }
        this.haloPoints = this._makePoints(pos, col, null, tex, 1.5);
        this.group.add(this.haloPoints);
    }

    // ── Nebula clouds ────────────────────────────────────────────────────────
    _createNebula(tex) {
        const n = GALAXY_CONFIG.particles.nebula;
        const cfg = GALAXY_CONFIG;
        const numArms = cfg.arms.count;
        const winding = cfg.arms.windingFactor;
        const DR = cfg.size.diskRadius;
        const CR = cfg.size.coreRadius;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);

        for (let i = 0; i < n; i++) {
            const arm   = Math.floor(Math.random() * numArms);
            const r     = CR * 1.5 + Math.random() * (DR * 0.85 - CR);
            const baseA = (Math.PI * 2 / numArms) * arm;
            const th    = baseA + winding * Math.log(r / CR + 1) + this._gauss() * 0.14;

            pos[i*3]   = Math.cos(th) * r + this._gauss() * 18;
            pos[i*3+1] = this._gauss() * 8;
            pos[i*3+2] = Math.sin(th) * r + this._gauss() * 18;

            const type = Math.random();
            const br = 0.18 + Math.random() * 0.22;
            if (type < 0.40) {
                // Pink/red emission nebula
                col[i*3]   = br * 1.0;
                col[i*3+1] = br * 0.18;
                col[i*3+2] = br * 0.35;
            } else if (type < 0.70) {
                // Blue reflection nebula
                col[i*3]   = br * 0.20;
                col[i*3+1] = br * 0.45;
                col[i*3+2] = br * 1.0;
            } else {
                // Purple nebula
                col[i*3]   = br * 0.60;
                col[i*3+1] = br * 0.10;
                col[i*3+2] = br * 0.90;
            }
        }
        this.nebulaPoints = this._makePoints(pos, col, null, tex, 14, 0.55);
        this.group.add(this.nebulaPoints);
    }

    // ── Central glow sprite ──────────────────────────────────────────────────
    _createCentralGlow() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0,    'rgba(255, 230, 160, 1)');
        grad.addColorStop(0.04, 'rgba(255, 210, 120, 0.95)');
        grad.addColorStop(0.12, 'rgba(255, 180,  80, 0.7)');
        grad.addColorStop(0.30, 'rgba(255, 140,  40, 0.3)');
        grad.addColorStop(0.65, 'rgba(200,  80,  20, 0.08)');
        grad.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        const tex      = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.coreSprite = new THREE.Sprite(spriteMat);
        this.coreSprite.scale.set(160, 160, 1);
        this.group.add(this.coreSprite);

        // Outer haze
        const hazeMat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const haze = new THREE.Sprite(hazeMat);
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
        // Tilt slightly for a beautiful 3/4 view
        this.group.rotation.x = -0.22;
    }

    // ── Shooting stars ───────────────────────────────────────────────────────
    _spawnShootingStar() {
        const start = new THREE.Vector3(
            (Math.random() - 0.5) * 2400,
            (Math.random() - 0.5) * 600,
            (Math.random() - 0.5) * 2400
        );
        const length = 80 + Math.random() * 150;
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 0.6 - start.x * 0.001,
            (Math.random() - 0.5) * 0.2 - start.y * 0.001,
            (Math.random() - 0.5) * 0.6 - start.z * 0.001
        ).normalize();
        const end = start.clone().sub(dir.clone().multiplyScalar(length));

        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const r = 0.6 + Math.random() * 0.4;
        const g = 0.7 + Math.random() * 0.3;
        const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color(r, g, 1.0),
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        const speed = 12 + Math.random() * 18;
        this.shootingStars.push({ line, geo, mat, dir: dir.clone().multiplyScalar(speed), life: 1.0 });
    }

    _updateShootingStars() {
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            s.life -= 0.022 + Math.random() * 0.008;
            s.mat.opacity = Math.max(0, s.life);

            const positions = s.geo.attributes.position.array;
            for (let j = 0; j < 6; j += 3) {
                positions[j]   += s.dir.x;
                positions[j+1] += s.dir.y;
                positions[j+2] += s.dir.z;
            }
            s.geo.attributes.position.needsUpdate = true;

            if (s.life <= 0) {
                this.scene.remove(s.line);
                s.geo.dispose();
                s.mat.dispose();
                this.shootingStars.splice(i, 1);
            }
        }
    }

    update() {
        this.time += 0.016;

        // Rotate galaxy disk slowly
        this.group.rotation.y += GALAXY_CONFIG.rotation.disk;

        // Pulse core glow
        if (this.coreSprite) {
            const pulse = 1 + Math.sin(this.time * 1.4) * 0.06;
            this.coreSprite.scale.set(160 * pulse, 160 * pulse, 1);
        }

        // Shooting star scheduling: ~1 every 4-8 seconds on average
        this.shootingStarTimer += 0.016;
        if (this.shootingStarTimer > 4 + Math.random() * 4) {
            this.shootingStarTimer = 0;
            this._spawnShootingStar();
        }
        this._updateShootingStars();
    }

    dispose() {
        this.group.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        this.scene.remove(this.group);
    }
}
