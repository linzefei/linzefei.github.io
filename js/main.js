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
let visibleOrbits = 1; // 当前显示的轨道数量

// 定义全局 elements 对象
let elements;

// 将 updateOrbitDisplay 移到全局作用域
function updateOrbitDisplay() {
    try {
        // 确保 visibleOrbits 有效
        if (!visibleOrbits || visibleOrbits < 1) {
            visibleOrbits = 1;
        }
        
        texts.forEach((text, index) => {
            if (text) {
                text.visible = index < visibleOrbits;
                if (text.orbitLine) {
                    text.orbitLine.visible = index < visibleOrbits;
                }
            }
        });
        
        // 更新UI显示
        if (elements) {
            elements.orbitCount.textContent = visibleOrbits;
            elements.totalOrbits.textContent = TextData.getCount();
        }
        
        localStorage.setItem('visibleOrbits', visibleOrbits);
    } catch (error) {
        console.error('Error in updateOrbitDisplay:', error);
    }
}

function init() {
    try {
        // 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // 创建相机
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        
        // 从本地存储加载相机位置和旋转
        const savedCamera = JSON.parse(localStorage.getItem('cameraState'));
        if (savedCamera) {
            camera.position.set(savedCamera.position.x, savedCamera.position.y, savedCamera.position.z);
            camera.rotation.set(savedCamera.rotation.x, savedCamera.rotation.y, savedCamera.rotation.z);
        } else {
            // 使用默认位置
            camera.position.set(0, 100, 800);
        }
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
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 100;
        controls.maxDistance = 1500;
        controls.maxPolarAngle = Math.PI;

        // 从本地存储加载控制器状态
        const savedControls = JSON.parse(localStorage.getItem('controlsState'));
        if (savedControls) {
            controls.target.set(savedControls.target.x, savedControls.target.y, savedControls.target.z);
        }

        // 从本地存储加载所有状态，设置默认值
        const savedOrbitMode = localStorage.getItem('orbitMode');
        const savedTrailMode = localStorage.getItem('trailMode');
        const savedVisibleOrbits = localStorage.getItem('visibleOrbits');
        const savedSpeed = localStorage.getItem('rotationSpeed');
        const savedAdvancedVisible = localStorage.getItem('advancedVisible');

        // 修改默认设置，visibleOrbits 默认为 null（表示新用户）
        const defaultSettings = {
            orbitMode: true,          // 默认：旋转镜头
            trailMode: false,         // 默认：部分轨迹
            visibleOrbits: null,      // null 表示新用户，将显示全部轨道
            speed: 1.0,               // 默认：速度1.0
            advancedVisible: false    // 默认：高级选项隐藏
        };

        // 应用设置，对于新用户显示全部轨道
        isOrbitMode = savedOrbitMode !== null ? savedOrbitMode === 'true' : defaultSettings.orbitMode;
        const showFullTrail = savedTrailMode !== null ? savedTrailMode === 'true' : defaultSettings.trailMode;
        // 如果是新用户（savedVisibleOrbits 为 null），则使用 TextData.getCount()
        visibleOrbits = savedVisibleOrbits ? parseInt(savedVisibleOrbits) : TextData.getCount();
        window.initialSpeed = parseFloat(savedSpeed || defaultSettings.speed);
        const showAdvanced = savedAdvancedVisible === 'true';

        // 获取所有UI元素
        elements = {
            modeSwitch: document.getElementById('mode-switch'),
            trailSwitch: document.getElementById('trail-switch'),
            orbitDebug: document.getElementById('orbit-debug'),
            orbitCount: document.getElementById('orbit-count'),
            totalOrbits: document.getElementById('total-orbits'),  // 添加总轨道数显示
            showAllOrbits: document.getElementById('show-all-orbits'),  // 添加显示全部按钮
            speedSlider: document.getElementById('speed-slider'),
            speedValue: document.getElementById('speed-value'),
            showAdvanced: document.getElementById('show-advanced'),
            advancedControls: document.getElementById('advanced-controls'),
            resetSettings: document.getElementById('reset-settings')
        };

        // 更新UI状态
        updateModeButton(elements.modeSwitch, isOrbitMode);
        updateTrailButton(elements.trailSwitch, showFullTrail);
        elements.orbitCount.textContent = visibleOrbits;
        elements.speedSlider.value = window.initialSpeed;
        elements.speedValue.textContent = window.initialSpeed;
        controls.enabled = isOrbitMode;

        // 设置高级选项的初始状态
        elements.advancedControls.style.display = showAdvanced ? 'block' : 'none';
        elements.showAdvanced.textContent = showAdvanced ? '隐藏高级选项' : '显示高级选项';

        // 添加轨迹切换按钮事件
        elements.trailSwitch.addEventListener('click', () => {
            const currentState = texts.length > 0 ? texts[0].orbitLine.showFullTrail : false;
            const newState = !currentState;
            
            texts.forEach(text => {
                if (text && text.orbitLine) {
                    text.orbitLine.showFullTrail = newState;
                }
            });
            
            updateTrailButton(elements.trailSwitch, newState);
            localStorage.setItem('trailMode', newState);
        });

        // 添加高级选项的事件监听
        elements.showAdvanced.addEventListener('click', () => {
            const isVisible = elements.advancedControls.style.display === 'none';
            elements.advancedControls.style.display = isVisible ? 'block' : 'none';
            elements.showAdvanced.textContent = isVisible ? '隐藏高级选项' : '显示高级选项';
            localStorage.setItem('advancedVisible', isVisible);
        });

        // 添加显示全部轨道按钮事件
        elements.showAllOrbits.addEventListener('click', () => {
            visibleOrbits = TextData.getCount();
            updateOrbitDisplay();
        });

        // 添加轨道切换按钮事件
        elements.orbitDebug.addEventListener('click', () => {
            const maxOrbits = TextData.getCount();
            // 如果当前显示的是最后一个数量，则回到1，否则加1
            if (visibleOrbits >= maxOrbits) {
                visibleOrbits = 1;
            } else {
                visibleOrbits++;
            }
            updateOrbitDisplay();
        });

        // 添加速度控制事件监听
        elements.speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            elements.speedValue.textContent = speed.toFixed(1);
            
            texts.forEach(text => {
                text.setRotationSpeed(speed);
            });
            
            localStorage.setItem('rotationSpeed', speed);
        });

        // 如果是新用户，保存默认设置
        if (savedOrbitMode === null) {
            saveSettings({
                orbitMode: defaultSettings.orbitMode,
                trailMode: defaultSettings.trailMode,
                visibleOrbits: TextData.getCount(), // 保存全部轨道数
                speed: defaultSettings.speed,
                advancedVisible: defaultSettings.advancedVisible
            });
        }

        // 添加模式切换按钮的事件监听
        elements.modeSwitch.addEventListener('click', () => {
            isOrbitMode = !isOrbitMode;
            updateModeButton(elements.modeSwitch, isOrbitMode);
            controls.enabled = isOrbitMode;
            localStorage.setItem('orbitMode', isOrbitMode);
            // 重置拖拽状态
            isDragging = false;
        });

        // 修改重置按钮事件监听器
        elements.resetSettings.addEventListener('click', () => {
            if (confirm('确定要重置所有设置吗？这将恢复到默认状态。')) {
                resetToDefaults();
            }
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
        const savedTrailMode = localStorage.getItem('trailMode');
        const showFullTrail = savedTrailMode !== null ? savedTrailMode === 'true' : false;
        
        // 确保 visibleOrbits 有有效值
        if (!visibleOrbits || visibleOrbits < 1) {
            visibleOrbits = 1;
        }
        
        // 更新UI显示
        if (elements && elements.totalOrbits) {
            elements.totalOrbits.textContent = TextData.getCount();
            elements.orbitCount.textContent = visibleOrbits;
        }

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
            
            // 应用保存的速度
            if (window.initialSpeed) {
                text3D.setRotationSpeed(window.initialSpeed);
            }
            
            if (text3D.orbitLine) {
                text3D.orbitLine.showFullTrail = showFullTrail;
                text3D.orbitLine.visible = index < visibleOrbits;
            }
            text3D.visible = index < visibleOrbits;
            
            texts.push(text3D);
            previousText = text3D;
        });

        // 如果还有更多文字，设置定时器加载下一批
        if (TextData.getCount() > (TextData.currentPage * TextData.pageSize)) {
            setTimeout(() => {
                createTexts(font);
            }, 2000);
        } else {
            // 所有文字加载完成后，再次更新总轨道数
            if (elements && elements.totalOrbits) {
                elements.totalOrbits.textContent = texts.length;
            }
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
    // 保存相机状态
    const cameraState = {
        position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        },
        rotation: {
            x: camera.rotation.x,
            y: camera.rotation.y,
            z: camera.rotation.z
        }
    };
    localStorage.setItem('cameraState', JSON.stringify(cameraState));

    // 保存控制器状态
    const controlsState = {
        target: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z
        }
    };
    localStorage.setItem('controlsState', JSON.stringify(controlsState));

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

