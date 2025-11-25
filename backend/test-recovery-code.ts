import bcrypt from 'bcrypt'

async function testRecoveryCode() {
  const code = "DSUUIWYF"
  
  // Simulate seed: hash uppercase
  const hashedCode = await bcrypt.hash(code.toUpperCase(), 10)
  
  // Simulate verify: compare uppercase with hash
  const matches = await bcrypt.compare(code.trim().toUpperCase(), hashedCode)
  
  console.log('Code:', code)
  console.log('Hashed:', hashedCode)
  console.log('Matches:', matches)
}

testRecoveryCode()
