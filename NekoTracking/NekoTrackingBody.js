// Name: NekoTrackingBody
// ID: NekoTrackingBody
// Description: カメラを使用してローカルで体の各パーツをトラッキングします
// By: nyantorusabu
// License: MIT

(function(Scratch) {
  'use strict';

  const SCRATCH_WIDTH = 480;
  const SCRATCH_HEIGHT = 360;
  const NOT_ACTIVE_VALUE = "not_active";

  // 主要パーツのみ（日本語の横に英語名を併記）
  // フォーマット: '日本語名 (English Name)': index
  const BODY_PARTS = {
    "鼻 (Nose Tip)": 0,
    "左肩 (Left Shoulder)": 11,
    "右肩 (Right Shoulder)": 12,
    "左肘 (Left Elbow)": 13,
    "右肘 (Right Elbow)": 14,
    "左手首 (Left Wrist)": 15,
    "右手首 (Right Wrist)": 16,
    "左股関節 (Left Hip)": 23,
    "右股関節 (Right Hip)": 24,
    "左膝 (Left Knee)": 25,
    "右膝 (Right Knee)": 26,
    "左足首 (Left Ankle)": 27,
    "右足首 (Right Ankle)": 28
  };

  class NekoTrackingBody {
    constructor(runtime) {
      this.runtime = runtime;
      this.video = null;
      this.vision = null;
      this.poseLandmarker = null;

      this.isInitialized = false;
      this.cameraFlipped = true;
      this.isActive = false;

      this.predictionRate = 30;
      this.autoFPS = false;

      this.trackingPrecision = 2;

      this.lastPoseResult = null;
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
        await this.createLandmarker();
        await this.setupWebcam();
        this.isInitialized = true;
        this.startPrediction();
        console.info("NekoTrackingBody (major parts) initialized.");
      } catch (e) {
        console.error("NekoTrackingBody Initialization Error:", e);
      }
    }

    async createLandmarker() {
      const filesetResolver = await this.vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      const MODEL_URL = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;
      const options = {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.25,
        minPosePresenceConfidence: 0.2,
        minTrackingConfidence: 0.2
      };
      this.poseLandmarker = await this.vision.PoseLandmarker.createFromOptions(filesetResolver, options);
      if (typeof this.poseLandmarker.setOptions === 'function') {
        try {
          await this.poseLandmarker.setOptions({
            minPoseDetectionConfidence: 0.25,
            minPosePresenceConfidence: 0.2,
            minTrackingConfidence: 0.2
          });
        } catch (e) {
          console.debug("setOptions not available or failed:", e);
        }
      }
    }

    async setupWebcam() {
      if (this.video && this.video.srcObject) {
        this.video.srcObject.getTracks().forEach(track => track.stop());
      }
      if (!this.video) {
        this.video = document.createElement("video");
        this.video.style.display = "none";
        this.video.setAttribute("playsinline", "");
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
      } else {
        throw new Error("navigator.mediaDevices.getUserMedia is not available");
      }
    }

    startPrediction() {
      if (this.predictionLoopTimeout) { clearTimeout(this.predictionLoopTimeout); this.predictionLoopTimeout = null; }
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }

      const runPredictOnce = async () => {
        try {
          if (!this.isInitialized) return;
          if (this.isActive && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0 && this.poseLandmarker) {
            const startTimeMs = performance.now();
            const result = await this.poseLandmarker.detectForVideo(this.video, startTimeMs);
            this.lastPoseResult = result;
            if (typeof console !== 'undefined' && Math.random() < 0.02) {
              console.debug("Pose result sample:", {
                hasPoseLandmarks: !!(result && (result.poseLandmarks || result.landmarks || result.pose_landmarks)),
                resultKeys: result ? Object.keys(result) : null,
                landmarksLen: (result && (result.poseLandmarks && result.poseLandmarks.length) || (result.landmarks && result.landmarks.length) || null)
              });
            }
          } else {
            this.lastPoseResult = null;
          }
        } catch (e) {
          console.error("Prediction loop error:", e);
          this.lastPoseResult = null;
        }
      };

      if (this.autoFPS || this.predictionRate === 0) {
        const loop = async () => { await runPredictOnce(); this.rafId = requestAnimationFrame(loop); };
        this.rafId = requestAnimationFrame(loop);
      } else {
        const period = 1000 / Math.max(1, this.predictionRate);
        const predictLoop = async () => { await runPredictOnce(); this.predictionLoopTimeout = setTimeout(predictLoop, period); };
        predictLoop();
      }
    }

    getInfo() {
      return {
        id: 'NekoTrackingBody',
        name: 'NekoTracking (Body)',
        color1: '#4A90E2',
        color2: '#4482CB',
        blocks: [
          { opcode: 'setTrackingState', blockType: Scratch.BlockType.COMMAND, text: '体のトラッキングを[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } } },
          { opcode: 'isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '体のトラッキングをしている' },
          '---',
          { opcode: 'setCameraFlip', blockType: Scratch.BlockType.COMMAND, text: 'カメラの反転を[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } } },
          { opcode: 'isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転' },
          '---',
          { opcode: 'setPredictionRate', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの処理レートを[RATE]にする', arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } } },
          { opcode: 'getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート' },
          { opcode: 'setTrackingPrecision', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの精度を[PRECISION]にする', arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } } },
          { opcode: 'getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度' },
          '---',
          { opcode: 'getBodyPartPosition', blockType: Scratch.BlockType.REPORTER, text: '体のパーツ[PART]の[AXIS]座標', arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'BODY_PART_MENU', defaultValue: '左手首 (Left Wrist)' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } } }
        ],
        menus: {
          TRACKING_STATE_MENU: { acceptReporters: true, items: [{text: '開始', value: 'start'}, {text: '停止', value: 'stop'}] },
          FLIP_STATE_MENU: { acceptReporters: true, items: [{text: '有効', value: 'true'}, {text: '無効', value: 'false'}] },
          PRECISION_MENU: { acceptReporters: true, items: [{text: '最高', value: '4'}, {text: '高', value: '3'}, {text: '中', value: '2'}, {text: '低', value: '1'}] },
          AXIS_MENU: { acceptReporters: true, items: ['x', 'y'] },
          BODY_PART_MENU: { acceptReporters: true, items: Object.keys(BODY_PARTS).map(name => ({ text: name, value: name })) }
        }
      };
    }

    setTrackingState(args) { this.isActive = (args.STATE === 'start'); }
    isTrackingActive() { return this.isActive; }
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

    _getCoordinateSafe(landmark, axis) {
      if (!landmark) return NOT_ACTIVE_VALUE;
      const xVal = (landmark.x !== undefined) ? Number(landmark.x) : NaN;
      const yVal = (landmark.y !== undefined) ? Number(landmark.y) : NaN;
      if (!isFinite(xVal) || !isFinite(yVal)) return NOT_ACTIVE_VALUE;
      if (axis === 'y') return (0.5 - yVal) * SCRATCH_HEIGHT;
      if (axis === 'x') {
        const xf = this.cameraFlipped ? (1.0 - xVal) : xVal;
        return (xf - 0.5) * SCRATCH_WIDTH;
      }
      return NOT_ACTIVE_VALUE;
    }

    _extractLandmarks(result) {
      if (!result) return null;
      if (Array.isArray(result.poseLandmarks) && result.poseLandmarks.length > 0) return result.poseLandmarks;
      if (Array.isArray(result.landmarks) && result.landmarks.length > 0) {
        if (result.landmarks.length >= 33 && typeof result.landmarks[0].x === 'number') return result.landmarks;
        if (Array.isArray(result.landmarks[0]) && result.landmarks[0].length >= 33) return result.landmarks[0];
      }
      if (Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          if (result[i] && Array.isArray(result[i].poseLandmarks) && result[i].poseLandmarks.length >= 33) return result[i].poseLandmarks;
          if (result[i] && Array.isArray(result[i].landmarks) && result[i].landmarks.length >= 33) {
            return (Array.isArray(result[i].landmarks[0]) ? result[i].landmarks[0] : result[i].landmarks);
          }
        }
      }
      if (result.pose_landmarks && Array.isArray(result.pose_landmarks) && result.pose_landmarks.length > 0) return result.pose_landmarks;
      return null;
    }

    getBodyPartPosition(args) {
      if (!this.isActive || !this.lastPoseResult) return NOT_ACTIVE_VALUE;
      const landmarksList = this._extractLandmarks(this.lastPoseResult);
      if (!Array.isArray(landmarksList) || landmarksList.length < 1) return NOT_ACTIVE_VALUE;
      const partName = args.PART;
      const partIndex = BODY_PARTS[partName];
      if (partIndex === undefined) return 0;
      const landmark = landmarksList[partIndex];
      const coord = this._getCoordinateSafe(landmark, args.AXIS);
      if (coord === NOT_ACTIVE_VALUE || !isFinite(coord)) return NOT_ACTIVE_VALUE;
      return coord;
    }
  }

  Scratch.extensions.register(new NekoTrackingBody());
})(Scratch);
