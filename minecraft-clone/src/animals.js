/**
 * Cube animals — cow, pig, chicken, sheep
 * Wander, can be hit / killed by player
 */

import * as THREE from "three";
import { isSolid } from "./blocks.js";

const TYPES = {
  cow: {
    name: "Cow",
    hp: 10,
    speed: 1.4,
    body: { w: 0.9, h: 0.7, d: 1.4, color: 0x4a3728 },
    head: { w: 0.5, h: 0.45, d: 0.45, color: 0x5a4535, ox: 0, oy: 0.15, oz: 0.85 },
    legs: { w: 0.18, h: 0.45, d: 0.18, color: 0x3a2818 },
    spots: true,
  },
  pig: {
    name: "Pig",
    hp: 8,
    speed: 1.6,
    body: { w: 0.75, h: 0.55, d: 1.0, color: 0xf0a0a8 },
    head: { w: 0.4, h: 0.35, d: 0.4, color: 0xf0a0a8, ox: 0, oy: 0.05, oz: 0.6 },
    legs: { w: 0.14, h: 0.35, d: 0.14, color: 0xe09098 },
    snout: true,
  },
  chicken: {
    name: "Chicken",
    hp: 4,
    speed: 2.0,
    body: { w: 0.35, h: 0.35, d: 0.4, color: 0xf5f5f0 },
    head: { w: 0.22, h: 0.22, d: 0.22, color: 0xf5f5f0, ox: 0, oy: 0.2, oz: 0.28 },
    legs: { w: 0.06, h: 0.22, d: 0.06, color: 0xe8a838 },
    comb: true,
  },
  sheep: {
    name: "Sheep",
    hp: 8,
    speed: 1.5,
    body: { w: 0.8, h: 0.65, d: 1.1, color: 0xf0f0f0 },
    head: { w: 0.4, h: 0.4, d: 0.4, color: 0x2a2a2a, ox: 0, oy: 0.1, oz: 0.7 },
    legs: { w: 0.14, h: 0.4, d: 0.14, color: 0x1a1a1a },
  },
};

