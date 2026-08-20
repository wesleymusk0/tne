/* Ponte: recebe lote de mensagens do app Systematrix e encaminha ao background. */
(function () {
  window.addEventListener("buscia:mensagens", (evento) => {
    const detalhe = evento.detail || {};
    const mensagens = Array.isArray(detalhe.mensagens) ? detalhe.mensagens : [];
    if (mensagens.length === 0) return;
    chrome.runtime.sendMessage({ tipo: "buscia:enviar", mensagens });
  });
})();
