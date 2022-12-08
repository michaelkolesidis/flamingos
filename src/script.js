import "./style.css";
import * as THREE from "three";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import OrbitControls from "./js/controls/OrbitControls";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import GLTFLoader from "./js/loaders/GLTFLoader";
import EffectComposer from "./js/postprocessing/EffectComposer";
import MaskPass from "./js/postprocessing/MaskPass";
import RenderPass from "./js/postprocessing/RenderPass";
import ShaderPass from "./js/postprocessing/ShaderPass";
import SSAOPass from "./js/postprocessing/SSAOPass";
import CopyShader from "./js/shaders/CopyShader";
import SSAOShader from "./js/shaders/SSAOShader";

const canvas = document.querySelector("#c");
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();

const aspect = 2; // the canvas default
const fov = 35;
const near = 0.1;
const far = 5000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(-580, 55, 390);

const maxFovX = 40;
const numBirds = 40;
const minMax = 700;
const birdSpeed = 100;
const useFog = true;
const useOrbitCamera = true;
const showHelpers = false;

if (useOrbitCamera) {
  const controls = new OrbitControls(camera);
  controls.target.set(0, 0, 0);
  controls.update();
}

renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
hemiLight.color.setHSL(0.6, 1, 0.5);
hemiLight.groundColor.setHSL(0.095, 1, 0.5);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

if (showHelpers) {
  const hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
  scene.add(hemiLightHelper);
}

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.color.setHSL(0.1, 1, 0.95);
dirLight.position.set(-300, 220, 245);
scene.add(dirLight);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
const d = 350;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.camera.near = 100;
dirLight.shadow.camera.far = 950;
dirLight.shadow.bias = -0.005;

if (showHelpers) {
  const dirLightHeper = new THREE.DirectionalLightHelper(dirLight, 10);
  scene.add(dirLightHeper);
}

const birds = [];

const loader = new GLTFLoader();

const fogNear = 1350;
const fogFar = 1500;

function rand(min, max) {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
}

loader.load("/models/Flamingo/Flamingo.glb", (gltf) => {
  const orig = gltf.scene.children[0];
  orig.castShadow = true;
  orig.receiveShadow = true;

  for (let i = 0; i < numBirds; ++i) {
    const u = i / (numBirds - 1);
    const mesh = orig.clone();
    mesh.position.set(
      rand(-150, 150),
      (u * 2 - 1) * 200,
      ((minMax * 2 * i * 1.7) % (minMax * 2)) - minMax / 2
    );
    scene.add(mesh);
    mesh.material = mesh.material.clone();
    mesh.material.color.setHSL(rand(), 1, 0.8);

    const mixer = new THREE.AnimationMixer(mesh);
    mixer.clipAction(gltf.animations[0]).setDuration(1).play();
    mixer.update(rand(10));
    mixer.timeScale = rand(0.9, 1.1);
    birds.push({
      mixer,
      mesh,
    });
  }
});


window.s = scene;

if (useFog) {
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `;

  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize( vWorldPosition + offset ).y;
      gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
    }
    `;

  const uniforms = {
    topColor: { value: new THREE.Color(0x88aabb) },
    bottomColor: { value: new THREE.Color(0xefcb7f) },
    offset: { value: 730 },
    exponent: { value: 0.3 },
  };
  uniforms.topColor.value.copy(hemiLight.color);
  scene.fog = new THREE.Fog(scene.background, fogNear, fogFar);
  scene.fog.color.copy(uniforms.bottomColor.value);
  const skyGeo = new THREE.SphereBufferGeometry(3000, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === canvas.width && height === canvas.height) {
    return false;
  }

  renderer.setSize(width, height, false);
  return true;
}

let then = 0;
function render(now) {
  now *= 0.001;
  const deltaTime = now - then;
  then = now;

  if (resizeRendererToDisplaySize(renderer)) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fovX = THREE.Math.radToDeg(
      2 * Math.atan(Math.tan(THREE.Math.degToRad(fov) * 0.5) * aspect)
    );
    const newFovY = THREE.Math.radToDeg(
      2 * Math.atan(Math.tan(THREE.Math.degToRad(maxFovX) * 0.5) / aspect)
    );
    camera.fov = fovX > maxFovX ? newFovY : fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  for (const { mesh, mixer } of birds) {
    mixer.update(deltaTime);
    mesh.position.z =
      ((mesh.position.z + minMax + mixer.timeScale * birdSpeed * deltaTime) %
        (minMax * 2)) -
      minMax;
  }

  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);