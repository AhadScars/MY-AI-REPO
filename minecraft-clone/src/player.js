/**
 * Player controller — movement, FPP/TPP camera, dig/place, combat
 */

import * as THREE from "three";
import { BLOCK, HOTBAR_BLOCKS, BLOCK_META } from "./blocks.js";

export class Player {
  constructor(camera, world, animals, domElement) {
    this.camera = camera;
    this.world = world;
    this.animals = animals;
    this.dom = domElement;

    this.position = new THREE.Vector3(
      world.w / 2,
      world.spawnHeight(world.w / 2, world.d / 2) + 1,
      world.d / 2
    );
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.mode = "FPP"; // FPP | TPP
    this.hp = 10;
    this.maxHp = 10;
    this.invuln = 0;

    this.halfW = 0.3;
    this.height = 1.7;
    this.eyeHeight = 1.55;
    this.speed = 5.5;
    this.jumpSpeed = 8.5;
    this.gravity = 22;

    this.keys = {};
    this.locked = false;
    this.selected = 0;
    this.inventory = {};
    // start with some blocks
    for (const b of HOTBAR_BLOCKS) {
      this.inventory[b] = 16;
    }
    this.inventory[BLOCK.DIRT] = 32;
    this.inventory[BLOCK.COBBLE] = 16;
    this.inventory[BLOCK.PLANKS] = 16;

    // TPP body mesh (simple Steve-like cube person)
    this.body = new THREE.Group();
    const skin = 0xc68642;
    const shirt = 0x3a7bd5;
    const pants = 0x2c3e6b;
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.28),
      new THREE.MeshLambertMaterial({ color: shirt })
    );
    this.torso.position.y = 1.05;
    this.body.add(this.torso);
    this.headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: skin })
    );
    this.headMesh.position.y = 1.55;
    this.body.add(this.headMesh);
    // eyes
    const eL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    eL.position.set(0.1, 0.05, 0.2);
    this.headMesh.add(eL);
    const eR = eL.clone();
    eR.position.x = -0.1;
    this.headMesh.add(eR);

    this.legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.55, 0.22),
      new THREE.MeshLambertMaterial({ color: pants })
    );
    this.legL.position.set(0.12, 0.28, 0);
    this.body.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = -0.12;
    this.body.add(this.legR);
    this.armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.55, 0.16),
      new THREE.MeshLambertMaterial({ color: skin })
    );
    this.armL.position.set(0.35, 1.05, 0);
    this.body.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = -0.35;
    this.body.add(this.armR);
    this.body.visible = false;
    world.scene.add(this.body);

    // Block highlight wireframe
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
    );
    this.highlight.visible = false;
    world.scene.add(this.highlight);

    this.swingTimer = 0;
    this.breakCooldown = 0;
    this.placeCooldown = 0;
    this.walkPhase = 0;

    this._bindInput();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyV") this.toggleCamera();
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.replace("Digit", ""));
        if (n >= 1 && n <= HOTBAR_BLOCKS.length) this.selected = n - 1;
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        e.preventDefault();
        if (e.deltaY > 0) this.selected = (this.selected + 1) % HOTBAR_BLOCKS.length;
        else
          this.selected =
            (this.selected - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      },
      { passive: false }
    );
    this.dom.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.tryAttackOrDig();
      if (e.button === 2) this.tryPlace();
    });
    this.dom.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  lock() {
    this.dom.requestPointerLock();
  }

  setLocked(v) {
    this.locked = v;
  }

  toggleCamera() {
    this.mode = this.mode === "FPP" ? "TPP" : "FPP";
    this.body.visible = this.mode === "TPP";
  }

  get eyePos() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
  }

  get lookDir() {
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    return dir.normalize();
  }

  tryAttackOrDig() {
    if (this.breakCooldown > 0) return;
    this.swingTimer = 0.25;
    this.breakCooldown = 0.28;

    const origin = this.eyePos;
    const dir = this.lookDir;

    // Prefer animals if closer
    const animalHit = this.animals.raycast(origin, dir, 4);
    const blockHit = this.world.raycast(origin, dir, 5);

    if (animalHit && (!blockHit || animalHit.dist < blockHit.dist)) {
      const knock = dir.clone();
      knock.y = 0;
      knock.normalize();
      animalHit.animal.takeDamage(3, knock);
      return;
    }

    if (blockHit) {
      const drop = this.world.dig(blockHit.x, blockHit.y, blockHit.z);
      if (drop != null) {
        this.inventory[drop] = (this.inventory[drop] || 0) + 1;
      }
    }
  }

  tryPlace() {
    if (this.placeCooldown > 0) return;
    this.placeCooldown = 0.2;
    const blockId = HOTBAR_BLOCKS[this.selected];
    if (!this.inventory[blockId] || this.inventory[blockId] <= 0) return;

    const origin = this.eyePos;
    const dir = this.lookDir;
    const hit = this.world.raycast(origin, dir, 5);
    if (!hit) return;

    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;

    // Don't place inside player
    const feet = this.position;
    const minX = feet.x - this.halfW;
    const maxX = feet.x + this.halfW;
    const minY = feet.y;
    const maxY = feet.y + this.height;
    const minZ = feet.z - this.halfW;
    const maxZ = feet.z + this.halfW;
    if (
      px + 1 > minX &&
      px < maxX &&
      py + 1 > minY &&
      py < maxY &&
      pz + 1 > minZ &&
      pz < maxZ
    ) {
      return;
    }

    if (this.world.place(px, py, pz, blockId)) {
      this.inventory[blockId]--;
    }
  }

  update(dt) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.breakCooldown > 0) this.breakCooldown -= dt;
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    if (this.swingTimer > 0) this.swingTimer -= dt;

    // Movement relative to yaw
    let mx = 0;
    let mz = 0;
    if (this.keys["KeyW"]) {
      mx -= Math.sin(this.yaw);
      mz -= Math.cos(this.yaw);
    }
    if (this.keys["KeyS"]) {
      mx += Math.sin(this.yaw);
      mz += Math.cos(this.yaw);
    }
    if (this.keys["KeyA"]) {
      mx -= Math.cos(this.yaw);
      mz += Math.sin(this.yaw);
    }
    if (this.keys["KeyD"]) {
      mx += Math.cos(this.yaw);
      mz -= Math.sin(this.yaw);
    }

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx = (mx / len) * this.speed;
      mz = (mz / len) * this.speed;
      this.walkPhase += dt * 10;
    } else {
      this.walkPhase *= 0.9;
    }

    this.velocity.x = mx;
    this.velocity.z = mz;
    this.velocity.y -= this.gravity * dt;
    if (this.velocity.y < -40) this.velocity.y = -40;

    if (this.keys["Space"] && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    const vel = this.velocity.clone().multiplyScalar(dt);
    // horizontal first then vertical for better ground detection
    const result = this.world.collideAABB(
      this.position.clone(),
      this.halfW,
      this.height,
      vel
    );
    this.position.copy(result.position);
    this.onGround = result.onGround;
    if (result.onGround || result.hitCeiling) {
      this.velocity.y = 0;
    }

    // Clamp to world
    this.position.x = Math.max(1.2, Math.min(this.world.w - 1.2, this.position.x));
    this.position.z = Math.max(1.2, Math.min(this.world.d - 1.2, this.position.z));

    // Fall damage / void reset
    if (this.position.y < -5) {
      this.position.set(
        this.world.w / 2,
        this.world.spawnHeight(this.world.w / 2, this.world.d / 2) + 2,
        this.world.d / 2
      );
      this.velocity.set(0, 0, 0);
      this.hp = Math.max(0, this.hp - 2);
    }

    this.updateCamera();
    this.updateHighlight();
    this.updateBody(dt);
  }

  updateCamera() {
    const eye = this.eyePos;
    const dir = this.lookDir;

    if (this.mode === "FPP") {
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.clone().add(dir));
      this.body.visible = false;
    } else {
      // Third person: pull camera back
      const dist = 4.5;
      let camPos = eye.clone().add(dir.clone().multiplyScalar(-dist));
      camPos.y += 0.8;
      // simple collision: don't go through blocks
      const hit = this.world.raycast(eye, dir.clone().negate(), dist);
      if (hit && hit.dist < dist) {
        camPos = eye
          .clone()
          .add(dir.clone().negate().multiplyScalar(Math.max(0.5, hit.dist - 0.3)));
        camPos.y += 0.5;
      }
      this.camera.position.copy(camPos);
      this.camera.lookAt(eye);
      this.body.visible = true;
    }
  }

  updateBody() {
    this.body.position.set(this.position.x, this.position.y, this.position.z);
    this.body.rotation.y = this.yaw;
    this.headMesh.rotation.x = this.pitch * 0.5;

    const swing = Math.sin(this.walkPhase) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;
    if (this.swingTimer > 0) {
      this.armR.rotation.x = -Math.sin((1 - this.swingTimer / 0.25) * Math.PI) * 1.2;
    }
  }

  updateHighlight() {
    const hit = this.world.raycast(this.eyePos, this.lookDir, 5);
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  getHpHearts() {
    let s = "";
    for (let i = 0; i < this.maxHp; i++) {
      s += i < this.hp ? "♥" : "♡";
    }
    return s;
  }
}

export { HOTBAR_BLOCKS, BLOCK_META, BLOCK };
