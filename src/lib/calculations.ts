export type FinancingType = 'sac' | 'price'
export type PurchaseMode = 'finance' | 'cash'

export interface CalculatorInputs {
  propertyPrice: number
  realEstateInflation: number
  initialSalary: number
  salaryGrowth: number
  useFgts: boolean
  monthlyContribution: number
  contributionsGrowWithSalary: boolean
  priorWealth: number
  investmentReturn: number
  financingType: FinancingType
  financingTerm: number
  financingRate: number
}

export interface YearSnapshot {
  year: number
  propertyPrice: number
  salary: number
  investments: number
  fgts: number
  totalWealth: number
  availableWealth: number
  /** Entrada mínima para financiar (banco/renda) */
  minimumDownPayment: number
  requiredDownPayment: number
  maxFinanced: number
  firstInstallment: number
  canAffordFinance: boolean
  canBuyCash: boolean
  canAfford: boolean
  purchaseMode: PurchaseMode | null
  /** Patrimônio prévio (em t=0) que tornaria este ano viável */
  priorWealthNeeded: number | null
}

export interface CalculationResult {
  monthsToAfford: number | null
  yearsToAfford: number | null
  purchaseMode: PurchaseMode | null
  propertyPriceAtPurchase: number | null
  requiredDownPayment: number | null
  minimumDownPayment: number | null
  availableWealthAtPurchase: number | null
  financedAmount: number | null
  firstInstallment: number | null
  maxAllowedInstallment: number | null
  salaryAtPurchase: number | null
  investmentsAtPurchase: number | null
  fgtsAtPurchase: number | null
  totalWealthAtPurchase: number | null
  propertyAppreciation: number | null
  yearlyProjection: YearSnapshot[]
  maxYearsSimulated: number
}

const MAX_INCOME_RATIO = 0.3
const MIN_DOWN_PAYMENT_RATIO = 0.2
const MAX_CONTRIBUTION_RATIO = 0.7
const FGTS_SALARY_RATIO = 0.08
const FGTS_ANNUAL_YIELD = 0.03
const FGTS_UNLOCK_MONTHS = 36
const MAX_MONTHS = 480 // 40 years

export function maxMonthlyContribution(salary: number): number {
  return Math.max(0, salary * MAX_CONTRIBUTION_RATIO)
}

export function isContributionAboveLimit(
  contribution: number,
  salary: number,
): boolean {
  return contribution > maxMonthlyContribution(salary) + 1e-6
}

function monthlyRateFromAnnual(annual: number): number {
  return (1 + annual) ** (1 / 12) - 1
}

function financingMonthlyRate(annual: number): number {
  // Bancos brasileiros tipicamente usam taxa nominal / 12
  return annual / 12
}

/** Prestação inicial PRICE */
export function priceInstallment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (principal <= 0) return 0
  const i = financingMonthlyRate(annualRate)
  if (i === 0) return principal / termMonths
  const factor = (1 + i) ** termMonths
  return (principal * i * factor) / (factor - 1)
}

/** Prestação inicial SAC (maior prestação) */
export function sacFirstInstallment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (principal <= 0) return 0
  const i = financingMonthlyRate(annualRate)
  const amortization = principal / termMonths
  return amortization + principal * i
}

export function firstInstallment(
  principal: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): number {
  return type === 'sac'
    ? sacFirstInstallment(principal, annualRate, termMonths)
    : priceInstallment(principal, annualRate, termMonths)
}

/** Valor máximo financiável dado a prestação máxima permitida */
export function maxFinancedAmount(
  maxInstallment: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): number {
  if (maxInstallment <= 0) return 0
  const i = financingMonthlyRate(annualRate)

  if (type === 'sac') {
    const denominator = 1 / termMonths + i
    return denominator > 0 ? maxInstallment / denominator : 0
  }

  // PRICE
  if (i === 0) return maxInstallment * termMonths
  const factor = (1 + i) ** termMonths
  return (maxInstallment * (factor - 1)) / (i * factor)
}

export function requiredDownPayment(
  propertyPrice: number,
  salary: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): { downPayment: number; maxFinanced: number; installment: number } {
  const maxInstallment = salary * MAX_INCOME_RATIO
  const maxByIncome = maxFinancedAmount(
    maxInstallment,
    annualRate,
    termMonths,
    type,
  )
  const maxByBank = propertyPrice * (1 - MIN_DOWN_PAYMENT_RATIO)
  const maxFinanced = Math.min(maxByIncome, maxByBank, propertyPrice)
  const downPayment = Math.max(0, propertyPrice - maxFinanced)
  const installment = firstInstallment(
    maxFinanced,
    annualRate,
    termMonths,
    type,
  )

  return { downPayment, maxFinanced, installment }
}

