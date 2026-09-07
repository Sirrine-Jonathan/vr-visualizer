// ==========================================
// A-FRAME COMPONENTS
// ==========================================

AFRAME.registerComponent('ui-distance', {
  init: function () {
    this.el.addEventListener('thumbstickmoved', (e) => {
      if (isUiVisible) {
        const y = e.detail.y;
        if (Math.abs(y) > 0.1) {
          const container = document.getElementById('vr-cockpit-container');
          const pos = container.getAttribute('position');
          pos.z += y * 0.05;
          pos.z = Math.max(-4.0, Math.min(-0.8, pos.z));
          container.setAttribute('position', pos);
        }
      }
    });
  },
});

AFRAME.registerComponent('raging-sea', {
  init: function () {
    // High resolution plane geometry for realistic ocean surface waves
    const geometry = new THREE.PlaneGeometry(350, 350, 120, 120);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x001a33,
      emissive: 0x003366,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      fog: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Cresting foam particle overlay on wave peaks
    const foamCount = 1500;
    const foamGeo = new THREE.BufferGeometry();
    const foamPos = new Float32Array(foamCount * 3);
    for (let i = 0; i < foamCount; i++) {
      foamPos[i * 3] = (Math.random() - 0.5) * 300;
      foamPos[i * 3 + 1] = 0;
      foamPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3));
    const foamMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    this.foamMesh = new THREE.Points(foamGeo, foamMat);

    // Dynamic water reflection light beam
    this.spotLight = new THREE.SpotLight(0x00ffff, 2.0, 400, Math.PI / 6, 0.5, 1);
    this.spotLight.position.set(0, 50, 0);

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.foamMesh);
    this.group.add(this.spotLight);
    this.group.position.set(0, -3, 0);
    this.el.setObject3D('mesh', this.group);

    // Store base positions
    const posAttr = geometry.attributes.position;
    this.basePositions = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      this.basePositions[i * 3] = posAttr.getX(i);
      this.basePositions[i * 3 + 1] = posAttr.getY(i);
      this.basePositions[i * 3 + 2] = posAttr.getZ(i);
    }
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const { beatPulse, loudness, pitch } = window.getCurrentData
      ? window.getCurrentData()
      : { beatPulse: 0, loudness: 0, pitch: 0 };

    // Decreased overall wave intensity for smoother, more elegant seas
    const waveHeightMult = 1.2 + loudness * 3.5 + beatPulse * 2.5;
    const positions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const bx = this.basePositions[i * 3];
      const bz = this.basePositions[i * 3 + 2];

      const swell1 = Math.sin(bx * 0.03 + this.time * 1.5) * Math.cos(bz * 0.03 + this.time * 1.2);
      const swell2 = Math.sin(bx * 0.07 - this.time * 2.0) * Math.sin(bz * 0.06 + this.time * 1.8) * 0.5;
      const chop = Math.cos(bx * 0.15 + bz * 0.15 + this.time * 3.0) * 0.25;

      const totalWave = (swell1 + swell2 + chop) * waveHeightMult;
      positions.setY(i, totalWave);
    }

    positions.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();

    // Update cresting foam particles on wave peaks
    const fPos = this.foamMesh.geometry.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const fx = fPos.getX(i);
      const fz = fPos.getZ(i);
      const waveVal = Math.sin(fx * 0.03 + this.time * 1.5) * Math.cos(fz * 0.03 + this.time * 1.2) * waveHeightMult;
      fPos.setY(i, waveVal + 0.3 + beatPulse * 1.2);
    }
    fPos.needsUpdate = true;
    this.foamMesh.material.opacity = 0.3 + loudness * 0.6;

    // Dynamic water reflection light beam sweeping across ocean
    this.spotLight.intensity = 1.0 + beatPulse * 4.0;
    this.spotLight.position.x = Math.sin(this.time * 0.5) * 100;
    this.spotLight.position.z = Math.cos(this.time * 0.5) * 100;

    // Dynamic wave emissive color
    const r = 0.05 + beatPulse * 0.2;
    const g = 0.15 + beatPulse * 0.4 + loudness * 0.3;
    const b = 0.4 + pitch * 0.3 + loudness * 0.3;
    this.mesh.material.emissive.setRGB(r, g, b);
  },
});

