import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type {
  CalculationResult,
  FinancingType,
  LoanSummary,
  PurchaseMode,
  YearSnapshot,
} from '../lib/calculations'
import {
  computeLoanSummary,
  downPaymentBounds,
  financingFromDownPayment,
  MAX_INCOME_RATIO,
  MIN_DOWN_PAYMENT_RATIO,
} from '../lib/calculations'
import { formatBRL, formatDuration, formatPercent } from '../lib/format'

interface FinancingParams {
  rate: number
  term: number
  type: FinancingType
}

interface ResultsProps {
  result: CalculationResult
  initialPropertyPrice: number
  financing: FinancingParams
}

export function Results({
  result,
  initialPropertyPrice,
  financing,
}: ResultsProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [loanSummary, setLoanSummary] = useState<LoanSummary | null>(null)

  // Só reseta a exploração ao mudar parâmetros — não zera o resumo aqui
  // (evitar race com o efeito do cenário que republica o loanSummary)
  useEffect(() => {
    setSelectedYear(null)
  }, [result])

  const selectedSnapshot =
    selectedYear === null
      ? null
      : (result.yearlyProjection.find((row) => row.year === selectedYear) ??
        null)

  const exploring = selectedSnapshot !== null
  const mainAffordable = result.monthsToAfford !== null

  const showFinancingOverview = exploring
    ? selectedSnapshot.canAfford && !selectedSnapshot.canBuyCash
    : mainAffordable && result.purchaseMode !== 'cash'

  return (
    <div className="space-y-6">
      {exploring ? (
        <YearScenario
          snapshot={selectedSnapshot}
          initialPropertyPrice={initialPropertyPrice}
          minimumMonths={result.monthsToAfford}
          financing={financing}
          onBack={() => setSelectedYear(null)}
          onLoanSummaryChange={setLoanSummary}
        />
      ) : (
        <MainResult
          result={result}
          affordable={mainAffordable}
          financing={financing}
          onLoanSummaryChange={setLoanSummary}
        />
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-ink">
            Projeção ano a ano
          </h3>
          <span className="text-xs text-muted text-right">
            Até o ano 10 · clique para explorar
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Ano</th>
                <th className="px-4 py-3 font-medium">Preço imóvel</th>
                <th className="px-4 py-3 font-medium">Investimentos</th>
                <th className="px-4 py-3 font-medium">FGTS</th>
                <th className="px-4 py-3 font-medium">Patrimônio</th>
                <th className="px-4 py-3 font-medium">Entrada req.</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjection(result).map((row) => {
                const isSelected = selectedYear === row.year
                const isOptimal =
                  !exploring &&
                  mainAffordable &&
                  result.monthsToAfford !== null &&
                  Math.ceil(result.monthsToAfford / 12) === row.year

                return (
                  <tr
                    key={row.year}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedYear(row.year)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedYear(row.year)
                      }
                    }}
                    className={`border-b border-line/70 last:border-0 cursor-pointer transition outline-none focus-visible:bg-accent-soft ${
                      isSelected
                        ? 'bg-accent-soft ring-1 ring-inset ring-accent/20'
                        : row.canBuyCash
                          ? 'bg-cash-soft/50 hover:bg-cash-soft/80'
                          : row.canAfford
                            ? 'bg-success-soft/40 hover:bg-success-soft/70'
                            : 'hover:bg-danger-soft/40'
                    } ${isOptimal && !isSelected ? 'bg-success-soft/55' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-ink font-medium">
                      {row.year === 0 ? 'Hoje' : `Ano ${row.year}`}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {formatBRL(row.propertyPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {formatBRL(row.investments)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {formatBRL(row.fgts)}
                    </td>
                    <td className="px-4 py-2.5 text-ink">
                      {formatBRL(row.totalWealth)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {formatBRL(
                        row.canBuyCash
                          ? row.propertyPrice
                          : row.minimumDownPayment,
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        canBuyCash={row.canBuyCash}
                        canAfford={row.canAfford}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {showFinancingOverview &&
          loanSummary != null &&
          loanSummary.mode === 'finance' && (
            <FinancingOverview summary={loanSummary} financing={financing} />
          )}
      </div>
    </div>
  )
}

function FinancingOverview({
  summary,
  financing,
}: {
  summary: LoanSummary
  financing: FinancingParams
}) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-ink">
          Resumo do financiamento
        </h3>
        <span className="text-xs text-muted">
          {financing.type.toUpperCase()} · {financing.term} meses ·{' '}
          {formatPercent(financing.rate)} a.a.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <CompactStat
          label="1ª parcela"
          value={formatBRL(summary.firstInstallment)}
        />
        <CompactStat
          label="Última parcela"
          value={formatBRL(summary.lastInstallment)}
        />
        <CompactStat
          label="Parcela média"
          value={formatBRL(summary.averageInstallment)}
        />
        <CompactStat label="Total pago" value={formatBRL(summary.totalPaid)} />
        <CompactStat
          label="Total de juros"
          value={formatBRL(summary.totalInterest)}
        />
        <CompactStat
          label="Juros / principal"
          value={formatPercent(summary.interestOverPrincipal, 0)}
          hint={`Principal ${formatBRL(summary.financed)}`}
        />
      </div>
    </div>
  )
}

function CompactStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-ink tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

function StatusBadge({
  canBuyCash,
  canAfford,
}: {
  canBuyCash: boolean
  canAfford: boolean
}) {
  if (canBuyCash) {
    return (
      <span className="inline-flex rounded-md bg-cash-soft px-2 py-0.5 text-xs font-medium text-cash">
        À vista
      </span>
    )
  }
  if (canAfford) {
    return (
      <span className="inline-flex rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
        Viável
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
      Inviável
    </span>
  )
}

function MainResult({
  result,
  affordable,
  financing,
  onLoanSummaryChange,
}: {
  result: CalculationResult
  affordable: boolean
  financing: FinancingParams
  onLoanSummaryChange: (summary: LoanSummary | null) => void
}) {
  const isCash = result.purchaseMode === 'cash'

  useEffect(() => {
    if (!affordable || isCash) {
      onLoanSummaryChange(null)
    }
  }, [affordable, isCash, result.monthsToAfford, onLoanSummaryChange])

  return (
    <>
      <div
        className={`rounded-2xl border px-6 py-7 ${
          affordable
            ? isCash
              ? 'border-cash/20 bg-cash-soft'
              : 'border-success/20 bg-success-soft'
            : 'border-line bg-accent-soft'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Resultado principal
        </p>
        {affordable ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              {isCash ? (
                <>
                  Você consegue comprar à vista em{' '}
                  <span className="text-cash">
                    {formatDuration(result.monthsToAfford!)}
                  </span>
                </>
              ) : (
                <>
                  Você consegue financiar em{' '}
                  <span className="text-success">
                    {formatDuration(result.monthsToAfford!)}
                  </span>
                </>
              )}
            </h2>
            <p className="mt-2 text-sm text-muted max-w-xl">
              {isCash
                ? 'Tempo mínimo estimado para o patrimônio disponível cobrir o preço integral do imóvel.'
                : `Tempo mínimo estimado com o patrimônio cobrindo a entrada e a prestação dentro de ${(MAX_INCOME_RATIO * 100).toFixed(0)}% da renda.`}{' '}
              Clique em um ano na tabela para simular esperar mais.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Não foi possível comprar em até {result.maxYearsSimulated} anos
            </h2>
            <p className="mt-2 text-sm text-muted max-w-xl">
              Ajuste aportes, patrimônio prévio, salário ou o preço do imóvel —
              ou explore os anos na tabela para ver quanto de patrimônio prévio
              tornaria cada cenário viável.
            </p>
          </>
        )}
      </div>

      {affordable &&
        result.propertyPriceAtPurchase != null &&
        result.minimumDownPayment != null &&
        result.availableWealthAtPurchase != null && (
          <AdjustableScenario
            scenarioKey={`main-${result.monthsToAfford}-${financing.type}-${financing.term}-${financing.rate}`}
            propertyPrice={result.propertyPriceAtPurchase}
            minimumDownPayment={result.minimumDownPayment}
            availableWealth={result.availableWealthAtPurchase}
            maxAllowedInstallment={result.maxAllowedInstallment!}
            propertyAppreciation={result.propertyAppreciation!}
            investments={result.investmentsAtPurchase!}
            fgts={result.fgtsAtPurchase!}
            salary={result.salaryAtPurchase!}
            financing={financing}
            showAvailableWealth
            reportLoanSummary={!isCash}
            onLoanSummaryChange={onLoanSummaryChange}
          />
        )}
    </>
  )
}

function YearScenario({
  snapshot,
  initialPropertyPrice,
  minimumMonths,
  financing,
  onBack,
  onLoanSummaryChange,
}: {
  snapshot: YearSnapshot
  initialPropertyPrice: number
  minimumMonths: number | null
  financing: FinancingParams
  onBack: () => void
  onLoanSummaryChange: (summary: LoanSummary | null) => void
}) {
  const maxAllowedInstallment = snapshot.salary * MAX_INCOME_RATIO
  const appreciation = snapshot.propertyPrice - initialPropertyPrice
  const yearLabel =
    snapshot.year === 0 ? 'hoje' : `no ano ${snapshot.year}`

  useEffect(() => {
    if (!snapshot.canAfford || snapshot.canBuyCash) onLoanSummaryChange(null)
  }, [snapshot.canAfford, snapshot.canBuyCash, snapshot.year, onLoanSummaryChange])

  return (
    <>
      <div
        className={`rounded-2xl border px-6 py-7 ${
          snapshot.canBuyCash
            ? 'border-cash/20 bg-cash-soft'
            : snapshot.canAfford
              ? 'border-success/20 bg-success-soft'
              : 'border-danger/15 bg-danger-soft'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Cenário exploratório
          </p>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            Voltar ao resultado principal
          </button>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          {snapshot.canBuyCash ? (
            <>
              Compra <span className="text-cash">à vista</span> {yearLabel}
            </>
          ) : snapshot.canAfford ? (
            <>
              Compra <span className="text-success">viável</span> {yearLabel}
            </>
          ) : (
            <>
              Compra <span className="text-danger">inviável</span> {yearLabel}
            </>
          )}
        </h2>
        <p className="mt-2 text-sm text-muted max-w-xl">
          {buildYearHint(snapshot, minimumMonths)}
        </p>
      </div>

      {snapshot.canAfford ? (
        <AdjustableScenario
          scenarioKey={`year-${snapshot.year}-${financing.type}-${financing.term}-${financing.rate}`}
          propertyPrice={snapshot.propertyPrice}
          minimumDownPayment={snapshot.minimumDownPayment}
          availableWealth={snapshot.availableWealth}
          maxAllowedInstallment={maxAllowedInstallment}
          propertyAppreciation={appreciation}
          investments={snapshot.investments}
          fgts={snapshot.fgts}
          salary={snapshot.salary}
          financing={financing}
          showAvailableWealth
          reportLoanSummary={!snapshot.canBuyCash}
          onLoanSummaryChange={onLoanSummaryChange}
        />
      ) : (
        <ScenarioMetrics
          mode={null}
          downPayment={snapshot.minimumDownPayment}
          firstInstallment={snapshot.firstInstallment}
          maxAllowedInstallment={maxAllowedInstallment}
          financedAmount={snapshot.maxFinanced}
          propertyPrice={snapshot.propertyPrice}
          propertyAppreciation={appreciation}
          investments={snapshot.investments}
          fgts={snapshot.fgts}
          salary={snapshot.salary}
          availableWealth={snapshot.availableWealth}
          showAvailableWealth
        />
      )}
    </>
  )
}

function AdjustableScenario({
  scenarioKey,
  propertyPrice,
  minimumDownPayment,
  availableWealth,
  maxAllowedInstallment,
  propertyAppreciation,
  investments,
  fgts,
  salary,
  financing,
  showAvailableWealth = false,
  reportLoanSummary = true,
  onLoanSummaryChange,
}: {
  scenarioKey: string
  propertyPrice: number
  minimumDownPayment: number
  availableWealth: number
  maxAllowedInstallment: number
  propertyAppreciation: number
  investments: number
  fgts: number
  salary: number
  financing: FinancingParams
  showAvailableWealth?: boolean
  reportLoanSummary?: boolean
  onLoanSummaryChange?: (summary: LoanSummary | null) => void
}) {
  const bounds = useMemo(
    () =>
      downPaymentBounds(propertyPrice, minimumDownPayment, availableWealth),
    [propertyPrice, minimumDownPayment, availableWealth],
  )

  const [chosenDownPayment, setChosenDownPayment] = useState(bounds.max)

  useEffect(() => {
    setChosenDownPayment(bounds.max)
  }, [scenarioKey, bounds.max, bounds.min])

  const clampedDownPayment = Math.min(
    Math.max(chosenDownPayment, bounds.min),
    bounds.max,
  )

  const financingResult = useMemo(
    () =>
      financingFromDownPayment(
        propertyPrice,
        clampedDownPayment,
        financing.rate / 100,
        financing.term,
        financing.type,
      ),
    [propertyPrice, clampedDownPayment, financing],
  )

  const loanSummary = useMemo(
    () =>
      computeLoanSummary(
        financingResult.financed,
        financing.rate / 100,
        financing.term,
        financing.type,
      ),
    [financingResult.financed, financing],
  )

  useEffect(() => {
    if (!reportLoanSummary) {
      onLoanSummaryChange?.(null)
      return
    }
    onLoanSummaryChange?.(loanSummary)
  }, [loanSummary, reportLoanSummary, onLoanSummaryChange])

  return (
    <>
      {bounds.adjustable && (
        <DownPaymentSlider
          value={clampedDownPayment}
          min={bounds.min}
          max={bounds.max}
          onChange={setChosenDownPayment}
        />
      )}

      <ScenarioMetrics
        mode={financingResult.mode}
        downPayment={financingResult.downPayment}
        firstInstallment={financingResult.installment}
        maxAllowedInstallment={maxAllowedInstallment}
        financedAmount={financingResult.financed}
        propertyPrice={propertyPrice}
        propertyAppreciation={propertyAppreciation}
        investments={investments}
        fgts={fgts}
        salary={salary}
        availableWealth={availableWealth}
        showAvailableWealth={showAvailableWealth}
        minimumDownPayment={bounds.min}
        adjustable={bounds.adjustable}
      />
    </>
  )
}

function DownPaymentSlider({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const clamped = Math.min(max, Math.max(min, Math.round(value)))
  const progress = max > min ? ((clamped - min) / (max - min)) * 100 : 0

  function handleChange(raw: number) {
    // Garante que os extremos sejam sempre alcançáveis
    if (raw <= min) onChange(min)
    else if (raw >= max) onChange(max)
    else onChange(Math.round(raw))
  }

  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-ink">Entrada escolhida</p>
        <p className="text-lg font-semibold text-ink tracking-tight">
          {formatBRL(clamped)}
        </p>
      </div>
      <p className="text-xs text-muted mb-4">
        Ajuste entre a entrada mínima e o patrimônio disponível para reduzir o
        valor financiado e os juros.
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={clamped}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="down-payment-slider w-full cursor-pointer"
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        aria-label="Entrada escolhida"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
      />
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Mín. {formatBRL(min)}</span>
        <span>Máx. {formatBRL(max)}</span>
      </div>
    </div>
  )
}

function buildYearHint(
  snapshot: YearSnapshot,
  minimumMonths: number | null,
): string {
  if (snapshot.canBuyCash) {
    const base =
      snapshot.year === 0
        ? 'Neste momento o patrimônio disponível cobriria o imóvel sem financiamento.'
        : `Se esperar ${snapshot.year} ${snapshot.year === 1 ? 'ano' : 'anos'}, o patrimônio superaria o preço do imóvel.`
    if (minimumMonths !== null && snapshot.year * 12 > minimumMonths) {
      return `${base} O tempo mínimo continua sendo ${formatDuration(minimumMonths)}.`
    }
    return base
  }

  if (snapshot.canAfford) {
    const base =
      snapshot.year === 0
        ? 'Neste momento você já reuniria as condições para financiar.'
        : `Se esperar ${snapshot.year} ${snapshot.year === 1 ? 'ano' : 'anos'}, este seria o cenário do financiamento.`
    if (minimumMonths !== null && snapshot.year * 12 > minimumMonths) {
      return `${base} O tempo mínimo continua sendo ${formatDuration(minimumMonths)}.`
    }
    return base
  }

  if (snapshot.priorWealthNeeded !== null && snapshot.priorWealthNeeded > 0) {
    return `Neste horizonte a compra não fecha com o patrimônio atual. Seria viável caso você tivesse um patrimônio prévio de ${formatBRL(snapshot.priorWealthNeeded)} (valor em t=0, rendendo junto com os aportes).`
  }

  return 'Neste horizonte a compra ainda não fecha com as regras de entrada e renda.'
}

function ScenarioMetrics({
  mode,
  downPayment,
  firstInstallment,
  maxAllowedInstallment,
  financedAmount,
  propertyPrice,
  propertyAppreciation,
  investments,
  fgts,
  salary,
  availableWealth,
  showAvailableWealth = false,
  minimumDownPayment,
  adjustable = false,
}: {
  mode: PurchaseMode | null
  downPayment: number
  firstInstallment: number
  maxAllowedInstallment: number
  financedAmount: number
  propertyPrice: number
  propertyAppreciation: number
  investments: number
  fgts: number
  salary: number
  availableWealth?: number
  showAvailableWealth?: boolean
  minimumDownPayment?: number
  adjustable?: boolean
}) {
  const isCash = mode === 'cash'

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={isCash ? 'Valor à vista' : adjustable ? 'Entrada' : 'Entrada necessária'}
          value={formatBRL(downPayment)}
          hint={
            isCash
              ? 'Pagamento integral sem financiamento'
              : adjustable && minimumDownPayment !== undefined
                ? `Mínimo exigido: ${formatBRL(minimumDownPayment)}`
                : `Mín. ${(MIN_DOWN_PAYMENT_RATIO * 100).toFixed(0)}% ou o necessário para caber em 30% da renda`
          }
        />
        <Metric
          label="Prestação inicial"
          value={isCash ? '—' : formatBRL(firstInstallment)}
          hint={isCash ? 'Sem parcelas' : 'Primeira parcela estimada'}
        />
        <Metric
          label="Prestação máxima permitida"
          value={formatBRL(maxAllowedInstallment)}
          hint={`${(MAX_INCOME_RATIO * 100).toFixed(0)}% do salário neste momento`}
        />
        <Metric
          label="Valor financiado"
          value={isCash ? formatBRL(0) : formatBRL(financedAmount)}
          hint={
            isCash
              ? 'Compra sem financiamento'
              : 'Preço − entrada neste cenário'
          }
        />
      </div>

      <div
        className={`grid gap-3 sm:grid-cols-2 ${
          showAvailableWealth ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        }`}
      >
        <Metric
          label="Preço do imóvel"
          value={formatBRL(propertyPrice)}
          hint={
            propertyAppreciation >= 0
              ? `+${formatBRL(propertyAppreciation)} vs. hoje`
              : `${formatBRL(propertyAppreciation)} vs. hoje`
          }
          compact
        />
        <Metric
          label="Patrimônio investido"
          value={formatBRL(investments)}
          compact
        />
        <Metric label="FGTS acumulado" value={formatBRL(fgts)} compact />
        {showAvailableWealth && availableWealth !== undefined && (
          <Metric
            label="Disponível p/ entrada"
            value={formatBRL(availableWealth)}
            hint={
              availableWealth < investments + fgts
                ? 'FGTS liberado só após 3 anos'
                : undefined
            }
            compact
          />
        )}
        <Metric label="Salário atualizado" value={formatBRL(salary)} compact />
      </div>
    </>
  )
}

function visibleProjection(result: CalculationResult) {
  return result.yearlyProjection.filter((row) => row.year <= 10)
}

function Metric({
  label,
  value,
  hint,
  compact = false,
}: {
  label: string
  value: string
  hint?: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-panel ${
        compact ? 'px-4 py-3' : 'px-5 py-4'
      }`}
    >
      <p className="text-xs text-muted mb-1">{label}</p>
      <p
        className={`font-semibold text-ink tracking-tight ${
          compact ? 'text-lg' : 'text-xl'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted leading-snug">{hint}</p>}
    </div>
  )
}
