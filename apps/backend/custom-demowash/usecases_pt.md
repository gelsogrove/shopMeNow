## Índice

A DemoWash é uma rede de lavandarias self-service em franchising com 6 unidades na Catalunha: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** e **Terrassa**.

Cada unidade tem os seus próprios horários, máquinas, programas, preços e métodos de pagamento. Antes de dar qualquer dado operacional, o chatbot identifica sempre a unidade onde está o cliente. Para os problemas técnicos, pede os 4 dados um de cada vez: **unidade → tipo → número → ecrã**.

### A máquina tem um problema
- [Mensagem OPEN no ecrã (porta mal fechada)](#mensagem-open)
- [Mensagem ERR-01 no ecrã (programa antes do pagamento)](#mensagem-err-01)
- [Mensagem ALERT ou BLOCK (avaria técnica)](#mensagem-alert-ou-block)
- [A máquina não arranca depois de pagar (ecrã apagado)](#não-arranca-depois-de-pagar)
- [A porta não se destranca no fim do ciclo](#porta-não-se-destranca)
- [O secador não aquece](#secador-não-aquece)

### Pagamentos e reembolsos
- [Duplo débito no cartão](#duplo-débito)
- [Paguei mas a máquina não arrancou](#pagamento-sem-ativação)
- [Moedas do secador não somam](#moedas-secador-não-somam)
- [A roupa saiu mal lavada (suja, molhada, com mau cheiro)](#roupa-mal-lavada)
- [Quero a fatura](#fatura)

### Conselhos de lavagem (FAQ universal)
- [A que temperatura lavo uma camisa branca com nódoa?](#camisa-branca-com-nódoa)
- [A que temperatura lavo as cores?](#temperatura-cores)
- [Tenho uma nódoa de gordura, como a tiro?](#nódoa-de-gordura)
- [Tenho de trazer detergente?](#detergente-incluído)
- [Posso lavar edredons e mantas?](#edredons-e-mantas)
- [Quanto dura uma lavagem?](#duração-da-lavagem)

### Dados por unidade (franchising)
- [Quais são os horários?](#horários)
- [Quanto custa uma lavagem?](#preços)
- [Pode-se pagar com cartão?](#métodos-de-pagamento)
- [Que programas tem a máquina?](#programas)
- [Como funciona o cartão de fidelização?](#cartão-de-fidelização)
- [Quanto poupo com o cartão?](#poupança-com-o-cartão)
- [Onde fica a lavandaria mais próxima?](#lavandaria-mais-próxima)

---

## Mensagem OPEN

> Problema técnico — fluxo unidade → tipo → número → ecrã (1 dado por turno).

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

**Cliente:** Sim, desapareceu.
**Bot:** Perfeito. Seleciona de novo o programa. Boa lavagem! 👋

---

## Mensagem ERR-01

**Cliente:** Estou em Mataró, máquina 6 com ERR-01.
**Bot:** Pressionaste o programa antes de pagar. Vamos reiniciar:

1. Coloca a roupa e fecha bem a porta.
2. Vai ao terminal de pagamento, paga e seleciona o número da tua máquina.
3. Volta à máquina e prime o programa.

Diz-me se arranca.

**Cliente:** Agora arranca.
**Bot:** Perfeito! Boa lavagem 👋

---

## Mensagem ALERT ou BLOCK

**Cliente:** Sant Cugat, máquina 4, sai ALERT.
**Bot:** A máquina detetou uma anomalia e precisa de assistência. Por favor, muda a roupa para outra máquina livre e diz-me qual escolheste. Ativamo-la à distância para que possas lavar sem custos adicionais.

**Cliente:** Agora estou na máquina 2.
**Bot:** Obrigado. Como te chamas? Encaminho o caso para um operador para ativar a máquina 2 e registar a anomalia da 4.

**Cliente:** Andrea.
**Bot:** Registei o teu caso, Andrea. Um operador vai contactar-te dentro de poucos minutos.

---

## Não arranca depois de pagar

> Caso particular: o ecrã está apagado ou não mostra qualquer código — o bot escala diretamente porque sem código não há procedimento documentado.

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
**Bot:** Registei o teu caso, Marta. Um operador vai contactar-te dentro de poucos minutos.

---

## Porta não se destranca

**Cliente:** A porta não abre, a lavagem já terminou.
**Bot:** Tranquila. Quando o ciclo termina, a porta demora uns minutos a destrancar. Há quanto tempo terminou a lavagem?

**Cliente:** Mais de 5 minutos.
**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.
**Bot:** Que número tem a máquina?

**Cliente:** A 2.
**Bot:** Como te chamas? Encaminho o caso para um operador para destrancar a porta à distância.

**Cliente:** Luis.
**Bot:** Registei o teu caso, Luis. Um operador vai contactar-te dentro de poucos minutos.

---

## Secador não aquece

**Cliente:** O secador não aquece, os minutos passam mas a roupa fica molhada.
**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Terrassa.
**Bot:** Que número tem o secador?

**Cliente:** O 5.
**Bot:** Como te chamas? Encaminho o caso para um operador para reembolsar o ciclo e verificar a máquina.

**Cliente:** Anna.
**Bot:** Registei o teu caso, Anna. Um operador vai contactar-te dentro de poucos minutos.

---

## Duplo débito

**Cliente:** Cobraram-me duas vezes no cartão.
**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Eixample.
**Bot:** Que número tem a máquina?

**Cliente:** A 1.
**Bot:** Podes dar-me os 4 últimos dígitos do cartão e o teu nome? Encaminho o caso para um operador para verificar o duplo débito.

**Cliente:** Cartão 8821, sou o Jordi.
**Bot:** Registei o teu caso, Jordi. Um operador vai contactar-te dentro de poucos minutos.

---

## Pagamento sem ativação

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

## Moedas secador não somam

**Cliente:** Pus moedas no secador mas os minutos não aumentam.
**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Rubí.
**Bot:** Que número tem o secador?

**Cliente:** O 3.
**Bot:** Como te chamas? Encaminho o caso para um operador para devolver o dinheiro e verificar a máquina.

**Cliente:** Mireia.
**Bot:** Registei o teu caso, Mireia. Um operador vai contactar-te dentro de poucos minutos.

---

## Roupa mal lavada

> O cliente reporta um resultado de serviço defeituoso (roupa ainda suja depois do ciclo, ainda molhada depois de uma secagem completa, mau cheiro). O bot trata o caso como incidência de qualidade, recolhe unidade + tipo + número da máquina + nome e encaminha o caso para um operador para avaliar o reembolso. O bot **não decide** o reembolso — é o operador quem o gere.

**Cliente:** A roupa saiu suja e cheira mal depois da lavagem, quero um reembolso.
**Bot:** Lamento. Em que lavandaria estás?

**Cliente:** Eixample.
**Bot:** Máquina de lavar ou secadora?

**Cliente:** Máquina de lavar, a 3.
**Bot:** Como te chamas?

**Cliente:** Marta.
**Bot:** Registei o teu caso, Marta. Um operador vai contactar-te dentro de poucos minutos para avaliar o caso e o reembolso.

---

## Fatura

> O bot pede os dados um a um (regra "uma pergunta por turno"): razão social → valor → data do serviço → email → nota opcional.
>
> 🔒 **Dados sensíveis fora do fluxo LLM**: razão social, NIF/NIPC, morada, email e outros dados pessoais NÃO são enviados ao modelo de IA (OpenAI/OpenRouter). O bot recolhe cada campo e o nosso código processa-o de forma determinista — as respostas nestes turnos estão **cabladas no código**, não geradas pelo LLM. Assim os dados PII ficam fora do fluxo padrão para a IA.

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

## Camisa branca com nódoa

> FAQ universal — não depende da unidade.

**Cliente:** Tenho uma camisa branca com nódoa, a que temperatura a posso lavar para não a estragar?
**Bot:** Para uma camisa branca com nódoa:
- **Algodão resistente**: **40°C** (até 60°C se a nódoa é muito persistente)
- **Tecidos delicados** (seda, lã, misturas finas): **30°C**

Acima de 40°C em tecidos delicados arriscas-te a fixar a nódoa. Seleciona o programa correspondente no ecrã da máquina — o detergente é doseado automaticamente.

---

## Temperatura cores

**Cliente:** A que temperatura lavo as cores?
**Bot:** Regra geral para as cores:
- **Cores escuras / pretos**: **30°C** (evita a perda de cor)
- **Cores claras**: **30-40°C**
- **Cores resistentes com nódoas**: até **40°C**

Nunca laves as cores acima de 40°C na primeira vez: a cor solta-se mais quando é nova.

---

## Nódoa de gordura

**Cliente:** Tenho uma nódoa de gordura numa camisa, como a tiro?
**Bot:** Primeiro absorve o excesso com papel de cozinha sem esfregar (esfregar espalha a nódoa). Depois seleciona:
- **Algodão**: **60°C**
- **Sintéticos ou delicados**: **40°C**

O detergente Demowash inclui um componente desengordurante doseado automaticamente.

---

## Detergente incluído

**Cliente:** Tenho de trazer detergente?
**Bot:** Não, não precisas de trazer nada! As máquinas Demowash **doseiam automaticamente** detergente e amaciador ecológicos certificados, feitos com ingredientes 100% naturais. Só precisas de trazer a roupa. 😊

---

## Edredons e mantas

**Cliente:** Posso lavar edredons e mantas?
**Bot:** Sim, podes! Estes são os conselhos:

**Edredons e mantas em algodão ou poliéster resistente:**
- **Temperatura**: **40°C**
- **Capacidade**: usa uma máquina de **20 kg** para edredons grandes
- **Depois da lavagem**: secador a temperatura **alta ou média** para eliminar bem a humidade

**Edredons delicados ou com enchimento sintético:**
- **Temperatura**: **30°C**

**Conselhos**:
- Não sobrecarregues a máquina — o edredon precisa de espaço para se mover bem
- Depois da lavagem o edredon sai muito molhado: passa pelo **secador** para terminar

Se queres saber que máquinas grandes existem e os preços exatos, diz-me em que lavandaria estás. 😊

---

## Duração da lavagem

**Cliente:** Quanto dura uma lavagem?
**Bot:** A duração depende do **programa** que escolheres:

- **60°C** (muito quente): **50-55 minutos**
- **40°C** (quente): **45-50 minutos**
- **30°C** (morno): **40-45 minutos**
- **Frio** (*): **35-40 minutos**

São tempos aproximados. Durante o ciclo verás no ecrã a contagem decrescente do tempo restante (ex. `T-28` significa 28 minutos). 😊

---

## Horários

> FAQ por unidade — o bot pergunta só pela unidade.

**Cliente:** Quais são os horários?
**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.
**Bot:** Em **Gràcia** estamos abertos das **7:00 às 23:00**, todos os dias.

---

## Preços

**Cliente:** Quanto custa uma lavagem?
**Bot:** Em que lavandaria estás?

**Cliente:** Eixample.
**Bot:** Em **Eixample** estes são os preços da máquina de lavar:

| Nº   | Peso  | Fidelização | Dinheiro |
|------|-------|-------------|----------|
| 1    | 20 kg | 7 €         | 8 €      |
| 2    | 20 kg | 7 €         | 8 €      |
| 3    | 10 kg | 4 €         | 4,50 €   |
| 4    | 10 kg | 4 €         | 4,50 €   |

Queres também os preços do secador?

---

## Métodos de pagamento

**Cliente:** Pode-se pagar com cartão?
**Bot:** Em que lavandaria estás?

**Cliente:** Gràcia.
**Bot:** Em **Gràcia** só se aceita **cartão de crédito/débito**. Não há dinheiro nem cartão de fidelização nesta unidade.

---

## Programas

**Cliente:** Que programas tem a máquina?
**Bot:** Em que lavandaria estás?

**Cliente:** Eixample.
**Bot:** Em **Eixample** a máquina de lavar tem 4 programas:

| Botão | Programa     | Temperatura |
|-------|--------------|-------------|
| 1     | Muito quente | 60°         |
| 2     | Quente       | 40°         |
| 3     | Morno        | 30°         |
| 4     | Frio         | *           |

O secador tem 3: alta, média e baixa temperatura.

---

## Cartão de fidelização

> O bot confirma se a unidade do cliente aceita o cartão e mostra os preços reduzidos. Para ativação, recarga ou consulta de saldo encaminha para a equipa da lavandaria — são eles que gerem o cartão no local. O bot apresenta isto como um serviço da unidade, não como uma limitação própria.

**Cliente:** Como funciona o cartão de fidelização?
**Bot:** Com o cartão de fidelização pagas **menos** que com dinheiro ou cartão bancário — o desconto aplica-se automaticamente em cada lavagem e secagem.

Em que lavandaria estás? Confirmo-te se o aceitamos e dou-te os preços.

**Cliente:** Eixample.
**Bot:** Em **Eixample** sim, aceitamos cartão de fidelização. Estes são os preços:

| Máquina         | Capacidade | Fidelização |
|-----------------|------------|-------------|
| Lavar 1-2       | 20 kg      | 7 €         |
| Lavar 3-4       | 10 kg      | 4 €         |
| Secador 5-6     | 20 kg      | 2,50 €      |

---

## Poupança com o cartão

> O bot precisa da unidade para mostrar a poupança exata — cada local tem preços diferentes.

**Cliente:** Quanto poupo com o cartão?
**Bot:** Para te dizer a poupança exata, em que lavandaria estás?

**Cliente:** Rubí.
**Bot:** Em **Rubí** a poupança com o cartão de fidelização é:

**Máquinas de lavar**:
- Máquina 1 (10 kg): **0,50 € de poupança** (4,50 € com cartão vs 5 € em dinheiro)
- Máquina 2 (15 kg): **1 € de poupança** (6 € com cartão vs 7 € em dinheiro)
- Máquina 3 (20 kg): **1 € de poupança** (7 € com cartão vs 8 € em dinheiro)

**Secadores** (máquinas 4 e 5, 20 kg): **mesmo preço** com cartão ou em dinheiro (2 € / 15 min).

💡 Se usares a máquina grande (máquina 3) com frequência, o cartão amortiza-se em poucas utilizações. 😊

---

## Lavandaria mais próxima

**Cliente:** Onde fica a lavandaria mais próxima?
**Bot:** Em que zona estás? Passo-te os dados da unidade mais cómoda.

**Cliente:** Estou em Barcelona.
**Bot:** Em Barcelona temos duas unidades Demowash:

1. **Eixample** — C/ Aragó 286, perto de Passeig de Gràcia. Horário: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, perto de Plaça del Sol. Horário: 7:00 — 23:00

Em qual das duas estás, ou qual te interessa? 😊

---