AFRAME.registerComponent('dynamic-cubes', {
  init: function () {
    this.count = 150;
    const geometry = new THREE.BoxGeometry(0.8, 8.0, 0.8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Set base color to white to allow vertex colors
      roughness: 0.2,
      metalness: 0.8,
      fog: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);

    this.dummy = new THREE.Object3D();
    this.basePositions = [];
    this.rotSpeeds = [];

    for (let i = 0; i < this.count; i++) {
      const initialAngle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 80;
      const y = (Math.random() - 0.5) * 200;
      // Clockwise (-1) or counter-clockwise (+1) orbit speed along track
      const dir = Math.random() < 0.5 ? 1 : -1;
      const orbitSpeed = dir * (0.0001 + Math.random() * 0.0004);

      this.basePositions.push({ radius, y, initialAngle, orbitSpeed });

      // Random rotation speeds
      this.rotSpeeds.push({
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.005,
        z: (Math.random() - 0.5) * 0.005,
        initialX: Math.random() * Math.PI * 2,
        initialY: Math.random() * Math.PI * 2,
        initialZ: Math.random() * Math.PI * 2,
      });

      const x = Math.cos(initialAngle) * radius;
      const z = Math.sin(initialAngle) * radius;
      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      const col = new THREE.Color();
      col.setHSL(Math.random(), 0.8, 0.5);
      this.mesh.setColorAt(i, col);
    }
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    const { beatPulse, loudness, pitch } = window.getCurrentData
      ? window.getCurrentData()
      : { beatPulse: 0, loudness: 0, pitch: 0 };

    // Emissive inner core lighting flaring up based on audio frequency bands
    if (this.mesh.material) {
      this.mesh.material.emissive.setHSL(pitch, 0.9, 0.15 + beatPulse * 0.6 + loudness * 0.25);
    }

    for (let i = 0; i < this.count; i++) {
      const bp = this.basePositions[i];
      const rs = this.rotSpeeds[i];

      const currentAngle = bp.initialAngle + time * bp.orbitSpeed;
      const x = Math.cos(currentAngle) * bp.radius;
      const z = Math.sin(currentAngle) * bp.radius;

      this.dummy.position.set(x, bp.y, z);
      this.dummy.rotation.x = rs.initialX + time * rs.x;
      this.dummy.rotation.y = rs.initialY + time * rs.y;
      this.dummy.rotation.z = rs.initialZ + time * rs.z;

      // Audio-reactive height scaling flaring on frequency bands
      const scaleY = 1.0 + beatPulse * 3.5 + loudness * 2.5;
      const scaleX = 1.0 + (i % 3 === 0 ? beatPulse * 2.0 : 0);
      const scaleZ = 1.0 + (i % 2 === 0 ? pitch * 2.0 : 0);
      this.dummy.scale.set(scaleX, scaleY, scaleZ);

      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  },
});

AFRAME.registerComponent('linked-particles', {
  init: function () {
    this.count1 = 200; // Layer 1 count
    this.count2 = 180; // Layer 2 count
    this.maxDistance = 15;

    this.velocities1 = [];
    this.velocities2 = [];

    // Helper to setup a particle layer
    const setupLayer = (count, size, pointColor, boxSize) => {
      const pGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const vels = [];

      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * boxSize;
        pos[i * 3 + 1] = (Math.random() - 0.5) * boxSize;
        pos[i * 3 + 2] = (Math.random() - 0.5) * boxSize;
        vels.push(
          new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1),
        );
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pMat = new THREE.PointsMaterial({
        color: pointColor,
        size: size,
        transparent: true,
        opacity: 0.8,
        fog: true,
      });
      const points = new THREE.Points(pGeo, pMat);

      const lGeo = new THREE.BufferGeometry();
      const linePos = new Float32Array(count * count * 3);
      const lineCol = new Float32Array(count * count * 3);
      lGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      lGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));

      const lMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        fog: true,
      });
      const lines = new THREE.LineSegments(lGeo, lMat);

      return { points, lines, vels, linePos, lineCol };
    };

    // Layer 1 (Magenta/Cyan spectrum)
    this.layer1 = setupLayer(this.count1, 0.3, 0xffffff, 80);
    // Layer 2 (Neon Yellow/Green spectrum)
    this.layer2 = setupLayer(this.count2, 0.4, 0xffee55, 110);

    this.group = new THREE.Group();
    this.group.add(this.layer1.points);
    this.group.add(this.layer1.lines);
    this.group.add(this.layer2.points);
    this.group.add(this.layer2.lines);
    this.el.setObject3D('mesh', this.group);
  },
  tick: function (time, timeDelta) {
    const { beatPulse, loudness, pitch } = window.getCurrentData
      ? window.getCurrentData()
      : { beatPulse: 0, loudness: 0, pitch: 0 };

    const speed = 1.0 + beatPulse * 2.0;
    const currentMaxDist = this.maxDistance + loudness * 5.0;

    const updateLayer = (layer, count, boxLimit, colorFn) => {
      const positions = layer.points.geometry.attributes.position.array;

      // Node cluster fusion mechanics: when pitch harmonics stabilize (~0.4-0.6 range), pull particles into cluster constellations
      const harmonicStability = 1.0 - Math.min(1.0, Math.abs(pitch - 0.5) * 2.0);
      const isHarmonic = harmonicStability > 0.4;

      for (let i = 0; i < count; i++) {
        if (isHarmonic && i % 8 === 0) {
          // Fusion pull toward neighbor node
          const neighborIdx = (i + 1) % count;
          const fx = (positions[neighborIdx * 3] - positions[i * 3]) * 0.02 * harmonicStability;
          const fy = (positions[neighborIdx * 3 + 1] - positions[i * 3 + 1]) * 0.02 * harmonicStability;
          const fz = (positions[neighborIdx * 3 + 2] - positions[i * 3 + 2]) * 0.02 * harmonicStability;
          positions[i * 3] += fx;
          positions[i * 3 + 1] += fy;
          positions[i * 3 + 2] += fz;
        }

        positions[i * 3] += layer.vels[i].x * speed;
        positions[i * 3 + 1] += layer.vels[i].y * speed;
        positions[i * 3 + 2] += layer.vels[i].z * speed;

        if (Math.abs(positions[i * 3]) > boxLimit) layer.vels[i].x *= -1;
        if (Math.abs(positions[i * 3 + 1]) > boxLimit) layer.vels[i].y *= -1;
        if (Math.abs(positions[i * 3 + 2]) > boxLimit) layer.vels[i].z *= -1;
      }

      let vPos = 0;
      let cPos = 0;
      let numConnected = 0;

      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < currentMaxDist) {
            const alpha = 1.0 - dist / currentMaxDist;

            layer.linePos[vPos++] = positions[i * 3];
            layer.linePos[vPos++] = positions[i * 3 + 1];
            layer.linePos[vPos++] = positions[i * 3 + 2];

            layer.linePos[vPos++] = positions[j * 3];
            layer.linePos[vPos++] = positions[j * 3 + 1];
            layer.linePos[vPos++] = positions[j * 3 + 2];

            const [r, g, b] = colorFn(alpha, pitch);

            layer.lineCol[cPos++] = r;
            layer.lineCol[cPos++] = g;
            layer.lineCol[cPos++] = b;

            layer.lineCol[cPos++] = r;
            layer.lineCol[cPos++] = g;
            layer.lineCol[cPos++] = b;

            numConnected++;
          }
        }
      }

      layer.lines.geometry.setDrawRange(0, numConnected * 2);
      layer.lines.geometry.attributes.position.needsUpdate = true;
      layer.lines.geometry.attributes.color.needsUpdate = true;
      layer.points.geometry.attributes.position.needsUpdate = true;
    };

    // Layer 1 color: Red/Blue pitch blend
    updateLayer(this.layer1, this.count1, 40, (alpha, p) => [p * alpha, 0.5 * alpha, (1.0 - p) * alpha]);

    // Layer 2 color: Gold/Green/Orange contrasting palette
    updateLayer(this.layer2, this.count2, 55, (alpha, p) => [
      (0.9 - p * 0.3) * alpha,
      (0.8 + p * 0.2) * alpha,
      0.1 * alpha,
    ]);

    this.group.rotation.y += 0.001;
  },
});

