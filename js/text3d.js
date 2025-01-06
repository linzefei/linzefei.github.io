class Text3D {
	constructor(text, params) {
		this.text = text;
		this.mesh = null;
		this.params = params;
		
		// 轨道参数
		this.orbit = {
			radius: params.radius || 300,
			angle: Math.random() * Math.PI * 2,
			speed: (Math.random() * 0.5 + 0.5) * params.rotationSpeed,
			height: params.verticalOffset || 0,
			tilt: Math.random() * Math.PI * 0.25  // 轨道倾斜角度
		};
		
		// 自转速度
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
		
		// 计算椭圆轨道位置
		const ellipticalFactor = 1.5; // 椭圆系数
		this.mesh.position.x = Math.cos(this.orbit.angle) * this.orbit.radius;
		this.mesh.position.z = Math.sin(this.orbit.angle) * this.orbit.radius * ellipticalFactor;
		
		// 添加垂直运动
		this.mesh.position.y = this.orbit.height + 
			Math.sin(this.orbit.angle * 0.5) * 50; // 上下波动
		
		// 应用轨道倾斜
		const tiltMatrix = new THREE.Matrix4();
		tiltMatrix.makeRotationX(this.orbit.tilt);
		this.mesh.position.applyMatrix4(tiltMatrix);

		// 使文字始终朝向轨道中心
		this.mesh.lookAt(0, this.mesh.position.y, 0);
		
		// 添加自转效果
		this.mesh.rotation.x += this.selfRotation.x;
		this.mesh.rotation.y += this.selfRotation.y;
		this.mesh.rotation.z = Math.PI * 0.1; // 保持固定的倾斜角度
	}
}
