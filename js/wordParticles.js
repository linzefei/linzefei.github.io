/**
 * WordParticles – 借用银河盘面的真实星星聚合成字
 *
 * 不再凭空生成粒子：从 Galaxy 盘面借出一批真实星星，飞到镜头前组成词，
 * 展示结束后原样飞回它们在银河中的位置。借用期间星星颜色渐变为金/青，
 * 归位时恢复原色。点亮档位决定词的整体大小（被点亮越多，词越大）。
 */
class WordParticles {
    constructor(word, galaxy, camera, tier) {
        this.word = word; this.galaxy = galaxy; this.camera = camera;
        this.tier = tier || 0;
        this.scaleFactor = [1, 1.15, 1.3, 1.45][this.tier] || 1;
        this.phase = 'assembling';
        // 计时改用真实秒数（原为帧数：120/300/110 帧 @60fps），
        // 低帧率设备上词的成字/停留/散场节奏与高帧率一致，不再拖慢
        this.tPhase = 0; this._lastNow = null;
        this.T_ASSEMBLE = 2.0; this.T_HOLD = 5.0; this.T_DISPERSE = 110 / 60;
        this.flash = 0;
        this._v = new THREE.Vector3();
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
        for (let y=0; y<H; y+=2) { for (let x=0; x<W; x+=2) { if (data[(y*W+x)*4+3]>100) pixels.push({nx: x/W-0.5, ny: -(y/H-0.5)}); } }
        return pixels;
    }

    _init() {
        let pixels = this._sampleLetters(this.word);
        const MAX = 2600; // 单个词最多借 2600 颗星
        if (pixels.length > MAX) {
            const step = pixels.length / MAX, picked = [];
            for (let i = 0; i < MAX; i++) picked.push(pixels[Math.floor(i * step)]);
            pixels = picked;
        }
        this.n = pixels.length;
        if (this.n === 0 || !this.galaxy || !this.galaxy.diskPoints) { this.phase = 'done'; return; }

        // 借连续一段盘面星星（盘面生成顺序本身是随机的，连续段在空间上也是散布的；
        // 连续段同时让高亮层可以用 drawRange 只重绘这批星）
        const total = this.galaxy.diskHomePos.length / 3;
        this.idx = new Uint32Array(this.n);
        this.startIdx = Math.floor(Math.random() * Math.max(1, total - this.n));
        for (let i = 0; i < this.n; i++) this.idx[i] = this.startIdx + i;

        // 单位目标坐标（-0.5..0.5），每帧按当前档位缩放成实际尺寸
        this.unit = new Float32Array(this.n * 2);
        this.wordCol = new Float32Array(this.n * 3);
        pixels.forEach((p, i) => {
            this.unit[i*2] = p.nx; this.unit[i*2+1] = p.ny;
            const t = Math.random();
            // 配色：亮金色 (#FFD700) 为主，少量高亮青色 (#00FFFF) 点缀
            if (t < 0.8) { this.wordCol[i*3]=1.5; this.wordCol[i*3+1]=1.28; this.wordCol[i*3+2]=0.15; } // Gold
            else { this.wordCol[i*3]=0.15; this.wordCol[i*3+1]=1.5; this.wordCol[i*3+2]=1.35; } // Neon Cyan
        });
        this.delay = new Float32Array(this.n);
        for (let i = 0; i < this.n; i++) this.delay[i] = Math.random() * 0.4;

        // 词的锚点：挂在场景中，每帧朝向相机（与旧版位置一致）
        this.anchor = new THREE.Object3D();
        this.anchor.position.set(0, 105, 0);
        this.galaxy.scene.add(this.anchor);
        this.geo = this.galaxy.diskPoints.geometry;

        // 高亮层：与盘面共享同一份位置/颜色属性，只重绘借出的这一段星星，
        // 用更大的发光点把词凸显出来（盘面上的原星仍照常渲染，两层叠加发光）
        this.wordGeo = new THREE.BufferGeometry();
        this.wordGeo.setAttribute('position', this.geo.attributes.position);
        this.wordGeo.setAttribute('color', this.geo.attributes.color);
        this.wordGeo.setDrawRange(this.startIdx, this.n);
        const matOpts = { size: 4.4, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true };
        if (this.galaxy.starTexture) matOpts.map = this.galaxy.starTexture;
        this.wordMat = new THREE.PointsMaterial(matOpts);
        this.wordPoints = new THREE.Points(this.wordGeo, this.wordMat);
        this.wordPoints.frustumCulled = false;
        this.galaxy.group.add(this.wordPoints);
    }

    extendHold(frames) {
        // 点亮后让词多停留一会儿，给用户看清反馈（入参仍按帧数 @60fps 折算成秒）
        if (this.phase === 'holding') this.holdExtra = (this.holdExtra || 0) + frames / 60;
    }

    rushDisperse() {
        // 偶遇旧词跳转：让当前词立刻收尾，下一帧就开始组下一个词
        if (this.phase !== 'done') { this.phase = 'dispersing'; this.tPhase = this.T_DISPERSE; }
    }

