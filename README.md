# Calculadora de Financiamento Imobiliário

Simula quanto tempo leva para juntar a entrada e financiar um imóvel, considerando inflação imobiliária, salário, aportes, FGTS e o limite de 30% da renda nas parcelas (SAC ou PRICE).

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org/) instalado.

```bash
npm install
npm run dev
```

Abra no navegador: [http://localhost:5173/](http://localhost:5173/)

Nas próximas vezes, basta executar `npm run dev` (o `npm install` só é necessário na primeira vez ou quando as dependências mudarem).

### Outros comandos

```bash
npm run build    # gera a versão de produção em dist/
npm run preview  # preview da build de produção
```

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
