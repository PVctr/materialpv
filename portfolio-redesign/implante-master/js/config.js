/*
 * CONFIGURAÇÃO CENTRAL DO SITE
 * Edite apenas este arquivo para contatos, endereço e modelo 3D.
 * Campos vazios ("") deixam o recurso desativado, sem gerar link quebrado.
 */
window.SITE_CONFIG = {
  // WhatsApp: somente dígitos, com código do país (55) + DDD + número.
  // Ex.: "5511912345678"
  whatsapp: '557133544555',

  // Mensagem inicial enviada no WhatsApp (é codificada automaticamente).
  whatsappMessage: 'Olá! Conheci o atendimento pelo site e gostaria de informações para agendar uma consulta.',

  // Instagram: endereço completo do perfil. Ex.: "https://www.instagram.com/perfil"
  instagram: 'https://www.instagram.com/implantemaster/',

  // Endereço confirmado, usado para gerar o link de rota no Google Maps.
  // Ex.: "Rua Exemplo, 123, Sala 4 - Bairro, Cidade - UF"
  address: 'Edf. Memorial Itaigara, Rua Altino Serbeto de Barros, 241 - Pituba, Salvador - BA',

  // Modelo 3D do dente (arquivo .glb sem compressão Draco/Meshopt).
  model: {
    src: 'assets/models/molar.glb',
    rotation: [0, 0, 0],     // ajuste de orientação em graus [x, y, z], se o modelo vier deitado
    scale: 1,                // ajuste fino de tamanho no quadro
    includeMeshes: [],       // nomes de malhas a exibir (vazio = todas). Útil para cenas do Spline com objetos extras
    maxPixelRatio: 1.75,     // limite de resolução em telas de alta densidade
    floatAmplitude: 0.12,    // intensidade do sobe e desce (0 = parado)
    orbit: {
      enabled: true,         // linha fina circulando o dente
      color: '#123047',      // azul-escuro da paleta
      speed: 0.14,           // voltas por segundo do trecho destacado
      baseOpacity: 0.18,     // opacidade do restante da linha
      thickness: 0.0075,     // espessura (unidades da cena)
      radius: 1.18,          // raio da órbita
      angle: 20,             // inclinação da órbita em graus, vista de cima (0 = de perfil, 90 = de frente)
      tilt: -12              // inclinação lateral em graus
    }
  }
};
