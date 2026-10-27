import * as THREE from "./assets/vendor/three/three.module.js";
import { OrbitControls } from "./assets/vendor/three/OrbitControls.js";

const container = document.querySelector("#scene-container");
const loading = document.querySelector("#scene-loading");
const errorMessage = document.querySelector("#scene-error");
const buttons = [...document.querySelectorAll(".view-button")];
const playButton = document.querySelector("#play-simulation");
const pauseButton = document.querySelector("#pause-simulation");
const restartButton = document.querySelector("#restart-simulation");
const phaseDescription = document.querySelector("#phase-description");
const phaseTime = document.querySelector("#phase-time");
const soundStatus = document.querySelector("#sound-status");
const durationLabel = document.querySelector("#duration-label");
const timelineScrubber = document.querySelector("#timeline-scrubber");
const lightToggle = document.querySelector("#toggle-lights");
const showLightToggle = document.querySelector("#toggle-show-lights");
const participantCountSelect = document.querySelector("#participant-count");

const venue = { width: 30, length: 48, wallHeight: 12, floorY: 0 };
let participantCount = Number(participantCountSelect.value);
const arrivalDuration = 60;
const lightingDuration = 120;
const danceDuration = 60;
const phaseAudioFiles = {
  arrival: "./assets/audio/peserta-masuk.mp3",
  lighting: "./assets/audio/lighting-show.mp3",
  dance: "./assets/audio/dancer.mp3",
};
const lightingStartsAt = arrivalDuration;
const danceStartsAt = lightingStartsAt + lightingDuration;
const finaleStartsAt = danceStartsAt + danceDuration;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#20251e");
scene.fog = new THREE.Fog("#20251e", 58, 112);

let renderer;
let controls;
let ambientLight;
let hemisphereLight;
let keyLight;
let stageGlow;
let participantShirtMaterial;
let audioContext;
let audioMaster;
let audioInterval;
let phaseAudio;
let audioStep = 0;
let audioTransition = false;
let lastFrameTime = 0;
let lastInterfaceFrame = -1;
let venueLightsEnabled = true;
let showLightingEnabled = false;
let simulation = { state: "idle", elapsed: 0, phase: "arrival" };
const showLights = [];
const showLightTargets = [];
const showBeams = [];
const showBeamSources = [];
const showHeads = [];
const lightSpeckles = [];
const participants = [];
const participantMeshes = [];
const dancers = [];
const mcs = [];
const instancePosition = new THREE.Vector3();
const instanceGroupPosition = new THREE.Vector3();
const instanceBasePosition = new THREE.Vector3();
const instanceRotation = new THREE.Quaternion();
const instanceLocalRotation = new THREE.Quaternion();
const instanceLocalEuler = new THREE.Euler();
const instanceWorldRotation = new THREE.Quaternion();
const instanceScale = new THREE.Vector3();
const instanceMatrix = new THREE.Matrix4();
const participantUp = new THREE.Vector3(0, 1, 0);
const beamDirection = new THREE.Vector3();
const beamMidpoint = new THREE.Vector3();

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 180);
camera.position.set(8, 36, 55);

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
  controls.minDistance = 1.5;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.update();

  createLighting();
  createVenue();
  createStage();
  createCourts();
  createFloorBanner();
  createDrapes();
  createShowLights();
  createDetails();
  createDancers();
  createMc();
  updateLighting();
  updateInterface();
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
  hemisphereLight = new THREE.HemisphereLight("#f0f3db", "#354239", 2.05);
  scene.add(hemisphereLight);
  ambientLight = new THREE.AmbientLight("#fff5db", 0.55);
  scene.add(ambientLight);

  keyLight = new THREE.DirectionalLight("#fff2cf", 3.1);
  keyLight.position.set(-11, 28, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -34;
  keyLight.shadow.camera.right = 34;
  keyLight.shadow.camera.top = 34;
  keyLight.shadow.camera.bottom = -34;
  scene.add(keyLight);

  stageGlow = new THREE.PointLight("#ffbd4c", 30, 25, 2);
  stageGlow.position.set(0, 7, -20);
  scene.add(stageGlow);
}

function createVenue() {
  const shell = new THREE.Group();
  shell.name = "Venue shell";
  scene.add(shell);
  const floor = addBox(shell, "Lantai biru venue", [venue.width, 0.35, venue.length], [0, -0.22, 0], material("#416f8b", 0.72));
  floor.receiveShadow = true;
  addBox(shell, "Area masuk biru", [venue.width, 0.08, 5], [0, -0.025, 25.1], material("#4e7180", 0.68));
  addBox(scene, "Area hijau tiga lapangan", [24, 0.02, 39], [0, -0.035, 0.5], material("#356b57", 0.72), { castShadow: false });

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

  addBox(stage, "Dinding krem atas panggung", [28, 4.6, 0.28], [0, 9.35, -24.02], material("#c8c8b7"));
  const windowFrame = material("#252b28", 0.55, 0.24);
  const windowGlass = material("#8ab9c5", 0.24, 0.08);
  addBox(stage, "Lis hitam bagian atas dinding belakang", [28.3, 0.24, 0.24], [0, 11.2, -23.82], material("#202522", 0.56, 0.27));
  for (const centerX of [-7.3, 0, 7.3]) {
    const windowWidth = 4.2;
    const windowHeight = 1.55;
    const windowY = 9.55;
    const windowZ = -23.82;
    addBox(stage, "Bingkai jendela dinding belakang", [windowWidth, windowHeight, 0.08], [centerX, windowY, windowZ], windowFrame);
    addBox(stage, "Kaca jendela dinding belakang", [windowWidth - 0.24, windowHeight - 0.24, 0.035], [centerX, windowY, windowZ + 0.055], windowGlass, { castShadow: false });
    addBox(stage, "Tiang tengah jendela", [0.1, windowHeight - 0.18, 0.06], [centerX, windowY, windowZ + 0.085], windowFrame, { castShadow: false });
    addBox(stage, "Palang jendela", [windowWidth - 0.18, 0.1, 0.06], [centerX, windowY, windowZ + 0.085], windowFrame, { castShadow: false });
  }
  addBox(stage, "Platform panggung", [21.5, 0.7, 5], [0, 0.42, -20.4], material("#22241f", 0.63));
  addBox(stage, "Karpet panggung", [19.9, 0.06, 3.8], [0, 0.8, -20.4], material("#171a17", 0.95));
  addBox(stage, "Backdrop panggung", [20.4, 5.7, 0.24], [0, 4.15, -23.78], material("#171a17", 0.92));
  createStageBanner(stage);
  addStageSideImage(stage, "Door prize", "./assets/img/doorprize.jpg", -9.55);
  addStageSideImage(stage, "Live band", "./assets/img/liveband.jpg", 9.55);
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
  const trussZ = -23.82;
  addBox(stage, "Truss panggung atas", [21.5, 0.15, 0.15], [0, 7.3, trussZ], truss);
  for (const x of [-9.9, 9.9]) {
    addBox(stage, "Tiang truss panggung", [0.15, 6.2, 0.15], [x, 4.25, trussZ], truss);
  }
}

