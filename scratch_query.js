async function run() {
  const { createClient } = await import('@insforge/sdk')
  const client = createClient({
    baseUrl: 'https://nexo.azokia.com',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTYwMzR9.BWGjlHUNysNu8zQofMIxru4yimpk-Wd2ANZAqC0xXvQ'
  })

  const { data: loans, error: lErr } = await client.database.from('nexo_loans').select('*').eq('reference', 'CR-00036')
  if (lErr) {
    console.error('lErr', lErr)
    return
  }
  console.log('LOANS:', loans)
  if (loans && loans.length > 0) {
    const { data: insts, error: iErr } = await client.database.from('nexo_loan_installments').select('*').eq('loan_id', loans[0].id)
    if (iErr) {
      console.error('iErr', iErr)
      return
    }
    console.log('INSTALLMENTS COUNT:', insts.length)
    console.log('INSTALLMENTS:', insts)
  }
}
run().catch(console.error)
