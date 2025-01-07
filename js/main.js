// 添加错误检查
if (typeof THREE === 'undefined') {
    console.error('THREE is not loaded! Please check your Three.js include.');
    throw new Error('THREE is not loaded!');
}

let scene, camera, renderer;
let texts = [];
let controls; // 添加相机控制

function init() {
    try {
        // 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // 创建相机
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        camera.position.set(0, 100, 800);
        camera.lookAt(0, 0, 0);

        // 创建渲染器
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // 添加灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(100, 100, 100);
        scene.add(pointLight);

        // 加载字体并创建文字
        const loader = new THREE.FontLoader();
        
        loader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            function(font) {
                createTexts(font);
            },
            function(xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function(err) {
                console.error('Font loading error:', err);
            }
        );

        // 添加窗口大小变化事件监听器
        window.addEventListener('resize', onWindowResize, false);

        // 添加相机控制
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // 添加阻尼效果
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 100;
        controls.maxDistance = 1500;
        controls.maxPolarAngle = Math.PI;
    } catch (error) {
        console.error('Error in init:', error);
    }
}

function createTexts(font) {
    try {
        let previousText = null;
        
        CONFIG.texts.forEach((text, index) => {
            const radius = CONFIG.orbits.baseRadius + 
                         (index * CONFIG.orbits.radiusIncrement);
            
            const text3D = new Text3D(text, {
                size: CONFIG.textSize,
                height: CONFIG.textHeight,
                radius: radius,
                colors: CONFIG.colors,
                level: index,
                // 如果是第一个文本，中心点是原点；否则是前一个文本的位置
                center: previousText ? previousText.mesh.position : new THREE.Vector3(0, 0, 0)
            });

            text3D.create(scene, font);
            texts.push(text3D);
            previousText = text3D;
        });

        // 调整相机位置以便更好地观察整个场景
        camera.position.set(0, 500, 1000);
        camera.lookAt(0, 0, 0);
        
    } catch (error) {
        console.error('Error creating texts:', error);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (texts.length > 0) {
        texts.forEach(text => text.update());
    }
    controls.update(); // 更新控制器
    renderer.render(scene, camera);
}

// 确保所有资源加载完成后再初始化
window.addEventListener('load', function() {
    init();
    animate();
});