// 添加定期保存状态的功能，防止意外关闭
function autoSaveState() {
    if (camera && controls) {
        const cameraState = {
            position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            rotation: {
                x: camera.rotation.x,
                y: camera.rotation.y,
                z: camera.rotation.z
            }
        };
        localStorage.setItem('cameraState', JSON.stringify(cameraState));

        const controlsState = {
            target: {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z
            }
        };
        localStorage.setItem('controlsState', JSON.stringify(controlsState));
    }
}

// 每5秒自动保存一次状态
setInterval(autoSaveState, 5000);

// 添加保存设置的辅助函数
function saveSettings(settings) {
    if (settings.orbitMode !== undefined) 
        localStorage.setItem('orbitMode', settings.orbitMode);
    if (settings.trailMode !== undefined) 
        localStorage.setItem('trailMode', settings.trailMode);
    if (settings.visibleOrbits !== undefined) 
        localStorage.setItem('visibleOrbits', settings.visibleOrbits);
    if (settings.speed !== undefined) 
        localStorage.setItem('rotationSpeed', settings.speed);
    if (settings.advancedVisible !== undefined) 
        localStorage.setItem('advancedVisible', settings.advancedVisible);
}

// 将 resetToDefaults 函数移到全局作用域
function resetToDefaults() {
    try {
        // 检查 elements 是否已定义
        if (!elements) {
            throw new Error('UI elements not initialized');
        }

        // 清除所有本地存储
        localStorage.clear();
        
        // 重置操作模式
        isOrbitMode = true;
        controls.enabled = true;
        updateModeButton(elements.modeSwitch, true);
        
        // 重置轨迹显示
        texts.forEach(text => {
            if (text && text.orbitLine) {
                text.orbitLine.showFullTrail = false;
            }
        });
        updateTrailButton(elements.trailSwitch, false);
        
        // 重置速度
        const speed = 1.0;
        elements.speedSlider.value = speed;
        elements.speedValue.textContent = speed.toFixed(1);
        texts.forEach(text => {
            text.setRotationSpeed(speed);
        });
        
        // 重置轨道显示为全部轨道
        visibleOrbits = TextData.getCount();
        texts.forEach((text, index) => {
            text.visible = true;
            if (text.orbitLine) {
                text.orbitLine.visible = true;
            }
        });
        updateOrbitDisplay();
        
        // 重置高级选项显示状态
        elements.advancedControls.style.display = 'none';
        elements.showAdvanced.textContent = '显示高级选项';
        
        // 重置相机位置和控制器
        camera.position.set(0, 100, 800);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        
        // 重置拖拽状态
        isDragging = false;
        selectedText = null;
        
        // 保存默认设置（与新用户设置相同）
        saveSettings({
            orbitMode: true,
            trailMode: false,
            visibleOrbits: TextData.getCount(), // 使用总轨道数
            speed: 1.0,
            advancedVisible: false
        });
        
        console.log('Settings reset successfully');
    } catch (error) {
        console.error('Error in resetToDefaults:', error);
        alert('重置设置失败，请刷新页面后重试');
    }
}