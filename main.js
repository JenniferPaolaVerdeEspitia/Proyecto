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

const player = new THREE.Group();
scene.add(player);

camera.position.set(0, 1.45, 0);
player.add(camera);
player.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

const vrButton = VRButton.createButton(renderer);
vrButton.style.display = 'none';
document.body.appendChild(vrButton);

const btnVR = document.getElementById('btnVR');

if (btnVR) {
  btnVR.addEventListener('click', () => {
    vrButton.click();
  });
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(player.position.x, 1.45, player.position.z - 2);
controls.update();

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(8, 12, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

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

const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

const moveSpeedPC = 0.08;
const moveSpeedVR = 0.10;
const rotateSpeed = 0.045;

function getCameraDirections() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
  right.normalize();

  return { forward, right };
}

function movePlayer(x, z, speed) {
  const { forward, right } = getCameraDirections();

  player.position.addScaledVector(forward, -z * speed);
  player.position.addScaledVector(right, x * speed);

  player.position.y = 0;
}

function movePC() {
  if (renderer.xr.isPresenting) return;

  let x = 0;
  let z = 0;

  if (keys['KeyW'] || keys['ArrowUp']) z -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) z += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) x += 1;

  const direction = new THREE.Vector2(x, z);

  if (direction.length() > 0) {
    direction.normalize();
    movePlayer(direction.x, direction.y, moveSpeedPC);
  }

  controls.target.set(
    player.position.x,
    1.45,
    player.position.z - 2
  );

  camera.position.y = 1.45;
}

function moveGamepadNormal() {
  if (renderer.xr.isPresenting) return;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

  for (const gamepad of gamepads) {
    if (!gamepad) continue;

    const axes = gamepad.axes;

    const x = axes[0] || 0;
    const z = axes[1] || 0;

    if (Math.abs(x) > 0.18 || Math.abs(z) > 0.18) {
      movePlayer(x, z, moveSpeedVR);
    }

    if (gamepad.buttons[0]?.pressed) movePlayer(0, -1, moveSpeedVR);
    if (gamepad.buttons[1]?.pressed) movePlayer(0, 1, moveSpeedVR);

    if (gamepad.buttons[2]?.pressed) player.rotation.y += rotateSpeed;
    if (gamepad.buttons[3]?.pressed) player.rotation.y -= rotateSpeed;
  }
}

function moveVR() {
  const session = renderer.xr.getSession();
  if (!session) return;

  for (const source of session.inputSources) {
    if (!source.gamepad) continue;

    const gamepad = source.gamepad;
    const axes = gamepad.axes;

    const x = axes[2] || axes[0] || 0;
    const z = axes[3] || axes[1] || 0;

    if (Math.abs(x) > 0.18 || Math.abs(z) > 0.18) {
      movePlayer(x, z, moveSpeedVR);
    }

    if (gamepad.buttons[0]?.pressed) movePlayer(0, -1, moveSpeedVR);
    if (gamepad.buttons[1]?.pressed) movePlayer(0, 1, moveSpeedVR);

    if (gamepad.buttons[2]?.pressed) player.rotation.y += rotateSpeed;
    if (gamepad.buttons[3]?.pressed) player.rotation.y -= rotateSpeed;
  }
}

const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

player.add(controller1);
player.add(controller2);

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

    player.position.set(0, 0, 2);
    camera.position.y = 1.45;

    controls.target.set(0, 1.45, 0);
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

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

renderer.setAnimationLoop(() => {
  movePC();
  moveGamepadNormal();
  moveVR();

  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  renderer.render(scene, camera);
});