export function canAffordFinance(
  propertyPrice: number,
  salary: number,
  availableWealth: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): boolean {
  const { downPayment, maxFinanced, installment } = requiredDownPayment(
    propertyPrice,
    salary,
    annualRate,
    termMonths,
    type,
  )

  if (maxFinanced <= 0 && downPayment > propertyPrice + 1e-6) return false
  if (availableWealth + 1e-6 < downPayment) return false
  if (installment > salary * MAX_INCOME_RATIO + 1e-6) return false
  return true
}

export function canBuyCash(
  propertyPrice: number,
  availableWealth: number,
): boolean {
  return availableWealth + 1e-6 >= propertyPrice
}

export function downPaymentBounds(
  propertyPrice: number,
  minimumDownPayment: number,
  availableWealth: number,
): { min: number; max: number; adjustable: boolean } {
  // Inteiros em reais para o range input conseguir atingir os extremos
  const min = Math.ceil(Math.min(minimumDownPayment, propertyPrice))
  const max = Math.floor(
    Math.min(Math.max(availableWealth, min), propertyPrice),
  )
  return {
    min,
    max: Math.max(min, max),
    adjustable: max - min > 1,
  }
}

export function financingFromDownPayment(
  propertyPrice: number,
  chosenDownPayment: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): {
  downPayment: number
  financed: number
  installment: number
  mode: PurchaseMode
} {
  const downPayment = Math.min(
    Math.max(0, chosenDownPayment),
    propertyPrice,
  )
  const financed = Math.max(0, propertyPrice - downPayment)

  // Tolerância de R$ 1 por arredondamento do slider
  if (financed < 1) {
    return {
      downPayment: propertyPrice,
      financed: 0,
      installment: 0,
      mode: 'cash',
    }
  }

  return {
    downPayment,
    financed,
    installment: firstInstallment(financed, annualRate, termMonths, type),
    mode: 'finance',
  }
}

export interface LoanSummary {
  mode: PurchaseMode
  type: FinancingType
  termMonths: number
  financed: number
  firstInstallment: number
  lastInstallment: number
  averageInstallment: number
  totalPaid: number
  totalInterest: number
  /** Juros / principal, em % */
  interestOverPrincipal: number
}

export function computeLoanSummary(
  financed: number,
  annualRate: number,
  termMonths: number,
  type: FinancingType,
): LoanSummary {
  if (financed < 1 || termMonths <= 0) {
    return {
      mode: 'cash',
      type,
      termMonths,
      financed: 0,
      firstInstallment: 0,
      lastInstallment: 0,
      averageInstallment: 0,
      totalPaid: 0,
      totalInterest: 0,
      interestOverPrincipal: 0,
    }
  }

  const i = financingMonthlyRate(annualRate)

  if (type === 'price') {
    const installment = priceInstallment(financed, annualRate, termMonths)
    const totalPaid = installment * termMonths
    const totalInterest = Math.max(0, totalPaid - financed)
    return {
      mode: 'finance',
      type,
      termMonths,
      financed,
      firstInstallment: installment,
      lastInstallment: installment,
      averageInstallment: installment,
      totalPaid,
      totalInterest,
      interestOverPrincipal: financed > 0 ? (totalInterest / financed) * 100 : 0,
    }
  }

  // SAC
  const amortization = financed / termMonths
  const firstInstallment = amortization + financed * i
  const lastInstallment = amortization + amortization * i
  const totalInterest =
    i === 0 ? 0 : (financed * i * (termMonths + 1)) / 2
  const totalPaid = financed + totalInterest
  const averageInstallment = totalPaid / termMonths

  return {
    mode: 'finance',
    type,
    termMonths,
    financed,
    firstInstallment,
    lastInstallment,
    averageInstallment,
    totalPaid,
    totalInterest,
    interestOverPrincipal: financed > 0 ? (totalInterest / financed) * 100 : 0,
  }
}

/**
 * Patrimônio prévio em t=0 necessário para cobrir um alvo futuro,
 * descontando o que já virá de aportes/FGTS (sem o prévio atual).
 */
export function priorWealthNeededForTarget(
  targetAmount: number,
  wealthWithoutPrior: number,
  growthFactor: number,
): number {
  const shortfall = targetAmount - wealthWithoutPrior
  if (shortfall <= 0) return 0
  if (growthFactor <= 0) return shortfall
  return shortfall / growthFactor
}

