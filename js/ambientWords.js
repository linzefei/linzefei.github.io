/**
 * AmbientWords – 漫天星河：背景里此起彼伏的词
 *
 * 主词之外，再让一批词同时在星河背景里沉浮：每个词借一小片盘面星星，
 * 慢慢涨起（成字）、悬浮起伏、再落潮散回原位，轮流展露词库里的词。
 * 主词始终在中央唱主角，背景词更小、更暗，只作氛围，不抢戏、不可点亮。
 *
 * 此起彼伏：每个槽位有自己的固定节奏系数（tempo），且每轮的
 * 涨潮/停留/落潮/间隔时长都大范围随机——各词周期互不相同、不断漂移，
 * 不会同一批一起出来、一起消失。
 *
 * 位置按屏幕计算：槽位存的是归一化屏幕坐标（相对镜头视角中心），
 * 每帧按当前相机（视场角、宽高比、距离）换算成世界坐标。
 * 这样任何屏幕、任何缩放下词都保证在可见范围内：窄屏（手机）
 * 自动向中心收拢，宽屏（PC）可以铺得更开。
 *
 * 借星分区（盘面共 12000 颗）：主词只在 [0, 5400) 里借（见 index.html
 * 给 WordParticles 传的 borrowLimit），背景词用 [5400, 12000)，
 * 切成 6 个槽位轮换，两边永不抢同一颗星。
 */
class AmbientWords {
    constructor(galaxy, camera) {
        this.galaxy = galaxy;
        this.camera = camera;
        this.geo = galaxy.diskPoints.geometry;
        this.pool = [];
        this.mainWord = null;
        this.deck = [];
        this.ZONE_START = 5400;
        this.SLOT_SIZE = 1100;
        this.MAX_STARS = 620;
        // 槽位位置：归一化屏幕坐标（nx, ny ∈ [-1, 1]，相对可视半宽/半高），
        // depth 为沿视线方向的深度偏移（占到中心距离的比例，负 = 更远更小）。
        // 刻意避开正中央（|nx|<0.34 且 |ny|<0.30 是主词的地盘）。
        this.spots = [
            { nx: -0.78, ny:  0.62, depth: -0.08 }, { nx: -0.38, ny:  0.78, depth: -0.12 },
            { nx:  0.05, ny:  0.84, depth: -0.14 }, { nx:  0.48, ny:  0.74, depth: -0.10 },
            { nx:  0.80, ny:  0.55, depth: -0.06 }, { nx: -0.85, ny:  0.08, depth: -0.05 },
            { nx:  0.86, ny:  0.02, depth: -0.05 }, { nx: -0.72, ny: -0.55, depth: -0.03 },
            { nx:  0.74, ny: -0.60, depth: -0.03 }, { nx: -0.30, ny: -0.78, depth: -0.06 },
            { nx:  0.32, ny: -0.80, depth: -0.06 }
        ];
        const count = window.innerWidth < 700 ? 4 : 6;
        this.slots = [];
        for (let s = 0; s < count; s++) {
            const anchor = new THREE.Object3D();
            galaxy.scene.add(anchor);
            this.slots.push({
                base: this.ZONE_START + s * this.SLOT_SIZE,
                anchor: anchor,
                tempo: 0.75 + Math.random() * 0.6, // 本槽位的固定节奏：0.75–1.35，各不相同
                state: 'idle',
                t: 0.3 + s * 0.55 + Math.random() * 1.1, // idle 时是倒计时：首批词尽早出来（约 0–4 秒内各槽位都启动），之后靠各自节奏错开
                word: null, n: 0, unit: null, wordCol: null, delay: null,
                width: 0, spot: null, lastSpot: -1,
                durIn: 4, durHold: 8, durOut: 4,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: 0.35 + Math.random() * 0.4
            });
        }
        this._m = new THREE.Matrix4();
        this._inv = new THREE.Matrix4();
        this._origin = new THREE.Vector3(0, 90, 0); // 视角中心（主词附近的高度）
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
        this._view = { halfW: 0, halfH: 0, dist: 0 };
        this._lastNow = null;
        this.time = 0;
        window._ambient = this; // 调试/验证用
    }

    setPool(entries, mainWord) {
        this.pool = entries.map(e => e.word);
        this.mainWord = mainWord || null;
        this._rebuildDeck();
    }

    setMainWord(text) {
        if (text === this.mainWord) return;
        this.mainWord = text;
        this._rebuildDeck();
        // 正在背景里展示的正是新主词 → 提前落潮让位
        for (const s of this.slots) {
            if (s.word === text && (s.state === 'in' || s.state === 'hold')) {
                s.state = 'out'; s.t = 0;
            }
        }
    }

