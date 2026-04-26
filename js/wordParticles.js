/**
 * WordParticles – 粒子聚合成字
 */
class WordParticles {
    constructor(word, scene, camera) {
        this.word = word; this.scene = scene; this.camera = camera;
        this.phase = 'assembling'; this.tick = 0;
        this.T_ASSEMBLE = 120; this.T_HOLD = 220; this.T_DISPERSE = 110;
        this._init();
    }

    _sampleLetters(word) {
        const FONT_SIZE = 96; const PAD = 20;
        const tmp = document.createElement('canvas'); const tc = tmp.getContext('2d');
        tc.font = `bold ${FONT_SIZE}px Arial, sans-serif`;
        const textW = tc.measureText(word).width;
        const W = Math.ceil(textW + PAD * 2), H = FONT_SIZE + PAD * 2;
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff';
        ctx.font = `bold ${FONT_SIZE}px Arial, sans-serif`;
        ctx.fillText(word, PAD, FONT_SIZE + PAD * 0.4);
        const data = ctx.getImageData(0, 0, W, H).data, pixels = [];
        for (let y=0; y<H; y+=3) { for (let x=0; x<W; x+=3) { if (data[(y*W+x)*4+3]>100) pixels.push({nx: x/W-0.5, ny: -(y/H-0.5)}); } }
        return pixels;
    }

    _init() {
        const pixels = this._sampleLetters(this.word); this.n = pixels.length;
        if (this.n === 0) { this.phase = 'done'; return; }
        const WORD_W = Math.min(460, 60 + this.word.length * 36), WORD_H = WORD_W * 0.28;
        this.target = new Float32Array(this.n * 3); this.startP = new Float32Array(this.n * 3); this.cur = new Float32Array(this.n * 3);
        const colors = new Float32Array(this.n * 3);
        pixels.forEach((p, i) => {
            this.target[i*3] = p.nx * WORD_W; this.target[i*3+1] = p.ny * WORD_H; this.target[i*3+2] = 0;
            const r = 100 + Math.random() * 500, th = Math.random() * Math.PI * 2;
            this.startP[i*3] = Math.cos(th) * r; this.startP[i*3+1] = (Math.random()-0.5)*40; this.startP[i*3+2] = Math.sin(th)*r*0.4;
            this.cur[i*3] = this.startP[i*3]; this.cur[i*3+1] = this.startP[i*3+1]; this.cur[i*3+2] = this.startP[i*3+2];
            const t = Math.random();
            // 配色：亮金色 (#FFD700) 为主，少量高亮青色 (#00FFFF) 点缀
            if (t < 0.8) { colors[i*3]=1.0; colors[i*3+1]=0.85; colors[i*3+2]=0.1; } // Gold
            else { colors[i*3]=0.1; colors[i*3+1]=1.0; colors[i*3+2]=0.9; } // Neon Cyan
        });
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.cur, 3));
        this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.mat = new THREE.PointsMaterial({ size: 3.6, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
        this.points = new THREE.Points(this.geo, this.mat);
        this.points.position.set(0, 105, 0); // 继续上移一点
        this.scene.add(this.points);
        this.delay = new Float32Array(this.n); for (let i=0; i<this.n; i++) this.delay[i] = Math.random() * 0.4;
    }

    update() {
        if (this.phase === 'done' || !this.points) return;
        this.tick++; const pos = this.cur;
        if (this.camera) this.points.quaternion.copy(this.camera.quaternion);
        if (this.phase === 'assembling') {
            const rawT = this.tick / this.T_ASSEMBLE; this.mat.opacity = Math.min(1.0, rawT * 1.5);
            for (let i = 0; i < this.n; i++) {
                const t = Math.max(0, Math.min(1, (rawT - this.delay[i]) / (1 - this.delay[i])));
                const ease = 1 - Math.pow(1 - t, 3), angle = (1 - ease) * Math.PI * 2.2;
                const cosA = Math.cos(angle), sinA = Math.sin(angle);
                const cX = this.startP[i*3] + (this.target[i*3] - this.startP[i*3]) * ease;
                const cY = this.startP[i*3+1] + (this.target[i*3+1] - this.startP[i*3+1]) * ease;
                const cZ = this.startP[i*3+2] * (1 - ease);
                pos[i*3] = cX * cosA - cZ * sinA; pos[i*3+1] = cY; pos[i*3+2] = cX * sinA + cZ * cosA;
            }
            this.geo.attributes.position.needsUpdate = true;
            if (rawT >= 1) { this.phase = 'holding'; this.tick = 0; }
        } else if (this.phase === 'holding') {
            this.mat.opacity = 1.0; const shimmer = 0.7 + 0.4 * Math.sin(this.tick * 0.1);
            for (let i = 0; i < this.n; i++) {
                pos[i*3] = this.target[i*3] + (Math.random()-0.5)*shimmer;
                pos[i*3+1] = this.target[i*3+1] + (Math.random()-0.5)*shimmer;
                pos[i*3+2] = (Math.random()-0.5)*shimmer*0.3;
            }
            this.geo.attributes.position.needsUpdate = true;
            if (this.tick >= this.T_HOLD) {
                this.explode = new Float32Array(this.n * 3);
                for (let i = 0; i < this.n; i++) {
                    const r = 250 + Math.random()*500; const th = Math.random()*Math.PI*2;
                    this.explode[i*3] = Math.cos(th)*r; this.explode[i*3+1] = (Math.random()-0.5)*200; this.explode[i*3+2] = Math.sin(th)*r*0.4;
                }
                this.phase = 'dispersing'; this.tick = 0;
            }
        } else if (this.phase === 'dispersing') {
            const t = Math.min(1, this.tick / this.T_DISPERSE);
            const ease = t * t; this.mat.opacity = 1.0 - t;
            const angle = ease * Math.PI * 1.5, cosA = Math.cos(angle), sinA = Math.sin(angle);
            for (let i = 0; i < this.n; i++) {
                const cX = this.target[i*3] + (this.explode[i*3] - this.target[i*3]) * ease;
                const cY = this.target[i*3+1] + (this.explode[i*3+1] - this.target[i*3+1]) * ease;
                const cZ = this.target[i*3+2] + (this.explode[i*3+2] - this.target[i*3+2]) * ease;
                pos[i*3] = cX * cosA - cZ * sinA; pos[i*3+1] = cY; pos[i*3+2] = cX * sinA + cZ * cosA;
            }
            this.geo.attributes.position.needsUpdate = true;
            if (t >= 1) { this.scene.remove(this.points); this.geo.dispose(); this.mat.dispose(); this.phase = 'done'; }
        }
    }
    isDone() { return this.phase === 'done'; }
}