AFRAME.registerComponent('liquid-particles', {
  schema: { count: { type: 'int', default: 25000 }, size: { type: 'number', default: 4.0 } },
  init: function () {
    const geometry = new THREE.BufferGeometry();
    const count = this.data.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const size = 800; // Increased depth dramatically
    const halfSize = size / 2;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * size - halfSize;
      positions[i * 3 + 1] = Math.random() * size - halfSize;
      positions[i * 3 + 2] = Math.random() * size - halfSize;

      const colorType = Math.random();
      let c = new THREE.Color();
      if (colorType > 0.8) c.setHSL(0.5, 0.8, 0.8);
      else if (colorType > 0.4) c.setHSL(0.6, 0.8, 0.8);
      else c.setHSL(0.55, 1.0, 0.5);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: this.data.size,
      map: texture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
      fog: true, // Supports A-Frame fog natively
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.u_time = { value: 0 };
      shader.uniforms.u_bass = { value: 0 };
      shader.vertexShader = `
        uniform float u_time;
        uniform float u_bass;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `
        vec3 transformed = vec3(position);
        transformed.y += sin(transformed.x * 0.02 + u_time) * (20.0 + u_bass * 10.0);
        transformed.x += cos(transformed.z * 0.02 + u_time) * 15.0;
        `,
      );
      this.shader = shader;
    };

    this.mesh = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.mesh);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    if (this.shader) {
      this.shader.uniforms.u_time.value = this.time;
      this.shader.uniforms.u_bass.value = data.beatPulse;
    }
  },
});

// ==========================================
// GLOBALS & SETUP
// ==========================================
let accessToken = null;
let isHost = false;
let roomId = null;
const socket = io();

// Auto Join & Share Handlers
document.addEventListener('DOMContentLoaded', () => {
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyLink = document.getElementById('btn-copy-link');

  const fallbackCopy = (text, btn) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(ta);
    }
    const old = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(() => (btn.innerText = old), 2000);
  };

  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (roomId) {
        fallbackCopy(roomId, btnCopyCode);
      }
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (roomId) {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomId);
        fallbackCopy(url.toString(), btnCopyLink);
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const roomToJoin = params.get('room');
  if (roomToJoin) {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.add('hidden');
    const qjPanel = document.getElementById('quick-join-panel');
    if (qjPanel) qjPanel.classList.remove('hidden');

    document.getElementById('quick-join-btn').addEventListener('click', () => {
      document.getElementById('room-id-input').value = roomToJoin;
      document.getElementById('join-room-btn').click();
      setTimeout(() => document.getElementById('enter-vr-btn').click(), 200);
    });
    document.getElementById('quick-join-cancel').addEventListener('click', (e) => {
      e.preventDefault();
      if (qjPanel) qjPanel.classList.add('hidden');
      document.getElementById('step-1').classList.remove('hidden');
    });
  }
});

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const sourceStatus = document.getElementById('source-status');
const roomStatus = document.getElementById('room-status');
const vrTrackInfo = document.getElementById('vr-track-info');

// Parse Spotify Auth Hash
const hash = window.location.hash
  .substring(1)
  .split('&')
  .reduce((initial, item) => {
    if (item) {
      var parts = item.split('=');
      initial[parts[0]] = decodeURIComponent(parts[1]);
    }
    return initial;
  }, {});
window.location.hash = '';

if (hash.access_token) {
  accessToken = hash.access_token;
  sourceStatus.innerText = 'Spotify Authenticated';
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
}

// ==========================================
// LOCAL AUDIO SETUP (WEB AUDIO API)
// ==========================================
let audioContext;
let analyser;
let localSource;
let isLiveAudio = false;
let localAudioElement = new Audio();
localAudioElement.crossOrigin = 'anonymous';
const dataArray = new Uint8Array(128);

function setupWebAudio(src, title) {
  if (player) player.pause();
  localAudioElement.src = src;

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    localSource = audioContext.createMediaElementSource(localAudioElement);
    localSource.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  isLiveAudio = true;
  playbackState.paused = true;
  updatePlayBtnText(true); // Wait for play
  setTrackInfo(title);

  // Move to step 2
  sourceStatus.innerText = title;
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
}

document.getElementById('audio-upload').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    setupWebAudio(objectUrl, file.name);
  }
});

document.getElementById('yt-btn').addEventListener('click', () => {
  const url = document.getElementById('yt-input').value.trim();
  if (!url) return;
  const streamUrl = `/api/yt?url=${encodeURIComponent(url)}`;
  setupWebAudio(streamUrl, `YouTube Stream`);
  fetch(streamUrl, { method: 'HEAD' })
    .then((res) => {
      const title = res.headers.get('X-Track-Title');
      if (title) {
        sourceStatus.innerText = `YT: ${decodeURIComponent(title)}`;
        setTrackInfo(decodeURIComponent(title));
      }
    })
    .catch(() => {});
});

// ==========================================
// ROOM SETUP (STEP 2)
// ==========================================
document.getElementById('create-room-btn').addEventListener('click', () => {
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  isHost = true;
  socket.emit('join_room', roomId, true);
  finalizeLaunchSetup(`Room Created: ${roomId} (Host)`);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  roomId = document.getElementById('room-id-input').value.trim().toUpperCase();
  if (roomId) {
    isHost = false;
    socket.emit('join_room', roomId, false);
    finalizeLaunchSetup(`Joined Room: ${roomId}`);
  }
});

function finalizeLaunchSetup(statusText) {
  roomStatus.innerText = statusText;
  step2.classList.add('hidden');
  step3.classList.remove('hidden');

  if (accessToken && (window.spotifySdkReady || window.Spotify)) {
    initSpotifyPlayer();
  }
}

document.getElementById('enter-vr-btn').addEventListener('click', () => {
  document.getElementById('staging-area').style.display = 'none';
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  document.querySelector('a-scene').enterVR();

  if (!isHost) {
    const vizTab = document.getElementById('tab-btn-viz');
    const musTab = document.getElementById('tab-btn-music');
    const playBtn = document.getElementById('vr-play-btn');
    if (vizTab) vizTab.setAttribute('visible', 'false');
    if (musTab) musTab.setAttribute('visible', 'false');
    if (playBtn) playBtn.setAttribute('visible', 'false');
    if (playBtn) playBtn.classList.remove('clickable');
    if (vizTab) vizTab.classList.remove('clickable');
    if (musTab) musTab.classList.remove('clickable');
  }

  if (accessToken && isHost) {
    fetchTopTracks(); // Build VR Menu for Spotify host
  }
});

function setTrackInfo(text) {
  vrTrackInfo.setAttribute('value', text);
}

// ==========================================
// SPOTIFY PLAYER & VR COCKPIT
// ==========================================
let player;
let deviceId;
let currentTrackId = null;
let audioAnalysis = null;
let playbackState = { paused: true, position: 0, timestamp: 0 };

window.onSpotifyWebPlaybackSDKReady = () => {
  window.spotifySdkReady = true;
};

async function fetchAudioAnalysis(trackId) {
  try {
    const res = await fetch(`/api/analysis/${trackId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) audioAnalysis = await res.json();
  } catch (e) {}
}

function initSpotifyPlayer() {
  player = new Spotify.Player({
    name: 'VR Visualizer Room',
    getOAuthToken: (cb) => {
      cb(accessToken);
    },
    volume: 0.8,
  });
  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
  });
  player.addListener('player_state_changed', (state) => {
    if (!state) return;
    playbackState.paused = state.paused;
    updatePlayBtnText(state.paused);
    playbackState.position = state.position;
    playbackState.timestamp = performance.now();
    const track = state.track_window.current_track;
    if (track && track.id !== currentTrackId) {
      currentTrackId = track.id;
      setTrackInfo(`${track.name} - ${track.artists[0].name}`);
      fetchAudioAnalysis(track.id);
    }
    if (isHost) {
      socket.emit('host_playback_update', {
        uri: track.uri,
        position: state.position,
        paused: state.paused,
        timestamp: Date.now(),
      });
    }
  });
  player.connect();
}

socket.on('playback_update', async (hostState) => {
  if (isHost || !deviceId) return;
  const offset = Date.now() - hostState.timestamp;
  const targetPosition = hostState.position + (hostState.paused ? 0 : offset);
  const method = hostState.paused ? 'pause' : 'play';
  const body = hostState.paused ? {} : { uris: [hostState.uri], position_ms: targetPosition };

  await fetch('/api/play', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, device_id: deviceId }),
  }).catch(() => {});

  if (hostState.paused) {
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }

  playbackState.paused = hostState.paused;
  updatePlayBtnText(hostState.paused);
  playbackState.position = targetPosition;
  playbackState.timestamp = performance.now();
});

// 3D VR Play Button
function updatePlayBtnText(isPaused) {
  const vrPlayBtn = document.getElementById('vr-play-btn');
  if (vrPlayBtn && vrPlayBtn.querySelector('a-text')) {
    vrPlayBtn.querySelector('a-text').setAttribute('value', isPaused ? 'Play' : 'Pause');
  }
}
const vrPlayBtn = document.getElementById('vr-play-btn');
vrPlayBtn.addEventListener('mouseenter', () => vrPlayBtn.setAttribute('color', '#25DB25'));
vrPlayBtn.addEventListener('mouseleave', () => vrPlayBtn.setAttribute('color', '#1DB954'));
vrPlayBtn.addEventListener('mousedown', () => {
  if (isLiveAudio) {
    if (localAudioElement.paused) {
      localAudioElement.play();
      playbackState.paused = false;
      updatePlayBtnText(false);
    } else {
      localAudioElement.pause();
      playbackState.paused = true;
      updatePlayBtnText(true);
    }
  } else {
    if (player) player.togglePlay();
  }
});

// 3D VR Viz Toggles
document.querySelectorAll('.toggle-btn').forEach((btn) => {
  btn.addEventListener('mousedown', () => {
    const targetId = btn.getAttribute('data-viz');
    const targetEntity = document.getElementById(targetId);
    const isVisible = targetEntity.getAttribute('visible');

    if (isVisible) {
      targetEntity.setAttribute('visible', 'false');
      btn.setAttribute('color', '#222');
      if (btn.querySelector('a-text')) btn.querySelector('a-text').setAttribute('color', '#fff');
    } else {
      targetEntity.setAttribute('visible', 'true');
      btn.setAttribute('color', '#25DB25');
      if (btn.querySelector('a-text')) btn.querySelector('a-text').setAttribute('color', '#fff');
    }
  });
});

// UI Hide/Show Logic via Controllers
const vrCockpit = document.getElementById('vr-cockpit');
let isUiVisible = true;

function toggleCockpitUi() {
  isUiVisible = !isUiVisible;
  const vrCockpit = document.getElementById('vr-cockpit');
  const uiLight = document.getElementById('ui-light');
  if (uiLight) {
    uiLight.setAttribute('visible', isUiVisible ? 'true' : 'false');
  }
  if (isUiVisible) {
    vrCockpit.setAttribute('visible', 'true');
    vrCockpit.querySelectorAll('.was-clickable').forEach((el) => {
      el.classList.add('clickable');
      el.classList.remove('was-clickable');
    });
  } else {
    vrCockpit.setAttribute('visible', 'false');
    vrCockpit.classList.remove('clickable');
    vrCockpit.querySelectorAll('.clickable').forEach((el) => {
      el.classList.remove('clickable');
      el.classList.add('was-clickable');
    });
  }
}

