const CONFIG = {
	texts: [
		'Hello World!',
		'Three.js',
		'JavaScript',
		'Python',
		'Java',
		'C++',
		'React',
		'Vue',
		'Angular',
		'Node.js'
	],
	colors: [
		0xff0000, // 红
		0x00ff00, // 绿
		0x0000ff, // 蓝
		0xffff00, // 黄
		0xff00ff, // 紫
		0x00ffff  // 青
	],
	textSize: 30,
	textHeight: 5,
	orbits: {
		baseRadius: 100,
		radiusIncrement: 50,
		rotationSpeed: {
			min: 0.2,
			max: 1.0
		},
		tilt: 0.1
	},
	bounds: {
		min: -1000,
		max: 1000
	}
};