import { Engine } from '@babylonjs/core/Engines/engine.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import '@babylonjs/core/Meshes/instancedMesh.js';
import '@babylonjs/loaders/glTF/index.js';
import { COURSES, obstacleBoxes, obstaclePose } from '../../shared/courses';
import type { Box, CourseDefinition, ObstacleDefinition, PlayerSnapshot, RacerState } from '../../shared/protocol';
import type { Preferences } from '../storage';
import { presentFrame } from './frame';

interface BirdVisual { root: TransformNode; wings: TransformNode[]; beak?: TransformNode; material?: PBRMaterial; meshes: AbstractMesh[] }
interface ObstacleVisual { definition: ObstacleDefinition; root: TransformNode; bars: InstancedMesh[]; collars: InstancedMesh[] }
const c3 = (hex: string) => Color3.FromHexString(hex);
const temp = new Vector3();

export class GameScene {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  renderer = 'WebGL2';
  engine: AbstractEngine;
  ready = false;
  private birdAsset?: AssetContainer;
  private kitAsset?: AssetContainer;
  private prototype = new Map<string, Mesh>();
  private materials = new Map<string, StandardMaterial>();
  private menuRoot: TransformNode;
  private courseRoot?: TransformNode;
  private menuBirds: BirdVisual[] = [];
  private birds = new Map<string, BirdVisual>();
  private obstacles: ObstacleVisual[] = [];
  private chunks: { root: TransformNode; z: number }[] = [];
  private course?: CourseDefinition;
  private mode: 'menu' | 'race' = 'menu';
  private follow = new Vector3(0, 8, -7);
  private look = new Vector3(0, 6, 20);
  private resolution = 1;
  private lastQualityCheck = 0;
  private settings: Preferences;
  private instrumentation: SceneInstrumentation;
  private puffs: { mesh: InstancedMesh; vx: number; vy: number; vz: number; life: number }[] = [];

