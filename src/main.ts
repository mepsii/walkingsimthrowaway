import './style.css';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { createNoise2D } from 'simplex-noise';

// Scene setup
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x87CEEB);
const waterColor = new THREE.Color(0x1a5e8c);
const waterLevel = -2.0;

scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor.getHex(), 60, 270);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer setup
const appDiv = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
if (appDiv) appDiv.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 500;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Controls
const controls = new PointerLockControls(camera, document.body);
const ui = document.getElementById('ui');
const crosshair = document.getElementById('crosshair');

if (ui) {
  ui.addEventListener('click', () => {
    controls.lock();
  });
}

controls.addEventListener('lock', () => {
  if (ui) ui.style.display = 'none';
  if (crosshair) crosshair.style.display = 'block';
});

controls.addEventListener('unlock', () => {
  if (ui) ui.style.display = 'block';
  if (crosshair) crosshair.style.display = 'none';
});
scene.add(camera);

// Movement state
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jump: false,
};

const onKeyDown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'ShiftLeft':
    case 'ShiftRight': moveState.sprint = true; break;
    case 'Space': moveState.jump = true; break;
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyS': moveState.backward = false; break;
    case 'KeyD': moveState.right = false; break;
    case 'ShiftLeft':
    case 'ShiftRight': moveState.sprint = false; break;
    case 'Space': moveState.jump = false; break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Terrain Generation
const noise2D = createNoise2D();
const moistureNoise2D = createNoise2D();
const CHUNK_SIZE = 50;
const SEGMENTS = 50;
const CHUNKS = new Map<string, THREE.Mesh>();
const RENDER_DISTANCE = 6;

// Material
const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
});

// Helper to get chunk key
const getChunkKey = (cx: number, cz: number) => `${cx},${cz}`;

const generateChunk = (cx: number, cz: number) => {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const colors = [];
  const pos = geometry.attributes.position;
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i) + (cx * CHUNK_SIZE);
    const vz = pos.getZ(i) + (cz * CHUNK_SIZE);
    
    // Generate height
    let height = noise2D(vx * 0.02, vz * 0.02) * 8;
    height += noise2D(vx * 0.05, vz * 0.05) * 2;
    
    pos.setY(i, height);

    // Generate moisture (for biomes)
    const moisture = moistureNoise2D(vx * 0.01 + 1000, vz * 0.01 + 1000);

    // Determine biome color
    if (height < -1.5) {
      // Sand / Water edge
      color.setHex(0xe3d28d); 
    } else if (height > 6) {
      // Snow
      color.setHex(0xffffff);
    } else {
      if (moisture > 0.2) {
        // Forest
        color.setHex(0x2d8a4e);
      } else if (moisture < -0.2) {
        // Dry / Dirt
        color.setHex(0x8b5a2b);
      } else {
        // Grass
        color.setHex(0x4ca64c);
      }
    }
    
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  
  scene.add(mesh);
  
  // Decorations
  addDecorationsToChunk(mesh, cx, cz);
  
  return mesh;
};

const addDecorationsToChunk = (chunkMesh: THREE.Mesh, cx: number, cz: number) => {
  const pos = chunkMesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (Math.random() < 0.015) {
      const vx = pos.getX(i) + (cx * CHUNK_SIZE);
      const vy = pos.getY(i);
      const vz = pos.getZ(i) + (cz * CHUNK_SIZE);
      
      const moisture = moistureNoise2D(vx * 0.01 + 1000, vz * 0.01 + 1000);
      
      if (vy > -1 && vy < 5) {
        if (moisture > 0.2) {
          // Tree
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2, 5);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, flatShading: true });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          
          const leavesGeo = new THREE.ConeGeometry(1.5, 4, 5);
          const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, flatShading: true });
          const leaves = new THREE.Mesh(leavesGeo, leavesMat);
          leaves.position.y = 2.5;
          
          trunk.add(leaves);
          trunk.position.set(vx, vy + 1, vz);
          trunk.castShadow = true;
          leaves.castShadow = true;
          
          scene.add(trunk);
          chunkMesh.userData.decorations = chunkMesh.userData.decorations || [];
          chunkMesh.userData.decorations.push(trunk);
        } else if (moisture < -0.2) {
          // Rock
          const rockGeo = new THREE.DodecahedronGeometry(Math.random() * 0.8 + 0.3);
          const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(vx, vy, vz);
          rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
          rock.castShadow = true;
          
          scene.add(rock);
          chunkMesh.userData.decorations = chunkMesh.userData.decorations || [];
          chunkMesh.userData.decorations.push(rock);
        }
      }
    }
  }
};

