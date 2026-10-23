import { readFileSync, statSync } from 'node:fs';
for (const name of ['bird', 'bird-lod', 'obstacle-kit', 'audience', 'audience-lod']) {
  const file = `public/models/${name}.glb`; const bytes = readFileSync(file);
  if (bytes.toString('utf8', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Malformed GLB: ${file}`);
  const jsonSize = bytes.readUInt32LE(12); const doc = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize));
  const triangles = doc.meshes.reduce((n, m) => n + m.primitives.reduce((s, p) => s + (p.indices === undefined ? doc.accessors[p.attributes.POSITION].count : doc.accessors[p.indices].count) / 3, 0), 0);
  if (bytes.length > 2_000_000 || triangles > 60000) throw new Error(`Asset budget exceeded: ${name}`);
  for (const required of name.startsWith('bird') ? ['Body', 'Details', 'WingL', 'WingR', 'BeakLower'] : name.startsWith('audience') ? ['AudienceBird'] : ['PipeStraight', 'PipeCollar', 'RingModule', 'Gear']) if (!doc.nodes.some(n => n.name === required)) throw new Error(`Missing ${required}`);
  if (name === 'bird-lod' && triangles > 15000) throw new Error('Bird LOD budget exceeded');
  if (name.startsWith('audience')) {
    const primitives = doc.meshes.flatMap(m => m.primitives);
    if (primitives.length !== 1 || doc.images?.length || !primitives[0].attributes.COLOR_0) throw new Error('Audience must have one vertex-coloured primitive and no textures');
    if (bytes.length > 100000 || triangles > (name.endsWith('-lod') ? 500 : 2400)) throw new Error('Audience budget exceeded');
  }
  console.log(`${name}: ${Math.round(bytes.length / 1024)} KB, ${triangles} triangles, ${doc.meshes.length} meshes; editable source ${Math.round(statSync(`assets/source/${name}.blend`).size / 1024)} KB`);
}
