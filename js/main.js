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

        // 从本地存储加载上次的状态
        const savedOrbitMode = localStorage.getItem('orbitMode');
        const savedTrailMode = localStorage.getItem('trailMode');
        
        isOrbitMode = savedOrbitMode ? savedOrbitMode === 'true' : true;
        const showFullTrail = savedTrailMode ? savedTrailMode === 'true' : false;
        
        // 添加模式切换按钮的事件监听
        const modeSwitch = document.getElementById('mode-switch');
        const trailSwitch = document.getElementById('trail-switch');
        
        // 初始化按钮状态
        updateModeButton(modeSwitch, isOrbitMode);
        updateTrailButton(trailSwitch, showFullTrail);
        controls.enabled = isOrbitMode;

        modeSwitch.addEventListener('click', () => {
            isOrbitMode = !isOrbitMode;
            updateModeButton(modeSwitch, isOrbitMode);
            controls.enabled = isOrbitMode;
            localStorage.setItem('orbitMode', isOrbitMode);
        });

        // 添加轨迹模式切换按钮的事件监听
        trailSwitch.addEventListener('click', () => {
            // 安全地获取当前状态
            const currentState = texts.length > 0 ? texts[0].orbitLine.showFullTrail : false;
            const newState = !currentState;
            
            texts.forEach(text => {
                if (text && text.orbitLine) {
                    text.orbitLine.showFullTrail = newState;
                }
            });
            
            updateTrailButton(trailSwitch, newState);
            localStorage.setItem('trailMode', newState);
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
                const point = getIntersectionPoint(event);
                
                // 查找附近的文字
                texts.forEach(text => {
                    const distance = text.mesh.position.distanceTo(point);
                    if (distance < 200) { // 设置吸引范围
                        isDragging = true;
                        text.createGravityLine(scene, point);
                        text.setAttractionTarget(point);
                    }
                });
            }
        }

        function onPointerMove(event) {
            if (!isOrbitMode && isDragging) {
                const point = getIntersectionPoint(event);
                texts.forEach(text => {
                    if (text.gravityLine.active) {
                        text.gravityLine.source.copy(point);
                        text.setAttractionTarget(point);
                    }
                });
            }
        }

        function onPointerUp(event) {
            if (!isOrbitMode) {
                texts.forEach(text => {
                    try {
                        if (text && text.gravityLine && text.gravityLine.active) {
                            text.releaseGravityLine();
                        }
                    } catch (error) {
                        console.error('Error releasing gravity line:', error);
                    }
                });
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
        const savedTrailMode = localStorage.getItem('trailMode') === 'true';
        
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
            text3D.createOrbitLine(scene);
            
            if (text3D.orbitLine) {
                text3D.orbitLine.showFullTrail = savedTrailMode;
            }
            
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

// 添加清理函数
function cleanup() {
    texts.forEach(text => {
        if (text && text.gravityLine && text.gravityLine.active) {
            text.releaseGravityLine();
        }
        if (text && text.orbitLine && text.orbitLine.line) {
            text.releaseOrbitLine(scene);
        }
    });
}

// 添加页面卸载时的清理
window.addEventListener('beforeunload', cleanup);

// 更新模式切换按钮的状态
function updateModeButton(button, isOrbitMode) {
    button.textContent = `操作模式：${isOrbitMode ? '旋转镜头' : '发出引力'}`;
    button.classList.toggle('active', !isOrbitMode);
}

// 更新轨迹模式按钮的状态
function updateTrailButton(button, isFullTrail) {
    button.textContent = `轨迹显示：${isFullTrail ? '完整' : '部分'}`;
    button.classList.toggle('active', isFullTrail);
}