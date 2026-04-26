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
        this.shakeLevel = 0; // 震动强度 [0, 1]
    }

    _createStarTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
    }

    _createNebulaTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
    }

    _gauss() {
        let u=0, v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
        return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
    }

    _makePoints(pos, col, tex, size, opacity) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, opacity: opacity||1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    }

    _createBackground(tex) {
        const n = GALAXY_CONFIG.particles.background; const pos = new Float32Array(n*3), col = new Float32Array(n*3);
        for(let i=0; i<n; i++){
            const r=2500+Math.random()*2500, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
            pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th); pos[i*3+2]=r*Math.cos(ph);
            const b=0.2+Math.random()*0.4; col[i*3]=b; col[i*3+1]=b; col[i*3+2]=b*1.2;
        }
        this.scene.add(this._makePoints(pos, col, tex, 1.2, 0.8));
    }

    _createDisk(tex) {
        const n=GALAXY_CONFIG.particles.disk, cfg=GALAXY_CONFIG; const pos=new Float32Array(n*3), col=new Float32Array(n*3);
        for(let i=0; i<n; i++){
            let r=Math.random()<0.18?Math.random()*cfg.size.coreRadius:cfg.size.coreRadius+Math.pow(Math.random(),1.1)*(cfg.size.diskRadius-cfg.size.coreRadius);
            const th=(Math.PI*2/cfg.arms.count)*(i%cfg.arms.count)+cfg.arms.windingFactor*Math.log(r/cfg.size.coreRadius+1)+this._gauss()*(cfg.arms.spread*(0.15+(1-r/cfg.size.diskRadius)*0.5));
            pos[i*3]=Math.cos(th)*r; pos[i*3+2]=Math.sin(th)*r; pos[i*3+1]=this._gauss()*Math.max(2,(1-r/cfg.size.diskRadius)*40+4)*0.4;
            const t=Math.random(); let cr,cg,cb;
            if(r<cfg.size.coreRadius){ cr=0.8; cg=0.3; cb=0.8; } else if(t<0.32){ cr=0.2; cg=0.7; cb=1.0; } else if(t<0.58){ cr=0.7; cg=0.2; cb=0.9; } else { cr=0.6; cg=0.7; cb=0.9; }
            const br=0.5+(1-r/cfg.size.diskRadius)*0.5; col[i*3]=cr*br; col[i*3+1]=cg*br; col[i*3+2]=cb*br;
        }
        this.group.add(this._makePoints(pos, col, tex, 2.2));
    }

    _createCore(tex) {
        const n=GALAXY_CONFIG.particles.core, CR=GALAXY_CONFIG.size.coreRadius; const pos=new Float32Array(n*3), col=new Float32Array(n*3);
        for(let i=0; i<n; i++){
            const r=Math.abs(this._gauss())*CR*0.45, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
            pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th)*0.55; pos[i*3+2]=r*Math.cos(ph);
            const br=0.6+Math.random()*0.3; col[i*3]=br*0.8; col[i*3+1]=br*0.3; col[i*3+2]=br;
        }
        this.group.add(this._makePoints(pos, col, tex, 3.5));
    }

    _createNebula(tex) {
        const n=GALAXY_CONFIG.particles.nebula, cfg=GALAXY_CONFIG; const pos=new Float32Array(n*3), col=new Float32Array(n*3);
        for(let i=0; i<n; i++){
            const r=cfg.size.coreRadius*1.5+Math.random()*(cfg.size.diskRadius*0.85-cfg.size.coreRadius);
            const th=(Math.PI*2/cfg.arms.count)*Math.floor(Math.random()*cfg.arms.count)+cfg.arms.windingFactor*Math.log(r/cfg.size.coreRadius+1)+this._gauss()*0.14;
            pos[i*3]=Math.cos(th)*r+this._gauss()*18; pos[i*3+1]=this._gauss()*8; pos[i*3+2]=Math.sin(th)*r+this._gauss()*18;
            const br=0.1+Math.random()*0.15;
            if(Math.random()<0.4){ col[i*3]=br*0.1; col[i*3+1]=br*0.7; col[i*3+2]=br; } else if(Math.random()<0.7){ col[i*3]=br; col[i*3+1]=br*0.1; col[i*3+2]=br*0.6; } else { col[i*3]=br*0.3; col[i*3+1]=br*0.1; col[i*3+2]=br*0.8; }
        }
        this.group.add(this._makePoints(pos, col, tex, 36, 0.5));
    }

    _createCentralGlow() {
        const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=256;
        const ctx=canvas.getContext('2d'); const grad=ctx.createRadialGradient(128,128,0,128,128,128);
        grad.addColorStop(0, 'rgba(180, 80, 255, 0.15)'); grad.addColorStop(0.2, 'rgba(100, 50, 255, 0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle=grad; ctx.fillRect(0,0,256,256);
        const tex=new THREE.CanvasTexture(canvas);
        this.coreSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
        this.coreSprite.scale.set(160,160,1); this.group.add(this.coreSprite);
    }

    init() {
        const sTex=this._createStarTexture(), nTex=this._createNebulaTexture();
        this._createBackground(sTex); this._createDisk(sTex); this._createNebula(nTex); this._createCore(sTex); this._createCentralGlow();
        this.group.rotation.x = -0.22;
    }

    // 触发震动
    triggerVibration() {
        this.shakeLevel = 1.0;
    }

    _spawnShootingStar() {
        const start = new THREE.Vector3((Math.random()-0.5)*2400, (Math.random()-0.5)*600, (Math.random()-0.5)*2400);
        const dir = new THREE.Vector3((Math.random()-0.5)*0.6-start.x*0.001, (Math.random()-0.5)*0.2-start.y*0.001, (Math.random()-0.5)*0.6-start.z*0.001).normalize();
        const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone().sub(dir.clone().multiplyScalar(120))]);
        const mat = new THREE.LineBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat); this.scene.add(line);
        this.shootingStars.push({ line, geo, mat, dir: dir.multiplyScalar(16), life: 1.0 });
    }

    _updateShootingStars() {
        for(let i=this.shootingStars.length-1; i>=0; i--){
            const s=this.shootingStars[i]; s.life-=0.025; s.mat.opacity=Math.max(0, s.life);
            const p=s.geo.attributes.position.array; for(let j=0; j<6; j+=3){ p[j]+=s.dir.x; p[j+1]+=s.dir.y; p[j+2]+=s.dir.z; }
            s.geo.attributes.position.needsUpdate=true;
            if(s.life<=0){ this.scene.remove(s.line); s.geo.dispose(); s.mat.dispose(); this.shootingStars.splice(i,1); }
        }
    }

    update() {
        this.time += 0.016;
        this.group.rotation.y += GALAXY_CONFIG.rotation.disk;

        // 核心脉冲
        if(this.coreSprite) this.coreSprite.scale.set(160*(1+Math.sin(this.time*1.4)*0.06), 160*(1+Math.sin(this.time*1.4)*0.06), 1);

        // 空间震动逻辑
        if (this.shakeLevel > 0) {
            const s = this.shakeLevel * 6; // 震幅
            this.group.position.set((Math.random()-0.5)*s, (Math.random()-0.5)*s, (Math.random()-0.5)*s);
            this.shakeLevel *= 0.9; // 衰减
            if (this.shakeLevel < 0.01) { this.shakeLevel = 0; this.group.position.set(0,0,0); }
        }

        if(this.shootingStarTimer++ > 250*Math.random()){ this.shootingStarTimer=0; this._spawnShootingStar(); }
        this._updateShootingStars();
    }

    dispose() {
        this.group.children.forEach(c => { if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); });
        this.scene.remove(this.group);
    }
}
