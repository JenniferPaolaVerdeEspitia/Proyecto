import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const container = document.getElementById('viewer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(
  75,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);

// Grupo jugador para moverse en VR
const player = new THREE.Group();
scene.add(player);

camera.position.set(0, 1.6, 0);
player.add(camera);

// Posición inicial dentro del salón
player.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer));

// Controles para PC
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(player.position.x, 1.6, player.position.z - 1);
controls.update();

// Luces
const light = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(8, 12, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Piso exterior opcional
const floorGeometry = new THREE.PlaneGeometry(80, 80);
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.8,
  metalness: 0.1
});

const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

// Movimiento con teclado
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

const moveSpeedPC = 0.08;
const moveSpeedVR = 0.055;

function movePC() {
  if (renderer.xr.isPresenting) return;

  const direction = new THREE.Vector3();

  if (keys['KeyW']) direction.z -= 1;
  if (keys['KeyS']) direction.z += 1;
  if (keys['KeyA']) direction.x -= 1;
  if (keys['KeyD']) direction.x += 1;

  direction.normalize();

  player.position.x += direction.x * moveSpeedPC;
  player.position.z += direction.z * moveSpeedPC;

  controls.target.set(
    player.position.x,
    1.6,
    player.position.z - 1
  );
}

function moveVR() {
  const session = renderer.xr.getSession();
  if (!session) return;

  for (const source of session.inputSources) {
    if (!source.gamepad) continue;

    const axes = source.gamepad.axes;

    const x = axes[2] || axes[0] || 0;
    const z = axes[3] || axes[1] || 0;

    if (Math.abs(x) > 0.15) {
      player.position.x += x * moveSpeedVR;
    }

    if (Math.abs(z) > 0.15) {
      player.position.z += z * moveSpeedVR;
    }
  }
}

// Mandos VR
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

player.add(controller1);
player.add(controller2);

// Cargar modelo
const loader = new GLTFLoader();

loader.load(
  './models/salony8.glb',

  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    model.position.x -= center.x;
    model.position.y -= box.min.y;
    model.position.z -= center.z;

    const maxSize = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxSize;
    model.scale.setScalar(scale);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Cámara dentro del salón
    player.position.set(0, 0, 3);

    controls.target.set(0, 1.6, 0);
    controls.update();

    console.log('Modelo cargado correctamente');
  },

  (xhr) => {
    console.log(`Cargando: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
  },

  (error) => {
    console.error('Error al cargar el modelo:', error);
  }
);

// Resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animación
renderer.setAnimationLoop(() => {
  movePC();
  moveVR();

  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  renderer.render(scene, camera);
});