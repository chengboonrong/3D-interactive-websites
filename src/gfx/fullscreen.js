import { BufferAttribute, BufferGeometry, Camera, Mesh, RawShaderMaterial } from 'three';

/**
 * One oversized triangle beats a quad: no diagonal seam, one less vertex,
 * and the rasteriser gets a single primitive to clip.
 */
export function triangleGeometry() {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
}

export const PASS_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Camera is required by the renderer but never read — the vertex stage is already in clip space. */
export const PASS_CAMERA = new Camera();

const GEO = triangleGeometry();

export function makePass(fragmentShader, uniforms) {
  const mesh = new Mesh(
    GEO,
    new RawShaderMaterial({
      vertexShader: PASS_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
  );
  mesh.frustumCulled = false;
  return mesh;
}
