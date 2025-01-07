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
			color: this.params.colors[Math.floor(Math.random() * this.params.colors.length)],
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

		// 更新轨道位置
		this.orbit.angle += this.orbit.speed * 0.01;
		
		// 计算基础轨道位置
		const position = new THREE.Vector3(
			Math.cos(this.orbit.angle) * this.orbit.radius,
			0,
			Math.sin(this.orbit.angle) * this.orbit.radius
		);

		// 应用轨道倾斜
		position.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.orbit.tilt);
		
		// 相对于轨道中心点设置位置
		this.mesh.position.copy(this.orbit.center).add(position);

		// 使文字朝向轨道中心
		this.mesh.lookAt(this.orbit.center);
		
		// 保持文字稍微向上倾斜
		this.mesh.rotateX(Math.PI * 0.1);
	}
}