const updateChunks = (playerX: number, playerZ: number) => {
  const currentChunkX = Math.round(playerX / CHUNK_SIZE);
  const currentChunkZ = Math.round(playerZ / CHUNK_SIZE);

  const activeChunks = new Set<string>();

  for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
    for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
      if (x * x + z * z > RENDER_DISTANCE * RENDER_DISTANCE) continue;

      const cx = currentChunkX + x;
      const cz = currentChunkZ + z;
      const key = getChunkKey(cx, cz);
      activeChunks.add(key);

      if (!CHUNKS.has(key)) {
        CHUNKS.set(key, generateChunk(cx, cz));
      }
    }
  }

  // Remove old chunks
  CHUNKS.forEach((mesh, key) => {
    if (!activeChunks.has(key)) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.userData.decorations) {
        mesh.userData.decorations.forEach((d: THREE.Mesh) => {
          scene.remove(d);
          d.geometry.dispose();
          (d.material as THREE.Material).dispose();
        });
      }
      CHUNKS.delete(key);
    }
  });
};

// Water
const waterGeo = new THREE.PlaneGeometry(1000, 1000);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x4fa3e3,
  transparent: true,
  opacity: 0.6,
  roughness: 0.1,
  metalness: 0.1,
  flatShading: true,
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.rotateX(-Math.PI / 2);
waterMesh.position.y = waterLevel;
scene.add(waterMesh);

// Animals
const animals: { mesh: THREE.Group, type: 'sheep' | 'bird', target: THREE.Vector3 }[] = [];
const addAnimals = () => {
  for (let i = 0; i < 30; i++) {
    const isBird = Math.random() > 0.5;
    const group = new THREE.Group();
    
    if (isBird) {
      const bodyGeo = new THREE.ConeGeometry(0.3, 0.8, 4);
      bodyGeo.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({color: 0xffffff, flatShading: true}));
      const wingGeo = new THREE.BoxGeometry(1.5, 0.05, 0.4);
      const wing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({color: 0xdddddd, flatShading: true}));
      wing.position.y = 0.15;
      wing.position.z = -0.1;
      body.add(wing);
      group.add(body);
      group.position.set(Math.random() * 200 - 100, 15 + Math.random() * 10, Math.random() * 200 - 100);
      animals.push({ mesh: group, type: 'bird', target: new THREE.Vector3() });
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), new THREE.MeshStandardMaterial({color: 0xeeeeee, flatShading: true}));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({color: 0x222222, flatShading: true}));
      head.position.set(0, 0.5, 1);
      
      const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      const legMat = new THREE.MeshStandardMaterial({color: 0x222222, flatShading: true});
      const leg1 = new THREE.Mesh(legGeo, legMat); leg1.position.set(0.4, -0.4, 0.6);
      const leg2 = new THREE.Mesh(legGeo, legMat); leg2.position.set(-0.4, -0.4, 0.6);
      const leg3 = new THREE.Mesh(legGeo, legMat); leg3.position.set(0.4, -0.4, -0.6);
      const leg4 = new THREE.Mesh(legGeo, legMat); leg4.position.set(-0.4, -0.4, -0.6);
      
      group.add(body, head, leg1, leg2, leg3, leg4);
      group.position.set(Math.random() * 200 - 100, 10, Math.random() * 200 - 100);
      animals.push({ mesh: group, type: 'sheep', target: new THREE.Vector3() });
    }
    
    scene.add(group);
  }
};
addAnimals();