function buildSnapshot(args: {
  year: number
  propertyPrice: number
  salary: number
  investments: number
  fgts: number
  useFgts: boolean
  availableWealth: number
  wealthWithoutPrior: number
  growthFactor: number
  financingRate: number
  financingTerm: number
  financingType: FinancingType
}): YearSnapshot {
  const req = requiredDownPayment(
    args.propertyPrice,
    args.salary,
    args.financingRate,
    args.financingTerm,
    args.financingType,
  )

  const financeOk = canAffordFinance(
    args.propertyPrice,
    args.salary,
    args.availableWealth,
    args.financingRate,
    args.financingTerm,
    args.financingType,
  )
  const cashOk = canBuyCash(args.propertyPrice, args.availableWealth)

  // Menor patrimônio prévio (t=0) que viabiliza financiamento ou compra à vista
  const priorForFinance = priorWealthNeededForTarget(
    req.downPayment,
    args.wealthWithoutPrior,
    args.growthFactor,
  )
  const priorForCash = priorWealthNeededForTarget(
    args.propertyPrice,
    args.wealthWithoutPrior,
    args.growthFactor,
  )
  const priorWealthNeeded = Math.min(priorForFinance, priorForCash)

  let purchaseMode: PurchaseMode | null = null
  if (cashOk) purchaseMode = 'cash'
  else if (financeOk) purchaseMode = 'finance'

  return {
    year: args.year,
    propertyPrice: args.propertyPrice,
    salary: args.salary,
    investments: args.investments,
    fgts: args.useFgts ? args.fgts : 0,
    totalWealth: args.investments + (args.useFgts ? args.fgts : 0),
    availableWealth: args.availableWealth,
    minimumDownPayment: req.downPayment,
    requiredDownPayment: cashOk ? args.propertyPrice : req.downPayment,
    maxFinanced: cashOk ? 0 : req.maxFinanced,
    firstInstallment: cashOk ? 0 : req.installment,
    canAffordFinance: financeOk,
    canBuyCash: cashOk,
    canAfford: financeOk || cashOk,
    purchaseMode,
    priorWealthNeeded:
      financeOk || cashOk ? null : Math.ceil(priorWealthNeeded),
  }
}

