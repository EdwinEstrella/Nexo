const fs = require('fs')

function isoToday () {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function addPeriodISO (dateISO, index, frequency) {
    const d = new Date(`${dateISO}T00:00:00`)
    if (frequency === 'weekly') {
        d.setDate(d.getDate() + (7 * index))
    } else if (frequency === 'biweekly') {
        d.setDate(d.getDate() + (14 * index))
    } else {
        d.setMonth(d.getMonth() + index)
    }
    return d.toISOString().slice(0, 10)
}

function generateInstallments (loanInput) {
    const principal = Number(loanInput.principal) || 0
    const termMonths = Math.max(1, Number(loanInput.term_months) || 1)
    const freq = loanInput.payment_frequency
    let frequency, periods
    if (freq === 'weekly') {
        frequency = 'weekly'
        periods = termMonths * 4
    } else if (freq === 'biweekly') {
        frequency = 'biweekly'
        periods = termMonths * 2
    } else {
        frequency = 'monthly'
        periods = termMonths
    }
    const out = []
    for (let i = 1; i <= periods; i++) {
        out.push({
            n: i,
            due_date: addPeriodISO(loanInput.start_date, i, frequency),
            principal_target: 0,
            paid_interest: 0,
            paid_principal: 0,
            paid_late_fee: 0
        })
    }
    return out
}

function periodicRateForLoan (loan) {
    const pct = Number(loan.interest_rate_pct) || 0
    const freq = loan.payment_frequency === 'weekly' ? 'weekly' : (loan.payment_frequency === 'biweekly' ? 'biweekly' : 'monthly')
    const mode = loan.interest_mode === 'monthly' ? 'monthly' : 'annual'
    if (mode === 'annual') {
        if (freq === 'weekly') return (pct / 100) / 52
        if (freq === 'biweekly') return (pct / 100) / 26
        return (pct / 100) / 12
    }
    return pct / 100
}

function normalizeInstallmentRecord (inst, fallbackPrincipalTarget = 0) {
    if (inst && typeof inst === 'object') {
        return {
            n: Number(inst.n) || 0,
            due_date: inst.due_date,
            principal_target: 0,
            paid_interest: Number(inst.paid_interest) || 0,
            paid_principal: Number(inst.paid_principal) || 0,
            paid_late_fee: Number(inst.paid_late_fee) || 0,
            legacy_paid_amount: Number(inst.paid_amount) || 0
        }
    }
    return {
        n: 0,
        due_date: isoToday(),
        principal_target: 0,
        paid_interest: 0,
        paid_principal: 0,
        paid_late_fee: 0,
        legacy_paid_amount: 0
    }
}

function evaluateInstallment (inst, loan, policy, remainingPrincipalAtStart, now = new Date()) {
    const due = new Date(`${inst.due_date}T00:00:00`)
    const periodRate = periodicRateForLoan(loan)
    const interestDue = Math.max(0, Number((remainingPrincipalAtStart * periodRate).toFixed(2)))
    const principalTarget = 0
    let paidInterest = Math.max(0, Number(inst.paid_interest) || 0)
    let paidPrincipal = Math.max(0, Number(inst.paid_principal) || 0)
    const paidLateFee = Math.max(0, Number(inst.paid_late_fee) || 0)
    const legacyPaid = Math.max(0, Number(inst.legacy_paid_amount) || 0)
    if (legacyPaid > 0 && paidInterest === 0 && paidPrincipal === 0 && paidLateFee === 0) {
        paidInterest = Math.min(legacyPaid, interestDue)
        paidPrincipal = Math.max(0, legacyPaid - paidInterest)
    }

    const pendingInterest = Math.max(0, interestDue - paidInterest)
    const pendingPrincipal = 0
    const basePending = pendingInterest + pendingPrincipal

    const msDay = 1000 * 60 * 60 * 24
    const rawDaysLate = basePending > 0 ? Math.floor((now - due) / msDay) : 0
    const grace = loan?.grace_days != null ? Number(loan.grace_days) || 0 : (Number(policy.grace_days) || 0)
    const lateFeePercent = loan?.late_fee_percent != null ? Number(loan.late_fee_percent) || 0 : (Number(policy.late_fee_percent) || 0)
    const lateDays = Math.max(0, rawDaysLate - grace)
    const lateFeeAccrued = pendingInterest > 0 ? pendingInterest * (lateFeePercent / 100) * lateDays : 0
    const pendingLateFee = Math.max(0, lateFeeAccrued - paidLateFee)
    const pendingTotal = basePending + pendingLateFee

    let status = 'pendiente'
    if (pendingTotal <= 0.009) status = 'pagado'
    else if (rawDaysLate > grace) status = 'mora'
    else if (rawDaysLate > 0) status = 'atrasado'

    return {
        ...inst,
        interest_due: interestDue,
        principal_target: principalTarget,
        total_due: Number((interestDue + principalTarget).toFixed(2)),
        pending_interest: Number(pendingInterest.toFixed(2)),
        pending_principal: Number(pendingPrincipal.toFixed(2)),
        pending_late_fee: Number(pendingLateFee.toFixed(2)),
        lateFeeAccrued: Number(lateFeeAccrued.toFixed(2)),
        pendingTotal: Number(pendingTotal.toFixed(2)),
        status,
        daysLate: rawDaysLate,
        lateDays
    }
}

function summarizeLoan (loan, state, now = new Date()) {
    const policy = state.settings
    const rawInst = Array.isArray(loan.installments) ? loan.installments : []
    const periods = rawInst.length || Math.max(1, Number(loan.term_months) || 1)
    const fallbackTarget = periods > 0 ? (Number(loan.principal) || 0) / periods : (Number(loan.principal) || 0)
    const normalized = rawInst.length ? rawInst.map((i) => normalizeInstallmentRecord(i, fallbackTarget)) : generateInstallments({
        principal: Number(loan.principal) || 0,
        term_months: Number(loan.term_months) || 1,
        payment_frequency: loan.payment_frequency || state.settings.payment_frequency,
        start_date: loan.start_date || isoToday()
    }).map((i) => normalizeInstallmentRecord(i, fallbackTarget))

    let remainingPrincipal = Number(loan.principal) || 0
    const items = []
    for (const inst of normalized.sort((a, b) => a.n - b.n)) {
        const evaluated = evaluateInstallment(inst, loan, policy, remainingPrincipal, now)
        items.push(evaluated)
        remainingPrincipal = Math.max(0, remainingPrincipal - (Number(inst.paid_principal) || 0))
    }

    const mora = items.reduce((s, it) => s + Math.max(0, it.pending_late_fee || 0), 0)
    
    const pastAndCurrentItems = items.filter((it) => {
        const dueDate = new Date(String(it.due_date).slice(0, 10) + 'T12:00:00')
        return dueDate <= now
    })
    const exigibleInterest = pastAndCurrentItems.reduce((s, it) => s + (it.pending_interest || 0), 0)
    const pending = remainingPrincipal + mora + exigibleInterest

    const next = items.find((it) => it.status !== 'pagado')
    const paidCount = items.filter((it) => it.status === 'pagado').length
    const isFullyPaid = remainingPrincipal <= 0.009 && pending <= 0.009
    const status = isFullyPaid ? 'finalizado' : (items.some((it) => it.status === 'mora') ? 'moroso' : 'activo')
    
    return {
        pending,
        mora,
        status,
        itemsSummary: items.map(it => ({ n: it.n, due_date: it.due_date, status: it.status, pendingTotal: it.pendingTotal, exigible: new Date(String(it.due_date).slice(0, 10) + 'T12:00:00') <= now }))
    }
}

const state = {
  settings: {
    late_fee_percent: 1,
    grace_days: 2,
    payment_frequency: 'monthly',
    interest_mode: 'annual',
    reminder_days: 2
  }
}

const loan = {
  principal: 311200,
  term_months: 12,
  interest_rate_pct: 6,
  payment_frequency: 'monthly',
  interest_mode: 'annual',
  late_fee_percent: 0,
  grace_days: 0,
  start_date: '2026-05-28'
}

console.log(JSON.stringify(summarizeLoan(loan, state, new Date('2026-05-28T12:00:00')), null, 2))
