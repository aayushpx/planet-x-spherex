// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// PlanetX - Milky Way Galaxy Viewer
// Full-screen background with galaxy, stars, and forest silhouette
// Uses custom ShaderMaterial to avoid conflicts with Three.js built-in attributes

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ============================================
// Custom Shader Materials
// ============================================

// Star field shader with twinkling
const starVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aTwinkleSpeed;
    attribute float aTwinkleOffset;
    attribute vec3 aColor;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        float twinkle = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed + aTwinkleOffset);
        vAlpha = aAlpha * twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const starFragmentShader = `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        float dist = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// Milky Way band shader with twinkling
const milkyWayVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec2 aTwinkleData; // x=speed, y=offset
    attribute vec3 aColor;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        float twinkle = 0.6 + 0.4 * sin(uTime * aTwinkleData.x + aTwinkleData.y);
        vAlpha = aAlpha * twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const milkyWayFragmentShader = `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        float dist = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// Dust lanes shader (multiply blending for dark absorption)
const dustVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const dustFragmentShader = `
    varying float vAlpha;
    void main() {
        float dist = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
    }
`;

// Foreground forest particles with sway
const foregroundVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec2 aSwayData; // x=speed, y=phase
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
        vAlpha = aAlpha;
        float sway = sin(uTime * aSwayData.x + aSwayData.y) * 0.02;
        vec3 pos = position;
        pos.x += sway;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const foregroundFragmentShader = `
    varying float vAlpha;
    void main() {
        float dist = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
        gl_FragColor = vec4(0.01, 0.01, 0.015, alpha);
    }
`;

