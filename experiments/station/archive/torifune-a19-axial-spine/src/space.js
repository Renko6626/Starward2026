import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createStars() {
  const random = randomGenerator(20261005);
  const positions = [], colors = [], sizes = [];
  for (let i = 0; i < 3600; i++) {
    const z = random() * 2 - 1, phi = random() * Math.PI * 2;
    const radial = Math.sqrt(1 - z * z), distance = 550 + random() * 350;
    positions.push(radial * Math.cos(phi) * distance, radial * Math.sin(phi) * distance, z * distance);
    const brightness = .13 + Math.pow(random(), 3) * .85;
    const warm = random() > .78;
    colors.push(brightness * (warm ? 1 : .79), brightness * .88, brightness * (warm ? .73 : 1));
    sizes.push(random() > .985 ? 2.5 : .65 + random() * 1.05);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: Math.min(devicePixelRatio, 1.75) } },
    vertexShader: `
      attribute vec3 color;
      attribute float size;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - .5);
        float alpha = 1.0 - smoothstep(.1, .5, r);
        gl_FragColor = vec4(vColor, alpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(geometry, material);
  stars.add(createGalacticBand(), createBrightStars(random));
  return stars;
}

function createGalacticBand() {
  const width = 1024, height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  const field = new ImprovedNoise();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = x / width * Math.PI * 2;
    const a = Math.cos(longitude), b = Math.sin(longitude);
    const latitude = (y / height - .5) * Math.PI;
    const n = field.noise(a * 5, b * 5, latitude * 13 + 7);
    const detail = field.noise(a * 19, b * 19, latitude * 49 + 13);
    const center = Math.sin(longitude * 2) * .04;
    const band = Math.exp(-(((latitude - center) / .135) ** 2));
    const halo = Math.exp(-(((latitude - center) / .27) ** 2));
    const dust = Math.exp(-(((latitude - center + n * .035) / .024) ** 2));
    const brightness = Math.max(0, (band * (.63 + n * .48 + detail * .15) + halo * .14) * (1 - dust * .65));
    const index = (y * width + x) * 4;
    pixels.data[index] = brightness * 36;
    pixels.data[index + 1] = brightness * 41;
    pixels.data[index + 2] = brightness * 51;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 48, 24), new THREE.MeshBasicMaterial({
    map, side: THREE.BackSide, depthWrite: false, depthTest: false,
  }));
  sky.name = 'Galactic dust band'; sky.renderOrder = -10;
  sky.rotation.set(.42, -.35, -.48);
  return sky;
}

function createBrightStars(random) {
  const positions = [], sizes = [], phases = [];
  for (let i = 0; i < 30; i++) {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - z * z), distance = 700 + random() * 350;
    positions.push(Math.cos(angle) * radius * distance, Math.sin(angle) * radius * distance, z * distance);
    sizes.push(7 + random() * 10); phases.push(random() * Math.PI * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: Math.min(devicePixelRatio, 1.75) } },
    vertexShader: `
      attribute float size;
      attribute float phase;
      uniform float pixelRatio;
      varying float vPhase;
      void main() {
        vPhase = phase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
      }`,
    fragmentShader: `
      uniform float time;
      varying float vPhase;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float r = length(p);
        float core = exp(-r * r * 230.0);
        float glow = exp(-r * r * 30.0) * .13;
        float cross = (exp(-abs(p.x)*170.0) + exp(-abs(p.y)*170.0)) * exp(-r*12.0) * .22;
        float intensity = (core+glow+cross) * (.95+.05*sin(time*.4+vPhase));
        gl_FragColor = vec4(vec3(.72,.83,1.0), intensity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(geometry, material); stars.name = 'Bright star optics';
  return stars;
}

const noise = `
  float hash(vec3 p) {
    p = fract(p * .3183099 + vec3(.1, .2, .3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float value = 0.0, amplitude = .5;
    for (int i=0; i<5; i++) {
      value += amplitude * noise3(p);
      p = p * 2.03 + vec3(3.1, 1.7, 5.2);
      amplitude *= .5;
    }
    return value;
  }
`;

