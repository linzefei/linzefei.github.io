class Text3D {
	constructor(text, params) {
		this.text = text;
		this.mesh = null;
		this.params = params;
		this.angle = Math.random() * Math.PI * 2;
		this.verticalOffset = params.verticalOffset || 0;
		this.rotationSpeed = (Math.random() * 0.5 + 0.5) * params.rotationSpeed;
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

		this.angle += this.rotationSpeed * 0.01;
		
		// 计算位置
		this.mesh.position.x = Math.cos(this.angle) * this.params.radius;
		this.mesh.position.z = Math.sin(this.angle) * this.params.radius;
		this.mesh.position.y = this.verticalOffset;

		// 始终朝向中心
		this.mesh.lookAt(0, this.mesh.position.y, 0);
		
		// 添加一点倾斜
		this.mesh.rotation.z = Math.PI * 0.1;
	}
}
