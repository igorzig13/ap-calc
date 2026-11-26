import { useMemo, useState } from 'react'
import { CalculatorForm } from './components/CalculatorForm'
import { Results } from './components/Results'
import { ThemeToggle } from './components/ThemeToggle'
import {
  calculate,
  DEFAULT_INPUTS,
  type CalculatorInputs,
} from './lib/calculations'

export default function App() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS)
  const result = useMemo(() => calculate(inputs), [inputs])

  return (
    <div className="relative min-h-svh bg-surface text-ink">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70 dark:opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, var(--color-hero-glow) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[90rem] px-4 py-10 sm:px-5 sm:py-14 lg:px-6 xl:px-8">
        <div className="absolute right-4 top-4 sm:right-5 sm:top-5 lg:right-6 xl:right-8 z-10">
          <ThemeToggle />
        </div>

        <header className="mb-10 max-w-2xl pr-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-3">
            Planejamento imobiliário
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
            Calculadora de financiamento
          </h1>
          <p className="mt-3 text-muted text-base leading-relaxed">
            Simule quanto tempo leva para juntar a entrada e financiar um
            imóvel, considerando inflação imobiliária, aportes, FGTS e o limite
            de 30% da renda nas parcelas.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12 xl:gap-14">
          <aside className="rounded-2xl border border-line bg-panel p-6 sm:p-7 h-fit lg:sticky lg:top-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
            <h2 className="text-sm font-semibold text-ink mb-6">Parâmetros</h2>
            <CalculatorForm values={inputs} onChange={setInputs} />
          </aside>

          <main>
            <Results
              result={result}
              initialPropertyPrice={inputs.propertyPrice}
              financing={{
                rate: inputs.financingRate,
                term: inputs.financingTerm,
                type: inputs.financingType,
              }}
            />
          </main>
        </div>

        <footer className="mt-14 border-t border-line pt-6 text-xs text-muted leading-relaxed max-w-3xl">
          Premissas: entrada mínima de 20%; comprometimento máximo de 30% da
          renda; FGTS com depósito de 8% do salário e rendimento de ~3% a.a.,
          liberado após 36 meses; taxas de financiamento convertidas em taxa
          nominal mensal (a.a. ÷ 12). Valores são estimativas e não substituem
          análise bancária.
        </footer>
      </div>
    </div>
  )
}
