
class Text3D {
	constructor(text, radius, angle, z, size, color) {
		this.text = text;
		this.radius = radius; // 旋转半径
		this.angle = angle;   // 初始角度
		this.z = z;
		this.size = size;
		this.color = color;
		this.speed = (Math.random() - 0.5) * 0.01; // 旋转速度
	}

	update() {
		this.angle += this.speed; // 更新角度
		// 根据角度和半径计算x和y坐标
		this.x = centerX + this.radius * Math.cos(this.angle);
		this.y = centerY + this.radius * Math.sin(this.angle);
	}

	draw() {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.scale(this.z / 100, this.z / 100);
		ctx.fillStyle = this.color;
		ctx.font = `${this.size * (100 / this.z)}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(this.text, 0, 0);
		ctx.restore();
	}
}
