import { readFileSync, statSync } from 'node:fs';
for (const name of ['bird', 'obstacle-kit']) {
  const file = `public/models/${name}.glb`; const bytes = readFileSync(file);
  if (bytes.toString('utf8', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Malformed GLB: ${file}`);
  const jsonSize = bytes.readUInt32LE(12); const doc = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize));
  const triangles = doc.meshes.reduce((n, m) => n + m.primitives.reduce((s, p) => s + (p.indices === undefined ? doc.accessors[p.attributes.POSITION].count : doc.accessors[p.indices].count) / 3, 0), 0);
  if (bytes.length > 2_000_000 || triangles > 20000) throw new Error(`Asset budget exceeded: ${name}`);
  for (const required of name === 'bird' ? ['Body', 'Details', 'WingL', 'WingR', 'BeakLower'] : ['PipeStraight', 'PipeCollar', 'RingModule', 'Gear']) if (!doc.nodes.some(n => n.name === required)) throw new Error(`Missing ${required}`);
  console.log(`${name}: ${Math.round(bytes.length / 1024)} KB, ${triangles} triangles, ${doc.meshes.length} meshes; editable source ${Math.round(statSync(`assets/source/${name}.blend`).size / 1024)} KB`);
}