function createStageBanner(parent) {
  const imagePath = "./assets/img/spanduk%20for%20stage.png";
  new THREE.TextureLoader().load(
    imagePath,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const bannerHeight = 5.68;
      const bannerWidth = bannerHeight * (texture.image.width / texture.image.height);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(bannerWidth, bannerHeight),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
      );
      banner.name = "Spanduk Fun Day panggung utama";
      banner.position.set(0, 4.15, -23.64);
      parent.add(banner);
    },
    undefined,
    (error) => {
      console.error(`Gagal memuat spanduk panggung: ${imagePath}`, error);
    },
  );
}

function addStageSideImage(parent, name, imagePath, x) {
  new THREE.TextureLoader().load(
    imagePath,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const imageHeight = 5.68;
      const imageWidth = imageHeight * (texture.image.width / texture.image.height);
      const image = new THREE.Mesh(
        new THREE.PlaneGeometry(imageWidth, imageHeight),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
      );
      image.name = `Gambar ${name} panggung`;
      image.position.set(x, 4.15, -23.58);
      parent.add(image);
    },
    undefined,
    (error) => {
      console.error(`Gagal memuat gambar ${name} panggung: ${imagePath}`, error);
    },
  );
}

function addBandSetup(parent, black, yellow) {
  const drumMaterial = material("#252a27", 0.52, 0.3);
  const drumHead = material("#ded5bb", 0.72);
  const metal = material("#9a9b91", 0.4, 0.62);
  const drum = (name, radius, depth, position, mat, horizontal = false) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 20), mat);
    mesh.name = name;
    mesh.position.set(...position);
    if (horizontal) mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  drum("Drum bass live band", 0.48, 0.62, [6.65, 1.25, -19.9], drumMaterial, true);
  drum("Kepala drum bass live band", 0.4, 0.035, [6.65, 1.25, -19.56], drumHead, true);
  drum("Drum snare live band", 0.31, 0.3, [5.85, 1.18, -19.85], drumMaterial);
  drum("Drum tom live band", 0.29, 0.32, [6.05, 1.78, -20.05], drumMaterial);
  drum("Drum tom live band", 0.32, 0.34, [6.85, 1.78, -20.05], drumMaterial);
  drum("Simbol live band", 0.43, 0.055, [5.45, 2.15, -20.05], yellow);
  drum("Simbol live band", 0.48, 0.055, [7.55, 2.25, -20.05], yellow);
  addLine(parent, [5.45, 0.85, -20.05], [5.45, 2.12, -20.05], metal, 0.035);
  addLine(parent, [7.55, 0.85, -20.05], [7.55, 2.22, -20.05], metal, 0.035);
  addLine(parent, [6.05, 0.9, -20.05], [6.05, 1.62, -20.05], metal, 0.025);
  addLine(parent, [6.85, 0.9, -20.05], [6.85, 1.62, -20.05], metal, 0.025);

  addBox(parent, "Keyboard live band", [2.4, 0.18, 0.7], [8, 1.65, -20.5], black);
  addBox(parent, "Stand keyboard", [0.12, 1.05, 0.12], [8, 1.08, -20.5], drumMaterial);
  const guitarBody = material("#d4a827", 0.48, 0.16);
  const guitarNeck = material("#6b4930", 0.55);
  for (const [index, x] of [4.65, 5.3].entries()) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), index ? guitarBody : material("#8c3f28", 0.48, 0.16));
    body.name = index ? "Gitar bass live band" : "Gitar elektrik live band";
    body.position.set(x, 1.2, -19.35);
    body.scale.set(0.78, 1.15, 0.35);
    body.castShadow = true;
    parent.add(body);
    addBox(parent, "Leher gitar live band", [0.13, 0.92, 0.12], [x, 1.66, -19.35], guitarNeck);
    addBox(parent, "Kepala gitar live band", [0.22, 0.28, 0.14], [x, 2.21, -19.35], guitarNeck);
    addBox(parent, "Stand gitar live band", [0.55, 0.08, 0.42], [x, 0.84, -19.25], metal);
    for (let string = -1; string <= 1; string += 1) {
      addLine(parent, [x + string * 0.025, 1.05, -19.15], [x + string * 0.025, 2.25, -19.15], metal, 0.008);
    }
  }
  addBox(parent, "Amplifier gitar live band", [0.9, 1.15, 0.62], [9.05, 1.35, -20.25], black);
  addBox(parent, "Grille amplifier gitar live band", [0.72, 0.72, 0.035], [9.05, 1.27, -19.925], material("#494a41", 0.8));
  addBox(parent, "Paket hadiah door prize", [0.9, 0.85, 0.8], [-7.3, 1.65, -20.3], yellow);
  addBox(parent, "Paket hadiah door prize", [0.7, 0.62, 0.7], [-5.5, 1.52, -20.3], material("#d4a827"));
  addBox(parent, "Paket hadiah door prize", [0.78, 0.62, 0.72], [-8.35, 1.08, -20.05], yellow);
  addBox(parent, "Paket hadiah door prize", [0.72, 0.56, 0.68], [-7.8, 1.67, -20.05], material("#292b26"));
  addBox(parent, "Paket hadiah door prize", [0.82, 0.7, 0.74], [-6.9, 1.12, -19.98], material("#d4a827"));
  addBox(parent, "Paket hadiah door prize", [0.64, 0.52, 0.62], [-5.95, 1.04, -19.98], yellow);
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

