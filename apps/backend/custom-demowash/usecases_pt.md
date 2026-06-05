### A máquina tem um problema

- [A minha máquina não arranca](#a-minha-máquina-não-arranca)
- [A máquina mostra ERR-01](#a-máquina-mostra-err-01)
- [A máquina mostra ALERT ou BLOCK](#a-máquina-mostra-alert-ou-block)
- [Paguei mas a máquina não arranca](#paguei-mas-a-máquina-não-arranca)
- [A porta não abre, a lavagem já terminou](#a-porta-não-abre-a-lavagem-já-terminou)
- [O secador não aquece](#o-secador-não-aquece)

### Pagamentos e reembolsos

- [Cobraram-me duas vezes no cartão](#cobraram-me-duas-vezes-no-cartão)
- [Paguei mas a máquina não arrancou, quero o reembolso](#paguei-mas-a-máquina-não-arrancou-quero-o-reembolso)
- [Pus moedas no secador mas não soma minutos](#pus-moedas-no-secador-mas-não-soma-minutos)
- [A roupa saiu suja e cheira mal, quero um reembolso](#a-roupa-saiu-suja-e-cheira-mal-quero-um-reembolso)
- [Quero a fatura da lavagem](#quero-a-fatura-da-lavagem)

### Conselhos de lavagem

- [Tenho uma camisa branca com nódoa, a que temperatura a posso lavar?](#tenho-uma-camisa-branca-com-nódoa-a-que-temperatura-a-posso-lavar)
- [A que temperatura lavo as cores?](#a-que-temperatura-lavo-as-cores)
- [Tenho uma nódoa de gordura, como a tiro?](#tenho-uma-nódoa-de-gordura-como-a-tiro)
- [Tenho de trazer detergente?](#tenho-de-trazer-detergente)
- [Posso lavar edredons e mantas?](#posso-lavar-edredons-e-mantas)
- [Quanto dura uma lavagem?](#quanto-dura-uma-lavagem)

### Dados por unidade

- [Quais são os horários?](#quais-são-os-horários)
- [Quanto custa uma lavagem?](#quanto-custa-uma-lavagem)
- [Pode-se pagar com cartão?](#pode-se-pagar-com-cartão)
- [Que programas tem a máquina?](#que-programas-tem-a-máquina)
- [Como funciona o cartão de fidelização?](#como-funciona-o-cartão-de-fidelização)
- [Quanto poupo com o cartão?](#quanto-poupo-com-o-cartão)
- [Onde fica a lavandaria mais próxima?](#onde-fica-a-lavandaria-mais-próxima)

---

## A minha máquina não arranca

> Ecrã `OPEN` (a porta não fecha ANTES da lavagem). Se após reposicionar a roupa a mensagem persistir, costuma ser **sobrecarga**: sugerir retirar algumas peças e redistribuir a carga antes de escalar. (Isto NÃO se aplica a `OPEN ERROR`, onde o ciclo já terminou.)

**Cliente:** A minha máquina não arranca.

**Bot:** Olá! 👋 Sou o assistente virtual da **Demowash**. Em que lavandaria estás?

**Cliente:** Eixample.

**Bot:** Máquina de lavar ou secadora?

**Cliente:** Máquina de lavar.

**Bot:** Que número tem a máquina?

**Cliente:** A 3.

**Bot:** O que vês no ecrã?

**Cliente:** OPEN.

**Bot:** Abre a porta com cuidado, verifica se há alguma peça presa na borracha e fecha-a com firmeza até ouvires o clique. A mensagem desapareceu?

**Cliente:** Não, continua a aparecer OPEN.

**Bot:** Às vezes a porta não fecha porque há demasiada roupa. Retira algumas peças e distribui bem a carga no tambor, depois fecha a porta. Fechou?

**Cliente:** Sim, agora sim.

**Bot:** Perfeito. Seleciona de novo o programa. Boa lavagem! 👋

---

## A máquina mostra ERR-01

**Cliente:** Estou em Mataró, máquina 6 com ERR-01.

**Bot:** Pressionaste o programa antes de pagar. Vamos reiniciar:

1. Coloca a roupa e fecha bem a porta.
2. Vai ao terminal de pagamento, paga e seleciona o número da tua máquina.
3. Volta à máquina e prime o programa.

Diz-me se arranca.

**Cliente:** Agora arranca.

**Bot:** Perfeito! Boa lavagem 👋

---

## A máquina mostra ALERT ou BLOCK

**Cliente:** Sant Cugat, máquina 4, sai ALERT.

**Bot:** A máquina detetou uma anomalia e precisa de assistência. Por favor, muda a roupa para outra máquina livre e diz-me qual escolheste. Ativamo-la à distância para que possas lavar sem custos adicionais.

**Cliente:** Agora estou na máquina 2.

**Bot:** Obrigado. Como te chamas? Encaminho o caso para um operador para ativar a máquina 2 e registar a anomalia da 4.

**Cliente:** Andrea.

**Bot:** Registei o teu caso, Andrea. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## Paguei mas a máquina não arranca

**Cliente:** Paguei mas a máquina não arranca.

**Bot:** Em que lavandaria estás?

**Cliente:** Rubí.

**Bot:** Máquina de lavar ou secadora?

**Cliente:** Máquina de lavar.

**Bot:** Que número tem a máquina?

**Cliente:** A 3.

**Bot:** O que vês no ecrã?

**Cliente:** Nada, está apagado.

**Bot:** Entendido. Como te chamas? Encaminho o caso para um operador para ativar a máquina à distância.

**Cliente:** Marta.

**Bot:** Registei o teu caso, Marta. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## A porta não abre, a lavagem já terminou

> Ecrã típico: `OPEN ERROR`. Diferente de `OPEN:` (porta que não fecha ANTES da lavagem). Aplica-se de forma idêntica à máquina de lavar e de secar: a roupa já está processada e presa lá dentro — nunca propor trocar de máquina nem voltar a lavar/secar. É URGENTE.
>
> 🚨 Desambiguação: se o cliente apenas disser «não abre» sem precisar, PERGUNTA primeiro se o ciclo já terminou com a roupa lá dentro: sim → `OPEN ERROR`; ainda não / não fecha para começar → `OPEN:`.

**Cliente:** A porta não abre.

**Bot:** Para te ajudar melhor: a lavagem já terminou e tens a roupa lá dentro, ou ainda não conseguiste começar?

**Cliente:** Já terminou, a roupa está lá dentro.

**Bot:** Tranquila. Quando o ciclo termina, a porta demora uns minutos a destrancar. Há quanto tempo terminou a lavagem?

**Cliente:** Mais de 5 minutos.

**Bot:** Puxa a pega com firmeza, às vezes precisa de um pouco mais de força. Abriu?

**Cliente:** Não, continua trancada.

**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.

**Bot:** Que número tem a máquina?

**Cliente:** A 2.

> 🔧 _Leitura interna da máquina (não é mostrada ao cliente, vai para o operador):_ `📟 Gràcia > lavadora > Núm 2 = OPEN ERROR`

**Bot:** Como te chamas? Encaminho o caso com prioridade para um operador para destrancar a porta à distância.

**Cliente:** Luis.

**Bot:** Registei o teu caso, Luis. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## O secador não aquece

**Cliente:** O secador não aquece, os minutos passam mas a roupa fica molhada.

**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Terrassa.

**Bot:** Que número tem o secador?

**Cliente:** O 5.

**Bot:** Como te chamas? Encaminho o caso para um operador para reembolsar o ciclo e verificar a máquina.

**Cliente:** Anna.

**Bot:** Registei o teu caso, Anna. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## Cobraram-me duas vezes no cartão

**Cliente:** Cobraram-me duas vezes no cartão.

**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Eixample.

**Bot:** Que número tem a máquina?

**Cliente:** A 1.

**Bot:** Podes dar-me os 4 últimos dígitos do cartão e o teu nome? Encaminho o caso para um operador para verificar o duplo débito.

**Cliente:** Cartão 8821, sou o Jordi.

**Bot:** Registei o teu caso, Jordi. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## Paguei mas a máquina não arrancou, quero o reembolso

**Cliente:** Paguei mas a máquina não arrancou e quero o reembolso.

**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Mataró.

**Bot:** Máquina de lavar ou secadora?

**Cliente:** Máquina de lavar, a 6.

**Bot:** Como pagaste: dinheiro, cartão de fidelização ou cartão bancário?

**Cliente:** Cartão bancário, termina em 4412.

**Bot:** Como te chamas?

**Cliente:** Carla.

**Bot:** Registei o teu caso, Carla. Um operador vai contactar-te dentro de poucos minutos para processar o reembolso.

---

## Pus moedas no secador mas não soma minutos

**Cliente:** Pus moedas no secador mas os minutos não aumentam.

**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Rubí.

**Bot:** Que número tem o secador?

**Cliente:** O 3.

**Bot:** Como te chamas? Encaminho o caso para um operador para devolver o dinheiro e verificar a máquina.

**Cliente:** Mireia.

**Bot:** Registei o teu caso, Mireia. Um operador vai contactar-te dentro de poucos minutos. O chatbot fica em espera do apoio humano.

---

## A roupa saiu suja e cheira mal, quero um reembolso

**Cliente:** A roupa saiu suja e cheira mal depois da lavagem, quero um reembolso.

**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Eixample.

**Bot:** Máquina de lavar ou secadora?

**Cliente:** Máquina de lavar, a 3.

**Bot:** Como te chamas?

**Cliente:** Marta.

**Bot:** Registei o teu caso, Marta. Um operador vai contactar-te dentro de poucos minutos para avaliar o caso e o reembolso.

---

## Quero a fatura da lavagem

**Cliente:** Quero a fatura da lavagem.

**Bot:** Perfeito! Vou preparar-te a fatura. Qual é o nome da empresa ou razão social?

**Cliente:** Marta Ribas Lda.

**Bot:** Obrigado. Qual é o valor que pagaste? (em euros)

**Cliente:** 8 €.

**Bot:** Perfeito. Quando usaste o serviço? (ex. hoje, ontem, 29/05/2026)

**Cliente:** Hoje.

**Bot:** Entendido. Para que email envio a fatura?

**Cliente:** marta@example.com

**Bot:** Obrigado. Queres adicionar uma nota? (ex. NIF, código de cliente, referência) Se não, escreve "não".

**Cliente:** NIF B12345678.

**Bot:** Perfeito. Registei a fatura com os dados: Marta Ribas Lda, 8 €, hoje, NIF B12345678. Vai chegar a marta@example.com dentro de poucos minutos.

---

## Tenho uma camisa branca com nódoa, a que temperatura a posso lavar?

**Cliente:** Tenho uma camisa branca com nódoa, a que temperatura a posso lavar para não a estragar?

**Bot:** Para uma camisa branca com nódoa:

- **Algodão resistente**: 40°C (até 60°C se a nódoa é muito persistente)
- **Tecidos delicados** (seda, lã, misturas finas): 30°C

Acima de 40°C em tecidos delicados arriscas-te a fixar a nódoa. Seleciona o programa correspondente no ecrã da máquina — o detergente é doseado automaticamente.

---

## A que temperatura lavo as cores?

**Cliente:** A que temperatura lavo as cores?

**Bot:** Regra geral para as cores:

- **Cores escuras / pretos**: 30°C (evita a perda de cor)
- **Cores claras**: 30-40°C
- **Cores resistentes com nódoas**: até 40°C

Nunca laves as cores acima de 40°C na primeira vez: a cor solta-se mais quando é nova.

---

## Tenho uma nódoa de gordura, como a tiro?

**Cliente:** Tenho uma nódoa de gordura numa camisa, como a tiro?

**Bot:** Primeiro absorve o excesso com papel de cozinha sem esfregar (esfregar espalha a nódoa). Depois seleciona:

- **Algodão**: 60°C
- **Sintéticos ou delicados**: 40°C

O detergente Demowash inclui um componente desengordurante doseado automaticamente.

---

## Tenho de trazer detergente?

**Cliente:** Tenho de trazer detergente?

**Bot:** Não, não precisas de trazer nada! As máquinas Demowash **doseiam automaticamente** detergente e amaciador ecológicos certificados, feitos com ingredientes 100% naturais. Só precisas de trazer a roupa. 😊

---

## Posso lavar edredons e mantas?

**Cliente:** Posso lavar edredons e mantas?

**Bot:** Sim, podes! Estes são os conselhos:

Edredons e mantas em algodão ou poliéster resistente:

- Temperatura: 40°C
- Capacidade: usa uma máquina de 20 kg para edredons grandes
- Depois da lavagem: secador a temperatura alta ou média para eliminar bem a humidade

Edredons delicados ou com enchimento sintético:

- Temperatura: 30°C

Conselhos:

- Não sobrecarregues a máquina — o edredon precisa de espaço para se mover bem
- Depois da lavagem o edredon sai muito molhado: passa pelo secador para terminar

Se queres saber que máquinas grandes existem e os preços exatos, diz-me em que lavandaria estás. 😊

---

## Quanto dura uma lavagem?

**Cliente:** Quanto dura uma lavagem?

**Bot:** A duração depende do programa que escolheres:

- 60°C (muito quente): 50-55 minutos
- 40°C (quente): 45-50 minutos
- 30°C (morno): 40-45 minutos
- Frio (*): 35-40 minutos

São tempos aproximados. Durante o ciclo verás no ecrã a contagem decrescente do tempo restante (ex. `T-28` significa 28 minutos). 😊

---

## Quais são os horários?

**Cliente:** Quais são os horários?

**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.

**Bot:** Em **Gràcia** estamos abertos das **7:00 às 23:00**, todos os dias.

---

## Quanto custa uma lavagem?

**Cliente:** Quanto custa uma lavagem?

**Bot:** Em que lavandaria estás?

**Cliente:** Eixample.

**Bot:** Em **Eixample** estes são os preços da máquina de lavar:

- Máquina 1 (20 kg): 7 € com cartão fidelização / 8 € em dinheiro
- Máquina 2 (20 kg): 7 € com cartão fidelização / 8 € em dinheiro
- Máquina 3 (10 kg): 4 € com cartão fidelização / 4,50 € em dinheiro
- Máquina 4 (10 kg): 4 € com cartão fidelização / 4,50 € em dinheiro

Queres também os preços do secador?

---

## Pode-se pagar com cartão?

**Cliente:** Pode-se pagar com cartão?

**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.

**Bot:** Em **Gràcia** só se aceita **cartão de crédito/débito**. Não há dinheiro nem cartão de fidelização nesta unidade.

---

## Que programas tem a máquina?

**Cliente:** Que programas tem a máquina?

**Bot:** Em que lavandaria estás?

**Cliente:** Eixample.

**Bot:** Em **Eixample** a máquina de lavar tem 4 programas:

- Botão 1 — Muito quente — 60°C
- Botão 2 — Quente — 40°C
- Botão 3 — Morno — 30°C
- Botão 4 — Frio — (*)

O secador tem 3: alta, média e baixa temperatura.

---

## Como funciona o cartão de fidelização?

**Cliente:** Como funciona o cartão de fidelização?

**Bot:** Com o cartão de fidelização pagas **menos** que com dinheiro ou cartão bancário — o desconto aplica-se automaticamente em cada lavagem e secagem.

Em que lavandaria estás? Confirmo-te se o aceitamos e dou-te os preços.

**Cliente:** Eixample.

**Bot:** Em **Eixample** sim, aceitamos cartão de fidelização. Estes são os preços:

- Máquina de lavar 1-2 (20 kg): 7 €
- Máquina de lavar 3-4 (10 kg): 4 €
- Secador 5-6 (20 kg): 2,50 €

---

## Quanto poupo com o cartão?

**Cliente:** Quanto poupo com o cartão?

**Bot:** Para te dizer a poupança exata, em que lavandaria estás?

**Cliente:** Rubí.

**Bot:** Em **Rubí** a poupança com o cartão de fidelização é:

Máquinas de lavar:

- Máquina 1 (10 kg): 0,50 € de poupança (4,50 € com cartão vs 5 € em dinheiro)
- Máquina 2 (15 kg): 1 € de poupança (6 € com cartão vs 7 € em dinheiro)
- Máquina 3 (20 kg): 1 € de poupança (7 € com cartão vs 8 € em dinheiro)

Secadores (máquinas 4 e 5, 20 kg): mesmo preço com cartão ou em dinheiro (2 € / 15 min).

💡 Se usares a máquina grande (máquina 3) com frequência, o cartão amortiza-se em poucas utilizações. 😊

---

## Onde fica a lavandaria mais próxima?

**Cliente:** Onde fica a lavandaria mais próxima?

**Bot:** Em que zona estás? Passo-te os dados da unidade mais cómoda.

**Cliente:** Estou em Barcelona.

**Bot:** Em Barcelona temos duas unidades Demowash:

1. **Eixample** — C/ Aragó 286, perto de Passeig de Gràcia. Horário: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, perto de Plaça del Sol. Horário: 7:00 — 23:00

Em qual das duas estás, ou qual te interessa? 😊

---

---

## Quero abrir uma franquia Demowash

**Cliente:** Olá, quero montar um negócio. Vocês oferecem franquia na Demowash?

**Bot:** Olá! 👋 Sou o assistente virtual da **Demowash**. Sim, oferecemos consultoria gratuita em franchising. Posso agendar uma reunião com nosso time comercial para explicar o modelo completo.

Te interessa?

**Cliente:** Sim, gostaria de saber mais.

**Bot:** Ótimo! Como você se chama?

**Cliente:** Marco Rossi

**Bot:** [Tool: `capture_pii({name: "Marco Rossi"})` + `remember({name: "Marco Rossi"})`]

Prazer, Marco. Qual é o seu email? Enviarei a confirmação com os detalhes da consultoria.

**Cliente:** marco.rossi@email.com

**Bot:** [Tool: `capture_pii({email: "marco.rossi@email.com"})`]

Obrigado! E seu telefone? (opcional)

**Cliente:** 034 567 8901

**Bot:** [Tool: `capture_pii({phone: "034 567 8901"})`]

Perfeito, Marco. Um último detalhe: em qual cidade quer abrir a lavandaria?

**Cliente:** Em Mataró

**Bot:** [Tool: `remember({location: "Mataró"})`]

Excelente! Estes são os horários disponíveis para falar com nosso time comercial:

📅 **Segunda-feira 10 de junho**
- 1. 10:00
- 2. 15:00

📅 **Terça-feira 11 de junho**
- 3. 11:00

Qual te convém?

**Cliente:** 2

**Bot:** [Tool: `schedule_consultation({slotIndex: 2})`]

✅ Perfeito, Marco! Confirmei sua reunião para **segunda-feira 10 de junho às 15:00** com nosso time comercial.

Você receberá um email com:
- 🔗 Link Zoom para a videoconferência
- 📅 Adicionar ao calendário (Google Calendar / Outlook)
- 📌 Detalhes da consultoria

Nosso especialista explicará o modelo de franchising, custos iniciais, suporte contínuo e próximos passos.

Até logo! 👋
