class Text3D {
	constructor(text, params) {
		this.text = text;
		this.mesh = null;
		this.params = params;
		
		// 修改轨道参数
		this.orbit = {
			center: params.center || new THREE.Vector3(0, 0, 0), // 轨道中心点
			radius: params.radius || CONFIG.orbits.baseRadius,
			angle: Math.random() * Math.PI * 2,
			speed: THREE.MathUtils.lerp(
				CONFIG.orbits.rotationSpeed.min,
				CONFIG.orbits.rotationSpeed.max,
				Math.random()
			),
			tilt: params.level * CONFIG.orbits.tilt  // 根据层级设置倾斜角度
		};
		
		// 自转速度保持不变
		this.selfRotation = {
			x: (Math.random() - 0.5) * 0.01,
			y: (Math.random() - 0.5) * 0.01,
			z: (Math.random() - 0.5) * 0.01
		};
		
		// 添加原始轨道位置记录
		this.originalOrbit = { ...this.orbit };
		
		// 添加吸引力相关属性
		this.attraction = {
			active: false,
			target: new THREE.Vector3(),
			strength: 0.1,
			returnSpeed: 0.05
		};
	}

	create(scene, font) {
		const geometry = new THREE.TextGeometry(this.text, {
			font: font,
			size: this.params.size,
			height: this.params.height,
			curveSegments: 12,
			bevelEnabled: true,
			bevelThickness: 1,
			bevelSize: 0.5,
			bevelSegments: 3
		});

		const material = new THREE.MeshPhongMaterial({
			color: this.params.color,
			specular: 0xffffff,
			shininess: 100
		});

		this.mesh = new THREE.Mesh(geometry, material);
		geometry.computeBoundingBox();
		geometry.center();
		
		scene.add(this.mesh);
	}

	update() {
		if (!this.mesh) return;

		if (this.attraction.active) {
			// 计算朝向鼠标/触摸点的吸引力
			const direction = new THREE.Vector3().subVectors(this.attraction.target, this.mesh.position);
			const distance = direction.length();
			
			if (distance > 1) {
				direction.normalize();
				this.mesh.position.add(direction.multiplyScalar(this.attraction.strength * distance));
			}
		} else {
			// 正常轨道运动
			this.orbit.angle += this.orbit.speed * 0.01;
			
			const position = new THREE.Vector3(
				Math.cos(this.orbit.angle) * this.orbit.radius,
				0,
				Math.sin(this.orbit.angle) * this.orbit.radius
			);

			position.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.orbit.tilt);
			
			// 平滑回归原始轨道
			const targetPosition = new THREE.Vector3().copy(this.orbit.center).add(position);
			this.mesh.position.lerp(targetPosition, this.attraction.returnSpeed);
		}

		// 使文字朝向轨道中心
		this.mesh.lookAt(this.orbit.center);
		this.mesh.rotateX(Math.PI * 0.1);
	}

	// 添加新方法
	setAttractionTarget(point) {
		this.attraction.target.copy(point);
		this.attraction.active = true;
	}

	releaseAttraction() {
		this.attraction.active = false;
	}
}
