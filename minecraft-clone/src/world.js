/**
 * Limited voxel world — 48×48 surface, height layers
 */

import * as THREE from "three";
import { BLOCK, BLOCK_META, isSolid, isDiggable } from "./blocks.js";

export const WORLD_W = 48;
export const WORLD_D = 48;
export const WORLD_H = 24;
export const SEA_LEVEL = 6;

function hash2(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function noise2(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x, z) {
  let v = 0;
  let a = 1;
  let f = 1;
  let s = 0;
  for (let i = 0; i < 4; i++) {
    v += noise2(x * f, z * f) * a;
    s += a;
    a *= 0.5;
    f *= 2;
  }
  return v / s;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.w = WORLD_W;
    this.d = WORLD_D;
    this.h = WORLD_H;
    // flat array [x + z*W + y*W*D]
    this.blocks = new Uint8Array(this.w * this.d * this.h);
    this.meshes = new Map(); // blockId -> InstancedMesh
    this.maxInstances = this.w * this.d * this.h;
    this.dummy = new THREE.Object3D();
    this.group = new THREE.Group();
    scene.add(this.group);

    this.generate();
    this.rebuild();
  }

  idx(x, y, z) {
    return x + z * this.w + y * this.w * this.d;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h && z >= 0 && z < this.d;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    this.blocks[this.idx(x, y, z)] = id;
    return true;
  }

  generate() {
    // Terrain
    for (let x = 0; x < this.w; x++) {
      for (let z = 0; z < this.d; z++) {
        const n = fbm(x * 0.08, z * 0.08);
        let h = Math.floor(4 + n * 8);
        h = Math.max(2, Math.min(this.h - 4, h));

        // Beach near edges of world slightly lower / sand
        const edge =
          Math.min(x, z, this.w - 1 - x, this.d - 1 - z) < 3 ? 1 : 0;
        if (edge) h = Math.min(h, SEA_LEVEL);

        for (let y = 0; y < this.h; y++) {
          let id = BLOCK.AIR;
          if (y < h - 3) id = BLOCK.STONE;
          else if (y < h - 1) id = BLOCK.DIRT;
          else if (y === h - 1) {
            if (h <= SEA_LEVEL + 1) id = BLOCK.SAND;
            else id = BLOCK.GRASS;
          } else if (y <= SEA_LEVEL && h <= SEA_LEVEL) {
            id = BLOCK.WATER;
          }
          this.set(x, y, z, id);
        }

        // Fill water above terrain up to sea
        for (let y = h; y <= SEA_LEVEL; y++) {
          if (this.get(x, y, z) === BLOCK.AIR) this.set(x, y, z, BLOCK.WATER);
        }
      }
    }

    // Trees
    for (let i = 0; i < 55; i++) {
      const tx = 2 + Math.floor(Math.random() * (this.w - 4));
      const tz = 2 + Math.floor(Math.random() * (this.d - 4));
      let ty = -1;
      for (let y = this.h - 1; y >= 0; y--) {
        if (this.get(tx, y, tz) === BLOCK.GRASS) {
          ty = y;
          break;
        }
      }
      if (ty < 0) continue;
      this.plantTree(tx, ty + 1, tz);
    }

    // Border wall of bedrock-ish stone so player stays in limited area
    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < Math.min(12, this.h); y++) {
        this.set(x, y, 0, BLOCK.STONE);
        this.set(x, y, this.d - 1, BLOCK.STONE);
      }
    }
    for (let z = 0; z < this.d; z++) {
      for (let y = 0; y < Math.min(12, this.h); y++) {
        this.set(0, y, z, BLOCK.STONE);
        this.set(this.w - 1, y, z, BLOCK.STONE);
      }
    }
  }

  plantTree(x, y, z) {
    const trunkH = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < trunkH; i++) {
      if (this.inBounds(x, y + i, z)) this.set(x, y + i, z, BLOCK.WOOD);
    }
    const top = y + trunkH;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 2; dy++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy > 0) continue;
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4) continue;
          const lx = x + dx;
          const ly = top + dy;
          const lz = z + dz;
          if (!this.inBounds(lx, ly, lz)) continue;
          if (this.get(lx, ly, lz) === BLOCK.AIR) this.set(lx, ly, lz, BLOCK.LEAVES);
        }
      }
    }
  }

  /** Rebuild all instanced meshes from block data */
  rebuild() {
    // Clear old (don't dispose shared geometry — each mesh has its own clone)
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else mesh.material.dispose();
    }
    this.meshes.clear();

    // Count per type
    const counts = {};
    for (let i = 0; i < this.blocks.length; i++) {
      const id = this.blocks[i];
      if (id === BLOCK.AIR) continue;
      counts[id] = (counts[id] || 0) + 1;
    }

    for (const [idStr, count] of Object.entries(counts)) {
      const id = Number(idStr);
      const meta = BLOCK_META[id];
      if (!meta || !meta.colors) continue;

      // InstancedMesh: one material + own geometry instance
      const mat = new THREE.MeshLambertMaterial({
        color: meta.colors[0],
        transparent: !!meta.transparent || id === BLOCK.WATER,
        opacity: id === BLOCK.WATER ? 0.65 : meta.transparent ? 0.9 : 1,
        depthWrite: id !== BLOCK.WATER,
      });

      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, count);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.count = 0;
      mesh.userData.blockId = id;
      this.meshes.set(id, mesh);
      this.group.add(mesh);
    }

    // Place instances — only if face exposed for solid (culling neighbors)
    for (let y = 0; y < this.h; y++) {
      for (let z = 0; z < this.d; z++) {
        for (let x = 0; x < this.w; x++) {
          const id = this.get(x, y, z);
          if (id === BLOCK.AIR) continue;
          if (!this.isExposed(x, y, z)) continue;
          const mesh = this.meshes.get(id);
          if (!mesh) continue;
          this.dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(mesh.count++, this.dummy.matrix);
        }
      }
    }

    for (const mesh of this.meshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      // Shrink unused
      mesh.geometry = mesh.geometry; // keep
    }
  }

  isExposed(x, y, z) {
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (const [dx, dy, dz] of dirs) {
      const n = this.get(x + dx, y + dy, z + dz);
      if (n === BLOCK.AIR || n === BLOCK.WATER || BLOCK_META[n]?.transparent) {
        // water only shows if neighbor is not water? show water always if top exposed
        if (this.get(x, y, z) === BLOCK.WATER && n === BLOCK.WATER) continue;
        return true;
      }
    }
    return false;
  }

  /**
   * Raycast against voxel grid from origin along direction.
   * Returns { x,y,z, nx,ny,nz, dist } or null
   */
  raycast(origin, direction, maxDist = 6) {
    // Amanatides & Woo style DDA
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x > 0 ? 1 : direction.x < 0 ? -1 : 0;
    const stepY = direction.y > 0 ? 1 : direction.y < 0 ? -1 : 0;
    const stepZ = direction.z > 0 ? 1 : direction.z < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

    const frac = (v, step) => {
      const f = v - Math.floor(v);
      return step > 0 ? 1 - f : f;
    };

    let tMaxX = stepX !== 0 ? frac(origin.x, stepX) * tDeltaX : Infinity;
    let tMaxY = stepY !== 0 ? frac(origin.y, stepY) * tDeltaY : Infinity;
    let tMaxZ = stepZ !== 0 ? frac(origin.z, stepZ) * tDeltaZ : Infinity;

    let dist = 0;
    let nx = 0,
      ny = 0,
      nz = 0;

    for (let i = 0; i < maxDist * 3; i++) {
      if (this.inBounds(x, y, z)) {
        const id = this.get(x, y, z);
        if (id !== BLOCK.AIR && id !== BLOCK.WATER && isSolid(id)) {
          return { x, y, z, nx, ny, nz, dist, id };
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          tMaxY += tDeltaY;
          y += stepY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }

      if (dist > maxDist) break;
    }
    return null;
  }

  dig(x, y, z) {
    const id = this.get(x, y, z);
    if (!isDiggable(id)) return null;
    const drop = BLOCK_META[id]?.drop ?? id;
    this.set(x, y, z, BLOCK.AIR);
    this.rebuild();
    return drop;
  }

  place(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    if (this.get(x, y, z) !== BLOCK.AIR && this.get(x, y, z) !== BLOCK.WATER)
      return false;
    this.set(x, y, z, id);
    this.rebuild();
    return true;
  }

  /** Collision: AABB vs solid blocks. pos is feet center bottom */
  collideAABB(pos, halfW, height, vel) {
    // Move axis by axis
    const out = pos.clone();
    out.x += vel.x;
    this.resolveAxis(out, halfW, height, "x", vel.x);
    out.y += vel.y;
    const hitY = this.resolveAxis(out, halfW, height, "y", vel.y);
    out.z += vel.z;
    this.resolveAxis(out, halfW, height, "z", vel.z);
    return { position: out, onGround: hitY && vel.y <= 0, hitCeiling: hitY && vel.y > 0 };
  }

  resolveAxis(pos, halfW, height, axis, delta) {
    let hit = false;
    const minX = Math.floor(pos.x - halfW);
    const maxX = Math.floor(pos.x + halfW);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height - 0.01);
    const minZ = Math.floor(pos.z - halfW);
    const maxZ = Math.floor(pos.z + halfW);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (!isSolid(this.get(x, y, z))) continue;
          // block AABB [x,x+1] etc
          if (axis === "x") {
            if (delta > 0) pos.x = Math.min(pos.x, x - halfW - 0.001);
            else if (delta < 0) pos.x = Math.max(pos.x, x + 1 + halfW + 0.001);
            hit = true;
          } else if (axis === "z") {
            if (delta > 0) pos.z = Math.min(pos.z, z - halfW - 0.001);
            else if (delta < 0) pos.z = Math.max(pos.z, z + 1 + halfW + 0.001);
            hit = true;
          } else if (axis === "y") {
            if (delta > 0) pos.y = Math.min(pos.y, y - height - 0.001);
            else if (delta < 0) pos.y = Math.max(pos.y, y + 1 + 0.001);
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  spawnHeight(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    for (let y = this.h - 1; y >= 0; y--) {
      if (isSolid(this.get(ix, y, iz))) return y + 1;
    }
    return SEA_LEVEL + 2;
  }

  get center() {
    return new THREE.Vector3(this.w / 2, 0, this.d / 2);
  }
}
