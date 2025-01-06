let scene, camera, renderer, textMesh;

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);

    // 创建相机
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 200, 500);
    camera.lookAt(0, 0, 0);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 创建3D文本
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const geometry = new THREE.TextGeometry('Hello, 橙子!', {
            font: font,
            size: 80,
            height: 5,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 10,
            bevelSize: 8,
            bevelSegments: 5
        });
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        textMesh = new THREE.Mesh(geometry, material);
        scene.add(textMesh);
    });

    // 添加窗口大小变化事件监听器
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    // 更新文本的位置，实现运动效果
    const time = Date.now() * 0.001;
    textMesh.position.x = Math.sin(time) * 200;
    textMesh.position.y = Math.cos(time * 0.5) * 100;
    renderer.render(scene, camera);
}

init();
animate();