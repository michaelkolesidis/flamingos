import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "dat.gui";

// originals
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { MaskPass } from "three/addons/postprocessing/MaskPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { SSAOShader } from "three/examples/jsm/shaders/SSAOShader";

// extra
// import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';

/**
 * Base
 */
// Debug
const gui = new dat.GUI({ closed: true, width: 400 });
gui.hide();
dat.GUI.toggleHide();

const parameters = {
  birdSpeed: 100,
};

let birdFolder = gui.addFolder("Birds");
birdFolder.add(parameters, "birdSpeed", -200, 2000);

// Canvas
const canvas = document.querySelector("#webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});

renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Resizing and Fullscreen
 */
// Resizing
window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  aspect = sizes.width / sizes.height;

  // Update camera
  const fovX = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) * 0.5) * aspect)
  );
  const newFovY = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(maxFovX) * 0.5) / aspect)
  );
  camera.fov = fovX > maxFovX ? newFovY : fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Fullscreen
window.addEventListener("dblclick", () => {
  const fullscreenElement =
    document.fullscreenElement || document.webkitFullscreenElement;

  if (!fullscreenElement) {
    if (canvas.requestFullscreen) {
      canvas.requestFullscreen();
    } else if (canvas.webkitRequestFullscreen) {
      canvas.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
});

/**
 * Camera
 */
// Base camera
let aspect = sizes.width / sizes.height;
const fov = 35;
const near = 0.1;
const far = 5000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(-580, 55, 390);

const maxFovX = 40;
const numBirds = 40;
const minMax = 700;
const useFog = true;
const showHelpers = false;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

/**
 * Lights
 */
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
hemiLight.color.setHSL(0.6, 1, 0.5);
hemiLight.groundColor.setHSL(0.095, 1, 0.5);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

// helpers
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

/**
 * Models
 */
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

/**
 * Environment (Shaders)
 */
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
  const skyGeo = new THREE.SphereGeometry(3000, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}


/**
 * Postprocessing
 */
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );

// const glitchPass = new GlitchPass();  // working
// composer.addPass( glitchPass );

// const shaderPass = new ShaderPass();
// composer.addPass( shaderPass );

// const ssaoPass = new SSAOPass();
// composer.addPass( ssaoPass );

// const maskPass = new MaskPass();
// composer.addPass( maskPass );

const effectSSAO = new ShaderPass(THREE.SSAOShader);
composer.addPass( effectSSAO );

/**
 * Animate
 */
let then = 0;

function animate(now) {
  now *= 0.001;
  const deltaTime = now - then;
  then = now;

  for (const { mesh, mixer } of birds) {
    mixer.update(deltaTime);
    mesh.position.z =
      ((mesh.position.z +
        minMax +
        mixer.timeScale * parameters.birdSpeed * deltaTime) %
        (minMax * 2)) -
      minMax;
  }

  composer.render(scene, camera);

  requestAnimationFrame(animate);
}

animate();
