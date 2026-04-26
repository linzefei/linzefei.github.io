if (typeof THREE === 'undefined') { throw new Error('Three.js not loaded'); }

let scene, camera, renderer, composer, controls, galaxy;
let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000003);
    scene.fog = new THREE.FogExp2(0x000003, 0.00018);

    const cfg = GALAXY_CONFIG.camera;
    camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth/window.innerHeight, cfg.near, cfg.far);
    camera.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    camera.lookAt(0, 0, 0);

    // ── 性能优化：关闭抗锯齿(antialias:false)，在 Bloom 模式下这能节省大量显存 ──
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 限制像素比，高分屏最高只用 1.5 倍，防止 4K 屏渲染缓冲区过大导致 OOM
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.body.appendChild(renderer.domElement);

    // ── 后期处理 ──
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.15);
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // ── 控制器 ──
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.minDistance = 120; controls.maxDistance = 3000;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.18;
    controls.enablePan = false;

    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    galaxy = new Galaxy(scene);
    galaxy.init();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    });

    // 更新界面星星计数
    const total = Object.values(GALAXY_CONFIG.particles).reduce((a, b) => a + b, 0);
    const el = document.getElementById('particle-count');
    if (el) el.textContent = total.toLocaleString() + ' stars';
}

function animate() {
    requestAnimationFrame(animate);
    targetX = mouseX * 40; targetY = mouseY * 40;
    scene.position.x += (targetX - scene.position.x) * 0.05;
    scene.position.y += (targetY - scene.position.y) * 0.05;

    if(galaxy) galaxy.update();
    if(controls) controls.update();
    if(typeof window._wordTick === 'function') window._wordTick();
    
    if(composer) composer.render();
}

window.addEventListener('load', () => {
    try {
        init();
        animate();
    } catch (err) {
        console.error("Initialization failed:", err);
        const msg = document.createElement('div');
        msg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;text-align:center;font-family:sans-serif;";
        msg.innerHTML = "<h3>Hardware Acceleration Required</h3><p>Your browser or GPU is struggling with WebGL resources.<br>Please try closing other tabs or restarting your browser.</p>";
        document.body.appendChild(msg);
    }
});