export function calculate(inputs: CalculatorInputs): CalculationResult {
  const inflation = inputs.realEstateInflation / 100
  const salaryGrowth = inputs.salaryGrowth / 100
  const investmentYield = inputs.investmentReturn / 100
  const financingRate = inputs.financingRate / 100

  const propertyMonthly = monthlyRateFromAnnual(inflation)
  const investmentMonthly = monthlyRateFromAnnual(investmentYield)
  const fgtsMonthly = monthlyRateFromAnnual(FGTS_ANNUAL_YIELD)

  let propertyPrice = inputs.propertyPrice
  let salary = inputs.initialSalary
  let monthlyContribution = Math.max(0, inputs.monthlyContribution)

  const priorWealth = Math.max(0, inputs.priorWealth)
  let priorComponent = priorWealth
  let contribComponent = 0
  let fgts = 0
  let growthFactor = 1

  const yearlyProjection: YearSnapshot[] = []

  type PurchaseSnapshot = {
    month: number
    mode: PurchaseMode
    propertyPrice: number
    salary: number
    investments: number
    fgts: number
    availableWealth: number
    minimumDownPayment: number
    downPayment: number
    financed: number
    installment: number
  }
  let purchase: PurchaseSnapshot | null = null

  function availableNow(month: number, investments: number): number {
    const fgtsAvailable =
      inputs.useFgts && month >= FGTS_UNLOCK_MONTHS ? fgts : 0
    return investments + fgtsAvailable
  }

  function wealthWithoutPriorNow(month: number): number {
    const fgtsAvailable =
      inputs.useFgts && month >= FGTS_UNLOCK_MONTHS ? fgts : 0
    return contribComponent + fgtsAvailable
  }

  function capturePurchase(
    month: number,
    investments: number,
    mode: PurchaseMode,
  ): PurchaseSnapshot {
    const availableWealth = availableNow(month, investments)
    const req = requiredDownPayment(
      propertyPrice,
      salary,
      financingRate,
      inputs.financingTerm,
      inputs.financingType,
    )

    if (mode === 'cash') {
      return {
        month,
        mode: 'cash',
        propertyPrice,
        salary,
        investments,
        fgts: inputs.useFgts ? fgts : 0,
        availableWealth,
        minimumDownPayment: req.downPayment,
        downPayment: propertyPrice,
        financed: 0,
        installment: 0,
      }
    }

    return {
      month,
      mode: 'finance',
      propertyPrice,
      salary,
      investments,
      fgts: inputs.useFgts ? fgts : 0,
      availableWealth,
      minimumDownPayment: req.downPayment,
      downPayment: req.downPayment,
      financed: req.maxFinanced,
      installment: req.installment,
    }
  }

  // Snapshot no mês 0 (agora)
  {
    const investments = priorComponent + contribComponent
    const snapshot = buildSnapshot({
      year: 0,
      propertyPrice,
      salary,
      investments,
      fgts,
      useFgts: inputs.useFgts,
      availableWealth: availableNow(0, investments),
      wealthWithoutPrior: wealthWithoutPriorNow(0),
      growthFactor,
      financingRate,
      financingTerm: inputs.financingTerm,
      financingType: inputs.financingType,
    })
    yearlyProjection.push(snapshot)
    if (snapshot.purchaseMode) {
      purchase = capturePurchase(0, investments, snapshot.purchaseMode)
    }
  }

  for (let month = 1; month <= MAX_MONTHS; month++) {
    priorComponent *= 1 + investmentMonthly
    contribComponent *= 1 + investmentMonthly
    growthFactor *= 1 + investmentMonthly

    if (inputs.useFgts) fgts *= 1 + fgtsMonthly

    contribComponent += monthlyContribution
    if (inputs.useFgts) fgts += salary * FGTS_SALARY_RATIO

    propertyPrice *= 1 + propertyMonthly

    if (month % 12 === 0) {
      salary *= 1 + salaryGrowth
      if (inputs.contributionsGrowWithSalary) {
        monthlyContribution *= 1 + salaryGrowth
      }
    }

    const investments = priorComponent + contribComponent
    const availableWealth = availableNow(month, investments)
    const wealthWithoutPrior = wealthWithoutPriorNow(month)

    if (purchase === null) {
      const financeOk = canAffordFinance(
        propertyPrice,
        salary,
        availableWealth,
        financingRate,
        inputs.financingTerm,
        inputs.financingType,
      )
      const cashOk = canBuyCash(propertyPrice, availableWealth)
      if (cashOk) {
        purchase = capturePurchase(month, investments, 'cash')
      } else if (financeOk) {
        purchase = capturePurchase(month, investments, 'finance')
      }
    }

    if (month % 12 === 0) {
      yearlyProjection.push(
        buildSnapshot({
          year: month / 12,
          propertyPrice,
          salary,
          investments,
          fgts,
          useFgts: inputs.useFgts,
          availableWealth,
          wealthWithoutPrior,
          growthFactor,
          financingRate,
          financingTerm: inputs.financingTerm,
          financingType: inputs.financingType,
        }),
      )
    }
  }

  return {
    monthsToAfford: purchase?.month ?? null,
    yearsToAfford:
      purchase === null ? null : Math.round((purchase.month / 12) * 10) / 10,
    purchaseMode: purchase?.mode ?? null,
    propertyPriceAtPurchase: purchase?.propertyPrice ?? null,
    requiredDownPayment: purchase?.downPayment ?? null,
    minimumDownPayment: purchase?.minimumDownPayment ?? null,
    availableWealthAtPurchase: purchase?.availableWealth ?? null,
    financedAmount: purchase?.financed ?? null,
    firstInstallment: purchase?.installment ?? null,
    maxAllowedInstallment: purchase
      ? purchase.salary * MAX_INCOME_RATIO
      : null,
    salaryAtPurchase: purchase?.salary ?? null,
    investmentsAtPurchase: purchase?.investments ?? null,
    fgtsAtPurchase: purchase?.fgts ?? null,
    totalWealthAtPurchase: purchase
      ? purchase.investments + purchase.fgts
      : null,
    propertyAppreciation: purchase
      ? purchase.propertyPrice - inputs.propertyPrice
      : null,
    yearlyProjection,
    maxYearsSimulated: MAX_MONTHS / 12,
  }
}

export const DEFAULT_INPUTS: CalculatorInputs = {
  propertyPrice: 300_000,
  realEstateInflation: 8,
  initialSalary: 10_000,
  salaryGrowth: 4,
  useFgts: true,
  monthlyContribution: 3_000,
  contributionsGrowWithSalary: true,
  priorWealth: 0,
  investmentReturn: 10,
  financingType: 'sac',
  financingTerm: 360,
  financingRate: 10.5,
}

export {
  MAX_INCOME_RATIO,
  MIN_DOWN_PAYMENT_RATIO,
  MAX_CONTRIBUTION_RATIO,
  FGTS_SALARY_RATIO,
  FGTS_ANNUAL_YIELD,
  FGTS_UNLOCK_MONTHS,
}