function createFloorBanner() {
  const imagePath = "./assets/img/spanduk%20for%20floor.png";
  new THREE.TextureLoader().load(
    imagePath,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = 700;
      logoCanvas.height = 230;
      const context = logoCanvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D tidak tersedia untuk logo lantai venue.");
      context.drawImage(texture.image, 88, 140, 350, 115, 0, 0, logoCanvas.width, logoCanvas.height);
      texture.dispose();
      const pixels = context.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        const brightness = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (brightness > 174 && chroma < 48) pixels.data[index + 3] = 0;
      }
      context.putImageData(pixels, 0, 0);
      const logoTexture = new THREE.CanvasTexture(logoCanvas);
      logoTexture.colorSpace = THREE.SRGBColorSpace;
      const bannerWidth = 10;
      const bannerDepth = bannerWidth / (logoCanvas.width / logoCanvas.height);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(bannerWidth, bannerDepth),
        new THREE.MeshBasicMaterial({
          map: logoTexture,
          transparent: true,
          alphaTest: 0.02,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      banner.name = "Spanduk Fun Day di lapangan tengah";
      banner.rotation.x = -Math.PI / 2;
      banner.position.set(0, -0.012, 0);
      banner.receiveShadow = true;
      scene.add(banner);
    },
    undefined,
    (error) => {
      console.error(`Gagal memuat gambar lantai venue: ${imagePath}`, error);
    },
  );
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
  const curtainPairCenters = [-18.2, -13, -7.8, -2.6, 2.6, 7.8, 13, 18.2];

  for (const side of [-1, 1]) {
    const x = side * 11.35;
    addBox(scene, "Rel gantung tirai", [0.1, 0.1, 40.2], [x, top, 0], material("#242925", 0.52, 0.28), { castShadow: false });

    curtainPairCenters.forEach((pairCenter) => {
      curtainColors.forEach((color, pairIndex) => {
        const z = pairCenter + (pairIndex - 0.5) * panelWidth;
        const curtain = createCurtainMesh(side, x, z, panelWidth, top, bottom, color);
        curtain.name = `Tirai ${color === curtainColors[0] ? "hitam" : "putih"} ${side < 0 ? "kiri" : "kanan"}`;
        scene.add(curtain);
      });
    });
  }

  const entranceZ = 24.2;
  addBox(
    scene,
    "Rel tirai hitam pintu masuk selatan",
    [30, 0.1, 0.1],
    [0, top, entranceZ],
    material("#242925", 0.52, 0.28),
    { castShadow: false },
  );
  const entranceCurtain = createCurtainMesh(1, 0, 0, 29.8, top, bottom, "#080909");
  entranceCurtain.name = "Kain hitam penutup penuh pintu masuk selatan";
  entranceCurtain.position.set(0, 0, entranceZ);
  entranceCurtain.rotation.y = Math.PI / 2;
  scene.add(entranceCurtain);
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
  const colors = ["#cb45ff", "#42b8ff", "#e9c642", "#52f0b2", "#ff4f91", "#ff8b38"];
  const positions = [-16, 0, 16].flatMap((z, index) => [
    { x: -11.7, y: 8.9, z, color: colors[index] },
    { x: 11.7, y: 8.9, z, color: colors[index + 3] },
  ]);

  for (const { x, y, z, color } of positions) {
    const lamp = new THREE.Group();
    lamp.position.set(x, y, z);
    scene.add(lamp);
    addBox(lamp, "Bracket lampu pagar", [0.7, 0.12, 0.3], [0, -0.14, 0], material("#252a27", 0.5, 0.3), { castShadow: false });
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.34, 0.46),
      material("#252a27", 0.48, 0.35),
    );
    head.position.set(0, 0.12, 0);
    lamp.add(head);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 }),
    );
    lens.position.set(0, -0.08, 0);
    lamp.add(lens);
    showHeads.push(lens);

    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    scene.add(target);
    showLightTargets.push(target);
    const light = new THREE.SpotLight(color, 0, 42, Math.PI / 8, 0.7, 1.1);
    light.position.set(x, y, z);
    light.target = target;
    scene.add(light);
    showLights.push(light);
    showBeamSources.push(light.position);

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 18, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(x / 2, y / 2, z / 2);
    scene.add(beam);
    showBeams.push(beam);
  }

  const colorPool = ["#e84e9d", "#43b8ff", "#cfef66", "#fbba45", "#9d70ff"];
  for (let i = 0; i < 105; i += 1) {
    const angle = i * 2.399;
    const radius = 0.35 + (i % 11) * 0.36;
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.07 + (i % 3) * 0.035, 10),
      new THREE.MeshBasicMaterial({ color: colorPool[i % colorPool.length], transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(Math.cos(angle) * radius, 0.025, Math.sin(angle) * radius);
    scene.add(dot);
    lightSpeckles.push(dot);
  }
}

function createDancers() {
  const shirtColors = ["#171918", "#efc63f"];
  const formations = [
    { x: 0, z: 0 },
    { x: -1.05, z: -0.3 },
    { x: 1.05, z: -0.3 },
    { x: -0.55, z: 1.05 },
    { x: 0.55, z: 1.05 },
  ];

  formations.forEach((position, index) => {
    const dancer = createPerson(shirtColors[index % shirtColors.length], true);
    dancer.name = `Dancer ${index + 1}`;
    dancer.position.set(position.x, 0, position.z);
    dancer.rotation.y = Math.PI;
    dancer.scale.setScalar(1.4);
    dancer.visible = false;
    dancer.userData.danceOffset = index * 0.7;
    scene.add(dancer);
    dancers.push(dancer);
  });
}

