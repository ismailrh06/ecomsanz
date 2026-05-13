(() => {
  const MAX_HISTORY = 8;

  function createNode(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === 'string') el.textContent = text;
    return el;
  }

  function mountChatbot() {
    if (document.getElementById('chatbotWidget')) return;

    const widget = createNode('div', 'chatbot-widget');
    widget.id = 'chatbotWidget';

    const backdrop = createNode('div', 'chatbot-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');

    const toggleBtn = createNode('button', 'chatbot-toggle', '💬');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', 'Abrir chat');

    const panel = createNode('section', 'chatbot-panel');
    panel.setAttribute('aria-live', 'polite');

    const header = createNode('header', 'chatbot-header');
    const titleWrap = createNode('div', 'chatbot-title-wrap');
    titleWrap.appendChild(createNode('strong', 'chatbot-title', 'Asistente Kevin IA'));
    titleWrap.appendChild(createNode('span', 'chatbot-subtitle', 'Respuestas al instante'));

    const closeBtn = createNode('button', 'chatbot-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar chat');

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    const messages = createNode('div', 'chatbot-messages');

    const quick = createNode('div', 'chatbot-quick');
    const quickButtons = [
      '¿Qué incluye la masterclass?',
      '¿Cuánto cuesta empezar?',
      '¿Puedo hacerlo sin experiencia?'
    ];

    quickButtons.forEach((label) => {
      const b = createNode('button', 'chatbot-chip', label);
      b.type = 'button';
      b.addEventListener('click', () => {
        input.value = label;
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
      quick.appendChild(b);
    });

    const form = createNode('form', 'chatbot-form');
    const input = createNode('input', 'chatbot-input');
    input.type = 'text';
    input.placeholder = 'Escribe tu pregunta...';
    input.required = true;
    input.maxLength = 450;

    const sendBtn = createNode('button', 'chatbot-send', 'Enviar');
    sendBtn.type = 'submit';

    form.appendChild(input);
    form.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(quick);
    panel.appendChild(form);

    widget.appendChild(backdrop);
    widget.appendChild(toggleBtn);
    widget.appendChild(panel);
    document.body.appendChild(widget);

    let history = [];

    function addMessage(role, text) {
      const row = createNode('div', `chatbot-msg chatbot-msg-${role}`);
      const bubble = createNode('div', 'chatbot-bubble', text);
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }

    function setTyping(isTyping) {
      let typing = messages.querySelector('.chatbot-typing');
      if (isTyping && !typing) {
        typing = createNode('div', 'chatbot-typing', 'Escribiendo...');
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
      }
      if (!isTyping && typing) typing.remove();
    }

    function toggle(open) {
      const willOpen = typeof open === 'boolean' ? open : !widget.classList.contains('open');
      widget.classList.toggle('open', willOpen);
      document.body.classList.toggle('chatbot-open', willOpen);
      if (willOpen) {
        if (!globalThis.matchMedia('(max-width: 760px)').matches) {
          input.focus();
        }
        toggleBtn.setAttribute('aria-label', 'Cerrar chat');
      } else {
        toggleBtn.setAttribute('aria-label', 'Abrir chat');
      }
    }

    toggleBtn.addEventListener('click', () => toggle());
    closeBtn.addEventListener('click', () => toggle(false));
    backdrop.addEventListener('click', () => toggle(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && widget.classList.contains('open')) {
        toggle(false);
      }
    });

    addMessage(
      'bot',
      '¡Hola! Soy el asistente de Kevin. Puedo ayudarte con dudas sobre la masterclass, resultados, precio y acompañamiento.'
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      addMessage('user', message);
      history.push({ role: 'user', content: message });
      history = history.slice(-MAX_HISTORY);

      input.value = '';
      sendBtn.disabled = true;
      setTyping(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const answer = data?.answer || 'Lo siento, no pude generar una respuesta ahora.';

        addMessage('bot', answer);
        history.push({ role: 'assistant', content: answer });
        history = history.slice(-MAX_HISTORY);
      } catch {
        addMessage(
          'bot',
          'Ahora mismo no puedo responder con IA. Déjanos tu duda por WhatsApp y te ayudamos enseguida.'
        );
      } finally {
        setTyping(false);
        sendBtn.disabled = false;
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountChatbot);
  } else {
    mountChatbot();
  }
})();
