struct Node {
    pos: vec2<f32>,
    vel: vec2<f32>,
    energy: f32,
    mass: f32,
};

struct Params {
    node_count: u32,
    delta_time: f32,
    viscosity: f32,
    repulsion_strength: f32,
    attraction_strength: f32,
    gravity_strength: f32,
    center: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> nodes: array<Node>;
@group(0) @binding(1) var<uniform> params: Params;

// For now, only Repulsion + Gravity + Integration.
// In v0.2.1 we will add the Adjacency Buffer for fast Edge Attraction.
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.node_count) { return; }

    var node = nodes[index];
    var force = vec2<f32>(0.0, 0.0);

    // 1. Central Gravity
    let dist_to_center = node.pos - params.center;
    force -= normalize(dist_to_center) * params.gravity_strength * length(dist_to_center);

    // 2. N-Body Repulsion (O(N^2) - Scalable on GPU up to ~10k nodes)
    // For 100k nodes, we'll need the LBVH/Morton implementation (Phase 2.2)
    for (var i = 0u; i < params.node_count; i = i + 1u) {
        if (i == index) { continue; }
        
        let other = nodes[i];
        let diff = node.pos - other.pos;
        let dist_sq = dot(diff, diff) + 0.01;
        force += (diff / dist_sq) * params.repulsion_strength * (node.mass * other.mass);
    }

    // 3. Update Velocity and Position
    node.vel = (node.vel + force * params.delta_time) * params.viscosity;
    node.pos = node.pos + node.vel * params.delta_time;

    // Boundary Clamping (Poincare Disk)
    if (length(node.pos) > 0.99) {
        node.pos = normalize(node.pos) * 0.99;
        node.vel *= -0.5; // Bounce back slightly
    }

    nodes[index] = node;
}