document.querySelector('a-scene').addEventListener('loaded', () => {
  document.querySelectorAll('[laser-controls]').forEach((ctrl) => {
    ctrl.addEventListener('xbuttondown', toggleCockpitUi);
    ctrl.addEventListener('abuttondown', toggleCockpitUi);

    if (ctrl.getAttribute('laser-controls') === 'hand: right') {
      ctrl.addEventListener('thumbstickmoved', (e) => {
        if (isUiVisible) {
          const y = e.detail.y;
          if (Math.abs(y) > 0.1) {
            const container = document.getElementById('vr-cockpit-container');
            const pos = container.getAttribute('position');
            pos.z += y * 0.05;
            pos.z = Math.max(-4.0, Math.min(-0.8, pos.z));
            container.setAttribute('position', pos);
          }
        }
      });
    }
  });
});

// UI Tab Logic
const tabControls = document.getElementById('tab-btn-controls');
const tabViz = document.getElementById('tab-btn-viz');
const tabMusic = document.getElementById('tab-btn-music');
const contentControls = document.getElementById('tab-content-controls');
const contentViz = document.getElementById('tab-content-viz');
const contentMusic = document.getElementById('tab-content-music');

function switchTab(activeTab) {
  [tabControls, tabViz, tabMusic].forEach((t) => {
    if (t) {
      t.setAttribute('color', t === activeTab ? '#25DB25' : '#222');
      t.querySelector('a-text').setAttribute('color', '#fff');
    }
  });

  if (contentControls) contentControls.setAttribute('visible', activeTab === tabControls ? 'true' : 'false');
  if (contentViz) contentViz.setAttribute('visible', activeTab === tabViz ? 'true' : 'false');
  if (contentMusic) contentMusic.setAttribute('visible', activeTab === tabMusic ? 'true' : 'false');

  if (contentViz) {
    if (activeTab === tabViz) {
      contentViz.querySelectorAll('.toggle-btn').forEach((el) => el.classList.add('clickable'));
    } else {
      contentViz.querySelectorAll('.clickable').forEach((el) => el.classList.remove('clickable'));
    }
  }

  if (contentMusic) {
    if (activeTab === tabMusic) {
      contentMusic
        .querySelectorAll(
          '#vr-spotify-menu a-plane, #spotify-prev-btn, #spotify-next-btn, #btn-voice-search, #btn-liked-songs',
        )
        .forEach((el) => el.classList.add('clickable'));
    } else {
      contentMusic.querySelectorAll('.clickable').forEach((el) => el.classList.remove('clickable'));
    }
  }
}

if (tabControls) tabControls.addEventListener('mousedown', () => switchTab(tabControls));
if (tabViz) tabViz.addEventListener('mousedown', () => switchTab(tabViz));
if (tabMusic) tabMusic.addEventListener('mousedown', () => switchTab(tabMusic));

if (tabControls) switchTab(tabControls);

// Spotify Pagination Logic
let spotifyTracks = [];
let currentPage = 0;
const PAGE_SIZE = 5;

async function fetchTopTracks() {
  try {
    const res = await fetch('/api/top-tracks', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    spotifyTracks = data.items;
    currentPage = 0;
    renderSpotifyPage();
  } catch (e) {}
}

async function fetchLikedSongs() {
  try {
    document.getElementById('voice-status-text').setAttribute('value', 'Loading Liked Songs...');
    const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    spotifyTracks = data.items.map((item) => item.track); // Extract track from saved track object
    currentPage = 0;
    renderSpotifyPage();
    document.getElementById('voice-status-text').setAttribute('value', '');
  } catch (e) {
    document.getElementById('voice-status-text').setAttribute('value', 'Error loading songs.');
  }
}

document.getElementById('btn-liked-songs').addEventListener('mousedown', fetchLikedSongs);

// Gemini Nano Voice Search
const voiceStatus = document.getElementById('voice-status-text');
document.getElementById('btn-voice-search').addEventListener('mousedown', async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus.setAttribute('value', 'Speech API not supported in this browser.');
    return;
  }

  if (!window.ai) {
    voiceStatus.setAttribute('value', 'Gemini Nano (window.ai) not enabled in Chrome flags.');
    return;
  }

  voiceStatus.setAttribute('value', 'Listening... Speak now.');

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    voiceStatus.setAttribute('value', `Heard: "${transcript}"\nThinking with Gemini...`);

    try {
      // Using Chrome Prompt API
      const session = await window.ai.createTextSession();
      const prompt = `Extract the music search query (song name, artist, or genre) from the user's voice command: "${transcript}". Reply with ONLY the raw search query string and nothing else.`;
      const query = await session.prompt(prompt);

      voiceStatus.setAttribute('value', `Searching Spotify for: ${query}`);

      // Hit Spotify Search API
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();

      if (data.tracks && data.tracks.items.length > 0) {
        spotifyTracks = data.tracks.items;
        currentPage = 0;
        renderSpotifyPage();
        voiceStatus.setAttribute('value', `Found ${data.tracks.items.length} results!`);
      } else {
        voiceStatus.setAttribute('value', 'No results found.');
      }
    } catch (e) {
      voiceStatus.setAttribute('value', 'Gemini AI Error: ' + e.message);
    }
  };

  recognition.onerror = (e) => {
    voiceStatus.setAttribute('value', 'Microphone error: ' + e.error);
  };

  recognition.start();
});

function renderSpotifyPage() {
  const menu = document.getElementById('vr-spotify-menu');
  menu.innerHTML = '';

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageTracks = spotifyTracks.slice(start, end);

  document.getElementById('spotify-page-info').setAttribute('value', `Page ${currentPage + 1}`);

  pageTracks.forEach((track, i) => {
    const y = -(i * 0.15);
    const btn = document.createElement('a-plane');
    btn.setAttribute('position', `0 ${y} 0`);
    btn.setAttribute('width', '3.0');
    btn.setAttribute('height', '0.12');
    btn.setAttribute('color', '#222');

    // Only make clickable if music tab is active
    if (contentMusic.getAttribute('visible') === 'true') btn.classList.add('clickable');

    btn.addEventListener('mouseenter', () => btn.setAttribute('color', '#333'));
    btn.addEventListener('mouseleave', () => btn.setAttribute('color', '#222'));
    btn.addEventListener('mousedown', async () => {
      if (!deviceId) return;
      await fetch('/api/play', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [track.uri], device_id: deviceId }),
      });
    });

    const text = document.createElement('a-text');
    text.setAttribute('value', `${track.name} - ${track.artists[0].name}`);
    text.setAttribute('position', '-1.4 0 0.01');
    text.setAttribute('align', 'left');
    text.setAttribute('scale', '0.5 0.5 0.5');
    text.setAttribute('color', '#fff');
    btn.appendChild(text);
    menu.appendChild(btn);
  });
}

document.getElementById('spotify-prev-btn').addEventListener('mousedown', () => {
  if (currentPage > 0) {
    currentPage--;
    renderSpotifyPage();
  }
});
document.getElementById('spotify-next-btn').addEventListener('mousedown', () => {
  if ((currentPage + 1) * PAGE_SIZE < spotifyTracks.length) {
    currentPage++;
    renderSpotifyPage();
  }
});

// ==========================================
// ANIMATION & DATA LOOP
// ==========================================
window.getCurrentData = function () {
  if (playbackState.paused && !isLiveAudio) return { beatPulse: 0, loudness: 0, pitch: 0 };

  if (isLiveAudio && analyser) {
    analyser.getByteFrequencyData(dataArray);
    let bassSum = 0;
    for (let i = 0; i < 10; i++) bassSum += dataArray[i];
    let midSum = 0;
    for (let i = 10; i < 60; i++) midSum += dataArray[i];
    let trebleSum = 0;
    for (let i = 60; i < 128; i++) trebleSum += dataArray[i];
    return { beatPulse: bassSum / 10 / 255, loudness: midSum / 50 / 255, pitch: (trebleSum / 68 / 255) * 2 };
  } else {
    const now = performance.now() / 1000;
    const currentPositionSec = (playbackState.position + (performance.now() - playbackState.timestamp)) / 1000;
    const beatInterval = 60 / 120; // 120 bpm
    const beatPulse = Math.max(0, 1 - ((currentPositionSec % beatInterval) / beatInterval) * 4);
    return { beatPulse, loudness: 0.5 + Math.sin(now * 0.5) * 0.2, pitch: Math.sin(now * 0.1) * 0.5 + 0.5 };
  }
};