// Particles
const particlesGeo = new THREE.BufferGeometry();
const particleCount = 3000;
const posArray = new Float32Array(particleCount * 3);
for(let i = 0; i < particleCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 150;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({
  size: 0.15,
  color: 0xffffff,
  transparent: true,
  opacity: 0.8,
  map: createCircleTexture() // Simple circular texture
});
const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
scene.add(particlesMesh);

function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;
  context.beginPath();
  context.arc(8, 8, 8, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

// Main logic
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

// Initial pos
camera.position.set(0, 20, 0);

const getTerrainHeight = (x: number, z: number) => {
  let height = noise2D(x * 0.02, z * 0.02) * 8;
  height += noise2D(x * 0.05, z * 0.05) * 2;
  return height;
};

// Update camera aspect on resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
const animate = () => {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.1); // Cap delta to avoid huge jumps

  const currentWaterY = waterLevel + Math.sin(time * 0.001) * 0.15;
  waterMesh.position.y = currentWaterY;

  const playerPos = camera.position;
  const isUnderwater = playerPos.y < currentWaterY + 0.2; // Camera is at player head height

  if (isUnderwater) {
    scene.background = waterColor;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color = waterColor;
      scene.fog.near = 5;
      scene.fog.far = 25;
    }
  } else {
    scene.background = skyColor;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color = skyColor;
      scene.fog.near = 60;
      scene.fog.far = 270;
    }
  }

  if (controls.isLocked) {
    const groundHeight = getTerrainHeight(playerPos.x, playerPos.z);

    // Movement Physics
    velocity.x -= velocity.x * (isUnderwater ? 15.0 : 10.0) * delta;
    velocity.z -= velocity.z * (isUnderwater ? 15.0 : 10.0) * delta;
    
    if (isUnderwater) {
      velocity.y -= 10.0 * delta; // Slower sinking in water
      velocity.y -= velocity.y * 4.0 * delta; // Water drag
    } else {
      velocity.y -= 30.0 * delta; // Gravity
    }

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    let speed = moveState.sprint ? 110.0 : 60.0;
    if (isUnderwater) speed *= 0.5; // Slow down in water

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    playerPos.y += velocity.y * delta;

    // Check if player is below ground
    if (playerPos.y < groundHeight + 2) {
      velocity.y = 0;
      playerPos.y = groundHeight + 2;
    }

    // Jumping & Swimming physics
    const isGrounded = playerPos.y <= groundHeight + 2.05;
    if (moveState.jump) {
      if (isUnderwater) {
        velocity.y = 5.0; // Swim up
      } else if (isGrounded) {
        velocity.y = 12.0; // Jump
      }
    }

    updateChunks(playerPos.x, playerPos.z);
    
    // Follow water and particles
    waterMesh.position.x = playerPos.x;
    waterMesh.position.z = playerPos.z;

    particlesMesh.position.x = playerPos.x;
    particlesMesh.position.z = playerPos.z;
  }

  // Animate Particles
  const pPos = particlesMesh.geometry.attributes.position;
  for(let i=0; i<particleCount; i++) {
    let y = pPos.getY(i);
    y -= delta * 3; // Falling speed
    if(y < -50) y = 50;
    pPos.setY(i, y);
  }
  pPos.needsUpdate = true;

  // Animate Animals
  animals.forEach(animal => {
    // Wandering AI
    if (animal.mesh.position.distanceTo(animal.target) < 2 || Math.random() < 0.005) {
      animal.target.set(
        animal.mesh.position.x + (Math.random() - 0.5) * 60,
        0,
        animal.mesh.position.z + (Math.random() - 0.5) * 60
      );
    }
    
    const dir = new THREE.Vector3().subVectors(animal.target, animal.mesh.position);
    dir.y = 0;
    dir.normalize();
    
    // Rotate towards target (smoothly)
    const targetRotation = Math.atan2(dir.x, dir.z);
    
    // Lerp rotation manually
    let diff = targetRotation - animal.mesh.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    animal.mesh.rotation.y += diff * 2 * delta;

    // Move
    const moveSpeed = animal.type === 'bird' ? 12 : 3;
    animal.mesh.position.x += Math.sin(animal.mesh.rotation.y) * moveSpeed * delta;
    animal.mesh.position.z += Math.cos(animal.mesh.rotation.y) * moveSpeed * delta;
    
    // Terrain follow
    const h = getTerrainHeight(animal.mesh.position.x, animal.mesh.position.z);
    if (animal.type === 'bird') {
      animal.mesh.position.y = THREE.MathUtils.lerp(animal.mesh.position.y, h + 20, delta * 2);
      // Bird bobbing
      animal.mesh.position.y += Math.sin(time * 0.005 + animal.mesh.position.x) * 0.02;
    } else {
      animal.mesh.position.y = h + 1; 
      // Sheep walking animation (bobbing)
      if (Math.abs(diff) < 1) {
        animal.mesh.position.y += Math.abs(Math.sin(time * 0.01)) * 0.2;
      }
    }
  });

  renderer.render(scene, camera);
  prevTime = time;
};

// Initial chunk update
updateChunks(0, 0);

animate();
