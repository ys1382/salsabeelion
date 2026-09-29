shader_type canvas_item;

// Night tint, lifted back to the real colors inside a small circle.
uniform vec2 light_pos = vec2(0.0);
uniform float light_radius = 52.0;
uniform float can_reveal = 0.0;
uniform vec4 night_tint : source_color = vec4(0.48, 0.52, 0.72, 1.0);

varying vec2 world_xy;

void vertex() {
	world_xy = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	float reveal = 0.0;
	if (can_reveal > 0.5) {
		float t = clamp(1.0 - distance(world_xy, light_pos) / max(light_radius, 0.001), 0.0, 1.0);
		reveal = t * t;
	}
	vec3 tint = mix(night_tint.rgb, vec3(1.0), reveal);
	COLOR = vec4(tex.rgb * tint, tex.a);
}