const scene = document.querySelector('a-scene');
function updateVisualizer() {
  requestAnimationFrame(updateVisualizer);
  const { beatPulse, loudness, pitch } = window.getCurrentData();
  if (scene) {
    const fogDensity = 0.02 + loudness * 0.05 + beatPulse * 0.03;
    const hue = Math.floor(pitch * 360) || 200;
    scene.setAttribute('fog', `type: exponential; color: hsl(${hue}, 80%, 30%); density: ${fogDensity}`);
  }
}
requestAnimationFrame(updateVisualizer);

AFRAME.registerComponent('megastructure', {
  init: function () {
    const ringGeo = new THREE.CylinderGeometry(200, 200, 30, 64, 1, true);

    this.hues = [0.0, 0.2, 0.4, 0.6, 0.8]; // 5 different colors
    this.mats = [];
    this.pivots = [];

    this.group = new THREE.Group();

    const trimGeo = new THREE.TorusGeometry(200, 4, 16, 100);
    this.trimMats = [];

    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(this.hues[i], 1.0, 0.5),
        emissive: new THREE.Color().setHSL(this.hues[i], 1.0, 0.2),
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide,
        fog: true,
      });
      this.mats.push(mat);

      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = Math.PI / (i + 2);
      if (i % 2 === 0) mesh.rotation.z = Math.PI / (i + 1.5);

      const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      this.trimMats.push(trimMat);
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.rotation.x = Math.PI / 2;
      mesh.add(trim);

      const pivot = new THREE.Group();
      pivot.add(mesh);
      this.pivots.push(pivot);
      this.group.add(pivot);
    }

    // Floating energy conduits and laser connection arcs
    const arcCount = 40;
    const arcGeo = new THREE.BufferGeometry();
    this.arcPositions = new Float32Array(arcCount * 6);
    arcGeo.setAttribute('position', new THREE.BufferAttribute(this.arcPositions, 3));
    this.arcMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    this.arcLines = new THREE.LineSegments(arcGeo, this.arcMat);
    this.group.add(this.arcLines);

    this.el.setObject3D('mesh', this.group);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };

    for (let i = 0; i < 5; i++) {
      const speed = 0.002 + i * 0.001 + data.loudness * 0.01;
      if (i % 2 === 0) {
        this.pivots[i].rotation.y += speed;
      } else {
        this.pivots[i].rotation.y -= speed;
      }

      const lightness = 0.2 + (Math.sin(this.time * 2.0 + i) * 0.5 + 0.5) * 0.6;
      this.mats[i].color.setHSL(this.hues[i], 1.0, lightness);

      this.trimMats[i].color.setHSL(this.hues[i], 1.0, 0.5 + data.beatPulse * 0.5);
      this.trimMats[i].opacity = 0.5 + data.beatPulse * 0.5;
    }

    // Dynamic laser connection arcs flaring on beat
    const pos = this.arcLines.geometry.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      const a1 = (i / 40) * Math.PI * 2 + this.time * 0.5;
      const a2 = a1 + 0.3;
      const r1 = 190;
      const r2 = 210;
      pos[i * 6] = Math.cos(a1) * r1;
      pos[i * 6 + 1] = Math.sin(this.time * 2.0 + i) * 15;
      pos[i * 6 + 2] = Math.sin(a1) * r1;

      pos[i * 6 + 3] = Math.cos(a2) * r2;
      pos[i * 6 + 4] = Math.sin(this.time * 2.0 + i + 1) * 15;
      pos[i * 6 + 5] = Math.sin(a2) * r2;
    }
    this.arcLines.geometry.attributes.position.needsUpdate = true;
    this.arcMat.opacity = 0.3 + data.beatPulse * 0.7;
  },
});

AFRAME.registerComponent('star-core', {
  init: function () {
    // Inner Core (Red/Orange)
    const geometry1 = new THREE.IcosahedronGeometry(170, 16);
    // Outer Core (Blue/Purple) - given larger radius offset and distinct displacement
    const geometry2 = new THREE.IcosahedronGeometry(230, 16);

    this.uniforms1 = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_color1: { value: new THREE.Color(0.9, 0.15, 0.0) },
      u_color2: { value: new THREE.Color(1.0, 0.85, 0.0) },
      u_mult: { value: 45.0 },
      u_opacity: { value: 0.55 },
    };
    this.uniforms2 = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_color1: { value: new THREE.Color(0.0, 0.45, 1.0) },
      u_color2: { value: new THREE.Color(0.65, 0.0, 1.0) },
      u_mult: { value: 60.0 }, // Higher wave intensity for blue layer
      u_opacity: { value: 0.75 }, // Higher opacity so it isn't overtaken
    };

    const getMaterial = (uniforms) =>
      new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
                uniform float u_time;
                uniform float u_bass;
                uniform float u_mult;
                varying float vDisplacement;
                
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
                float cnoise(vec3 P) {
                    vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
                    Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);
                    vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
                    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); vec4 iy = vec4(Pi0.yy, Pi1.yy);
                    vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
                    vec4 ixy = permute(permute(ix) + iy);
                    vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
                    vec4 gx0 = ixy0 * (1.0 / 7.0); vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
                    gx0 = fract(gx0); vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
                    vec4 sz0 = step(gz0, vec4(0.0));
                    gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
                    vec4 gx1 = ixy1 * (1.0 / 7.0); vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
                    gx1 = fract(gx1); vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
                    vec4 sz1 = step(gz1, vec4(0.0));
                    gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
                    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
                    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
                    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
                    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
                    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
                    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
                    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
                    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
                    vec3 fade_xyz = fade(Pf0);
                    vec4 n_z = mix(vec4(dot(g000, Pf0), dot(g100, vec3(Pf1.x, Pf0.yz)), dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)), dot(g110, vec3(Pf1.xy, Pf0.z))), vec4(dot(g001, vec3(Pf0.xy, Pf1.z)), dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z)), dot(g011, vec3(Pf0.x, Pf1.yz)), dot(g111, Pf1)), fade_xyz.z);
                    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
                    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
                    return 2.2 * n_xyz;
                }

                void main() {
                    float noise = cnoise(position * 0.015 + u_time * 0.7);
                    float displacement = noise * u_mult * (1.0 + u_bass * 2.5);
                    vDisplacement = displacement;
                    vec3 newPosition = position + normal * displacement;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
        fragmentShader: `
                uniform float u_time;
                uniform float u_bass;
                uniform vec3 u_color1;
                uniform vec3 u_color2;
                uniform float u_opacity;
                varying float vDisplacement;
                
                void main() {
                    float heat = clamp((vDisplacement + 30.0) / 60.0, 0.0, 1.0);
                    vec3 color = mix(u_color1, u_color2, heat);
                    color = mix(color, vec3(1.0), clamp(u_bass - 0.1, 0.0, 1.0) * heat);
                    gl_FragColor = vec4(color, u_opacity);
                }
            `,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        fog: false,
      });

    this.mesh1 = new THREE.Mesh(geometry1, getMaterial(this.uniforms1));
    this.mesh2 = new THREE.Mesh(geometry2, getMaterial(this.uniforms2));

    // Solar wind coronal particle ejection overlay
    const solarCount = 1200;
    const solarGeo = new THREE.BufferGeometry();
    const solarPos = new Float32Array(solarCount * 3);
    this.solarDirs = new Float32Array(solarCount * 3);

    for (let i = 0; i < solarCount; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();
      this.solarDirs[i * 3] = dir.x;
      this.solarDirs[i * 3 + 1] = dir.y;
      this.solarDirs[i * 3 + 2] = dir.z;

      const r = 200 + Math.random() * 80;
      solarPos[i * 3] = dir.x * r;
      solarPos[i * 3 + 1] = dir.y * r;
      solarPos[i * 3 + 2] = dir.z * r;
    }
    solarGeo.setAttribute('position', new THREE.BufferAttribute(solarPos, 3));
    const solarMat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 3.5,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.solarMesh = new THREE.Points(solarGeo, solarMat);

    this.group = new THREE.Group();
    this.group.add(this.mesh1);
    this.group.add(this.mesh2);
    this.group.add(this.solarMesh);
    this.el.setObject3D('mesh', this.group);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    this.uniforms1.u_time.value = this.time;
    this.uniforms2.u_time.value = this.time * 0.8 + 100.0; // Offset noise

    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    this.uniforms1.u_bass.value = data.beatPulse;
    this.uniforms2.u_bass.value = data.beatPulse;

    // Solar wind particle bursts on peak loudness
    const sPos = this.solarMesh.geometry.attributes.position;
    const burstSpeed = 1.0 + data.loudness * 8.0 + data.beatPulse * 6.0;
    for (let i = 0; i < sPos.count; i++) {
      let x = sPos.getX(i) + this.solarDirs[i * 3] * burstSpeed;
      let y = sPos.getY(i) + this.solarDirs[i * 3 + 1] * burstSpeed;
      let z = sPos.getZ(i) + this.solarDirs[i * 3 + 2] * burstSpeed;

      const distSq = x * x + y * y + z * z;
      if (distSq > 450 * 450) {
        // Reset back to surface of core
        const r = 200;
        x = this.solarDirs[i * 3] * r;
        y = this.solarDirs[i * 3 + 1] * r;
        z = this.solarDirs[i * 3 + 2] * r;
      }
      sPos.setXYZ(i, x, y, z);
    }
    sPos.needsUpdate = true;
    this.solarMesh.material.opacity = 0.4 + data.loudness * 0.6;

    this.mesh1.rotation.y += 0.0005;
    this.mesh2.rotation.y -= 0.0003;
  },
});

