/* Substitui o script original. Carregue com <script src="../checkout.js" defer></script>. */
(function () {
  'use strict';
  const checkoutScriptUrl = new URL(document.currentScript?.src || '../checkout.js', location.href);
  const trackingUrl = new URL('tracking.js', checkoutScriptUrl);
  if (!window.MagicTrackingReady) {
    window.MagicTrackingReady = window.MagicTracking ? Promise.resolve() : new Promise(resolve => {
      let script = Array.from(document.scripts).find(s => s.src === trackingUrl.href);
      if (!script) { script = document.createElement('script'); script.src = trackingUrl.href; document.head.append(script); }
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
  }
  function start() {
    const btn = document.getElementById('btn-pix');
    if (!btn || btn.dataset.magicReady) return;
    btn.dataset.magicReady = '1';
    function read(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
    function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    let data = {};
    try { data = JSON.parse(read('checkout_cliente') || read('desenrola_consulta') || '{}') || {}; } catch (_) {}
    const full = String(data.nome || data.name || read('funil_nome') || read('desenrola_nome')).trim().toUpperCase();
    const cpf = String(data.cpfformatado || data.cpf || read('funil_cpf') || read('desenrola_cpf')).replace(/\D/g, '');
    let email = String(read('magic_email_' + cpf) || data.email || data.e_mail || '').trim();
    let emailInput = document.getElementById('magic-customer-email');
    if (!emailInput) {
      const label = document.createElement('label');
      label.textContent = 'E-mail'; label.htmlFor = 'magic-customer-email';
      label.style.cssText = 'display:block;margin:16px 0 6px;font:inherit;';
      emailInput = document.createElement('input'); emailInput.id = 'magic-customer-email';
      emailInput.type = 'email'; emailInput.autocomplete = 'email'; emailInput.required = true;
      emailInput.maxLength = 50; emailInput.name = 'email';
      emailInput.placeholder = 'seuemail@exemplo.com';
      emailInput.style.cssText = 'display:block;box-sizing:border-box;width:100%;padding:12px;margin:0 0 16px;border:1px solid #ccc;border-radius:8px;font:inherit;';
      btn.before(label, emailInput);
    }
    emailInput.value = email;
    let phone = String(read('ironpay_phone_' + cpf) || data.telefone || data.phone || data.phone_number || '').trim();
    let phoneInput = document.getElementById('ironpay-customer-phone');
    if (!phoneInput) {
      const label = document.createElement('label'); label.textContent = 'Telefone com DDD'; label.htmlFor = 'ironpay-customer-phone';
      label.style.cssText = 'display:block;margin:16px 0 6px;font:inherit;';
      phoneInput = document.createElement('input'); phoneInput.id = 'ironpay-customer-phone';
      phoneInput.type = 'tel'; phoneInput.autocomplete = 'tel'; phoneInput.required = true;
      phoneInput.name = 'phone'; phoneInput.placeholder = '(47) 99999-9999'; phoneInput.maxLength = 20;
      phoneInput.style.cssText = emailInput.style.cssText;
      btn.before(label, phoneInput);
    }
    phoneInput.value = phone;
    const formatted = cpf.length === 11 ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf;
    function text(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
    text('first-name', full.split(/\s+/)[0] || '...');
    ['r-nome', 'c-nome'].forEach(id => text(id, full));
    ['r-cpf', 'c-cpf'].forEach(id => text(id, formatted));
    let error = document.getElementById('pix-err');
    if (!error) { error = document.createElement('p'); error.id = 'pix-err'; btn.after(error); }
    error.setAttribute('role', 'alert');
    function showError(message) { error.textContent = message; error.hidden = false; error.classList.add('show'); }
    // Usa contatos já disponíveis; fallback de compatibilidade no config.php.
    const originalLabel = btn.textContent || 'Confirmar dados e gerar PIX';
    let busy = false;
    const api = new URL('api_proxy.php', checkoutScriptUrl);
    async function jsonRequest(url, options) {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
      let body;
      try { body = await response.json(); } catch (_) { throw new Error('O servidor não retornou JSON. Confira se os PHPs foram enviados à hospedagem.'); }
      if (!response.ok || !body.ok) {
        if (body.fields?.includes('client.email')) emailInput.focus();
        throw new Error(body.detail || body.error || 'Não foi possível gerar o PIX.');
      }
      return body;
    }
    btn.onclick = async function (event) {
      event.preventDefault();
      if (busy) return;
      error.hidden = true; error.classList.remove('show');
      if (!full || cpf.length !== 11) { showError('Nome ou CPF não encontrado. Volte à etapa anterior e confira os dados.'); return; }
      email = emailInput.value.trim();
      emailInput.value = email;
      if (!email || !emailInput.checkValidity() || email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Preencha o e-mail corretamente (até 50 caracteres).');
        emailInput.focus(); return;
      }
      save('magic_email_' + cpf, email);
      phone = phoneInput.value.replace(/\D/g, '');
      if ([12, 13].includes(phone.length) && phone.startsWith('55')) phone = phone.slice(2);
      if (!/^[1-9]\d{9,10}$/.test(phone)) { showError('Informe um telefone válido com DDD.'); phoneInput.focus(); return; }
      save('ironpay_phone_' + cpf, phone);
      busy = true; btn.disabled = true; btn.textContent = 'Gerando PIX...';
      try {
        api.search = '?action=init';
        const init = await jsonRequest(api);
        await window.MagicTrackingReady;
        let tracking = window.MagicTracking?.get() || {};
        try { tracking = { ...tracking, ...(window.__getTracking?.() || {}) }; } catch (_) {}
        const params = new URLSearchParams(window.location.search);
        ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','src','sck','fbclid','gclid','ttclid'].forEach(key => {
          if (params.has(key)) tracking[key] = params.get(key);
        });
        // Sempre o mesmo eventID para esta sessão do checkout.
        window.MagicTracking?.track('InitiateCheckout', init.amount, init.initiateEventId);
        api.search = '?action=create_pix';
        const payment = await jsonRequest(api, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': init.csrf },
          body: JSON.stringify({ client: { name: full, document: cpf, email, phone }, tracking })
        });
        // Manter as chaves antigas para compatibilidade com as demais páginas do funil.
        const stored = JSON.stringify({ id: payment.transactionId, payload: payment.pix.code,
          total: payment.amount, createdAt: payment.createdAt, image: payment.pix.image,
          base64: payment.pix.base64, expiresAt: payment.expiresAt });
        save('checkout_pix', stored); save('desenrola_pix', stored);
        save('funil_nome', full); save('funil_cpf', cpf);
        // Os upsells leem estes dados para gerar o PIX com o e-mail/telefone reais.
        save('funil_email', email); save('funil_phone', phone);
        const target = new URL('pix/', checkoutScriptUrl);
        target.search = window.location.search;
        window.location.assign(target.href);
      } catch (e) {
        showError(e.message || 'Falha de conexão. Tente novamente.');
        busy = false; btn.disabled = false; btn.textContent = originalLabel;
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
