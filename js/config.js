// Galaxy Configuration
const GALAXY_CONFIG = {
    particles: {
        disk:       32000,   // 原 55000，适当减量以节省显存
        core:       8000,    // 原 18000
        halo:       2000,    // 原 4000
        background: 3000,    // 星空背景
        nebula:     1200,    // 气体星云
    },
    size: {
        diskRadius: 500,
        coreRadius: 40,
    },
    arms: {
        count: 3,
        windingFactor: 0.8,
        spread: 0.35,
    },
    rotation: {
        disk:  0.000095,
    },
    camera: {
        fov:  60,
        near: 0.1,
        far:  8000,
        position: { x: 0, y: 520, z: 980 },
    },
};
