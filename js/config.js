// 文字内容配置
const TextConfig = {
	items: [
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
	]
};

// 场景配置
const CONFIG = {
	// 文字样式
	textSize: 30,
	textHeight: 5,

	// 轨道配置
	orbits: {
		baseRadius: 100,      // 基础轨道半径
		radiusIncrement: 50,  // 每层轨道半径增量
		rotationSpeed: {
			min: 0.2,
			max: 1.0
		},
		tilt: 0.1            // 轨道倾斜角度
	},

	// 场景边界
	bounds: {
		min: -1000,
		max: 1000
	}
};

// 添加文字的方法
function addText(text, color) {
	if (!TextConfig.items.includes(text)) {
		TextConfig.items.push(text);
	}
	if (color && !TextConfig.colors.includes(color)) {
		TextConfig.colors.push(color);
	}
}

// 移除文字的方法
function removeText(text) {
	const index = TextConfig.items.indexOf(text);
	if (index > -1) {
		TextConfig.items.splice(index, 1);
	}
}

// 清空所有文字
function clearTexts() {
	TextConfig.items = [];
}

// 添加颜色
function addColor(color) {
	if (!TextConfig.colors.includes(color)) {
		TextConfig.colors.push(color);
	}
}

// 获取所有文字
function getTexts() {
	return TextConfig.items;
}

// 获取所有颜色
function getColors() {
	return TextConfig.colors;
}