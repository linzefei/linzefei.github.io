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
			tilt: params.level * CONFIG.orbits.tilt,
			level: params.level || 0  // 保存层级信息
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
			showFullTrail: false  // 新增：是否显示完整轨迹
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
				
				// 如果处于吸引状态，隐藏轨道线
				if (this.orbitLine.line) {
					this.orbitLine.line.visible = false;
				}
			} else {
				// 正常轨道运动
				this.orbit.angle += this.orbit.speed * 0.01;
				
				// 计算目标位置
				const position = new THREE.Vector3(
					Math.cos(this.orbit.angle) * this.orbit.radius,
					0,
					Math.sin(this.orbit.angle) * this.orbit.radius
				);
				position.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.orbit.tilt);
				position.z += this.orbit.level * CONFIG.orbits.zOffset;
				
				const targetPosition = new THREE.Vector3().copy(this.orbit.center).add(position);
				
				// 更新文字位置，使用轨道速度来调整移动速度
				const moveSpeed = Math.min(0.1, this.orbit.speed * 0.05);
				this.mesh.position.lerp(targetPosition, moveSpeed);

				// 更新轨道线
				if (this.orbitLine.line) {
					const colors = this.orbitLine.colors;
					const segments = this.orbitLine.segments;
					
					// 获取文字当前位置相对于轨道中心的方向
					const direction = this.mesh.position.clone().sub(this.orbit.center);
					// 将方向向量投影到轨道平面上
					const projectedDirection = direction.clone();
					projectedDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), -this.orbit.tilt);
					const currentAngle = Math.atan2(projectedDirection.z, projectedDirection.x);
					
					// 根据速度调整轨迹长度
					const speedFactor = this.orbit.speed / CONFIG.orbits.rotationSpeed.max;
					const pastArc = Math.PI * (0.3 + speedFactor * 0.2);   // 增加过去轨迹长度
					const futureArc = Math.PI * (0.4 + speedFactor * 0.2); // 增加未来轨迹长度
					
					// 更新每个点的颜色
					for (let i = 0; i <= segments; i++) {
						const angle = (i / segments) * Math.PI * 2;
						
						let deltaAngle = angle - currentAngle;
						while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
						while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
						
						const colorIndex = i * 3;
						const color = new THREE.Color(this.params.color);
						
						let opacity;
						if (this.orbitLine.showFullTrail) {
							// 完整轨迹模式
							opacity = 0.2;
							if ((i % 6) < 3) { // 调整虚线效果
								opacity *= 0.7;
							}
						} else {
							// 部分轨迹模式
							opacity = 0;
							if (deltaAngle < 0 && deltaAngle > -pastArc) {
								// 过去的轨迹，使用平滑的余弦过渡
								const t = -deltaAngle / pastArc;
								opacity = Math.cos(t * Math.PI * 0.5) * 0.5;
							} else if (deltaAngle >= 0 && deltaAngle < futureArc) {
								// 未来的轨迹，使用虚线效果
								const t = deltaAngle / futureArc;
								opacity = (1 - t) * 0.3;
								if ((i % 4) < 2) { // 虚线效果
									opacity *= 0.5;
								}
							}
						}
						
						colors[colorIndex] = color.r * opacity;
						colors[colorIndex + 1] = color.g * opacity;
						colors[colorIndex + 2] = color.b * opacity;
					}
					
					this.orbitLine.line.geometry.attributes.color.needsUpdate = true;
					this.orbitLine.line.visible = true;
				}
			}

			// 使文字朝向轨道中心
			this.mesh.lookAt(this.orbit.center);
			this.mesh.rotateX(Math.PI * 0.1);
			
		} catch (error) {
			console.error('Error in update:', error);
			this.releaseGravityLine();
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

	// 修改 createOrbitLine 方法
	createOrbitLine(scene) {
		const points = [];
		const segments = 180;
		
		// 计算轨道平面的基准向量
		const baseMatrix = new THREE.Matrix4().makeRotationX(this.orbit.tilt);
		
		// 计算Z轴偏移，确保层级顺序
		const zOffset = this.orbit.level * CONFIG.orbits.zOffset;
		
		// 生成完整轨道的点
		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const x = Math.cos(angle) * this.orbit.radius;
			const z = Math.sin(angle) * this.orbit.radius;
			const point = new THREE.Vector3(x, 0, z);
			point.applyMatrix4(baseMatrix);
			// 添加Z轴偏移
			point.z += zOffset;
			points.push(point);
		}

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const colors = new Float32Array(points.length * 3);
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		
		const material = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			depthWrite: false,
			opacity: 1,
			// 确保渲染顺序正确
			renderOrder: -this.orbit.level
		});

		const line = new THREE.Line(geometry, material);
		line.position.copy(this.orbit.center);
		
		this.orbitLine = {
			line: line,
			segments: segments,
			colors: colors,
			showFullTrail: false
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
}
