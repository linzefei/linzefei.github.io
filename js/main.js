// 添加错误检查
if (typeof THREE === 'undefined') {
    console.error('THREE is not loaded! Please check your Three.js include.');
    throw new Error('THREE is not loaded!');
}

let scene, camera, renderer;
let texts = [];
let controls; // 添加相机控制
let isOrbitMode = true; // 默认为场景旋转模式
let isDragging = false;
let selectedText = null;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();

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

        // 添加模式切换按钮的事件监听
        const modeSwitch = document.getElementById('mode-switch');
        const modeLabel = document.getElementById('mode-label');

        modeSwitch.addEventListener('click', () => {
            isOrbitMode = !isOrbitMode;
            controls.enabled = isOrbitMode;
            modeLabel.textContent = `当前模式：${isOrbitMode ? '场景旋转' : '文字引力'}`;
        });

        // 添加鼠标/触摸事件监听器
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        
        // 更新鼠标位置的函数
        function updateMousePosition(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }

        // 获取3D空间中的点
        function getIntersectionPoint(event) {
            updateMousePosition(event);
            
            // 创建一个平面，用于获取鼠标在3D空间中的位置
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const point = new THREE.Vector3();
            
            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, point);
            
            return point;
        }

        function onPointerDown(event) {
            if (!isOrbitMode) {
                updateMousePosition(event);
                raycaster.setFromCamera(mouse, camera);
                
                const intersects = raycaster.intersectObjects(texts.map(t => t.mesh));
                
                if (intersects.length > 0) {
                    isDragging = true;
                    selectedText = texts.find(t => t.mesh === intersects[0].object);
                    controls.enabled = false;
                    
                    const point = getIntersectionPoint(event);
                    selectedText.setAttractionTarget(point);
                }
            }
        }

        function onPointerMove(event) {
            if (!isOrbitMode && isDragging && selectedText) {
                const point = getIntersectionPoint(event);
                selectedText.setAttractionTarget(point);
            }
        }

        function onPointerUp(event) {
            if (!isOrbitMode && selectedText) {
                selectedText.releaseAttraction();
                selectedText = null;
                isDragging = false;
                controls.enabled = isOrbitMode;
            }
        }
    } catch (error) {
        console.error('Error in init:', error);
    }
}

function createTexts(font) {
    try {
        let previousText = null;
        const items = TextData.getNextPage();
        
        items.forEach((item, index) => {
            const radius = CONFIG.orbits.baseRadius + 
                         (index * CONFIG.orbits.radiusIncrement);
            
            const text3D = new Text3D(item.text, {
                size: CONFIG.textSize,
                height: CONFIG.textHeight,
                radius: radius,
                color: item.color,
                level: index,
                center: previousText ? previousText.mesh.position : new THREE.Vector3(0, 0, 0)
            });

            text3D.create(scene, font);
            texts.push(text3D);
            previousText = text3D;
        });

        // 如果还有更多文字，设置定时器加载下一批
        if (TextData.getCount() > (TextData.currentPage * TextData.pageSize)) {
            setTimeout(() => {
                createTexts(font);
            }, 2000);
        }
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