// Procedural celestial backdrop, deliberately illustrative rather than a
// geographic Earth map or an orbital simulation. No remote textures required.
export function createPlanet() {
  const group = new THREE.Group();
  const lightDirection = new THREE.Vector3(.3, .5, .8).normalize();
  const vertexShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vPosition = position;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const surface = new THREE.ShaderMaterial({
    uniforms: { sun: { value: lightDirection } },
    vertexShader,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vWorld;
      ${noise}
      void main() {
        vec3 p = normalize(vPosition);
        vec3 n = normalize(vNormal);
        vec3 eye = normalize(cameraPosition - vWorld);
        float terrain = fbm(p * 3.8 + vec3(5.0, 2.0, 8.0));
        float land = smoothstep(.48, .53, terrain);
        vec3 ocean = vec3(.023, .068, .115);
        vec3 continent = mix(vec3(.095, .135, .115), vec3(.24, .25, .18), smoothstep(.53, .7, terrain));
        vec3 ground = mix(ocean, continent, land);
        float pole = smoothstep(.84, .98, abs(p.y) + (terrain-.5)*.2);
        ground = mix(ground, vec3(.65,.73,.75), pole);
        vec3 curl = p * 10.0 + vec3(sin(p.y * 11.0)*.8, 0.0, cos(p.x * 9.0)*.6);
        float cloud = smoothstep(.49, .67, fbm(curl));
        float wisps = smoothstep(.55, .74, fbm(p * 27.0));
        cloud = clamp(cloud + wisps * .2, 0.0, .88);
        ground = mix(ground, vec3(.68,.74,.78), cloud);
        float daylight = smoothstep(-.08, .25, dot(n, sun));
        float lambert = max(0.0, dot(n, sun));
        vec3 color = ground * (.015 + daylight * (.24 + lambert * .86));
        float edge = pow(1.0 - max(0.0, dot(n,eye)), 4.0);
        color += vec3(.065,.19,.31) * edge * daylight;
        color = mix(vec3(dot(color, vec3(.2126,.7152,.0722))), color, .78);
        gl_FragColor = vec4(color * .64, 1.0);
      }`,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 48), surface);
  group.add(sphere);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.018, 80, 48), new THREE.ShaderMaterial({
    uniforms: { sun: { value: lightDirection } },
    vertexShader,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 eye = normalize(cameraPosition-vWorld);
        float rim = pow(1.0-abs(dot(n,eye)), 4.8);
        float day = smoothstep(-.25,.6,dot(n,sun));
        gl_FragColor = vec4(vec3(.14,.34,.52) * rim * day, rim * .35);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  group.add(atmosphere);
  group.position.set(-224, -47, -120);
  group.scale.setScalar(49);
  return group;
}

export function createMoon() {
  const material = new THREE.ShaderMaterial({
    uniforms: { sun: { value: new THREE.Vector3(-.8, .45, .35).normalize() } },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vNormal;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 vLocal;
      varying vec3 vNormal;
      ${noise}
      void main() {
        vec3 p = normalize(vLocal);
        float geology = fbm(p * 5.0 + vec3(11.0, 4.0, 3.0));
        float maria = smoothstep(.44,.61,geology);
        vec3 color = mix(vec3(.26,.27,.28),vec3(.48,.47,.44),maria);
        color *= .84 + noise3(p * 95.0) * .24;
        for (int i=0; i<22; i++) {
          float f = float(i) + 1.0;
          vec3 center = normalize(vec3(sin(f*12.78),cos(f*31.43),sin(f*7.91)));
          float radius = .025 + fract(sin(f*42.17)*138.45) * .09;
          float d = length(p-center) / radius;
          float bowl = 1.0-smoothstep(.45,.9,d);
          float lip = smoothstep(.82,.96,d)*(1.0-smoothstep(1.02,1.2,d));
          color *= 1.0-bowl*.32;
          color += lip*.055;
        }
        float light = max(0.0,dot(normalize(vNormal),sun));
        color *= .025 + light * .86;
        gl_FragColor = vec4(color,1.0);
      }`,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1,48,32),material);
  moon.position.set(-18, -14, -310);
  moon.scale.setScalar(9);
  return moon;
}