function createMc() {
  for (const [index, x] of [-0.9, 0.9].entries()) {
    const mc = createPerson("#2878b8", false, "#858585");
    mc.name = `MC ${index + 1}`;
    mc.position.set(x, 0.8, -20.1);
    mc.scale.setScalar(1.2);
    mc.userData.arms[1].rotation.z = -0.45;
    addBox(mc, "Dasi MC", [0.09, 0.3, 0.04], [0, 0.62, -0.16], material("#d4a91d"), { castShadow: false });
    addBox(mc, "Mikrofon MC", [0.07, 0.38, 0.07], [0.38, 0.94, -0.05], material("#f4f2e9"), { castShadow: false });
    mc.visible = false;
    scene.add(mc);
    mcs.push(mc);
  }
}

function createPerson(shirtColor, performer = false, pantsColor = performer ? "#20211d" : "#858585") {
  const person = new THREE.Group();
  const shirt = material(shirtColor, 0.86);
  const skin = material(performer ? "#b97750" : "#b88a68", 0.92);
  const pants = material(pantsColor, 0.92);
  const shoes = material("#171a18", 0.9);
  const torso = addBox(person, "Badan", [0.42, 0.58, 0.28], [0, 0.57, 0], shirt, { castShadow: false });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
  head.position.set(0, 1.0, -0.015);
  head.castShadow = false;
  person.add(head);

  const leftArm = addBox(person, "Lengan kiri", [0.13, 0.46, 0.14], [-0.29, 0.58, -0.015], shirt, { castShadow: false });
  const rightArm = addBox(person, "Lengan kanan", [0.13, 0.46, 0.14], [0.29, 0.58, -0.015], shirt, { castShadow: false });
  leftArm.rotation.z = -0.1;
  rightArm.rotation.z = 0.1;
  const leftLeg = addBox(person, "Kaki kiri", [0.16, 0.33, 0.16], [-0.11, 0.17, -0.12], pants, { castShadow: false });
  const rightLeg = addBox(person, "Kaki kanan", [0.16, 0.33, 0.16], [0.11, 0.17, -0.12], pants, { castShadow: false });
  addBox(person, "Sepatu kiri", [0.15, 0.09, 0.24], [-0.11, 0.06, -0.27], shoes, { castShadow: false });
  addBox(person, "Sepatu kanan", [0.15, 0.09, 0.24], [0.11, 0.06, -0.27], shoes, { castShadow: false });
  person.userData.body = torso;
  person.userData.head = head;
  person.userData.arms = [leftArm, rightArm];
  person.userData.legs = [leftLeg, rightLeg];
  person.userData.performer = performer;
  return person;
}

