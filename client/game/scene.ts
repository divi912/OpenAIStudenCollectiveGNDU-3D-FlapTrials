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
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import '@babylonjs/core/Meshes/instancedMesh.js';
import '@babylonjs/loaders/glTF/index.js';
import { apertureVertices, isGate, obstacleBoxes, obstaclePose } from '../../shared/courses';
import type { Box, CourseDefinition, ObstacleDefinition, PlayerSnapshot, RacerState } from '../../shared/protocol';
import type { Preferences } from '../storage';
import { presentFrame } from './frame';
import { Audience } from './audience';
import { gateShell } from './gate-shell';
import { ringData } from './ring';
import { sphereData } from './sphere';
import { surfaceMap, type Finish } from './surfaces';
import { garden, sceneryChunk, THEMES } from './scenery';
import { partyEvent } from '../../shared/party';
import { frameAt, trackToWorld, bodyRoll } from '../../shared/track';

interface BirdVisual { root: TransformNode; wings: TransformNode[]; beak?: TransformNode; material?: PBRMaterial; meshes: AbstractMesh[]; shield: InstancedMesh }
interface ObstacleVisual { definition: ObstacleDefinition; root: TransformNode; gem?: InstancedMesh }
const c3 = (hex: string) => Color3.FromHexString(hex);
const temp = new Vector3();

