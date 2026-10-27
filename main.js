import * as THREE from "./assets/vendor/three/three.module.js";
import { OrbitControls } from "./assets/vendor/three/OrbitControls.js";

const container = document.querySelector("#scene-container");
const loading = document.querySelector("#scene-loading");
const errorMessage = document.querySelector("#scene-error");
const viewLabel = document.querySelector("#view-label");
const cameraCaption = document.querySelector("#camera-caption");
const lightToggle = document.querySelector("#light-toggle");
const buttons = [...document.querySelectorAll(".view-button")];

const venue = { width: 30, length: 48, wallHeight: 12, floorY: 0 };
const scene = new THREE.Scene();
scene.background = new THREE.Color("#20251e");
scene.fog = new THREE.Fog("#20251e", 58, 112);

let renderer;
let controls;
let lightsOn = true;
const eventLights = [];
const beamMeshes = [];
const eventLightMeshes = [];

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 180);
camera.position.set(8, 26, 58);

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.2, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 19;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.update();

  createLighting();
  createVenue();
  createStage();
  createCourts();
  createDrapes();
  createShowLights();
  createDetails();
  resize();
  window.addEventListener("resize", resize);
  loading.hidden = true;
  animate();
} catch (error) {
  console.error("Gagal menyiapkan visualisasi venue 3D:", error);
  loading.hidden = true;
  errorMessage.hidden = false;
}