    setTier(tier) {
        this.tier = tier || 0;
        this.scaleFactor = [1, 1.15, 1.3, 1.45][this.tier] || 1;
    }

    igniteFlash() { this.flash = 1; }

    _restore() {
        // 把借出的星星精确还原到原始位置与颜色
        const pos = this.geo.attributes.position.array;
        const col = this.geo.attributes.color.array;
        const home = this.galaxy.diskHomePos, homeCol = this.galaxy.diskHomeCol;
        for (let i = 0; i < this.n; i++) {
            const j = this.idx[i] * 3;
            pos[j] = home[j]; pos[j+1] = home[j+1]; pos[j+2] = home[j+2];
            col[j] = homeCol[j]; col[j+1] = homeCol[j+1]; col[j+2] = homeCol[j+2];
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;
        if (this.anchor) { this.galaxy.scene.remove(this.anchor); this.anchor = null; }
        if (this.wordPoints) {
            this.galaxy.group.remove(this.wordPoints);
            this.wordMat.dispose(); // 注意：wordGeo 与盘面共享属性，不能 dispose
            this.wordPoints = null;
        }
    }

    update() {
        if (this.phase === 'done' || !this.geo) return;
        const now = performance.now();
        let dt = this._lastNow == null ? 0 : (now - this._lastNow) / 1000;
        this._lastNow = now;
        if (dt > 0.5) dt = 0.5; // 切后台回来时单帧步长封顶，避免词瞬间跳完；0.5s 足以覆盖低帧率设备的正常帧间隔
        this.tPhase += dt;
        if (this.flash > 0.01) this.flash *= Math.pow(0.94, dt * 60); else this.flash = 0;

        let rawT;
        if (this.phase === 'assembling')   rawT = Math.min(1, this.tPhase / this.T_ASSEMBLE);
        else if (this.phase === 'holding') rawT = 1;
        else                               rawT = Math.min(1, this.tPhase / this.T_DISPERSE);

        if (this.camera) this.anchor.quaternion.copy(this.camera.quaternion);
        this.galaxy.scene.updateMatrixWorld();
        const group = this.galaxy.group;
        const pos = this.geo.attributes.position.array;
        const col = this.geo.attributes.color.array;
        const home = this.galaxy.diskHomePos, homeCol = this.galaxy.diskHomeCol;
        const WORD_W = Math.min(460, 60 + this.word.length * 36) * this.scaleFactor;
        const WORD_H = WORD_W * 0.28;
        const holding = this.phase === 'holding';
        const v = this._v;

        for (let i = 0; i < this.n; i++) {
            // 每颗星自己的进度（带随机延迟，借出与归还共用同一延迟曲线）
            const t = Math.max(0, Math.min(1, (rawT - this.delay[i]) / (1 - this.delay[i])));
            const e = 1 - Math.pow(1 - t, 3);
            const k = this.phase === 'dispersing' ? 1 - e : e;

            // 目标点：单位坐标 → 锚点世界坐标 → 盘面本地坐标
            v.set(this.unit[i*2] * WORD_W, this.unit[i*2+1] * WORD_H, 0);
            this.anchor.localToWorld(v);
            group.worldToLocal(v);

            const j = this.idx[i] * 3;
            const hx = home[j], hy = home[j+1], hz = home[j+2];
            let x = hx + (v.x - hx) * k;
            let y = hy + (v.y - hy) * k;
            let z = hz + (v.z - hz) * k;
            if (holding) { // 悬停时轻微闪烁
                const s = 0.8;
                x += (Math.random()-0.5) * s; y += (Math.random()-0.5) * s; z += (Math.random()-0.5) * s * 0.3;
            }
            pos[j] = x; pos[j+1] = y; pos[j+2] = z;

            // 颜色：原色 → 词色（金/青），点亮闪光时额外增亮
            const boost = 1 + this.flash * k * 1.2;
            col[j]   = (homeCol[j]   + (this.wordCol[j]   - homeCol[j])   * k) * boost;
            col[j+1] = (homeCol[j+1] + (this.wordCol[j+1] - homeCol[j+1]) * k) * boost;
            col[j+2] = (homeCol[j+2] + (this.wordCol[j+2] - homeCol[j+2]) * k) * boost;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;

        if (this.wordMat) {
            this.wordMat.opacity = this.phase === 'assembling' ? rawT
                : this.phase === 'dispersing' ? 1 - rawT : 1;
        }

        if (this.phase === 'assembling' && rawT >= 1) { this.phase = 'holding'; this.tPhase = 0; }
        else if (this.phase === 'holding' && this.tPhase >= this.T_HOLD + (this.holdExtra || 0)) { this.phase = 'dispersing'; this.tPhase = 0; }
        else if (this.phase === 'dispersing' && rawT >= 1) { this._restore(); this.phase = 'done'; }
    }

    isDone() { return this.phase === 'done'; }
}
