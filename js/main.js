if (typeof THREE === 'undefined') {
    throw new Error('Three.js not loaded');
}

let scene, camera, renderer, composer, controls, galaxy, clock;

// 视差参数 (Parallax)
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000003);
    scene.fog = new THREE.FogExp2(0x000003, 0.00018);

    // Camera
    const cfg = GALAXY_CONFIG.camera;
    camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth / window.innerHeight, cfg.near, cfg.far);
    camera.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // ── 后期处理与辉光 (Bloom) ───────────────────────────────────────────────
    const renderScene = new THREE.RenderPass(scene, camera);
    
    // 参数: 分辨率, strength (强度), radius (半径), threshold (阈值)
    // 阈值设为 0.15 保证暗弱背景星不发光，只有高亮的文字、流星和星系核心发光
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.15);
    
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.06;
    controls.minDistance    = 120;
    controls.maxDistance    = 3000;
    controls.autoRotate     = true;
    controls.autoRotateSpeed = 0.18;
    controls.enablePan      = false;

    // Pause auto-rotate while user drags, resume after
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    controls.addEventListener('end',   () => {
        setTimeout(() => { controls.autoRotate = true; }, 3500);
    });

    // ── 鼠标视差监听 (Mouse Parallax) ────────────────────────────────────────
    window.addEventListener('mousemove', (event) => {
        // 归一化鼠标坐标 [-1, 1]
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Galaxy
    galaxy = new Galaxy(scene);
    galaxy.init();

    // Clock
    clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', onResize);

    // Particle count info
    const total = Object.values(GALAXY_CONFIG.particles).reduce((a, b) => a + b, 0);
    const el = document.getElementById('particle-count');
    if (el) el.textContent = total.toLocaleString() + ' stars';
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // ── 视差运算：给 scene 施加平滑偏移 ──────────────────────────────────────
    targetX = mouseX * 40;  // 偏移幅度系数
    targetY = mouseY * 40;
    scene.position.x += (targetX - scene.position.x) * 0.05; // 缓动插值
    scene.position.y += (targetY - scene.position.y) * 0.05;

    galaxy.update();
    controls.update();
    if (typeof window._wordTick === 'function') window._wordTick();
    
    // 使用 composer 替代 renderer
    composer.render();
}

window.addEventListener('load', () => {
    init();
    animate();
});