AFRAME.registerComponent('synth-terrain', {
  init: function () {
    const geometry = new THREE.PlaneGeometry(600, 600, 150, 150);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x110022,
      emissive: 0x330066,
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false,
      fog: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D('mesh', this.mesh);

    this.initialY = new Float32Array(geometry.attributes.position.count);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      this.initialY[i] = positions.getY(i);
    }
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const { beatPulse, loudness, pitch } = window.getCurrentData
      ? window.getCurrentData()
      : { beatPulse: 0, loudness: 0, pitch: 0 };

    const positions = this.mesh.geometry.attributes.position;
    const heightMultiplier = 30.0 + loudness * 40.0;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Simplex-like landscape rolling forward
      const wave1 = Math.sin(x * 0.005 + this.time * 0.5) * Math.cos(z * 0.005 + this.time);
      const wave2 = Math.sin(x * 0.01 - this.time * 0.2) * Math.sin(z * 0.01 - this.time * 0.4);

      const dist = Math.sqrt(x * x + z * z);
      const centerAttenuation = Math.min(1.0, dist / 100.0);
      const height = (wave1 + wave2) * heightMultiplier * centerAttenuation * 3.0;
      positions.setY(i, this.initialY[i] + Math.max(0, height)); // Only displace upwards to create sharp mountains
    }

    positions.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();

    // Flash emissive color on beat
    const r = 0.2 + beatPulse * 0.8;
    const b = 0.5 + pitch * 0.5;
    this.mesh.material.emissive.setRGB(r, 0.0, b);
  },
});
AFRAME.registerComponent('waving-starfield', {
  init: function () {
    this.count = 80000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      // Distribute in a large sphere around user
      const r = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.uniforms = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
                uniform float u_time;
                uniform float u_bass;
                varying float vAlpha;
                
                void main() {
                    vec3 pos = position;
                    // Rotate slowly
                    float c = cos(u_time * 0.05);
                    float s = sin(u_time * 0.05);
                    pos.x = position.x * c - position.z * s;
                    pos.z = position.z * c + position.x * s;
                    
                    // Sine wave based on position to create clusters/waves
                    float wave = sin(pos.x * 0.15 + u_time * 2.0) * cos(pos.y * 0.15 - u_time * 1.5) * sin(pos.z * 0.15 + u_time * 1.8);
                    vAlpha = clamp(wave + u_bass, 0.0, 1.0);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (2.0 + u_bass * 5.0) * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                varying float vAlpha;
                void main() {
                    // Circular particle
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    
                    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * 0.8);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.mesh);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    this.uniforms.u_time.value = this.time;

    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
  },
});
AFRAME.registerComponent('halo-ring', {
  init: function () {
    const diskGeometry = new THREE.TorusGeometry(150, 10, 32, 100);
    diskGeometry.rotateX(Math.PI / 2); // Flat around user

    this.uniforms = {
      u_time: { value: 0.0 },
      u_treble: { value: 0.0 },
      u_bass: { value: 0.0 },
    };

    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float u_time;
                uniform float u_bass;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    // Moderated spatial frequency and smooth wave height amplitude
                    float wave = sin(u_time * 1.2 + position.x * 0.01 + position.z * 0.01);
                    vec3 pos = position + normal * ((5.0 + u_bass * 25.0) * wave);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
      fragmentShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float u_time;
                uniform float u_treble;
                
                void main() {
                    // Smooth, lower frequency glowing rings based on UV and time
                    float ring = sin(vUv.y * 12.0 - u_time * 2.0);
                    float brightness = (ring * 0.5 + 0.5) * (1.0 + u_treble * 1.5);
                    
                    // Cyan shifting to Purple based on time
                    vec3 color1 = vec3(0.0, 1.0, 1.0);
                    vec3 color2 = vec3(0.8, 0.0, 1.0);
                    vec3 mixColor = mix(color1, color2, sin(u_time * 0.5) * 0.5 + 0.5);
                    
                    gl_FragColor = vec4(mixColor * brightness, 0.45);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(diskGeometry, diskMaterial);

    // Floating orbital satellites along the ring track
    this.satCount = 8;
    const satGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.satGroup = new THREE.Group();
    this.satellites = [];
    for (let i = 0; i < this.satCount; i++) {
      const sat = new THREE.Mesh(satGeo, satMat.clone());
      this.satellites.push(sat);
      this.satGroup.add(sat);
    }

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.satGroup);
    this.el.setObject3D('mesh', this.group);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    this.uniforms.u_time.value = this.time;

    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
    this.uniforms.u_treble.value = data.pitch;

    // Orbit satellites along ring track and pulse light on tempo
    const radius = 150;
    for (let i = 0; i < this.satCount; i++) {
      const angle = (i / this.satCount) * Math.PI * 2 + this.time * 0.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(angle * 3.0 + this.time * 2.0) * 8.0;
      this.satellites[i].position.set(x, y, z);
      this.satellites[i].material.emissiveIntensity = 0.5 + data.beatPulse * 2.5;
    }

    // Smooth subtle rotation of the ring
    this.mesh.rotation.y -= 0.0005 + data.loudness * 0.002;
    this.mesh.rotation.z = Math.sin(this.time * 0.1) * 0.04;
    this.mesh.rotation.x = Math.sin(this.time * 0.05) * 0.02;
  },
});

