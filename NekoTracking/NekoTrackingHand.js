// Name: NekoTrackingHand
// ID: NekoTrackingHand
// Description: カメラを使用してローカルで手の各パーツをトラッキングします
// By: nyantorusabu
// License: MIT

(function(Scratch) {
  'use strict';

  const SCRATCH_WIDTH = 480;
  const SCRATCH_HEIGHT = 360;
  const NOT_ACTIVE_VALUE = "not_active";

  // MediaPipe Hand landmark indices (0..20)
  const HAND_PARTS = {
  "手首": 0,
  "親指_付け根": 1,
  "親指_第1関節": 2,
  "親指_先端": 3,
  "人差し指_付け根": 4,
  "人差し指_第1関節": 5,
  "人差し指_第2関節": 6,
  "人差し指_先端": 7,
  "中指_付け根": 8,
  "中指_第1関節": 9,
  "中指_第2関節": 10,
  "中指_先端": 11,
  "薬指_付け根": 12,
  "薬指_第1関節": 13,
  "薬指_第2関節": 14,
  "薬指_先端": 15,
  "小指_付け根": 16,
  "小指_第1関節": 17,
  "小指_第2関節": 18,
  "小指_先端": 19
};


  class NekoTrackingHand {
    constructor(runtime) {
      this.runtime = runtime;
      this.video = null;
      this.vision = null;
      this.handLandmarker = null;

      this.isInitialized = false;
      this.cameraFlipped = true; // デフォルトで鏡像（セルフィー）として扱う
      this.isHandActive = false;

      // predictionRate: 0 = auto via rAF, >0 fixed Hz
      this.predictionRate = 30;
      this.autoFPS = false;

      // trackingPrecision: 1=low,2=mid,3=high,4=max
      this.trackingPrecision = 2;

      this.lastHandResult = null;
      this.predictionLoopTimeout = null;
      this.rafId = null;

      this.loadAndInit();
    }

    async loadAndInit() {
      try {
        if (!this.vision) {
          const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js');
          this.vision = visionModule;
        }
        await this.createLandmarkers();
        await this.setupWebcam();
        this.startPrediction();
        this.isInitialized = true;
      } catch (e) {
        console.error("NekoTrackingHand Initialization Error:", e);
      }
    }

    async createLandmarkers() {
      const filesetResolver = await this.vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      this.handLandmarker = await this.vision.HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
    }

    async setupWebcam() {
      if (this.video && this.video.srcObject) {
        this.video.srcObject.getTracks().forEach(track => track.stop());
      }
      if (!this.video) {
        this.video = document.createElement("video");
        this.video.style.display = "none";
        document.body.appendChild(this.video);
      }

      let constraints = {};
      switch(this.trackingPrecision) {
        case 1: constraints = { width: 320, height: 240 }; break;
        case 3: constraints = { width: 640, height: 480 }; break;
        case 4: constraints = {}; break;
        case 2: default: constraints = { width: 480, height: 360 }; break;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        this.video.srcObject = stream;
        await new Promise(resolve => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
      }
    }

    startPrediction() {
      if (this.predictionLoopTimeout) { clearTimeout(this.predictionLoopTimeout); this.predictionLoopTimeout = null; }
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }

      const runPredictOnce = () => {
        try {
          if (this.isHandActive && this.isInitialized && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
            const startTimeMs = performance.now();
            this.lastHandResult = this.handLandmarker.detectForVideo(this.video, startTimeMs);
          } else {
            this.lastHandResult = null;
          }
        } catch (e) {
          console.error("Prediction loop error:", e);
          this.lastHandResult = null;
        }
      };

      if (this.autoFPS || this.predictionRate === 0) {
        const loop = () => { runPredictOnce(); this.rafId = requestAnimationFrame(loop); };
        this.rafId = requestAnimationFrame(loop);
      } else {
        const period = 1000 / Math.max(1, this.predictionRate);
        const predictLoop = () => { runPredictOnce(); this.predictionLoopTimeout = setTimeout(predictLoop, period); };
        predictLoop();
      }
    }

    getInfo() {
      return {
        id: 'NekoTrackingHand',
        name: 'NekoTracking (Hand)',
        color1: '#4A90E2',
        color2: '#4482CB',
        blocks: [
          { opcode: 'setTrackingState', blockType: Scratch.BlockType.COMMAND, text: '手のトラッキングを[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } } },
          { opcode: 'isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '手のトラッキングをしている' },
          '---',
          { opcode: 'setCameraFlip', blockType: Scratch.BlockType.COMMAND, text: 'カメラの反転を[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } } },
          { opcode: 'isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転' },
          '---',
          { opcode: 'setPredictionRate', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの処理レートを[RATE]にする', arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } } },
          { opcode: 'getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート' },
          { opcode: 'setTrackingPrecision', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの精度を[PRECISION]にする', arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } } },
          { opcode: 'getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度' },
          '---',
          { opcode: 'getHandPartPosition', blockType: Scratch.BlockType.REPORTER, text: '[HAND]手のパーツ[PART]の[AXIS]座標', arguments: { HAND: { type: Scratch.ArgumentType.STRING, menu: 'HAND_SIDE_MENU', defaultValue: 'right' }, PART: { type: Scratch.ArgumentType.STRING, menu: 'HAND_PART_MENU', defaultValue: '親指_先端' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } } },
        ],
        menus: {
          TRACKING_STATE_MENU: { acceptReporters: true, items: [{text: '開始', value: 'start'}, {text: '停止', value: 'stop'}] },
          FLIP_STATE_MENU: { acceptReporters: true, items: [{text: '有効', value: 'true'}, {text: '無効', value: 'false'}] },
          PRECISION_MENU: { acceptReporters: true, items: [{text: '最高', value: '4'}, {text: '高', value: '3'}, {text: '中', value: '2'}, {text: '低', value: '1'}] },
          HAND_SIDE_MENU: { acceptReporters: true, items: [{text: '右', value: 'right'}, {text: '左', value: 'left'}] },
          AXIS_MENU: { acceptReporters: true, items: ['x', 'y'] },
          HAND_PART_MENU: { acceptReporters: true, items: Object.keys(HAND_PARTS).map(name => ({ text: name, value: name })) }
        }
      };
    }

    setTrackingState(args) { this.isHandActive = (args.STATE === 'start'); }
    isTrackingActive() { return this.isHandActive; }
    setCameraFlip(args) { this.cameraFlipped = (args.STATE === 'true'); }
    isCameraFlipped() { return this.cameraFlipped; }

    setPredictionRate(args) {
      const raw = Number(args.RATE);
      if (!isFinite(raw) || raw <= 0) { this.predictionRate = 0; this.autoFPS = true; }
      else { this.predictionRate = Math.max(0, Math.floor(raw)); this.autoFPS = false; }
      this.startPrediction();
    }
    getPredictionRate() { return this.predictionRate; }

    setTrackingPrecision(args) {
      const newPrecision = parseInt(args.PRECISION, 10);
      if (this.trackingPrecision === newPrecision) return;
      this.trackingPrecision = newPrecision;
      this.setupWebcam().catch(e => console.error("Failed to reset webcam", e));
    }
    getTrackingPrecision() { return this.trackingPrecision; }

    _getCoordinate(landmark, axis) {
      if (!landmark) return 0;
      if (axis === 'y') return (0.5 - landmark.y) * SCRATCH_HEIGHT;
      if (axis === 'x') {
        const x = this.cameraFlipped ? (1.0 - landmark.x) : landmark.x;
        return (x - 0.5) * SCRATCH_WIDTH;
      }
      return 0;
    }

    _findHandIndexBySide(side) {
      if (!this.lastHandResult) return -1;

      // landmarks / handedness array extraction (compatible with various outputs)
      const handednessList = this.lastHandResult.handedness || this.lastHandResult.handednesses || this.lastHandResult.multiHandedness || this.lastHandResult.handedness_list || [];
      const landmarksList = this.lastHandResult.handLandmarks || this.lastHandResult.hand_landmarks || this.lastHandResult.multiHandLandmarks || this.lastHandResult.landmarks || [];

      if (!Array.isArray(landmarksList) || landmarksList.length === 0) return -1;

      // If camera is flipped (mirror/selfie), MediaPipe's handedness labels are effectively mirrored,
      // so we invert the requested side in that case to match the user's expectation.
      let requestedSide = side; // 'right' | 'left'
      if (this.cameraFlipped) {
        requestedSide = (String(side).toLowerCase() === 'left') ? 'right' : 'left';
      }

      // Determine desired label in model output ('Left'/'Right')
      const desired = (requestedSide === 'left') ? 'Left' : 'Right';

      // Try to match handedness entries
      for (let i = 0; i < Math.min(landmarksList.length, handednessList.length || 0); i++) {
        const h = handednessList[i] || {};
        const label = (h.label || h.labelName || h.categoryName || (h.score && h.label)) || null;
        if (!label) continue;
        if (String(label).toLowerCase().startsWith(desired.toLowerCase())) return i;
      }

      // fallback: return first detected hand
      return 0;
    }

    getHandPartPosition(args) {
      if (!this.isHandActive || !this.lastHandResult) return NOT_ACTIVE_VALUE;

      const landmarksList = this.lastHandResult.handLandmarks || this.lastHandResult.hand_landmarks || this.lastHandResult.multiHandLandmarks || this.lastHandResult.landmarks || [];
      if (!Array.isArray(landmarksList) || landmarksList.length === 0) return NOT_ACTIVE_VALUE;

      const partName = args.PART;
      const partIndex = HAND_PARTS[partName];
      if (partIndex === undefined) return 0;

      const handIndex = this._findHandIndexBySide(args.HAND);
      if (handIndex < 0 || !landmarksList[handIndex]) return NOT_ACTIVE_VALUE;

      const landmark = landmarksList[handIndex][partIndex];
      return this._getCoordinate(landmark, args.AXIS);
    }

  }

  Scratch.extensions.register(new NekoTrackingHand());
})(Scratch);