function createParticipants(count) {
  const previousResources = new Set();
  participantMeshes.forEach((mesh) => {
    scene.remove(mesh);
    previousResources.add(mesh.userData.part.geometry);
    previousResources.add(mesh.userData.part.material);
    mesh.dispose();
  });
  previousResources.forEach((resource) => resource.dispose());
  participantMeshes.length = 0;
  participants.length = 0;
  const colors = ["#158b7b", "#147d73", "#1a9180"];

  const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, emissive: "#0b4b42", emissiveIntensity: 0 });
  participantShirtMaterial = shirtMaterial;
  const skinMaterial = material("#b88a68", 0.92);
  const pantsMaterial = material("#858585", 0.92);
  const shoeMaterial = material("#171a18", 0.9);
  const parts = [
    { geometry: new THREE.BoxGeometry(0.42, 0.58, 0.28), material: shirtMaterial, position: [0, 0.72, 0], kind: "body" },
    { geometry: new THREE.SphereGeometry(0.16, 8, 6), material: skinMaterial, position: [0, 1.16, -0.015], kind: "head" },
    { geometry: new THREE.BoxGeometry(0.13, 0.46, 0.14), material: shirtMaterial, position: [-0.29, 0.58, -0.015], kind: "leftArm" },
    { geometry: new THREE.BoxGeometry(0.13, 0.46, 0.14), material: shirtMaterial, position: [0.29, 0.58, -0.015], kind: "rightArm" },
    { geometry: new THREE.BoxGeometry(0.16, 0.33, 0.16), material: pantsMaterial, position: [-0.11, 0.17, 0.1], kind: "leftLeg" },
    { geometry: new THREE.BoxGeometry(0.16, 0.33, 0.16), material: pantsMaterial, position: [0.11, 0.17, 0.1], kind: "rightLeg" },
    { geometry: new THREE.BoxGeometry(0.15, 0.09, 0.24), material: shoeMaterial, position: [-0.11, 0.06, -0.08], kind: "leftShoe" },
    { geometry: new THREE.BoxGeometry(0.15, 0.09, 0.24), material: shoeMaterial, position: [0.11, 0.06, -0.08], kind: "rightShoe" },
  ];

  parts.forEach((part) => {
    part.basePosition = new THREE.Vector3(...part.position);
    part.position = part.basePosition.clone();
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
    mesh.name = `Peserta / ${part.kind}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.part = part;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    scene.add(mesh);
    participantMeshes.push(mesh);
  });

  for (let index = 0; index < count; index += 1) {
    const target = getSeatTarget(index, count);
    const isRightRow = index % 2 === 0;
    const isSouthRow = !isRightRow && (index - 1) / 2 >= Math.round(count * 0.36);
    const start = { x: isRightRow ? 7.1 : 5.9, z: 24.7 };
    const route = isRightRow
      ? [start, { x: 9.9, z: 18.5 }, target]
      : isSouthRow
        ? [start, { x: 5.9, z: 18.5 }, { x: -9.9, z: 18.5 }, { x: -9.9, z: 16.8 }, target]
        : [start, { x: 5.9, z: 18.5 }, { x: -9.9, z: 18.5 }, target];
    const routeLengths = [0];
    for (let point = 1; point < route.length; point += 1) {
      const previous = route[point - 1];
      routeLengths.push(routeLengths[point - 1] + Math.hypot(route[point].x - previous.x, route[point].z - previous.z));
    }
    const walkDuration = isSouthRow ? 11.25 : 18;
    const arrivalProgress = Math.floor(index / 2) / Math.ceil(count / 2 - 1);
    const person = {
      target,
      route,
      routeLengths,
      startAt: arrivalProgress * (arrivalDuration - walkDuration),
      walkDuration,
      rotationY: faceCenter(target.x, target.z, 0, -22),
      shirtColor: new THREE.Color(colors[index % colors.length]),
    };
    participants.push(person);
    parts.forEach((part, partIndex) => {
      if (part.material === shirtMaterial) {
        participantMeshes[partIndex].setColorAt(index, person.shirtColor);
      }
    });
  }

  participantMeshes.forEach((mesh) => {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  updateParticipants(0);
}

function getSeatTarget(index, count) {
  const rightCount = Math.ceil(count / 2);
  const westSideCount = Math.round(count * 0.36);
  const southRowCount = count - rightCount - westSideCount;
  const sideStart = 16.8;
  const sideEnd = -16.8;

  if (index % 2 === 0) {
    const personIndex = index / 2;
    const t = rightCount <= 1 ? 0.5 : personIndex / (rightCount - 1);
    return { x: 9.9, z: sideStart + (sideEnd - sideStart) * t };
  }

  const personIndex = (index - 1) / 2;
  if (personIndex < westSideCount) {
    const t = westSideCount <= 1 ? 0.5 : personIndex / (westSideCount - 1);
    return { x: -9.9, z: sideStart + (sideEnd - sideStart) * t };
  }

  const rowIndex = personIndex - westSideCount;
  const t = southRowCount <= 1 ? 0.5 : rowIndex / (southRowCount - 1);
  return { x: -9.5 + 16.5 * t, z: 16.8 };
}

function faceCenter(x, z, targetX, targetZ) {
  return Math.atan2(-(targetX - x), z - targetZ);
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
    position: [8, 36, 55],
    target: [0, 0, -1],
  },
  drone: {
    position: [0, 58, 0],
    target: [0, 0, 0],
  },
  stage: {
    position: [0, 11, 9],
    target: [0, 3.8, -22],
  },
};

function setCameraView(name) {
  const view = cameraViews[name];
  if (!view) return;
  camera.position.set(...view.position);
  controls.target.set(...view.target);
  controls.update();
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.view === name));
}

buttons.forEach((button) => {
  button.addEventListener("click", () => setCameraView(button.dataset.view));
});

participantCountSelect.addEventListener("change", () => {
  participantCount = Number(participantCountSelect.value);
  stopMusic();
  simulation = { state: "idle", elapsed: 0, phase: "arrival" };
  createParticipants(participantCount);
  soundStatus.textContent = "Audio peserta & lighting belum ditambahkan";
  applySimulationTime(0);
  updateInterface();
});

playButton.addEventListener("click", async () => {
  if (simulation.state === "paused") {
    await resumeSimulation();
    return;
  }
  await startSimulation();
});

pauseButton.addEventListener("click", async () => {
  if (simulation.state === "paused") {
    await resumeSimulation();
  } else if (simulation.state === "running") {
    await pauseSimulation();
  }
});

document.querySelectorAll(".timeline-step").forEach((button) => {
  button.addEventListener("click", () => playFromTime(Number(button.dataset.time)));
});

timelineScrubber.addEventListener("input", () => {
  stopMusic();
  if (participants.length === 0) createParticipants(participantCount);
  simulation.state = Number(timelineScrubber.value) === finaleStartsAt ? "complete" : "paused";
  applySimulationTime(Number(timelineScrubber.value));
  soundStatus.textContent = "♫ Geser timeline, lalu tekan play untuk melanjutkan";
});

lightToggle.addEventListener("click", () => {
  venueLightsEnabled = !venueLightsEnabled;
  updateLighting();
  updateInterface();
});

showLightToggle.addEventListener("click", () => {
  showLightingEnabled = !showLightingEnabled;
  updateLighting();
  updateInterface();
});

const helpButton = document.querySelector("#toggle-help");
const helpPanel = document.querySelector("#help-panel");
helpButton.addEventListener("click", () => {
  const isExpanded = helpButton.getAttribute("aria-expanded") === "true";
  helpButton.setAttribute("aria-expanded", String(!isExpanded));
  helpPanel.hidden = isExpanded;
});

async function pauseSimulation() {
  simulation.state = "paused";
  audioTransition = true;
  updateInterface();
  stopMusic();
  if (audioContext?.state === "running") {
    try {
      await audioContext.suspend();
    } catch (error) {
      console.error("Audio simulasi tidak dapat dijeda:", error);
      soundStatus.textContent = "Audio masih berjalan; browser menolak jeda audio.";
    }
  }
  if (!audioContext || audioContext.state === "suspended") {
    soundStatus.textContent = simulation.phase === "dance" ? "♫ Musik dijeda" : "Simulasi dijeda";
  }
  audioTransition = false;
  updateInterface();
}

async function resumeSimulation() {
  simulation.state = "running";
  audioTransition = true;
  updateInterface();
  await startPhaseMusic(simulation.phase);
  audioTransition = false;
  updateInterface();
}

restartButton.addEventListener("click", async () => {
  stopMusic();
  createParticipants(participantCount);
  setCameraView("drone");
  await playFromTime(0);
});

document.querySelector("#reset-view").addEventListener("click", () => setCameraView("entrance"));

async function startSimulation() {
  const startAt = simulation.state === "idle" || simulation.state === "complete" ? 0 : simulation.elapsed;
  if (participants.length === 0) createParticipants(participantCount);
  if (startAt === 0) setCameraView("drone");
  simulation.state = "running";
  applySimulationTime(startAt);
  await startPhaseMusic(simulation.phase);
  updateInterface();
}

async function playFromTime(time) {
  const startAt = THREE.MathUtils.clamp(time, 0, finaleStartsAt);
  if (participants.length === 0) createParticipants(participantCount);
  simulation.state = startAt === finaleStartsAt ? "complete" : "running";
  applySimulationTime(startAt);
  if (startAt < finaleStartsAt) {
    setCameraView("drone");
    await startPhaseMusic(simulation.phase);
  } else {
    stopMusic();
    soundStatus.textContent = "Lampu venue menyala · spotlight mengarah ke MC";
  }
  updateInterface();
}

function applySimulationTime(time) {
  simulation.elapsed = THREE.MathUtils.clamp(time, 0, finaleStartsAt);
  simulation.phase = phaseAtTime(simulation.elapsed);
  showLightingEnabled = simulation.phase === "lighting" || simulation.phase === "dance" || simulation.phase === "finale";
  if (simulation.phase === "finale") venueLightsEnabled = true;
  if (participants.length) updateParticipants(Math.min(simulation.elapsed, arrivalDuration));
  dancers.forEach((dancer) => {
    dancer.visible = simulation.phase === "dance";
  });
  mcs.forEach((mc) => {
    mc.visible = simulation.phase === "finale";
  });
  updateDancers(simulation.elapsed);
  updateLighting();
  updateInterface();
}

function phaseAtTime(time) {
  if (time < lightingStartsAt) return "arrival";
  if (time < danceStartsAt) return "lighting";
  if (time < finaleStartsAt) return "dance";
  return "finale";
}

async function startPhaseMusic(phase) {
  stopMusic();
  const audioFile = phaseAudioFiles[phase];
  if (audioFile) {
    const fileName = audioFile.split("/").pop();
    const audio = new Audio(audioFile);
    phaseAudio = audio;
    audio.loop = true;
    audio.volume = 0.8;
    audio.addEventListener("error", () => {
      if (phaseAudio !== audio) return;
      console.error(`File audio simulasi tidak dapat dimuat: ${audioFile}`, audio.error);
      soundStatus.textContent = `Audio belum tersedia: ${fileName}`;
      updateInterface();
    });
    audioTransition = true;
    updateInterface();
    try {
      await audio.play();
      soundStatus.textContent = `♫ ${fileName} aktif`;
    } catch (error) {
      if (!audio.error) console.error(`Audio simulasi tidak dapat diputar: ${audioFile}`, error);
      soundStatus.textContent = `Audio belum tersedia: ${fileName}`;
    } finally {
      audioTransition = false;
      updateInterface();
    }
    return;
  }

  const modes = { dance: "dance" };
  const mode = modes[phase];
  if (!mode) {
    soundStatus.textContent = phase === "finale"
      ? "♫ Lampu venue menyala · MC di panggung"
      : "Audio belum ditambahkan";
    return;
  }
  const labels = {
    dance: "♫ Musik dancer aktif",
  };
  audioTransition = true;
  updateInterface();
  try {
    await startMusic(mode);
    soundStatus.textContent = labels[mode];
  } catch (error) {
    console.error("Musik simulasi tidak dapat dimulai:", error);
    soundStatus.textContent = "Audio tidak tersedia. Coba browser dengan dukungan Web Audio.";
  } finally {
    audioTransition = false;
    updateInterface();
  }
}

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Browser ini tidak mendukung Web Audio.");
  if (audioContext) return;
  audioContext = new AudioContextClass();
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = 0.28;
  audioMaster.connect(audioContext.destination);
}

async function startMusic(mode) {
  createAudioContext();
  if (audioInterval) window.clearInterval(audioInterval);
  if (audioContext.state === "suspended") await audioContext.resume();
  audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
  audioMaster.gain.setTargetAtTime(0.28, audioContext.currentTime, 0.12);
  audioStep = 0;
  audioInterval = window.setInterval(() => scheduleMusicStep(mode), mode === "march" ? 180 : 135);
  scheduleMusicStep(mode);
}

function scheduleMusicStep(mode) {
  if (!audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime + 0.025;
  const marchNotes = [67, 72, 76, 79, 84, 79, 76, 72, 74, 79, 83, 86, 91, 86, 83, 79];
  const eventNotes = [72, 79, 84, 88, 84, 91, 88, 84, 74, 81, 86, 89, 86, 93, 89, 86];
  const danceNotes = [72, 76, 79, 84, 79, 84, 88, 84, 74, 77, 81, 86, 81, 86, 89, 86];
  const notes = mode === "dance" ? danceNotes : mode === "event" ? eventNotes : marchNotes;
  const note = notes[audioStep % notes.length];
  const waveform = mode === "march" ? "sawtooth" : "triangle";
  scheduleTone(note, now, mode === "march" ? 0.19 : 0.24, waveform, mode === "event" ? 0.08 : 0.07);
  if (audioStep % 4 === 0) {
    scheduleTone(mode === "dance" ? 48 : mode === "event" ? 45 : 43, now, 0.3, "triangle", mode === "march" ? 0.045 : 0.08);
    scheduleKick(now, mode === "march" ? 0.045 : 0.075);
    if (mode === "march") scheduleTone(note + 7, now, 0.28, "triangle", 0.035);
  }
  audioStep += 1;
}

function scheduleTone(note, startAt, duration, waveform, volume) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  oscillator.type = waveform;
  oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
  filter.type = "lowpass";
  filter.frequency.value = waveform === "sawtooth" ? 1250 : 2100;
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(filter);
  filter.connect(envelope);
  envelope.connect(audioMaster);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

function scheduleKick(startAt, volume) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(130, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(48, startAt + 0.13);
  envelope.gain.setValueAtTime(volume, startAt);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.15);
  oscillator.connect(envelope);
  envelope.connect(audioMaster);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.17);
}

function stopMusic() {
  if (audioInterval) {
    window.clearInterval(audioInterval);
    audioInterval = undefined;
  }
  if (audioContext && audioMaster) {
    audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
    audioMaster.gain.setTargetAtTime(0, audioContext.currentTime, 0.04);
  }
  if (phaseAudio) {
    phaseAudio.pause();
    phaseAudio.currentTime = 0;
    phaseAudio = undefined;
  }
}

function updateSimulation(delta) {
  if (simulation.state !== "running") return;
  simulation.elapsed += delta;
  const nextPhase = phaseAtTime(simulation.elapsed);
  if (nextPhase !== simulation.phase) {
    simulation.phase = nextPhase;
    showLightingEnabled = nextPhase === "lighting" || nextPhase === "dance" || nextPhase === "finale";
    if (nextPhase === "finale") venueLightsEnabled = true;
    if (participants.length) updateParticipants(Math.min(simulation.elapsed, arrivalDuration));
    dancers.forEach((dancer) => {
      dancer.visible = nextPhase === "dance";
    });
    mcs.forEach((mc) => {
      mc.visible = nextPhase === "finale";
    });
    if (nextPhase === "finale") {
      stopMusic();
      soundStatus.textContent = "Lampu venue menyala · spotlight mengarah ke MC";
    } else {
      startPhaseMusic(nextPhase);
    }
  }

  if (simulation.elapsed < arrivalDuration && participants.length) updateParticipants(simulation.elapsed);
  if (simulation.elapsed >= finaleStartsAt) {
    simulation.elapsed = finaleStartsAt;
    simulation.state = "complete";
  }
  updateLighting();
  const interfaceFrame = Math.floor(simulation.elapsed * 5);
  if (interfaceFrame !== lastInterfaceFrame || simulation.state === "complete") {
    lastInterfaceFrame = interfaceFrame;
    updateInterface();
  }
}

function updateParticipants(elapsed) {
  participants.forEach((person, index) => {
    const localTime = elapsed - person.startAt;
    const visible = localTime >= 0;
    const progress = visible ? THREE.MathUtils.clamp(localTime / person.walkDuration, 0, 1) : 0;
    const eased = progress * progress * (3 - 2 * progress);
    const routeDistance = eased * person.routeLengths[person.routeLengths.length - 1];
    let segment = 1;
    while (segment < person.routeLengths.length - 1 && routeDistance > person.routeLengths[segment]) segment += 1;
    const segmentStart = person.routeLengths[segment - 1];
    const segmentLength = person.routeLengths[segment] - segmentStart;
    const segmentProgress = segmentLength ? THREE.MathUtils.clamp((routeDistance - segmentStart) / segmentLength, 0, 1) : 1;
    const x = visible ? THREE.MathUtils.lerp(person.route[segment - 1].x, person.route[segment].x, segmentProgress) : 0;
    const z = visible ? THREE.MathUtils.lerp(person.route[segment - 1].z, person.route[segment].z, segmentProgress) : 0;
    const bob = visible && progress < 1 ? Math.abs(Math.sin(elapsed * 8 + index)) * 0.055 : 0;
    const rotationY = visible && progress < 1
      ? faceCenter(x, z, person.route[segment].x, person.route[segment].z)
      : person.rotationY;

    participantMeshes.forEach((mesh) => {
        const { kind, position, basePosition } = mesh.userData.part;
        position.copy(basePosition);
        let rotationX = 0;
        let rotationZ = 0;
        if (kind === "body") position.y = THREE.MathUtils.lerp(0.72, 0.57, eased);
        if (kind === "head") position.y = THREE.MathUtils.lerp(1.16, 1.0, eased);
        if (kind === "leftArm") rotationZ = progress < 1 ? Math.sin(elapsed * 8 + index) * 0.18 : 0;
        if (kind === "rightArm") rotationZ = progress < 1 ? Math.sin(elapsed * 8 + index + Math.PI) * 0.18 : 0;
        if (kind === "leftLeg" || kind === "rightLeg") {
        if (progress < 1) {
          rotationX = Math.sin(elapsed * 8 + index + (kind === "leftLeg" ? 0 : Math.PI)) * 0.35;
        } else {
          position.y = 0.15;
          position.z = -0.22;
          rotationX = Math.PI / 2;
        }
      }
      if (kind === "leftShoe" || kind === "rightShoe") {
        if (progress >= 1) position.z = -0.48;
      }
      instanceScale.setScalar(visible ? 1.4 : 0);
      instanceGroupPosition.set(x, bob, z);
      composeInstance(mesh, index, instanceGroupPosition, rotationY, position, rotationX, rotationZ, instanceScale);
    });
  });
  participantMeshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
  });
}

function composeInstance(mesh, index, basePosition, rotationY, localPosition, rotationX, rotationZ, localScale) {
  const baseQuaternion = instanceRotation.setFromAxisAngle(participantUp, rotationY);
  instanceBasePosition.copy(basePosition);
  instancePosition.copy(localPosition).applyQuaternion(baseQuaternion).add(instanceBasePosition);
  instanceLocalEuler.set(rotationX, 0, rotationZ);
  instanceLocalRotation.setFromEuler(instanceLocalEuler);
  instanceScale.copy(localScale);
  instanceWorldRotation.copy(baseQuaternion).multiply(instanceLocalRotation);
  instanceMatrix.compose(instancePosition, instanceWorldRotation, instanceScale);
  mesh.setMatrixAt(index, instanceMatrix);
}

function updateLighting() {
  if (!ambientLight || !hemisphereLight || !keyLight) return;
  let roomLevel = 1;
  let showLevel = 0;
  if (simulation.phase === "lighting") {
    roomLevel = 0.08;
    showLevel = 1;
  } else if (simulation.phase === "dance") {
    roomLevel = 0.055;
    showLevel = 1;
  } else if (simulation.phase === "finale") {
    showLevel = 1;
  }
  if (simulation.phase === "arrival" && showLightingEnabled) showLevel = 0.65;
  if (!showLightingEnabled) showLevel = 0;

  const venueLevel = venueLightsEnabled ? roomLevel : 0;
  ambientLight.intensity = 0.55 * venueLevel;
  hemisphereLight.intensity = 2.05 * venueLevel;
  keyLight.intensity = 3.1 * venueLevel;
  stageGlow.intensity = simulation.phase === "finale" ? 18 : 2 + showLevel * 4;
  if (participantShirtMaterial) participantShirtMaterial.emissiveIntensity = showLevel * 0.48;
  showLights.forEach((light, index) => {
    const time = simulation.elapsed;
    const sweep = simulation.phase === "lighting" || (simulation.phase === "arrival" && showLightingEnabled);
    const targetX = simulation.phase === "finale"
      ? 0
      : sweep ? Math.sin(time * 1.35 + index * Math.PI / 2) * 9.5 : Math.sin(time * 0.65 + index * 1.4) * 1.1;
    const targetZ = simulation.phase === "finale"
      ? -20.1
      : sweep ? Math.sin(time * 0.92 + index * Math.PI / 1.7) * 15 : Math.cos(time * 0.55 + index * 1.4) * 1.1;
    const targetY = sweep
      ? 0.15 + Math.sin(time * 2 + index) * 0.35
      : simulation.phase === "finale" ? 1.2 : 0.1;
    showLightTargets[index].position.set(targetX, targetY, targetZ);
    light.intensity = showLevel * (index === 0 ? 105 : 70) * (0.82 + Math.sin(time * (sweep ? 3.5 : 2.3) + index) * 0.18);
    showHeads[index].material.emissiveIntensity = showLightingEnabled ? 2.5 : 0;
    showHeads[index].rotation.set(Math.sin(time * 1.4 + index) * 0.25, 0, Math.cos(time * 1.7 + index) * 0.35);

    beamDirection.subVectors(showLightTargets[index].position, showBeamSources[index]);
    const beamLength = beamDirection.length();
    beamMidpoint.copy(showBeamSources[index]).add(showLightTargets[index].position).multiplyScalar(0.5);
    showBeams[index].position.copy(beamMidpoint);
    showBeams[index].quaternion.setFromUnitVectors(participantUp, beamDirection.normalize());
    showBeams[index].scale.y = beamLength / 18;
  });
  showBeams.forEach((beam) => {
    beam.material.opacity = showLevel * 0.13;
  });
  lightSpeckles.forEach((speckle, index) => {
    const angle = index * 2.399 + simulation.elapsed * (simulation.phase === "lighting" ? 1.35 : 0.25);
    const radius = 0.35 + (index % 11) * 0.36;
    speckle.position.x = simulation.phase === "lighting" ? Math.cos(angle) * radius * 2.1 : Math.cos(angle) * radius;
    speckle.position.z = simulation.phase === "lighting" ? Math.sin(angle * 0.72) * radius * 3 : Math.sin(angle) * radius;
    speckle.material.opacity = showLevel * (0.32 + Math.sin(simulation.elapsed * 4 + index) * 0.2);
  });
}

function updateDancers(time) {
  dancers.forEach((dancer) => {
    const offset = dancer.userData.danceOffset;
    dancer.userData.body.rotation.z = Math.sin(time * 4 + offset) * 0.12;
    dancer.userData.arms[0].rotation.z = -0.5 + Math.sin(time * 5 + offset) * 0.68;
    dancer.userData.arms[1].rotation.z = 0.5 + Math.sin(time * 5 + offset + Math.PI) * 0.68;
    dancer.position.y = Math.abs(Math.sin(time * 4 + offset)) * 0.1;
  });
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function updateInterface() {
  const elapsed = simulation.elapsed;
  const totalDuration = finaleStartsAt;
  const isRunning = simulation.state === "running";
  const isPaused = simulation.state === "paused";
  const isIdle = simulation.state === "idle";
  const isComplete = simulation.state === "complete";
  playButton.querySelector("span:last-child").textContent = isPaused ? "LANJUTKAN" : isComplete ? "PUTAR ULANG" : isRunning ? "SIMULASI BERJALAN" : "MULAI SIMULASI";
  playButton.disabled = isRunning;
  pauseButton.disabled = isIdle || isComplete || audioTransition;
  pauseButton.innerHTML = isPaused ? "<span aria-hidden=\"true\">▶</span> LANJUTKAN" : "<span aria-hidden=\"true\">Ⅱ</span> JEDA";
  restartButton.disabled = isIdle;
  durationLabel.textContent = formatTime(totalDuration);
  phaseTime.textContent = formatTime(elapsed);
  timelineScrubber.value = String(Math.floor(elapsed));
  lightToggle.setAttribute("aria-pressed", String(venueLightsEnabled));
  lightToggle.setAttribute("aria-label", venueLightsEnabled ? "Matikan lampu venue" : "Nyalakan lampu venue");
  lightToggle.title = venueLightsEnabled ? "Matikan lampu venue" : "Nyalakan lampu venue";
  showLightToggle.setAttribute("aria-pressed", String(showLightingEnabled));
  showLightToggle.setAttribute("aria-label", showLightingEnabled ? "Matikan lighting show" : "Nyalakan lighting show");
  showLightToggle.title = showLightingEnabled ? "Matikan lighting show" : "Nyalakan lighting show";

  const phase = simulation.phase;
  const descriptions = {
    arrival: "Peserta masuk dua baris dari sisi selatan",
    lighting: "Lighting show · 02:00",
    dance: "Dancer spotlight · 01:00",
    finale: "Lampu menyala · MC di panggung",
  };
  phaseDescription.textContent = descriptions[phase] ?? descriptions.arrival;
  const steps = [
    document.querySelector("#step-arrival"),
    document.querySelector("#step-lighting"),
    document.querySelector("#step-dance"),
    document.querySelector("#step-mc"),
  ];
  const activeStep = { arrival: 0, lighting: 1, dance: 2, finale: 3 }[phase] ?? 0;
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === activeStep);
    step.classList.toggle("done", index < activeStep);
  });
}

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
  const now = performance.now() / 1000;
  const delta = lastFrameTime ? Math.min(now - lastFrameTime, 0.05) : 0;
  lastFrameTime = now;
  updateSimulation(delta);
  if (simulation.state === "running") updateDancers(simulation.elapsed);
  controls.update();
  renderer.render(scene, camera);
}
