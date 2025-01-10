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
		
		// 添加引力线相关属性
		this.gravityLine = {
			active: false,
			source: null,
			line: null,
			scene: null,  // 添加scene引用
			maxLength: 500,
			breakThreshold: 800,
			segments: 10,
			strength: 0.1,
			tension: 0.3
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

		try {
			// 更新引力线
			this.updateGravityLine();

			if (this.attraction.active) {
				// 计算引力效果
				const direction = new THREE.Vector3().subVectors(this.attraction.target, this.mesh.position);
				const distance = direction.length();
				
				if (distance > 1) {
					direction.normalize();
					// 添加原有轨道运动的影响
					const orbitForce = this.calculateOrbitForce();
					this.mesh.position.add(direction.multiplyScalar(this.gravityLine.strength * distance));
					this.mesh.position.add(orbitForce.multiplyScalar(0.3)); // 保持部分轨道运动
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
				
				const targetPosition = new THREE.Vector3().copy(this.orbit.center).add(position);
				this.mesh.position.lerp(targetPosition, this.attraction.returnSpeed);
			}

			// 使文字朝向轨道中心
			this.mesh.lookAt(this.orbit.center);
			this.mesh.rotateX(Math.PI * 0.1);
		} catch (error) {
			console.error('Error in update:', error);
			this.releaseGravityLine(); // 出错时释放引力线
		}
	}

	// 添加新方法
	setAttractionTarget(point) {
		this.attraction.target.copy(point);
		this.attraction.active = true;
	}

	releaseAttraction() {
		this.attraction.active = false;
	}

	// 创建引力线
	createGravityLine(scene, source) {
		// 如果已经存在引力线，先清除
		this.releaseGravityLine();
		
		const lineGeometry = new THREE.BufferGeometry();
		const lineMaterial = new THREE.LineDashedMaterial({
			color: this.params.color,
			linewidth: 1,
			scale: 1,
			dashSize: 3,
			gapSize: 1,
		});

		const points = new Float32Array(6);
		lineGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
		
		const line = new THREE.Line(lineGeometry, lineMaterial);
		line.computeLineDistances();
		
		this.gravityLine.line = line;
		this.gravityLine.source = source.clone(); // 克隆源点
		this.gravityLine.active = true;
		this.gravityLine.scene = scene; // 保存scene引用
		
		scene.add(line);
	}

	// 更新引力线
	updateGravityLine() {
		if (!this.gravityLine.active || !this.gravityLine.line || !this.gravityLine.source) return;

		try {
			const sourcePos = this.gravityLine.source;
			const targetPos = this.mesh.position;
			
			// 计算距离
			const distance = sourcePos.distanceTo(targetPos);
			
			// 更新线条材质
			const material = this.gravityLine.line.material;
			material.dashSize = Math.min(5, 10 * (1 - distance / this.gravityLine.maxLength));
			material.gapSize = Math.max(1, 3 * (distance / this.gravityLine.maxLength));
			
			// 更新线条位置
			const positions = this.gravityLine.line.geometry.attributes.position.array;
			positions[0] = sourcePos.x;
			positions[1] = sourcePos.y;
			positions[2] = sourcePos.z;
			positions[3] = targetPos.x;
			positions[4] = targetPos.y;
			positions[5] = targetPos.z;
			
			this.gravityLine.line.geometry.attributes.position.needsUpdate = true;
			this.gravityLine.line.computeLineDistances();

			// 检查是否需要断开
			if (distance > this.gravityLine.breakThreshold) {
				this.releaseGravityLine();
			}
		} catch (error) {
			console.error('Error updating gravity line:', error);
			this.releaseGravityLine(); // 出错时释放引力线
		}
	}

	// 释放引力线
	releaseGravityLine() {
		if (this.gravityLine.line && this.gravityLine.scene) {
			this.gravityLine.scene.remove(this.gravityLine.line);
			this.gravityLine.line.geometry.dispose();
			this.gravityLine.line.material.dispose();
			this.gravityLine.line = null;
		}
		this.gravityLine.active = false;
		this.gravityLine.source = null;
		this.gravityLine.scene = null;
		this.releaseAttraction();
	}

	// 计算轨道运动力
	calculateOrbitForce() {
		const currentPos = new THREE.Vector3().copy(this.mesh.position);
		this.orbit.angle += this.orbit.speed * 0.01;
		
		const nextPos = new THREE.Vector3(
			Math.cos(this.orbit.angle) * this.orbit.radius,
			0,
			Math.sin(this.orbit.angle) * this.orbit.radius
		);
		nextPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.orbit.tilt);
		
		return nextPos.sub(currentPos);
	}
}