function makeBox(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

export class Animal {
  constructor(scene, world, type, x, y, z) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.cfg = TYPES[type];
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.alive = true;
    this.yaw = Math.random() * Math.PI * 2;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.wanderTimer = 0;
    this.hurtTimer = 0;
    this.legPhase = 0;
    this.group = new THREE.Group();
    this.buildMesh();
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  buildMesh() {
    const c = this.cfg;
    // body
    this.body = makeBox(c.body.w, c.body.h, c.body.d, c.body.color);
    this.body.position.y = c.legs.h + c.body.h / 2;
    this.group.add(this.body);

    // head
    this.head = makeBox(c.head.w, c.head.h, c.head.d, c.head.color);
    this.head.position.set(
      c.head.ox,
      c.legs.h + c.body.h / 2 + c.head.oy,
      c.head.oz
    );
    this.group.add(this.head);

    // legs
    const lw = c.legs.w;
    const lh = c.legs.h;
    const ld = c.legs.d;
    const ox = c.body.w * 0.3;
    const oz = c.body.d * 0.3;
    this.legs = [];
    const positions = [
      [ox, lh / 2, oz],
      [-ox, lh / 2, oz],
      [ox, lh / 2, -oz],
      [-ox, lh / 2, -oz],
    ];
    for (const [px, py, pz] of positions) {
      const leg = makeBox(lw, lh, ld, c.legs.color);
      leg.position.set(px, py, pz);
      this.group.add(leg);
      this.legs.push(leg);
    }

    // extras
    if (c.snout) {
      const snout = makeBox(0.22, 0.16, 0.18, 0xe08090);
      snout.position.set(0, 0, c.head.d / 2 + 0.08);
      this.head.add(snout);
    }
    if (c.comb) {
      const comb = makeBox(0.08, 0.12, 0.14, 0xe03030);
      comb.position.set(0, c.head.h / 2 + 0.05, 0);
      this.head.add(comb);
      const beak = makeBox(0.1, 0.08, 0.14, 0xe8a838);
      beak.position.set(0, 0, c.head.d / 2 + 0.06);
      this.head.add(beak);
    }
    if (c.spots) {
      const spot = makeBox(0.25, 0.2, 0.3, 0xf0e8d8);
      spot.position.set(0.2, 0.1, 0.1);
      this.body.add(spot);
      const spot2 = makeBox(0.2, 0.18, 0.25, 0xf0e8d8);
      spot2.position.set(-0.25, -0.05, -0.2);
      this.body.add(spot2);
    }
    // eyes
    const eyeL = makeBox(0.08, 0.08, 0.05, 0x111111);
    eyeL.position.set(0.12, 0.08, c.head.d / 2 + 0.01);
    this.head.add(eyeL);
    const eyeR = makeBox(0.08, 0.08, 0.05, 0x111111);
    eyeR.position.set(-0.12, 0.08, c.head.d / 2 + 0.01);
    this.head.add(eyeR);
  }

  get hitbox() {
    const c = this.cfg;
    return {
      halfW: Math.max(c.body.w, c.body.d) * 0.45,
      height: c.legs.h + c.body.h + 0.2,
    };
  }

  takeDamage(amount, knockDir) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hurtTimer = 0.3;
    // flash red
    this.group.traverse((o) => {
      if (o.isMesh && o.material) {
        o.userData._orig = o.userData._orig ?? o.material.color.getHex();
        o.material.color.setHex(0xff3333);
      }
    });
    if (knockDir) {
      this.velocity.x += knockDir.x * 4;
      this.velocity.z += knockDir.z * 4;
      this.velocity.y = 3;
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    // shrink / fall animation handled in update, then remove
    this.deathTimer = 0.8;
  }

  remove() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer -= dt;
      this.group.scale.multiplyScalar(0.95);
      this.group.position.y -= dt * 0.5;
      this.group.rotation.z += dt * 2;
      return this.deathTimer > 0;
    }

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        this.group.traverse((o) => {
          if (o.isMesh && o.material && o.userData._orig != null) {
            o.material.color.setHex(o.userData._orig);
          }
        });
      }
    }

    // Wander AI
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1.5 + Math.random() * 3;
      if (Math.random() < 0.7) {
        this.yaw = Math.random() * Math.PI * 2;
        this.moving = true;
      } else {
        this.moving = false;
      }
    }

    const speed = this.cfg.speed;
    if (this.moving && this.hurtTimer <= 0) {
      this.velocity.x = Math.sin(this.yaw) * speed;
      this.velocity.z = Math.cos(this.yaw) * speed;
      this.legPhase += dt * 10;
    } else {
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
      this.legPhase *= 0.9;
    }

    // Gravity
    this.velocity.y -= 18 * dt;
    if (this.velocity.y < -30) this.velocity.y = -30;

    const hb = this.hitbox;
    const vel = this.velocity.clone().multiplyScalar(dt);
    const result = this.world.collideAABB(
      this.position.clone(),
      hb.halfW,
      hb.height,
      vel
    );
    this.position.copy(result.position);
    this.onGround = result.onGround;
    if (result.onGround || result.hitCeiling) this.velocity.y = 0;

    // Stay in world bounds
    this.position.x = Math.max(1.5, Math.min(this.world.w - 1.5, this.position.x));
    this.position.z = Math.max(1.5, Math.min(this.world.d - 1.5, this.position.z));

    // Turn away from walls
    const lookX = this.position.x + Math.sin(this.yaw);
    const lookZ = this.position.z + Math.cos(this.yaw);
    const gy = Math.floor(this.position.y);
    if (
      isSolid(
        this.world.get(Math.floor(lookX), gy, Math.floor(lookZ))
      ) ||
      isSolid(
        this.world.get(Math.floor(lookX), gy + 1, Math.floor(lookZ))
      )
    ) {
      this.yaw += Math.PI * 0.5 + Math.random();
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Leg animation
    const swing = Math.sin(this.legPhase) * 0.4;
    if (this.legs.length === 4) {
      this.legs[0].rotation.x = swing;
      this.legs[3].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
    }

    return true;
  }

  /** Distance from point to animal body center */
  distanceTo(point) {
    const c = this.position.clone();
    c.y += this.hitbox.height * 0.5;
    return c.distanceTo(point);
  }

  containsRay(origin, dir, maxDist = 4) {
    // Simple sphere-ish hit
    const center = this.position.clone();
    center.y += this.hitbox.height * 0.5;
    const toCenter = center.clone().sub(origin);
    const t = toCenter.dot(dir);
    if (t < 0 || t > maxDist) return null;
    const closest = origin.clone().add(dir.clone().multiplyScalar(t));
    const dist = closest.distanceTo(center);
    const radius = this.hitbox.halfW + 0.35;
    if (dist < radius) return { animal: this, dist: t };
    return null;
  }
}

export class AnimalManager {
  constructor(scene, world, count = 18) {
    this.scene = scene;
    this.world = world;
    this.animals = [];
    this.spawnMany(count);
  }

  spawnMany(count) {
    const types = Object.keys(TYPES);
    let tries = 0;
    while (this.animals.length < count && tries < count * 20) {
      tries++;
      const x = 3 + Math.random() * (this.world.w - 6);
      const z = 3 + Math.random() * (this.world.d - 6);
      const y = this.world.spawnHeight(x, z);
      if (y < 2) continue;
      const type = types[Math.floor(Math.random() * types.length)];
      this.animals.push(new Animal(this.scene, this.world, type, x, y, z));
    }
  }

  update(dt) {
    this.animals = this.animals.filter((a) => a.update(dt));
    // Respawn slowly if few left
    if (this.animals.length < 8 && Math.random() < dt * 0.15) {
      this.spawnMany(1);
    }
  }

  raycast(origin, dir, maxDist = 4) {
    let best = null;
    for (const a of this.animals) {
      if (!a.alive) continue;
      const hit = a.containsRay(origin, dir, maxDist);
      if (hit && (!best || hit.dist < best.dist)) best = hit;
    }
    return best;
  }
}
