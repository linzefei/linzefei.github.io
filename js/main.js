if (typeof THREE === 'undefined') { throw new Error('Three.js not loaded'); }

let scene, camera, renderer, composer, controls, galaxy;
let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000003);
    
    const cfg = GALAXY_CONFIG.camera;
    camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth/window.innerHeight, cfg.near, cfg.far);
    camera.position.set(cfg.position.x, cfg.position.y, cfg.position.z);

    // ── 尝试初始化基础渲染器 ──
    try {
        renderer = new THREE.WebGLRenderer({ 
            antialias: false, 
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
    } catch (e) {
        // 如果还是失败，说明 WebGL 彻底不可用
        throw new Error("WebGL Not Supported");
    }
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); // 进一步限制像素比
    document.body.appendChild(renderer.domElement);

    // ── 尝试初始化后期处理（如果报错则自动回退到普通渲染） ──
    try {
        const renderScene = new THREE.RenderPass(scene, camera);
        // 降低 Bloom 采样分辨率
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth/2, window.innerHeight/2), 1.0, 0.4, 0.2);
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        console.log("Post-processing enabled.");
    } catch (e) {
        console.warn("Post-processing failed, falling back to basic rendering.");
        composer = null;
    }

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 150; controls.maxDistance = 2500;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.2;
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

    const total = Object.values(GALAXY_CONFIG.particles).reduce((a, b) => a + b, 0);
    const el = document.getElementById('particle-count');
    if (el) el.textContent = total.toLocaleString() + ' stars (Safe Mode)';
}

function animate() {
    requestAnimationFrame(animate);
    
    targetX = mouseX * 30; targetY = mouseY * 30;
    scene.position.x += (targetX - scene.position.x) * 0.05;
    scene.position.y += (targetY - scene.position.y) * 0.05;

    if(galaxy) galaxy.update();
    if(controls) controls.update();
    if(typeof window._wordTick === 'function') window._wordTick();
    
    // 如果 composer 存在则使用，否则直接用 renderer
    if(composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

window.addEventListener('load', () => {
    try {
        init();
        animate();
    } catch (err) {
        console.error("Critical Failure:", err);
        const msg = document.createElement('div');
        msg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;text-align:center;padding:20px;background:rgba(0,0,0,0.8);border-radius:10px;";
        msg.innerHTML = "<h3>WebGL Context Error</h3><p>Your browser is temporarily unable to provide 3D resources.<br><br><b>Please RESTART your browser</b> to clear the GPU memory.</p>";
        document.body.appendChild(msg);
    }
});
