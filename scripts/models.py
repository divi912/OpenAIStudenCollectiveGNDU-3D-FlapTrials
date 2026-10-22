"""Reproducible toy-bird and obstacle-kit modeling. No external libraries/add-ons."""
import bpy, math, os
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.materials): bpy.data.materials.remove(data)

def material(name, color, roughness=.38):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = roughness
    return m

def ball(name, location, scale, mat, segments=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in o.data.polygons: p.use_smooth=True
    o.data.materials.append(mat); return o

def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    return o

def pivot(obj, xyz):
    bpy.context.scene.cursor.location=xyz
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

def export(name):
    # Author in game coordinates (+Y up, +Z forward), convert to Blender's +Z up.
    conversion = Matrix.Rotation(math.pi/2, 4, 'X')
    for o in list(bpy.context.scene.objects):
        o.matrix_world = conversion @ o.matrix_world
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','source',name+'.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models',name+'.glb'), export_format='GLB', export_yup=True, export_animations=False)

reset()
body=material('Body', (1,.66,.055)); face=material('Palette', (1,1,1), .32)
colors=[(1,.86,.40,1), (1,1,1,1), (.035,.055,.075,1), (1,.35,.045,1), (.83,.22,.025,1), (.97,.79,.16,1), (.95,.95,.87,1), (.3,.55,.5,1)]
image=bpy.data.images.new('BirdPalette', width=32, height=4)
image.pixels=[v for y in range(4) for x in range(32) for v in colors[x//4]]; image.pack()
tex=face.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image; tex.interpolation='Closest'
face.node_tree.links.new(tex.outputs['Color'], face.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
def detail(name, loc, size, index):
    o=ball(name,loc,size,face,12,8)
    for loop in o.data.uv_layers.active.data: loop.uv=((index+.5)/8,.5)
    return o

parts=[ball('RoundBody',(0,0,0),(.87,1.05,.72),body),ball('StubbyTail',(0,-.40,-.72),(.38,.28,.36),body),ball('TopFeather',(0,.99,-.08),(.15,.39,.13),body,12,8),ball('SideFeather',(.17,1.03,-.08),(.12,.27,.11),body,12,8)]
bird=join(parts,'Body'); pivot(bird,(0,0,0))
details=[detail('Belly',(0,-.29,.56),(.63,.61,.19),0)]
for x in [-.35,.35]:
    details += [detail('Eye',(x,.45,.61),(.32,.37,.22),1),detail('Pupil',(x+.045,.46,.81),(.135,.16,.07),2), detail('EyeSpark',(x+.015,.52,.87),(.039,.046,.018),1)]
for x in [-.31,.31]: details.append(detail('Foot',(x,-1.01,.13),(.24,.105,.32),4))
details.append(detail('BeakTop',(0,.045,.82),(.27,.15,.31),3))
faceobj=join(details,'Details'); pivot(faceobj,(0,0,0))
lower=detail('BeakLower',(0,-.10,.82),(.23,.085,.25),4); pivot(lower,(0,-.05,.62))
for side, name in [(-1,'WingL'),(1,'WingR')]:
    wing=ball(name,(side*.90,-.16,-.02),(.28,.56,.20),body,12,8)
    wing.rotation_euler[2]=side*.27
    bpy.context.view_layer.objects.active=wing; bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    pivot(wing,(side*.70,.15,0))
export('bird')

reset()
green=material('PipeGreen',(.14,.57,.29)); rim=material('PipeRim',(.34,.78,.43)); metal=material('WarmMetal',(.92,.75,.40)); purple=material('GearLilac',(.58,.42,.72))
def tube(name, inner, outer, length, mat, axis='Z', segments=20):
    verts=[]; faces=[]
    for z,r in [(-length/2,outer),(length/2,outer),(-length/2,inner),(length/2,inner)]:
        for i in range(segments):
            a=i*2*math.pi/segments; verts.append((r*math.cos(a),r*math.sin(a),z))
    for i in range(segments):
        j=(i+1)%segments
        faces.extend([(i,j,segments+j,segments+i),(2*segments+i,3*segments+i,3*segments+j,2*segments+j),(i,2*segments+i,2*segments+j,j),(segments+i,segments+j,3*segments+j,3*segments+i)])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    for p in mesh.polygons: p.use_smooth=True
    return o

tube('PipeStraight',.32,.45,2,green)
tube('PipeCollar',.31,.54,.20,rim)
tube('RingModule',2.5,2.9,.45,metal,segments=40)
gear=tube('Gear',.42,1.2,.28,purple,segments=24)
teeth=[gear]
for i in range(12):
    a=i*math.pi/6
    bpy.ops.mesh.primitive_cube_add(size=1,location=(math.cos(a)*1.22,math.sin(a)*1.22,0))
    o=bpy.context.object; o.scale=(.35,.28,.28); o.rotation_euler[2]=a; o.data.materials.append(purple); teeth.append(o)
join(teeth,'Gear')
export('obstacle-kit')
print('Bird and modular props exported successfully')
