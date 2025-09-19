/**
 * SmartClic Chat Widget v2.0
 * Widget flexible y movible para integración en cualquier sitio web
 * Compatible con el HTML original de tu proyecto
 */
(function(){
  'use strict';
  
  // Helper: safe uuid
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
  };

  // Storage helpers compatibles con localStorage
  const storage = {
    key: (sid)=>`smartclic:chat:${sid}`,
    posKey: (sid)=>`smartclic:pos:${sid}`,
    read(sid){ 
      try { 
        return JSON.parse(localStorage.getItem(this.key(sid))||'[]');
      } catch { 
        return [];
      }
    },
    write(sid, arr){ 
      try { 
        localStorage.setItem(this.key(sid), JSON.stringify(arr.slice(-500)));
      } catch {}
    },
    clear(sid){ 
      try { 
        localStorage.removeItem(this.key(sid));
      } catch {}
    },
    readPos(sid){ 
      try { 
        return JSON.parse(localStorage.getItem(this.posKey(sid))||'null');
      } catch { 
        return null;
      }
    },
    writePos(sid, pos){ 
      try { 
        localStorage.setItem(this.posKey(sid), JSON.stringify(pos));
      } catch {}
    }
  };

  // DOM helper
  function createEl(tag, attrs={}, children=[]) {
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; 
      else if (k === 'text') el.textContent = v; 
      else if (k.startsWith('on') && typeof v === 'function') el[k] = v; 
      else el.setAttribute(k,v);
    }
    for (const c of (Array.isArray(children) ? children : [children])) {
      if (c) el.appendChild(c);
    }
    return el;
  }

  // Markdown processor mejorado
  function processMarkdown(text) {
    if (!text) return '';
    
    // Escape HTML
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Store links to avoid conflicts
    const linkStore = [];
    let linkIndex = 0;
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, linkText, url) {
      const placeholder = `__LINK_${linkIndex}__`;
      linkStore[linkIndex] = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline;">${linkText}</a>`;
      linkIndex++;
      return placeholder;
    });
    
    // Process markdown
    text = text
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')  
      .replace(/(?<!\*)\*([^*\s][^*]*?[^*\s])\*(?!\*)/g, '<em>$1</em>'); 
    
    // Restore links
    linkStore.forEach((link, index) => {
      text = text.replace(`__LINK_${index}__`, link);
    });
    
    // Auto-link URLs
    text = text.replace(/(?<!href=["'])(?<!>)(https?:\/\/[^\s<>"{}|\\^`[\]]+)(?!<\/a>)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline;">$1</a>');
    
    // Format numbered lists
    text = text.replace(/(\d+\.\s)/g, '<strong>$1</strong>');
    
    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  // Render message component
  function renderMsg({sender, text}){
    const row = createEl('div', {class: `sc-msg from-${sender||'system'}`});
    const bubble = createEl('div', {class:'sc-msg-inner'});
   
    if (sender === 'assistant') {
      bubble.innerHTML = processMarkdown(text || '');
    } else {
      bubble.innerHTML = (text || '').replace(/\n/g, '<br>');
    }

    if (sender === 'assistant') {
      const tools = createEl('div', {style: 'margin-top: 8px;'});
      const btn = createEl('button', {class:'sc-copy', text:'Copiar'});
      btn.addEventListener('click', ()=> {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text||'').then(() => {
            btn.textContent = '✓ Copiado';
            setTimeout(() => btn.textContent = 'Copiar', 2000);
          });
        }
      });
      tools.appendChild(btn);
      bubble.appendChild(tools);
    }
    row.appendChild(bubble);
    return row;
  }

  // Typing indicator component
  function typingDots(){
    const w = createEl('div', {class:'sc-msg from-assistant'});
    const b = createEl('div', {class:'sc-msg-inner'});
    const t = createEl('div', {class:'sc-typing'});
    t.appendChild(createEl('div', {class:'d'}));
    t.appendChild(createEl('div', {class:'d'}));
    t.appendChild(createEl('div', {class:'d'}));
    b.appendChild(t); 
    w.appendChild(b); 
    return w;
  }

  // Make element draggable
  function makeDraggable(element, sessionId) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let dragThreshold = 5;
    let hasMoved = false;

    // Load saved position
    const savedPos = storage.readPos(sessionId);
    if (savedPos) {
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.left = savedPos.x + 'px';
      element.style.top = savedPos.y + 'px';
    }

    function getPointerPos(e) {
      return {
        x: e.touches ? e.touches[0].clientX : e.clientX,
        y: e.touches ? e.touches[0].clientY : e.clientY
      };
    }

    function startDrag(e) {
      isDragging = true;
      hasMoved = false;
      element.style.transition = 'none';
      element.style.userSelect = 'none';
      
      const pos = getPointerPos(e);
      startX = pos.x;
      startY = pos.y;
      
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      // Switch to absolute positioning
      if (element.style.right !== 'auto') {
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
      }
      
      e.preventDefault();
    }

    function drag(e) {
      if (!isDragging) return;
      
      const pos = getPointerPos(e);
      const deltaX = pos.x - startX;
      const deltaY = pos.y - startY;
      
      if (!hasMoved && (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold)) {
        hasMoved = true;
        element.style.transform = 'scale(1.1)';
        element.style.zIndex = '1000000';
        element.style.filter = 'brightness(1.1)';
      }
      
      if (hasMoved) {
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Keep within viewport bounds
        const maxLeft = window.innerWidth - element.offsetWidth;
        const maxTop = window.innerHeight - element.offsetHeight;
        
        newLeft = Math.max(10, Math.min(newLeft, maxLeft - 10));
        newTop = Math.max(10, Math.min(newTop, maxTop - 10));
        
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
      }
      
      e.preventDefault();
    }

    function endDrag() {
      if (!isDragging) return;
      
      isDragging = false;
      element.style.transition = 'all 0.3s ease';
      element.style.transform = '';
      element.style.zIndex = '999999';
      element.style.userSelect = '';
      element.style.filter = '';
      
      if (hasMoved) {
        // Save position
        const rect = element.getBoundingClientRect();
        storage.writePos(sessionId, { x: rect.left, y: rect.top });
        
        // Snap to edges if close
        const snapDistance = 30;
        let finalLeft = rect.left;
        let finalTop = rect.top;
        
        if (rect.left < snapDistance) finalLeft = 18;
        if (rect.top < snapDistance) finalTop = 18;
        if (rect.right > window.innerWidth - snapDistance) {
          finalLeft = window.innerWidth - element.offsetWidth - 18;
        }
        if (rect.bottom > window.innerHeight - snapDistance) {
          finalTop = window.innerHeight - element.offsetHeight - 18;
        }
        
        if (Math.abs(finalLeft - rect.left) > 5 || Math.abs(finalTop - rect.top) > 5) {
          element.style.left = finalLeft + 'px';
          element.style.top = finalTop + 'px';
          storage.writePos(sessionId, { x: finalLeft, y: finalTop });
        }
      }
    }

    // Mouse events
    element.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events
    element.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
    
    // Prevent click if dragged
    element.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  // Insert CSS styles dinámicamente
  function insertStyles() {
    const styleId = 'smartclic-widget-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        --sc-primary: #4f46e5;
        --sc-primary-hover: #4338ca;
        --sc-bg: #0b1020;
        --sc-bg-soft: #12172a;
        --sc-text: #e7e7ee;
        --sc-muted: #a8a8b8;
        --sc-danger: #ef4444;
        --sc-shadow: 0 10px 30px rgba(2, 6, 23, .35);
        --sc-shadow-hover: 0 16px 38px rgba(2, 6, 23, .45);
        --radius: 16px;
      }
      
      .sc-fab { 
        position: fixed; 
        right: 18px; 
        bottom: 18px; 
        z-index: 999999; 
        cursor: move;
        touch-action: none;
        user-select: none;
      }
      
      .sc-fab button {
        border: 0; 
        border-radius: 999px; 
        padding: 14px 18px; 
        cursor: move;
        background: var(--sc-primary); 
        color: white; 
        font-weight: 600; 
        font-size: 14px;
        display: inline-flex; 
        align-items: center; 
        gap: 8px;
        box-shadow: var(--sc-shadow); 
        transition: all .3s ease; 
        will-change: transform;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .sc-fab:hover button { 
        transform: translateY(-2px); 
        box-shadow: var(--sc-shadow-hover);
        background: var(--sc-primary-hover);
      }
      
      .sc-fab .sc-dot { 
        width: 10px; 
        height: 10px; 
        background: white; 
        border-radius: 999px; 
        opacity: .9;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 0.9; }
        50% { opacity: 0.6; }
      }
      
      .sc-panel { 
        position: fixed; 
        right: 18px; 
        bottom: 84px; 
        width: min(380px, calc(100vw - 36px)); 
        height: min(560px, calc(100vh - 120px));
        background: linear-gradient(180deg, var(--sc-bg) 0%, var(--sc-bg-soft) 100%);
        color: var(--sc-text); 
        border-radius: var(--radius); 
        overflow: hidden; 
        box-shadow: var(--sc-shadow); 
        display: none; 
        z-index: 999999;
        border: 1px solid rgba(255,255,255,0.08);
        backdrop-filter: blur(10px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .sc-panel.sc-open { 
        display: grid; 
        grid-template-rows: auto 1fr auto;
        animation: slideUp 0.3s ease-out;
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .sc-header { 
        padding: 16px 18px; 
        background: rgba(255,255,255,.06); 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        gap: 12px; 
        border-bottom: 1px solid rgba(255,255,255,.08); 
      }
      
      .sc-title { 
        font-weight: 700; 
        font-size: 16px; 
        letter-spacing: .3px; 
      }
      
      .sc-sub { 
        font-size: 12px; 
        color: var(--sc-muted); 
        margin-top: 2px;
      }
      
      .sc-actions { 
        display: flex; 
        align-items: center; 
        gap: 6px; 
      }
      
      .sc-iconbtn { 
        background: transparent; 
        color: var(--sc-muted); 
        border: 0; 
        padding: 8px; 
        border-radius: 8px; 
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
      }
      
      .sc-iconbtn:hover { 
        background: rgba(255,255,255,.1); 
        color: var(--sc-text);
        transform: scale(1.1);
      }
      
      .sc-msgs { 
        padding: 16px; 
        overflow-y: auto; 
        scroll-behavior: smooth;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
      }
      
      .sc-msgs::-webkit-scrollbar {
        width: 6px;
      }
      
      .sc-msgs::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .sc-msgs::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
      }
      
      .sc-msg { 
        margin: 12px 0; 
        display: flex; 
        gap: 8px; 
      }
      
      .sc-msg-inner { 
        max-width: 85%; 
        padding: 12px 14px; 
        border-radius: 16px; 
        white-space: pre-wrap; 
        word-wrap: break-word; 
        line-height: 1.4;
        font-size: 14px;
        animation: messageSlide 0.3s ease-out;
      }
      
      @keyframes messageSlide {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .from-user .sc-msg-inner { 
        margin-left: auto; 
        background: linear-gradient(135deg, #1f2a44 0%, #2a3b5c 100%); 
        color: #ebf1ff; 
        border-top-right-radius: 6px; 
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .from-assistant .sc-msg-inner { 
        background: rgba(255,255,255,.08); 
        border-top-left-radius: 6px;
        border: 1px solid rgba(255,255,255,0.05);
      }
      
      .from-system .sc-msg-inner { 
        background: rgba(99,102,241,.15); 
        border: 1px solid rgba(99,102,241,.3); 
        color: #dfe2ff; 
        font-size: 13px;
        text-align: center;
        margin: 0 auto;
      }
      
      .sc-compose { 
        padding: 12px; 
        border-top: 1px solid rgba(255,255,255,.08); 
        background: rgba(255,255,255,.03); 
        display: grid; 
        grid-template-columns: 1fr auto; 
        gap: 10px; 
      }
      
      .sc-textarea { 
        resize: none; 
        min-height: 56px;
        max-height: 120px;
        border-radius: 12px; 
        border: 1px solid rgba(255,255,255,.12); 
        background: rgba(255,255,255,.06); 
        color: var(--sc-text); 
        padding: 12px 14px; 
        outline: none; 
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        transition: all 0.2s ease;
      }
      
      .sc-textarea:focus {
        border-color: var(--sc-primary);
        background: rgba(255,255,255,.08);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }
      
      .sc-textarea::placeholder {
        color: var(--sc-muted);
      }
      
      .sc-send {
        background: var(--sc-primary); 
        color: white; 
        border: 0; 
        border-radius: 12px; 
        padding: 0 18px; 
        font-weight: 600; 
        font-size: 14px;
        display: inline-flex; 
        align-items: center; 
        justify-content: center;
        gap: 6px; 
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 80px;
      }
      
      .sc-send:hover:not([disabled]) {
        background: var(--sc-primary-hover);
        transform: translateY(-1px);
      }
      
      .sc-send[disabled] { 
        opacity: .6; 
        cursor: not-allowed; 
        transform: none;
      }
      
      .sc-typing { 
        display: inline-flex; 
        gap: 4px; 
        align-items: center;
        padding: 8px 0;
      }
      
      .sc-typing .d { 
        width: 6px; 
        height: 6px; 
        background: #cbd5ff; 
        border-radius: 999px; 
        animation: typingBlink 1.4s infinite ease-in-out; 
      }
      
      .sc-typing .d:nth-child(2) { animation-delay: 0.2s; }
      .sc-typing .d:nth-child(3) { animation-delay: 0.4s; }
      
      @keyframes typingBlink { 
        0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 
        40% { opacity: 1; transform: translateY(-3px); } 
      }
      
      .sc-copy { 
        background: rgba(255,255,255,.05); 
        color: var(--sc-muted); 
        border: 1px solid rgba(255,255,255,.1);
        font-size: 11px; 
        cursor: pointer; 
        padding: 4px 8px; 
        border-radius: 6px;
        transition: all 0.2s ease;
        font-weight: 500;
      }
      
      .sc-copy:hover { 
        color: var(--sc-text); 
        background: rgba(255,255,255,.1);
        transform: scale(1.05);
      }
      
      /* Mobile responsive */
      @media (max-width: 480px) {
        .sc-panel { 
          width: calc(100vw - 20px); 
          height: calc(100vh - 140px);
          right: 10px; 
          bottom: 90px;
        }
        
        .sc-fab {
          right: 15px;
          bottom: 15px;
        }
        
        .sc-fab button {
          padding: 12px 16px;
          font-size: 13px;
        }
        
        .sc-msgs {
          padding: 12px;
        }
        
        .sc-msg-inner {
          font-size: 13px;
          padding: 10px 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Main widget function
  function SmartclicWidget(opts) {
    const cfg = Object.assign({
      webhookUrl: 'https://n8n.smartclic.pe/webhook/dac6fef4-be0b-4d46-b717-9fb92cbd1450/chat',
      title: 'SmartClic Assistant', 
      sub: 'Conectado a tu RAG',
      sessionId: null, 
      userId: null, 
      tenantId: null, 
      ruc: null, 
      razon_social: null,
      extraHeaders: {},
      draggable: true
    }, opts||{});

    // Generate session ID if not provided
    if (!cfg.sessionId) {
      const sidBase = (cfg.tenantId ? cfg.tenantId + ':' : '') + (cfg.userId || 'anon');
      cfg.sessionId = sidBase;
    }

    // Insert styles
    insertStyles();

    // Get or create root element
    let root = document.getElementById('smartclic-chat-root');
    if (!root) {
      root = createEl('div', {id: 'smartclic-chat-root'});
      document.body.appendChild(root);
    }
    
    // Create FAB
    const fab = createEl('div', {class:'sc-fab'}, [
      createEl('button', {}, [
        createEl('span',{class:'sc-dot'}),
        createEl('span',{text:'Chat'})
      ])
    ]);

    // Create panel
    const panel = createEl('div', {class:'sc-panel'});
    const header = createEl('div', {class:'sc-header'}, [
      createEl('div', {}, [ 
        createEl('div',{class:'sc-title', text: cfg.title}), 
        createEl('div',{class:'sc-sub', text: cfg.sub}) 
      ]),
      createEl('div', {class:'sc-actions'}, [
        createEl('button',{class:'sc-iconbtn', title:'Limpiar historial'}, [createEl('span',{text:'🧹'})]),
        createEl('button',{class:'sc-iconbtn', title:'Cerrar'}, [createEl('span',{text:'✕'})]),
      ])
    ]);
    
    const msgs = createEl('div', {class:'sc-msgs'});
    const compose = createEl('div', {class:'sc-compose'});
    const textarea = createEl('textarea', {
      class:'sc-textarea', 
      placeholder:'Escribe tu mensaje... (Enter para enviar)',
      rows: 2
    });
    const sendBtn = createEl('button', {class:'sc-send'}, [
      createEl('span',{text:'Enviar'})
    ]);
    
    compose.appendChild(textarea); 
    compose.appendChild(sendBtn);
    panel.appendChild(header); 
    panel.appendChild(msgs); 
    panel.appendChild(compose);
    root.appendChild(fab); 
    root.appendChild(panel);

    // Make draggable if enabled
    if (cfg.draggable) {
      makeDraggable(fab, cfg.sessionId);
    }

    // Load chat history
    let history = storage.read(cfg.sessionId);
    if (history.length === 0) {
      history.push({sender:'system', text:'¡Hola! 👋 Soy tu asistente de SmartClic. ¿En qué te puedo ayudar hoy?'});
      storage.write(cfg.sessionId, history);
    }
    
    // Render existing messages
    history.forEach(msg => msgs.appendChild(renderMsg(msg)));
    msgs.scrollTop = msgs.scrollHeight;

    // Event handlers
    const [clearBtn, closeBtn] = header.querySelectorAll('.sc-iconbtn');

    // Toggle panel
    function togglePanel() {
      if (panel.classList.contains('sc-open')) {
        panel.classList.remove('sc-open');
      } else {
        panel.classList.add('sc-open');
        textarea.focus();
        msgs.scrollTop = msgs.scrollHeight;
      }
    }

    // Close panel
    function closePanel() {
      panel.classList.remove('sc-open');
    }

    // Clear history
    function clearHistory() {
      if (confirm('¿Estás seguro de que quieres borrar todo el historial del chat?')) {
        storage.clear(cfg.sessionId); 
        msgs.innerHTML = '';
        history = [];
        // Add welcome message
        const welcomeMsg = {sender:'system', text:'Historial borrado. ¿En qué te puedo ayudar?'};
        history.push(welcomeMsg);
        msgs.appendChild(renderMsg(welcomeMsg));
        storage.write(cfg.sessionId, history);
      }
    }

    // Event listeners
    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', closePanel);
    clearBtn.addEventListener('click', clearHistory);

    // Textarea auto-resize and keyboard handling
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
      }
    });

    // Send message function
    async function sendMessage() {
      const text = textarea.value.trim();
      if (!text) return;
      
      // Disable send button
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span>Enviando...</span>';
      
      textarea.value = '';
      textarea.style.height = 'auto';
      
      // Add user message
      const userMsg = { sender:'user', text, timestamp: Date.now() };
      history.push(userMsg); 
      msgs.appendChild(renderMsg(userMsg)); 
      msgs.scrollTop = msgs.scrollHeight; 
      storage.write(cfg.sessionId, history);

      // Add typing indicator
      const typing = typingDots(); 
      msgs.appendChild(typing); 
      msgs.scrollTop = msgs.scrollHeight;

      try {
        const messageId = uuid();
        const payload = {
          sessionId: cfg.sessionId,
          chatInput: text,
          userId: cfg.userId,
          tenantId: cfg.tenantId,
          ruc: cfg.ruc,
          razon_social: cfg.razon_social,
          messageId,
          timestamp: Date.now()
        };

        const response = await fetch(cfg.webhookUrl, {
          method: 'POST',
          headers: Object.assign({ 
            'content-type': 'application/json',
            'user-agent': 'SmartClic-Widget/2.0'
          }, cfg.extraHeaders || {}),
          body: JSON.stringify(payload)
        });

        let responseText = '';
        
        if (response.ok) {
          const raw = await response.text();
          try {
            const parsed = JSON.parse(raw);
            responseText = (parsed.result || parsed.text || parsed.output || parsed.response || raw || '').toString();
          } catch { 
            responseText = raw || 'Mensaje recibido.'; 
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

        // Remove typing indicator
        typing.remove();
        
        // Add assistant response
        const assistantMsg = { 
          sender: 'assistant', 
          text: responseText, 
          timestamp: Date.now() 
        };
        history.push(assistantMsg); 
        msgs.appendChild(renderMsg(assistantMsg)); 
        msgs.scrollTop = msgs.scrollHeight; 
        storage.write(cfg.sessionId, history);

      } catch (error) {
        typing.remove();
        
        // Add error message
        const errorMsg = { 
          sender: 'system', 
          text: 'Lo siento, no pude conectar con el servidor. Por favor, intenta de nuevo en unos momentos.', 
          timestamp: Date.now() 
        };
        history.push(errorMsg); 
        msgs.appendChild(renderMsg(errorMsg)); 
        msgs.scrollTop = msgs.scrollHeight; 
        storage.write(cfg.sessionId, history);
      } finally {
        // Re-enable send button
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>Enviar</span>';
        textarea.focus();
      }
    }

    sendBtn.addEventListener('click', sendMessage);

    // Public API
    return {
      open: () => {
        panel.classList.add('sc-open');
        textarea.focus();
        msgs.scrollTop = msgs.scrollHeight;
      },
      close: closePanel,
      toggle: togglePanel,
      clear: clearHistory,
      element: root,
      config: cfg,
      
      // Send programmatic message
      send: (message) => {
        textarea.value = message;
        sendMessage();
      },
      
      // Get chat history
      getHistory: () => [...history],
      
      // Update config
      updateConfig: (newConfig) => {
        Object.assign(cfg, newConfig);
        if (newConfig.title) header.querySelector('.sc-title').textContent = newConfig.title;
        if (newConfig.sub) header.querySelector('.sc-sub').textContent = newConfig.sub;
      }
    };
  }

  // Global API - Compatible con tu HTML original
  window.SmartclicChat = {
    init(opts) { 
      return new SmartclicWidget(opts); 
    },
    
    version: '2.0.0',
    
    // Método para crear múltiples instancias
    create: (id, opts) => {
      if (!window.SmartclicChat.instances) {
        window.SmartclicChat.instances = new Map();
      }
      
      if (window.SmartclicChat.instances.has(id)) {
        console.warn(`SmartClic instance '${id}' already exists`);
        return window.SmartclicChat.instances.get(id);
      }
      
      const instance = new SmartclicWidget(opts);
      window.SmartclicChat.instances.set(id, instance);
      return instance;
    },
    
    // Obtener instancia por ID
    get: (id) => {
      return window.SmartclicChat.instances?.get(id);
    },
    
    // Destruir instancia
    destroy: (id) => {
      if (!window.SmartclicChat.instances) return false;
      
      const instance = window.SmartclicChat.instances.get(id);
      if (instance && instance.element) {
        instance.element.remove();
        window.SmartclicChat.instances.delete(id);
        return true;
      }
      return false;
    }
  };

  // Auto-initialization desde data attributes (compatible con el HTML original)
  document.addEventListener('DOMContentLoaded', () => {
    const autoInit = document.querySelector('[data-smartclic-auto-init]');
    if (autoInit) {
      const config = {};
      
      // Leer data attributes
      const attrs = autoInit.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.startsWith('data-sc-')) {
          const key = attr.name.replace('data-sc-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          config[key] = attr.value;
        }
      }
      
      window.SmartclicChat.init(config);
    }
  });

  // Compatibilidad con el código HTML original
  // Si existe el elemento smartclic-chat-root, significa que se está usando el HTML original
  if (document.getElementById('smartclic-chat-root') || document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Solo auto-inicializar si no hay configuración manual
      if (!window.smartclicManualInit) {
        console.log('SmartClic Widget cargado - Listo para inicializar');
      }
    });
  }

})();

// Exponer también como módulo si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.SmartclicChat;
}
