shader_type canvas_item;
render_mode blend_mul;

// Darkens the woods, with a hole at the feet so the ground and trees show.
uniform vec2 light_pos = vec2(0.0);
uniform float light_radius = 52.0;
uniform vec4 night_tint : source_color = vec4(0.48, 0.52, 0.72, 1.0);

varying vec2 world_xy;

void vertex() {
	world_xy = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	float t = clamp(1.0 - distance(world_xy, light_pos) / max(light_radius, 0.001), 0.0, 1.0);
	float reveal = t * t;
	vec3 tint = mix(night_tint.rgb, vec3(1.0), reveal);
	COLOR = vec4(tint, 1.0);
}
