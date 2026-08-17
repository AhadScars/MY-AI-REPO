/**
 * Day / night cycle
 * Full day = 20 real minutes
 *   Day:     10 min
 *   Sunset:   1 min
 *   Night:    8 min
 *   Sunrise:  1 min
 */

import * as THREE from "three";

// Real-time durations (ms)
const DAY_MS = 10 * 60 * 1000;
const SUNSET_MS = 1 * 60 * 1000;
const NIGHT_MS = 8 * 60 * 1000;
const SUNRISE_MS = 1 * 60 * 1000;
const FULL_MS = DAY_MS + SUNSET_MS + NIGHT_MS + SUNRISE_MS; // 20 min

const PHASES = [
  { name: "Day", duration: DAY_MS },
  { name: "Sunset", duration: SUNSET_MS },
  { name: "Night", duration: NIGHT_MS },
  { name: "Sunrise", duration: SUNRISE_MS },
];

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0; // ms into cycle (start at morning day)
    this.timeScale = 1;

    // Ambient + directional sun/moon
    this.ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(this.ambient);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.1);
    this.sunLight.castShadow = false;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(0x8899cc, 0.25);
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

    // Visual sun / moon spheres
    const sunGeo = new THREE.SphereGeometry(4, 16, 16);
    this.sunMesh = new THREE.Mesh(
      sunGeo,
      new THREE.MeshBasicMaterial({ color: 0xffee88 })
    );
    scene.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      sunGeo,
      new THREE.MeshBasicMaterial({ color: 0xddeeff })
    );
    scene.add(this.moonMesh);

    // Soft glow sprites (simple larger semi-transparent spheres)
    this.sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    scene.add(this.sunGlow);

    this.moonGlow = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xaabbff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    scene.add(this.moonGlow);

    // Fog color reference
    this.skyDay = new THREE.Color(0x87ceeb);
    this.skySunset = new THREE.Color(0xff7a3c);
    this.skyNight = new THREE.Color(0x0a0e1a);
    this.skySunrise = new THREE.Color(0xffb070);

    this.fogDay = new THREE.Color(0xc8e0f0);
    this.fogNight = new THREE.Color(0x0a0e1a);

    this.phase = "Day";
    this.gameHour = 6; // start ~6am
  }

  get progress() {
    return (this.elapsed % FULL_MS) / FULL_MS;
  }

  getPhaseInfo() {
    let t = this.elapsed % FULL_MS;
    for (const p of PHASES) {
      if (t < p.duration) {
        return { name: p.name, local: t / p.duration, t };
      }
      t -= p.duration;
    }
    return { name: "Day", local: 0, t: 0 };
  }

  /** Map cycle to 0–24 game hours (day starts at 6:00) */
  getGameTime() {
    const p = this.progress;
    // Map: 0=6:00, 0.5≈16:00 end of day stretch conceptually
    // Simpler: progress * 24 hours offset so day is daytime
    // Day 0–0.5  → 6:00–16:00 (10h game-ish)
    // We'll map full cycle to 24 hours starting at 6:00
    const hours = (6 + p * 24) % 24;
    return hours;
  }

  formatTime() {
    const h = this.getGameTime();
    const hour = Math.floor(h);
    const min = Math.floor((h - hour) * 60);
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  update(dtMs, worldCenter) {
    this.elapsed += dtMs * this.timeScale;
    const { name, local } = this.getPhaseInfo();
    this.phase = name;

    const cx = worldCenter.x;
    const cz = worldCenter.z;
    const radius = 90;
    const height = 70;

    // Sun rises east (angle 0 at sunrise end / day start), sets west
    // progress 0 = morning, 0.5 = evening, 1 = next morning
    const angle = this.progress * Math.PI * 2 - Math.PI / 2;

    const sunX = cx + Math.cos(angle) * radius;
    const sunY = Math.sin(angle) * height + 10;
    const sunZ = cz + Math.sin(angle) * radius * 0.3;

    const moonX = cx + Math.cos(angle + Math.PI) * radius;
    const moonY = Math.sin(angle + Math.PI) * height + 10;
    const moonZ = cz + Math.sin(angle + Math.PI) * radius * 0.3;

    this.sunMesh.position.set(sunX, Math.max(sunY, -5), sunZ);
    this.sunGlow.position.copy(this.sunMesh.position);
    this.moonMesh.position.set(moonX, Math.max(moonY, -5), moonZ);
    this.moonGlow.position.copy(this.moonMesh.position);

    this.sunLight.position.copy(this.sunMesh.position);
    this.sunLight.target.position.set(cx, 0, cz);
    this.moonLight.position.copy(this.moonMesh.position);
    this.moonLight.target.position.set(cx, 0, cz);

    // Visibility / intensity by phase
    let sunIntensity = 0;
    let moonIntensity = 0;
    let ambient = 0.15;
    let sky = this.skyDay.clone();
    let fog = this.fogDay.clone();

    if (name === "Day") {
      sunIntensity = 1.15;
      moonIntensity = 0;
      ambient = 0.5;
      sky.copy(this.skyDay);
      fog.copy(this.fogDay);
      this.sunMesh.visible = true;
      this.sunGlow.visible = true;
      this.moonMesh.visible = false;
      this.moonGlow.visible = false;
    } else if (name === "Sunset") {
      // local 0→1: day fading to night
      sunIntensity = 1.0 * (1 - local);
      moonIntensity = 0.15 * local;
      ambient = 0.5 - local * 0.35;
      sky.copy(this.skyDay).lerp(this.skySunset, Math.min(1, local * 1.5));
      if (local > 0.5) {
        sky.lerp(this.skyNight, (local - 0.5) * 2);
      }
      fog.copy(this.fogDay).lerp(this.fogNight, local);
      this.sunMesh.visible = sunY > -2;
      this.sunGlow.visible = sunY > -2;
      this.moonMesh.visible = moonY > 0;
      this.moonGlow.visible = moonY > 0;
      // Warm sun color at sunset
      this.sunMesh.material.color.setHex(0xff9944);
      this.sunLight.color.setHex(0xffaa66);
    } else if (name === "Night") {
      sunIntensity = 0;
      moonIntensity = 0.35;
      ambient = 0.12;
      sky.copy(this.skyNight);
      fog.copy(this.fogNight);
      this.sunMesh.visible = false;
      this.sunGlow.visible = false;
      this.moonMesh.visible = true;
      this.moonGlow.visible = true;
      this.sunMesh.material.color.setHex(0xffee88);
      this.sunLight.color.setHex(0xfff4d6);
    } else {
      // Sunrise
      sunIntensity = 1.0 * local;
      moonIntensity = 0.3 * (1 - local);
      ambient = 0.12 + local * 0.38;
      sky.copy(this.skyNight).lerp(this.skySunrise, Math.min(1, local * 1.4));
      if (local > 0.5) {
        sky.lerp(this.skyDay, (local - 0.5) * 2);
      }
      fog.copy(this.fogNight).lerp(this.fogDay, local);
      this.sunMesh.visible = sunY > -2;
      this.sunGlow.visible = sunY > -2;
      this.moonMesh.visible = moonY > 5;
      this.moonGlow.visible = moonY > 5;
      this.sunMesh.material.color.setHex(0xffbb66);
      this.sunLight.color.setHex(0xffcc88);
    }

    if (name === "Day") {
      this.sunMesh.material.color.setHex(0xffee88);
      this.sunLight.color.setHex(0xfff4d6);
    }

    this.sunLight.intensity = sunIntensity;
    this.moonLight.intensity = moonIntensity;
    this.ambient.intensity = ambient;
    this.ambient.color.setHex(name === "Night" ? 0x334466 : 0xffffff);

    this.scene.background = sky;
    if (this.scene.fog) {
      this.scene.fog.color.copy(fog);
      this.scene.fog.near = name === "Night" ? 20 : 40;
      this.scene.fog.far = name === "Night" ? 70 : 100;
    }

    this.gameHour = this.getGameTime();
  }
}

export { FULL_MS };