    _rebuildDeck() {
        const words = this.pool.filter(w => w !== this.mainWord);
        for (let i = words.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = words[i]; words[i] = words[j]; words[j] = tmp;
        }
        this.deck = words;
    }

    _nextWord() {
        if (!this.deck.length) this._rebuildDeck();
        const busy = new Set(this.slots.map(s => s.word).filter(Boolean));
        for (let i = this.deck.length - 1; i >= 0; i--) {
            if (!busy.has(this.deck[i])) return this.deck.splice(i, 1)[0];
        }
        return null;
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
        for (let y = 0; y < H; y += 2) { for (let x = 0; x < W; x += 2) { if (data[(y * W + x) * 4 + 3] > 100) pixels.push({ nx: x / W - 0.5, ny: -(y / H - 0.5) }); } }
        return pixels;
    }

    // 按当前相机算可视范围：halfW/halfH 是中心平面处的可视半宽/半高（世界单位）
    _computeView() {
        const cam = this.camera;
        cam.updateMatrixWorld();
        const dist = cam.position.distanceTo(this._origin);
        const halfH = dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const halfW = halfH * cam.aspect;
        this._right.setFromMatrixColumn(cam.matrixWorld, 0);
        this._up.setFromMatrixColumn(cam.matrixWorld, 1);
        this._fwd.copy(this._origin).sub(cam.position).normalize();
        this._view = { halfW, halfH, dist };
        return this._view;
    }

    _startWord(slot, word) {
        let pixels = this._sampleLetters(word);
        if (pixels.length > this.MAX_STARS) {
            const step = pixels.length / this.MAX_STARS, picked = [];
            for (let i = 0; i < this.MAX_STARS; i++) picked.push(pixels[Math.floor(i * step)]);
            pixels = picked;
        }
        slot.n = pixels.length;
        if (!slot.n) return false;
        slot.word = word;
        slot.unit = new Float32Array(slot.n * 2);
        slot.wordCol = new Float32Array(slot.n * 3);
        pixels.forEach((p, i) => {
            slot.unit[i * 2] = p.nx; slot.unit[i * 2 + 1] = p.ny;
            // 配色与主词同系但更暗：背景词是氛围，不抢主词的光
            if (Math.random() < 0.8) { slot.wordCol[i * 3] = 1.05; slot.wordCol[i * 3 + 1] = 0.88; slot.wordCol[i * 3 + 2] = 0.10; } // Gold
            else { slot.wordCol[i * 3] = 0.10; slot.wordCol[i * 3 + 1] = 1.05; slot.wordCol[i * 3 + 2] = 0.95; } // Neon Cyan
        });
        slot.delay = new Float32Array(slot.n);
        for (let i = 0; i < slot.n; i++) slot.delay[i] = Math.random() * 0.45;
        // 词宽随屏幕走：最宽不超过可视宽度的约 1/3，保证整个词都在画面里
        const view = this._computeView();
        slot.width = Math.min(190, 34 + word.length * 15, view.halfW * 2 * 0.34);
        // 选位置：不与其它槽位重复，也尽量不连用上次的位置
        const used = new Set(this.slots.map(s => s.spot).filter(x => x !== null));
        let candidates = this.spots.map((sp, i) => i).filter(i => !used.has(i) && i !== slot.lastSpot);
        if (!candidates.length) candidates = this.spots.map((sp, i) => i).filter(i => !used.has(i));
        if (!candidates.length) candidates = this.spots.map((sp, i) => i);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        slot.spot = pick; slot.lastSpot = pick;
        // 时长：大范围随机 ÷ 本槽位节奏 → 每轮周期都不同，槽位之间更不同步
        slot.durIn   = (3 + Math.random() * 3) / slot.tempo;
        slot.durHold = (5 + Math.random() * 9) / slot.tempo;
        slot.durOut  = (3 + Math.random() * 3) / slot.tempo;
        slot.state = 'in'; slot.t = 0;
        return true;
    }