function material(color, roughness = 0.82, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(parent, name, size, position, mat, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function addLine(parent, from, to, mat, thickness = 0.035) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const delta = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, delta.length(), 6), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createLighting() {
  scene.add(new THREE.HemisphereLight("#f0f3db", "#354239", 2.05));
  const ambient = new THREE.AmbientLight("#fff5db", 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#fff2cf", 3.1);
  key.position.set(-11, 28, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -34;
  key.shadow.camera.right = 34;
  key.shadow.camera.top = 34;
  key.shadow.camera.bottom = -34;
  scene.add(key);

  const stageGlow = new THREE.PointLight("#ffbd4c", 30, 25, 2);
  stageGlow.position.set(0, 7, -20);
  scene.add(stageGlow);
  eventLights.push(stageGlow);
}

function createVenue() {
  const shell = new THREE.Group();
  shell.name = "Venue shell";
  scene.add(shell);
  const floor = addBox(shell, "Lantai venue", [venue.width, 0.35, venue.length], [0, -0.22, 0], material("#356b57", 0.72));
  floor.receiveShadow = true;
  addBox(shell, "Area masuk biru", [venue.width, 0.08, 5], [0, -0.025, 25.1], material("#4e7180", 0.68));

  const wallMat = material("#c8c8b7");
  addBox(shell, "Dinding belakang", [venue.width, venue.wallHeight, 0.55], [0, 6, -24.3], wallMat);
  addBox(shell, "Dinding sisi kiri", [0.55, venue.wallHeight, venue.length], [-14.75, 6, 0], wallMat);
  addBox(shell, "Dinding sisi kanan", [0.55, venue.wallHeight, venue.length], [14.75, 6, 0], wallMat);

  const darkSteel = material("#252b28", 0.55, 0.24);
  for (const x of [-14.35, 14.35]) {
    for (const z of [-20, -12, -4, 4, 12, 20]) {
      addBox(shell, "Kolom struktur", [0.42, 10.2, 0.42], [x, 5.1, z], darkSteel);
      addLine(shell, [x, 2.8, z], [x + (x < 0 ? 2.1 : -2.1), 7.6, z], darkSteel, 0.15);
    }
  }

  const balcony = material("#333936", 0.6, 0.16);
  const railing = material("#252a27", 0.48, 0.35);
  addBox(shell, "Jogging track kiri", [2.4, 0.35, 43], [-12.9, 7.7, 0], balcony);
  addBox(shell, "Jogging track kanan", [2.4, 0.35, 43], [12.9, 7.7, 0], balcony);
  addBox(shell, "Jogging track belakang", [25, 0.35, 2.4], [0, 7.7, -21.2], balcony);

  for (const side of [-1, 1]) {
    const x = side * 11.7;
    for (let z = -20; z <= 20; z += 1.15) {
      addBox(shell, "Jeruji railing", [0.075, 0.85, 0.075], [x, 8.28, z], railing, { castShadow: false });
    }
    addBox(shell, "Pegangan railing", [0.1, 0.1, 43], [x, 8.72, 0], railing, { castShadow: false });
  }
  for (let x = -11.8; x <= 11.8; x += 1.1) {
    addBox(shell, "Jeruji railing belakang", [0.075, 0.85, 0.075], [x, 8.28, -20.1], railing, { castShadow: false });
  }
  addBox(shell, "Pegangan railing belakang", [25, 0.1, 0.1], [0, 8.72, -20.1], railing, { castShadow: false });

  const trackLine = material("#72786b", 0.75);
  addBox(shell, "Garis jogging track kiri", [0.035, 0.015, 42], [-13.3, 7.89, 0], trackLine, { castShadow: false });
  addBox(shell, "Garis jogging track kanan", [0.035, 0.015, 42], [13.3, 7.89, 0], trackLine, { castShadow: false });

  // The roof is intentionally omitted so the model remains open for drone views.
  const topFrame = material("#202522", 0.56, 0.27);
  for (const x of [-14.15, 14.15]) {
    addBox(shell, "Balok ring perimeter", [0.24, 0.24, venue.length], [x, 11.2, 0], topFrame);
  }
}

function createStage() {
  const stage = new THREE.Group();
  stage.name = "Panggung utama";
  scene.add(stage);

  addBox(stage, "Platform panggung", [21.5, 0.7, 5], [0, 0.42, -20.4], material("#22241f", 0.63));
  addBox(stage, "Karpet panggung", [19.9, 0.06, 3.8], [0, 0.8, -20.4], material("#171a17", 0.95));
  addBox(stage, "Backdrop panggung", [20.4, 5.7, 0.24], [0, 4.15, -23.78], createBackdropMaterial());
  addBox(stage, "Panel backdrop kiri", [1.8, 5.7, 0.18], [-11.1, 4.15, -23.7], material("#171a17"));
  addBox(stage, "Panel backdrop kanan", [1.8, 5.7, 0.18], [11.1, 4.15, -23.7], material("#171a17"));

  const black = material("#171a17");
  const yellow = material("#e6bc42", 0.55);
  for (const x of [-9.1, 9.1]) {
    addBox(stage, "Speaker", [1.15, 2.1, 0.85], [x, 1.85, -21.1], black);
    addBox(stage, "Speaker grille", [0.82, 1.2, 0.035], [x, 1.86, -20.65], material("#30342e"));
    addBox(stage, "Monitor panggung", [1.15, 0.38, 0.76], [x * 0.65, 1.02, -19.3], black);
  }
  addBox(stage, "Meja door prize kiri", [3.8, 0.85, 0.9], [-6.4, 1.17, -21.1], yellow);
  addBox(stage, "Meja live band kanan", [3.8, 0.85, 0.9], [6.4, 1.17, -21.1], black);
  addBox(stage, "Papan door prize kiri", [3.7, 0.12, 0.06], [-6.4, 2.2, -20.55], yellow);
  addBox(stage, "Papan live band kanan", [3.7, 0.12, 0.06], [6.4, 2.2, -20.55], yellow);
  addBandSetup(stage, black, yellow);

  const truss = material("#252a26", 0.5, 0.35);
  addBox(stage, "Truss panggung atas", [21.5, 0.15, 0.15], [0, 7.3, -23.3], truss);
  for (const x of [-9.9, 9.9]) {
    addBox(stage, "Tiang truss panggung", [0.15, 6.2, 0.15], [x, 4.25, -23.3], truss);
  }
}

function createBackdropMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 460;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia untuk backdrop panggung.");

  ctx.fillStyle = "#171916";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#efc63f";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(290, 0); ctx.lineTo(0, 208); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1600, 0); ctx.lineTo(1310, 0); ctx.lineTo(1600, 208); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 460); ctx.lineTo(320, 460); ctx.lineTo(0, 235); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1600, 460); ctx.lineTo(1280, 460); ctx.lineTo(1600, 235); ctx.fill();

  ctx.fillStyle = "#f4f0e4";
  ctx.fillRect(355, 28, 890, 404);
  ctx.fillStyle = "#282a25";
  ctx.fillRect(28, 36, 290, 386);
  ctx.fillRect(1282, 36, 290, 386);

  ctx.strokeStyle = "#efc63f";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(432, 111); ctx.lineTo(575, 39); ctx.lineTo(641, 88);
  ctx.lineTo(723, 25); ctx.lineTo(798, 88); ctx.lineTo(868, 42);
  ctx.lineTo(1001, 111);
  ctx.stroke();
  ctx.fillStyle = "#e2b930";
  ctx.fillRect(621, 106, 358, 57);
  ctx.fillStyle = "#1f211d";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TRAKINDO  CAT", 800, 147);
  ctx.fillStyle = "#262823";
  ctx.font = "700 41px Arial, sans-serif";
  ctx.fillText("TRAKINDO HIGHLANDER", 800, 225);
  ctx.fillStyle = "#d4a91d";
  ctx.font = "italic 700 105px Georgia, serif";
  ctx.fillText("Fun Day", 800, 335);
  ctx.fillStyle = "#252721";
  ctx.fillRect(674, 365, 252, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "700 37px Arial, sans-serif";
  ctx.fillText("2026", 800, 402);

  ctx.fillStyle = "#efc63f";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("DOOR", 173, 174);
  ctx.fillText("PRIZE", 173, 214);
  ctx.fillText("LIVE", 1427, 174);
  ctx.fillText("BAND", 1427, 214);
  ctx.strokeStyle = "#efc63f";
  ctx.lineWidth = 4;
  ctx.strokeRect(82, 126, 182, 112);
  ctx.strokeRect(1336, 126, 182, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.86 });
}

function addBandSetup(parent, black, yellow) {
  const drumMaterial = material("#252a27", 0.52, 0.3);
  addBox(parent, "Drum bass live band", [0.95, 0.95, 0.65], [6.8, 1.28, -19.8], drumMaterial);
  addBox(parent, "Drum snare live band", [0.65, 0.32, 0.55], [5.55, 1.16, -19.8], drumMaterial);
  addBox(parent, "Keyboard live band", [2.4, 0.18, 0.7], [8, 1.65, -20.5], black);
  addBox(parent, "Stand keyboard", [0.12, 1.05, 0.12], [8, 1.08, -20.5], drumMaterial);
  addBox(parent, "Paket hadiah door prize", [0.9, 0.85, 0.8], [-7.3, 1.65, -20.3], yellow);
  addBox(parent, "Paket hadiah door prize", [0.7, 0.62, 0.7], [-5.5, 1.52, -20.3], material("#d4a827"));
}

function createCourts() {
  const lineMaterial = material("#f1f0df", 0.56);
  const courtLength = 17.8;
  const courtWidth = 7.7;
  const courtCentersSouthToNorth = [12, 0, -12];

  courtCentersSouthToNorth.forEach((centerZ, index) => {
    const court = new THREE.Group();
    court.name = `Lapangan ${index + 1}`;
    scene.add(court);
    const x1 = -courtLength / 2;
    const x2 = courtLength / 2;
    const z1 = centerZ - courtWidth / 2;
    const z2 = centerZ + courtWidth / 2;
    const service = 2.35;
    const singlesInset = 0.46;
    const doublesLongService = 0.76;

    addCourtLine(court, x1, x1, z1, z2, lineMaterial);
    addCourtLine(court, x2, x2, z1, z2, lineMaterial);
    addCourtLine(court, x1, x2, z1, z1, lineMaterial);
    addCourtLine(court, x1, x2, z2, z2, lineMaterial);
    addCourtLine(court, x1, x2, centerZ, centerZ, lineMaterial);
    addCourtLine(court, x1, x2, z1 + singlesInset, z1 + singlesInset, lineMaterial);
    addCourtLine(court, x1, x2, z2 - singlesInset, z2 - singlesInset, lineMaterial);
    addCourtLine(court, -service, -service, z1, z2, lineMaterial);
    addCourtLine(court, service, service, z1, z2, lineMaterial);
    addCourtLine(court, x1 + doublesLongService, x1 + doublesLongService, z1, z2, lineMaterial);
    addCourtLine(court, x2 - doublesLongService, x2 - doublesLongService, z1, z2, lineMaterial);
  });
}

function addCourtLine(parent, x1, x2, z1, z2, mat) {
  const dx = Math.abs(x2 - x1);
  const dz = Math.abs(z2 - z1);
  if (dx > 0) {
    addBox(parent, "Garis lapangan", [dx, 0.025, 0.04], [(x1 + x2) / 2, 0.012, (z1 + z2) / 2], mat, { castShadow: false });
  } else {
    addBox(parent, "Garis lapangan", [0.04, 0.025, dz], [(x1 + x2) / 2, 0.012, (z1 + z2) / 2], mat, { castShadow: false });
  }
}

function createDrapes() {
  const curtainColors = ["#171918", "#e4e0d5"];
  const top = 7.48;
  const bottom = 0.62;
  const panelWidth = 1.76;
  const panelCount = 22;

  for (const side of [-1, 1]) {
    const x = side * 13.58;
    addBox(scene, "Rel gantung tirai", [0.1, 0.1, 40.2], [x, top, 0], material("#242925", 0.52, 0.28), { castShadow: false });

    for (let i = 0; i < panelCount; i += 1) {
      const z = -19.1 + i * 1.82;
      const color = curtainColors[i % curtainColors.length];
      const curtain = createCurtainMesh(side, x, z, panelWidth, top, bottom, color);
      curtain.name = `Tirai ${color === curtainColors[0] ? "hitam" : "putih"} ${side < 0 ? "kiri" : "kanan"}`;
      scene.add(curtain);
    }
  }
}

function createCurtainMesh(side, x, centerZ, width, top, bottom, color) {
  const acrossSegments = 12;
  const heightSegments = 18;
  const positions = [];
  const indices = [];

  for (let row = 0; row <= heightSegments; row += 1) {
    const v = row / heightSegments;
    for (let column = 0; column <= acrossSegments; column += 1) {
      const u = column / acrossSegments;
      const pleat = Math.cos(u * Math.PI * 8) * 0.1;
      const bottomWave = Math.sin(u * Math.PI * 4) * 0.09 * v * v;
      positions.push(
        x + side * pleat,
        top - v * (top - bottom) + bottomWave,
        centerZ + (u - 0.5) * width,
      );
    }
  }

  for (let row = 0; row < heightSegments; row += 1) {
    for (let column = 0; column < acrossSegments; column += 1) {
      const a = row * (acrossSegments + 1) + column;
      const b = a + acrossSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createShowLights() {
  const positions = [
    { x: -12, z: 15, color: "#cb45ff" },
    { x: 12, z: 15, color: "#42b8ff" },
    { x: -12, z: -13, color: "#e9c642" },
    { x: 12, z: -13, color: "#52f0b2" },
  ];

  for (const { x, z, color } of positions) {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    addBox(lamp, "Stand lampu", [0.16, 2.2, 0.16], [0, 1.1, 0], material("#222723"));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 }));
    head.position.set(0, 2.35, 0);
    lamp.add(head);
    eventLightMeshes.push(head);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 13, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(-x * 0.25, 4.75, z < 0 ? 5 : -5);
    beam.rotation.x = Math.PI;
    scene.add(beam);
    beamMeshes.push(beam);
    const light = new THREE.SpotLight(color, 42, 24, Math.PI / 7, 0.75, 1.3);
    light.position.set(x, 2.5, z);
    light.target.position.set(x * 0.35, 0, 1);
    scene.add(light, light.target);
    eventLights.push(light);
  }

  const colorPool = ["#e84e9d", "#43b8ff", "#cfef66", "#fbba45", "#9d70ff"];
  for (let i = 0; i < 105; i += 1) {
    const angle = i * 2.399;
    const radius = 0.9 + (i % 11) * 0.48;
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.07 + (i % 3) * 0.035, 10),
      new THREE.MeshBasicMaterial({ color: colorPool[i % colorPool.length], transparent: true, opacity: 0.56, side: THREE.DoubleSide }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(Math.cos(angle) * radius, 0.025, 7 + Math.sin(angle) * radius);
    dot.userData.eventLight = true;
    scene.add(dot);
    beamMeshes.push(dot);
  }
}

function createDetails() {
  const bench = material("#353a34");
  for (const side of [-1, 1]) {
    for (let z = -14; z <= 16; z += 5) {
      addBox(scene, "Bangku sisi venue", [0.65, 0.38, 2.5], [side * 12.1, 0.3, z], bench);
      addBox(scene, "Kaki bangku", [0.12, 0.3, 0.12], [side * 12.1, 0.15, z - 0.8], material("#242a25"));
      addBox(scene, "Kaki bangku", [0.12, 0.3, 0.12], [side * 12.1, 0.15, z + 0.8], material("#242a25"));
    }
  }
  const wallLight = material("#f1d89c", 0.4, 0);
  for (let z = -17; z <= 17; z += 8.5) {
    for (const side of [-1, 1]) {
      const fixture = addBox(scene, "Lampu dinding venue", [0.15, 0.34, 1.2], [side * 14.36, 10.1, z], wallLight);
      fixture.material.emissive = new THREE.Color("#f1d89c");
      fixture.material.emissiveIntensity = 0.45;
    }
  }
}

const cameraViews = {
  entrance: {
    position: [8, 26, 58],
    target: [0, 1.2, -2],
    label: "PINTU MASUK",
    caption: "PERSPEKTIF DARI PINTU MASUK",
  },
  drone: {
    position: [0, 55, 5],
    target: [0, 0, -2],
    label: "TAMPAK ATAS / DRONE",
    caption: "AREA ATAS TERBUKA UNTUK PENGAMBILAN DRONE",
  },
  stage: {
    position: [3, 15, 25],
    target: [0, 2, -19],
    label: "ARAH PANGGUNG",
    caption: "PANGGUNG UTAMA & TIGA LAPANGAN",
  },
};

function setCameraView(name) {
  const view = cameraViews[name];
  if (!view) return;
  camera.position.set(...view.position);
  controls.target.set(...view.target);
  controls.update();
  viewLabel.textContent = view.label;
  cameraCaption.textContent = view.caption;
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.view === name));
}

buttons.forEach((button) => {
  button.addEventListener("click", () => setCameraView(button.dataset.view));
});

lightToggle.addEventListener("click", () => {
  lightsOn = !lightsOn;
  eventLights.forEach((light) => {
    light.visible = lightsOn;
  });
  eventLightMeshes.forEach((mesh) => {
    mesh.visible = lightsOn;
  });
  beamMeshes.forEach((mesh) => {
    mesh.visible = lightsOn;
  });
  lightToggle.setAttribute("aria-pressed", String(lightsOn));
  lightToggle.setAttribute("aria-label", lightsOn ? "Matikan lampu acara" : "Nyalakan lampu acara");
});

document.querySelector("#reset-view").addEventListener("click", () => setCameraView("entrance"));

function resize() {
  if (!renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
