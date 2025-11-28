function App() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢 ShopME Backoffice</h1>
      <p style={{ fontSize: '1.5rem', color: '#666' }}>Hello World!</p>
      <p style={{ marginTop: '2rem', color: '#999' }}>
        Running on port 3002
      </p>
      <div style={{ 
        marginTop: '3rem', 
        padding: '1rem 2rem', 
        backgroundColor: '#e8f5e9', 
        borderRadius: '8px' 
      }}>
        <p>✅ Database: @shopme/database (shared)</p>
        <p>✅ Env: ../../.env (shared)</p>
      </div>
    </div>
  )
}

export default App
