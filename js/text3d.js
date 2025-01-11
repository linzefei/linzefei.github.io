class Text3D {
	constructor(text, params) {
		this.text = text;
		this.mesh = null;
		this.params = params;
		
		// 修改轨道参数，确保固定轨道
		this.orbit = {
			center: new THREE.Vector3(0, 0, 0), // 统一使用原点作为中心
			radius: params.radius || CONFIG.orbits.baseRadius,
			angle: Math.random() * Math.PI * 2,
			speed: THREE.MathUtils.lerp(
				CONFIG.orbits.rotationSpeed.min,
				CONFIG.orbits.rotationSpeed.max,
				Math.random()
			),
			tilt: params.level * CONFIG.orbits.tilt,
			level: params.level || 0
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
		
		// 添加轨道线相关属性
		this.orbitLine = {
			line: null,
			segments: 128,
			colors: null,
			showFullTrail: false,
			visible: false  // 添加可见性控制
		};
		
		// 添加整体可见性控制
		this.visible = false;
		
		// 添加基础速度属性
		this.baseSpeed = 1.0;
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
			shininess: 100,
			transparent: true,
			depthWrite: false
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.renderOrder = 1000 - this.orbit.level;
		geometry.computeBoundingBox();
		geometry.center();
		
		scene.add(this.mesh);
	}

	update() {
		if (!this.mesh) return;

		try {
			this.mesh.visible = this.visible;
			if (this.orbitLine.line) {
				this.orbitLine.line.visible = this.visible && this.orbitLine.visible;
			}

			if (this.visible) {
				if (!this.attraction.active) {
					// 更新角度
					this.orbit.angle += this.orbit.speed * 0.01 * this.baseSpeed;

					// 计算基础位置（XZ平面上的圆）
					const basePosition = new THREE.Vector3(
						Math.cos(this.orbit.angle) * this.orbit.radius,
						0,
						Math.sin(this.orbit.angle) * this.orbit.radius
					);

					// 应用倾斜变换
					const tiltMatrix = new THREE.Matrix4().makeRotationX(this.orbit.tilt);
					basePosition.applyMatrix4(tiltMatrix);

					// 添加Z轴偏移
					basePosition.z += this.orbit.level * CONFIG.orbits.zOffset;

					// 设置最终位置
					this.mesh.position.copy(basePosition);

					// 使文字朝向中心
					this.mesh.lookAt(0, 0, 0);
					this.mesh.rotateX(Math.PI * 0.1);
				}

				if (this.gravityLine.active) {
					this.updateGravityLine();
				}

				if (this.attraction.active) {
					// 计算引力效果
					const direction = new THREE.Vector3().subVectors(this.attraction.target, this.mesh.position);
					const distance = direction.length();
					
					if (distance > 1) {
						direction.normalize();
						// 添加原有轨道运动的影响
						const orbitForce = this.calculateOrbitForce();
						this.mesh.position.add(direction.multiplyScalar(this.gravityLine.strength * distance));
						this.mesh.position.add(orbitForce.multiplyScalar(0.3));
					}
					
					if (this.orbitLine.line) {
						this.orbitLine.line.visible = false;
					}
				} else {
					// 使用基础速度调整角度增量
					this.orbit.angle += this.orbit.speed * 0.01 * this.baseSpeed;
					
					// 使用相同的矩阵变换计算位置
					const tiltMatrix = new THREE.Matrix4().makeRotationX(this.orbit.tilt);
					const position = new THREE.Vector3(
						Math.cos(this.orbit.angle) * this.orbit.radius,
						0,
							Math.sin(this.orbit.angle) * this.orbit.radius
					);
					position.applyMatrix4(tiltMatrix);
					
					// 计算最终位置
					const targetPosition = new THREE.Vector3()
						.copy(this.orbit.center)
						.add(position);
					targetPosition.z += this.orbit.level * CONFIG.orbits.zOffset;
					
					// 更新文字位置
					const moveSpeed = Math.min(0.1, this.orbit.speed * 0.05);
					this.mesh.position.lerp(targetPosition, moveSpeed);

					// 更新轨道线
					if (this.orbitLine.line && this.orbitLine.visible) {
						const colors = this.orbitLine.colors;
						const segments = this.orbitLine.segments;
						
						// 计算当前角度
						const currentAngle = this.orbit.angle;
						
						// 更新颜色
						for (let i = 0; i <= segments; i++) {
							const angle = (i / segments) * Math.PI * 2;
							let deltaAngle = angle - currentAngle;
							while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
							while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
							
							const colorIndex = i * 3;
							const color = new THREE.Color(this.params.color);
							
							let opacity;
							if (this.orbitLine.showFullTrail) {
								opacity = 0.2;
								if ((i % 6) < 3) opacity *= 0.7;
							} else {
								opacity = 0;
								if (deltaAngle < 0 && deltaAngle > -Math.PI * 0.3) {
									opacity = Math.cos(deltaAngle * 1.5) * 0.5;
								} else if (deltaAngle >= 0 && deltaAngle < Math.PI * 0.4) {
									opacity = (1 - deltaAngle / (Math.PI * 0.4)) * 0.3;
									if ((i % 4) < 2) opacity *= 0.5;
								}
							}
							
							colors[colorIndex] = color.r * opacity;
							colors[colorIndex + 1] = color.g * opacity;
							colors[colorIndex + 2] = color.b * opacity;
						}
						
						this.orbitLine.line.geometry.attributes.color.needsUpdate = true;
					}
				}

				// 使文字朝向轨道中心
				this.mesh.lookAt(this.orbit.center);
				this.mesh.rotateX(Math.PI * 0.1);
				
			}
		} catch (error) {
			console.error('Error in update:', error);
			this.releaseGravityLine();
		}
	}

	// 添加 setAttractionTarget 方法
	setAttractionTarget(point) {
		this.attraction.target.copy(point);
		this.attraction.active = true;
	}

	// 添加 releaseAttraction 方法
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

	// 修改 createOrbitLine 方法
	createOrbitLine(scene) {
		const points = [];
		const segments = 180;
		
		// 创建固定轨道
		const tiltMatrix = new THREE.Matrix4().makeRotationX(this.orbit.tilt);
		
		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const basePoint = new THREE.Vector3(
				Math.cos(angle) * this.orbit.radius,
				0,
				Math.sin(angle) * this.orbit.radius
			);
			
			// 应用倾斜
			basePoint.applyMatrix4(tiltMatrix);
			
			// 添加Z轴偏移
			basePoint.z += this.orbit.level * CONFIG.orbits.zOffset;
			
			points.push(basePoint);
		}

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const colors = new Float32Array(points.length * 3);
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		
		const material = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			depthWrite: false,
			opacity: 1
		});

		const line = new THREE.Line(geometry, material);
		line.renderOrder = 1000 - this.orbit.level;
		
		// 设置轨道线的位置
		line.position.copy(this.orbit.center);
		line.position.z += this.orbit.level * CONFIG.orbits.zOffset;
		
		this.orbitLine = {
			line: line,
			segments: segments,
			colors: colors,
			showFullTrail: false,
			visible: false
		};
		
		scene.add(line);
	}

	// 根据角度计算透明度
	getOpacityForAngle(angle, start, end) {
		// 标准化角度到 [0, 2π]
		while (angle < 0) angle += Math.PI * 2;
		while (start < 0) start += Math.PI * 2;
		while (end < 0) end += Math.PI * 2;
		
		if (end < start) end += Math.PI * 2;
		if (angle < start) angle += Math.PI * 2;
		
		// 如果角度在可见区间内
		if (angle >= start && angle <= end) {
			// 计算渐变透明度
			const progress = (angle - start) / (end - start);
			return 1 - progress; // 越往后越透明
		}
		
		return 0; // 不可见区域完全透明
	}

	// 添加清理轨道线的方法
	releaseOrbitLine(scene) {
		if (this.orbitLine.line) {
			// 清理组中的所有线条
			this.orbitLine.line.children.forEach(line => {
				line.geometry.dispose();
				line.material.dispose();
			});
			scene.remove(this.orbitLine.line);
			this.orbitLine.line = null;
		}
	}

	// 添加速度控制方法
	setRotationSpeed(speed) {
		this.baseSpeed = speed;
		// 保持原有的随机性，但基于新的基础速度
		this.orbit.speed = THREE.MathUtils.lerp(
			CONFIG.orbits.rotationSpeed.min * speed,
			CONFIG.orbits.rotationSpeed.max * speed,
			Math.random()
		);
	}
}
