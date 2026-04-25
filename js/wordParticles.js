/**
 * WordParticles – 粒子聚合成字
 *
 * 生命周期：
 *   assembling  (2s) – 粒子从银河盘面飞向字形
 *   holding     (3s) – 保持字形，轻微抖动
 *   dispersing  (2s) – 粒子炸开散回星海
 *   done              – 清理完毕
 */
class WordParticles {
    constructor(word, scene, camera) {
        this.word   = word;
        this.scene  = scene;
        this.camera = camera;
        this.phase  = 'assembling';
        this.tick   = 0;

        this.T_ASSEMBLE  = 120;   // frames
        this.T_HOLD      = 200;
        this.T_DISPERSE  = 110;

        this._init();
    }

    /* ── 采样字形像素位置 ─────────────────────────────────────── */
    _sampleLetters(word) {
        const FONT_SIZE = 96;
        const PAD       = 20;
        // 先量一下宽度
        const tmp = document.createElement('canvas');
        const tc  = tmp.getContext('2d');
        tc.font   = `bold ${FONT_SIZE}px Arial, sans-serif`;
        const textW = tc.measureText(word).width;

        const W = Math.ceil(textW + PAD * 2);
        const H = FONT_SIZE + PAD * 2;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font      = `bold ${FONT_SIZE}px Arial, sans-serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(word, PAD, FONT_SIZE + PAD * 0.4);

        const data   = ctx.getImageData(0, 0, W, H).data;
        const pixels = [];
        const step   = 3;   // 每隔 3px 采样一次，控制粒子数量
        for (let y = 0; y < H; y += step) {
            for (let x = 0; x < W; x += step) {
                const a = data[(y * W + x) * 4 + 3]; // alpha 通道
                if (a > 100) {
                    pixels.push({
                        nx: x / W - 0.5,            // [-0.5, 0.5]
                        ny: -(y / H - 0.5),
                        ar: data[(y * W + x) * 4]   / 255,
                        ag: data[(y * W + x) * 4 + 1] / 255,
                        ab: data[(y * W + x) * 4 + 2] / 255,
                    });
                }
            }
        }
        return pixels;
    }

    /* ── 初始化 ──────────────────────────────────────────────── */
    _init() {
        const pixels = this._sampleLetters(this.word);
        this.n = pixels.length;
        if (this.n === 0) { this.phase = 'done'; return; }

        // 字形目标宽度（三维场景单位）
        const WORD_W = Math.min(460, 60 + this.word.length * 36);
        const WORD_H = WORD_W * 0.28;

        this.target  = new Float32Array(this.n * 3);
        this.startP  = new Float32Array(this.n * 3);
        this.cur     = new Float32Array(this.n * 3);
        const colors = new Float32Array(this.n * 3);

        pixels.forEach((p, i) => {
            // 目标：字形，在局部坐标系（Points 会朝向摄像机）
            this.target[i*3]   = p.nx * WORD_W;
            this.target[i*3+1] = p.ny * WORD_H;
            this.target[i*3+2] = 0;

            // 起始：银河盘面随机散布（XZ 平面，少量 Y 扰动）
            const r     = 80 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            this.startP[i*3]   = Math.cos(theta) * r + (Math.random() - 0.5) * 60;
            this.startP[i*3+1] = (Math.random() - 0.5) * 30;
            this.startP[i*3+2] = Math.sin(theta) * r * 0.35 + (Math.random() - 0.5) * 40;

            this.cur[i*3]   = this.startP[i*3];
            this.cur[i*3+1] = this.startP[i*3+1];
            this.cur[i*3+2] = this.startP[i*3+2];

            // 颜色：蓝白为主，偶尔橙黄（呼应银河色调）
            const t = Math.random();
            if (t < 0.55) {
                // 蓝白
                colors[i*3]   = 0.55 + Math.random() * 0.35;
                colors[i*3+1] = 0.75 + Math.random() * 0.25;
                colors[i*3+2] = 1.0;
            } else if (t < 0.80) {
                // 纯白
                const w = 0.88 + Math.random() * 0.12;
                colors[i*3] = colors[i*3+1] = colors[i*3+2] = w;
            } else {
                // 暖橙
                colors[i*3]   = 1.0;
                colors[i*3+1] = 0.65 + Math.random() * 0.25;
                colors[i*3+2] = 0.2  + Math.random() * 0.2;
            }
        });

        // 每个粒子随机延迟（stagger），让聚合有涌入感
        this.delay = new Float32Array(this.n);
        for (let i = 0; i < this.n; i++) {
            this.delay[i] = Math.random() * 0.4;  // 0~40% 帧延迟
        }

        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.cur, 3));
        this.geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        this.mat = new THREE.PointsMaterial({
            size: 2.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.0,   // 从透明开始，聚合过程中渐显
            blending:  THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.points = new THREE.Points(this.geo, this.mat);
        // 悬浮在银河中心上方
        this.points.position.set(0, 85, 0);
        this.scene.add(this.points);
    }

    /* ── 每帧更新 ─────────────────────────────────────────────── */
    update() {
        if (this.phase === 'done' || !this.points) return;

        this.tick++;
        const pos = this.cur;

        /* 始终朝向摄像机（Billboard） */
        if (this.camera) {
            this.points.quaternion.copy(this.camera.quaternion);
        }

        if (this.phase === 'assembling') {
            const rawT = this.tick / this.T_ASSEMBLE;
            this.mat.opacity = Math.min(0.92, rawT * 1.6);

            for (let i = 0; i < this.n; i++) {
                // 每粒子有独立延迟
                const t    = Math.max(0, Math.min(1, (rawT - this.delay[i]) / (1 - this.delay[i])));
                const ease = 1 - Math.pow(1 - t, 3);  // easeOutCubic

                pos[i*3]   = this.startP[i*3]   + (this.target[i*3]   - this.startP[i*3])   * ease;
                pos[i*3+1] = this.startP[i*3+1] + (this.target[i*3+1] - this.startP[i*3+1]) * ease;
                pos[i*3+2] = this.startP[i*3+2] * (1 - ease);   // Z 轴压平（向摄像机平面汇聚）
            }
            this.geo.attributes.position.needsUpdate = true;

            if (rawT >= 1) { this.phase = 'holding'; this.tick = 0; }

        } else if (this.phase === 'holding') {
            this.mat.opacity = 0.92;
            // 微抖：粒子小幅震颤，营造"电浆感"
            const shimmer = 0.6 + 0.35 * Math.sin(this.tick * 0.08);
            for (let i = 0; i < this.n; i++) {
                pos[i*3]   = this.target[i*3]   + (Math.random() - 0.5) * shimmer;
                pos[i*3+1] = this.target[i*3+1] + (Math.random() - 0.5) * shimmer;
                pos[i*3+2] = (Math.random() - 0.5) * shimmer * 0.4;
            }
            this.geo.attributes.position.needsUpdate = true;

            if (this.tick >= this.T_HOLD) {
                // 提前生成爆散目标
                this.explode = new Float32Array(this.n * 3);
                for (let i = 0; i < this.n; i++) {
                    const r     = 250 + Math.random() * 450;
                    const theta = Math.random() * Math.PI * 2;
                    const phi   = (Math.random() - 0.5) * 0.7;
                    this.explode[i*3]   = Math.cos(theta) * r * Math.cos(phi);
                    this.explode[i*3+1] = r * Math.sin(phi) * 0.5;
                    this.explode[i*3+2] = Math.sin(theta) * r * 0.35;
                }
                this.phase = 'dispersing';
                this.tick  = 0;
            }

        } else if (this.phase === 'dispersing') {
            const t    = Math.min(1, this.tick / this.T_DISPERSE);
            const ease = t * t;  // easeInQuad
            this.mat.opacity = 0.92 * (1 - t);

            // 爆散时也加入螺旋离心力
            const angle = ease * Math.PI * 1.5;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            for (let i = 0; i < this.n; i++) {
                const currentX = this.target[i*3]   + (this.explode[i*3]   - this.target[i*3])   * ease;
                const currentY = this.target[i*3+1] + (this.explode[i*3+1] - this.target[i*3+1]) * ease;
                const currentZ = this.target[i*3+2] + (this.explode[i*3+2] - this.target[i*3+2]) * ease;

                pos[i*3]   = currentX * cosA - currentZ * sinA;
                pos[i*3+1] = currentY;
                pos[i*3+2] = currentX * sinA + currentZ * cosA;
            }
            this.geo.attributes.position.needsUpdate = true;

            if (t >= 1) {
                this.scene.remove(this.points);
                this.geo.dispose();
                this.mat.dispose();
                this.phase = 'done';
            }
        }
    }

    isDone() { return this.phase === 'done'; }

    /** 立即跳到消散阶段（用于强制切换） */
    forceDisperse() {
        if (this.phase === 'done') return;
        // 以当前位置作为目标，然后爆散
        this.explode = new Float32Array(this.n * 3);
        for (let i = 0; i < this.n; i++) {
            const r     = 200 + Math.random() * 400;
            const theta = Math.random() * Math.PI * 2;
            this.explode[i*3]   = Math.cos(theta) * r;
            this.explode[i*3+1] = (Math.random() - 0.5) * 150;
            this.explode[i*3+2] = Math.sin(theta) * r * 0.3;
        }
        // 把 target 设为当前位置
        for (let i = 0; i < this.n * 3; i++) {
            this.target[i] = this.cur[i];
        }
        this.phase = 'dispersing';
        this.tick  = 0;
    }
}
];
        }
        this.phase = 'dispersing';
        this.tick  = 0;
    }
}