  static async create(canvas: HTMLCanvasElement, settings: Preferences): Promise<GameScene> {
    let engine: AbstractEngine | undefined;
    let renderer = 'WebGL2';
    // WebGPU is a progressive enhancement. Both paths use the same scene and simulation.
    if (!new URLSearchParams(location.search).has('webgl') && 'gpu' in navigator) {
      try {
        const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine.js');
        if (await WebGPUEngine.IsSupportedAsync) {
          const gpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false });
          try { await gpu.initAsync({ jsPath: '/vendor/glslang/glslang.js', wasmPath: '/vendor/glslang/glslang.wasm' }, { jsPath: '/vendor/twgsl/twgsl.js', wasmPath: '/vendor/twgsl/twgsl.wasm' }); engine = gpu; renderer = 'WebGPU'; } catch (error) {
            gpu.dispose();
            // A canvas that acquired a WebGPU context cannot later acquire WebGL.
            const replacement = canvas.cloneNode(false) as HTMLCanvasElement; canvas.replaceWith(replacement); canvas = replacement;
            console.info('Using WebGL2 fallback:', error);
          }
        }
      } catch (error) { console.info('WebGPU is unavailable; using WebGL2.', error); }
    }
    engine ??= new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    const result = new GameScene(canvas, engine, settings); result.renderer = renderer;
    await result.load(); return result;
  }
  private constructor(private canvas: HTMLCanvasElement, engine: AbstractEngine, settings: Preferences) {
    this.engine = engine; this.settings = settings;
    const scene = this.scene = new Scene(engine); scene.useRightHandedSystem = true;
    this.instrumentation = new SceneInstrumentation(scene);
    scene.clearColor = new Color4(0, 0, 0, 0); scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    this.camera = new FreeCamera('camera', new Vector3(15, 11, 22), scene);
    this.camera.minZ = .15; this.camera.maxZ = 600; this.camera.fov = .68;
    this.camera.setTarget(new Vector3(0, 1, 0));
    const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene); sky.intensity = .65; sky.groundColor = c3('#b8a58c');
    const sun = new DirectionalLight('sun', new Vector3(-.5, -.8, -.6), scene); sun.intensity = 1.1; sun.diffuse = c3('#fff2db');
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = 1;
    scene.imageProcessingConfiguration.exposure = 1.1;
    scene.imageProcessingConfiguration.contrast = 1.05;
    this.menuRoot = new TransformNode('menu-world', scene);
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  private async load(): Promise<void> {
    [this.birdAsset, this.kitAsset] = await Promise.all([
      LoadAssetContainerAsync('/models/bird.glb', this.scene),
      LoadAssetContainerAsync('/models/obstacle-kit.glb', this.scene),
    ]);
    this.buildMenu();
    for (let i = 0; i < 16; i++) {
      const mesh = this.instance('cloud', '#fff7df', this.scene.transformNodes[0] ?? this.menuRoot);
      mesh.parent = null; mesh.setEnabled(false);
      this.puffs.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    this.ready = true;
  }
  private mat(color: string, shiny = true): StandardMaterial {
    const key = `${color}-${shiny}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new StandardMaterial(key, this.scene); mat.diffuseColor = c3(color);
      mat.specularColor = shiny ? new Color3(.45, .45, .4) : Color3.Black(); mat.specularPower = shiny ? 48 : 8;
      if (key.startsWith('#fff') && !shiny) mat.emissiveColor = c3(color).scale(.18);
      this.materials.set(key, mat);
    }
    return mat;
  }
  private source(kind: string, color: string): Mesh {
    const key = `${kind}:${color}`; let mesh = this.prototype.get(key);
    if (!mesh) {
      if (kind === 'cloud') mesh = CreateSphere(key, { diameter: 1, segments: 8 }, this.scene);
      else if (kind === 'island') mesh = CreateCylinder(key, { height: 1, diameterTop: 2, diameterBottom: 1.4, tessellation: 7 }, this.scene);
      else if (kind === 'pipe') {
        const template = this.kitAsset?.meshes.find(m => m.name === 'PipeStraight') as Mesh | undefined;
        if (template) {
          mesh = template.clone(key, null, true)!; mesh.parent = null; mesh.makeGeometryUnique();
          mesh.bakeTransformIntoVertices(Matrix.Compose(new Vector3(1 / .9, 1 / .9, .5), Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2), Vector3.Zero()));
          mesh.position.setAll(0); mesh.scaling.setAll(1); mesh.rotationQuaternion = null; mesh.rotation.setAll(0);
        } else mesh = CreateCylinder(key, { height: 1, diameter: 1, tessellation: 16 }, this.scene);
      }
      else mesh = CreateBox(key, { size: 1 }, this.scene);
      mesh.material = this.mat(color, !['cloud', 'island'].includes(kind)); mesh.isVisible = false; mesh.isPickable = false;
      this.prototype.set(key, mesh);
    }
    return mesh;
  }
  private instance(kind: string, color: string, parent: TransformNode, position = [0, 0, 0], scale = [1, 1, 1]): InstancedMesh {
    const mesh = this.source(kind, color).createInstance(`${kind}-instance`);
    mesh.parent = parent; mesh.position.set(position[0], position[1], position[2]); mesh.scaling.set(scale[0], scale[1], scale[2]); mesh.isPickable = false;
    return mesh;
  }
  private bird(id: string, color: string, parent?: TransformNode): BirdVisual {
    const root = new TransformNode(`bird-${id}`, this.scene); root.parent = parent ?? null;
    const model = this.birdAsset!.instantiateModelsToScene(name => `${id}-${name}`, false, { doNotInstantiate: true });
    for (const node of model.rootNodes) node.parent = root;
    const meshes = root.getChildMeshes();
    let material: PBRMaterial | undefined;
    for (const mesh of meshes) {
      mesh.isPickable = false;
      if (mesh.material?.name === 'Body' || mesh.material?.name.endsWith('-Body')) {
        material ??= (mesh.material as PBRMaterial).clone(`body-${id}`)!; material.albedoColor = c3(color).toLinearSpace(); material.roughness = .35; material.emissiveColor = material.albedoColor.scale(.06);
        mesh.material = material;
      }
    }
    const nodes = root.getDescendants(false);
    const wings = nodes.filter(n => n.name.endsWith('WingL') || n.name.endsWith('WingR')) as TransformNode[];
    const beak = nodes.find(n => n.name.endsWith('BeakLower')) as TransformNode | undefined;
    for (const wing of wings) wing.rotationQuaternion = null;
    if (beak) beak.rotationQuaternion = null;
    return { root, meshes, wings, beak, material };
  }
  private cloud(parent: TransformNode, x: number, y: number, z: number, size: number): void {
    for (const [dx, dy, dz, r] of [[0, 0, 0, 1.1], [-.7, -.15, .05, .85], [.75, -.13, .1, .8], [.1, .35, -.15, .85]]) {
      this.instance('cloud', '#fffdf2', parent, [x + dx * size, y + dy * size, z + dz * size], [r * size * 1.3, r * size, r * size]);
    }
  }
  private buildMenu(): void {
    const parent = this.menuRoot;
    this.instance('island', '#b98c63', parent, [0, -1.2, 0], [5.3, 2.9, 4.1]);
    this.instance('island', '#d2a57b', parent, [0, -.2, 0], [5.55, .7, 4.3]);
    this.instance('island', '#89ac65', parent, [0, .21, 0], [5.7, .35, 4.4]);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399;
      this.instance('box', '#e6be91', parent, [Math.cos(a) * 4.6, -.8 - (i % 3) * .35, Math.sin(a) * 3.3], [.6, .22, .36]);
    }
    const gate = new TransformNode('hero-gate', this.scene); gate.parent = parent; gate.position.set(-.8, 4.1, -1.4);
    for (const [x, y, sx, sy] of [[-2.9, 0, .75, 6], [2.9, 0, .75, 6], [0, 2.9, 6.55, .75]]) {
      const pipe = this.instance('pipe', '#4f9d59', gate, [x, y, 0], [.75, sy === .75 ? sx : sy, .75]);
      if (sy === .75) pipe.rotation.z = Math.PI / 2;
      if (x !== 0) {
        this.instance('pipe', '#78be70', gate, [x, -2.65, 0], [1, .23, 1]);
        this.instance('pipe', '#78be70', gate, [x, 2.65, 0], [1, .23, 1]);
      }
    }
    const hero = this.bird('hero', '#ffcc42', parent); hero.root.position.set(.1, 2.9, 2.6); hero.root.scaling.setAll(1.65); hero.root.rotation.y = .4;
    const blue = this.bird('blue', '#55bce7', parent); blue.root.position.set(-4, 1.5, 2); blue.root.scaling.setAll(.63); blue.root.rotation.y = .25;
    const pink = this.bird('pink', '#ed7773', parent); pink.root.position.set(3.8, 2.5, -1.2); pink.root.scaling.setAll(.56); pink.root.rotation.y = -.65;
    this.menuBirds.push(hero, blue, pink);
    this.cloud(parent, -6.5, .2, 2, 1.4); this.cloud(parent, 4.7, -1.4, 3, 1.7); this.cloud(parent, 3.1, 5.6, -5, .85);
    this.cloud(parent, -5, 5.6, -5.5, 1.1);
    for (const x of [-4.4, 4.4]) {
      this.instance('pipe', '#efead6', parent, [x, 1.5, 1.1], [.1, 2.6, .1]);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) this.instance('box', (row + col) % 2 ? '#fff8e8' : '#354e47', parent, [x + .13 + col * .23, 2.5 - row * .23, 1.1], [.23, .23, .04]);
    }
    this.menuRoot.rotation.y = -.1;
  }
  setPreferences(settings: Preferences) { this.settings = settings; this.resize(); }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const low = this.settings.quality === 'low';
    const scale = Math.max(1, w / (low ? 1280 : 1920), h / (low ? 720 : 1080)) * (this.settings.quality === 'auto' ? this.resolution : 1);
    this.engine.setHardwareScalingLevel(scale); this.engine.resize();
  }
  showMenu() {
    this.mode = 'menu'; this.menuRoot.setEnabled(true); this.courseRoot?.setEnabled(false);
    for (const b of this.birds.values()) b.root.setEnabled(false);
    this.scene.clearColor.set(0, 0, 0, 0); this.scene.fogMode = Scene.FOGMODE_NONE; this.camera.fov = .64;
    this.camera.position.set(10.5, 7.7, 15.4); this.camera.setTarget(new Vector3(0, 1.6, .5));
    this.canvas.classList.remove('racing'); this.resize();
  }
  showCourse(course: CourseDefinition): void {
    this.mode = 'race'; this.menuRoot.setEnabled(false); this.canvas.classList.add('racing');
    if (this.course?.id !== course.id || !this.courseRoot) this.buildCourse(course);
    this.course = course; this.courseRoot!.setEnabled(true);
    const sky = c3(course.sky); this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogMode = Scene.FOGMODE_LINEAR; this.scene.fogStart = 90; this.scene.fogEnd = 310; this.scene.fogColor = sky;
    this.camera.fov = 75 * Math.PI / 180; this.follow.set(0, 8, -7); this.look.set(0, 7, 20); this.resize();
  }
  private buildCourse(course: CourseDefinition): void {
    this.courseRoot?.dispose(false, false); this.obstacles = []; this.chunks = [];
    const root = this.courseRoot = new TransformNode(`course-${course.id}`, this.scene);
    for (let z = 0; z < course.length + 200; z += 128) {
      const chunk = new TransformNode(`chunk-${z}`, this.scene); chunk.parent = root; this.chunks.push({ root: chunk, z });
      this.instance('box', '#d8aa7b', chunk, [0, -3.9, z + 40], [27, 3.7, 105]);
      this.instance('box', course.ground, chunk, [0, -2.2, z + 40], [27.4, .4, 106]);
      for (const side of [-1, 1]) {
        const rail = this.instance('pipe', '#5b9f63', chunk, [side * 13.2, -.4, z + 40], [1.2, 128, 1.2]); rail.rotation.x = Math.PI / 2;
        for (let i = 0; i < 4; i++) {
          const collar = this.instance('pipe', '#7cbb72', chunk, [side * 13.2, -.4, z + i * 32], [1.5, .3, 1.5]); collar.rotation.x = Math.PI / 2;
          const h = 5 + ((i * 7 + z + (side + 1) * 3) % 13);
          this.instance('box', '#a2bec3', chunk, [side * (50 + i * 10), h / 2 - 8, z + i * 22], [6 + i, h, 7]);
        }
        this.cloud(chunk, side * 24, 9 + (z % 5), z + 60, 3.5);
        this.cloud(chunk, side * 37, 1, z + 10, 5);
      }
      for (let i = 0; i < 10; i++) this.instance('box', '#bf9067', chunk, [(i % 5 - 2) * 5.5, -3.2 - Math.floor(i / 5) * .8, z - 12], [5.3, .6, .15]);
    }
    for (const o of course.obstacles) {
      const group = new TransformNode(o.id, this.scene); group.parent = root;
      const bars: InstancedMesh[] = [], collars: InstancedMesh[] = [];
      if (o.kind === 'gust' || o.kind === 'speed_zone') {
        for (let i = 0; i < 4; i++) {
          const ring = CreateTorus('zone-ring', { diameter: o.width, thickness: .045, tessellation: 24 }, this.scene);
          ring.parent = group; ring.position.set(o.x, o.y, o.z - 5 + i * 3); ring.rotation.x = Math.PI / 2;
          ring.material = this.mat(o.kind === 'gust' ? '#75aab3' : '#e8c66b'); ring.isPickable = false;
        }
        for (let i = 0; i < 3; i++) {
          const line = this.instance('box', o.kind === 'gust' ? '#71a3ad' : '#e9bb55', group, [o.x - 2 + i * 1.5, o.y + 1, o.z], [1.4, .12, .12]); line.rotation.z = o.kind === 'gust' ? .2 : -.7;
        }
      } else {
        const color = o.kind === 'rotating_gate' ? '#a486b7' : o.kind === 'shutter' ? '#d49c61' : '#5ba465';
        for (let i = 0; i < 4; i++) {
          bars.push(this.instance('box', color, group));
          for (let j = 0; j < 2; j++) collars.push(this.instance('box', o.kind === 'shutter' ? '#4c5752' : '#88c27b', group));
        }
      }
      this.obstacles.push({ definition: o, root: group, bars, collars });
    }
    for (let i = 0; i <= course.checkpoints.length; i++) {
      const cp = course.checkpoints[i]; const z = cp?.z ?? course.length;
      const group = new TransformNode(`checkpoint-${i}`, this.scene); group.parent = root;
      for (const side of [-1, 1]) {
        this.instance('pipe', cp ? '#f4d578' : '#eee8d4', group, [side * 11, 6, z], [.25, 16, .25]);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) this.instance('box', cp ? ((row + col) % 2 ? '#fff1c1' : '#e7c464') : ((row + col) % 2 ? '#fff5df' : '#355849'), group, [side * 11 + (col + .5) * .5 * -side, 13 - row * .5, z], [.5, .5, .1]);
      }
      this.instance('box', cp ? '#ecd27d' : '#f5f0df', group, [0, 14.5, z], [22, .3, .25]);
    }
  }
  crash(position: RacerState): void {
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i], a = i * 2.399;
      p.mesh.setEnabled(true); p.mesh.position.set(position.x, position.y, position.z);
      p.vx = Math.cos(a) * (2 + i % 3); p.vy = 1.5 + (i % 4); p.vz = Math.sin(a) * 3; p.life = .55;
    }
  }
  private animateBird(bird: BirdVisual, seconds: number, flap: number, bank = 0, pitch = 0) {
    bird.root.rotation.z = bank; bird.root.rotation.x = pitch;
    for (let i = 0; i < bird.wings.length; i++) bird.wings[i].rotation.z = (i === 0 ? -1 : 1) * (.15 + Math.sin(seconds * 11) * flap);
    if (bird.beak) bird.beak.rotation.x = Math.sin(seconds * 3) * .06;
  }
  render(now: number, dt: number, players: PlayerSnapshot[] = [], localId = '', raceSeconds = 0): void {
    const seconds = now / 1000;
    if (this.mode === 'menu') {
      for (let i = 0; i < this.menuBirds.length; i++) {
        const b = this.menuBirds[i]; b.root.position.y = [2.9, 1.5, 2.5][i] + Math.sin(seconds * 1.7 + i) * (this.settings.reducedMotion ? .025 : .13);
        this.animateBird(b, seconds + i, .18, Math.sin(seconds * 1.3 + i) * .045);
      }
      this.menuRoot.rotation.y = -.1 + (this.settings.reducedMotion ? 0 : Math.sin(seconds * .25) * .025);
    } else {
      const local = players.find(p => p.playerId === localId);
      if (local) {
        let distance = 7;
        const behind = this.course?.obstacles.find(o => o.z < local.z && local.z - o.z < 8 && o.kind !== 'gust' && o.kind !== 'speed_zone');
        if (behind) distance = Math.max(3, local.z - behind.z - .7);
        const snap = Math.abs(this.camera.position.z - local.z) > 25;
        const cameraY = this.settings.reducedMotion ? 6.5 + (local.y - 6.5) * .35 : local.y;
        temp.set(local.x * .8, cameraY + 2.1, local.z - distance);
        if (snap) this.follow.copyFrom(temp); else Vector3.LerpToRef(this.follow, temp, 1 - Math.exp(-dt * 12), this.follow);
        temp.set(local.x * .6, cameraY + .45, local.z + 22);
        Vector3.LerpToRef(this.look, temp, snap ? 1 : 1 - Math.exp(-dt * 9), this.look);
        this.camera.position.copyFrom(this.follow); this.camera.setTarget(this.look);
        for (const chunk of this.chunks) chunk.root.setEnabled(chunk.z > local.z - 200 && chunk.z < local.z + 330);
      }
      for (const visual of this.obstacles) {
        const o = visual.definition;
        const active = !local || (o.z > local.z - 30 && o.z < local.z + 300); visual.root.setEnabled(active);
        if (!active || !visual.bars.length) continue;
        const boxes = obstacleBoxes(o, raceSeconds);
        for (let i = 0; i < boxes.length; i++) {
          this.boxPose(visual.bars[i], boxes[i]);
          for (let j = 0; j < 2; j++) {
            const box = boxes[i], collar = visual.collars[i * 2 + j], vertical = i < 2;
            collar.scaling.set(box.half[0] * 2 * (vertical ? 1.22 : .09), box.half[1] * 2 * (vertical ? .07 : 1.22), box.half[2] * 2 * 1.25);
            const sign = j ? 1 : -1, offsetX = vertical ? 0 : box.half[0] * .82 * sign, offsetY = vertical ? box.half[1] * .82 * sign : 0;
            const a = box.angle ?? 0;
            collar.position.set(box.center[0] + offsetX * Math.cos(a) - offsetY * Math.sin(a), box.center[1] + offsetX * Math.sin(a) + offsetY * Math.cos(a), box.center[2]);
            collar.rotation.z = a;
          }
        }
      }
      const seen = new Set<string>();
      for (const p of players) {
        seen.add(p.playerId); let bird = this.birds.get(p.playerId);
        if (!bird) { bird = this.bird(p.playerId, p.color); bird.root.scaling.setAll(.43); this.birds.set(p.playerId, bird); }
        bird.root.setEnabled(p.status !== 'dnf' && p.status !== 'crashed'); bird.root.position.set(p.x, p.y, p.z);
        this.animateBird(bird, seconds, .25 + Math.max(0, p.vy) * .035, -p.vx * .055, -p.vy * .025);
        const overlap = local && p.playerId !== localId && Math.abs(p.z - local.z) < 5 && Math.abs(p.x - local.x) < 1.4 && Math.abs(p.y - local.y) < 1.4;
        for (const mesh of bird.meshes) mesh.visibility = overlap ? .28 : 1;
      }
      for (const [id, bird] of this.birds) if (!seen.has(id)) { bird.root.dispose(false, false); bird.material?.dispose(); this.birds.delete(id); }
    }
    for (const puff of this.puffs) if (puff.life > 0) {
      puff.life -= dt; puff.vy -= dt * 6; puff.mesh.position.addInPlaceFromFloats(puff.vx * dt, puff.vy * dt, puff.vz * dt);
      puff.mesh.scaling.setAll(Math.max(.001, puff.life * .65)); if (puff.life <= 0) puff.mesh.setEnabled(false);
    }
    if (this.settings.quality === 'auto' && now - this.lastQualityCheck > 3000) {
      this.lastQualityCheck = now; const fps = this.engine.getFps();
      if (fps < 48 && this.resolution < 1.8) { this.resolution *= 1.12; this.resize(); }
      else if (fps > 68 && this.resolution > 1.02) { this.resolution /= 1.08; this.resize(); }
    }
    presentFrame(this.engine, this.scene);
  }
  private boxPose(mesh: InstancedMesh, box: Box) { mesh.position.set(...box.center); mesh.scaling.set(box.half[0] * 2, box.half[1] * 2, box.half[2] * 2); mesh.rotation.z = box.angle ?? 0; }
  get stats() { return { mode: this.mode, courseId: this.course?.id, fps: Math.round(this.engine.getFps()), meshes: this.scene.getActiveMeshes().length, drawCalls: this.instrumentation.drawCallsCounter.current, triangles: this.scene.getActiveIndices() / 3, vertices: this.scene.getTotalVertices(), renderer: this.renderer, width: this.engine.getRenderWidth(), height: this.engine.getRenderHeight() }; }
}