    _restoreSlot(slot) {
        const pos = this.geo.attributes.position.array;
        const col = this.geo.attributes.color.array;
        const home = this.galaxy.diskHomePos, homeCol = this.galaxy.diskHomeCol;
        for (let i = 0; i < slot.n; i++) {
            const j = (slot.base + i) * 3;
            pos[j] = home[j]; pos[j + 1] = home[j + 1]; pos[j + 2] = home[j + 2];
            col[j] = homeCol[j]; col[j + 1] = homeCol[j + 1]; col[j + 2] = homeCol[j + 2];
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;
    }

    // 把槽位锚点放到它归一化坐标对应的世界位置（每帧按当前屏幕重算）
    _placeAnchor(slot) {
        const spot = this.spots[slot.spot];
        const view = this._view;
        // 窄屏向中心收拢（手机上边角看不清），宽屏铺开
        const concX = this.camera.aspect < 1 ? 0.62 : 0.85;
        const concY = this.camera.aspect < 1 ? 0.68 : 0.85;
        // 沉浮：归一化空间里的小幅正弦漂移
        const bobX = Math.cos(this.time * slot.bobSpeed * 0.7 + slot.bobPhase) * 0.02;
        const bobY = Math.sin(this.time * slot.bobSpeed + slot.bobPhase) * 0.035;
        const nx = spot.nx * concX + bobX;
        const ny = spot.ny * concY + bobY;
        const p = slot.anchor.position;
        p.copy(this._origin)
            .addScaledVector(this._right, nx * view.halfW)
            .addScaledVector(this._up, ny * view.halfH)
            .addScaledVector(this._fwd, spot.depth * view.dist);
        if (this.camera) slot.anchor.quaternion.copy(this.camera.quaternion);
        slot.anchor.updateMatrixWorld();
    }

    update() {
        const now = performance.now();
        let dt = this._lastNow == null ? 0 : (now - this._lastNow) / 1000;
        this._lastNow = now;
        if (dt > 0.5) dt = 0.5;
        if (dt <= 0) return;
        this.time += dt;

        const pos = this.geo.attributes.position.array;
        const col = this.geo.attributes.color.array;
        const home = this.galaxy.diskHomePos, homeCol = this.galaxy.diskHomeCol;
        this.galaxy.group.updateMatrixWorld();
        this._inv.getInverse(this.galaxy.group.matrixWorld);
        this._computeView();
        let anyActive = false;

        for (const slot of this.slots) {
            if (slot.state === 'idle') {
                slot.t -= dt;
                if (slot.t <= 0) {
                    const w = this._nextWord();
                    if (!(w && this._startWord(slot, w))) {
                        slot.t = (0.5 + Math.random() * 5) / slot.tempo;
                    }
                }
                continue;
            }
            anyActive = true;
            slot.t += dt;
            if (slot.state === 'in' && slot.t >= slot.durIn) { slot.state = 'hold'; slot.t = 0; }
            else if (slot.state === 'hold' && slot.t >= slot.durHold) { slot.state = 'out'; slot.t = 0; }
            else if (slot.state === 'out' && slot.t >= slot.durOut) {
                this._restoreSlot(slot);
                slot.state = 'idle'; slot.word = null; slot.spot = null;
                slot.t = (0.5 + Math.random() * 5) / slot.tempo; // 下一轮间隔也随机+看节奏
                continue;
            }

            this._placeAnchor(slot);
            this._m.multiplyMatrices(this._inv, slot.anchor.matrixWorld);
            const e = this._m.elements;
            const W = slot.width, H = W * 0.28;
            const rawT = slot.state === 'in' ? Math.min(1, slot.t / slot.durIn)
                       : slot.state === 'out' ? Math.min(1, slot.t / slot.durOut) : 1;

            for (let i = 0; i < slot.n; i++) {
                let k;
                if (slot.state === 'hold') k = 1;
                else {
                    const tt = Math.max(0, Math.min(1, (rawT - slot.delay[i]) / (1 - slot.delay[i])));
                    const ez = 1 - Math.pow(1 - tt, 3);
                    k = slot.state === 'in' ? ez : 1 - ez;
                }
                const lx = slot.unit[i * 2] * W, ly = slot.unit[i * 2 + 1] * H;
                const gx = e[0] * lx + e[4] * ly + e[12];
                const gy = e[1] * lx + e[5] * ly + e[13];
                const gz = e[2] * lx + e[6] * ly + e[14];
                const j = (slot.base + i) * 3;
                pos[j]     = home[j]     + (gx - home[j])     * k;
                pos[j + 1] = home[j + 1] + (gy - home[j + 1]) * k;
                pos[j + 2] = home[j + 2] + (gz - home[j + 2]) * k;
                // 注意：颜色按词内序号 i 取 wordCol（不是盘面序号 j）—— v0.6.0 的教训
                col[j]     = homeCol[j]     + (slot.wordCol[i * 3]     - homeCol[j])     * k;
                col[j + 1] = homeCol[j + 1] + (slot.wordCol[i * 3 + 1] - homeCol[j + 1]) * k;
                col[j + 2] = homeCol[j + 2] + (slot.wordCol[i * 3 + 2] - homeCol[j + 2]) * k;
            }
        }
        if (anyActive) {
            this.geo.attributes.position.needsUpdate = true;
            this.geo.attributes.color.needsUpdate = true;
        }
    }
}
