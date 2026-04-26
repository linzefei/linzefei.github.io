// Galaxy Configuration - Safe Mode
const GALAXY_CONFIG = {
    particles: {
        disk:       12000,   // 大幅削减
        core:       3000,    
        halo:       1000,    
        background: 2000,    
        nebula:     600,     
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
        disk:  0.00012, // 稍微快一点点，让灵动感补足数量
    },
    camera: {
        fov:  60,
        near: 1,
        far:  5000,
        position: { x: 0, y: 520, z: 980 },
    },
};
