from pathlib import Path
import xml.etree.ElementTree as ET

SVG_PATH = Path('samples/Untitled Diagram.drawio (2).svg')
text = SVG_PATH.read_text(encoding='utf-8')
root = ET.fromstring(text)

SHAPE_TAGS = {'rect','circle','ellipse','polygon','path','line','polyline'}
NODE_SHAPE_TAGS = {'rect','circle','ellipse','polygon','path'}
EDGE_SHAPE_TAGS = {'path','line','polyline'}

# build parent map
parent_map = {c: p for p in root.iter() for c in list(p)}

def strip_tag(tag):
    return tag.split('}')[-1]

groups = [el for el in root.iter() if strip_tag(el.tag) == 'g']
print('total groups:', len(groups))

nodes = []
edges = []

def has_fill(el):
    fill = (el.get('fill') or el.get('style') or '').lower()
    if 'fill:' in fill:
        # crude parse
        try:
            for part in fill.split(';'):
                if part.strip().startswith('fill:'):
                    val = part.split(':',1)[1].strip()
                    return val != 'none' and val != ''
        except:
            pass
    return (el.get('fill') or '').lower() not in ('none','')

def has_stroke(el):
    stroke = (el.get('stroke') or el.get('style') or '').lower()
    if 'stroke:' in stroke:
        try:
            for part in stroke.split(';'):
                if part.strip().startswith('stroke:'):
                    val = part.split(':',1)[1].strip()
                    return val != 'none' and val != ''
        except:
            pass
    return (el.get('stroke') or '').lower() not in ('none','')

# helper to find ancestor stable group
def ancestor_has_stable(g):
    p = parent_map.get(g)
    while p is not None:
        if strip_tag(p.tag) == 'g' and (p.get('data-cell-id') or p.get('data-node-id')):
            return True
        p = parent_map.get(p)
    return False

for g in groups:
    has_stable = bool(g.get('data-cell-id') or g.get('data-node-id') or g.get('id'))
    direct_shapes = [c for c in list(g) if strip_tag(c.tag) in SHAPE_TAGS]
    is_nested_stable = ancestor_has_stable(g)
    if is_nested_stable and not has_stable and len(direct_shapes) == 0:
        continue
    shapeEls = [c for c in g.iter() if strip_tag(c.tag) in SHAPE_TAGS]
    if not shapeEls:
        continue
    # pick filled shapes
    filled = [s for s in shapeEls if strip_tag(s.tag) in NODE_SHAPE_TAGS and has_fill(s)]
    edge_candidates = [s for s in shapeEls if strip_tag(s.tag) in EDGE_SHAPE_TAGS and has_stroke(s) and (s.get('fill') in (None,'none') or 'fill:none' in (s.get('style') or ''))]
    if filled:
        nodes.append((g.get('data-cell-id'), len(filled)))
        continue
    if edge_candidates:
        edges.append((g.get('data-cell-id'), len(edge_candidates)))
        continue

# loose shapes not in <g>
loose = [s for s in root.iter() if strip_tag(s.tag) in SHAPE_TAGS and strip_tag(s.tag) != 'g' and not any(parent_map.get(s) is g for g in groups)]
loose_nodes = [s for s in loose if strip_tag(s.tag) in NODE_SHAPE_TAGS and has_fill(s)]
loose_edges = [s for s in loose if strip_tag(s.tag) in EDGE_SHAPE_TAGS and has_stroke(s)]

print('parsed nodes (groups):', len(nodes))
print('parsed edges (groups):', len(edges))
print('loose nodes:', len(loose_nodes))
print('loose edges:', len(loose_edges))

# sample output of some ids
print('sample node ids:', [n[0] for n in nodes[:10]])
print('sample edge ids:', [e[0] for e in edges[:10]])
