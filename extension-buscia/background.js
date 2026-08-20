/* Background: localiza (ou abre UMA vez) a aba do WhatsApp Web e envia o lote.
 * Regra da TNE: reutilizar a aba existente; nunca abrir uma nova por mensagem. */

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo !== "buscia:enviar") return;
  (async () => {
    const abas = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    let aba = abas[0];
    if (!aba) {
      // Abre apenas uma vez — o WhatsApp Web passa a ser reutilizado depois disso.
      aba = await chrome.tabs.create({ url: "https://web.whatsapp.com/", active: true });
      // Espera carregar para poder inspecionar autenticação.
      await new Promise((r) => setTimeout(r, 6000));
    }
    const resposta = await chrome.tabs.sendMessage(aba.id, {
      tipo: "buscia:lote",
      mensagens: msg.mensagens,
    }).catch(() => null);
    if (!resposta) {
      chrome.notifications?.create({
        type: "basic",
        title: "BuscIA",
        message: "Não consegui falar com a aba do WhatsApp Web. Abra-a e tente novamente.",
      });
    }
  })();
  responder?.({ ok: true });
  return true;
});
