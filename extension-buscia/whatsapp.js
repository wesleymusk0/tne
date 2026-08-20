/* WhatsApp Web: autenticação, navegação pelo número e envio sem nova aba. */
(function () {
  function autenticado() {
    // WhatsApp autenticado renderiza o canvas de código? não — exibe painel de conversas.
    return !document.querySelector("div[data-testid='qrcode']") && !!document.querySelector("div#app");
  }

  function avisar(texto) {
    let box = document.getElementById("buscia-aviso");
    if (!box) {
      box = document.createElement("div");
      box.id = "buscia-aviso";
      box.style.cssText =
        "position:fixed;top:12px;right:12px;z-index:99999;background:#001b4a;color:#fff;" +
        "padding:10px 14px;border-radius:10px;font:13px Arial;box-shadow:0 4px 14px rgba(0,0,0,.25)";
      document.body.appendChild(box);
    }
    box.textContent = texto;
    setTimeout(() => box.remove(), 8000);
  }

  function normalizarTelefone(tel) {
    return String(tel || "").replace(/[^\d]/g, "");
  }

  async function esperar(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function abrirConversaPorTelefone(telefone) {
    // Forma canônica de abrir conversa na MESMA aba (sem nova aba).
    const url = `https://web.whatsapp.com/send?phone=${normalizarTelefone(telefone)}`;
    if (location.href !== url) {
      history.pushState({}, "", url);
      location.href = url;
      await esperar(4000);
    }
  }

  async function enviarMensagem(texto) {
    // Caixa de composição (varia por versão do WhatsApp Web; cobre os seletores estáveis).
    const caixa =
      document.querySelector("footer div[contenteditable='true'][data-tab='10']") ||
      document.querySelector("div[contenteditable='true'][data-tab='10']") ||
      document.querySelector("footer div[contenteditable='true']");
    if (!caixa) return false;
    caixa.focus();
    document.execCommand("insertText", false, texto);
    await esperar(400);
    const botao =
      document.querySelector("button[data-testid='compose-btn-send']") ||
      document.querySelector("span[data-icon='send']")?.closest("button");
    if (botao) {
      botao.click();
    } else {
      caixa.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    }
    return true;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.tipo !== "buscia:lote") return;
    (async () => {
      if (!autenticado()) {
        avisar("BuscIA: WhatsApp Web não está autenticado. Escaneie o QR Code e tente novamente.");
        return { ok: false, motivo: "nao_autenticado" };
      }
      let enviadas = 0;
      for (const m of msg.mensagens) {
        if (!m.telefone || !m.conteudo) continue;
        await abrirConversaPorTelefone(m.telefone);
        if (await enviarMensagem(m.conteudo)) enviadas++;
        await esperar(1500); // respeito ao ritmo do WhatsApp Web
      }
      avisar(`BuscIA: ${enviadas}/${msg.mensagens.length} mensagens enviadas.`);
      return { ok: true, enviadas };
    })();
  });
})();
