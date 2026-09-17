import { useEffect, useState } from "react"

import {
  getHealth,
  getVersion,
  type HealthResponse,
  type VersionResponse,
} from "./api/system"

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [version, setVersion] = useState<VersionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSystemStatus() {
      try {
        const [healthResponse, versionResponse] = await Promise.all([
          getHealth(),
          getVersion(),
        ])

        setHealth(healthResponse)
        setVersion(versionResponse)
      } catch {
        setError("Unable to connect to the API")
      }
    }

    void loadSystemStatus()
  }, [])

  return (
    <main>
      <h1>CHSN-RUNNERS V2</h1>

      {error && <p>{error}</p>}

      {!error && (!health || !version) && <p>Loading system status...</p>}

      {health && version && (
        <section>
          <p>API Status: {health.status}</p>
          <p>Version: {version.version}</p>
          <p>Environment: {version.environment}</p>
        </section>
      )}
    </main>
  )
}

export default App