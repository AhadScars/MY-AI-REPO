/**
 * Check-in / check-out scanner.
 * Supports keyboard wedge QR scanners (rapid keystrokes + Enter)
 * and optional camera barcode scanning via BarcodeDetector API.
 * Payload format SA|{school_id}|{student_id} is also accepted as plain ID.
 * Future NFC: same submitScan(code) entry point.
 */
(function () {
  const form = document.getElementById("scan-form");
  const input = document.getElementById("student_input");
  const resultEl = document.getElementById("scan-result");
  const mode = form?.dataset.mode || "in";
  const apiUrl = form?.dataset.api || "/scan/api";

  if (!form || !input) return;

  function showResult(ok, message) {
    resultEl.className = "scan-result show " + (ok ? "ok" : "fail");
    resultEl.textContent = message;
  }

  async function submitScan(code) {
    code = (code || "").trim();
    if (!code) {
      showResult(false, "Enter or scan a student ID.");
      return;
    }
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ mode, code }),
      });
      const data = await res.json();
      showResult(data.ok, data.message);
      if (data.ok) {
        // brief success sound via Web Audio (optional soft beep)
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = data.ok ? 880 : 220;
          g.gain.value = 0.05;
          o.start();
          setTimeout(() => o.stop(), 120);
        } catch (_) {}
      }
    } catch (e) {
      showResult(false, "Network error. Try again.");
    }
    input.value = "";
    input.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitScan(input.value);
  });

  // Keep focus on input for USB QR scanners
  input.focus();
  document.addEventListener("click", () => {
    if (document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "BUTTON" &&
        document.activeElement?.tagName !== "A") {
      input.focus();
    }
  });

  // Camera QR (Chrome/Edge with BarcodeDetector)
  const camBtn = document.getElementById("btn-camera");
  const video = document.getElementById("video-preview");
  let stream = null;
  let scanning = false;

  async function stopCamera() {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) {
      video.style.display = "none";
      video.srcObject = null;
    }
    if (camBtn) camBtn.textContent = "Use Camera";
  }

  async function startCamera() {
    if (!("BarcodeDetector" in window)) {
      showResult(false, "Camera QR not supported in this browser. Use a USB scanner or type the ID.");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = stream;
      video.style.display = "block";
      await video.play();
      camBtn.textContent = "Stop Camera";
      scanning = true;
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            await submitScan(codes[0].rawValue);
            await stopCamera();
            return;
          }
        } catch (_) {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      showResult(false, "Camera permission denied or unavailable.");
    }
  }

  if (camBtn) {
    camBtn.addEventListener("click", () => {
      if (scanning) stopCamera();
      else startCamera();
    });
  }

  // Expose for future NFC Web API integration
  window.AttendanceScan = { submitScan, stopCamera };
})();
