/**
 * Galaxy - 3D Spiral Galaxy Animation
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
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
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
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

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
        const mat = new THREE.PointsMaterial({ size: sizePx, map: tex, vertexColors: true, transparent: true, opacity: opacity !== undefined ? opacity : 1.0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
        return new THREE.Points(geo, mat);
    }

    _createBackground(tex) {
        const n = GALAXY_CONFIG.particles.background;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r = 2500 + Math.random() * 2500, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            pos[i*3] = r * Math.sin(ph) * Math.cos(th); pos[i*3+1] = r * Math.sin(ph) * Math.sin(th); pos[i*3+2] = r * Math.cos(ph);
            const b = 0.3 + Math.random() * 0.5;
            col[i*3] = b * 0.9; col[i*3+1] = b * 0.9; col[i*3+2] = b;
        }
        this.scene.add(this._makePoints(pos, col, null, tex, 1.2));
    }

    _createDisk(tex) {
        const n = GALAXY_CONFIG.particles.disk, cfg = GALAXY_CONFIG;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            let r = Math.random() < 0.18 ? Math.random() * cfg.size.coreRadius : cfg.size.coreRadius + Math.pow(Math.random(), 1.1) * (cfg.size.diskRadius - cfg.size.coreRadius);
            const theta = (Math.PI * 2 / cfg.arms.count) * (i % cfg.arms.count) + cfg.arms.windingFactor * Math.log(r / cfg.size.coreRadius + 1) + this._gauss() * (cfg.arms.spread * (0.15 + (1 - r / cfg.size.diskRadius) * 0.5));
            pos[i*3] = Math.cos(theta) * r; pos[i*3+2] = Math.sin(theta) * r; pos[i*3+1] = this._gauss() * Math.max(2, (1 - r / cfg.size.diskRadius) * 40 + 4) * 0.4;
            const t = Math.random(); let cr, cg, cb;
            if (r < cfg.size.coreRadius) { cr=0.8; cg=0.3; cb=0.8; }
            else if (t < 0.32) { cr=0.2; cg=0.7; cb=1.0; }
            else if (t < 0.58) { cr=0.7; cg=0.2; cb=0.9; }
            else { const w=0.8; cr=w*0.8; cg=w*0.9; cb=w; }
            const br = 0.55 + (1 - r / cfg.size.diskRadius) * 0.45;
            col[i*3] = cr * br; col[i*3+1] = cg * br; col[i*3+2] = cb * br;
        }
        this.diskPoints = this._makePoints(pos, col, null, tex, 2.2);
        this.group.add(this.diskPoints);
    }

    _createCore(tex) {
        const n = GALAXY_CONFIG.particles.core, CR = GALAXY_CONFIG.size.coreRadius;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r = Math.abs(this._gauss()) * CR * 0.45, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            pos[i*3] = r * Math.sin(ph) * Math.cos(th); pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.55; pos[i*3+2] = r * Math.cos(ph);
            const br = 0.7 + Math.random() * 0.3;
            if (Math.random() < 0.6) { col[i*3]=br; col[i*3+1]=br*0.4; col[i*3+2]=br*0.9; }
            else { col[i*3]=br*0.2; col[i*3+1]=br*0.8; col[i*3+2]=br; }
        }
        this.corePoints = this._makePoints(pos, col, null, tex, 3.5);
        this.group.add(this.corePoints);
    }

    _createHalo(tex) {
        const n = GALAXY_CONFIG.particles.halo, DR = GALAXY_CONFIG.size.diskRadius;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r = DR * (0.6 + Math.random() * 1.1), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            pos[i*3] = r * Math.sin(ph) * Math.cos(th); pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.45; pos[i*3+2] = r * Math.cos(ph);
            const br = 0.15 + Math.random() * 0.25; col[i*3]=br*0.9; col[i*3+1]=br*0.5; col[i*3+2]=br*0.9;
        }
        this.group.add(this._makePoints(pos, col, null, tex, 1.5));
    }

    _createNebula(tex) {
        const n = GALAXY_CONFIG.particles.nebula, cfg = GALAXY_CONFIG;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r = cfg.size.coreRadius * 1.5 + Math.random() * (cfg.size.diskRadius * 0.85 - cfg.size.coreRadius);
            const th = (Math.PI * 2 / cfg.arms.count) * Math.floor(Math.random() * cfg.arms.count) + cfg.arms.windingFactor * Math.log(r / cfg.size.coreRadius + 1) + this._gauss() * 0.14;
            pos[i*3] = Math.cos(th) * r + this._gauss() * 18; pos[i*3+1] = this._gauss() * 8; pos[i*3+2] = Math.sin(th) * r + this._gauss() * 18;
            const br = 0.15 + Math.random() * 0.2;
            if (Math.random() < 0.4) { col[i*3]=br*0.1; col[i*3+1]=br*0.8; col[i*3+2]=br*1.0; }
            else if (Math.random() < 0.7) { col[i*3]=br*1.0; col[i*3+1]=br*0.2; col[i*3+2]=br*0.8; }
            else { col[i*3]=br*0.4; col[i*3+1]=br*0.1; col[i*3+2]=br*0.9; }
        }
        this.group.add(this._makePoints(pos, col, null, tex, 36, 0.65));
    }

    _createCentralGlow() {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(200, 100, 255, 0.25)'); grad.addColorStop(0.12, 'rgba(100, 50, 255, 0.15)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(canvas);
        this.coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.coreSprite.scale.set(160, 160, 1); this.group.add(this.coreSprite);
        const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
        haze.scale.set(520, 520, 1); this.group.add(haze);
    }

    init() {
        const sTex = this._createStarTexture(), nTex = this._createNebulaTexture();
        this._createBackground(sTex); this._createHalo(sTex); this._createDisk(sTex); this._createNebula(nTex); this._createCore(sTex); this._createCentralGlow();
        this.group.rotation.x = -0.22;
    }

    _spawnShootingStar() {
        const start = new THREE.Vector3((Math.random()-0.5)*2400, (Math.random()-0.5)*600, (Math.random()-0.5)*2400);
        const dir = new THREE.Vector3((Math.random()-0.5)*0.6-start.x*0.001, (Math.random()-0.5)*0.2-start.y*0.001, (Math.random()-0.5)*0.6-start.z*0.001).normalize();
        const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone().sub(dir.clone().multiplyScalar(120))]);
        const mat = new THREE.LineBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat); this.scene.add(line);
        this.shootingStars.push({ line, geo, mat, dir: dir.multiplyScalar(15), life: 1.0 });
    }

    _updateShootingStars() {
        for (let i=this.shootingStars.length-1; i>=0; i--) {
            const s = this.shootingStars[i]; s.life -= 0.025; s.mat.opacity = Math.max(0, s.life);
            const pos = s.geo.attributes.position.array;
            for (let j=0; j<6; j+=3) { pos[j]+=s.dir.x; pos[j+1]+=s.dir.y; pos[j+2]+=s.dir.z; }
            s.geo.attributes.position.needsUpdate = true;
            if (s.life<=0) { this.scene.remove(s.line); s.geo.dispose(); s.mat.dispose(); this.shootingStars.splice(i, 1); }
        }
    }

    _spawnShockwave() {
        const geo = new THREE.RingGeometry(14, 15, 64);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        mesh.rotation.x = Math.PI/2; this.group.add(mesh); this.shockwaves.push({ mesh, life: 1.0 });
    }

    _updateShockwaves() {
        for (let i=this.shockwaves.length-1; i>=0; i--) {
            const sw = this.shockwaves[i]; sw.life -= 0.03; sw.mesh.scale.addScalar(15); sw.mesh.material.opacity = Math.max(0, sw.life*0.4);
            if (sw.life<=0) { this.group.remove(sw.mesh); sw.mesh.geometry.dispose(); sw.mesh.material.dispose(); this.shockwaves.splice(i,1); }
        }
    }

    update() {
        this.time += 0.016; this.group.rotation.y += GALAXY_CONFIG.rotation.disk;
        if (this.coreSprite) this.coreSprite.scale.set(160*(1+Math.sin(this.time*1.4)*0.06), 160*(1+Math.sin(this.time*1.4)*0.06), 1);
        if (this.shootingStarTimer++ > 300*Math.random()) { this.shootingStarTimer=0; this._spawnShootingStar(); }
        this._updateShootingStars(); this._updateShockwaves();
    }

    dispose() {
        this.group.children.forEach(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        this.scene.remove(this.group);
    }
}
