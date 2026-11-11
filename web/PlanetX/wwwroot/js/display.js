// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, plane;
let textures = [];
let currentFrame = 0;
let isPlaying = false;
let playInterval = null;
let fps = 2; // Speed of the blink animation

export function initViewer(containerId) {
    const container = document.getElementById(containerId);
    
    // 1. Scene & Orthographic Camera
    scene = new THREE.Scene();
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.OrthographicCamera(-1, 1, 1 / aspect, -1 / aspect, 0.1, 10);
    camera.position.z = 1;

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 3. Placeholder Plane
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshNormalMaterial();
    plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    animate();
}

export function loadFrames(pngUrls) {
    const loader = new THREE.TextureLoader();
    textures = [];
    
    pngUrls.forEach((url, index) => {
        loader.load(url, (texture) => {
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            textures[index] = texture;
            
            // If it's the first frame, display it immediately
            if (index === 0) {
                plane.material.map = textures[0];
                plane.material.needsUpdate = true;
            }
        });
    });
}

export function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
        playInterval = setInterval(() => {
            if (textures.length === 0) return;
            currentFrame = (currentFrame + 1) % textures.length;
            plane.material.map = textures[currentFrame];
            plane.material.needsUpdate = true;
            // Trigger UI callback to update timeline slider if needed
        }, 1000 / fps);
    } else {
        clearInterval(playInterval);
    }
}

function animate() {
    requestAnimationFrame(animate);
    plane.rotation.x += 0.01;
    plane.rotation.y += 0.01;
    renderer.render(scene, camera);
}

initViewer("viewer-container");