// Galaxy Configuration
const GALAXY_CONFIG = {
    particles: {
        disk:       55000,   // Main spiral disk
        core:       18000,   // Dense central bulge
        halo:        4000,   // Stellar halo (spherical)
        nebula:      6000,   // Nebula cloud patches
        background: 12000,   // Distant background stars
    },
    arms: {
        count:         4,    // Number of spiral arms
        windingFactor: 1.0,  // How tightly wound (higher = more turns)
        spread:        0.40, // Angular scatter around each arm
    },
    size: {
        diskRadius: 560,     // Outer edge of disk (units)
        coreRadius:  55,     // Core/bulge radius
        haloRadius: 900,     // Outer edge of halo
    },
    rotation: {
        disk:  0.000095,     // Galaxy rotation speed (rad/frame)
    },
    camera: {
        fov:  60,
        near: 0.1,
        far:  8000,
        position: { x: 0, y: 520, z: 980 },
    },
};
