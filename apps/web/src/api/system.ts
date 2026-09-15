export type HealthResponse = {
  status: string
}

export type VersionResponse = {
  version: string
  environment: string
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health")

  if (!response.ok) {
    throw new Error("Failed to fetch API health")
  }

  return response.json()
}

export async function getVersion(): Promise<VersionResponse> {
  const response = await fetch("/api/version")

  if (!response.ok) {
    throw new Error("Failed to fetch API version")
  }

  return response.json()
}