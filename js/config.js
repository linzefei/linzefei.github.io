// 场景配置
const CONFIG = {
	// 文字样式
	textSize: 30,
	textHeight: 5,

	// 轨道配置
	orbits: {
		baseRadius: 100,      // 基础轨道半径
		radiusIncrement: 100, // 增加轨道间距，避免碰撞
		rotationSpeed: {
			min: 0.2,
			max: 0.8          // 降低最大速度，使运动更平稳
		},
		tilt: 0.15,          // 增加倾斜角度，使轨道层次更分明
		zOffset: 1.0         // 增加Z轴偏移，加强层次感
	},

	// 场景边界
	bounds: {
		min: -1000,
		max: 1000
	}
};