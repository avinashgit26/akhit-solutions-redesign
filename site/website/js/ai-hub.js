(() => {
  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("ai-js-enabled");
  const script = document.currentScript;
  const siteRoot = new URL(script?.dataset.siteRoot || "../../", script?.src || window.location.href);
  const toSite = path => new URL(path, siteRoot).href;

  // Progressive WebGL nebula background. The CSS background remains visible
  // if WebGL2 is unavailable or shader setup fails.
  const canvas = document.querySelector(".ai-nebula-canvas");
  if (canvas) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
    if (gl) {
      const vertexSource = `#version 300 es
        void main() {
          vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
          gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
        }`;
      const fragmentSource = `#version 300 es
        precision highp float;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uCell;
        uniform vec2 uPointer;
        uniform float uPointerOn;
        out vec4 outColor;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float value = 0.0, weight = 0.5;
          for (int i = 0; i < 4; i++) {
            value += noise2(p) * weight;
            p = mat2(1.62, 1.18, -1.18, 1.62) * p + 7.1;
            weight *= 0.5;
          }
          return value;
        }
        void main() {
          vec2 pixel = floor(gl_FragCoord.xy / uCell);
          vec2 center = (pixel + 0.5) * uCell;
          vec2 uv = center / uResolution;
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
          float t = uTime * 0.035;
          vec2 warped = p * vec2(2.8, 2.0);
          warped += 0.42 * vec2(fbm(warped + vec2(t, -t * 0.7)), fbm(warped + vec2(4.3 - t, t)));
          float cloud = fbm(warped + vec2(1.8, -2.6));
          float band = exp(-pow((p.y + p.x * 0.43 + 0.04) * 2.9, 2.0));
          float edge = 1.0 - smoothstep(0.08, 0.78, length(p * vec2(0.75, 1.5)));
          float gas = smoothstep(0.28, 0.79, cloud) * band * edge;

          float pointerGlow = exp(-distance(uv, uPointer) * 12.0) * uPointerOn * 0.22;
          gas = clamp(gas + pointerGlow, 0.0, 1.0);
          vec2 local = fract(gl_FragCoord.xy / uCell) - 0.5;
          float dotRadius = mix(0.12, 0.56, smoothstep(0.06, 0.8, gas));
          float dotShape = 1.0 - smoothstep(dotRadius - 0.035, dotRadius + 0.04, length(local));

          vec3 voidTone = vec3(0.018, 0.025, 0.055);
          vec3 dimTone = vec3(0.08, 0.09, 0.22);
          vec3 violet = vec3(0.29, 0.20, 0.55);
          vec3 cyan = vec3(0.18, 0.66, 0.78);
          vec3 ink = mix(voidTone, dimTone, smoothstep(0.05, 0.75, gas) * 0.8);
          vec3 glow = mix(violet, cyan, smoothstep(0.34, 0.9, uv.x + gas * 0.2));
          vec3 color = mix(ink, glow, dotShape * smoothstep(0.08, 0.72, gas) * 0.9);

          vec2 starCell = floor(gl_FragCoord.xy / (uCell * 3.0));
          float starSeed = hash21(starCell);
          vec2 starLocal = fract(gl_FragCoord.xy / (uCell * 3.0)) - 0.5;
          float star = step(0.991, starSeed) * (1.0 - smoothstep(0.045, 0.11, length(starLocal)));
          float sparkle = step(0.998, starSeed) * (1.0 - smoothstep(0.015, 0.035, min(abs(starLocal.x), abs(starLocal.y))));
          color += vec3(0.56, 0.83, 1.0) * (star + sparkle * 0.42) * (0.65 + 0.35 * sin(uTime * 1.2 + starSeed * 30.0));
          color += vec3(0.12, 0.4, 0.55) * pointerGlow * dotShape;
          outColor = vec4(color, clamp(max(gas * 0.78, star * 0.75 + sparkle * 0.45), 0.0, 0.85));
        }`;

      const compile = (kind, source) => {
        const shader = gl.createShader(kind);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      const program = vertex && fragment ? gl.createProgram() : null;
      if (program) {
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
      }
      if (program && gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const uniforms = Object.fromEntries(["uResolution", "uTime", "uCell", "uPointer", "uPointerOn"].map(name => [name, gl.getUniformLocation(program, name)]));
        const hero = canvas.closest(".ai-hero");
        let pointer = [0.72, 0.48], pointerOn = 0, frame = 0, inView = true, startTime = performance.now(), lastFrame = 0;
        const resize = () => {
          const box = canvas.getBoundingClientRect();
          // The halftone pattern is intentionally low-resolution; capping its
          // render scale keeps the animated shader light on mobile GPUs.
          const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * 0.76;
          const width = Math.max(1, Math.floor(box.width * dpr));
          const height = Math.max(1, Math.floor(box.height * dpr));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
          }
          gl.useProgram(program);
          gl.uniform2f(uniforms.uResolution, width, height);
          gl.uniform1f(uniforms.uCell, 7.0 * dpr);
          draw();
        };
        const draw = (now = performance.now()) => {
          if (!reducedMotion.matches && now - lastFrame < 32) {
            frame = requestAnimationFrame(draw);
            return;
          }
          lastFrame = now;
          gl.useProgram(program);
          gl.uniform1f(uniforms.uTime, reducedMotion.matches ? 0 : (now - startTime) / 1000);
          gl.uniform2f(uniforms.uPointer, pointer[0], pointer[1]);
          gl.uniform1f(uniforms.uPointerOn, pointerOn);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (inView && !reducedMotion.matches) frame = requestAnimationFrame(draw);
        };
        const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
        const start = () => { if (!frame) draw(); };
        hero?.addEventListener("pointermove", event => {
          const rect = canvas.getBoundingClientRect();
          pointer = [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height];
          pointerOn = 1;
        }, { passive: true });
        hero?.addEventListener("pointerleave", () => { pointerOn = 0; }, { passive: true });
        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
        else window.addEventListener("resize", resize, { passive: true });
        if ("IntersectionObserver" in window) {
          new IntersectionObserver(entries => {
            inView = entries[0]?.isIntersecting ?? true;
            inView ? start() : stop();
          }, { threshold: 0.01 }).observe(canvas);
        }
        reducedMotion.addEventListener?.("change", () => { stop(); start(); });
        resize();
      } else {
        canvas.hidden = true;
      }
    } else {
      canvas.hidden = true;
    }
  }

  // The preview assistant is intentionally local and informational; it does
  // not contact a model or send visitor details to a service.
  const launcher = document.getElementById("assistant-launcher");
  const panel = document.getElementById("assistant-panel");
  const closeButton = document.getElementById("assistant-close");
  const input = document.getElementById("assistant-input");
  const form = document.getElementById("assistant-form");
  const messages = document.getElementById("assistant-messages");
  const prompts = document.getElementById("assistant-prompts");
  const status = document.getElementById("assistant-status");
  const voiceButton = document.getElementById("assistant-voice");
  const privacy = document.getElementById("privacy-policy-panel");
  const robotIntro = document.getElementById("robot-intro");
  const robotBackdrop = document.getElementById("robot-backdrop");
  const robotSkip = document.getElementById("robot-intro-skip");
  const robotAsk = document.getElementById("robot-intro-ask");

  if (launcher && panel && form && messages) {
    const openAssistant = () => {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      input?.focus();
    };
    const closeAssistant = () => {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    };
    launcher.addEventListener("click", openAssistant);
    closeButton?.addEventListener("click", closeAssistant);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) closeAssistant();
    });
    if (robotIntro) {
      const seenKey = "akhRobotIntroSeen";
      let introTimer = 0;
      let collapseTimer = 0;
      let hasSeenIntro = false;
      let introClosing = false;
      let inertSnapshot = [];
      try { hasSeenIntro = sessionStorage.getItem(seenKey) === "1"; } catch (_) {}
      const markSeen = () => {
        hasSeenIntro = true;
        try { sessionStorage.setItem(seenKey, "1"); } catch (_) {}
      };
      const releaseBackground = () => {
        inertSnapshot.forEach(([node, wasInert]) => { node.inert = wasInert; });
        inertSnapshot = [];
        document.body.classList.remove("ai-robot-modal-open");
      };
      const finishIntro = (openChat = false) => {
        if (robotIntro.hidden || introClosing) return;
        introClosing = true;
        window.clearTimeout(collapseTimer);
        robotIntro.classList.add("is-collapsing");
        robotBackdrop?.classList.add("is-fading");
        window.setTimeout(() => {
          robotIntro.hidden = true;
          robotIntro.classList.remove("is-visible", "is-collapsing");
          if (robotBackdrop) {
            robotBackdrop.hidden = true;
            robotBackdrop.classList.remove("is-visible", "is-fading");
          }
          launcher.hidden = false;
          releaseBackground();
          introClosing = false;
          markSeen();
          if (openChat) openAssistant();
          else launcher.focus();
        }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 820);
      };
      const showIntro = () => {
        if (hasSeenIntro || !privacy?.hidden || !panel.hidden || !robotBackdrop) return;
        inertSnapshot = [...document.body.children]
          .filter(node => node !== robotIntro && node !== robotBackdrop && node.tagName !== "SCRIPT")
          .map(node => [node, node.inert]);
        inertSnapshot.forEach(([node]) => { node.inert = true; });
        document.body.classList.add("ai-robot-modal-open");
        launcher.hidden = true;
        robotBackdrop.hidden = false;
        robotIntro.hidden = false;
        window.requestAnimationFrame(() => {
          robotBackdrop.classList.add("is-visible");
          robotIntro.classList.add("is-visible");
          robotAsk?.focus();
        });
        collapseTimer = window.setTimeout(finishIntro, 6500);
      };
      const queueIntro = () => {
        if (hasSeenIntro || !privacy?.hidden) return;
        window.clearTimeout(introTimer);
        introTimer = window.setTimeout(showIntro, 650);
      };
      queueIntro();
      ["policy-accept-btn", "policy-reject-btn"].forEach(id => document.getElementById(id)?.addEventListener("click", queueIntro));
      robotSkip?.addEventListener("click", finishIntro);
      robotIntro.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); finishIntro(); return; }
        if (event.key !== "Tab") return;
        const controls = [...robotIntro.querySelectorAll("button:not(:disabled)")];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      robotAsk?.addEventListener("click", () => finishIntro(true));
      document.addEventListener("focusin", event => {
        if (!robotIntro.hidden && !robotIntro.contains(event.target) && event.target !== robotSkip) robotSkip?.focus();
      });
    }

    const addMessage = (text, who = "assistant", linkLabel = "", href = "") => {
      const bubble = document.createElement("p");
      bubble.className = `ai-assistant-message${who === "user" ? " user" : ""}`;
      bubble.textContent = text;
      if (linkLabel && href) {
        const link = document.createElement("a");
        link.className = "ai-assistant-link";
        link.href = toSite(href);
        link.textContent = linkLabel;
        bubble.append(document.createElement("br"), link);
      }
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    };
    const respond = question => {
      const q = String(question || "").toLowerCase();
      if (/price|pricing|cost|budget|quote/.test(q)) return ["The cost depends on the workflow, data and systems involved. A free AI fit session can help clarify a sensible first step; we do not quote before understanding the need.", "Explore a free AI fit session", "service/ai-fit-session.html"];
      if (/book|call|meeting|consult|talk|contact|session/.test(q)) return ["The free AI fit session is a conversation about one workflow and where AI may help. This preview cannot book a time or send a request.", "See the AI fit session", "service/ai-fit-session.html"];
      if (/safe|security|privacy|risk|governance|control/.test(q)) return ["A useful AI solution starts with the data, access and review needs of the workflow. We can help define evaluation and human-review points before expanding it."];
      if (/rag|knowledge|search|assistant|copilot/.test(q)) return ["AI assistants and retrieval-augmented generation can make existing knowledge easier to use, with answers grounded in the sources you choose.", "Explore AI Hub", "service/artificial-intelligence.html"];
      if (/automation|workflow|process|integrat|replace|rebuild|system/.test(q)) return ["The starting point is usually one repetitive step inside an existing process. We look for a small integration that can be evaluated before considering broader change.", "Explore AI Hub", "service/artificial-intelligence.html"];
      if (/ai|hub|capabilit|start|where/.test(q)) return ["AKH explores practical AI assistants, knowledge search, workflow automation, product features and evaluation. The right starting point depends on the work you want to improve.", "Explore AI Hub", "service/artificial-intelligence.html"];
      return ["I can explain AI use cases, costs, the fit session or how a first step can work with existing systems. This guided preview cannot provide a live quote or book a meeting."];
    };
    const send = text => {
      const question = String(text || "").trim();
      if (!question) return;
      addMessage(question, "user");
      input.value = "";
      const [answer, label, href] = respond(question);
      window.setTimeout(() => addMessage(answer, "assistant", label, href), 160);
    };
    form.addEventListener("submit", event => { event.preventDefault(); send(input?.value); });
    prompts?.addEventListener("click", event => {
      const button = event.target.closest("button[data-prompt]");
      if (button) send(button.dataset.prompt);
    });
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition && voiceButton) {
      voiceButton.disabled = true;
      voiceButton.title = "Voice input is unavailable here. You can type instead.";
    } else if (Recognition && voiceButton) {
      const recognition = new Recognition();
      recognition.lang = "en-GB";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => { voiceButton.setAttribute("aria-pressed", "true"); status.textContent = "Listening. Your browser may send audio to its speech service for transcription."; };
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) { input.value = [input.value.trim(), transcript].filter(Boolean).join(" "); input.focus(); status.textContent = "Voice input added. Review it, then select Send."; }
      };
      recognition.onerror = event => { status.textContent = event.error === "not-allowed" ? "Microphone access was not allowed. You can type instead." : "Voice input stopped. You can type instead."; };
      recognition.onend = () => voiceButton.setAttribute("aria-pressed", "false");
      voiceButton.addEventListener("click", () => {
        if (voiceButton.getAttribute("aria-pressed") === "true") { recognition.stop(); return; }
        status.textContent = "Starting voice input. Your browser may ask for microphone access.";
        try { recognition.start(); } catch (_) { status.textContent = "Voice input could not start. You can type instead."; }
      });
    }
  }

  const motionToggle = document.getElementById("ai-motion-toggle");
  const capabilitySection = document.getElementById("ai-capabilities");
  document.querySelectorAll(
    '.ai-capability-group:not([aria-hidden="true"]) .ai-capability-card, .ai-mobile-group:not([aria-hidden="true"]) .ai-capability-card'
  ).forEach(card => card.tabIndex = 0);
  if (motionToggle && capabilitySection) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionControl = () => {
      motionToggle.hidden = reducedMotion.matches;
      if (reducedMotion.matches) {
        capabilitySection.classList.remove("is-paused");
        motionToggle.setAttribute("aria-pressed", "false");
        motionToggle.textContent = "Pause animation";
      }
    };
    motionToggle.addEventListener("click", () => {
      const paused = capabilitySection.classList.toggle("is-paused");
      motionToggle.setAttribute("aria-pressed", String(paused));
      motionToggle.textContent = paused ? "Resume animation" : "Pause animation";
    });
    reducedMotion.addEventListener?.("change", syncMotionControl);
    syncMotionControl();
  }

  const safeguardItems = document.querySelectorAll(".ai-control-item");
  if ("IntersectionObserver" in window) {
    const safeguardObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in-view");
          safeguardObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    safeguardItems.forEach(item => safeguardObserver.observe(item));
  } else {
    safeguardItems.forEach(item => item.classList.add("is-in-view"));
  }

  const newsletter = document.getElementById("preview-newsletter");
  newsletter?.addEventListener("submit", event => event.preventDefault());
  newsletter?.querySelector("button[type=submit]")?.addEventListener("click", () => {
    const email = newsletter.querySelector('input[type="email"]');
    if (email && (!email.value.trim() || !email.validity.valid)) { email.reportValidity(); return; }
  });

  const sessionForm = document.getElementById("ai-fit-preview");
  sessionForm?.addEventListener("submit", event => {
    event.preventDefault();
    if (!sessionForm.reportValidity()) return;
  });
})();