export class GameScene {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  renderer = 'WebGL2';
  engine: AbstractEngine;
  ready = false;
  private audience?: Audience;
  private birdAsset?: AssetContainer;
  private birdLod?: AssetContainer;
  private kitAsset?: AssetContainer;
  private prototype = new Map<string, Mesh>();
  private materials = new Map<string, StandardMaterial>();
  private surfaces = new Map<Finish, ReturnType<typeof surfaceMap>>();
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
  private decorRotors: TransformNode[] = [];
  private skyMesh!: Mesh;
  private skyTexture!: DynamicTexture;
  private sunMesh!: InstancedMesh;
  private streaks: InstancedMesh[] = [];
  private settings: Preferences;
  private instrumentation: SceneInstrumentation;
  private puffs: { mesh: InstancedMesh; vx: number; vy: number; vz: number; life: number; feather: boolean }[] = [];

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
    const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene); sky.intensity = .72; sky.groundColor = c3('#647487');
    const sun = new DirectionalLight('sun', new Vector3(-.5, -.8, .6), scene); sun.intensity = 1.35; sun.diffuse = c3('#fff0cf');
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = 1;
    scene.imageProcessingConfiguration.exposure = 1.1;
    scene.imageProcessingConfiguration.contrast = 1.12;
    this.menuRoot = new TransformNode('menu-world', scene);
    this.skyTexture = new DynamicTexture('painted-sky', { width: 4, height: 256 }, scene, false);
    this.skyTexture.wrapU = this.skyTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const skyMat = new StandardMaterial('sky-gradient', scene); skyMat.disableLighting = true; skyMat.emissiveTexture = this.skyTexture; skyMat.backFaceCulling = false; skyMat.disableDepthWrite = true;
    this.skyMesh = CreateSphere('sky-dome', { diameter: 900, segments: 16 }, scene); this.skyMesh.material = skyMat; this.skyMesh.infiniteDistance = true; this.skyMesh.applyFog = false; this.skyMesh.isPickable = false; this.skyMesh.setEnabled(false);
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  private async load(): Promise<void> {
    const [bird, kit, lod, audience, audienceLod] = await Promise.all([
      LoadAssetContainerAsync('/models/bird.glb', this.scene),
      LoadAssetContainerAsync('/models/obstacle-kit.glb', this.scene),
      LoadAssetContainerAsync('/models/bird-lod.glb', this.scene),
      LoadAssetContainerAsync('/models/audience.glb', this.scene),
      LoadAssetContainerAsync('/models/audience-lod.glb', this.scene),
    ]);
    this.birdAsset = bird; this.kitAsset = kit; this.birdLod = lod;
    this.audience = new Audience(audience.meshes.find(m => m.getTotalVertices() > 0) as Mesh, audienceLod.meshes.find(m => m.getTotalVertices() > 0) as Mesh);
    this.buildMenu();
    this.sunMesh = this.instance('sun', '#fff1cc', this.menuRoot); this.sunMesh.parent = null; this.sunMesh.infiniteDistance = true; this.sunMesh.applyFog = false; this.sunMesh.setEnabled(false);
    this.sunMesh.scaling.set(24, 24, 24); this.sunMesh.position.set(-100, 90, 260);
    for (let i = 0; i < 24; i++) { const line = this.instance('rod', '#e0f7e8', this.menuRoot); line.parent = null; line.setEnabled(false); this.streaks.push(line); }
    for (let i = 0; i < 16; i++) {
      const mesh = this.instance(i % 2 ? 'leaf' : 'star', ['#ffcf6d', '#fff1cc', '#e9a291'][i % 3], this.scene.transformNodes[0] ?? this.menuRoot);
      mesh.parent = null; mesh.setEnabled(false);
      this.puffs.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, feather: !!(i % 2) });
    }
    this.ready = true;
  }
  private mat(color: string, shiny = true, finish?: Finish): StandardMaterial {
    const key = `${color}-${shiny}-${finish ?? 'plain'}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new StandardMaterial(key, this.scene); mat.diffuseColor = c3(color);
      mat.emissiveColor = c3(color).scale(.06);
      mat.specularColor = shiny ? new Color3(.45, .45, .4) : Color3.Black(); mat.specularPower = shiny ? 48 : 8;
      if (['#ffcf6d', '#8ce4ed', '#fff1cc', '#e0f7e8'].includes(color)) mat.emissiveColor = c3(color).scale(.65);
      if (key.startsWith('#fff') && !shiny) mat.emissiveColor = c3(color).scale(.18);
      if (finish) {
        let maps = this.surfaces.get(finish);
        if (!maps) { maps = surfaceMap(this.scene, finish); this.surfaces.set(finish, maps); }
        mat.diffuseTexture = maps.diffuse; mat.bumpTexture = maps.normal;
      }
      this.materials.set(key, mat);
    }
    return mat;
  }
  private source(kind: string, color: string): Mesh {
    const key = `${kind}:${color}`; let mesh = this.prototype.get(key);
    if (!mesh) {
      if (kind === 'cloud' || kind === 'leaf') { mesh = new Mesh(key, this.scene); sphereData(kind === 'cloud' ? 32 : 16, kind === 'cloud' ? 16 : 8).applyToMesh(mesh); }
      else if (kind === 'bubble' || kind === 'sun') mesh = CreateSphere(key, { diameter: 1, segments: 24 }, this.scene);
      else if (kind === 'rock') mesh = CreateSphere(key, { diameter: 1, segments: 8 }, this.scene);
      else if (kind === 'banner') mesh = CreatePlane(key, { size: 1 }, this.scene);
      else if (kind === 'gem') mesh = CreatePolyhedron(key, { type: 1, size: 1 }, this.scene);
      else if (kind === 'star') {
        mesh = new Mesh(key, this.scene); const data = new VertexData();
        data.positions = [0, 0, 0]; data.normals = [0, 0, -1]; data.indices = [];
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? .43 : 1; data.positions.push(Math.sin(a) * r, Math.cos(a) * r, 0); data.normals.push(0, 0, -1); data.indices.push(0, i + 1, (i + 1) % 10 + 1); }
        data.applyToMesh(mesh); this.mat(color, false).backFaceCulling = false;
      }
      else if (kind === 'hoop') { mesh = new Mesh(key, this.scene); ringData().applyToMesh(mesh); }
      else if (kind === 'island') mesh = CreateCylinder(key, { height: 1, diameterTop: 2, diameterBottom: 1.1, tessellation: 48 }, this.scene);
      else if (kind === 'cone' || kind === 'peak' || kind === 'grass') mesh = CreateCylinder(key, { height: 1, diameterTop: kind === 'cone' ? .3 : 0, diameterBottom: 1, tessellation: kind === 'peak' ? 9 : 8 }, this.scene);
      else if (kind === 'rod') mesh = CreateCylinder(key, { height: 1, diameter: 1, tessellation: 20 }, this.scene);
      else if (kind === 'panel') { mesh = (this.kitAsset!.meshes.find(m => m.name === 'RoundedPanel') as Mesh).clone(key, null, true)!; mesh.parent = null; mesh.position.setAll(0); mesh.rotationQuaternion = null; mesh.scaling.setAll(1); }
      else if (kind === 'gear') { mesh = (this.kitAsset!.meshes.find(m => m.name === 'Gear') as Mesh).clone(key, null, true)!; mesh.parent = null; mesh.position.setAll(0); mesh.rotationQuaternion = null; }
      else if (kind === 'pipe') {
        const template = this.kitAsset?.meshes.find(m => m.name === 'PipeStraight') as Mesh | undefined;
        if (template) {
          mesh = template.clone(key, null, true)!; mesh.parent = null; mesh.makeGeometryUnique();
          mesh.bakeTransformIntoVertices(Matrix.Compose(new Vector3(1 / .9, 1 / .9, .5), Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2), Vector3.Zero()));
          mesh.position.setAll(0); mesh.scaling.setAll(1); mesh.rotationQuaternion = null; mesh.rotation.setAll(0);
        } else mesh = CreateCylinder(key, { height: 1, diameter: 1, tessellation: 16 }, this.scene);
      }
      else mesh = CreateBox(key, { size: 1 }, this.scene);
      mesh.material = this.mat(color, ['pipe', 'gem', 'gear', 'hoop', 'panel'].includes(kind), ['pipe', 'panel', 'gear'].includes(kind) ? 'enamel' : ['island', 'rock'].includes(kind) ? 'stone' : kind === 'leaf' ? 'foliage' : undefined); mesh.isVisible = false; mesh.isPickable = false;
      if (kind === 'banner') mesh.material = this.stadiumMaterial(kind);
      if (kind === 'sun') { const sun = new StandardMaterial('sun-disc', this.scene); sun.disableLighting = true; sun.emissiveColor = c3('#ffe5a7'); mesh.material = sun; }
      if (kind === 'bubble') {
        const bubble = new StandardMaterial('shield-bubble', this.scene); bubble.diffuseColor = c3(color); bubble.emissiveColor = c3(color).scale(.35); bubble.alpha = .16; bubble.specularPower = 100; bubble.backFaceCulling = true; mesh.material = bubble;
      }
      if (kind === 'water') { const water = this.mat(color, false); water.alpha = .6; water.emissiveColor = c3(color).scale(.18); }
      this.prototype.set(key, mesh);
    }
    return mesh;
  }
  private stadiumMaterial(kind: 'banner'): StandardMaterial {
    const texture = new DynamicTexture(`${kind}-atlas`, { width: 1024, height: 128 }, this.scene, true);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#244e50'; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#edc582'; ctx.fillRect(0, 0, 1024, 8); ctx.fillRect(0, 120, 1024, 8);
    ctx.font = 'bold 39px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff3d5'; ctx.fillText('FLAP TRIALS   ✦   THE WING CUP   ✦   MAKE SOME NOISE', 512, 79);
    texture.update(); const mat = new StandardMaterial(`${kind}-material`, this.scene);
    mat.diffuseTexture = texture; mat.specularColor = Color3.Black(); mat.emissiveTexture = texture; mat.emissiveColor = new Color3(.23, .23, .23); mat.backFaceCulling = false;
    return mat;
  }
  private instance(kind: string, color: string, parent: TransformNode, position = [0, 0, 0], scale = [1, 1, 1]): InstancedMesh {
    const mesh = this.source(kind, color).createInstance(`${kind}-instance`);
    mesh.parent = parent; mesh.position.set(position[0], position[1], position[2]); mesh.scaling.set(scale[0], scale[1], scale[2]); mesh.isPickable = false;
    return mesh;
  }
  private gateFrame(o: ObstacleDefinition, color: string, parent: TransformNode) {
    const key = `frame:${o.shape}:${o.width}:${o.height}:${o.thickness}:${o.kind === 'wall'}:${color}`;
    let source = this.prototype.get(key);
    if (!source) {
      source = new Mesh(key, this.scene);
      gateShell(apertureVertices(o), o.kind === 'wall' ? .9 : .55, o.thickness).applyToMesh(source);
      source.material = this.mat(color, true, 'enamel'); source.isVisible = false; source.isPickable = false;
      this.prototype.set(key, source);
    }
    const frame = source.createInstance('bevelled-gate-frame'); frame.parent = parent; frame.isPickable = false;
  }
  private bird(id: string, color: string, parent?: TransformNode, detailed = false): BirdVisual {
    const root = new TransformNode(`bird-${id}`, this.scene); root.parent = parent ?? null;
    const model = (id === 'hero' || detailed ? this.birdAsset! : this.birdLod!).instantiateModelsToScene(name => `${id}-${name}`, false, { doNotInstantiate: true });
    for (const node of model.rootNodes) node.parent = root;
    const meshes = root.getChildMeshes();
    let material: PBRMaterial | undefined;
    for (const mesh of meshes) {
      mesh.isPickable = false;
      if (mesh.material?.name === 'Body' || mesh.material?.name.endsWith('-Body')) {
        material ??= (mesh.material as PBRMaterial).clone(`body-${id}`)!; material.albedoColor = c3(color).toLinearSpace(); material.roughness = .48; material.emissiveColor = material.albedoColor.scale(.04);
        mesh.material = material;
      }
    }
    const nodes = root.getDescendants(false);
    const wings = nodes.filter(n => n.name.endsWith('WingL') || n.name.endsWith('WingR')) as TransformNode[];
    const beak = nodes.find(n => n.name.endsWith('BeakLower')) as TransformNode | undefined;
    for (const wing of wings) wing.rotationQuaternion = null;
    if (beak) beak.rotationQuaternion = null;
    const shield = this.instance('bubble', '#8ce4ed', root, [0, 0, 0], [2.8, 2.8, 2.8]); shield.setEnabled(false);
    return { root, meshes, wings, beak, material, shield };
  }
  private cloud(parent: TransformNode, x: number, y: number, z: number, size: number): void {
    for (const [dx, dy, dz, r] of [[0, 0, 0, 1.1], [-.7, -.15, .05, .85], [.75, -.13, .1, .8], [.1, .35, -.15, .85]]) {
      this.instance('cloud', '#fffdf2', parent, [x + dx * size, y + dy * size, z + dz * size], [r * size * 1.3, r * size, r * size]);
    }
  }
  private buildMenu(): void {
    const parent = this.menuRoot;
    garden(this.instance.bind(this), parent, 0, -.15, 0, 5.1);
    const gate = new TransformNode('hero-gate', this.scene); gate.parent = parent; gate.position.set(-.8, 3.7, -1.8);
    this.instance('hoop', '#e5b663', gate, [0, 0, 0], [3.2, 3.2, 2.8]);
    this.instance('hoop', '#73b28b', gate, [0, 0, -.2], [3.55, 3.55, 3]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.instance('leaf', '#fff0b4', gate, [Math.cos(a) * 3.35, Math.sin(a) * 3.35, .2], [.19, .19, .16]); }
    const hero = this.bird('hero', '#ffcc42', parent); hero.root.position.set(.1, 2.9, 2.6); hero.root.scaling.setAll(1.65); hero.root.rotation.y = .4;
    const blue = this.bird('blue', '#55bce7', parent); blue.root.position.set(-4, 1.5, 2); blue.root.scaling.setAll(.63); blue.root.rotation.y = .25;
    const pink = this.bird('pink', '#ed7773', parent); pink.root.position.set(3.8, 2.5, -1.2); pink.root.scaling.setAll(.56); pink.root.rotation.y = -.65;
    this.menuBirds.push(hero, blue, pink);
    this.cloud(parent, -6.5, 5.2, -1, 1.4); this.cloud(parent, 4.7, 6.2, -7, 1.3); this.cloud(parent, 3.1, 5.6, -5, .85);
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
    this.skyMesh.setEnabled(false); this.sunMesh?.setEnabled(false); for (const line of this.streaks) line.setEnabled(false);
    this.scene.clearColor.set(0, 0, 0, 0); this.scene.fogMode = Scene.FOGMODE_NONE; this.camera.fov = .64;
    this.camera.position.set(10.5, 7.7, 15.4); this.camera.setTarget(new Vector3(0, 1.6, .5));
    this.canvas.classList.remove('racing'); this.resize();
  }
  showCourse(course: CourseDefinition): void {
    this.mode = 'race'; this.menuRoot.setEnabled(false); this.canvas.classList.add('racing');
    if (this.course?.id !== course.id || !this.courseRoot) this.buildCourse(course);
    this.course = course; this.courseRoot!.setEnabled(true);
    const sky = c3(course.sky); this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    const ctx = this.skyTexture.getContext(); const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#f5ebd9'); gradient.addColorStop(.48, course.sky); gradient.addColorStop(1, ['#298dcc', '#a68e93', '#578dc6', '#806aa7', '#c16e91', '#509a9b'][course.difficultyIndex]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 256); this.skyTexture.update(); this.skyMesh.setEnabled(true); this.sunMesh.setEnabled(true);
    this.scene.fogMode = Scene.FOGMODE_LINEAR; this.scene.fogStart = 130; this.scene.fogEnd = 370; this.scene.fogColor = sky;
    this.camera.fov = 75 * Math.PI / 180; this.follow.set(0, 8, -7); this.look.set(0, 7, 20); this.resize();
  }
  private buildCourse(course: CourseDefinition): void {
    this.audience?.clear();
    this.courseRoot?.dispose(false, false); this.obstacles = []; this.chunks = []; this.decorRotors = [];
    const root = this.courseRoot = new TransformNode(`course-${course.id}`, this.scene);
    for (let z = 0; z < course.length + 200; z += 128) {
      const chunk = new TransformNode(`chunk-${z}`, this.scene); chunk.parent = root; this.chunks.push({ root: chunk, z });
      sceneryChunk(this.instance.bind(this), chunk, course, z, this.decorRotors, stand => this.audience?.add(stand, z + 48));
      for (const side of [-1, 1]) {
        this.cloud(chunk, side * 39, 29 + (z % 7), z + 60, 8);
        this.cloud(chunk, side * 70, 44, z + 10, 6);
      }
      const anchor = z + 48, f = frameAt(course, anchor);
      for (const child of chunk.getChildren()) if (child instanceof TransformNode) child.position.z -= anchor;
      chunk.position.set(...f.position); chunk.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0);
    }
    for (const o of course.obstacles) {
      const group = new TransformNode(o.id, this.scene); group.parent = root;
      let gem: InstancedMesh | undefined;
      group.position.set(o.x, o.y, o.z);
      if (o.kind === 'pickup') {
        const color = o.powerUp === 'boost' ? '#ffcf6d' : '#8ce4ed';
        gem = this.instance('gem', color, group, [0, 0, 0], [.55, .75, .55]);
        this.instance('hoop', color, group, [0, 0, 0], [1.3, 1.3, 1.3]);
        for (let j = 0; j < 4; j++) this.instance('leaf', '#fff1cc', group, [Math.sin(j * Math.PI / 2) * 1.3, Math.cos(j * Math.PI / 2) * 1.3, 0], [.12, .12, .12]);
      } else if (o.kind === 'gust' || o.kind === 'speed_zone') {
        for (let i = 0; i < 4; i++) {
          this.instance('hoop', o.kind === 'gust' ? '#8ce4ed' : '#ffcf6d', group, [0, 0, -5 + i * 3], [o.width / 2, o.height / 2, 1]);
        }
        for (let i = 0; i < 3; i++) {
          const line = this.instance('rod', o.kind === 'gust' ? '#8ce4ed' : '#ffcf6d', group, [-2 + i * 1.5, 1, 0], [.1, 1.4, .1]); line.rotation.z = o.kind === 'gust' ? 1.3 : -.7;
        }
      } else {
        const color = o.kind === 'twist_gate' ? '#df9a83' : o.kind === 'rotating_gate' ? '#a28abd' : o.kind === 'shutter' ? '#d6a465' : THEMES[course.difficultyIndex].leaf;
        this.gateFrame(o, color, group);
        const local = { ...o, kind: o.kind === 'wall' ? 'wall' as const : 'ring' as const, x: 0, y: 0, z: 0, tilt: 0 };
        for (const box of obstacleBoxes(local, 0)) {
          const trim = this.instance('rod', '#ffcf6d', group, [box.center[0], box.center[1], -o.thickness / 2 - .02], [.065, box.half[0] * 2, .065]); trim.rotation.z = box.angle! - Math.PI / 2;
        }
        const points = apertureVertices(o);
        for (let i = 0; i < points.length; i += points.length > 8 ? 8 : 1) {
          const [x, y] = points[i];
          this.instance('leaf', '#f7dfaa', group, [x * 1.06, y * 1.06, -.1], [.25, .25, o.thickness + .16]);
          this.instance('leaf', '#696f69', group, [x * 1.06, y * 1.06, -o.thickness / 2 - .13], [.10, .10, .07]);
          const badge = this.instance('panel', '#fff1cc', group, [x * 1.08, y * 1.08, -o.thickness / 2 - .06], [.22, .12, .07]); badge.rotation.z = Math.atan2(y, x);
        }
        if (o.kind === 'rotating_gate') {
          for (const side of [-1, 1]) {
            const gear = this.instance('gear', '#e8c285', group, [side * (o.width / 2 + 1.9), 0, .1], [.8, .8, .8]); this.decorRotors.push(gear);
          }
        }
        // A visible direction marker sits above, outside the opening.
        for (const side of [-1, 1]) { const chevron = this.instance('rod', '#fff1cc', group, [side * .24, o.height / 2 + 1.3, 0], [.1, .7, .1]); chevron.rotation.z = side * .7; }
        if (o.kind === 'twist_gate') {
          for (const side of [-1, 1]) {
            const arrow = this.instance('hoop', '#8ce4ed', group, [side * 1.6, 0, -.5], [.55, .55, .6]);
            this.instance('star', '#ffcf6d', group, [side * 1.6, .55, -.51], [.16, .16, .16]); arrow.rotation.z = side * .5;
          }
        }
      }
      this.obstacles.push({ definition: o, root: group, gem });
    }
    for (let i = 0; i <= course.checkpoints.length; i++) {
      const cp = course.checkpoints[i]; const z = cp?.z ?? course.length;
      const group = new TransformNode(`checkpoint-${i}`, this.scene); group.parent = root;
      for (const side of [-1, 1]) {
        this.instance('pipe', cp ? '#f4d578' : '#eee8d4', group, [side * 11, 6, z], [.25, 16, .25]);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) this.instance('box', cp ? ((row + col) % 2 ? '#fff1c1' : '#e7c464') : ((row + col) % 2 ? '#fff5df' : '#355849'), group, [side * 11 + (col + .5) * .5 * -side, 13 - row * .5, z], [.5, .5, .1]);
      }
      this.instance('box', cp ? '#ecd27d' : '#f5f0df', group, [0, 14.5, z], [22, .3, .25]);
      const f = frameAt(course, z); for (const child of group.getChildren()) if (child instanceof TransformNode) child.position.z -= z;
      group.position.set(...f.position); group.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0);
    }
  }
  crash(position: RacerState): void {
    const origin = this.course ? trackToWorld(this.course, position.x, position.y, position.z) : [position.x, position.y, position.z] as [number, number, number];
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i], a = i * 2.399;
      p.mesh.setEnabled(!this.settings.reducedMotion || i < 6); p.mesh.position.set(...origin);
      p.vx = Math.cos(a) * (2 + i % 3); p.vy = 1.5 + (i % 4); p.vz = Math.sin(a) * 3; p.life = this.settings.reducedMotion ? .3 : .7;
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
        const behind = this.course?.obstacles.find(o => o.z < local.z && local.z - o.z < 8 && isGate(o));
        if (behind) distance = Math.max(3, local.z - behind.z - .7);
        const cameraY = this.settings.reducedMotion ? local.y + Math.max(-1.2, Math.min(1.2, (6.5 - local.y) * .65)) : local.y;
        temp.set(...trackToWorld(this.course!, local.x * .8, cameraY + 2.1, local.z - distance));
        const snap = Vector3.Distance(this.camera.position, temp) > 25;
        if (snap) this.follow.copyFrom(temp); else Vector3.LerpToRef(this.follow, temp, 1 - Math.exp(-dt * 12), this.follow);
        temp.set(...trackToWorld(this.course!, local.x * .6, cameraY + .45, local.z + 22));
        Vector3.LerpToRef(this.look, temp, snap ? 1 : 1 - Math.exp(-dt * 9), this.look);
        this.camera.position.copyFrom(this.follow); this.camera.setTarget(this.look);
        this.audience?.update(local.z, this.settings.quality === 'low', this.settings.quality === 'auto' && this.resolution > 1.15);
        for (const chunk of this.chunks) chunk.root.setEnabled(chunk.z > local.z - 200 && chunk.z < local.z + 330);
        const boosted = local.simulationTick < local.boostUntilTick || local.speed > 23;
        const targetFov = (boosted && !this.settings.reducedMotion ? 81 : 75) * Math.PI / 180;
        this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 3));
        for (let i = 0; i < this.streaks.length; i++) {
          const line = this.streaks[i]; line.setEnabled(boosted && !this.settings.reducedMotion);
          if (boosted) { const a = i * 2.399, f = frameAt(this.course!, local.z); line.position.set(...trackToWorld(this.course!, local.x + Math.cos(a) * (2.3 + i % 3), local.y + Math.sin(a) * (2.3 + i % 3), local.z + 10 - ((seconds * 35 + i * 3) % 23))); line.scaling.set(.015, 1.7, .015); line.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, Math.PI / 2 - f.pitch, 0); }
        }
      }
      for (let i = 0; i < this.decorRotors.length; i++) this.decorRotors[i].rotation.z = seconds * (i % 2 ? -.45 : .45);
      for (const visual of this.obstacles) {
        const o = visual.definition;
        const collected = o.kind === 'pickup' && local && !!(local.pickupMask & (1 << o.pickupIndex!));
        const active = !collected && (!local || (o.z > local.z - 30 && o.z < local.z + 300)); visual.root.setEnabled(active);
        if (!active) continue;
        const pose = obstaclePose(o, raceSeconds), f = frameAt(this.course!, o.z); visual.root.position.set(...trackToWorld(this.course!, pose.x, pose.y, o.z)); visual.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, pose.angle);
        if (visual.gem) { visual.gem.rotation.y = seconds * 1.8; visual.gem.position.y = Math.sin(seconds * 2.5 + o.z) * .17; }
      }
      const seen = new Set<string>();
      for (const p of players) {
        seen.add(p.playerId); let bird = this.birds.get(p.playerId);
        if (!bird) { bird = this.bird(p.playerId, p.color, undefined, p.playerId === localId); bird.root.scaling.setAll(.43); this.birds.set(p.playerId, bird); }
        bird.root.setEnabled(p.status !== 'dnf' && p.status !== 'crashed'); bird.root.position.set(...trackToWorld(this.course!, p.x, p.y, p.z));
        this.animateBird(bird, seconds, .25 + Math.max(0, p.vy) * .035, -p.vx * .055, -p.vy * .025);
        const f = frameAt(this.course!, p.z);
        bird.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(f.yaw, -f.pitch, 0).multiply(Quaternion.RotationYawPitchRoll(p.heading, -p.pitch, bodyRoll(p.heading, p.roll)));
        bird.shield.setEnabled(p.simulationTick < p.shieldUntilTick);
        const overlap = local && p.playerId !== localId && Math.abs(p.z - local.z) < 5 && Math.abs(p.x - local.x) < 1.4 && Math.abs(p.y - local.y) < 1.4;
        for (const mesh of bird.meshes) mesh.visibility = overlap ? .28 : 1;
      }
      for (const [id, bird] of this.birds) if (!seen.has(id)) { bird.root.dispose(false, false); bird.material?.dispose(); this.birds.delete(id); }
    }
    for (const puff of this.puffs) if (puff.life > 0) {
      puff.life -= dt; puff.vy -= dt * 6; puff.mesh.position.addInPlaceFromFloats(puff.vx * dt, puff.vy * dt, puff.vz * dt);
      const size = Math.max(.001, puff.life); puff.mesh.scaling.set(size * .6, size * (puff.feather ? 1.4 : .6), puff.feather ? size * .16 : .05);
      if (!this.settings.reducedMotion) puff.mesh.rotation.z += dt * 6;
      if (puff.life <= 0) puff.mesh.setEnabled(false);
    }
    if (this.settings.quality === 'auto' && now - this.lastQualityCheck > 3000) {
      this.lastQualityCheck = now; const fps = this.engine.getFps();
      if (fps < 48 && this.resolution < 1.8) { this.resolution *= 1.12; this.resize(); }
      else if (fps > 68 && this.resolution > 1.02) { this.resolution /= 1.08; this.resize(); }
    }
    presentFrame(this.engine, this.scene);
  }
  private boxPose(mesh: InstancedMesh, box: Box) { mesh.position.set(...box.center); mesh.scaling.set(box.half[0] * 2, box.half[1] * 2, box.half[2] * 2); mesh.rotation.z = box.angle ?? 0; }
  gateMarker(player: RacerState, seconds: number): { x: number; y: number } | undefined {
    if (!this.course) return;
    const gate = this.course.obstacles.find(o => isGate(o) && o.z > player.z + 1);
    if (!gate || gate.z - player.z > 160) return;
    const pose = obstaclePose(gate, seconds), world = Vector3.FromArray(trackToWorld(this.course, pose.x, pose.y, gate.z));
    const width = this.engine.getRenderWidth(), height = this.engine.getRenderHeight();
    const point = Vector3.Project(world, Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(width, height));
    const x = point.x / width * 100, y = point.y / height * 100;
    if (point.z > 0 && point.z < 1 && x > 24 && x < 76 && y > 25 && y < 70) return { x, y };
  }
  get stats() { return { audience: this.audience?.stats, mode: this.mode, courseId: this.course?.id, fps: Math.round(this.engine.getFps()), meshes: this.scene.getActiveMeshes().length, drawCalls: this.instrumentation.drawCallsCounter.current, triangles: this.scene.getActiveIndices() / 3, vertices: this.scene.getTotalVertices(), renderer: this.renderer, width: this.engine.getRenderWidth(), height: this.engine.getRenderHeight() }; }
}
