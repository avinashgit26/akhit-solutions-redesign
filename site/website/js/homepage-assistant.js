(() => {
  const proofValues = [...document.querySelectorAll('.proof-value[data-count]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setProofValue = (element, value) => {
    const decimals = Number(element.dataset.decimals || 0);
    element.textContent = `${element.dataset.prefix || ''}${value.toFixed(decimals)}${element.dataset.suffix || ''}`;
  };
  const animateProofValue = element => {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target)) return;
    if (reducedMotion) { setProofValue(element, target); return; }
    const start = performance.now();
    const duration = 1500;
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setProofValue(element, target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const proofObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        proofObserver.unobserve(entry.target);
        animateProofValue(entry.target);
      });
    }, { threshold: .45 });
    proofValues.forEach(value => proofObserver.observe(value));
  } else {
    proofValues.forEach(animateProofValue);
  }

  const launcher = document.getElementById('assistant-launcher');
  const panel = document.getElementById('assistant-panel');
  const closeButton = document.getElementById('assistant-close');
  const input = document.getElementById('assistant-input');
  const form = document.getElementById('assistant-form');
  const messages = document.getElementById('assistant-messages');
  const prompts = document.getElementById('assistant-prompts');
  const status = document.getElementById('assistant-status');
  const voiceButton = document.getElementById('assistant-voice');
  const privacy = document.getElementById('privacy-policy-panel');
  if (!launcher || !panel || !form || !messages) return;

  const welcomedKey = 'akhAssistantWelcomed';
  let autoShown = false;
  const hasWelcomed = () => {
    try { return sessionStorage.getItem(welcomedKey) === '1'; } catch (_) { return autoShown; }
  };
  const markWelcomed = () => {
    autoShown = true;
    try { sessionStorage.setItem(welcomedKey, '1'); } catch (_) {}
  };
  const openAssistant = (automatic = false) => {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (automatic) markWelcomed();
    if (!automatic) {
      markWelcomed();
      input?.focus();
    }
  };
  const closeAssistant = () => {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  };
  launcher.addEventListener('click', () => openAssistant(false));
  closeButton?.addEventListener('click', closeAssistant);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closeAssistant();
  });

  const canGreet = () => {
    if (hasWelcomed() || !panel.hidden || !privacy?.hidden) return false;
    if (document.querySelector('dialog[open]')) return false;
    return true;
  };
  const showWelcome = () => {
    if (!canGreet()) return;
    openAssistant(true);
  };
  const greetingTimer = window.setTimeout(showWelcome, 8500);
  const greetAfterScroll = () => {
    if (window.scrollY > 180 && canGreet()) {
      window.clearTimeout(greetingTimer);
      window.removeEventListener('scroll', greetAfterScroll);
      window.setTimeout(showWelcome, 1100);
    }
  };
  window.addEventListener('scroll', greetAfterScroll, { passive: true });
  ['policy-accept-btn', 'policy-reject-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => window.setTimeout(showWelcome, 900));
  });

  const addMessage = (text, who = 'assistant', linkLabel = '', href = '') => {
    const bubble = document.createElement('p');
    bubble.className = `assistant-message${who === 'user' ? ' user' : ''}`;
    bubble.textContent = text;
    if (linkLabel && href) {
      const link = document.createElement('a');
      link.className = 'assistant-link';
      link.href = href;
      link.textContent = linkLabel;
      bubble.append(document.createElement('br'), link);
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  };

  const respond = question => {
    const q = question.toLowerCase();
    if (/price|pricing|cost|budget|quote/.test(q)) {
      return ['Project costs depend on the scope, integrations and delivery needs. AKH does not publish fixed prices, so the team will first understand what you need and then discuss an honest estimate.', 'Get a free consultation', 'contact-us.html'];
    }
    if (/book|call|meeting|consult|talk|contact|demo/.test(q)) {
      return ['You can share a few project details through the contact page and the AKH team can continue the conversation with you. This preview cannot book a time directly.', 'Go to the contact page', 'contact-us.html'];
    }
    if (/ai|rag|evaluation|automation|artificial intelligence/.test(q)) {
      return ['AKH offers AI solutions and can explore retrieval-augmented generation, evaluation and workflow automation as part of a practical product need. The right approach depends on your use case.', 'Explore AI services', 'service/artificial-intelligence.html'];
    }
    if (/service|website|web app|application|mobile|seo|design|build|develop/.test(q)) {
      return ['AKH works on web applications, websites, mobile apps, AI solutions, SEO services and graphic design. If you are unsure where to start, describe the problem and the team can help shape the next step.', 'Explore services', 'service/web-app-development.html'];
    }
    if (/awrbb|marketplace|inventory|returns|seller|finance|product launch/.test(q)) {
      return ['AWRBB is an upcoming in-house retail operations product. The preview describes connected support for products, orders, inventory, returns, shipping, sellers, payments, finance and reporting. Join the waitlist on this page for special access.'];
    }
    return ['I can help with AKH services, AI capabilities, project costs, AWRBB or how to contact the team. I cannot provide a live quote or book a meeting in this preview.'];
  };

  const send = text => {
    const question = String(text || '').trim();
    if (!question) return;
    addMessage(question, 'user');
    input.value = '';
    const [answer, linkLabel, href] = respond(question);
    window.setTimeout(() => addMessage(answer, 'assistant', linkLabel, href), 180);
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    send(input.value);
  });
  prompts?.addEventListener('click', event => {
    const button = event.target.closest('button[data-prompt]');
    if (!button) return;
    send(button.dataset.prompt);
  });

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (!Recognition) {
    voiceButton.disabled = true;
    voiceButton.title = 'Voice input is unavailable here. You can type instead.';
  } else if (voiceButton) {
    recognition = new Recognition();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { voiceButton.setAttribute('aria-pressed', 'true'); status.textContent = 'Listening. Your browser may send audio to its speech service for transcription.'; };
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) { input.value = [input.value.trim(), transcript].filter(Boolean).join(' '); input.focus(); status.textContent = 'Voice input added. Review it, then select Send.'; }
    };
    recognition.onerror = event => { status.textContent = event.error === 'not-allowed' ? 'Microphone access was not allowed. You can type instead.' : 'Voice input stopped. You can type instead.'; };
    recognition.onend = () => voiceButton.setAttribute('aria-pressed', 'false');
    voiceButton.addEventListener('click', () => {
      if (voiceButton.getAttribute('aria-pressed') === 'true') { recognition.stop(); return; }
      status.textContent = 'Starting voice input. Your browser may ask for microphone access.';
      try { recognition.start(); } catch (_) { status.textContent = 'Voice input could not start. You can type instead.'; }
    });
  }

  const newsletter = document.getElementById('preview-newsletter');
  const newsletterStatus = document.getElementById('newsletter-preview-status');
  newsletter?.addEventListener('submit', event => event.preventDefault());
  newsletter?.querySelector('.newsletter-button')?.addEventListener('click', () => {
    const email = newsletter.querySelector('input[type="email"]');
    if (email && !email.value.trim()) { email.reportValidity(); return; }
    if (email && !email.validity.valid) { email.reportValidity(); return; }
    if (newsletterStatus) newsletterStatus.textContent = 'Preview only: no email was saved or sent.';
  });
})();
