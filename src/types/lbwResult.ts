export interface LbwResult {
  decision: string
  confidence: number

  pitch_point: number[]
  impact_point: number[]

  trajectory: number[][]

  zones: {
    pitch: string
    impact: string
  }
}
