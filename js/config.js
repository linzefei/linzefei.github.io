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
		tilt: 0.1,            // 轨道倾斜角度
		zOffset: 0.5         // 添加Z轴偏移量，控制轨道层级
	},

	// 场景边界
	bounds: {
		min: -1000,
		max: 1000
	}
};