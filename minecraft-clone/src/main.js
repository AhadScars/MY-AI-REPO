/**
 * BlockCraft — Minecraft clone entry point
 */

import * as THREE from "three";
import { World } from "./world.js";
import { DayNight } from "./daynight.js";
import { AnimalManager } from "./animals.js";
import { Player, HOTBAR_BLOCKS, BLOCK_META } from "./player.js";

// ── Renderer ──────────────────────────────────────────────
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);

// ── Scene & camera ────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8e0f0, 40, 100);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

// ── Systems ───────────────────────────────────────────────
const world = new World(scene);
const dayNight = new DayNight(scene);
const animals = new AnimalManager(scene, world, 20);
const player = new Player(camera, world, animals, canvas);

// Expose scene on world for player body (already uses world.scene)
world.scene = scene;

// ── HUD ───────────────────────────────────────────────────
const timeLabel = document.getElementById("time-label");
const phaseLabel = document.getElementById("phase-label");
const cameraLabel = document.getElementById("camera-label");
const hpLabel = document.getElementById("hp-label");
const hotbarEl = document.getElementById("hotbar");
const overlay = document.getElementById("overlay");
const playBtn = document.getElementById("play-btn");

function buildHotbar() {
  hotbarEl.innerHTML = "";
  HOTBAR_BLOCKS.forEach((id, i) => {
    const meta = BLOCK_META[id];
    const slot = document.createElement("div");
    slot.className = "slot" + (i === player.selected ? " selected" : "");
    slot.dataset.index = i;

    const key = document.createElement("span");
    key.className = "key";
    key.textContent = String(i + 1);

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    const c = meta.colors[0];
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    swatch.style.background = `rgb(${r},${g},${b})`;
    swatch.title = meta.name;

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = player.inventory[id] || 0;

    slot.append(key, swatch, count);
    hotbarEl.appendChild(slot);
  });
}

function updateHotbar() {
  const slots = hotbarEl.querySelectorAll(".slot");
  slots.forEach((slot, i) => {
    slot.classList.toggle("selected", i === player.selected);
    const id = HOTBAR_BLOCKS[i];
    const count = slot.querySelector(".count");
    if (count) count.textContent = player.inventory[id] || 0;
  });
}

buildHotbar();

// ── Pointer lock / overlay ────────────────────────────────
function startGame() {
  overlay.classList.add("hidden");
  player.lock();
}

playBtn.addEventListener("click", startGame);
canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    player.lock();
    overlay.classList.add("hidden");
  }
});

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  player.setLocked(locked);
  if (!locked) overlay.classList.remove("hidden");
  else overlay.classList.add("hidden");
});

// ── Resize ────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Loop ──────────────────────────────────────────────────
let last = performance.now();
let hudAcc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  const dtMs = Math.min(50, now - last);
  last = now;

  if (player.locked) {
    player.update(dt);
    animals.update(dt);
  }

  dayNight.update(dtMs, world.center);

  // HUD throttle
  hudAcc += dt;
  if (hudAcc > 0.15) {
    hudAcc = 0;
    timeLabel.textContent = dayNight.formatTime();
    phaseLabel.textContent = dayNight.phase;
    cameraLabel.textContent = player.mode;
    hpLabel.textContent = player.getHpHearts();
    updateHotbar();
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(frame);

// Initial camera position before lock
player.updateCamera();
renderer.render(scene, camera);

console.log(
  "%c BlockCraft ready — 48×48 world · FPP/TPP · day/night 20min ",
  "background:#4a8a1a;color:#fff;padding:4px 8px;border-radius:4px"
);
