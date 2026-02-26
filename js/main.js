if (typeof THREE === 'undefined') {
    throw new Error('Three.js not loaded');
}

let scene, camera, renderer, controls, galaxy, clock;

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
}

function animate() {
    requestAnimationFrame(animate);
    galaxy.update();
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('load', () => {
    init();
    animate();
});
