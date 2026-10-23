"""Small, solid stadium birds: a single vertex-coloured mesh per LOD, no textures."""
import bpy, math, os
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def build(name, low):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    material = bpy.data.materials.new(name); material.use_nodes = True
    nodes = material.node_tree.nodes
    color = nodes.new('ShaderNodeVertexColor'); color.layer_name = 'Plumage'
    material.node_tree.links.new(color.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    nodes.get('Principled BSDF').inputs['Roughness'].default_value = .9
    parts = []
    def paint(obj, rgb):
        obj.data.materials.append(material)
        attr = obj.data.color_attributes.new(name='Plumage', type='BYTE_COLOR', domain='CORNER')
        for c in attr.data: c.color = (*rgb, 1)
        for p in obj.data.polygons: p.use_smooth = True
        parts.append(obj); return obj
    def egg(loc, scale, rgb, segments=12, rings=8):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
        obj = bpy.context.object; obj.scale = scale
        return paint(obj, rgb)
    def diamond(loc, scale, rgb):
        if low: bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
        else: bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=1, location=loc)
        obj=bpy.context.object; obj.scale=scale
        return paint(obj,rgb)
    # +Y up / +Z toward the race. Distinct belly, folded wings, eye whites and a beak.
    egg((0,.52,0),(.46,.57,.35),(1,.90,.64), 10 if low else 20, 6 if low else 12)
    egg((0,.42,.25),(.30,.34,.12),(1,.97,.84),8 if low else 12,4 if low else 8)
    for side in [-1,1]:
        wing=diamond((side*.40,.47,-.04),(.13,.33,.27),(.54,.71,.61))
        wing.rotation_euler[0]=side*.14
        # Icosahedra keep the face recognizable even in the distant LOD.
        diamond((side*.16,.76,.31),(.145,.17,.09),(1,1,.96))
        diamond((side*.16,.77,.39),(.064,.083,.035),(.025,.045,.05))
        if not low: diamond((side*.19,.025,.13),(.13,.055,.18),(.96,.43,.10))
        if not low:
            egg((side*.145,.80,.42),(.025,.03,.014),(1,1,1),8,4)
            for j in range(3):
                egg((side*(.43+j*.025),.50-j*.12,-.13),(.07,.16,.09),(.47,.64,.53),8,4)
    # Four-sided beak, splayed tail and crest are actual solid geometry.
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=.13, radius2=0, depth=.30, location=(0,.56,.44), rotation=(math.pi/2,0,0))
    paint(bpy.context.object,(1,.42,.075))
    diamond((0,.20,-.38),(.28,.10,.29),(.54,.71,.61))
    diamond((.02,1.09,-.06),(.09,.18,.075),(1,.73,.38))
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts: part.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
    obj=bpy.context.object; obj.name='AudienceBird'
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.matrix_world=Matrix.Rotation(math.pi/2,4,'X') @ obj.matrix_world
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/source',name+'.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',name+'.glb'),export_format='GLB',export_yup=True,export_animations=False,export_texcoords=False,export_materials='EXPORT',export_vertex_color='MATERIAL',export_all_vertex_colors=True)

build('audience',False)
build('audience-lod',True)
