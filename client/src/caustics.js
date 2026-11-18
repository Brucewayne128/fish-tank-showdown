import { TANK } from '../../shared/constants.js';

// Rippling light from the water surface, painted onto anything lit by the lamp.
// It only changes the lamp's direct light, so shadows stay dark and the ripples
// only show where the light actually lands.
export const causticTime = { value: 0 };

const GLSL = /* glsl */`
  varying vec3 vCWorld;
  uniform float uCausticTime;
  float causticLayer(vec2 p, float t) {
    vec2 i = p; float c = 1.0;
    for (int n = 0; n < 5; n++) {
      float tt = t * (1.0 - 3.5 / float(n + 1));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
    }
    c /= 5.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }
  float causticAt(vec3 w, float t) {
    vec2 a = mod(w.xz * 0.3, 6.28318) - 250.0;
    vec2 b = mod(vec2(w.z, -w.x) * 0.21 + 1.7, 6.28318) - 250.0;
    float v = causticLayer(a, t * 0.55) * 0.7 + causticLayer(b, t * 0.4 + 9.0) * 0.6;
    return smoothstep(0.12, 0.75, v);
  }
`;

export function addCaustics(mat, strength = 1) {
  if (!mat || mat.userData.caustics || !mat.isMeshStandardMaterial) return mat;
  mat.userData.caustics = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCausticTime = causticTime;
    sh.uniforms.uCausticStrength = { value: strength };
    sh.vertexShader = 'varying vec3 vCWorld;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 cwp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cwp = instanceMatrix * cwp;
      #endif
      vCWorld = (modelMatrix * cwp).xyz;`);
    sh.fragmentShader = 'uniform float uCausticStrength;\n' + GLSL + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        float under = 1.0 - smoothstep(${TANK.maxY.toFixed(1)}, ${(TANK.maxY + 1.5).toFixed(1)}, vCWorld.y);
        float c = causticAt(vCWorld, uCausticTime);
        reflectedLight.directDiffuse *= mix(1.0, 0.5 + c * 2.4, under * uCausticStrength);
      }`);
  };
  mat.needsUpdate = true;
  return mat;
}
