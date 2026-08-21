/* ============================================================
   KXS SARI-SARI STORE POS — barcode.js
   Optional camera barcode scanning. Manual entry always works.
   ============================================================ */

const BarcodeScanner = (() => {
  let stream = null;
  let detector = null;
  let scanLoopId = null;
  let onDetectedCallback = null;

  function isSupported() {
    return "BarcodeDetector" in window;
  }

  function isCameraAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async function start(videoEl, onDetected) {
    onDetectedCallback = onDetected;

    if (!isCameraAvailable()) {
      return { ok: false, message: "Camera is not available on this device. Please enter the barcode manually." };
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (err) {
      return { ok: false, message: "Camera permission denied or unavailable. Please enter the barcode manually." };
    }

    videoEl.srcObject = stream;
    await videoEl.play();

    if (!isSupported()) {
      return { ok: false, message: "Barcode scanner is not supported on this browser. Please enter the barcode manually.", cameraOnly: true };
    }

    try {
      detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"]
      });
    } catch (err) {
      return { ok: false, message: "Barcode scanner unavailable. Please enter the barcode manually.", cameraOnly: true };
    }

    scanLoop(videoEl);
    return { ok: true, message: "Scanner started." };
  }

  function scanLoop(videoEl) {
    const tick = async () => {
      if (!detector || !stream) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes && codes.length) {
          const value = codes[0].rawValue;
          stop();
          if (onDetectedCallback) onDetectedCallback(value);
          return;
        }
      } catch (err) {
        // detection error on a frame; keep trying
      }
      scanLoopId = requestAnimationFrame(tick);
    };
    scanLoopId = requestAnimationFrame(tick);
  }

  function stop() {
    if (scanLoopId) cancelAnimationFrame(scanLoopId);
    scanLoopId = null;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    detector = null;
  }

  return { isSupported, isCameraAvailable, start, stop };
})();