// Atmosphere glow shader
const atmosphereVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec3 aColor;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        float pulse = 0.8 + 0.2 * sin(uTime * 0.3 + position.x * 0.01);
        vAlpha = aAlpha * pulse;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const atmosphereFragmentShader = `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
        float dist = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// ============================================
// Global State
// ============================================
let scene, camera, renderer;
let galaxyParticles, starField, forestSilhouette;
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let time = 0;
let animationId = null;
let shaderMaterials = []; // Track all custom shader materials for uniform updates

// Form tab handling
let activeTab = 'object-name';

// ============================================
// Initialization
// ============================================
export function initViewer() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) {
        console.error('Canvas element #galaxy-canvas not found');
        return;
    }

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.0008);

    // Camera - Perspective for depth, looking up
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(0, 1.6, 0); // Eye level of a person sitting
    camera.lookAt(0, 10, -100); // Looking up at the sky

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Build the scene
    createStarField();
    createMilkyWay();
    createForestSilhouette();
    createAtmosphere();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    
    // Form tab listeners
    setupFormTabs();

    // Start render loop
    animate();
}

// ============================================
// Scene Creation
// ============================================

function createStarField() {
    // Multiple layers of stars for depth
    const starLayers = [
        { count: 3000, size: 0.8, distance: 800, colorVariation: 0.3 },
        { count: 1500, size: 1.2, distance: 500, colorVariation: 0.5 },
        { count: 500, size: 2.0, distance: 300, colorVariation: 0.8 }
    ];

    starField = new THREE.Group();

    starLayers.forEach(layer => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);
        const sizes = new Float32Array(layer.count);
        const alphas = new Float32Array(layer.count);
        const twinkleSpeeds = new Float32Array(layer.count);
        const twinkleOffsets = new Float32Array(layer.count);

        for (let i = 0; i < layer.count; i++) {
            // Spherical distribution
            const radius = layer.distance * (0.5 + Math.random() * 0.5);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Star colors: warm to cool white with slight variation
            const temp = Math.random();
            let r, g, b;
            if (temp < 0.3) { // Cool blue-white
                r = 0.7 + Math.random() * 0.3;
                g = 0.8 + Math.random() * 0.2;
                b = 1.0;
            } else if (temp < 0.6) { // Neutral white
                r = 0.9 + Math.random() * 0.1;
                g = 0.9 + Math.random() * 0.1;
                b = 0.95 + Math.random() * 0.05;
            } else { // Warm yellow-orange
                r = 1.0;
                g = 0.7 + Math.random() * 0.3;
                b = 0.4 + Math.random() * 0.2;
            }
            
            const variation = 1 - layer.colorVariation + Math.random() * layer.colorVariation * 2;
            colors[i * 3] = r * variation;
            colors[i * 3 + 1] = g * variation;
            colors[i * 3 + 2] = b * variation;

            sizes[i] = layer.size * (0.5 + Math.random() * 1.5);
            alphas[i] = 0.3 + Math.random() * 0.7;
            twinkleSpeeds[i] = 0.5 + Math.random() * 2.0;
            twinkleOffsets[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
        geometry.setAttribute('aTwinkleOffset', new THREE.BufferAttribute(twinkleOffsets, 1));

        const material = new THREE.ShaderMaterial({
            vertexShader: starVertexShader,
            fragmentShader: starFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: renderer.getPixelRatio() }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        shaderMaterials.push(material);

        const stars = new THREE.Points(geometry, material);
        stars.renderOrder = 1;
        starField.add(stars);
    });

    scene.add(starField);
}

function createMilkyWay() {
    // Milky Way as a dense particle band across the sky
    const galaxyGroup = new THREE.Group();
    
    // Core band - multiple density layers
    const bandLayers = [
        { count: 15000, width: 0.15, height: 0.08, depth: 400, size: 0.6, opacity: 0.4 },
        { count: 8000, width: 0.25, height: 0.15, depth: 350, size: 0.9, opacity: 0.25 },
        { count: 3000, width: 0.4, height: 0.25, depth: 300, size: 1.4, opacity: 0.15 }
    ];

    bandLayers.forEach((layer, layerIndex) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);
        const sizes = new Float32Array(layer.count);
        const alphas = new Float32Array(layer.count);
        const twinkleData = new Float32Array(layer.count * 2); // speed, offset

        // Milky Way band orientation - arches across the sky
        const bandTilt = Math.PI / 6; // 30 degrees from horizontal

        for (let i = 0; i < layer.count; i++) {
            // Position along the galactic plane (great circle)
            const angle = Math.random() * Math.PI * 2;
            const latitude = (Math.random() - 0.5) * layer.width;
            
            // Convert to 3D position on a sphere
            const radius = layer.depth * (0.7 + Math.random() * 0.3);
            const x = radius * Math.cos(angle) * Math.cos(latitude);
            const z = radius * Math.sin(angle) * Math.cos(latitude);
            let y = radius * Math.sin(latitude);
            
            // Apply tilt so the band arches across the sky
            const yTilted = y * Math.cos(bandTilt) - z * Math.sin(bandTilt);
            const zTilted = y * Math.sin(bandTilt) + z * Math.cos(bandTilt);
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = yTilted;
            positions[i * 3 + 2] = zTilted;

            // Milky Way colors - warm cream to cool blue-white
            const temp = Math.random();
            let r, g, b;
            if (temp < 0.4) { // Warm core
                r = 1.0;
                g = 0.85 + Math.random() * 0.15;
                b = 0.6 + Math.random() * 0.2;
            } else if (temp < 0.7) { // Neutral
                r = 0.95 + Math.random() * 0.05;
                g = 0.9 + Math.random() * 0.1;
                b = 0.85 + Math.random() * 0.15;
            } else { // Cool edges
                r = 0.7 + Math.random() * 0.2;
                g = 0.8 + Math.random() * 0.2;
                b = 1.0;
            }
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;

            sizes[i] = layer.size * (0.3 + Math.random() * 1.7);
            alphas[i] = layer.opacity * (0.3 + Math.random() * 0.7);
            twinkleData[i * 2] = 0.3 + Math.random() * 1.5;
            twinkleData[i * 2 + 1] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        geometry.setAttribute('aTwinkleData', new THREE.BufferAttribute(twinkleData, 2));

        const material = new THREE.ShaderMaterial({
            vertexShader: milkyWayVertexShader,
            fragmentShader: milkyWayFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: renderer.getPixelRatio() }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        shaderMaterials.push(material);

        const band = new THREE.Points(geometry, material);
        band.renderOrder = 2;
        galaxyGroup.add(band);
    });

    // Add dark dust lanes (absorption nebulae) - using dark particles
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 2000;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustAlphas = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const latitude = (Math.random() - 0.5) * 0.12; // Narrower than stars
        const radius = 350 * (0.8 + Math.random() * 0.2);
        
        const x = radius * Math.cos(angle) * Math.cos(latitude);
        const z = radius * Math.sin(angle) * Math.cos(latitude);
        let y = radius * Math.sin(latitude);
        
        const bandTilt = Math.PI / 6;
        const yTilted = y * Math.cos(bandTilt) - z * Math.sin(bandTilt);
        const zTilted = y * Math.sin(bandTilt) + z * Math.cos(bandTilt);
        
        dustPositions[i * 3] = x;
        dustPositions[i * 3 + 1] = yTilted;
        dustPositions[i * 3 + 2] = zTilted;
        
        dustSizes[i] = 3 + Math.random() * 5;
        dustAlphas[i] = 0.15 + Math.random() * 0.2;
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));
    dustGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlphas, 1));

    const dustMaterial = new THREE.ShaderMaterial({
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.MultiplyBlending
    });
    shaderMaterials.push(dustMaterial);

    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.renderOrder = 1.5;
    galaxyGroup.add(dust);

    galaxyParticles = galaxyGroup;
    scene.add(galaxyParticles);
}

function createForestSilhouette() {
    // Forest as dark silhouettes at the bottom of the view
    forestSilhouette = new THREE.Group();

    // Ground plane (very dark)
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshBasicMaterial({
        color: 0x050508,
        side: THREE.DoubleSide,
        depthWrite: true
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.renderOrder = 0;
    forestSilhouette.add(ground);

    // Tree silhouettes - using simple cone geometries
    const treeCount = 120;
    const treeGeometry = new THREE.ConeGeometry(1, 1, 6);
    const treeMaterial = new THREE.MeshBasicMaterial({
        color: 0x020203,
        side: THREE.FrontSide,
        depthWrite: true
    });

    // Create instanced mesh for performance
    const treeMesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, treeCount);
    treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    treeMesh.renderOrder = 0;
    treeMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const treePositions = [];

    for (let i = 0; i < treeCount; i++) {
        // Distribute trees in a circle around the camera
        const angle = (i / treeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const distance = 15 + Math.random() * 35;
        
        // Closer trees are larger
        const scale = 0.8 + Math.random() * 2.5;
        
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = -2; // Ground level

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        
        treeMesh.setMatrixAt(i, dummy.matrix);
        
        // Store for subtle animation
        treePositions.push({ x, z, baseScale: scale, swayPhase: Math.random() * Math.PI * 2 });
    }

    treeMesh.instanceMatrix.needsUpdate = true;
    forestSilhouette.add(treeMesh);
    forestSilhouette.userData.treeMesh = treeMesh;
    forestSilhouette.userData.treePositions = treePositions;

    // Add some foreground elements (branches, leaves) as particles
    const foregroundGeometry = new THREE.BufferGeometry();
    const fgCount = 500;
    const fgPositions = new Float32Array(fgCount * 3);
    const fgSizes = new Float32Array(fgCount);
    const fgAlphas = new Float32Array(fgCount);
    const fgSwayData = new Float32Array(fgCount * 2);

    for (let i = 0; i < fgCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * 12;
        const height = -1.5 + Math.random() * 3;
        
        fgPositions[i * 3] = Math.cos(angle) * distance;
        fgPositions[i * 3 + 1] = height;
        fgPositions[i * 3 + 2] = Math.sin(angle) * distance;
        
        fgSizes[i] = 0.1 + Math.random() * 0.4;
        fgAlphas[i] = 0.2 + Math.random() * 0.4;
        fgSwayData[i * 2] = 0.5 + Math.random() * 1.0;
        fgSwayData[i * 2 + 1] = Math.random() * Math.PI * 2;
    }

    foregroundGeometry.setAttribute('position', new THREE.BufferAttribute(fgPositions, 3));
    foregroundGeometry.setAttribute('aSize', new THREE.BufferAttribute(fgSizes, 1));
    foregroundGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(fgAlphas, 1));
    foregroundGeometry.setAttribute('aSwayData', new THREE.BufferAttribute(fgSwayData, 2));

    const fgMaterial = new THREE.ShaderMaterial({
        vertexShader: foregroundVertexShader,
        fragmentShader: foregroundFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() }
        },
        transparent: true,
        depthWrite: true,
        depthTest: true
    });
    shaderMaterials.push(fgMaterial);

    const foreground = new THREE.Points(foregroundGeometry, fgMaterial);
    foreground.renderOrder = 0;
    forestSilhouette.add(foreground);
    forestSilhouette.userData.foreground = foreground;

    scene.add(forestSilhouette);
}

function createAtmosphere() {
    // Subtle atmospheric glow at horizon
    const atmGeometry = new THREE.BufferGeometry();
    const atmCount = 1000;
    const atmPositions = new Float32Array(atmCount * 3);
    const atmSizes = new Float32Array(atmCount);
    const atmAlphas = new Float32Array(atmCount);
    const atmColors = new Float32Array(atmCount * 3);

    for (let i = 0; i < atmCount; i++) {
        // Ring around horizon
        const angle = Math.random() * Math.PI * 2;
        const height = -0.5 + Math.random() * 3; // Near horizon
        const distance = 400 + Math.random() * 200;
        
        atmPositions[i * 3] = Math.cos(angle) * distance;
        atmPositions[i * 3 + 1] = height;
        atmPositions[i * 3 + 2] = Math.sin(angle) * distance;
        
        atmSizes[i] = 50 + Math.random() * 100;
        atmAlphas[i] = 0.005 + Math.random() * 0.015;
        
        // Very subtle warm glow
        atmColors[i * 3] = 0.4 + Math.random() * 0.2;
        atmColors[i * 3 + 1] = 0.2 + Math.random() * 0.15;
        atmColors[i * 3 + 2] = 0.1 + Math.random() * 0.1;
    }

    atmGeometry.setAttribute('position', new THREE.BufferAttribute(atmPositions, 3));
    atmGeometry.setAttribute('aSize', new THREE.BufferAttribute(atmSizes, 1));
    atmGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(atmAlphas, 1));
    atmGeometry.setAttribute('aColor', new THREE.BufferAttribute(atmColors, 3));

    const atmMaterial = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    shaderMaterials.push(atmMaterial);

    const atmosphere = new THREE.Points(atmGeometry, atmMaterial);
    atmosphere.renderOrder = 0;
    scene.add(atmosphere);
    scene.userData.atmosphere = atmosphere;
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    animationId = requestAnimationFrame(animate);
    time += 0.016; // ~60fps

    // Smooth mouse tracking
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Camera subtle movement based on mouse
    if (camera) {
        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
        camera.position.y = 1.6 + mouseY * 0.3;
        camera.lookAt(mouseX * 2, 10 + mouseY * 5, -100);
    }

    // Update shader uniforms
    updateShaderUniforms(time);

    // Animate forest sway
    animateForest(time);

    // Slow rotation of galaxy
    if (galaxyParticles) {
        galaxyParticles.rotation.y += 0.00002;
        galaxyParticles.rotation.x = Math.sin(time * 0.05) * 0.02;
    }

    // Slow star field rotation
    if (starField) {
        starField.rotation.y += 0.00001;
    }

    renderer.render(scene, camera);
}

function updateShaderUniforms(currentTime) {
    const pixelRatio = renderer.getPixelRatio();
    
    shaderMaterials.forEach(material => {
        if (material.uniforms.uTime) {
            material.uniforms.uTime.value = currentTime;
        }
        if (material.uniforms.uPixelRatio) {
            material.uniforms.uPixelRatio.value = pixelRatio;
        }
    });
}

function animateForest(currentTime) {
    if (!forestSilhouette) return;

    // Animate instanced trees
    const treeMesh = forestSilhouette.userData.treeMesh;
    const treePositions = forestSilhouette.userData.treePositions;
    const dummy = new THREE.Object3D();

    if (treeMesh && treePositions) {
        treePositions.forEach((pos, i) => {
            const sway = Math.sin(currentTime * 0.3 + pos.swayPhase) * 0.005;
            dummy.position.set(pos.x + sway, -2, pos.z);
            dummy.rotation.y = Math.sin(currentTime * 0.2 + pos.swayPhase) * 0.02;
            dummy.scale.setScalar(pos.baseScale);
            dummy.updateMatrix();
            treeMesh.setMatrixAt(i, dummy.matrix);
        });
        treeMesh.instanceMatrix.needsUpdate = true;
    }

    // Foreground particles animated in shader via uTime uniform
}

// ============================================
// Event Handlers
// ============================================
function onWindowResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function onMouseMove(event) {
    // Normalize mouse to -1 to 1
    targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onTouchMove(event) {
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        targetMouseX = (touch.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
}

// ============================================
// Form Tab Handling
// ============================================
function setupFormTabs() {
    const tabs = document.querySelectorAll('.form-tab');
    const panels = document.querySelectorAll('.form-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });

        // Keyboard accessibility
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                switchTab(tabName);
            }
        });
    });

    // Form submission handlers
    const objectNameForm = document.getElementById('object-name-form');
    const coordinatesForm = document.getElementById('coordinates-form');

    if (objectNameForm) {
        objectNameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('object-name-input');
            if (input.value.trim()) {
                handleObjectNameSearch(input.value.trim());
            }
        });
    }

    if (coordinatesForm) {
        coordinatesForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const ra = document.getElementById('ra-input').value.trim();
            const dec = document.getElementById('dec-input').value.trim();
            if (ra && dec) {
                handleCoordinateSearch(ra, dec);
            }
        });
    }
}

function switchTab(tabName) {
    if (tabName === activeTab) return;
    activeTab = tabName;

    // Update tabs
    document.querySelectorAll('.form-tab').forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive);
    });

    // Update panels
    document.querySelectorAll('.form-panel').forEach(panel => {
        const isActive = panel.dataset.tab === tabName;
        panel.classList.toggle('active', isActive);
    });
}

// ============================================
// Search Handlers (to be connected to backend)
// ============================================
function handleObjectNameSearch(name) {
    console.log('Searching for object:', name);
    // TODO: Connect to backend API
    // Example: fetch(`/api/search/object?name=${encodeURIComponent(name)}`)
    showSearchFeedback(`Searching for "${name}"...`);
}

function handleCoordinateSearch(ra, dec) {
    console.log('Searching for coordinates:', ra, dec);
    // TODO: Connect to backend API
    // Example: fetch(`/api/search/coordinates?ra=${encodeURIComponent(ra)}&dec=${encodeURIComponent(dec)}`)
    showSearchFeedback(`Searching RA: ${ra}, Dec: ${dec}...`);
}

function showSearchFeedback(message) {
    // Create or update a toast notification
    let toast = document.getElementById('search-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'search-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(10, 10, 20, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(100, 150, 255, 0.3);
            border-radius: 10px;
            padding: 1rem 1.5rem;
            color: #fff;
            font-size: 0.9rem;
            z-index: 100;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, 3000);
}

// ============================================
// Cleanup
// ============================================
export function dispose() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    window.removeEventListener('resize', onWindowResize);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('touchmove', onTouchMove);
    
    if (renderer) {
        renderer.dispose();
    }
    
    // Dispose geometries and materials
    scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
    
    // Dispose shader materials
    shaderMaterials.forEach(m => m.dispose());
    shaderMaterials = [];
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewer);
} else {
    initViewer();
} 