AFRAME.registerComponent('color-wave-stars', {
  init: function () {
    this.count = 80000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 400;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.uniforms = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
                uniform float u_time;
                uniform float u_bass;
                varying float vAlpha;
                varying vec3 vColor;
                
                vec3 hsl2rgb(vec3 c) {
                    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
                }
                
                void main() {
                    vec3 pos = position;
                    float c = cos(u_time * 0.05);
                    float s = sin(u_time * 0.05);
                    pos.x = position.x * c - position.z * s;
                    pos.z = position.z * c + position.x * s;
                    
                    float wave = sin(pos.x * 0.05 + u_time * 1.5) * cos(pos.y * 0.05 - u_time * 1.0) * sin(pos.z * 0.05 + u_time * 1.2);
                    vAlpha = clamp(wave + u_bass, 0.0, 1.0);
                    
                    float hue = fract(pos.x * 0.01 + pos.y * 0.01 + u_time * 0.1);
                    vColor = hsl2rgb(vec3(hue, 0.8, 0.6));
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (3.0 + u_bass * 8.0) * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                varying float vAlpha;
                varying vec3 vColor;
                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;
                    if (alpha < 0.01) discard;
                    
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time, timeDelta) {
    if (this.uniforms) {
      this.uniforms.u_time.value = time * 0.001;
      this.uniforms.u_bass.value = window.audioFeatures ? window.audioFeatures.bass * 1.5 : 0;
    }
  },
});

AFRAME.registerComponent('dynamic-color-waves', {
  init: function () {
    this.count = 80000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 400;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.uniforms = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_loudness: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
                uniform float u_time;
                uniform float u_bass;
                uniform float u_loudness;
                varying float vAlpha;
                varying vec3 vColor;
                
                vec3 hsl2rgb(vec3 c) {
                    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
                }
                
                void main() {
                    vec3 pos = position;
                    float c = cos(u_time * 0.05);
                    float s = sin(u_time * 0.05);
                    pos.x = position.x * c - position.z * s;
                    pos.z = position.z * c + position.x * s;
                    
                    float wave = sin(pos.x * 0.05 + u_time * 1.5) * cos(pos.y * 0.05 - u_time * 1.0) * sin(pos.z * 0.05 + u_time * 1.2);
                    vAlpha = clamp(wave + u_bass, 0.0, 1.0);
                    
                    // Soothing synthwave cyan/magenta pastels on chill sections, fiery reds/oranges on heavy bass drop
                    float baseHue = mix(0.55 + sin(pos.x * 0.01 + u_time * 0.2) * 0.15, 0.02 + sin(pos.y * 0.01) * 0.08, clamp(u_bass * 1.5, 0.0, 1.0));
                    float lightness = mix(0.6, 0.5 + u_loudness * 0.3, u_bass);
                    vColor = hsl2rgb(vec3(fract(baseHue), 0.85, lightness));
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (3.0 + u_bass * 8.0) * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                varying float vAlpha;
                varying vec3 vColor;
                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;
                    if (alpha < 0.01) discard;
                    
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    if (this.uniforms) {
      this.uniforms.u_time.value = time * 0.001;
      this.uniforms.u_bass.value = data.beatPulse;
      this.uniforms.u_loudness.value = data.loudness;
    }
  },
});

AFRAME.registerComponent('pulse-stars', {
  init: function () {
    this.count = 80000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const r = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.uniforms = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
                uniform float u_time;
                uniform float u_bass;
                varying float vAlpha;
                
                void main() {
                    vec3 pos = position;
                    
                    // Directional velocity pulses away from camera on bass hits
                    vec3 dir = normalize(pos);
                    pos += dir * (u_bass * 45.0 * sin(length(pos) * 0.05 - u_time * 4.0));
                    
                    float c = cos(u_time * 0.05);
                    float s = sin(u_time * 0.05);
                    float px = pos.x * c - pos.z * s;
                    float pz = pos.z * c + pos.x * s;
                    pos.x = px;
                    pos.z = pz;
                    
                    float wave = sin(pos.x * 0.15 + u_time * 2.0) * cos(pos.y * 0.15 - u_time * 1.5) * sin(pos.z * 0.15 + u_time * 1.8);
                    vAlpha = clamp(wave + u_bass, 0.0, 1.0);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (2.5 + u_bass * 7.0) * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                varying float vAlpha;
                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    
                    gl_FragColor = vec4(0.4, 0.8, 1.0, vAlpha * 0.85);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.mesh);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    this.uniforms.u_time.value = this.time;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
  },
});

AFRAME.registerComponent('viscous-liquid', {
  schema: { count: { type: 'int', default: 25000 }, size: { type: 'number', default: 4.0 } },
  init: function () {
    const geometry = new THREE.BufferGeometry();
    const count = this.data.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const size = 800;
    const halfSize = size / 2;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * size - halfSize;
      positions[i * 3 + 1] = Math.random() * size - halfSize;
      positions[i * 3 + 2] = Math.random() * size - halfSize;

      const colorType = Math.random();
      let c = new THREE.Color();
      if (colorType > 0.7) c.setHSL(0.8, 0.9, 0.7);
      else if (colorType > 0.3) c.setHSL(0.5, 0.9, 0.6);
      else c.setHSL(0.1, 1.0, 0.6);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: this.data.size,
      map: texture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
      fog: true,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.u_time = { value: 0 };
      shader.uniforms.u_bass = { value: 0 };
      shader.uniforms.u_loudness = { value: 0 };
      shader.vertexShader = `
        uniform float u_time;
        uniform float u_bass;
        uniform float u_loudness;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `
        vec3 transformed = vec3(position);
        float viscosity = mix(0.5, 3.5, u_loudness);
        transformed.y += sin(transformed.x * 0.03 * viscosity + u_time * 1.5) * (15.0 + u_bass * 30.0);
        transformed.x += cos(transformed.z * 0.03 * viscosity + u_time * 1.2) * (12.0 + u_bass * 25.0);
        transformed.z += sin(transformed.y * 0.02 + u_time) * (10.0 * u_loudness);
        `,
      );
      this.shader = shader;
    };

    this.mesh = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.mesh);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    if (this.shader) {
      this.shader.uniforms.u_time.value = this.time;
      this.shader.uniforms.u_bass.value = data.beatPulse;
      this.shader.uniforms.u_loudness.value = data.loudness;
    }
  },
});

AFRAME.registerComponent('solar-flare-storm', {
  init: function () {
    this.count = 40000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const r = 80 + Math.random() * 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1.0, 0.5);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.uniforms = { u_time: { value: 0 }, u_bass: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float u_time;
        uniform float u_bass;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 pos = position;
          float flare = sin(pos.x * 0.05 + u_time * 2.0) * cos(pos.y * 0.05 + u_time * 2.5);
          pos += normal * flare * (10.0 + u_bass * 35.0);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (3.0 + u_bass * 6.0) * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time) {
    this.uniforms.u_time.value = time * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
    this.points.rotation.y += 0.001;
  },
});

AFRAME.registerComponent('hyperdrive-warp', {
  init: function () {
    this.count = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 6);

    for (let i = 0; i < this.count; i++) {
      const radius = 20 + Math.random() * 120;
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 600;

      positions[i * 6] = Math.cos(angle) * radius;
      positions[i * 6 + 1] = Math.sin(angle) * radius;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = Math.cos(angle) * radius;
      positions[i * 6 + 4] = Math.sin(angle) * radius;
      positions[i * 6 + 5] = z - 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(geometry, material);
    this.el.setObject3D('mesh', this.lines);
    this.time = 0;
  },
  tick: function (time, timeDelta) {
    this.time += timeDelta * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    const speed = 150 + data.loudness * 400 + data.beatPulse * 300;
    const pos = this.lines.geometry.attributes.position.array;

    for (let i = 0; i < this.count; i++) {
      pos[i * 6 + 2] += speed * (timeDelta * 0.001);
      pos[i * 6 + 5] = pos[i * 6 + 2] - (15 + data.beatPulse * 45);
      if (pos[i * 6 + 2] > 300) {
        pos[i * 6 + 2] = -300;
        pos[i * 6 + 5] = -320;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  },
});

AFRAME.registerComponent('cyber-matrix', {
  init: function () {
    const gridGeo = new THREE.PlaneGeometry(400, 400, 60, 60);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xff0077, wireframe: true, transparent: true, opacity: 0.4 });
    this.grid = new THREE.Mesh(gridGeo, gridMat);
    this.grid.position.y = -20;

    this.barCount = 64;
    const barGeo = new THREE.BoxGeometry(2, 40, 2);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.8 });
    this.barMesh = new THREE.InstancedMesh(barGeo, barMat, this.barCount);
    this.dummy = new THREE.Object3D();

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      const r = 60;
      this.dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      this.dummy.updateMatrix();
      this.barMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.group = new THREE.Group();
    this.group.add(this.grid);
    this.group.add(this.barMesh);
    this.el.setObject3D('mesh', this.group);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0, pitch: 0 };
    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      const r = 60;
      const h = 1.0 + Math.abs(Math.sin(time * 0.003 + i * 0.2)) * (5.0 + data.loudness * 20.0);
      this.dummy.position.set(Math.cos(angle) * r, h * 10 - 20, Math.sin(angle) * r);
      this.dummy.scale.set(1, h, 1);
      this.dummy.updateMatrix();
      this.barMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.barMesh.instanceMatrix.needsUpdate = true;
    this.grid.rotation.y += 0.0005;
  },
});

AFRAME.registerComponent('auroral-vortex', {
  init: function () {
    this.count = 25000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const u = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + u * 120;
      const y = (Math.random() - 0.5) * 160;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const c = new THREE.Color().setHSL(0.35 + Math.random() * 0.25, 0.9, 0.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.uniforms = { u_time: { value: 0 }, u_pitch: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float u_time;
        uniform float u_pitch;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 pos = position;
          float wave = sin(pos.x * 0.04 + u_time * 1.5) * cos(pos.z * 0.04 + u_time * 1.2);
          pos.y += wave * (15.0 + u_pitch * 25.0);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 3.5 * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.75);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time) {
    this.uniforms.u_time.value = time * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { pitch: 0 };
    this.uniforms.u_pitch.value = data.pitch;
    this.points.rotation.y += 0.001;
  },
});

AFRAME.registerComponent('quantum-nebula', {
  init: function () {
    this.count = 50000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 350;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 350;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 350;

      const c = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.uniforms = { u_time: { value: 0 }, u_bass: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float u_time;
        uniform float u_bass;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 pos = position;
          pos += sin(pos * 0.02 + u_time) * (10.0 + u_bass * 30.0);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (2.0 + u_bass * 6.0) * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.7);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time) {
    this.uniforms.u_time.value = time * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
    this.points.rotation.y += 0.0005;
  },
});

AFRAME.registerComponent('crystal-spire', {
  init: function () {
    const geo = new THREE.OctahedronGeometry(60, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0088ff,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 20, 0);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, pitch: 0 };
    this.mesh.rotation.y += 0.005 + data.beatPulse * 0.02;
    this.mesh.rotation.x = Math.sin(time * 0.001) * 0.2;
    this.mesh.scale.setScalar(1.0 + data.beatPulse * 0.5);
  },
});

AFRAME.registerComponent('dyson-ring', {
  init: function () {
    this.group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(180, 8, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x884400, wireframe: true });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 3;

    const coreGeo = new THREE.SphereGeometry(35, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffaa00 });
    this.core = new THREE.Mesh(coreGeo, coreMat);

    this.group.add(this.ring);
    this.group.add(this.core);
    this.el.setObject3D('mesh', this.group);
  },
  tick: function () {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    this.ring.rotation.y += 0.003 + data.loudness * 0.01;
    this.ring.rotation.z += 0.002;
    this.core.scale.setScalar(1.0 + data.beatPulse * 0.4);
  },
});

AFRAME.registerComponent('neon-sentinel', {
  init: function () {
    this.group = new THREE.Group();
    const headGeo = new THREE.IcosahedronGeometry(40, 1);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xaa0033, wireframe: true });
    this.head = new THREE.Mesh(headGeo, headMat);

    const eyeGeo = new THREE.SphereGeometry(12, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.eye = new THREE.Mesh(eyeGeo, eyeMat);
    this.eye.position.set(0, 0, 35);

    this.group.add(this.head);
    this.group.add(this.eye);
    this.group.position.set(0, 30, 0);
    this.el.setObject3D('mesh', this.group);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    this.head.rotation.y = Math.sin(time * 0.001) * 0.5;
    this.head.rotation.x = Math.cos(time * 0.0008) * 0.2;
    this.eye.scale.setScalar(1.0 + data.loudness * 1.5);
  },
});

AFRAME.registerComponent('fractal-beacon', {
  init: function () {
    this.group = new THREE.Group();
    this.pyramids = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00aa44, wireframe: true });

    for (let i = 0; i < 4; i++) {
      const geo = new THREE.ConeGeometry(25 * (i + 1), 35 * (i + 1), 4);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = (i - 1.5) * 30;
      this.pyramids.push(mesh);
      this.group.add(mesh);
    }
    this.el.setObject3D('mesh', this.group);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0 };
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.pyramids[i].rotation.y += dir * (0.005 + data.beatPulse * 0.02);
      this.pyramids[i].scale.setScalar(1.0 + Math.sin(time * 0.002 + i) * 0.2 + data.beatPulse * 0.3);
    }
  },
});

AFRAME.registerComponent('event-horizon', {
  init: function () {
    this.group = new THREE.Group();
    const holeGeo = new THREE.SphereGeometry(45, 32, 32);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.hole = new THREE.Mesh(holeGeo, holeMat);

    const diskGeo = new THREE.RingGeometry(55, 160, 64);
    diskGeo.rotateX(-Math.PI / 2);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    this.disk = new THREE.Mesh(diskGeo, diskMat);

    this.group.add(this.hole);
    this.group.add(this.disk);
    this.el.setObject3D('mesh', this.group);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    this.disk.rotation.z += 0.01 + data.loudness * 0.03;
    this.hole.scale.setScalar(1.0 + data.beatPulse * 0.25);
  },
});

AFRAME.registerComponent('supernova-fov', {
  init: function () {
    const geo = new THREE.SphereGeometry(15, 64, 64);
    this.uniforms = { u_time: { value: 0 }, u_bass: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float u_time;
        uniform float u_bass;
        varying vec3 vPos;
        void main() {
          vPos = position;
          vec3 pos = position + normal * (sin(position.x * 0.5 + u_time * 2.0) * (0.5 + u_bass * 2.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform float u_bass;
        varying vec3 vPos;
        void main() {
          float pulse = sin(length(vPos) * 0.2 - u_time * 3.0);
          vec3 col = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.0), pulse * 0.5 + 0.5);
          gl_FragColor = vec4(col, 0.45 + u_bass * 0.3);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    this.uniforms.u_time.value = time * 0.001;
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0 };
    this.uniforms.u_bass.value = data.beatPulse;
    this.mesh.rotation.y += 0.002;
  },
});

AFRAME.registerComponent('kaleidoscope-fov', {
  init: function () {
    const geo = new THREE.IcosahedronGeometry(18, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.BackSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, pitch: 0 };
    this.mesh.rotation.x += 0.002;
    this.mesh.rotation.y += 0.004;
    this.mesh.scale.setScalar(1.0 + data.beatPulse * 0.25);
    this.mesh.material.color.setHSL(data.pitch, 0.9, 0.5);
  },
});

AFRAME.registerComponent('data-matrix-fov', {
  init: function () {
    const geo = new THREE.CylinderGeometry(20, 20, 100, 32, 32, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff44,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    this.mesh.rotation.y += 0.005 + data.loudness * 0.01;
    this.mesh.scale.x = 1.0 + Math.sin(time * 0.002) * 0.1;
  },
});

AFRAME.registerComponent('energy-shield-fov', {
  init: function () {
    const geo = new THREE.SphereGeometry(16, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0088ff,
      emissive: 0x0044aa,
      wireframe: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.6,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function () {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0 };
    this.mesh.rotation.y -= 0.002;
    this.mesh.material.emissiveIntensity = 0.5 + data.beatPulse * 2.0;
  },
});

AFRAME.registerComponent('wormhole-fov', {
  init: function () {
    const geo = new THREE.TorusGeometry(30, 15, 32, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.el.setObject3D('mesh', this.mesh);
  },
  tick: function (time) {
    const data = window.getCurrentData ? window.getCurrentData() : { beatPulse: 0, loudness: 0 };
    this.mesh.rotation.z += 0.01 + data.loudness * 0.02;
    this.mesh.rotation.x = Math.sin(time * 0.001) * 0.3;
  },
});

// Exit VR Logic
const btnExitVr = document.getElementById('btn-exit-vr');
if (btnExitVr) {
  btnExitVr.addEventListener('mousedown', () => {
    document.querySelector('a-scene').exitVR();
    document.getElementById('aframe-scene-container').style.display = 'none';
    document.getElementById('staging-area').style.display = 'flex';
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
  });
}
