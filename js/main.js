// 添加错误检查
if (typeof THREE === 'undefined') {
    console.error('THREE is not loaded! Please check your Three.js include.');
    throw new Error('THREE is not loaded!');
}

let scene, camera, renderer;
let texts = [];
let controls;
let isInitialized = false; // 添加初始化标志

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

        // 添加相机控制
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 100;
        controls.maxDistance = 1500;
        controls.maxPolarAngle = Math.PI;

        // 添加窗口大小变化事件监听器
        window.addEventListener('resize', onWindowResize, false);

        // 加载字体并创建文字
        const loader = new THREE.FontLoader();
        loader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            function(font) {
                createTexts(font);
                isInitialized = true; // 标记初始化完成
                animate(); // 在这里开始动画循环
            },
            function(xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function(err) {
                console.error('Font loading error:', err);
            }
        );
    } catch (error) {
        console.error('Error in init:', error);
    }
}

function createTexts(font) {
    try {
        const textCount = CONFIG.texts.length;
        const verticalSpacing = CONFIG.verticalSpacing;
        
        CONFIG.texts.forEach((text, index) => {
            const verticalOffset = (index - textCount/2) * verticalSpacing;
            
            const text3D = new Text3D(text, {
                size: CONFIG.textSize,
                height: CONFIG.textHeight,
                radius: CONFIG.orbitRadius,
                colors: CONFIG.colors,
                rotationSpeed: CONFIG.rotationSpeed,
                verticalOffset: verticalOffset
            });

            text3D.create(scene, font);
            texts.push(text3D);
        });
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
    if (!isInitialized) return; // 如果未初始化完成，不执行动画

    requestAnimationFrame(animate);
    if (texts.length > 0) {
        texts.forEach(text => text.update());
    }
    if (controls) {
        controls.update();
    }
    renderer.render(scene, camera);
}

// 只初始化场景，animate 会在字体加载完成后开始
window.addEventListener('load', function() {
    init();
});