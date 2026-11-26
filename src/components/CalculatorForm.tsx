import type { ReactNode } from 'react'
import {
  isContributionAboveLimit,
  MAX_CONTRIBUTION_RATIO,
  maxMonthlyContribution,
  type CalculatorInputs,
  type FinancingType,
} from '../lib/calculations'
import { formatBRL } from '../lib/format'

interface CalculatorFormProps {
  values: CalculatorInputs
  onChange: (values: CalculatorInputs) => void
}

export function CalculatorForm({ values, onChange }: CalculatorFormProps) {
  function update<K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K],
  ) {
    onChange({ ...values, [key]: value })
  }

  const maxContribution = maxMonthlyContribution(values.initialSalary)
  const contributionWarning = isContributionAboveLimit(
    values.monthlyContribution,
    values.initialSalary,
  )

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Imóvel
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Preço atual do imóvel"
            prefix="R$"
            value={values.propertyPrice}
            onChange={(v) => update('propertyPrice', v)}
            step={1000}
            min={0}
          />
          <Field
            label="Inflação imobiliária"
            suffix="% a.a."
            value={values.realEstateInflation}
            onChange={(v) => update('realEstateInflation', Math.max(0, v))}
            step={1}
            min={0}
            steppers
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Renda e aportes
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Salário inicial"
            prefix="R$"
            value={values.initialSalary}
            onChange={(v) => update('initialSalary', v)}
            step={100}
            min={0}
          />
          <Field
            label="Crescimento salarial"
            suffix="% a.a."
            value={values.salaryGrowth}
            onChange={(v) => update('salaryGrowth', Math.max(0, v))}
            step={1}
            min={0}
            steppers
          />
          <Field
            label="Patrimônio prévio"
            prefix="R$"
            hint="Investimentos já acumulados hoje"
            value={values.priorWealth}
            onChange={(v) => update('priorWealth', Math.max(0, v))}
            step={1000}
            min={0}
          />
          <Field
            label="Aporte mensal"
            prefix="R$"
            hint="Valor investido todo mês"
            value={values.monthlyContribution}
            onChange={(v) => update('monthlyContribution', v)}
            step={50}
            min={0}
            warning={
              contributionWarning
                ? `O aporte supera ${(MAX_CONTRIBUTION_RATIO * 100).toFixed(0)}% do salário (recomendado até ${formatBRL(maxContribution)}).`
                : undefined
            }
          />
          <Field
            label="Rendimento dos investimentos"
            suffix="% a.a."
            value={values.investmentReturn}
            onChange={(v) => update('investmentReturn', Math.max(0, v))}
            step={1}
            min={0}
            steppers
          />
        </div>

        <fieldset className="pt-1">
          <legend className="text-sm font-medium text-ink mb-2">
            Aportes acompanham o salário?
          </legend>
          <p className="text-xs text-muted mb-3">
            Se sim, o aporte mensal cresce na mesma proporção dos reajustes
            salariais.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="contributionsGrowWithSalary"
                checked={values.contributionsGrowWithSalary}
                onChange={() => update('contributionsGrowWithSalary', true)}
                className="size-4 accent-accent"
              />
              Sim
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="contributionsGrowWithSalary"
                checked={!values.contributionsGrowWithSalary}
                onChange={() => update('contributionsGrowWithSalary', false)}
                className="size-4 accent-accent"
              />
              Não
            </label>
          </div>
        </fieldset>

        <div className="pt-1">
          <span className="text-sm font-medium text-ink block mb-2">
            Usar FGTS
          </span>
          <p className="text-xs text-muted mb-3">
            Depósito de 8% do salário/mês. Disponível após 3 anos. Rendimento
            estimado de 3% a.a.
          </p>
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            <ToggleButton
              active={values.useFgts}
              onClick={() => update('useFgts', true)}
            >
              Sim
            </ToggleButton>
            <ToggleButton
              active={!values.useFgts}
              onClick={() => update('useFgts', false)}
            >
              Não
            </ToggleButton>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Financiamento
        </legend>
        <div>
          <span className="text-sm font-medium text-ink block mb-2">
            Tipo de amortização
          </span>
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            <ToggleButton
              active={values.financingType === 'sac'}
              onClick={() => update('financingType', 'sac' as FinancingType)}
            >
              SAC
            </ToggleButton>
            <ToggleButton
              active={values.financingType === 'price'}
              onClick={() => update('financingType', 'price' as FinancingType)}
            >
              PRICE
            </ToggleButton>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Prazo"
            suffix="meses"
            value={values.financingTerm}
            onChange={(v) =>
              update('financingTerm', Math.min(420, Math.max(12, Math.round(v))))
            }
            step={12}
            min={12}
            max={420}
          />
          <Field
            label="Juros do financiamento"
            suffix="% a.a."
            value={values.financingRate}
            onChange={(v) => update('financingRate', v)}
            step={0.1}
            min={0}
          />
        </div>
      </fieldset>
    </form>
  )
}

function Field({
  label,
  hint,
  suffix,
  prefix,
  value,
  onChange,
  min,
  max,
  step = 1,
  warning,
  steppers = false,
}: {
  label: string
  hint?: string
  suffix?: string
  prefix?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  warning?: string
  steppers?: boolean
}) {
  function clamp(next: number) {
    let result = next
    if (min !== undefined) result = Math.max(min, result)
    if (max !== undefined) result = Math.min(max, result)
    return result
  }

  const rightPadding = steppers
    ? suffix
      ? 'pr-[4.75rem]'
      : 'pr-9'
    : suffix
      ? 'pr-14'
      : ''

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {label}
        {warning && <WarningTooltip message={warning} />}
      </span>
      {hint && <span className="text-xs text-muted -mt-0.5">{hint}</span>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm text-muted pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className={`w-full rounded-lg border bg-panel px-3 py-2.5 text-sm text-ink outline-none transition focus:ring-2 ${
            warning
              ? 'border-warning/40 focus:border-warning/50 focus:ring-warning/10'
              : 'border-line focus:border-accent focus:ring-accent/10'
          } ${prefix ? 'pl-10' : ''} ${rightPadding}`}
        />
        {suffix && (
          <span
            className={`absolute text-sm text-muted pointer-events-none ${
              steppers ? 'right-9' : 'right-3'
            }`}
          >
            {suffix}
          </span>
        )}
        {steppers && (
          <div className="absolute right-1.5 flex flex-col">
            <button
              type="button"
              aria-label="Aumentar"
              onClick={() => onChange(clamp(value + step))}
              className="flex h-4 w-6 items-center justify-center rounded-t text-muted transition hover:bg-surface hover:text-ink"
            >
              <StepperIcon direction="up" />
            </button>
            <button
              type="button"
              aria-label="Diminuir"
              onClick={() => onChange(clamp(value - step))}
              className="flex h-4 w-6 items-center justify-center rounded-b text-muted transition hover:bg-surface hover:text-ink"
            >
              <StepperIcon direction="down" />
            </button>
          </div>
        )}
      </div>
    </label>
  )
}

function StepperIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      className={direction === 'down' ? 'rotate-180' : undefined}
    >
      <path
        d="M1 5L5 1L9 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarningTooltip({ message }: { message: string }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={message}
        className="inline-flex size-4 items-center justify-center rounded-full bg-warning-soft text-[10px] font-bold leading-none text-warning"
      >
        !
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-52 -translate-x-1/2 rounded-md bg-ink px-2.5 py-2 text-[11px] font-normal leading-snug text-surface opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {message}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
      </span>
    </span>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-accent text-surface shadow-sm'
          : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
