// Name: NekoTrackingFace
// ID: NekoTrackingFace
// Description: カメラを使用してローカルで顔の各パーツをトラッキングします
// By: nyantorusabu
// License: MIT

(function(Scratch) {
  'use strict';

  const SCRATCH_WIDTH = 480;
  const SCRATCH_HEIGHT = 360;

  const FACE_PARTS = {
    '鼻 (Nose Tip)': 1, '口の中心 (Mouth Center)': 13, '左目 (Left Eye - Inner)': 133,
    '右目 (Right Eye - Inner)': 362, '左耳 (Left Ear)': 234, '右耳 (Right Ear)': 454, '顎 (Chin)': 152,
  };

  const MOUTH_LANDMARKS = { TOP: 13, BOTTOM: 14, LEFT: 61, RIGHT: 291 };
  const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
  const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];

  const DEFAULT_MOUTH_AR_MAX = 0.6, MOUTH_AR_MIN = 0.05;
  const DEFAULT_EYE_AR_MAX = 0.38, EYE_AR_MIN = 0.15;

  const NOT_ACTIVE_VALUE = "not_active";

  class NekoTrackingFace {
    constructor(runtime) {
      this.runtime = runtime;
      this.video = null;
      this.vision = null;
      this.faceLandmarker = null;

      this.isInitialized = false;
      this.cameraFlipped = true;
      this.isFaceActive = false;

      this.mouthSensitivity = 1.0;
      this.leftEyeSensitivity = 1.0;
      this.rightEyeSensitivity = 1.0;

      // predictionRate: 0 = auto (use rAF / display FPS), >0 = fixed rate (Hz)
      this.predictionRate = 30;
      this.autoFPS = false;

      // trackingPrecision: 1=low,2=mid,3=high,4=max(original/native)
      this.trackingPrecision = 2;

      this.lastFaceResult = null;
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
        console.error("NekoTracking Initialization Error:", e);
      }
    }

    async createLandmarkers() {
       const filesetResolver = await this.vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
       this.faceLandmarker = await this.vision.FaceLandmarker.createFromOptions(filesetResolver, {
         baseOptions: {
           modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
           delegate: "GPU"
         },
         runningMode: "VIDEO",
         numFaces: 1
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
            case 4: // 最高（元の画質）: 制約を空にしてブラウザにデフォルト（カメラのネイティブ）を任せる
                constraints = {}; break;
            case 2: default: constraints = { width: 480, height: 360 }; break;
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
            this.video.srcObject = stream;
            await new Promise(resolve => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
        }
    }

    startPrediction() {
      // stop any previous loop
      if (this.predictionLoopTimeout) {
        clearTimeout(this.predictionLoopTimeout);
        this.predictionLoopTimeout = null;
      }
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      const runPredictOnce = () => {
        try {
          if (this.isFaceActive && this.isInitialized && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
            const startTimeMs = performance.now();
            this.lastFaceResult = this.faceLandmarker.detectForVideo(this.video, startTimeMs);
          } else {
            this.lastFaceResult = null;
          }
        } catch (e) {
          console.error("Prediction loop error:", e);
          this.lastFaceResult = null;
        }
      };

      if (this.autoFPS || this.predictionRate === 0) {
        // Auto mode: sync to display frame rate via requestAnimationFrame
        const loop = () => {
          runPredictOnce();
          this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
      } else {
        // Fixed-rate mode: use setTimeout with configured rate (no artificial upper bound)
        const period = 1000 / Math.max(1, this.predictionRate);
        const predictLoop = () => {
          runPredictOnce();
          this.predictionLoopTimeout = setTimeout(predictLoop, period);
        };
        predictLoop();
      }
    }

    getInfo() {
      return {
        id: 'NekoTrackingFace',
        name: 'NekoTracking (Face)',
        color1: '#4A90E2',
        color2: '#4482CB',
        blocks: [
          {
            opcode: 'setTrackingState', blockType: Scratch.BlockType.COMMAND,
            text: '顔のトラッキングを[STATE]にする',
            arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } }
          },
          { opcode: 'isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '顔のトラッキングをしている' },
          '---',
          {
            opcode: 'setCameraFlip', blockType: Scratch.BlockType.COMMAND,
            text: 'カメラの反転を[STATE]にする',
            arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } }
          },
          { opcode: 'isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転' },
          '---',
          {
            opcode: 'setPredictionRate', blockType: Scratch.BlockType.COMMAND,
            text: 'トラッキングの処理レートを[RATE]にする',
            arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } }
          },
          { opcode: 'getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート' },
          {
            opcode: 'setTrackingPrecision', blockType: Scratch.BlockType.COMMAND,
            text: 'トラッキングの精度を[PRECISION]にする',
            arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } }
          },
          { opcode: 'getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度' },
          '---',
          {
            opcode: 'getFacePartPosition', blockType: Scratch.BlockType.REPORTER,
            text: '顔のパーツ[PART]の[AXIS]座標',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'FACE_PART_MENU', defaultValue: '鼻 (Nose Tip)' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } }
          },
          { opcode: 'getMouthOpenness', blockType: Scratch.BlockType.REPORTER, text: '口の開き具合' },
          {
            opcode: 'getEyeOpenness', blockType: Scratch.BlockType.REPORTER,
            text: '[EYE]の開き具合',
            arguments: { EYE: { type: Scratch.ArgumentType.STRING, menu: 'EYE_MENU', defaultValue: 'right' } }
          },
          '---',
          {
            opcode: 'setSensitivity', blockType: Scratch.BlockType.COMMAND,
            text: '[PART]の感度を[SENSITIVITY]にする',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'SENSITIVITY_PART_MENU', defaultValue: '口' }, SENSITIVITY: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1.0 } }
          },
          {
            opcode: 'getSensitivity', blockType: Scratch.BlockType.REPORTER,
            text: '[PART]の感度',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'SENSITIVITY_PART_MENU', defaultValue: '口' } }
          }
        ],
        menus: {
          TRACKING_STATE_MENU: { acceptReporters: true, items: [{text: '開始', value: 'start'}, {text: '停止', value: 'stop'}] },
          FLIP_STATE_MENU: { acceptReporters: true, items: [{text: '有効', value: 'true'}, {text: '無効', value: 'false'}] },
          // PRECISION_MENU に '最高' (value: 4) を追加
          PRECISION_MENU: { acceptReporters: true, items: [{text: '最高', value: '4'}, {text: '高', value: '3'}, {text: '中', value: '2'}, {text: '低', value: '1'}] },
          AXIS_MENU: { acceptReporters: true, items: ['x', 'y'] },
          EYE_MENU: { acceptReporters: true, items: [{text: '右目', value: 'right'}, {text: '左目', value: 'left'}] },
          SENSITIVITY_PART_MENU: { acceptReporters: true, items: ['口', '右目', '左目'] },
          FACE_PART_MENU: { acceptReporters: true, items: Object.keys(FACE_PARTS).map(name => ({ text: name, value: name })) },
        }
      };
    }
    
    setTrackingState(args) { this.isFaceActive = (args.STATE === 'start'); }
    isTrackingActive() { return this.isFaceActive; }
    setCameraFlip(args) { this.cameraFlipped = (args.STATE === 'true'); }
    isCameraFlipped() { return this.cameraFlipped; }

    setPredictionRate(args) {
        const raw = Number(args.RATE);
        if (!isFinite(raw) || raw <= 0) {
            // 0 または無効な値は自動モード（TurboWarpのFPSに合わせる）にする
            this.predictionRate = 0;
            this.autoFPS = true;
        } else {
            // 上限は設けない（ユーザーが高い値を指定できる）
            this.predictionRate = Math.max(0, Math.floor(raw));
            this.autoFPS = false;
        }
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
    _getFlippedPartName(partName) {
        // カメラミラー時に "左"/"右" を入れ替えた対応するキーを正しく探す
        // 例: "左目 (Left Eye - Inner)" -> "右目 (Right Eye - Inner)"
        if (!this.cameraFlipped) return partName;
        try {
            // 日本語のパーツ名（空白または"("の前まで）を切り出す
            const jp = (partName.split(' ')[0] || partName.split('(')[0]).trim();
            let swapped = null;
            if (jp.startsWith('左')) swapped = jp.replace('左', '右');
            else if (jp.startsWith('右')) swapped = jp.replace('右', '左');
            if (swapped) {
                const keys = Object.keys(FACE_PARTS);
                const candidate = keys.find(k => (k.split(' ')[0] || k.split('(')[0]).trim() === swapped);
                if (candidate) return candidate;
            }
        } catch (e) {
            console.warn('_flip detection failed', e);
        }
        return partName;
    }
    _getCoordinate(landmark, axis) {
        if (!landmark) return 0;
        if (axis === 'y') return (0.5 - landmark.y) * SCRATCH_HEIGHT;
        if (axis === 'x') {
            const x = this.cameraFlipped ? (1.0 - landmark.x) : landmark.x;
            return (x - 0.5) * SCRATCH_WIDTH;
        }
        return 0;
    }
    setSensitivity(args) {
        const sensitivity = Math.max(0, Math.min(2, Number(args.SENSITIVITY) || 0));
        switch (args.PART) { case '口': this.mouthSensitivity = sensitivity; break; case '左目': this.leftEyeSensitivity = sensitivity; break; case '右目': this.rightEyeSensitivity = sensitivity; break; }
    }
    getSensitivity(args) {
        switch (args.PART) { case '口': return this.mouthSensitivity; case '左目': return this.leftEyeSensitivity; case '右目': return this.rightEyeSensitivity; } return 0;
    }

    getFacePartPosition(args) {
      if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
      const partName = this._getFlippedPartName(args.PART);
      const partIndex = FACE_PARTS[partName];
      const landmark = this.lastFaceResult.faceLandmarks[0][partIndex];
      return this._getCoordinate(landmark, args.AXIS);
    }
    getMouthOpenness() {
        if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
        const landmarks = this.lastFaceResult.faceLandmarks[0];
        const top = landmarks[MOUTH_LANDMARKS.TOP], bottom = landmarks[MOUTH_LANDMARKS.BOTTOM], left = landmarks[MOUTH_LANDMARKS.LEFT], right = landmarks[MOUTH_LANDMARKS.RIGHT];
        if (!top || !bottom || !left || !right) return 0;
        const vDist = Math.hypot(top.x - bottom.x, top.y - bottom.y), hDist = Math.hypot(left.x - right.x, left.y - right.y);
        if (hDist === 0) return 0;
        const ratio = vDist / hDist;
        const currentMax = DEFAULT_MOUTH_AR_MAX / Math.max(0.01, this.mouthSensitivity);
        let openness = (ratio - MOUTH_AR_MIN) / (currentMax - MOUTH_AR_MIN);
        return Math.max(0, Math.min(1, openness));
    }
    getEyeOpenness(args) {
        if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
        const eye = this.cameraFlipped ? (args.EYE === 'left' ? 'right' : 'left') : args.EYE;
        const landmarks = this.lastFaceResult.faceLandmarks[0];
        const eyeIndices = eye === 'left' ? LEFT_EYE_LANDMARKS : RIGHT_EYE_LANDMARKS;
        const sensitivity = args.EYE === 'left' ? this.leftEyeSensitivity : this.rightEyeSensitivity;
        const dist = (pA, pB) => Math.hypot(pA.x - pB.x, pA.y - pB.y);
        try {
            const p = eyeIndices.map(i => landmarks[i]);
            if (p.some(point => !point)) return 0;
            const v1 = dist(p[1], p[5]), v2 = dist(p[2], p[4]), h = dist(p[0], p[3]);
            if (h === 0) return 0;
            const ear = (v1 + v2) / (2 * h);
            const currentMax = DEFAULT_EYE_AR_MAX / Math.max(0.01, sensitivity);
            let openness = (ear - EYE_AR_MIN) / (currentMax - EYE_AR_MIN);
            return Math.max(0, Math.min(1, openness));
        } catch { return 0; }
    }
  }

  Scratch.extensions.register(new NekoTrackingFace());
})(Scratch);
